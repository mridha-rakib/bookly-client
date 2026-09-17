"use client";

import React, { useEffect, useRef, useState } from "react";

import { isGoogleMapsConfigured, loadGoogleMapsLibrary } from "@/lib/maps/googleMapsLoader";

interface BookingLocationMapProps {
  /**
   * The booking's own historical coordinate snapshot — NOT the Business's current location.
   * `Booking.fulfilment.businessLocation`/`travelAddress` (see api/src/modules/booking/
   * booking.model.ts) currently freezes only an address (city/area/street), never a lat/lng, so
   * every caller today passes `undefined` here. This prop exists so a real per-booking
   * coordinate snapshot can be wired in later without ever silently falling back to a live,
   * possibly-since-moved Business.location, and without this component ever geocoding the
   * address itself on render (both explicitly forbidden — a booking is a historical record).
   */
  coordinates?: { lat: number; lng: number };
  /** The historical address text (from the same fulfilment snapshot) — shown in the graceful
   * fallback when there's no coordinate to plot. */
  address: string;
}

const ZOOM = 15; // matches the previous embed iframe's z=15

interface MarkerOverlayInstance {
  setMap(map: google.maps.Map | null): void;
}

/** A single plain black pin — read-only, no popup (the surrounding card/page already shows the
 * venue name and address), no photo/hover-card requirement. Built lazily from the loaded Maps
 * JS library, same OverlayView convention as this project's other markers (no Map ID /
 * AdvancedMarkerElement dependency). */
function createMarkerOverlayClass(mapsLibrary: google.maps.MapsLibrary) {
  return class BookingMarkerOverlay
    extends mapsLibrary.OverlayView
    implements MarkerOverlayInstance
  {
    private wrapper: HTMLDivElement | null = null;

    constructor(private position: google.maps.LatLngLiteral) {
      super();
    }

    onAdd(): void {
      const wrapper = document.createElement("div");
      wrapper.style.cssText =
        "position:absolute;transform:translate(-50%,-100%);pointer-events:none;";

      const pin = document.createElement("div");
      pin.style.cssText = `
        width:16px; height:16px; border-radius:50%; background:#1C1B1C;
        border:3px solid #FFFFFF; box-shadow:0 2px 6px rgba(0,0,0,0.35);
      `;
      wrapper.appendChild(pin);

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

/**
 * Read-only single-marker map for a booking's location. Renders the graceful "not available"
 * fallback (never a fabricated pin) whenever `coordinates` is absent — which, today, is every
 * booking (see the prop's own doc comment for why). Kept ready for a real per-booking coordinate
 * snapshot to be wired in later without any further map-side changes.
 */
export default function BookingLocationMap({ coordinates, address }: BookingLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<MarkerOverlayInstance | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!coordinates || !mapContainerRef.current || mapRef.current) return;

    if (!isGoogleMapsConfigured()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapStatus("error");
      return;
    }

    let cancelled = false;
    const { lat, lng } = coordinates;

    (async () => {
      try {
        const mapsLibrary = await loadGoogleMapsLibrary("maps");
        if (cancelled || !mapContainerRef.current) return;

        const map = new mapsLibrary.Map(mapContainerRef.current, {
          center: { lat, lng },
          zoom: ZOOM,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });

        const OverlayClass = createMarkerOverlayClass(mapsLibrary);
        const overlay = new OverlayClass({ lat, lng });
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
  }, [coordinates]);

  if (!coordinates) {
    return (
      <div className="w-full h-44 bg-[#F5F4EE] rounded-lg flex flex-col justify-center items-center gap-1 border border-[#ACAAB4] px-4 text-center">
        <span className="text-sm text-gray-500 font-medium">Map location is not available for this booking.</span>
        <span className="text-xs text-gray-400">{address}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-44 rounded-lg overflow-hidden border border-[#ACAAB4]">
      <div ref={mapContainerRef} className="w-full h-full" />

      {mapStatus !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F5F4EE] pointer-events-none">
          {mapStatus === "loading" ? (
            <div className="w-6 h-6 border-4 border-[#8EBAC5] border-t-transparent rounded-full animate-spin" />
          ) : (
            <p className="text-xs text-neutral-500 px-6 text-center">Map is temporarily unavailable.</p>
          )}
        </div>
      )}
    </div>
  );
}
