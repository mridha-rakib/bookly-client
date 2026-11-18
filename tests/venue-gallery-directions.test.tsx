/**
 * Venue page: the full photo gallery ("See all") and "Get Directions".
 *
 * Part 1 tests the pure directions builder and the gallery dialog on their own. Part 2 renders the
 * REAL Venue page (real React Query + catalog hooks) with only the transport, navigation and heavy
 * children replaced, like the other venue page tests.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessCatalog, CatalogService } from "@/lib/api/catalog";
import { buildVenueDirectionsUrl } from "@/lib/venue/directions";
import VenueGalleryDialog from "@/app/venue/components/VenueGalleryDialog";

const fx = vi.hoisted(() => ({
  catalog: undefined as unknown,
  catalogRequests: 0,
  catalogGate: undefined as undefined | Promise<void>,
  auth: { user: { id: "111111111111111111111111", role: "CUSTOMER", firstName: "Test" } as unknown, status: "authenticated", cacheEpoch: 1, isInitializing: false },
}));
const VENUE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: async (config: { url?: string }) => {
    const url = config.url ?? "";
    if (url === `/catalog/businesses/${VENUE_ID}`) { fx.catalogRequests += 1; await fx.catalogGate; return fx.catalog; }
    if (url === "/platform/booking-config") return { maxServicesPerBooking: 5 };
    if (url.endsWith("/reviews/summary")) return { averageRating: 4, reviewCount: 2 };
    if (url.endsWith("/reviews")) return { reviews: [], pagination: { page: 1, limit: 5, total: 0 } };
    if (url === "/me/favorites/ids") return { businessIds: [] };
    return {};
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined, refresh: () => undefined, prefetch: async () => undefined }),
  useSearchParams: () => new URLSearchParams(`id=${VENUE_ID}`),
  usePathname: () => "/venue",
}));
// A plain <img> keeps src/alt/onError observable (Next's optimizer is not under test).
vi.mock("next/image", () => ({
  default: ({ src, alt, onError }: { src: string; alt?: string; onError?: () => void }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt ?? ""} onError={onError} />,
}));
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
vi.mock("@/app/venue/components/VenueLocationMap", () => ({ default: () => <div data-testid="venue-map" /> }));
vi.mock("@/app/venue/components/VenueServices", () => ({
  default: (props: { services: CatalogService[]; renderService: (s: CatalogService) => React.ReactNode }) =>
    <div>{props.services.map((s) => <div key={s.id} data-service-card={s.id}>{props.renderService(s)}</div>)}</div>,
}));

import VenueDetailsPage from "@/app/venue/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined, host: HTMLDivElement | undefined;

const service: CatalogService = {
  id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Keratin Hair Treatment", category: "Hair", isFeatured: true, servedCities: [],
  assignedStaffMembershipIds: ["eeeeeeeeeeeeeeeeeeeeeeee"], isPackageDeal: false, pricingMode: "FIXED",
  fixedPricing: { priceCents: 12000, durationMin: 90 },
};
const media = [
  { id: "m1", url: "https://hel1.your-objectstorage.com/bookly/businesses/a/media/profile.png", role: "PROFILE" as const },
  { id: "m2", url: "https://hel1.your-objectstorage.com/bookly/businesses/a/media/salon.png", role: "GALLERY" as const },
  { id: "m3", url: "https://hel1.your-objectstorage.com/bookly/businesses/a/media/chair.png", role: "GALLERY" as const },
];
const catalogWith = (over: Partial<BusinessCatalog["business"]>): BusinessCatalog => ({
  business: {
    id: VENUE_ID, name: "Aurelia Hair & Beauty Studio", category: "Beauty & Wellness", subcategories: [], briefDescription: "Fixture",
    visitType: "AT_BUSINESS_LOCATION", timezone: "UTC",
    address: { city: "Larnaca", area: "Finikoudes", streetName: "Athinon Avenue", streetNumber: "12" },
    openStatus: { configured: true, isOpen: false, label: "Closed - opens at 9:00 AM" }, hours: [], media,
    ...over,
  } as BusinessCatalog["business"],
  services: [service],
  staff: [{ id: "eeeeeeeeeeeeeeeeeeeeeeee", firstName: "Ana", role: "STAFF" }],
});

async function waitFor(check: () => void, timeoutMs = 3000): Promise<void> {
  const started = Date.now();
  for (;;) {
    try { check(); return; } catch (error) { if (Date.now() - started > timeoutMs) throw error; }
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
}
async function mount(node: React.ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(node));
}
async function renderPage(over: Partial<BusinessCatalog["business"]> = {}, width = 1440) {
  fx.catalog = catalogWith(over);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  await mount(<QueryClientProvider client={client}><VenueDetailsPage /></QueryClientProvider>);
  await waitFor(() => expect(host!.querySelector(`[data-service-card="${service.id}"]`)).toBeTruthy());
}
const buttonByText = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
const key = async (k: string, shiftKey = false) => {
  await act(async () => { (document.activeElement ?? dialog())!.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true })); });
};
/** Desktop shows one tab's section at a time; open it the way a user does. */
const openTab = async (tab: "about" | "gallery") => {
  await act(async () => [...host!.querySelectorAll("button")].find((b) => b.textContent?.trim() === tab)!.click());
};
const directionLinks = () => [...host!.querySelectorAll("a")].filter((a) => a.textContent?.trim() === "Get Directions");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fx.catalogRequests = 0;
  fx.catalogGate = undefined;
  fx.auth = { user: { id: "111111111111111111111111", role: "CUSTOMER", firstName: "Test" }, status: "authenticated", cacheEpoch: 1, isInitializing: false };
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = undefined; host = undefined;
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

