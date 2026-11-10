"use client";

import { useCallback, useState } from "react";

export type VisitorLocationStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable";

export type VisitorLocation = {
  status: VisitorLocationStatus;
  /** Coarsened to 3 decimals (about 100 m). Held in memory only: never stored by the browser
   * app or by Bookly, and sent only with the visitor's own discovery requests. */
  origin?: { lat: number; lng: number };
};

const coarsen = (value: number) => Math.round(value * 1000) / 1000;

/** P2.2.3 — the only location source for Explore: the visitor's explicit "Use my location"
 * action. Never requested automatically, never inferred from a city name. */
export const useVisitorLocation = () => {
  const [state, setState] = useState<VisitorLocation>({ status: "idle" });

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ status: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setState({
          status: "ready",
          origin: { lat: coarsen(position.coords.latitude), lng: coarsen(position.coords.longitude) },
        }),
      (error) => setState({ status: error.code === 1 ? "denied" : "unavailable" }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const clear = useCallback(() => setState({ status: "idle" }), []);

  return { ...state, request, clear };
};
