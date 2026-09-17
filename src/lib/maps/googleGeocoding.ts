import { isGoogleMapsConfigured, loadGoogleMapsLibrary } from "./googleMapsLoader";

export interface GeocodeCoordinates {
  lat: number;
  lng: number;
}

let geocoderPromise: Promise<google.maps.Geocoder> | null = null;

function getGeocoder(): Promise<google.maps.Geocoder> {
  if (!geocoderPromise) {
    geocoderPromise = loadGoogleMapsLibrary("geocoding").then((lib) => new lib.Geocoder());
    geocoderPromise.catch(() => {
      geocoderPromise = null;
    });
  }
  return geocoderPromise;
}

/**
 * Address -> coordinates, restricted to Cyprus the same way the site's existing Nominatim
 * calls are (`countrycodes=cy`). Returns the single best match, or `null` on no match,
 * missing/invalid key, or any other failure — callers must treat `null` the same way the
 * current Nominatim-based flow does: keep whatever coordinate was already resolved, never
 * fabricate or jump to an unrelated location.
 *
 * `signal` is an optional cooperative staleness guard (checked after each await, not a real
 * network abort — the Maps JS SDK has no fetch-level AbortSignal support) so a caller can
 * reproduce the existing debounced-effect's "an older response can never overwrite a newer
 * one" guarantee.
 */
export async function geocodeAddress(
  address: string,
  signal?: AbortSignal,
): Promise<GeocodeCoordinates | null> {
  const trimmed = address.trim();
  if (!isGoogleMapsConfigured() || !trimmed || signal?.aborted) return null;

  try {
    const geocoder = await getGeocoder();
    if (signal?.aborted) return null;

    const response = await geocoder.geocode({
      address: trimmed,
      region: "CY",
      componentRestrictions: { country: "CY" },
    });
    if (signal?.aborted) return null;

    const [first] = response.results;
    if (!first) return null;

    return { lat: first.geometry.location.lat(), lng: first.geometry.location.lng() };
  } catch {
    // Covers ZERO_RESULTS (the SDK rejects by default) as well as network/quota/key
    // failures — all of which must be silent no-ops to the caller, not a fabricated pin.
    return null;
  }
}

/**
 * Coordinates -> a Google-resolved human-readable address string, for DISPLAY ONLY.
 * Never returns a Place ID or any other provider-specific object — just plain text, or
 * `null` on `ZERO_RESULTS`, quota/auth failure, or any other provider error. Callers
 * must fall back to their own existing structured-address text on `null`, and must
 * never write this string back into persisted coordinates.
 */
export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<string | null> {
  if (!isGoogleMapsConfigured()) return null;

  try {
    const geocoder = await getGeocoder();
    const response = await geocoder.geocode({ location: { lat, lng }, region: "CY" });

    const [first] = response.results;
    return first?.formatted_address ?? null;
  } catch {
    // Same rationale as geocodeAddress's catch: ZERO_RESULTS and any other provider
    // failure are display-only concerns here, never surfaced as an error to the caller.
    return null;
  }
}
