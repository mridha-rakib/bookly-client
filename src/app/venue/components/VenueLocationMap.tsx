"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { isGoogleMapsConfigured, loadGoogleMapsLibrary } from "@/lib/maps/googleMapsLoader";

export type ProfileMarkerMediaState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "empty" };

interface VenueLocationMapProps {
  /** The persisted business coordinate. Read-only — this map never lets the visitor move the
   * marker (no drag, no click-to-place, no geolocation). */
  lat: number;
  lng: number;
  /** Shown in the marker's hover card — the business name. */
  businessName?: string;
  /** Backwards compatibility alias for businessName */
  label?: string;
  /** Shown in the marker's hover card — resolved human-readable address. */
  displayAddress?: string;
  /** What the circular marker should show: loading/ready/empty. If omitted, derived from profileImageUrl. */
  profileMedia?: ProfileMarkerMediaState;
  /** Direct profile image URL if profileMedia is not supplied. */
  profileImageUrl?: string;
}

const ZOOM = 14; // matches the previous embed helper's defaultZoom / BusinessProfileMap's ZOOM
const MARKER_DIAMETER = 48;
// A small downward CSS border-triangle: `border-left`/`border-right` transparent,
// `border-top` colored — the rendered triangle's apex sits exactly at the horizontal
// center of the element's bottom edge. That apex is the marker's geographic anchor (see
// the root wrapper's `translate(-50%,-100%)` in onAdd/draw below).
const POINTER_WIDTH = 16;
const POINTER_HEIGHT = 11;
// Pulls the pointer up under the avatar ring's bottom edge so the two read as one
// continuous teardrop shape instead of two touching-but-separate pieces.
const POINTER_OVERLAP = 3;

// Neutral gray + a simple generic photo glyph — same tone as the existing BusinessCard
// "No photo yet" fallback (bg-neutral-100 / text-neutral-400). Built once and reused for
// every overlay instance/fallback render since it never varies.
const FALLBACK_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A3A3A3" stroke-width="1.6">
  <rect x="0" y="2" width="24" height="18" rx="2" />
  <circle cx="7" cy="9" r="2.4" />
  <path d="M0 17 L8 10 L14 15 L18 11 L24 17" />
</svg>`.trim();

// A small rotating arc — pure SVG native animation (`animateTransform`), no CSS
// `@keyframes` (which can't be declared from an inline `style` string) and no JS
// timer/rAF loop. Sized to sit comfortably inside the 48px circle without changing it.
const LOADING_SPINNER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
  <circle cx="10" cy="10" r="8" stroke="#D8D8D8" stroke-width="2.5" />
  <path d="M10 2 A8 8 0 0 1 18 10" stroke="#1A1A1A" stroke-width="2.5" stroke-linecap="round">
    <animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="0.8s" repeatCount="indefinite" />
  </path>
</svg>`.trim();

interface VenueMarkerOverlayInstance {
  setMap(map: google.maps.Map | null): void;
  setPosition(position: google.maps.LatLngLiteral): void;
  setProfileMediaState(state: ProfileMarkerMediaState): void;
}

