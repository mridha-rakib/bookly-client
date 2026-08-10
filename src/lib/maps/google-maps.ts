const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

const defaultZoom = 14;

const buildLegacyEmbedUrl = (query: string): string =>
  `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=${defaultZoom}&ie=UTF8&iwloc=&output=embed`;

export const buildGoogleMapsEmbedUrl = (query: string): string => {
  const normalizedQuery = query.trim() || "Larnaca, Cyprus";

  if (!googleMapsApiKey) {
    return buildLegacyEmbedUrl(normalizedQuery);
  }

  const params = new URLSearchParams({
    key: googleMapsApiKey,
    q: normalizedQuery,
    zoom: String(defaultZoom),
  });

  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
};
