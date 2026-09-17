"use client";

import React, { useEffect, useRef, useState } from "react";

import { isGoogleMapsConfigured, loadGoogleMapsLibrary } from "@/lib/maps/googleMapsLoader";

/**
 * The marker's profile-photo content has three genuinely different states, not two —
 * `undefined` alone can't tell "the media query hasn't resolved yet" apart from "it
 * resolved and this business has no PROFILE photo," and conflating them was exactly
 * what let a still-loading state get rendered (and then stay rendered) as the fallback
 * icon. The caller (DashboardCreateBusiness, via LocationSection) is the only place that
 * actually knows which of these is true — see how `profileMediaState` is derived there
 * from `useBusinessMediaQuery`'s own `isLoading`, not guessed from `undefined`.
 */
export type ProfileMarkerMediaState =
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "empty" };

interface BusinessProfileMapProps {
  /** The persisted business coordinate. The marker always sits exactly here — this
   * map never lets the user move it (no click-to-place, no drag, no geolocation). */
  lat: number;
  lng: number;
  /** What the circular marker should currently show — see ProfileMarkerMediaState.
   * Required (not optional) so a caller can't accidentally omit it and silently fall
   * into whichever state `undefined` used to mean. */
  profileMedia: ProfileMarkerMediaState;
  /** A temporary, display-only recenter target driven by the surrounding search box
   * (see LocationSection/DashboardCreateBusiness). When set, only the *viewport*
   * pans there — the marker itself never moves off the real persisted coordinate,
   * so a cosmetic search preview can never be mistaken for an actual location edit. */
  previewCenter?: { lat: number; lng: number } | null;
  /** Shown in the hover card — the real business name and its resolved human-readable
   * address, decoupled from any in-progress search text. */
  businessName?: string;
  displayAddress?: string;
}

const ZOOM = 14; // matches the previous Maps Embed API helper's `defaultZoom`
const MARKER_DIAMETER = 48;
// A small downward CSS border-triangle: `border-left`/`border-right` transparent,
// `border-top` colored — the rendered triangle's apex sits exactly at the horizontal
// center of the element's bottom edge. That apex is the marker's geographic anchor (see
// the root wrapper's `translate(-50%,-100%)` in onAdd/draw below) — business.location
// itself is never touched, only where this DOM point lands relative to the pixel
// OverlayView.draw() computes for it.
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

/** Public surface used by the component below — the concrete class is only ever built
 * dynamically, after the "maps" library has loaded (see `createOverlayClass`), never
 * referenced statically at module-evaluation time. */
interface BusinessMarkerOverlayInstance {
  setMap(map: google.maps.Map | null): void;
  setPosition(position: google.maps.LatLngLiteral): void;
  setProfileMediaState(state: ProfileMarkerMediaState): void;
}

/**
 * Builds the `BusinessMarkerOverlay` class, extending `mapsLibrary.OverlayView` — the
 * class cannot `extends google.maps.OverlayView` at module scope because that global
 * doesn't exist yet until the Maps JS script has actually loaded; building it lazily,
 * from the already-loaded library object, avoids referencing an undefined global.
 *
 * Renders a plain DOM circular marker (a real `<img>` for the profile photo, not a
 * composed SVG data-URI icon) plus a hover card.
 *
 * Why not classic `google.maps.Marker` with an SVG icon (the prior approach): a
 * `Marker`'s `icon` is drawn by the browser as `<img src="data:image/svg+xml,...">`,
 * which renders in SVG "image context" — external resource references inside that SVG
 * (e.g. an `<image href="https://...">` pointing at the profile photo) are not fetched
 * in that context, independent of CORS. Working around that required fetching the photo
 * and re-encoding it as a nested data URI, which itself depends on the storage bucket
 * sending permissive CORS headers for a `fetch()` read (unverifiable from this repo, and
 * a second point of failure). A real DOM `<img src={url}>` needs neither: it renders
 * exactly the way the same URL already renders elsewhere in Bookly (e.g. the Photos
 * section on this same screen), with a normal, reliable `onerror` for the fallback.
 *
 * No Google Map ID and no `AdvancedMarkerElement` are used — `OverlayView` is a plain,
 * long-supported Maps JS class with no such requirement.
 */