function createMarkerOverlayClass(mapsLibrary: google.maps.MapsLibrary) {
  return class VenueMarkerOverlay
    extends mapsLibrary.OverlayView
    implements VenueMarkerOverlayInstance
  {
    private position: google.maps.LatLng;
    private wrapper: HTMLDivElement | null = null;
    private liftGroup: HTMLDivElement | null = null;
    private circle: HTMLDivElement | null = null;
    private nameEl: HTMLDivElement | null = null;
    private addressEl: HTMLDivElement | null = null;
    private activeImageUrl: string | null = null;
    private profileMediaState: ProfileMarkerMediaState = { status: "loading" };

    constructor(
      position: google.maps.LatLngLiteral,
      private getInfo: () => { name: string; address: string },
    ) {
      super();
      this.position =
        typeof google !== "undefined"
          ? new google.maps.LatLng(position)
          : (position as unknown as google.maps.LatLng);
    }

    setPosition(position: google.maps.LatLngLiteral): void {
      this.position =
        typeof google !== "undefined"
          ? new google.maps.LatLng(position)
          : (position as unknown as google.maps.LatLng);
      this.draw();
    }

    setProfileMediaState(state: ProfileMarkerMediaState): void {
      this.profileMediaState = state;

      if (!this.circle) return;

      if (state.status === "ready" && this.activeImageUrl === state.url) {
        return;
      }

      this.renderCircleContent(this.circle, state);
    }

    private refreshInfo(): void {
      if (!this.nameEl || !this.addressEl) return;
      const { name, address } = this.getInfo();
      this.nameEl.textContent = name;
      this.addressEl.textContent = address;
      this.addressEl.style.display = address ? "block" : "none";
    }

    private renderCircleContent(circle: HTMLDivElement, state: ProfileMarkerMediaState): void {
      circle.replaceChildren();

      if (state.status === "loading") {
        this.activeImageUrl = null;
        circle.innerHTML = LOADING_SPINNER_SVG;
        return;
      }

      if (state.status === "empty") {
        this.activeImageUrl = null;
        circle.innerHTML = FALLBACK_ICON_SVG;
        return;
      }

      // state.status === "ready"
      const { url } = state;
      this.activeImageUrl = url;

      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.draggable = false;
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
      img.onerror = () => {
        if (circle.contains(img) && this.activeImageUrl === url) {
          this.activeImageUrl = null;
          circle.innerHTML = FALLBACK_ICON_SVG;
        }
      };
      circle.appendChild(img);
    }

    onAdd(): void {
      // Positioned root. `translate(-50%,-100%)` puts this element's bottom edge,
      // horizontally centered, at whatever pixel `draw()` assigns to `left`/`top` — since
      // `liftGroup` (avatar + pointer) is this element's only normal-flow child, and the
      // pointer triangle is `liftGroup`'s last/lowest content, that bottom edge is exactly
      // the pointer's apex.
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:absolute;transform:translate(-50%,-100%);cursor:default;";

      // Everything that visually "floats": scales on hover from its own bottom-center
      // (`transform-origin`), which is the pointer tip — so hovering grows the avatar
      // upward/outward while that one point stays visually fixed under the cursor.
      const liftGroup = document.createElement("div");
      liftGroup.style.cssText = `
        display:flex; flex-direction:column; align-items:center;
        filter:drop-shadow(0 3px 6px rgba(0,0,0,0.28));
        transform-origin:50% 100%; transform:scale(1);
        transition:transform 150ms ease;
      `;

      const circle = document.createElement("div");
      circle.style.cssText = `
        position:relative; width:${MARKER_DIAMETER}px; height:${MARKER_DIAMETER}px; border-radius:50%;
        overflow:hidden; background:#F5F5F5; border:3px solid #000000;
        display:flex; align-items:center; justify-content:center;
      `;
      liftGroup.appendChild(circle);

      // The pin tail — a plain CSS border-triangle, filled to match the avatar's black
      // ring so it reads as one continuous shape. `marginTop` pulls it up under the ring
      // so there's no visible seam.
      const pointer = document.createElement("div");
      pointer.style.cssText = `
        width:0; height:0; margin-top:-${POINTER_OVERLAP}px;
        border-left:${POINTER_WIDTH / 2}px solid transparent;
        border-right:${POINTER_WIDTH / 2}px solid transparent;
        border-top:${POINTER_HEIGHT}px solid #000000;
      `;
      liftGroup.appendChild(pointer);

      wrapper.appendChild(liftGroup);

      // Hover card — plain Bookly-styled tooltip matching BusinessProfileMap. No
      // close button (it only ever responds to hover). `pointer-events: none` since it has
      // no interactive content of its own — mouseleave on the marker always closes it cleanly.
      const card = document.createElement("div");
      card.style.cssText = `
        position:absolute; left:50%; bottom:calc(100% + 8px);
        transform:translateX(-50%);
        background:#111111; color:#FFFFFF; border-radius:8px; padding:8px 12px;
        box-shadow:0 4px 12px rgba(0,0,0,0.25); white-space:nowrap; pointer-events:none;
        opacity:0; visibility:hidden; transition:opacity 120ms ease; font-family:inherit;
      `;
      const nameEl = document.createElement("div");
      nameEl.style.cssText = "font-size:13px; font-weight:600; color:#FFFFFF; line-height:1.3;";
      const addressEl = document.createElement("div");
      addressEl.style.cssText = "font-size:11px; font-weight:400; color:#C7C7C7; line-height:1.3; margin-top:2px;";
      card.appendChild(nameEl);
      card.appendChild(addressEl);
      wrapper.appendChild(card);

      wrapper.addEventListener("mouseenter", () => {
        this.refreshInfo();
        liftGroup.style.transform = "scale(1.06)";
        card.style.opacity = "1";
        card.style.visibility = "visible";
      });
      wrapper.addEventListener("mouseleave", () => {
        liftGroup.style.transform = "scale(1)";
        card.style.opacity = "0";
        card.style.visibility = "hidden";
      });

      this.wrapper = wrapper;
      this.liftGroup = liftGroup;
      this.circle = circle;
      this.nameEl = nameEl;
      this.addressEl = addressEl;

      this.getPanes()?.overlayMouseTarget.appendChild(wrapper);

      this.renderCircleContent(circle, this.profileMediaState);
      this.refreshInfo();
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
      this.liftGroup = null;
      this.circle = null;
      this.nameEl = null;
      this.addressEl = null;
    }
  };
}

export default function VenueLocationMap({
  lat,
  lng,
  businessName,
  label,
  displayAddress,
  profileMedia,
  profileImageUrl,
}: VenueLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<VenueMarkerOverlayInstance | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  const latestPositionRef = useRef({ lat, lng });
  useEffect(() => {
    latestPositionRef.current = { lat, lng };
  });

  const latestInfoRef = useRef({
    name: businessName ?? label ?? "",
    address: displayAddress ?? "",
  });
  useEffect(() => {
    latestInfoRef.current = {
      name: businessName ?? label ?? "",
      address: displayAddress ?? "",
    };
  });

  const effectiveMediaState: ProfileMarkerMediaState = useMemo(() => {
    if (profileMedia) return profileMedia;
    if (profileImageUrl) return { status: "ready", url: profileImageUrl };
    return { status: "empty" };
  }, [profileMedia, profileImageUrl]);

  const latestMediaStateRef = useRef(effectiveMediaState);
  useEffect(() => {
    latestMediaStateRef.current = effectiveMediaState;
  });

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
        const overlay = new OverlayClass(initialPosition, () => latestInfoRef.current);
        overlay.setProfileMediaState(latestMediaStateRef.current);
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
  }, []);

  useEffect(() => {
    if (mapStatus !== "ready" || !overlayRef.current) return;
    overlayRef.current.setProfileMediaState(effectiveMediaState);
  }, [effectiveMediaState, mapStatus]);

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
