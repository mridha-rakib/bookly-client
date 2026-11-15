import { resolveBusinessCity } from "@/lib/location/store";
import type { ExploreAvailability } from "@/components/explore/DiscoveryControls";
import type { BusinessCity } from "@/lib/constants/cities";

export function discoverySearchHref(query: string, city: BusinessCity | null, availability: ExploreAvailability | null): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (city) params.set("city", city);
  if (availability) { params.set("availDate", availability.date); params.set("availWindow", availability.window); }
  const search = params.toString();
  return search ? `/explore?${search}` : "/explore";
}

export function parseDiscoverySearch(params: Pick<URLSearchParams, "get">) {
  const q = (params.get("q") ?? "").trim();
  const city = resolveBusinessCity(params.get("city"));
  const date = params.get("availDate");
  const window = params.get("availWindow");
  const parsedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
  const availability: ExploreAvailability | null = validDate && date && (window === "ANY" || window === "MORNING" || window === "AFTERNOON" || window === "EVENING") ? { date, window } : null;
  return { q, city, availability };
}
