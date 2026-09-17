"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { isGoogleMapsConfigured, loadGoogleMapsLibrary } from "@/lib/maps/googleMapsLoader";
import { Recommendation } from "@/components/ServiceCard";

interface ExploreMapProps {
  services: Recommendation[];
}

// Cyprus-wide fallback viewport used ONLY when there are no valid business coordinates to show.
// Never treated as — and never persisted as — a business location.
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 34.922, lng: 33.623 }; // Larnaca
const DEFAULT_ZOOM = 9;
const SINGLE_MARKER_ZOOM = 13;
const MIN_ZOOM = 3;

interface MarkerOverlayData {
  labelText: string;
  title: string;
  ratingText: string;
  priceText: string | null;
}

interface MarkerOverlayInstance {
  setMap(map: google.maps.Map | null): void;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/**
 * Built lazily from the already-loaded Maps JS library (same reasoning as
 * BusinessProfileMap's overlay factory — `google.maps.OverlayView` doesn't exist as a global
 * until the script has loaded, so the class can't extend it at module scope). A plain DOM
 * overlay, not `AdvancedMarkerElement`, so no Map ID is required — consistent with the rest of
 * this project's Google Maps usage.
 *
 * Renders the always-visible "title + rating" tag the legacy Leaflet divIcon showed, plus a
 * click-to-toggle popup card with the same fields the old `bindPopup` HTML showed (title,
 * rating/reviews, starting price).
 */
function createMarkerOverlayClass(mapsLibrary: google.maps.MapsLibrary) {
  return class ExploreMarkerOverlay
    extends mapsLibrary.OverlayView
    implements MarkerOverlayInstance
  {
    private wrapper: HTMLDivElement | null = null;
    private popup: HTMLDivElement | null = null;
    private open_ = false;

    constructor(
      private position: google.maps.LatLng,
      private data: MarkerOverlayData,
      private onClick: () => void,
    ) {
      super();
    }

    onAdd(): void {
      const wrapper = document.createElement("div");
      wrapper.style.cssText =
        "position:absolute;transform:translate(-50%,-100%);cursor:pointer;";

      const liftGroup = document.createElement("div");
      liftGroup.style.cssText = "display:flex;flex-direction:column;align-items:center;";

      const tag = document.createElement("div");
      tag.style.cssText = `
        padding:6px 12px; background:rgba(15,15,20,0.9); color:#FFFFFF; border-radius:15px;
        font-family:Poppins, sans-serif; font-size:12px; font-weight:500; white-space:nowrap;
        box-shadow:0 2px 6px rgba(0,0,0,0.25); user-select:none;
      `;
      tag.textContent = this.data.labelText;
      liftGroup.appendChild(tag);

      const pointer = document.createElement("div");
      pointer.style.cssText = `
        width:0; height:0; margin-top:-2px;
        border-left:6px solid transparent; border-right:6px solid transparent;
        border-top:8px solid rgba(15,15,20,0.9);
      `;
      liftGroup.appendChild(pointer);
      wrapper.appendChild(liftGroup);

      const popup = document.createElement("div");
      popup.style.cssText = `
        position:absolute; left:50%; bottom:calc(100% + 6px); transform:translateX(-50%);
        background:#FFFFFF; color:#111111; border-radius:10px; padding:10px 14px;
        box-shadow:0 6px 20px rgba(0,0,0,0.2); white-space:nowrap;
        font-family:Poppins, sans-serif; display:none; z-index:1;
      `;
      const titleEl = document.createElement("strong");
      titleEl.style.cssText = "display:block; margin-bottom:4px; font-size:13px;";
      titleEl.textContent = this.data.title;
      const ratingEl = document.createElement("span");
      ratingEl.style.cssText = "color:#E49D12; font-size:12px;";
      ratingEl.textContent = this.data.ratingText;
      popup.appendChild(titleEl);
      popup.appendChild(ratingEl);
      if (this.data.priceText) {
        const priceEl = document.createElement("div");
        priceEl.style.cssText = "margin-top:6px; font-weight:700; font-size:12px;";
        priceEl.textContent = this.data.priceText;
        popup.appendChild(priceEl);
      }
      wrapper.appendChild(popup);

      wrapper.addEventListener("click", (event) => {
        event.stopPropagation();
        this.onClick();
      });

      this.wrapper = wrapper;
      this.popup = popup;
      this.getPanes()?.overlayMouseTarget.appendChild(wrapper);
    }

    open(): void {
      if (!this.popup) return;
      this.popup.style.display = "block";
      this.open_ = true;
    }

    close(): void {
      if (!this.popup) return;
      this.popup.style.display = "none";
      this.open_ = false;
    }

    isOpen(): boolean {
      return this.open_;
    }

    draw(): void {
      if (!this.wrapper) return;
      const point = this.getProjection()?.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.wrapper.style.left = `${point.x}px`;
      this.wrapper.style.top = `${point.y}px`;
    }

    onRemove(): void {
      this.wrapper?.parentNode?.removeChild(this.wrapper);
      this.wrapper = null;
      this.popup = null;
    }
  };
}

/** Only a service with a finite lat/lng inside real geographic ranges is eligible for a marker —
 * never a fabricated/offset position. Businesses without one are simply skipped, never given a
 * fallback location. */
const hasValidCoordinates = (
  service: Recommendation,
): service is Recommendation & { coordinates: { lat: number; lng: number } } => {
  const coords = service.coordinates;
  if (!coords) return false;
  const { lat, lng } = coords;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

export default function ExploreMap({ services }: ExploreMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayClassRef = useRef<ReturnType<typeof createMarkerOverlayClass> | null>(null);
  const overlaysRef = useRef<Map<string, MarkerOverlayInstance>>(new Map());
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  const handleMarkerClick = useCallback((id: string) => {
    const overlays = overlaysRef.current;
    const clicked = overlays.get(id);
    if (!clicked) return;
    const wasOpen = clicked.isOpen();
    overlays.forEach((overlay) => overlay.close());
    if (!wasOpen) clicked.open();
  }, []);

  // Initialize the map once. SSR-safe (Maps JS is only ever loaded client-side) and
  // missing-key-safe (falls straight to the "error" state, same convention as
  // BusinessMap/BusinessProfileMap) without breaking the rest of the Explore page.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!isGoogleMapsConfigured()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapStatus("error");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const mapsLibrary = await loadGoogleMapsLibrary("maps");
        if (cancelled || !mapContainerRef.current) return;

        const map = new mapsLibrary.Map(mapContainerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          zoomControl: true,
          clickableIcons: false,
        });

        mapRef.current = map;
        overlayClassRef.current = createMarkerOverlayClass(mapsLibrary);
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
      // Intentionally read at cleanup time, not captured earlier — this must clear whatever
      // overlays exist at unmount, not whatever existed when the effect first ran (empty).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const overlays = overlaysRef.current;
      overlays.forEach((overlay) => overlay.setMap(null));
      overlays.clear();
    };
  }, []);

  // Rebuild markers whenever the visible result set changes. Only real, valid persisted
  // coordinates ever produce a marker — a business with none is simply skipped (it can still
  // appear in the card list; this component never sees or cares about that list, only about
  // which of the businesses handed to it have a plottable location).
  useEffect(() => {
    const map = mapRef.current;
    const OverlayClass = overlayClassRef.current;
    if (mapStatus !== "ready" || !map || !OverlayClass) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current.clear();

    const validServices = services.filter(hasValidCoordinates);
    const bounds = new google.maps.LatLngBounds();

    validServices.forEach((service) => {
      const position = new google.maps.LatLng(service.coordinates.lat, service.coordinates.lng);
      bounds.extend(position);

      const ratingLabel = service.rating !== null ? String(service.rating) : "New";
      const labelText = `${service.title.split("|")[0].trim().substring(0, 14)} ${ratingLabel}`;
      const ratingText =
        service.rating !== null
          ? `★ ${service.rating} (${service.reviews} reviews)`
          : "New — no reviews yet";
      const priceText =
        service.startingPrice !== null ? `Starting from $${service.startingPrice}` : null;

      const overlay = new OverlayClass(position, { labelText, title: service.title, ratingText, priceText }, () =>
        handleMarkerClick(service.id),
      );
      overlay.setMap(map);
      overlaysRef.current.set(service.id, overlay);
    });

    if (validServices.length >= 2) {
      map.fitBounds(bounds, 48);
    } else if (validServices.length === 1) {
      map.setCenter({ lat: validServices[0].coordinates.lat, lng: validServices[0].coordinates.lng });
      map.setZoom(SINGLE_MARKER_ZOOM);
    } else {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }, [services, mapStatus, handleMarkerClick]);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden border border-[#E5E5E5]/50 shadow-sm min-h-[500px] bg-[#d4e6ec]">
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px] bg-[#d4e6ec]" />

      {mapStatus !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#d4e6ec] pointer-events-none">
          {mapStatus === "loading" ? (
            <span className="text-sm text-gray-600 animate-pulse font-medium">
              Loading Map Engine...
            </span>
          ) : (
            <p className="text-xs text-neutral-600 px-6 text-center">
              Map is temporarily unavailable.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
