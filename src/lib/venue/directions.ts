import type { CatalogBusiness } from "@/lib/api/catalog";

/**
 * Google Maps directions to the Venue's own saved location (Google Maps URLs, `maps/dir/?api=1`).
 * Prefers the Business's persisted coordinate (validated server-side, re-checked here); otherwise
 * a complete saved street address. Never geocodes or invents a location: with neither, there is
 * no destination (null) and the UI shows directions as unavailable.
 *
 * Every Bookly Business city is in Cyprus (api business.types.ts `businessCities`), so the
 * address destination names the country to stop Google matching a same-named place elsewhere.
 */
export function buildVenueDirectionsUrl(
  business: Pick<CatalogBusiness, "location" | "address"> | undefined,
): string | null {
  if (!business) return null;
  const destination = coordinateDestination(business.location) ?? addressDestination(business.address);
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : null;
}

function coordinateDestination(location: CatalogBusiness["location"]): string | null {
  if (!location) return null;
  const { lat, lng } = location;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return `${lat},${lng}`;
}

function addressDestination(address: CatalogBusiness["address"] | undefined): string | null {
  const streetName = address?.streetName?.trim();
  const streetNumber = address?.streetNumber?.trim();
  const city = address?.city?.trim();
  // A street with its number and the city is the minimum Google can route to precisely.
  if (!streetName || !streetNumber || !city) return null;
  const area = address?.area?.trim();
  return [`${streetName} ${streetNumber}`, area && area !== city ? area : null, city, "Cyprus"]
    .filter(Boolean)
    .join(", ");
}
