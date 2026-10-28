import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FirstClassLifecycleControls, FirstClassSessionActions, LifecycleResult } from "@/components/packages/FirstClassLifecycleControls";
import { packageLifecycleApi, packageLifecycleError } from "@/lib/api/package-lifecycle";
import { apiRequest, BooklyApiError } from "@/lib/api/client";
import { owned } from "./visual/package-view-fixtures";
import { bookingKeys } from "@/lib/bookings/hooks";

vi.mock("@/lib/api/client", async (original) => ({ ...await original<object>(), apiRequest: vi.fn() }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: "p2d-customer", role: "CUSTOMER" } }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { sessionStorage.clear(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); vi.mocked(apiRequest).mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(node: React.ReactNode, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
}
it("real API transport uses the established action URL and preserves exact request keys", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ state: "UNRESOLVED" });
  const input = { businessId: "business", packageProgressId: "progress", bookingId: "booking", key: "stable" };
  await packageLifecycleApi.execute("cancel", input); await packageLifecycleApi.execute("cancel", input);
  expect(apiRequest).toHaveBeenNthCalledWith(1, { method: "POST", url: "/package-views/actions/cancel", data: input });
  expect(apiRequest).toHaveBeenNthCalledWith(2, { method: "POST", url: "/package-views/actions/cancel", data: input });
});
it("acceptance sends only exact quote identity, hashes, challenge and affirmative action", async () => {
  vi.mocked(apiRequest).mockResolvedValue({ state: "ACCEPTED" });
  await packageLifecycleApi.accept({ businessId: "business", packageProgressId: "progress", key: "same-session" }, {
    quoteId: "quote", termsHash: "terms", disclosureHash: "disclosure", challenge: "challenge", disclosure: "EXACT TEXT",
    travelCents: 500, addonsCents: 100, totalCents: 600, currency: "EUR", paymentMethod: "ONLINE",
  });
  expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ key: "same-session", acceptance: {
    quoteId: "quote", termsHash: "terms", disclosureHash: "disclosure", challenge: "challenge", action: "ACCEPT_SESSION_DUES",
  } }) }));
});
it.each([402, 403, 404, 409, 503])("HTTP %i has an explicit failure state", (status) => {
  const text = packageLifecycleError(new BooklyApiError({ message: "server", status }));
  expect(text).not.toBe("server"); expect(text).not.toContain("committed");
});
it("activation denial disables all actions and never sends a booking", async () => {
  await render(<FirstClassLifecycleControls pkg={{ ...owned, actionsAvailable: false }} />);
  expect(host.textContent).toContain("Book a remaining session");
  expect(host.querySelector("fieldset")?.disabled).toBe(true); expect(apiRequest).not.toHaveBeenCalled();
});
it("Calendar's destination keeps fresh management completion disabled when lifecycle activation is unavailable", async () => {
  await render(<FirstClassSessionActions businessId="business" progressId="progress"
    bookingId="booking" enabled={false} management />);
  expect(host.querySelector("fieldset")?.disabled).toBe(true);
  const submit = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Submit package action");
  expect(submit?.disabled).toBe(true);
  expect(apiRequest).not.toHaveBeenCalled();
});
it.each(["NOT_ESTABLISHED", undefined] as const)("purchase completion %s never exposes usable controls", async (purchaseCompletion) => {
  await render(<FirstClassLifecycleControls pkg={{ ...owned, purchaseCompletion, actionsAvailable: true }} />);
  expect(host.querySelector("fieldset")?.disabled).toBe(true); expect(apiRequest).not.toHaveBeenCalled();
});
it.each([{ state: "UNRESOLVED" as const }, { state: "PAYMENT_PENDING" as const, providerStatus: "requires_action" }])("pending state remains unconfirmed", async (result) => {
  await render(<LifecycleResult result={result} />);
  expect(host.textContent).toContain("unconfirmed"); expect(host.textContent).not.toContain("Server committed");
});
it("only an explicit committed server response renders committed", async () => {
  await render(<LifecycleResult result={{ state: "COMMITTED", status: "UPCOMING", bookingId: "booking", committedAt: "2030-08-19T10:00:00Z" }} />);
  expect(host.textContent).toContain("Server committed: UPCOMING");
});
it("a lost cancellation response freezes the original key for retry", async () => {
  vi.mocked(apiRequest).mockRejectedValue(new BooklyApiError({ message: "offline" }));
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />);
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  const submit = () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("package action") || b.textContent?.includes("Retry identical"))!;
  await act(async () => submit().click());
  const first = vi.mocked(apiRequest).mock.calls[0]?.[0];
  await act(async () => submit().click());
  expect(apiRequest).toHaveBeenCalledTimes(2); expect(vi.mocked(apiRequest).mock.calls[1]?.[0]).toEqual(first);
  expect(host.textContent).not.toContain("Server committed"); expect(host.querySelector("fieldset")?.disabled).toBe(true);
});
it("Customer selects server staff/slot, accepts exact dues and confirms only the committed response", async () => {
  const pkg = { ...owned, actionsAvailable: true, status: "RECORDED", validity: { mode: "FOREVER" as const, expiresAt: null, timezone: null },
    purchaseFinancials: { ...owned.purchaseFinancials!, balanceSettled: true },
    items: owned.items.map((i) => ({ ...i, remaining: 1, travelCities: [] })) };
  vi.mocked(apiRequest)
    .mockResolvedValueOnce({ timezone: "UTC", providers: [{ id: "staff", name: "Alex" }], addons: [],
      days: [{ date: "2030-08-21", isOpen: true, slots: [{ startAt: "2030-08-21T10:00:00Z", endAt: "2030-08-21T11:00:00Z", eligibleStaffMembershipIds: ["staff"] }] }] })
    .mockResolvedValueOnce({ quoteId: "quote", challenge: "challenge", termsHash: "terms", disclosureHash: "disclosure", disclosure: "Exact separate fee disclosure", travelCents: 0, addonsCents: 0, totalCents: 0, paymentMethod: "VENUE", currency: "EUR" })
    .mockResolvedValueOnce({ state: "ACCEPTED" })
    .mockResolvedValueOnce({ state: "COMMITTED", status: "UPCOMING", bookingId: "created", committedAt: "2030-08-19T10:00:00Z" });
  await render(<FirstClassLifecycleControls pkg={pkg} />);
  async function change(label: string, value: string) {
    await act(async () => {
      const field = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
      const prototype = field.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("change", { bubbles: true }));
      if (field.tagName === "INPUT") field.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function click(text: string) { await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === text)!.click()); }
  await change("Purchased service", pkg.items[0]!.id); await change("Session date", "2030-08-21");
  await click("Find professionals and times"); await change("Professional", "staff"); await change("Appointment time", "2030-08-21T10:00:00Z");
  await click("Review exact session terms");
  expect(host.querySelector("pre")?.textContent).toBe("Exact separate fee disclosure");
  expect(host.textContent).not.toContain("Server committed");
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await click("Accept session terms"); expect(host.textContent).not.toContain("Server committed");
  await click("Confirm session booking"); expect(host.textContent).toContain("Server committed: UPCOMING");
  const quoteRequest = vi.mocked(apiRequest).mock.calls[1]?.[0];
  const bookingRequest = vi.mocked(apiRequest).mock.calls[3]?.[0];
  expect(bookingRequest?.data).toEqual(quoteRequest?.data);
});