describe("buildVenueDirectionsUrl", () => {
  const address = { city: "Limassol", area: "Germasogeia", streetName: "Amathountos", streetNumber: "8" };
  it("uses the saved coordinate first, as a Google Maps directions destination", () => {
    expect(buildVenueDirectionsUrl({ location: { lat: 34.6891, lng: 33.0716 }, address }))
      .toBe("https://www.google.com/maps/dir/?api=1&destination=34.6891%2C33.0716");
  });
  it("falls back to the complete saved street address (Cyprus), never a fabricated coordinate", () => {
    expect(buildVenueDirectionsUrl({ address })).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Amathountos 8, Germasogeia, Limassol, Cyprus")}`,
    );
    // An invalid stored coordinate is ignored, not "corrected".
    expect(buildVenueDirectionsUrl({ location: { lat: 123, lng: 33 }, address })).toContain(encodeURIComponent("Amathountos 8"));
    expect(buildVenueDirectionsUrl({ location: { lat: Number.NaN, lng: 33 }, address })).toContain(encodeURIComponent("Amathountos 8"));
  });
  it("returns null when no usable destination exists", () => {
    expect(buildVenueDirectionsUrl(undefined)).toBeNull();
    expect(buildVenueDirectionsUrl({ address: { ...address, streetName: " " } })).toBeNull();
    expect(buildVenueDirectionsUrl({ address: { ...address, streetNumber: "" } })).toBeNull();
    expect(buildVenueDirectionsUrl({ address: { ...address, city: "" } })).toBeNull();
  });
  it("encodes the destination (no URL injection)", () => {
    const url = buildVenueDirectionsUrl({ address: { ...address, streetName: "A&b=c#x" } })!;
    expect(new URL(url).searchParams.get("destination")).toBe("A&b=c#x 8, Germasogeia, Limassol, Cyprus");
    expect(new URL(url).host).toBe("www.google.com");
  });
});

