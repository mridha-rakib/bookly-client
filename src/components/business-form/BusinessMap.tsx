"use client";

// Leaflet's own stylesheet must be loaded or the map container renders without its
// sizing/positioning rules — tiles then stack into a small, non-interactive-looking
// thumbnail instead of a real pannable/zoomable map. Importing the CSS shipped by the
// already-installed `leaflet` package (rather than a CDN link) keeps this self-contained
// and version-locked to package.json, and is Next.js's documented exception allowing
// global CSS imports from node_modules inside any component.
import "leaflet/dist/leaflet.css";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { HugeiconsIcon } from "@hugeicons/react";
import { FullScreenIcon, MinimizeScreenIcon } from "@hugeicons/core-free-icons";

import { toast } from "@/components/ui/sonner";

interface BusinessMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function BusinessMap({
  lat,
  lng,
  onChange,
  searchQuery,
  onSearchChange,
}: BusinessMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const hasZoomedToResolvedRef = useRef(false);
  const [searching, setSearching] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: L.LatLngExpression = [lat || 32.7767, lng || -96.7970];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Custom Icon matching user SS spec
    const customIcon = L.divIcon({
      className: "custom-gps-marker",
      html: `
        <div class="relative flex flex-col items-center select-none" style="width: 44px; height: 65px;">
          <!-- Ellipse 124 -->
          <div class="w-11 h-11 rounded-full bg-[#8EBAC5] bg-opacity-70 border-2 border-white flex items-center justify-center shadow-md">
            <!-- Ellipse 127 -->
            <div class="w-3 h-3 rounded-full bg-[#111111]"></div>
          </div>
          <!-- Rectangle 12 -->
          <div class="w-1 h-5 bg-[#8EBAC5] -mt-0.5 shadow-sm"></div>
          <!-- Shadow -->
          <div class="w-2.5 h-0.5 bg-black bg-opacity-40 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      `,
      iconSize: [44, 65],
      iconAnchor: [22, 63],
    });

    const marker = L.marker(initialCenter, {
      icon: customIcon,
      draggable: true,
    }).addTo(map);

    // Update coordinates on dragend
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      onChange(position.lat, position.lng);
    });

    // Update coordinates on map click
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      onChange(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // The map is created inside a next/dynamic(ssr:false) client component, so its
    // container size can be off by a frame on first paint; recalculate once mounted
    // (same fix already used by ExploreMap.tsx elsewhere in this app).
    const invalidateTimeout = setTimeout(() => map.invalidateSize(), 100);

    return () => {
      clearTimeout(invalidateTimeout);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker position if lat/lng props change from outside (geocode result,
  // location search, or a resolved address). The very first real position update zooms
  // in from the broad default view; later updates (including manual drag/click, which
  // also flow through this prop) preserve whatever zoom the user is currently at.
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (currentPos.lat !== lat || currentPos.lng !== lng) {
        const newPos = L.latLng(lat, lng);
        markerRef.current.setLatLng(newPos);
        const targetZoom = hasZoomedToResolvedRef.current ? mapRef.current.getZoom() : 16;
        hasZoomedToResolvedRef.current = true;
        mapRef.current.setView(newPos, targetZoom);
      }
    }
  }, [lat, lng]);

  // Fullscreen toggles the *same* map container's CSS size (never a second Leaflet
  // instance), so all state — center, zoom, marker — carries over automatically. Leaflet
  // only needs to be told the container size changed after the layout settles.
  useEffect(() => {
    if (!mapRef.current) return;
    const invalidateTimeout = setTimeout(() => mapRef.current?.invalidateSize(), 250);
    return () => clearTimeout(invalidateTimeout);
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

  const handleSearchSubmit = async () => {
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cy&q=${encodeURIComponent(
          searchQuery
        )}`
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const firstResult = data[0];
        const newLat = parseFloat(firstResult.lat);
        const newLng = parseFloat(firstResult.lon);
        onChange(newLat, newLng);
      } else {
        toast.error("Location not found. Please try a different search.");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Could not search for that location. Please try again.");
    } finally {
      setSearching(false);
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
        onChange(userLat, userLng);
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
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Search Bar */}
      <div
        className="absolute top-4 left-4 z-10 flex items-center bg-white border border-[#D3D1C7] rounded-lg px-3 py-1.5 shadow-md w-full max-w-[280px] gap-2 transition-all duration-200 focus-within:border-[#8EBAC5] focus-within:ring-2 focus-within:ring-[#8EBAC5]/20"
      >
        <svg
          className="w-5 h-5 text-[#4E5F78]"
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearchSubmit();
            }
          }}
          placeholder="Location"
          className="w-full bg-transparent text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/50 focus:outline-none"
        />
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