it("P4E committed Package actions invalidate Customer list/detail and reschedule choices", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const detailKey = bookingKeys.customerDetail("booking");
  const listKey = bookingKeys.customerList({});
  const slotsKey = [...bookingKeys.rescheduleAvailability, "customer", "business", "booking"];
  for (const key of [detailKey, listKey, slotsKey]) client.setQueryData(key, { status: "UPCOMING" });
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "COMMITTED", status: "CANCELLED_BY_CUSTOMER", committedAt: "2030-08-19T10:00:00Z" });
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />, client);
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Submit package action")!.click());
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Server committed: CANCELLED_BY_CUSTOMER");
  for (const key of [detailKey, listKey, slotsKey]) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});

it("P4E redemption preserves apartment destination fields in selection and exact dues quote", async () => {
  const pkg = { ...owned, actionsAvailable: true, status: "RECORDED",
    validity: { mode: "FOREVER" as const, expiresAt: null, timezone: null },
    purchaseFinancials: { ...owned.purchaseFinancials!, balanceSettled: true },
    items: owned.items.map((item) => ({ ...item, remaining: 1, travelCities: [{ city: "Larnaca", feeCents: 500 }] })) };
  vi.mocked(apiRequest).mockResolvedValueOnce({ timezone: "Europe/Nicosia", providers: [{ id: "staff", name: "Alex" }], addons: [],
    days: [{ date: "2030-08-21", isOpen: true, slots: [{ startAt: "2030-08-21T10:00:00Z", endAt: "2030-08-21T11:00:00Z", eligibleStaffMembershipIds: ["staff"] }] }] })
    .mockResolvedValueOnce({ quoteId: "quote", challenge: "challenge", termsHash: "terms", disclosureHash: "disclosure",
      disclosure: "Exact apartment destination and dues", travelCents: 500, addonsCents: 0, totalCents: 500, paymentMethod: "VENUE", currency: "EUR" });
  await render(<FirstClassLifecycleControls pkg={pkg} />);
  async function change(label: string, value: string) {
    await act(async () => {
      const field = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
      Object.getOwnPropertyDescriptor(field.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(field, value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  await change("Purchased service", pkg.items[0]!.id);
  await change("Session date", "2030-08-21");
  for (const [name, value] of Object.entries({ city: "Larnaca", area: "Center", streetName: "Main", streetNumber: "4", floorUnit: "3", aptRoom: "12" }))
    await change(`Session travel ${name}`, value);
  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Find professionals and times")!.click());
  expect(vi.mocked(apiRequest).mock.calls[0]?.[0].data.travelAddress).toMatchObject({ floorUnit: "3", aptRoom: "12" });
  await change("Professional", "staff");
  await change("Appointment time", "2030-08-21T10:00:00Z");
  await act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Review exact session terms")!.click());
  expect(vi.mocked(apiRequest).mock.calls[1]?.[0].data.dues.travelAddress).toMatchObject({ floorUnit: "3", aptRoom: "12" });
  expect(host.textContent).not.toContain("Server committed");
});

// P4K-3: a redemption dispatched before a reload or lost response is recovered read-only.
const retained = (overrides: Record<string, unknown> = {}) => {
  const request = { businessId: owned.businessId, packageProgressId: owned.id, key: "p4k3-original-key", packageItemId: "item",
    staffMembershipId: "staff", startAt: "2030-08-21T10:00:00Z", dues: { addonIds: [], paymentMethod: "VENUE" } };
  sessionStorage.setItem(`bookly:package-session:v1:p2d-customer:${owned.id}`, JSON.stringify({ request,
    quote: { quoteId: "q", termsHash: "t", disclosureHash: "d", challenge: "c", disclosure: "EXACT", travelCents: 0, addonsCents: 0,
      totalCents: 0, currency: "EUR", paymentMethod: "VENUE" }, accepted: true, dispatched: true, ...overrides }));
  return request;
};
const usable = { ...owned, actionsAvailable: true, purchaseCompletion: "VERIFIED" as const };
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
it("P4K-3 reload recovers a committed redemption with one read-only status call and refreshes views", async () => {
  const request = retained();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const listKey = bookingKeys.customerList({});
  client.setQueryData(listKey, { status: "UPCOMING" }); client.setQueryData(["packageViews", "owned"], {});
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "COMMITTED", status: "UPCOMING", bookingId: "booking-1", committedAt: "2030-08-19T10:00:00Z" });
  await render(<FirstClassLifecycleControls pkg={usable} />, client); await settle();
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(apiRequest).toHaveBeenCalledWith({ method: "POST", url: "/package-views/actions/session-status", data: request });
  expect(host.textContent).toContain("Server committed: UPCOMING · Booking booking-1");
  expect(host.textContent).not.toContain("Operation unresolved");
  expect([...host.querySelectorAll("button")].some((b) => b.textContent === "Retry same booking request")).toBe(false);
  expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
  expect(client.getQueryState(["packageViews", "owned"])?.isInvalidated).toBe(true);
  expect(vi.mocked(apiRequest).mock.calls.some(([call]) => String((call as { url: string }).url).endsWith("/redeem"))).toBe(false);
});
it.each([
  ["UNRESOLVED", () => vi.mocked(apiRequest).mockResolvedValueOnce({ state: "UNRESOLVED" })],
  ["404", () => vi.mocked(apiRequest).mockRejectedValueOnce(new BooklyApiError({ message: "missing", status: 404 }))],
  ["network loss", () => vi.mocked(apiRequest).mockRejectedValueOnce(new BooklyApiError({ message: "offline" }))],
] as const)("P4K-3 %s status keeps the original request unresolved and never redeems automatically", async (_label, arrange) => {
  retained(); arrange();
  await render(<FirstClassLifecycleControls pkg={usable} />); await settle();
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain("Operation unresolved");
  const retry = [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry same booking request");
  expect(retry?.disabled).toBe(false);
  expect(vi.mocked(apiRequest).mock.calls.some(([call]) => String((call as { url: string }).url).endsWith("/redeem"))).toBe(false);
});
it("P4K-3 no status call for an undispatched request or a different Package's stored request", async () => {
  retained({ dispatched: false });
  await render(<FirstClassLifecycleControls pkg={usable} />); await settle();
  expect(apiRequest).not.toHaveBeenCalled();
  await act(async () => root.unmount()); root = createRoot(host);
  sessionStorage.clear();
  sessionStorage.setItem(`bookly:package-session:v1:p2d-customer:${owned.id}`, JSON.stringify({
    request: { businessId: owned.businessId, packageProgressId: "another-progress", key: "foreign" }, dispatched: true }));
  await render(<FirstClassLifecycleControls pkg={usable} />); await settle();
  expect(apiRequest).not.toHaveBeenCalled();
});

// P4K-4: a dispatched cancel/reschedule/expiry is recovered read-only after a reload.
const actionKey = (bookingId: string | undefined, management = false) => `bookly:package-action:v1:p2d-customer:business:progress:${bookingId ?? "expiry"}:${management}`;
const savedAction = (action: "cancel" | "reschedule" | "expire", bookingId?: string, management = false) => {
  const input = { businessId: "business", packageProgressId: "progress", key: `p4k4-${action}`,
    ...(bookingId ? { bookingId } : {}), ...(action === "reschedule" ? { startAt: "2030-08-22T10:00:00Z" } : {}) };
  sessionStorage.setItem(actionKey(bookingId, management), JSON.stringify({ action, input }));
  return input;
};
const urls = () => vi.mocked(apiRequest).mock.calls.map(([call]) => String((call as { url: string }).url));
it.each([["cancel", "booking"], ["reschedule", "booking"], ["expire", undefined]] as const)(
  "P4K-4 reload recovers a committed %s with one read-only status call and refreshes views", async (action, bookingId) => {
    const input = savedAction(action, bookingId);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listKey = bookingKeys.customerList({}); client.setQueryData(listKey, { status: "UPCOMING" });
    client.setQueryData(["packageViews", "owned"], {});
    vi.mocked(apiRequest).mockResolvedValueOnce({ state: "COMMITTED", status: "CANCELLED_BY_CUSTOMER", bookingId, committedAt: "2030-08-19T10:00:00Z" });
    await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId={bookingId} enabled />, client); await settle();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith({ method: "POST", url: `/package-views/actions/${action}-status`, data: input });
    expect(host.textContent).toContain("Server committed: CANCELLED_BY_CUSTOMER");
    expect(host.textContent).not.toContain("Operation unresolved");
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(["packageViews", "owned"])?.isInvalidated).toBe(true);
    expect(urls().some((url) => url.endsWith(`/${action}`))).toBe(false);
  });
it.each([
  ["UNRESOLVED", () => vi.mocked(apiRequest).mockResolvedValueOnce({ state: "UNRESOLVED" })],
  ["404", () => vi.mocked(apiRequest).mockRejectedValueOnce(new BooklyApiError({ message: "missing", status: 404 }))],
  ["network loss", () => vi.mocked(apiRequest).mockRejectedValueOnce(new BooklyApiError({ message: "offline" }))],
] as const)("P4K-4 %s keeps the original action unresolved with the identical retry and no automatic mutation", async (_label, arrange) => {
  const input = savedAction("cancel", "booking"); arrange();
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />); await settle();
  expect(urls()).toEqual(["/package-views/actions/cancel-status"]);
  expect(host.textContent).toContain("Operation unresolved");
  const retry = [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry identical action");
  expect(retry?.disabled).toBe(false);
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "COMMITTED", status: "CANCELLED_BY_CUSTOMER", committedAt: "2030-08-19T10:00:00Z" });
  await act(async () => retry!.click());
  expect(apiRequest).toHaveBeenLastCalledWith({ method: "POST", url: "/package-views/actions/cancel", data: input });
});
it("P4K-4/5 management views check their own saved key once; no call for a different Package's request or no saved action", async () => {
  const input = savedAction("cancel", "booking", true);
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "UNRESOLVED" });
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled management />); await settle();
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(apiRequest).toHaveBeenCalledWith({ method: "POST", url: "/package-views/actions/cancel-status", data: input });
  expect(host.textContent).toContain("Operation unresolved");
  vi.mocked(apiRequest).mockReset();
  await act(async () => root.unmount()); root = createRoot(host); sessionStorage.clear();
  sessionStorage.setItem(actionKey("booking"), JSON.stringify({ action: "cancel", input: { businessId: "business", packageProgressId: "another", key: "foreign" } }));
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />); await settle();
  await act(async () => root.unmount()); root = createRoot(host); sessionStorage.clear();
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />); await settle();
  expect(apiRequest).not.toHaveBeenCalled();
});

