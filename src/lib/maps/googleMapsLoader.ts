import { setOptions, importLibrary, type LibraryMap } from "@googlemaps/js-api-loader";

// The package only exports `LibraryMap` as a type (not the `LibraryName` key alias it uses
// internally), so it's re-derived here the same way the package itself defines it.
type LibraryName = keyof LibraryMap;

// `Loader`/`Loader.load()` from this package is explicitly deprecated in favor of the
// functional `setOptions()` + `importLibrary()` pair (see the package's own MIGRATION.md) —
// this module only ever uses that supported API.
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

let optionsConfigured = false;

function configureOptionsOnce(): void {
  if (optionsConfigured) return;
  // `setOptions` must run before the first `importLibrary` call and only ever once;
  // `region` mirrors the Cyprus bias already used by the site's Nominatim calls.
  setOptions({ key: googleMapsApiKey, region: "CY", language: "en" });
  optionsConfigured = true;
}

export function isGoogleMapsConfigured(): boolean {
  return googleMapsApiKey.length > 0;
}

const libraryPromises = new Map<LibraryName, Promise<unknown>>();

/**
 * Loads a single Google Maps JS library (e.g. "maps", "geocoding", "places", "marker"),
 * sharing one script load across every independently-mounted map component. Safe to call
 * from multiple components at once — the underlying script is only ever injected once.
 *
 * Rejects (never throws synchronously, never crashes the app) when called during SSR or
 * when the API key is missing, so callers can degrade gracefully instead of blank-screening.
 */
export function loadGoogleMapsLibrary<TLibraryName extends LibraryName>(
  libraryName: TLibraryName,
): Promise<LibraryMap[TLibraryName]> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only be loaded in the browser."));
  }
  if (!isGoogleMapsConfigured()) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured."));
  }

  const cached = libraryPromises.get(libraryName);
  if (cached) return cached as Promise<LibraryMap[TLibraryName]>;

  configureOptionsOnce();

  const promise = importLibrary(libraryName);
  libraryPromises.set(libraryName, promise);
  // Don't cache a failed load — a transient network/quota failure shouldn't permanently
  // block every later attempt to use Maps on this page.
  promise.catch(() => {
    libraryPromises.delete(libraryName);
  });

  return promise;
}
