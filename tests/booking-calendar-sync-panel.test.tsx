import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import BookingCalendarSyncPanel from "@/components/dashboard/BookingCalendarSyncPanel";
import { bookingCalendarSyncApi, type BookingCalendarSyncStatus } from "@/lib/api/booking-calendar-sync";
import { BooklyApiError } from "@/lib/api/client";
import type { UserRole } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";

// P4C — Owner Booking detail: Google Calendar sync status and exact recovery (P4B-2C API).

const businessId = "2".repeat(24), bookingId = "5".repeat(24);
const requestId = "0b6c6d7e-7f3a-4b1c-9d2e-3f4a5b6c7d8e";
let root: Root, host: HTMLDivElement, client: QueryClient;

const flush = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); }); };
const signIn = (role: UserRole) => useAuthStore.setState({ status: "authenticated", isInitializing: false,
  cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  user: { id: "1".repeat(24), email: "owner@example.test", role, status: "ACTIVE" } });
const mount = async () => {
  await act(async () => root.render(createElement(QueryClientProvider, { client },
    createElement(BookingCalendarSyncPanel, { businessId, bookingId }))));
  await flush();
};
const status = (value: Partial<BookingCalendarSyncStatus>): BookingCalendarSyncStatus =>
  ({ ownership: "JOURNAL", status: "SYNC_PENDING", recoveryRequired: false, ...value });
const input = (label: string) => Array.from(host.querySelectorAll("label"))
  .find((element) => element.textContent?.includes(label))!.querySelector("input")!;
const type = async (element: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const button = () => Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("Resume calendar sync"));

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  signIn("BUSINESS_OWNER");
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });

it("presents a legacy-owned Booking as untracked, never as synced, with no controls", async () => {
  vi.spyOn(bookingCalendarSyncApi, "getStatus").mockResolvedValue(
    { ownership: "LEGACY", status: "LEGACY_UNTRACKED", recoveryRequired: false });
  await mount();
  expect(bookingCalendarSyncApi.getStatus).toHaveBeenCalledWith(businessId, bookingId);
  expect(host.textContent).toContain("Not tracked");
  expect(host.textContent).not.toContain("Synced");
  expect(host.querySelector("form")).toBeNull();
});

it("shows Synced only for a confirmed journal Booking, with the calendar account", async () => {
  vi.spyOn(bookingCalendarSyncApi, "getStatus").mockResolvedValue(status({ status: "SYNCED",
    destination: { accountEmail: "owner@gmail.com", configuredCalendarId: "primary", generation: "g" } }));
  await mount();
  expect(host.textContent).toContain("Synced");
  expect(host.textContent).toContain("owner@gmail.com");
  expect(host.querySelector("form")).toBeNull();
});

it("explains a disconnected-at-creation Booking without offering an account binding", async () => {
  vi.spyOn(bookingCalendarSyncApi, "getStatus").mockResolvedValue(status({ status: "NOT_CONNECTED",
    incident: "CALENDAR_NOT_CONNECTED", recoveryRequired: true }));
  const recover = vi.spyOn(bookingCalendarSyncApi, "recover");
  await mount();
  expect(host.textContent).toContain("Not connected");
  expect(host.textContent).toContain("won't be added automatically");
  expect(host.querySelector("form")).toBeNull();
  expect(recover).not.toHaveBeenCalled();
});

it("requires an incident reference and attestation, then names the exact unresolved request", async () => {
  vi.spyOn(bookingCalendarSyncApi, "getStatus").mockResolvedValue(status({ status: "RECOVERY_REQUIRED",
    incident: "PROVIDER_OUTCOME_UNKNOWN", recoveryRequired: true, unresolvedRequestId: requestId }));
  const recover = vi.spyOn(bookingCalendarSyncApi, "recover").mockResolvedValue({
    sync: status({ status: "SYNC_PENDING" }),
    recovery: { assertion: "ALL_ISSUERS_QUIESCED_AND_PROVIDER_SETTLED", requestId, incidentReference: "INC-1", at: "x" },
  });
  await mount();
  expect(host.textContent).toContain(requestId);
  expect(button()?.disabled).toBe(true);
  await type(input("Your reference"), "INC-1");
  expect(button()?.disabled).toBe(true); // Attestation still missing.
  await act(async () => input("earlier request").click());
  expect(button()?.disabled).toBe(false);
  await act(async () => button()!.click()); await flush();
  expect(recover).toHaveBeenCalledWith(businessId, bookingId,
    { incidentReference: "INC-1", assertion: "ALL_ISSUERS_QUIESCED_AND_PROVIDER_SETTLED", requestId });
  expect(JSON.stringify(recover.mock.calls)).not.toContain("bindUnusedDestination");
  expect(host.textContent).toContain("Bookly will continue syncing");
});

