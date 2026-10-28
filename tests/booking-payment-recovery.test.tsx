import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import BookingPaymentRecovery from "@/components/bookings/BookingPaymentRecovery";
import { bookingsApi, type BookingPaymentStatus, type CreateBookingInput, type BookingRecoveryInboxItem } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/store";
import { getStripe } from "@/lib/payments/stripe-client";
import { BooklyApiError } from "@/lib/api/client";
import { toUserMessage } from "@/lib/auth/messages";
import { BOOKING_CONTINUATIONS_CHANGED, readBookingContinuations, saveBookingContinuation } from "@/lib/bookings/payment-continuation";
import { BOOKING_REQUEST_BODY_RETENTION_MS, BOOKING_POINTER_RETENTION_MS, readBookingRecoveryPointers } from "@/lib/bookings/payment-continuation";

vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: vi.fn() }));
const customerId = "1".repeat(24), businessId = "2".repeat(24);
const input: CreateBookingInput = { idempotencyKey: "original-operation", startAt: "2030-08-20T09:00:00.000Z",
  serviceLines: [{ serviceId: "3".repeat(24), staffMembershipId: "4".repeat(24), addonIds: [], pricingInput: {} }] };
let root: Root, host: HTMLDivElement;
const value = (state: BookingPaymentStatus["state"], extra: Partial<BookingPaymentStatus> = {}): BookingPaymentStatus =>
  ({ state, businessId, idempotencyKey: input.idempotencyKey, ...extra });
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 15)); }); };
const mount = async () => {
  await act(async () => root.render(createElement(StrictMode, null, createElement(BookingPaymentRecovery)))); await flush();
};
const click = async (text: string) => {
  const button = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes(text));
  expect(button).toBeTruthy(); await act(async () => button!.click()); await flush();
};
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear();
  useAuthStore.setState({ status: "authenticated", isInitializing: false, cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
    user: { id: customerId, email: "buyer@example.test", role: "CUSTOMER", status: "ACTIVE" } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.spyOn(bookingsApi, "getCustomerPaymentStatus").mockResolvedValue(value("UNRESOLVED"));
  vi.spyOn(bookingsApi, "finalizeCustomerBooking").mockResolvedValue({ id: "5".repeat(24) } as never);
  vi.spyOn(bookingsApi, "getCustomerRecoveryInbox").mockResolvedValue({ requests: [], resolved: [], hasMore: false, scanned: 0 });
  vi.mocked(getStripe).mockReset();
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

it("refresh and reopening 3DS restore only the request; no payment or authentication runs automatically", async () => {
  saveBookingContinuation(customerId, businessId, input);
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("AUTHENTICATION_REQUIRED", { clientSecret: "ephemeral-secret" }));
  await mount();
  expect(host.textContent).toContain("bank needs additional authentication");
  await act(async () => root.unmount()); root = createRoot(host); await mount();
  expect(bookingsApi.finalizeCustomerBooking).not.toHaveBeenCalled(); expect(getStripe).not.toHaveBeenCalled();
  expect(readBookingContinuations(customerId)[0]?.input).toEqual(input);
  expect(JSON.stringify(localStorage)).not.toContain("ephemeral-secret");
  expect(JSON.stringify(localStorage)).not.toContain("clientSecret");
});
it("explicit authentication replays the identical key, then waits for authoritative Booking completion", async () => {
  saveBookingContinuation(customerId, businessId, input);
  const confirm = vi.fn(async () => ({ paymentIntent: { status: "succeeded" } }));
  vi.mocked(getStripe).mockResolvedValue({ confirmCardPayment: confirm } as never);
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("AUTHENTICATION_REQUIRED", { clientSecret: "ephemeral-secret" }));
  await mount();
  vi.mocked(bookingsApi.finalizeCustomerBooking).mockImplementation(async () => {
    vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("FINALIZATION_PENDING"));
    return { id: "5".repeat(24) } as never;
  });
  await click("Complete bank authentication");
  expect(confirm).toHaveBeenCalledWith("ephemeral-secret");
  expect(bookingsApi.finalizeCustomerBooking).toHaveBeenCalledExactlyOnceWith(businessId, input);
  expect(host.textContent).toContain("Payment is confirmed; Booking finalization is still pending");
  expect(host.textContent).not.toContain("Booking is confirmed by Bookly");
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("COMMITTED", { bookingId: "5".repeat(24) }));
  await click("Check original Booking status");
  expect(host.textContent).toContain("Booking is confirmed by Bookly");
  expect(host.querySelector('a[href*="/customer/bookings/view?id="]')).toBeTruthy();
  expect(bookingsApi.finalizeCustomerBooking).toHaveBeenCalledTimes(1);
});
it("lost finalize response is resolved by a read, never a replacement request", async () => {
  saveBookingContinuation(customerId, businessId, input); await mount();
  vi.mocked(bookingsApi.finalizeCustomerBooking).mockImplementation(async () => {
    vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("COMMITTED", { bookingId: "5".repeat(24) }));
    throw Error("lost response");
  });
  await click("Continue original Booking");
  expect(host.textContent).toContain("Booking is confirmed by Bookly");
  expect(bookingsApi.finalizeCustomerBooking).toHaveBeenCalledExactlyOnceWith(businessId, input);
});
it("retrying failed authentication uses the same provider secret and original request", async () => {
  saveBookingContinuation(customerId, businessId, input);
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("PAYMENT_FAILED", { clientSecret: "same-original-secret" }));
  const confirm = vi.fn(async () => ({})); vi.mocked(getStripe).mockResolvedValue({ confirmCardPayment: confirm } as never);
  await mount(); await click("Retry original payment");
  expect(confirm).toHaveBeenCalledExactlyOnceWith("same-original-secret");
  expect(bookingsApi.finalizeCustomerBooking).toHaveBeenCalledExactlyOnceWith(businessId, input);
  expect(host.textContent).not.toContain("Booking is confirmed by Bookly");
});
it.each(["PAYMENT_PROCESSING", "UNRESOLVED", "FINALIZATION_PENDING", "PAYMENT_FAILED"] as const)("%s never renders Booking success", async (state) => {
  saveBookingContinuation(customerId, businessId, input);
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value(state)); await mount();
  expect(host.textContent).not.toContain("Booking is confirmed by Bookly");
  expect(host.querySelector('a[href*="/customer/bookings/view?id="]')).toBeNull();
  expect(host.textContent).not.toContain("Dismiss saved request");
});
it("pending refund is not settled; only a fresh settled response allows dismissal", async () => {
  saveBookingContinuation(customerId, businessId, input);
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("REFUND_PENDING")); await mount();
  expect(host.textContent).toContain("a refund has not been confirmed");
  expect(host.textContent).not.toContain("Continue original Booking");
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("REFUNDED", { canDismiss: true }));
  await click("Check original Booking status"); await click("Dismiss saved request");
  expect(readBookingContinuations(customerId)).toEqual([]); expect(bookingsApi.finalizeCustomerBooking).not.toHaveBeenCalled();
});
it("Business suspension leaves status checks available and prevents starting bank authentication", async () => {
  saveBookingContinuation(customerId, businessId, input);
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("AUTHENTICATION_REQUIRED",
    { canResume: false, resumeBlockedReason: "BUSINESS_UNAVAILABLE" }));
  await mount();
  expect(host.textContent).toContain("venue is not currently accepting bookings");
  expect(host.textContent).not.toContain("Complete bank authentication");
  expect(host.textContent).toContain("Check original Booking status");
  expect(getStripe).not.toHaveBeenCalled(); expect(bookingsApi.finalizeCustomerBooking).not.toHaveBeenCalled();
});
it("a saved request discovered from another tab performs only an owned status check", async () => {
  await mount(); expect(bookingsApi.getCustomerPaymentStatus).not.toHaveBeenCalled();
  await act(async () => { saveBookingContinuation(customerId, businessId, input); window.dispatchEvent(new StorageEvent("storage")); }); await flush();
  expect(bookingsApi.getCustomerPaymentStatus).toHaveBeenCalledWith(businessId, input.idempotencyKey);
  expect(bookingsApi.finalizeCustomerBooking).not.toHaveBeenCalled();
});
it("another Customer cannot discover the saved operation or receive a late result", async () => {
  saveBookingContinuation(customerId, businessId, input);
  let resolve!: (v: BookingPaymentStatus) => void;
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockImplementation(() => new Promise((r) => { resolve = r; }));
  await mount();
  await act(async () => useAuthStore.setState({ cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
    user: { id: "9".repeat(24), role: "CUSTOMER", status: "ACTIVE", email: "other@example.test" } }));
  await act(async () => resolve(value("COMMITTED", { bookingId: "5".repeat(24) }))); await flush();
  expect(host.textContent).not.toContain(input.idempotencyKey); expect(host.textContent).not.toContain("confirmed");
});
it("immutable request persistence rejects changed intent, another fresh operation and secret-bearing records", () => {
  saveBookingContinuation(customerId, businessId, input);
  expect(() => saveBookingContinuation(customerId, businessId, { ...input, notes: "different intent" })).toThrow("original request");
  expect(() => saveBookingContinuation(customerId, businessId, { ...input, idempotencyKey: "replacement" })).toThrow("saved Booking request");
  expect(() => saveBookingContinuation(customerId, businessId, { ...input, clientSecret: "must-not-save" } as never)).toThrow();
  expect(JSON.stringify(localStorage)).not.toContain("must-not-save");
  expect(readBookingContinuations("9".repeat(24))).toEqual([]);
  window.dispatchEvent(new Event(BOOKING_CONTINUATIONS_CHANGED));
});
it("a capacity rejection does not claim an automatic or settled refund", () => {
  const message = toUserMessage(new BooklyApiError({ message: "slot", status: 409, code: "BOOKING_SLOT_RESERVATION_CONFLICT" }));
  expect(message).toContain("Booking is not confirmed"); expect(message).toContain("original payment or refund status");
  expect(message).not.toContain("automatically refunded");
});
const inboxItem = (state: BookingPaymentStatus["state"], extra: Partial<BookingPaymentStatus> = {}): BookingRecoveryInboxItem =>
  ({ businessId, businessName: "Original venue", idempotencyKey: input.idempotencyKey,
    status: value(state, { canResume: false, ...extra }), nextAction: "CHECK_STATUS", replayAvailable: false });
