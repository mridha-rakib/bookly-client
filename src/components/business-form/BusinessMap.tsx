"use client";

import React, { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FullScreenIcon, MinimizeScreenIcon } from "@hugeicons/core-free-icons";

import { toast } from "@/components/ui/sonner";
import { isGoogleMapsConfigured, loadGoogleMapsLibrary } from "@/lib/maps/googleMapsLoader";
import { fetchPlaceSuggestions, type PlaceSuggestion } from "@/lib/maps/googlePlaces";

interface BusinessMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

// Same visual spec as the previous Leaflet `divIcon` (Ellipse 124 / Ellipse 127 /
// Rectangle 12), redrawn as an inline SVG so it can be used as a classic
// `google.maps.Marker` icon. `AdvancedMarkerElement` was the migration audit's first
// choice, but it requires a Google Cloud "Map ID" that is not configured anywhere in
// this project (no NEXT_PUBLIC_GOOGLE_MAP_ID or equivalent exists) — rather than
// fabricate one, this uses the classic `Marker` API. Google *soft*-deprecated
// `google.maps.Marker` in Feb 2024 in favor of AdvancedMarkerElement, but it is
// explicitly "not scheduled to be discontinued" and continues to receive bug fixes
// (see its own deprecation notice in @types/google.maps) — safe to build on today.
const MARKER_ICON_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="65" viewBox="0 0 44 65">
  <ellipse cx="22" cy="64" rx="5" ry="1" fill="#000000" fill-opacity="0.4" />
  <rect x="20" y="42" width="4" height="20" fill="#8EBAC5" />
  <circle cx="22" cy="22" r="21" fill="#8EBAC5" fill-opacity="0.7" stroke="#FFFFFF" stroke-width="2" />
  <circle cx="22" cy="22" r="6" fill="#111111" />
</svg>
`)}`;

const DEFAULT_ZOOM = 13;
const RESOLVED_ZOOM = 16;
const SUGGESTION_DEBOUNCE_MS = 300;
const MIN_SUGGESTION_QUERY_LENGTH = 2;