function createOverlayClass(mapsLibrary: google.maps.MapsLibrary) {
  return class BusinessMarkerOverlay extends mapsLibrary.OverlayView implements BusinessMarkerOverlayInstance {
    private position: google.maps.LatLng;
    /** The positioned root — draw() moves *this* element so its bottom-center (the
     * pointer tip, see onAdd) lands exactly on the projected geographic pixel. Never
     * itself animated/scaled, so the anchor can never visually drift. */
    private wrapper: HTMLDivElement | null = null;
    /** The avatar+pointer group — everything that visually "floats": gets the drop
     * shadow and the hover scale. A child of `wrapper`, not `wrapper` itself, so scaling
     * it on hover (from its own bottom-center, i.e. the pointer tip) never moves the
     * positioned root and therefore never moves the geographic anchor. */
    private liftGroup: HTMLDivElement | null = null;
    private circle: HTMLDivElement | null = null;
    private nameEl: HTMLDivElement | null = null;
    private addressEl: HTMLDivElement | null = null;
    /** The URL `circle` is currently showing (or attempting to show), if any — lets
     * `renderCircleContent` skip a redundant re-render when called again with the exact
     * same "ready" state (harmless in principle, but avoids tearing down and recreating
     * an already-successfully-loaded `<img>`, which would otherwise reissue the request /
     * flash), and lets an `<img>`'s `onerror` confirm it's still the active one by URL
     * identity, not just DOM presence. */
    private activeImageUrl: string | null = null;
    /**
     * The latest known media state, retained independent of whether `circle` exists yet
     * to render it into. Live-proven bug this fixes: `setProfileMediaState` can be (and
     * routinely is) called with `{status:"ready"}` BEFORE `onAdd()` has run — Google Maps
     * only calls `onAdd()` once it decides to actually attach the overlay, which can
     * happen after React has already delivered the real media state. Without retaining
     * the state here, that "ready" call had nothing to render into yet and was simply
     * lost — `onAdd()` later built the DOM with no memory that a real image was already
     * known, so the marker stayed on its `{status:"loading"}` construction-time default
     * forever. Every `setProfileMediaState` call updates this unconditionally; `onAdd()`
     * renders it once the DOM exists (see below) — so state may arrive before or after
     * the DOM in either order and the marker still ends up correct.
     */
    private profileMediaState: ProfileMarkerMediaState = { status: "loading" };

    constructor(
      position: google.maps.LatLngLiteral,
      private getInfo: () => { name: string; address: string },
    ) {
      super();
      this.position = new google.maps.LatLng(position);
    }

    setPosition(position: google.maps.LatLngLiteral): void {
      this.position = new google.maps.LatLng(position);
      this.draw();
    }

    setProfileMediaState(state: ProfileMarkerMediaState): void {
      this.profileMediaState = state;

      if (!this.circle) return;

      // Skip re-rendering an unchanged "ready" state — avoids tearing down and
      // recreating an already-successfully-showing `<img>` (which would reissue the
      // network request and could flash) if the caller passes an equivalent state
      // object again (e.g. a parent re-render producing a fresh but semantically
      // identical `{status:"ready", url}`).
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
        // Two independent guards against a slow-to-fail *older* image clobbering a
        // *newer*, successfully-loading one (e.g. an expired signed URL from before a
        // businessMedia refetch, whose network response lands after a fresh, valid URL
        // has already replaced it): the DOM check (is this `<img>` still actually
        // `circle`'s child?) and the URL-identity check (is this still the URL the
        // overlay currently considers active?) — either one alone would be sufficient
        // for how `circle` is mutated today, but keeping both makes the guard correct
        // even if a future change replaces `circle`'s content without going through
        // `renderCircleContent`.
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
      // the pointer's apex. This element's own inline `left`/`top`/`transform` are the
      // ONLY things that ever move it — draw() is the sole writer, and nothing here
      // (including the hover scale below) ever touches them, so the geographic anchor
      // can't drift regardless of hover/zoom/pan/resize.
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

      // Hover card — plain Bookly-styled tooltip, not Google's InfoWindow chrome. No
      // close button (there is nothing to close explicitly; it only ever responds to
      // hover). `pointer-events: none` since it has no interactive content of its own —
      // this also means the cursor can never "get stuck" hovering the card itself, so
      // mouseleave on the marker always closes it cleanly. A sibling of `liftGroup`, not
      // a child of it, so the hover scale on `liftGroup` never stretches/moves the card.
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

      // CRITICAL: render whatever media state is already known right now — `circle`
      // didn't exist until this line, but `setProfileMediaState` may already have been
      // called (and updated `this.profileMediaState`) before Maps JS ever invoked
      // `onAdd()`. Without this, that earlier state has nowhere to render into and is
      // silently lost — the marker would stay on the `{status:"loading"}` construction
      // default forever, even once the real state was already known.
      this.renderCircleContent(circle, this.profileMediaState);
    }

    draw(): void {
      if (!this.wrapper) return;
      // This is the only place the marker's screen position is ever set. The projection
      // is recomputed by the Maps JS runtime (and this callback re-invoked) on every
      // zoom/pan/resize, so `left`/`top` always reflect the current pixel for
      // `this.position` (business.location, unchanged since construction/setPosition) —
      // the pointer tip this lands on (see onAdd's `translate(-50%,-100%)`) tracks the
      // real geographic point at every zoom level, never a cached/stale pixel.
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
      this.activeImageUrl = null;
    }
  };
}

