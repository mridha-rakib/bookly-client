"use client";

import React, { useEffect, useRef, useState } from "react";

import { isGoogleMapsConfigured, loadGoogleMapsLibrary } from "@/lib/maps/googleMapsLoader";

interface VenueLocationMapProps {
  /** The persisted business coordinate. Read-only — this map never lets the visitor move the
   * marker (no drag, no click-to-place, no geolocation). */
  lat: number;
  lng: number;
  /** Shown in the marker's always-visible label tag — the business name. */
  label: string;
}

const ZOOM = 14; // matches the previous embed helper's defaultZoom / BusinessProfileMap's ZOOM

/**
 * A single, simple read-only marker — not the full BusinessProfileMap profile-avatar overlay
 * (there's no photo lifecycle to manage here, and the venue page's own address card already
 * shows name/address below the map, so a second, richer hover card would be redundant). Built
 * lazily from the loaded Maps JS library, same reasoning as the other OverlayView-based markers
 * in this project (no Map ID / AdvancedMarkerElement dependency).
 */
interface VenueMarkerOverlayInstance {
  setMap(map: google.maps.Map | null): void;
  setPosition(position: google.maps.LatLngLiteral): void;
}

function createMarkerOverlayClass(mapsLibrary: google.maps.MapsLibrary) {
  return class VenueMarkerOverlay
    extends mapsLibrary.OverlayView
    implements VenueMarkerOverlayInstance
  {
    private wrapper: HTMLDivElement | null = null;

    constructor(
      private position: google.maps.LatLngLiteral,
      private label: string,
    ) {
      super();
    }

    setPosition(position: google.maps.LatLngLiteral): void {
      this.position = position;
      this.draw();
    }

    onAdd(): void {
      const wrapper = document.createElement("div");
      wrapper.style.cssText =
        "position:absolute;transform:translate(-50%,-100%);pointer-events:none;";

      const tag = document.createElement("div");
      tag.style.cssText = `
        padding:6px 12px; background:#1C1B1C; color:#FFFFFF; border-radius:8px;
        font-family:Poppins, sans-serif; font-size:12px; font-weight:600; white-space:nowrap;
        box-shadow:0 4px 10px rgba(0,0,0,0.25);
      `;
      tag.textContent = this.label;
      wrapper.appendChild(tag);

      const pointer = document.createElement("div");
      pointer.style.cssText = `
        width:0; height:0; margin:0 auto;
        border-left:6px solid transparent; border-right:6px solid transparent;
        border-top:6px solid #1C1B1C;
      `;
      wrapper.appendChild(pointer);

      this.wrapper = wrapper;
      this.getPanes()?.overlayMouseTarget.appendChild(wrapper);
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
    }
  };
}

export default function VenueLocationMap({ lat, lng, label }: VenueLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<VenueMarkerOverlayInstance | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  // Async load below can straddle a lat/lng prop change (e.g. navigating client-side from one
  // venue to another without a full page reload) — reading the freshest value at overlay-
  // creation time, and reactively afterward (see the effect below), means the marker never
  // shows a stale position.
  const latestPositionRef = useRef({ lat, lng });
  useEffect(() => {
    latestPositionRef.current = { lat, lng };
  });

  // Initialize once. SSR-safe (only ever loaded client-side) and missing-key-safe (falls to the
  // "error" state, same convention as BusinessMap/BusinessProfileMap) without breaking the rest
  // of the Venue page.
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

        const initialPosition = latestPositionRef.current;

        const map = new mapsLibrary.Map(mapContainerRef.current, {
          center: initialPosition,
          zoom: ZOOM,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });

        const OverlayClass = createMarkerOverlayClass(mapsLibrary);
        const overlay = new OverlayClass(initialPosition, label);
        overlay.setMap(map);

        mapRef.current = map;
        overlayRef.current = overlay;
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
      overlayRef.current?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reposition + recenter if the persisted coordinate changes after mount (e.g. a client-side
  // navigation from one venue to another that reuses this same component instance).
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    const position: google.maps.LatLngLiteral = { lat, lng };
    overlay.setPosition(position);
    map.setCenter(position);
  }, [lat, lng]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {mapStatus !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#EAE8E4] pointer-events-none">
          {mapStatus === "loading" ? (
            <div className="w-8 h-8 border-4 border-[#8EBAC5] border-t-transparent rounded-full animate-spin" />
          ) : (
            <p className="text-xs text-neutral-500 px-6 text-center">
              Map is temporarily unavailable.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
