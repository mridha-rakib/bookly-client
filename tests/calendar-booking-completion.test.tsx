import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CalendarBookingCompletion from "@/components/dashboard/CalendarBookingCompletion";
import { bookingsApi, type BookingDetail } from "@/lib/api/bookings";
import { bookingKeys } from "@/lib/bookings/hooks";
import { BooklyApiError } from "@/lib/api/client";

const notice = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast: notice }));

const businessId = "business", bookingId = "booking";
let host: HTMLDivElement, root: Root, cache: QueryClient;
const close = vi.fn(), view = vi.fn();
const row = (balance = 8000, firstClass = false, legacy = false): BookingDetail => ({
  id: bookingId, businessId, status: "UPCOMING",
  serviceLines: [{ ...(firstClass ? { packageItemId: "item" } : {}),
    ...(firstClass || legacy ? { packageProgressId: "progress" } : {}) }],
  packageSessions: [], financials: { balanceDueCents: balance, currency: "EUR" },
  paymentSummary: { outstandingVenueBalanceCents: balance },
} as BookingDetail);
const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); }); };
const button = (text: string) => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === text)!;
const click = async (text: string) => { await act(async () => button(text).click()); await flush(); };
const mount = async () => {
  await act(async () => root.render(createElement(QueryClientProvider, { client: cache },
    createElement(CalendarBookingCompletion, { businessId, bookingId, onClose: close, onViewBooking: view }))));
  await flush();
};
const choose = async (text: string) => {
  const dropdown = Array.from(host.querySelectorAll("div"))
    .find((element) => element.className.includes("box-border") && element.textContent?.startsWith("Yes - customer paid"))!;
  await act(async () => dropdown.click());
  await click(text);
};
const amount = async (value: string) => {
  const input = host.querySelector<HTMLInputElement>('input[type="number"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // Even under a retrying application default, payment-bearing mutations must not auto-retry.
  cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 2, retryDelay: 0 } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  close.mockReset(); view.mockReset(); notice.success.mockReset();
  vi.spyOn(bookingsApi, "getDetailForBusiness").mockResolvedValue(row());
  vi.spyOn(bookingsApi, "completeBooking").mockResolvedValue({ ...row(), status: "COMPLETED" });
});
afterEach(async () => { await act(async () => root.unmount()); cache.clear(); host.remove(); vi.restoreAllMocks(); });

it("waits for a fresh scoped detail read even when the query cache holds a summary-era balance", async () => {
  cache.setQueryData(bookingKeys.detail(businessId, bookingId), row(111));
  let resolve!: (value: BookingDetail) => void;
  vi.mocked(bookingsApi.getDetailForBusiness).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  await mount();
  expect(host.textContent).toContain("Loading current Booking details");
  expect(button("Yes")).toBeUndefined();
  expect(bookingsApi.getDetailForBusiness).toHaveBeenCalledWith(businessId, bookingId);
  await act(async () => resolve(row(8000))); await flush();
  expect(host.textContent).toContain("€80.00");
  expect(host.textContent).not.toContain("€1.11");
  await click("Yes");
  expect(bookingsApi.completeBooking).toHaveBeenCalledWith(businessId, bookingId, { settlement: "FULL", note: undefined }, undefined, 8000);
});

it.each([false, true])("ordinary/legacy=%s completes with the existing FULL and invalidation contract", async (legacy) => {
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValue(row(8000, false, legacy));
  const invalidation = vi.spyOn(cache, "invalidateQueries");
  await mount(); await click("Yes");
  expect(bookingsApi.completeBooking).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1); expect(notice.success).toHaveBeenCalledTimes(1);
  for (const key of [bookingKeys.detail(businessId, bookingId), bookingKeys.lists(businessId),
    bookingKeys.calendars(businessId), bookingKeys.rescheduleAvailability]) {
    expect(invalidation).toHaveBeenCalledWith({ queryKey: key });
  }
});

it("First-Class detail fallback offers the existing management route without ordinary completion", async () => {
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValue(row(8000, true));
  await mount();
  expect(button("Yes")).toBeUndefined();
  await click("Manage package appointment");
  expect(view).toHaveBeenCalledWith(bookingId);
  expect(bookingsApi.completeBooking).not.toHaveBeenCalled();
});

it("unknown balance is unavailable rather than zero; failed refresh never enables confirmation", async () => {
  const unknown = row(); delete (unknown as Partial<BookingDetail>).paymentSummary;
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValueOnce(unknown).mockRejectedValueOnce(Error("offline"));
  await mount(); expect(host.textContent).toContain("balance is unavailable");
  expect(button("Yes")).toBeUndefined(); await click("Reload Booking details");
  expect(host.textContent).toContain("details are unavailable"); expect(button("Yes")).toBeUndefined();
  expect(bookingsApi.completeBooking).not.toHaveBeenCalled();
});