it("a changed connection needs the explicit same-account choice and sends only rebindToCurrentConnection", async () => {
  vi.spyOn(bookingCalendarSyncApi, "getStatus").mockResolvedValue(status({ status: "RECOVERY_REQUIRED",
    incident: "CONNECTION_OR_DESTINATION_MISMATCH", recoveryRequired: true,
    destination: { accountEmail: "owner@gmail.com", configuredCalendarId: "primary", generation: "g" } }));
  const recover = vi.spyOn(bookingCalendarSyncApi, "recover").mockResolvedValue({ sync: status({}) });
  await mount();
  expect(host.textContent).toContain("same Google account");
  await type(input("Your reference"), "INC-2");
  await act(async () => input("checked this booking").click());
  expect(button()?.disabled).toBe(true); // The same-account choice is required too.
  await act(async () => input("reconnected Google Calendar").click());
  await act(async () => button()!.click()); await flush();
  expect(recover).toHaveBeenCalledWith(businessId, bookingId,
    { incidentReference: "INC-2", assertion: "NO_UNRESOLVED_REQUEST", rebindToCurrentConnection: true });
});

it("reports the default-denied rollout and refused evidence without claiming success", async () => {
  vi.spyOn(bookingCalendarSyncApi, "getStatus").mockResolvedValue(status({ status: "RECOVERY_REQUIRED",
    incident: "PROVIDER_PERMANENT_FAILURE", recoveryRequired: true }));
  vi.spyOn(bookingCalendarSyncApi, "recover")
    .mockRejectedValueOnce(new BooklyApiError({ message: "Calendar delivery is not activated", status: 503 }))
    .mockRejectedValueOnce(new BooklyApiError({ message: "A different Google account or calendar is never adopted automatically", status: 409 }));
  await mount();
  await type(input("Your reference"), "INC-3");
  await act(async () => input("checked this booking").click());
  await act(async () => button()!.click()); await flush();
  expect(host.querySelector("[role=alert]")?.textContent).toContain("isn't available yet");
  await act(async () => button()!.click()); await flush();
  expect(host.querySelector("[role=alert]")?.textContent).toContain("never adopted automatically");
  expect(host.textContent).not.toContain("Bookly will continue syncing");
});

it("offers no controls for a failed Booking authority check", async () => {
  vi.spyOn(bookingCalendarSyncApi, "getStatus").mockResolvedValue(status({ status: "RECOVERY_REQUIRED",
    incident: "BOOKING_AUTHORITY_CHECK_FAILED", recoveryRequired: true }));
  await mount();
  expect(host.textContent).toContain("contact Bookly support");
  expect(host.querySelector("form")).toBeNull();
});

it("renders nothing and requests nothing for a Supervisor or Staff session", async () => {
  const getStatus = vi.spyOn(bookingCalendarSyncApi, "getStatus");
  for (const role of ["SUPERVISOR", "STAFF"] as UserRole[]) {
    signIn(role);
    await mount();
    expect(host.textContent).toBe("");
  }
  expect(getStatus).not.toHaveBeenCalled();
});

it("shows a retryable error state when the status cannot be loaded", async () => {
  const getStatus = vi.spyOn(bookingCalendarSyncApi, "getStatus")
    .mockRejectedValueOnce(new BooklyApiError({ message: "boom", status: 500 }))
    .mockResolvedValueOnce(status({ status: "SYNCED" }));
  await mount();
  expect(host.textContent).toContain("Couldn't load calendar sync status");
  const retry = Array.from(host.querySelectorAll("button")).find((b) => b.textContent === "Try again")!;
  await act(async () => retry.click()); await flush();
  expect(getStatus).toHaveBeenCalledTimes(2);
  expect(host.textContent).toContain("Synced");
});
