import { isGoogleMapsConfigured, loadGoogleMapsLibrary } from "./googleMapsLoader";
import type { GeocodeCoordinates } from "./googleGeocoding";

export interface PlaceSuggestion {
  id: string;
  primaryText: string;
  secondaryText: string;
  /** Resolves this suggestion's coordinates on demand (a second, billed request) — never
   * called until the user actually selects a suggestion. Returns `null` on failure; callers
   * must not fabricate a location when this resolves to `null`. */
  resolveCoordinates: () => Promise<GeocodeCoordinates | null>;
}

/**
 * Cyprus-restricted place suggestions for a free-text query.
 *
 * Deliberately built on `google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions`
 * rather than:
 *  - `google.maps.places.Autocomplete` (the classic drop-in widget) — deprecated for new
 *    customers as of March 2025, and it renders Google's own input/dropdown, which would
 *    replace Bookly's existing custom search box design.
 *  - `google.maps.places.AutocompleteService` — also deprecated for new customers as of
 *    March 2025, superseded by `AutocompleteSuggestion`.
 *  - `PlaceAutocompleteElement` / `BasicPlaceAutocompleteElement` — the current *UI*
 *    components; also not usable here without replacing Bookly's own input.
 *
 * `AutocompleteSuggestion` is the current, non-deprecated, data-only surface: it returns
 * plain suggestion data with no forced UI, so it can drive a custom Bookly-styled dropdown
 * exactly like today's free-text search, while still being Cyprus-restricted.
 */
export async function fetchPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (!isGoogleMapsConfigured() || !trimmed) return [];

  try {
    const places = await loadGoogleMapsLibrary("places");
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: trimmed,
      includedRegionCodes: ["cy"],
    });

    return suggestions.flatMap((suggestion) => {
      const prediction = suggestion.placePrediction;
      if (!prediction) return [];

      return [
        {
          id: prediction.placeId,
          primaryText: (prediction.mainText ?? prediction.text).text,
          secondaryText: prediction.secondaryText?.text ?? "",
          resolveCoordinates: async (): Promise<GeocodeCoordinates | null> => {
            try {
              const { place } = await prediction.toPlace().fetchFields({ fields: ["location"] });
              const location = place.location;
              if (!location) return null;
              return { lat: location.lat(), lng: location.lng() };
            } catch {
              return null;
            }
          },
        },
      ];
    });
  } catch {
    // Missing/invalid key, load failure, or an empty-input/quota rejection — treated the
    // same as "no suggestions" rather than surfacing a component-level crash.
    return [];
  }
}
