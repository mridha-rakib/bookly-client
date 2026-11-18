/**
 * Venue summary card — the Business's saved Instagram and Facebook accounts.
 *
 * Renders the REAL Venue page (real React Query + catalog hooks) with only the transport
 * (`apiRequest`), navigation and heavy presentational children replaced, exactly like the other
 * venue page tests.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessCatalog, CatalogService } from "@/lib/api/catalog";
import { facebookPageHref, instagramProfileUrl } from "@/app/venue/components/VenueSocialLinks";

const VENUE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const service: CatalogService = {
  id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Keratin Hair Treatment", category: "Hair", isFeatured: true, servedCities: [],
  assignedStaffMembershipIds: ["eeeeeeeeeeeeeeeeeeeeeeee"], isPackageDeal: false, pricingMode: "FIXED",
  fixedPricing: { priceCents: 12000, durationMin: 90 },
};
const catalogWith = (social: Partial<BusinessCatalog["business"]>): BusinessCatalog => ({
  business: {
    id: VENUE_ID, name: "Aurelia Hair & Beauty Studio", category: "Beauty & Wellness", subcategories: [], briefDescription: "Fixture",
    visitType: "AT_BUSINESS_LOCATION", timezone: "UTC",
    address: { city: "Larnaca", area: "Larnaca", streetName: "Main", streetNumber: "1" },
    openStatus: { configured: true, isOpen: false, label: "Closed - opens at 9:00 AM" }, hours: [], media: [],
    ...social,
  } as BusinessCatalog["business"],
  services: [service],
  staff: [{ id: "eeeeeeeeeeeeeeeeeeeeeeee", firstName: "Ana", role: "STAFF" }],
});
const SAVED = { instagramHandle: "aurelia.studio", facebookPageUrl: "https://www.facebook.com/aurelia.studio" };

const fx = vi.hoisted(() => ({
  catalog: undefined as unknown,
  auth: { user: { id: "111111111111111111111111", role: "CUSTOMER", firstName: "Test" } as unknown, status: "authenticated", cacheEpoch: 1, isInitializing: false },
}));

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: async (config: { url?: string }) => {
    const url = config.url ?? "";
    if (url === `/catalog/businesses/${VENUE_ID}`) return fx.catalog;
    if (url === "/platform/booking-config") return { maxServicesPerBooking: 5 };
    if (url.endsWith("/reviews/summary")) return { averageRating: 4, reviewCount: 2 };
    if (url.endsWith("/reviews")) return { reviews: [], pagination: { page: 1, limit: 5, total: 0 } };
    if (url === "/me/favorites/ids") return { businessIds: [] };
    if (url.endsWith("/addons")) return { addons: [] };
    return {};
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined, refresh: () => undefined, prefetch: async () => undefined }),
  useSearchParams: () => new URLSearchParams(`id=${VENUE_ID}`),
  usePathname: () => "/venue",
}));
vi.mock("next/image", () => ({ default: ({ alt }: { alt?: string }) => <span role="img" aria-label={alt ?? ""} /> }));
vi.mock("next/link", () => ({ default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a> }));
vi.mock("@/lib/auth/store", () => {
  const getState = () => ({ ...fx.auth, logout: async () => "confirmed" });
  return { useAuthStore: Object.assign(<T,>(selector: (s: ReturnType<typeof getState>) => T) => selector(getState()), { getState }) };
});
vi.mock("@/lib/packages/view-hooks", () => ({ usePackageView: () => ({ data: { packages: [] }, isPending: false, error: null }) }));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: async () => null }));
vi.mock("@/components/Navbar", () => ({ default: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ default: () => <footer /> }));
vi.mock("@/components/ServiceCard", () => ({ default: () => <div /> }));
vi.mock("@/components/landing-page/Carousel", () => ({ default: () => <div /> }));
vi.mock("@/app/venue/components/VenueLocationMap", () => ({ default: () => <div /> }));
vi.mock("@/app/venue/components/VenueServices", () => ({
  default: (props: { services: CatalogService[]; renderService: (s: CatalogService) => React.ReactNode }) =>
    <div>{props.services.map((s) => <div key={s.id} data-service-card={s.id}>{props.renderService(s)}</div>)}</div>,
}));

import VenueDetailsPage from "@/app/venue/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const DESKTOP_WIDTH = 1440;

async function waitFor(check: () => void, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  for (;;) {
    try { check(); return; } catch (error) { if (Date.now() - started > timeoutMs) throw error; }
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
}
async function render(social: Partial<BusinessCatalog["business"]>, width = DESKTOP_WIDTH) {
  fx.catalog = catalogWith(social);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  await act(async () => root.render(<QueryClientProvider client={client}><VenueDetailsPage /></QueryClientProvider>));
  await waitFor(() => expect(host.querySelector(`[data-service-card="${service.id}"]`)).toBeTruthy());
}
const aside = () => host.querySelector("#booking-aside") as HTMLElement;
const socialLinks = (scope: ParentNode) =>
  [...scope.querySelectorAll('[aria-label="Social media"] a')] as HTMLAnchorElement[];
const anyExternalSocialHref = () =>
  [...host.querySelectorAll("a")].some((a) => /instagram\.com|facebook\.com|^javascript:/i.test(a.getAttribute("href") ?? ""));
const expectSavedLinks = (scope: ParentNode) => {
  const links = socialLinks(scope);
  expect(links.map((a) => a.textContent?.trim())).toEqual(["Instagram", "Facebook"]);
  expect(links[0]!.getAttribute("href")).toBe("https://www.instagram.com/aurelia.studio/");
  expect(links[1]!.getAttribute("href")).toBe("https://www.facebook.com/aurelia.studio");
  for (const link of links) {
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  }
  expect(links[0]!.getAttribute("aria-label")).toBe("Aurelia Hair & Beauty Studio on Instagram");
  expect(links[1]!.getAttribute("aria-label")).toBe("Aurelia Hair & Beauty Studio on Facebook");
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fx.auth = { user: { id: "111111111111111111111111", role: "CUSTOMER", firstName: "Test" }, status: "authenticated", cacheEpoch: 1, isInitializing: false };
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
  root = undefined as unknown as Root;
  host = undefined as unknown as HTMLDivElement;
  vi.restoreAllMocks();
});

describe("social link validation", () => {
  it("builds the Instagram profile URL and keeps only https facebook.com Page URLs", () => {
    expect(instagramProfileUrl("@aurelia.studio")).toBe("https://www.instagram.com/aurelia.studio/");
    expect(instagramProfileUrl("aurelia_studio")).toBe("https://www.instagram.com/aurelia_studio/");
    expect(facebookPageHref("https://facebook.com/aurelia")).toBe("https://facebook.com/aurelia");
    for (const bad of [undefined, "", " ", "@", "bad handle!", "a/b", "x".repeat(61), "javascript:alert(1)"])
      expect(instagramProfileUrl(bad)).toBeNull();
    for (const bad of [undefined, "", "not a url", "http://facebook.com/aurelia", "https://facebook.com.evil.example/aurelia",
      "https://evil.example/facebook.com/aurelia", "https://user:pw@facebook.com/aurelia", "javascript:alert(1)", "https://facebook.com/"])
      expect(facebookPageHref(bad)).toBeNull();
  });
});

describe("venue summary card social links", () => {
  it("desktop: the signed-in summary card shows both saved accounts with their saved URLs", async () => {
    await render(SAVED);
    await waitFor(() => expect(socialLinks(aside())).toHaveLength(2));
    expectSavedLinks(aside());
    // Below the existing address row, inside the same card.
    expect(aside().textContent).toContain("Get Directions");
  });

  it("desktop: the checkout layout (service selected) keeps both accounts in the card", async () => {
    await render(SAVED);
    const card = host.querySelector(`[data-service-card="${service.id}"]`)!;
    await act(async () => { (card.querySelector("button") as HTMLButtonElement).click(); });
    await waitFor(() => expect(aside().textContent).toContain("Keratin Hair Treatment"));
    await waitFor(() => expect(socialLinks(aside())).toHaveLength(2));
    expectSavedLinks(aside());
  });

  it("mobile: the expanded summary drawer shows both saved accounts", async () => {
    await render(SAVED, 390);
    vi.spyOn(aside(), "getBoundingClientRect").mockReturnValue({ height: 600, bottom: 40, top: -560, left: 0, right: 390, width: 390, x: 0, y: -560, toJSON: () => ({}) } as DOMRect);
    await act(async () => { window.dispatchEvent(new Event("scroll")); });
    const footer = await (async () => {
      let found: HTMLElement | null = null;
      await waitFor(() => { found = host.querySelector("div.fixed.bottom-0") as HTMLElement | null; expect(found).toBeTruthy(); });
      return found as unknown as HTMLElement;
    })();
    expect(socialLinks(footer)).toHaveLength(0); // collapsed
    const expand = [...footer.querySelectorAll("button")].find((b) => b.textContent?.includes("Book a visit"))!;
    await act(async () => { expand.click(); });
    await waitFor(() => expect(socialLinks(footer)).toHaveLength(2));
    expectSavedLinks(footer);
  });

  it("shows only the saved platform when one account is saved", async () => {
    await render({ facebookPageUrl: SAVED.facebookPageUrl });
    await waitFor(() => expect(socialLinks(aside())).toHaveLength(1));
    expect(socialLinks(aside())[0]!.textContent?.trim()).toBe("Facebook");
    expect(host.querySelector('a[href*="instagram.com"]')).toBeNull();
  });

  it("missing social accounts render no social links", async () => {
    await render({});
    await waitFor(() => expect(aside().textContent).toContain("Get Directions"));
    expect(host.querySelector('[aria-label="Social media"]')).toBeNull();
    expect(anyExternalSocialHref()).toBe(false);
  });

  it("invalid stored values are never rendered as clickable links", async () => {
    await render({ instagramHandle: "bad handle!", facebookPageUrl: "javascript:alert(1)//https://facebook.com/x" });
    await waitFor(() => expect(aside().textContent).toContain("Get Directions"));
    expect(host.querySelector('[aria-label="Social media"]')).toBeNull();
    expect(anyExternalSocialHref()).toBe(false);
    expect(host.textContent).not.toContain("javascript:");
  });

  it("logged out: the locked contact card does not show social accounts", async () => {
    fx.auth = { user: null, status: "unauthenticated", cacheEpoch: 1, isInitializing: false };
    await render(SAVED);
    await waitFor(() => expect(aside().textContent).toContain("Log in or create an account to contact this business"));
    expect(socialLinks(host)).toHaveLength(0);
  });
});