const mountInbox = async () => {
  await act(async () => root.render(createElement(StrictMode, null, createElement(BookingPaymentRecovery, { serverInbox: true })))); await flush();
};
it("server history discovers a request after all browser storage is cleared without inventing a checkout body", async () => {
  vi.mocked(bookingsApi.getCustomerRecoveryInbox).mockResolvedValue({ requests: [inboxItem("AUTHENTICATION_REQUIRED")], resolved: [], hasMore: false, scanned: 1 });
  await mountInbox();
  expect(host.textContent).toContain("Booking Requests Needing Attention");
  expect(host.textContent).toContain("Original venue"); expect(host.textContent).toContain(input.idempotencyKey);
  expect(host.textContent).toContain("original checkout details are not retained");
  expect(host.textContent).not.toContain("Complete bank authentication");
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("AUTHENTICATION_REQUIRED", { clientSecret: "never-replay-without-body" }));
  await click("Check original Booking status");
  expect(getStripe).not.toHaveBeenCalled(); expect(bookingsApi.finalizeCustomerBooking).not.toHaveBeenCalled();
  expect(JSON.stringify(localStorage)).not.toContain("never-replay");
});
it("a freshly verified committed inbox result moves out of attention and links to the owned detail", async () => {
  vi.mocked(bookingsApi.getCustomerRecoveryInbox).mockResolvedValue({ requests: [inboxItem("FINALIZATION_PENDING")], resolved: [], hasMore: false, scanned: 1 });
  await mountInbox();
  vi.mocked(bookingsApi.getCustomerPaymentStatus).mockResolvedValue(value("COMMITTED", { bookingId: "5".repeat(24), canDismiss: true }));
  await click("Check original Booking status");
  const resolved = host.querySelector('[aria-label="Resolved Booking requests"]');
  expect(resolved?.textContent).toContain("Booking is confirmed by Bookly");
  expect(resolved?.querySelector('a[href*="/customer/bookings/view?id="]')).toBeTruthy();
  expect(host.querySelector('[aria-label="Booking requests needing attention"]')?.textContent).toContain("No requests needing attention");
  expect(bookingsApi.finalizeCustomerBooking).not.toHaveBeenCalled();
});
it("empty evidence pages can load older requests with the exact server cursor", async () => {
  vi.mocked(bookingsApi.getCustomerRecoveryInbox).mockResolvedValue({ requests: [], resolved: [], hasMore: true, nextCursor: "cursor-one", scanned: 10 });
  await mountInbox();
  vi.mocked(bookingsApi.getCustomerRecoveryInbox).mockResolvedValue({ requests: [inboxItem("REFUND_PENDING")], resolved: [], hasMore: false, scanned: 1 });
  await click("Load older requests");
  expect(bookingsApi.getCustomerRecoveryInbox).toHaveBeenLastCalledWith({ limit: 10, cursor: "cursor-one" });
  expect(host.textContent).toContain("a refund has not been confirmed");
  expect(host.textContent).not.toContain("Continue original Booking");
});
it("an old Customer inbox response cannot appear after an account switch", async () => {
  const releases: Array<(v: { requests: BookingRecoveryInboxItem[]; resolved: []; hasMore: false; scanned: number }) => void> = [];
  vi.mocked(bookingsApi.getCustomerRecoveryInbox).mockImplementation(() => new Promise((resolve) => { releases.push(resolve); }));
  await mountInbox();
  vi.mocked(bookingsApi.getCustomerRecoveryInbox).mockResolvedValue({ requests: [], resolved: [], hasMore: false, scanned: 0 });
  await act(async () => useAuthStore.setState({ cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
    user: { id: "9".repeat(24), role: "CUSTOMER", status: "ACTIVE", email: "other@example.test" } }));
  await act(async () => releases.forEach((resolve) => resolve({ requests: [inboxItem("PAYMENT_FAILED")], resolved: [], hasMore: false, scanned: 1 }))); await flush();
  expect(host.textContent).not.toContain(input.idempotencyKey); expect(host.textContent).not.toContain("Original venue");
});
it("persistent storage holds only pointers; full notes/address stay in the original tab for a bounded lifetime", () => {
  const privateInput: CreateBookingInput = { ...input, notes: "private-note", travelAddress: { city: "Larnaca", propertyType: "House",
    area: "private-area", streetName: "private-street", streetNumber: "77" } };
  saveBookingContinuation(customerId, businessId, privateInput);
  expect(JSON.stringify(localStorage)).not.toContain("private-note"); expect(JSON.stringify(localStorage)).not.toContain("private-street");
  expect(readBookingContinuations(customerId)[0]?.input.notes).toBe("private-note");
  const now = Date.now(); const clock = vi.spyOn(Date, "now").mockReturnValue(now + BOOKING_REQUEST_BODY_RETENTION_MS + 1);
  expect(readBookingContinuations(customerId)).toEqual([]); expect(readBookingRecoveryPointers(customerId)).toHaveLength(1);
  expect(JSON.stringify(sessionStorage)).not.toContain("private-note");
  clock.mockReturnValue(now + BOOKING_POINTER_RETENTION_MS + 1);
  expect(readBookingRecoveryPointers(customerId)).toEqual([]);
});
it("closed-tab pointers permit status discovery but cannot reconstruct or replace the original input", () => {
  saveBookingContinuation(customerId, businessId, input); sessionStorage.clear();
  expect(readBookingContinuations(customerId)).toEqual([]); expect(readBookingRecoveryPointers(customerId)).toHaveLength(1);
  expect(() => saveBookingContinuation(customerId, businessId, input)).toThrow("checkout details are no longer available");
});
it("legacy persistent P4A bodies migrate out of localStorage and another account's tab bodies are purged", () => {
  const key = `bookly:ordinary-booking:v1:${customerId}:${businessId}:${encodeURIComponent(input.idempotencyKey)}`;
  localStorage.setItem(key, JSON.stringify({ version: 1, customerId, businessId, savedAt: Date.now(), input: { ...input, notes: "legacy-private" } }));
  expect(readBookingContinuations(customerId)[0]?.input.notes).toBe("legacy-private");
  expect(JSON.stringify(localStorage)).not.toContain("legacy-private");
  expect(readBookingContinuations("9".repeat(24))).toEqual([]);
  expect(JSON.stringify(sessionStorage)).not.toContain("legacy-private");
});
