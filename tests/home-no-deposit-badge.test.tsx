import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import CategoryServicesSection from "@/components/landing-page/CategoryServicesSection";
import { useAuthStore } from "@/lib/auth/store";
import type { AuthUser } from "@/lib/api/auth";
import { invalidateHomeNoDepositForBusiness } from "@/lib/discovery/no-deposit-keys";

const fx = vi.hoisted(() => ({ requests: [] as { data: { selections: { businessId: string; serviceId?: string }[] } }[],
  send: undefined as undefined | (() => Promise<void>), eligible: true, push: vi.fn() }));
vi.mock("@/lib/api/client", async original => ({ ...await original<object>(), apiRequest: async (request: { params: { selections: string } }) => {
  const selections = JSON.parse(request.params.selections) as { businessId: string; serviceId?: string }[];
  fx.requests.push({ data: { selections } }); await fx.send?.();
  return { scope: "NEW_ORDINARY_BOOKING", selections: selections.map(value => ({ ...value, noDepositNeeded: fx.eligible && value.businessId === "a" })) };
} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fx.push }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/landing-page/Carousel", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/lib/discovery/hooks", () => {
  const card = (id: string) => ({ id, name: `Business ${id}`, category: "Beauty", subcategories: [], city: "Larnaca", visitType: "TRAVEL_TO_CUSTOMER", averageRating: 5, reviewCount: 2, startingPriceCents: 2000, startingPricingMode: "FIXED", isAvailable: true });
  return { useDiscoveryCategoriesQuery: () => ({ data: { categories: [] } }), useHomeSectionsQuery: () => ({ data: { recommended: [card("a"), card("b")], nearYou: [card("a")], popular: [card("a")] } }) };
});
vi.mock("@/lib/bookings/hooks", () => ({ useBookAgainCandidatesQuery: () => ({ data: { candidates: [{ originalBookingId: "booking", businessId: "a", businessName: "Business a", primaryServiceName: "Haircut", serviceId: "service", originalStartAt: "2026-01-01T10:00:00Z", originalTotalCents: 2000, currency: "EUR" }] } }) }));
vi.mock("@/lib/favorite/hooks", async original => ({ ...await original<object>(), useFavoriteIdsQuery: () => ({ data: { businessIds: [] } }), useAddFavoriteMutation: () => ({ mutateAsync: vi.fn() }), useRemoveFavoriteMutation: () => ({ mutateAsync: vi.fn() }) }));
let host: HTMLDivElement, root: Root, client: QueryClient;
const previousAuth = useAuthStore.getState();
const user = (id = "customer") => ({ id, role: "CUSTOMER", status: "ACTIVE" }) as AuthUser;
const badges = () => host.querySelectorAll("[data-no-deposit-badge]");
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); }); }
async function mount() { await act(async () => root.render(<QueryClientProvider client={client}><CategoryServicesSection /></QueryClientProvider>)); await settle(); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fx.requests = []; fx.send = undefined; fx.eligible = true; fx.push.mockReset();
  useAuthStore.setState({ user: user(), status: "authenticated", isInitializing: false, cacheEpoch: 1 });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 300000 } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); useAuthStore.setState(previousAuth); });
it("shows one shared image overlay in Book Again and all three discovery rows, omitting FIRST Business b", async () => {
  await mount();
  expect(badges()).toHaveLength(4);
  expect(fx.requests).toHaveLength(2); // One deduplicated discovery batch plus one specific-service history batch.
  const businessBatch = fx.requests.find(request => request.data.selections.some(value => value.businessId === "b"))!;
  expect(businessBatch.data.selections).toEqual([{ businessId: "a" }, { businessId: "b" }]);
  for (const badge of badges()) {
    expect(badge.textContent).toContain("No Deposit Needed");
    expect(badge.className).toContain("absolute"); expect(badge.className).toContain("bottom-[8px]");
    expect(badge.className).toContain("bg-[#2E9DA7]"); expect(badge.className).toContain("rounded-full");
    expect(badge.parentElement?.className).toContain("relative");
  }
  expect(host.textContent).toContain("Recommended"); expect(host.textContent).toContain("Services near you"); expect(host.textContent).toContain("Popular");
});
it("anonymous and suspended Customers receive no personalized badge or eligibility requests", async () => {
  useAuthStore.setState({ user: null, status: "unauthenticated" }); await mount();
  expect(badges()).toHaveLength(0); expect(fx.requests).toHaveLength(0);
  await act(async () => useAuthStore.setState({ user: { ...user(), status: "SUSPENDED" }, status: "authenticated" })); await settle();
  expect(badges()).toHaveLength(0); expect(fx.requests).toHaveLength(0);
});
it("loading and failed eligibility never borrow a positive discovery/history label", async () => {
  const pending: (() => void)[] = [];
  fx.send = () => new Promise<void>(resolve => { pending.push(resolve); });
  await mount(); expect(badges()).toHaveLength(0);
  await act(async () => { pending.forEach(release => release()); }); await settle();
  fx.send = async () => { throw Error("Unavailable"); };
  await act(async () => { await client.invalidateQueries({ queryKey: ["homeNoDeposit"] }); }); await settle();
  expect(badges()).toHaveLength(0);
});
it("logout/account changes immediately hide old positives and use a new Customer/epoch cache scope", async () => {
  await mount(); expect(badges()).toHaveLength(4);
  await act(async () => useAuthStore.setState({ user: null, status: "unauthenticated", cacheEpoch: 2 }));
  expect(badges()).toHaveLength(0);
  expect(client.getQueryCache().findAll({ queryKey: ["homeNoDeposit", "customer", 1] })).toHaveLength(0);
  fx.eligible = false;
  await act(async () => useAuthStore.setState({ user: user("other-customer"), status: "authenticated", cacheEpoch: 3 })); await settle();
  expect(badges()).toHaveLength(0);
  expect(client.getQueryCache().findAll({ queryKey: ["homeNoDeposit", "other-customer", 3] }).length).toBeGreaterThan(0);
});
it("relationship changes invalidate only batches containing the affected Business", async () => {
  await mount(); expect(badges()).toHaveLength(4);
  const before = fx.requests.length; fx.eligible = false;
  await act(async () => { await invalidateHomeNoDepositForBusiness(client, "unrelated"); });
  expect(fx.requests).toHaveLength(before);
  await act(async () => { await invalidateHomeNoDepositForBusiness(client, "a"); }); await settle();
  expect(badges()).toHaveLength(0); expect(fx.requests.length).toBeGreaterThan(before);
});