// P4K-5: management recovery, and retiring only server-proven committed requests.
const savedManagement = (action: "complete" | "no-show" | "settlement") => {
  const input = { businessId: "business", packageProgressId: "progress", key: `p4k5-${action}`, bookingId: "booking",
    ...(action === "settlement" ? { venuePayment: { settlement: "FULL" } } : {}) };
  sessionStorage.setItem(actionKey("booking", true), JSON.stringify({ action, input }));
  return input;
};
it.each(["complete", "no-show", "settlement"] as const)("P4K-5 management reload recovers a committed %s with one status call and no mutation", async (action) => {
  const input = savedManagement(action);
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "COMMITTED", status: action === "complete" ? "COMPLETED" : "NO_SHOW_WAIVED", bookingId: "booking", committedAt: "2030-08-19T10:00:00Z" });
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled management />); await settle();
  expect(urls()).toEqual([`/package-views/actions/${action}-status`]);
  expect(apiRequest).toHaveBeenCalledWith({ method: "POST", url: `/package-views/actions/${action}-status`, data: input });
  expect(host.textContent).toContain("Server committed");
  // Management controls stay mounted; the committed request is kept for display, not retired.
  expect(sessionStorage.getItem(actionKey("booking", true))).not.toBeNull();
});
it("P4K-5 an unproven settlement stays unresolved with only the identical manual retry", async () => {
  const input = savedManagement("settlement");
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "UNRESOLVED" });
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled management />); await settle();
  expect(host.textContent).toContain("Operation unresolved"); expect(host.textContent).not.toContain("Server committed");
  expect(urls()).toEqual(["/package-views/actions/settlement-status"]);
  const retry = [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry identical action");
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "UNRESOLVED" });
  await act(async () => retry!.click());
  expect(apiRequest).toHaveBeenLastCalledWith({ method: "POST", url: "/package-views/actions/settlement", data: input });
});
it("P4K-5 a committed Customer cancellation retires its saved request; an unresolved one keeps it", async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "COMMITTED", status: "CANCELLED_BY_CUSTOMER", committedAt: "2030-08-19T10:00:00Z" });
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />);
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Submit package action")!.click());
  expect(host.textContent).toContain("Server committed: CANCELLED_BY_CUSTOMER");
  expect(sessionStorage.getItem(actionKey("booking"))).toBeNull();
  await act(async () => root.unmount()); root = createRoot(host); sessionStorage.clear(); vi.mocked(apiRequest).mockReset();
  vi.mocked(apiRequest).mockRejectedValueOnce(new BooklyApiError({ message: "offline" }));
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />);
  await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Submit package action")!.click());
  expect(sessionStorage.getItem(actionKey("booking"))).not.toBeNull();
});
it("P4K-5 recovery-only control: proven COMMITTED retires and notifies; UNRESOLVED stays visible", async () => {
  savedAction("cancel", "booking");
  const retired = vi.fn();
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "COMMITTED", status: "CANCELLED_BY_CUSTOMER", committedAt: "2030-08-19T10:00:00Z" });
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled onRetired={retired} />); await settle();
  expect(retired).toHaveBeenCalledTimes(1);
  expect(sessionStorage.getItem(actionKey("booking"))).toBeNull();
  expect(urls()).toEqual(["/package-views/actions/cancel-status"]);
  await act(async () => root.unmount()); root = createRoot(host); vi.mocked(apiRequest).mockReset();
  savedAction("cancel", "booking"); const kept = vi.fn();
  vi.mocked(apiRequest).mockResolvedValueOnce({ state: "UNRESOLVED" });
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled onRetired={kept} />); await settle();
  expect(kept).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(actionKey("booking"))).not.toBeNull();
  expect(host.textContent).toContain("Operation unresolved");
});
it("P4K-5 recovery never loops: re-renders and invalidations cause no further status calls", async () => {
  savedAction("reschedule", "booking");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(apiRequest).mockResolvedValue({ state: "COMMITTED", status: "UPCOMING", bookingId: "booking", committedAt: "2030-08-19T10:00:00Z" });
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />, client); await settle();
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled={false} />, client); await settle();
  await render(<FirstClassSessionActions businessId="business" progressId="progress" bookingId="booking" enabled />, client); await settle();
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