it("failed initial detail read offers explicit reload and never uses cached money", async () => {
  cache.setQueryData(bookingKeys.detail(businessId, bookingId), row(111));
  vi.mocked(bookingsApi.getDetailForBusiness).mockRejectedValueOnce(Error("denied"));
  await mount(); expect(button("Yes")).toBeUndefined();
  await click("Reload Booking details"); expect(host.textContent).toContain("€80.00");
});

it.each(["foreign-business", "foreign-booking"])("a mismatched detail identity %s never enables payment confirmation", async (identity) => {
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValue({ ...row(),
    ...(identity === "foreign-business" ? { businessId: identity } : { id: identity }) });
  await mount(); expect(button("Yes")).toBeUndefined();
  expect(bookingsApi.completeBooking).not.toHaveBeenCalled();
});

it("zero is a known balance and FULL never invents a partial amount", async () => {
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValue(row(0));
  await mount(); expect(host.textContent).toContain("€0.00"); await click("Yes");
  expect(bookingsApi.completeBooking).toHaveBeenCalledWith(businessId, bookingId, { settlement: "FULL", note: undefined }, undefined, 0);
});

it("NOT_PAID sends no amount", async () => {
  await mount(); await choose("No - customer has not paid remaining balance"); await click("Yes");
  expect(bookingsApi.completeBooking).toHaveBeenCalledWith(businessId, bookingId, { settlement: "NOT_PAID", note: undefined }, undefined, 8000);
});

it("PARTIAL keeps exact cents and refuses the full balance and fractional cents", async () => {
  await mount(); await choose("Yes - customer paid other amount");
  await amount("80.00"); await click("Yes"); expect(bookingsApi.completeBooking).not.toHaveBeenCalled();
  await amount("12.345"); await click("Yes"); expect(bookingsApi.completeBooking).not.toHaveBeenCalled();
  await amount("12.34"); await click("Yes");
  expect(bookingsApi.completeBooking).toHaveBeenCalledWith(businessId, bookingId,
    { settlement: "PARTIAL", amountCents: 1234, note: undefined }, undefined, 8000);
});

it("sends the displayed summary value rather than substituting the original financial balance", async () => {
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValue({ ...row(8000),
    paymentSummary: { ...row().paymentSummary, outstandingVenueBalanceCents: 6000 } });
  await mount(); expect(host.textContent).toContain("€60.00"); await click("Yes");
  expect(bookingsApi.completeBooking).toHaveBeenCalledWith(businessId, bookingId,
    { settlement: "FULL", note: undefined }, undefined, 6000);
});

it("does not treat original balance as outstanding or overwrite an existing payment attestation", async () => {
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValue({ ...row(8000),
    paymentSummary: { ...row().paymentSummary, outstandingVenueBalanceCents: 6000 },
    completionPayment: { paid: true, amountCents: 2000, recordedAt: "2030-01-01T00:00:00Z" } });
  await mount(); expect(button("Yes")).toBeUndefined();
  expect(host.textContent).toContain("already has a venue-payment record");
  expect(bookingsApi.completeBooking).not.toHaveBeenCalled();
});

it("pending confirmation disables duplicates, including two clicks before a render", async () => {
  let resolve!: (value: BookingDetail) => void;
  vi.mocked(bookingsApi.completeBooking).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  await mount();
  await act(async () => { button("Yes").click(); button("Yes").click(); }); await flush();
  expect(button("Yes").disabled).toBe(true); expect(button("Cancel").disabled).toBe(true);
  expect(bookingsApi.completeBooking).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ ...row(), status: "COMPLETED" })); await flush();
});

it.each([400, 409, undefined])("stale/conflicting/lost response %s requires manual read and never auto-retries", async (status) => {
  vi.mocked(bookingsApi.completeBooking).mockRejectedValueOnce(new BooklyApiError({ message: "Unconfirmed", status }));
  await mount(); await click("Yes"); await flush();
  expect(bookingsApi.completeBooking).toHaveBeenCalledTimes(1);
  expect(notice.success).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  expect(host.textContent).toContain("Reload Booking details"); expect(button("Yes")).toBeUndefined();
  // Lost response may already have committed. Read it; never resend a financial confirmation.
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValue({ ...row(), status: "COMPLETED" });
  await click("Reload Booking details");
  expect(host.textContent).toContain("COMPLETED"); expect(button("Yes")).toBeUndefined();
  expect(bookingsApi.completeBooking).toHaveBeenCalledTimes(1);
});

it("a changed balance reload discards the old payment answer and requires new confirmation", async () => {
  vi.mocked(bookingsApi.completeBooking).mockRejectedValueOnce(new BooklyApiError({ message: "Changed", status: 409 }));
  await mount(); await choose("Yes - customer paid other amount"); await amount("50"); await click("Yes");
  vi.mocked(bookingsApi.getDetailForBusiness).mockResolvedValue(row(4000));
  await click("Reload Booking details"); expect(host.textContent).toContain("€40.00");
  expect(host.querySelector('input[type="number"]')).toBeNull();
  expect(bookingsApi.completeBooking).toHaveBeenCalledTimes(1);
});