export default function BusinessMap({
  lat,
  lng,
  onChange,
  searchQuery,
  onSearchChange,
}: BusinessMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const hasZoomedToResolvedRef = useRef(false);
  // Keeps the click/dragend listeners (attached once, at map-init time) reading the
  // latest `onChange` prop without needing to re-attach them on every render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolvingSelection, setIsResolvingSelection] = useState(false);
  // Guards against an in-flight suggestion request for an older query overwriting the
  // dropdown after the user has kept typing (the JS SDK has no request-level abort).
  const latestSuggestionQueryRef = useRef("");

  // Initialize Map (once). Google Maps JS is loaded lazily via the shared loader, so
  // this effect is async; `cancelled` prevents it from touching state/refs after
  // unmount or after a second mount raced ahead of this one.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!isGoogleMapsConfigured()) {
      // Synchronous bail-out reporting external (env config) state, not derived
      // React state — same pattern already used in this codebase (see page.tsx).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapStatus("error");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [mapsLibrary, markerLibrary] = await Promise.all([
          loadGoogleMapsLibrary("maps"),
          loadGoogleMapsLibrary("marker"),
        ]);
        if (cancelled || !mapContainerRef.current) return;

        const initialCenter: google.maps.LatLngLiteral = { lat: lat || 34.9172, lng: lng || 33.6232 };

        const map = new mapsLibrary.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: DEFAULT_ZOOM,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });

        const marker = new markerLibrary.Marker({
          position: initialCenter,
          map,
          draggable: true,
          icon: {
            url: MARKER_ICON_URL,
            scaledSize: new google.maps.Size(44, 65),
            anchor: new google.maps.Point(22, 63),
          },
        });

        marker.addListener("dragend", () => {
          const position = marker.getPosition();
          if (position) onChangeRef.current(position.lat(), position.lng());
        });

        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          marker.setPosition(event.latLng);
          onChangeRef.current(event.latLng.lat(), event.latLng.lng());
        });

        mapRef.current = map;
        markerRef.current = marker;
        setMapStatus("ready");
      } catch (error) {
        if (!cancelled) {
          console.error("Google Maps failed to load:", error);
          setMapStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position if lat/lng props change from outside (geocode result,
  // Places selection, or a resolved address). The very first real position update
  // zooms in from the broad default view; later updates (including manual
  // drag/click, which also flow through this prop) preserve whatever zoom the user
  // is currently at.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const currentPos = marker.getPosition();
    if (!currentPos || currentPos.lat() !== lat || currentPos.lng() !== lng) {
      const newPos = { lat, lng };
      marker.setPosition(newPos);
      const targetZoom = hasZoomedToResolvedRef.current ? map.getZoom() ?? RESOLVED_ZOOM : RESOLVED_ZOOM;
      hasZoomedToResolvedRef.current = true;
      map.setCenter(newPos);
      map.setZoom(targetZoom);
    }
  }, [lat, lng]);

  // Fullscreen toggles the *same* map container's CSS size (never a second Maps
  // instance), so all state — center, zoom, marker — carries over automatically.
  // Google Maps only needs to be told the container size changed after the layout
  // settles (the `resize` event), then recentered since a resize can visually shift
  // the viewport around the same center point.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const resizeTimeout = setTimeout(() => {
      const center = map.getCenter();
      google.maps.event.trigger(map, "resize");
      if (center) map.setCenter(center);
    }, 250);
    return () => clearTimeout(resizeTimeout);
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  // Debounced Places suggestions. Skips blank/too-short queries entirely (no request
  // at all) and discards a response that arrives for a query the user has since
  // changed away from — the SDK has no true request cancellation, so this is a
  // cooperative staleness guard instead.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_SUGGESTION_QUERY_LENGTH) {
      // Synchronous bail-out clearing suggestion state for a too-short query — same
      // established pattern as the map-status bail-out above.
      /* eslint-disable react-hooks/set-state-in-effect */
      setSuggestions([]);
      setIsSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    const timeoutId = setTimeout(() => {
      latestSuggestionQueryRef.current = trimmed;
      setIsSearching(true);
      void (async () => {
        const results = await fetchPlaceSuggestions(trimmed);
        if (latestSuggestionQueryRef.current !== trimmed) return; // a newer query has since started
        setIsSearching(false);
        setSuggestions(results);
        setActiveSuggestionIndex(-1);
        setIsSuggestionsOpen(true);
      })();
    }, SUGGESTION_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const selectSuggestion = async (suggestion: PlaceSuggestion) => {
    setIsSuggestionsOpen(false);
    setIsResolvingSelection(true);
    try {
      const coordinates = await suggestion.resolveCoordinates();
      if (coordinates) {
        onSearchChange(suggestion.primaryText);
        onChangeRef.current(coordinates.lat, coordinates.lng);
      } else {
        toast.error("Could not resolve that location. Please try again.");
      }
    } finally {
      setIsResolvingSelection(false);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (!isSuggestionsOpen || suggestions.length === 0) return;
      event.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      if (!isSuggestionsOpen || suggestions.length === 0) return;
      event.preventDefault();
      setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (isSuggestionsOpen && suggestions.length > 0) {
        const suggestion = suggestions[activeSuggestionIndex] ?? suggestions[0];
        void selectSuggestion(suggestion);
      }
    } else if (event.key === "Escape") {
      setIsSuggestionsOpen(false);
    }
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        onChangeRef.current(userLat, userLng);
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Unable to retrieve your location. Make sure location permissions are enabled.");
      }
    );
  };

  return (
    <>
      {/* Backdrop: only rendered in fullscreen mode. Sits behind the map container but
          above the rest of the form, so clicks outside the map never reach the form
          underneath while fullscreen is open. */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[90] bg-black/60"
          onClick={() => setIsFullscreen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={
          isFullscreen
            ? "fixed inset-4 sm:inset-8 md:inset-12 z-[100] rounded-2xl overflow-hidden shadow-2xl border border-[#E8E8E4]"
            : "relative w-full h-[320px] sm:h-[400px] md:h-[485px] rounded-2xl overflow-hidden shadow-inner border border-[#E8E8E4]"
        }
      >
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#E8E8E4]" />

      {/* Map load/config failure — the rest of the form (including manual address
          entry) stays fully usable regardless; coordinates are optional at submit
          time, so this must never block onboarding. */}
      {mapStatus !== "ready" && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-[#FCFAF9] pointer-events-none">
          {mapStatus === "loading" ? (
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-[#8EBAC5] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-[#4D4D4D]">Loading map engine...</p>
            </div>
          ) : (
            <div className="text-center px-6">
              <p className="text-sm text-[#4D4D4D]">
                Map is temporarily unavailable. You can still fill in your address manually below.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Floating Search Bar */}
      <div className="absolute top-4 left-4 z-10 w-full max-w-[280px]">
        <div
          className="flex items-center bg-white border border-[#D3D1C7] rounded-lg px-3 py-1.5 shadow-md gap-2 transition-all duration-200 focus-within:border-[#8EBAC5] focus-within:ring-2 focus-within:ring-[#8EBAC5]/20"
        >
          <svg
            className="w-5 h-5 text-[#4E5F78] shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setIsSuggestionsOpen(true);
            }}
            onBlur={() => {
              // Delay so a click on a suggestion (below) registers before the list unmounts.
              setTimeout(() => setIsSuggestionsOpen(false), 150);
            }}
            placeholder="Location"
            className="w-full bg-transparent text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/50 focus:outline-none"
          />
          {(isSearching || isResolvingSelection) && (
            <div className="w-4 h-4 border-2 border-[#8EBAC5] border-t-transparent rounded-full animate-spin shrink-0" />
          )}
        </div>

        {/* Suggestions dropdown — plain Bookly-styled list driven by suggestion data
            only (Places' own drop-in autocomplete UI is intentionally not used, so
            this input/list keeps its existing design). */}
        {isSuggestionsOpen && suggestions.length > 0 && (
          <div className="mt-1 bg-white border border-[#D3D1C7] rounded-lg shadow-md overflow-hidden max-h-[220px] overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep focus on input so onBlur doesn't fire first
                onClick={() => void selectSuggestion(suggestion)}
                className={`w-full text-left px-3 py-2 text-sm border-b border-[#F0EFE9] last:border-b-0 hover:bg-[#F5F5F0] transition-colors ${
                  index === activeSuggestionIndex ? "bg-[#F5F5F0]" : ""
                }`}
              >
                <div className="text-[#1A1A1A] font-medium truncate">{suggestion.primaryText}</div>
                {suggestion.secondaryText && (
                  <div className="text-[#767676] text-xs truncate">{suggestion.secondaryText}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Floating GPS Button */}
      <button
        type="button"
        onClick={handleGeolocation}
        className="absolute bottom-6 right-6 z-10 w-11 h-11 rounded-xl bg-gradient-to-t from-[#8EBAC5] to-[#8EBAC5]/80 flex items-center justify-center shadow-lg hover:scale-105 transition-all duration-150 cursor-pointer text-white border border-white/20 active:scale-95"
        title="Find my location"
      >
        <svg
          className="w-6 h-6 text-[#111111]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8a4 4 0 100 8 4 4 0 000-8z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2v2M12 20v2M4 12H2M22 12h-2"
          />
        </svg>
      </button>

      {/* Fullscreen Toggle Button */}
      <button
        type="button"
        onClick={() => setIsFullscreen((prev) => !prev)}
        aria-label={isFullscreen ? "Exit fullscreen map" : "View map fullscreen"}
        title={isFullscreen ? "Exit fullscreen map" : "View map fullscreen"}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-md hover:scale-105 transition-all duration-150 cursor-pointer text-[#111111] border border-[#D3D1C7] active:scale-95"
      >
        <HugeiconsIcon icon={isFullscreen ? MinimizeScreenIcon : FullScreenIcon} className="w-5 h-5" />
      </button>
      </div>
    </>
  );
}