export default function BusinessProfileMap({
  lat,
  lng,
  profileMedia,
  previewCenter,
  businessName,
  displayAddress,
}: BusinessProfileMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlayRef = useRef<BusinessMarkerOverlayInstance | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">("loading");

  // The overlay's hover handler and position-init read the *latest* values through
  // these refs rather than values captured in a stale closure (the overlay class is
  // constructed once, and the async Maps JS load below can straddle a prop update).
  const businessNameRef = useRef(businessName);
  const displayAddressRef = useRef(displayAddress);
  const latestPositionRef = useRef({ lat, lng });
  // Same reasoning as latestPositionRef: `profileMedia` very often is still
  // `{status:"loading"}` at the render that schedules the mount effect below — on a
  // genuine cold load (no warm React Query cache), the media query hasn't resolved yet.
  // Reading this ref instead of the prop directly, at the moment the overlay is actually
  // created, means the overlay always starts with whatever the CURRENT state is by then
  // (loading, ready, or empty), not whatever it was when the effect was scheduled —
  // removing the dependency on the separate `[profileMedia, mapStatus]` effect happening
  // to fire again afterward to correct a stale initial value. This is the fix for a
  // refresh permanently leaving the fallback shown even once real media had arrived.
  const latestProfileMediaRef = useRef(profileMedia);
  useEffect(() => {
    businessNameRef.current = businessName;
  });
  useEffect(() => {
    displayAddressRef.current = displayAddress;
  });
  useEffect(() => {
    latestPositionRef.current = { lat, lng };
  });
  useEffect(() => {
    latestProfileMediaRef.current = profileMedia;
  });

  // Initialize map + marker overlay (once). Read-only by design: no drag, no
  // click-to-place, no geolocation — this surface only ever displays the
  // already-persisted coordinate.
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

        // Read the freshest known position now rather than trusting the `lat`/`lng`
        // captured when this effect was scheduled — if a newer value arrived while the
        // Maps JS library was still loading, the marker must not be created at a
        // now-stale coordinate (this was a real, provable race in the previous
        // implementation: the `[lat, lng]`-keyed position effect no-ops whenever the
        // marker doesn't exist yet, so an update landing during this async gap was
        // silently dropped instead of being picked up once the marker was ready).
        const initialPosition = latestPositionRef.current;

        const map = new mapsLibrary.Map(mapContainerRef.current, {
          center: initialPosition,
          zoom: ZOOM,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });

        const OverlayClass = createOverlayClass(mapsLibrary);
        const overlay = new OverlayClass(initialPosition, () => ({
          name: businessNameRef.current ?? "",
          address: displayAddressRef.current ?? "",
        }));
        overlay.setMap(map);
        // Freshest known state, not the `profileMedia` prop closed over when this effect
        // was scheduled (see latestProfileMediaRef above) — if the media query resolved
        // at any point before this line actually runs, its real state (ready or empty)
        // is applied immediately instead of a stale "loading"; the reactive effect below
        // still applies later changes normally.
        overlay.setProfileMediaState(latestProfileMediaRef.current);

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

  // The persisted coordinate can change if a different business loads into the same
  // mounted component (e.g. navigating from one business's profile to another's). The
  // marker always tracks it exactly; the map only recenters here when there's no
  // active search preview overriding the viewport (see the effect below).
  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    const position: google.maps.LatLngLiteral = { lat, lng };
    overlay.setPosition(position);
    if (!previewCenter) {
      map.setCenter(position);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Cosmetic search preview: pans the viewport only. The marker overlay is deliberately
  // left out of this effect's dependencies/body entirely — it must never move to a
  // search result, only the camera does, so the persisted business location is never
  // visually misrepresented as having changed.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (previewCenter) {
      map.panTo(previewCenter);
    } else {
      map.panTo({ lat, lng });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewCenter]);

  // Swap in the real profile photo (or fall back, or the loading spinner) whenever the
  // authoritative media state changes. A plain `<img>` is used inside the overlay's
  // circle for the "ready" case, so this is just setting its `src` — no fetch/blob/
  // data-URL conversion needed to *display* it (see the class doc comment).
  useEffect(() => {
    overlayRef.current?.setProfileMediaState(profileMedia);
  }, [profileMedia, mapStatus]);

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
