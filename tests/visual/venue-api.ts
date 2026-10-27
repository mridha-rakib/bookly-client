import type { AxiosRequestConfig } from "axios";
import { BooklyApiError } from "../../src/lib/api/client";
import { venueCatalog, venuePackages } from "./venue-services-fixtures";
export * from "../../src/lib/api/client";
declare global { interface Window { __venueRequests?: Array<{ method: string; url: string }> } }

export async function apiRequest<T>(input: AxiosRequestConfig): Promise<T> {
  const method = input.method ?? "GET", url = input.url ?? "";
  (window.__venueRequests ??= []).push({ method, url });
  if (method !== "GET") throw Error("Visual fixture forbids mutations and provider requests");
  const state = new URLSearchParams(window.location.search).get("state");
  let response: unknown;
  if (url.startsWith("/package-views/catalog/")) {
    if (state === "loading") return new Promise<T>(() => undefined);
    if (state === "429" || state === "503") throw new BooklyApiError({ message: "Isolated fixture failure", status: Number(state) });
    response = { packages: state === "empty" ? [] : venuePackages };
  } else if (url.endsWith("/addons")) response = { addons: [] };
  else if (url.endsWith("/reviews/summary")) response = { averageRating: null, reviewCount: 0 };
  else if (url.endsWith("/reviews")) response = { reviews: [], pagination: { page: 1, limit: 5, total: 0 } };
  else if (url.startsWith("/catalog/businesses/")) response = venueCatalog;
  else if (url.endsWith("/favorites/ids")) response = { businessIds: [] };
  else response = {};
  return response as T;
}