describe("VenueGalleryDialog", () => {
  const images = media.map(({ id, url }) => ({ id, url }));
  const shown = () => (dialog()!.querySelector("img") as HTMLImageElement | null)?.getAttribute("src");

  it("shows one photo at a time with accessible Close/Previous/Next and wraps around", async () => {
    const onClose = vi.fn();
    await mount(<VenueGalleryDialog images={images} businessName="Aurelia" startIndex={1} onClose={onClose} />);
    expect(dialog()!.getAttribute("aria-modal")).toBe("true");
    expect(dialog()!.getAttribute("aria-label")).toBe("Aurelia photos");
    expect(dialog()!.querySelectorAll("img")).toHaveLength(1); // only the current photo loads
    expect(shown()).toBe(images[1]!.url);
    expect(dialog()!.textContent).toContain("Photo 2 of 3");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close gallery");
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => (dialog()!.querySelector('[aria-label="Next photo"]') as HTMLButtonElement).click());
    expect(shown()).toBe(images[2]!.url);
    await act(async () => (dialog()!.querySelector('[aria-label="Next photo"]') as HTMLButtonElement).click());
    expect(shown()).toBe(images[0]!.url); // wraps
    await act(async () => (dialog()!.querySelector('[aria-label="Previous photo"]') as HTMLButtonElement).click());
    expect(shown()).toBe(images[2]!.url);
    await act(async () => (dialog()!.querySelector('[aria-label="Close gallery"]') as HTMLButtonElement).click());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("supports keyboard: arrows navigate, Escape closes, Tab stays inside", async () => {
    const onClose = vi.fn();
    await mount(<VenueGalleryDialog images={images} businessName="Aurelia" startIndex={0} onClose={onClose} />);
    await key("ArrowRight");
    expect(shown()).toBe(images[1]!.url);
    await key("ArrowLeft");
    await key("ArrowLeft");
    expect(shown()).toBe(images[2]!.url);
    const buttons = [...dialog()!.querySelectorAll("button")];
    buttons.at(-1)!.focus();
    await key("Tab");
    expect(document.activeElement).toBe(buttons[0]);
    await key("Tab", true);
    expect(document.activeElement).toBe(buttons.at(-1));
    await key("Escape");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("supports pointer swipe", async () => {
    await mount(<VenueGalleryDialog images={images} businessName="Aurelia" startIndex={0} onClose={() => undefined} />);
    const stage = dialog()!.querySelector(".touch-pan-y") as HTMLElement;
    const pointer = (type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, clientX });
      stage.dispatchEvent(event);
    };
    await act(async () => { pointer("pointerdown", 300); pointer("pointerup", 200); });
    expect(shown()).toBe(images[1]!.url);
    await act(async () => { pointer("pointerdown", 100); pointer("pointerup", 220); });
    expect(shown()).toBe(images[0]!.url);
    await act(async () => { pointer("pointerdown", 100); pointer("pointerup", 120); }); // too short
    expect(shown()).toBe(images[0]!.url);
  });

  it("a photo that fails to load shows a clear unavailable state, other photos still work", async () => {
    await mount(<VenueGalleryDialog images={images} businessName="Aurelia" startIndex={0} onClose={() => undefined} />);
    await act(async () => { dialog()!.querySelector("img")!.dispatchEvent(new Event("error")); });
    expect(dialog()!.textContent).toContain("This photo could not be loaded.");
    expect(dialog()!.querySelector("img")).toBeNull();
    await key("ArrowRight");
    expect(shown()).toBe(images[1]!.url);
  });

  it("a single photo has no Previous/Next; an empty gallery says so", async () => {
    await mount(<VenueGalleryDialog images={[images[0]!]} businessName="Aurelia" startIndex={5} onClose={() => undefined} />);
    expect(shown()).toBe(images[0]!.url);
    expect(dialog()!.querySelector('[aria-label="Next photo"]')).toBeNull();
    await act(async () => root!.unmount());
    host!.remove();
    await mount(<VenueGalleryDialog images={[]} businessName="Aurelia" startIndex={0} onClose={() => undefined} />);
    expect(dialog()!.textContent).toContain("This business hasn't added any photos yet.");
  });
});

describe("Venue page gallery and directions", () => {
  it("Photos 'See all', the hero 'See all images' and each photo open the full gallery of saved media (no extra request)", async () => {
    await renderPage();
    const requestsAfterLoad = fx.catalogRequests;
    await openTab("gallery");
    await act(async () => (host!.querySelector('[aria-label="See all photos"]') as HTMLButtonElement).click());
    expect(dialog()).toBeTruthy();
    expect(dialog()!.textContent).toContain("Photo 1 of 3");
    expect(dialog()!.querySelector("img")!.getAttribute("src")).toBe(media[0]!.url);
    await key("Escape");
    expect(dialog()).toBeNull();

    await act(async () => buttonByText("See all images")!.click());
    expect(dialog()!.textContent).toContain("Photo 1 of 3");
    await key("Escape");

    await act(async () => (host!.querySelector('[aria-label="Open photo 3 of 3"]') as HTMLButtonElement).click());
    expect(dialog()!.querySelector("img")!.getAttribute("src")).toBe(media[2]!.url);
    expect(fx.catalogRequests).toBe(requestsAfterLoad);
  });

  it("with no saved photos the See all buttons are disabled and nothing is invented", async () => {
    await renderPage({ media: [] });
    await openTab("gallery");
    expect((host!.querySelector('[aria-label="See all photos"]') as HTMLButtonElement).disabled).toBe(true);
    expect(buttonByText("See all images")!.disabled).toBe(true);
    expect(host!.textContent).toContain("This business hasn't added any photos yet.");
    expect(dialog()).toBeNull();
  });

  it("while the catalog loads, See all is disabled and the loading state is shown", async () => {
    let release!: () => void;
    fx.catalogGate = new Promise<void>((resolve) => { release = resolve; });
    fx.catalog = catalogWith({});
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await mount(<QueryClientProvider client={client}><VenueDetailsPage /></QueryClientProvider>);
    await waitFor(() => expect(host!.textContent).toContain("Loading photos…"));
    expect((host!.querySelector('[aria-label="See all photos"]') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => release());
  });

  it("Get Directions opens Google Maps directions to THIS business's saved coordinate", async () => {
    await renderPage({ location: { lat: 34.9142, lng: 33.6371 } });
    const links = directionLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("https://www.google.com/maps/dir/?api=1&destination=34.9142%2C33.6371");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.getAttribute("aria-label")).toBe("Get directions to Aurelia Hair & Beauty Studio (opens Google Maps)");
    }
    await openTab("about");
    expect(host!.querySelector('[data-testid="venue-map"]')).toBeTruthy(); // the venue map is still rendered
  });

  it("without a coordinate it uses this business's saved address; a different business gets a different destination", async () => {
    await renderPage();
    expect(directionLinks()[0]!.getAttribute("href")).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Athinon Avenue 12, Finikoudes, Larnaca, Cyprus")}`,
    );
    await act(async () => root!.unmount());
    host!.remove();
    await renderPage({ name: "Other Studio", address: { city: "Paphos", area: "Kato Paphos", streetName: "Poseidonos", streetNumber: "3" } });
    expect(directionLinks()[0]!.getAttribute("href")).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Poseidonos 3, Kato Paphos, Paphos, Cyprus")}`,
    );
  });

  it("an incomplete address and no coordinate: directions are shown as unavailable, never a guess", async () => {
    await renderPage({ address: { city: "Larnaca", area: "Larnaca", streetName: "", streetNumber: "" } });
    expect(directionLinks()).toHaveLength(0);
    expect(host!.textContent).toContain("Directions unavailable");
    expect([...host!.querySelectorAll("a")].some((a) => (a.getAttribute("href") ?? "").includes("google.com/maps"))).toBe(false);
  });

  it("mobile: the expanded summary's Get Directions uses the same real destination", async () => {
    await renderPage({ location: { lat: 34.9142, lng: 33.6371 } }, 390);
    const aside = host!.querySelector("#booking-aside") as HTMLElement;
    vi.spyOn(aside, "getBoundingClientRect").mockReturnValue({ height: 600, bottom: 40, top: -560, left: 0, right: 390, width: 390, x: 0, y: -560, toJSON: () => ({}) } as DOMRect);
    await act(async () => { window.dispatchEvent(new Event("scroll")); });
    await waitFor(() => expect(host!.querySelector("div.fixed.bottom-0")).toBeTruthy());
    const footer = host!.querySelector("div.fixed.bottom-0") as HTMLElement;
    await act(async () => [...footer.querySelectorAll("button")].find((b) => b.textContent?.includes("Book a visit"))!.click());
    await waitFor(() => expect([...footer.querySelectorAll("a")].some((a) => a.textContent?.trim() === "Get Directions")).toBe(true));
    const link = [...footer.querySelectorAll("a")].find((a) => a.textContent?.trim() === "Get Directions")!;
    expect(link.getAttribute("href")).toBe("https://www.google.com/maps/dir/?api=1&destination=34.9142%2C33.6371");
  });
});
