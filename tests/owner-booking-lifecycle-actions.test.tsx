import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import BusinessDashboard from "@/app/business-dashboard/page";

const fx = vi.hoisted(() => ({ complete: vi.fn(), cancel: vi.fn(), refetch: vi.fn(), error: vi.fn(), success: vi.fn(), section: "all-bookings", profileError: false, profileRetry: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams(`section=${fx.section}`), usePathname: () => "/business-dashboard" }));
vi.mock("@/components/auth/RequireBusinessOwner", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/dashboard/BusinessDashboardApprovalGate", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/dashboard/DashboardSidebar", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DashboardBookingsList", () => ({ default: ({ onViewBookingDetails }: { onViewBookingDetails: (id: string) => void }) => <button onClick={() => onViewBookingDetails("booking")}>View</button> }));
vi.mock("@/components/clients/ClientBookingHistoryCard", () => ({ default: ({ onCompleteBooking, onCancelBooking }: { onCompleteBooking: () => void; onCancelBooking: () => void }) => <><button onClick={onCompleteBooking}>Complete booking</button><button onClick={onCancelBooking}>Cancel booking</button></> }));
vi.mock("@/components/dashboard/CalendarBookingCompletion", () => ({ default: (props: unknown) => { fx.complete(props); return <div>Fresh completion check</div>; } }));
vi.mock("@/components/dashboard/BookingCalendarSyncPanel", () => ({ default: () => null }));
vi.mock("@/lib/business/hooks", () => ({ useMyBusinessProfileQuery: () => ({ data: fx.profileError ? undefined : { primary: { id: "business" } }, isError: fx.profileError, refetch: fx.profileRetry }), useManagedBusinessContext: () => ({ businessId: "business" }) }));
vi.mock("@/lib/bookings/hooks", () => ({
  useBookingDetailQuery: () => ({ data: { id: "booking", serviceLines: [], packageSessions: [] }, refetch: fx.refetch }),
  useCancelByBusinessMutation: () => ({ mutate: fx.cancel }), useCancelNoShowMutation: () => ({ mutate: vi.fn() }),
  useRescheduleByOwnerMutation: () => ({}), useWaiveFeeMutation: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: fx.error, success: fx.success } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("routes completion through a fresh business-scoped detail check", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<BusinessDashboard />));
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "View")!.click());
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Complete booking")!.click());
    expect(fx.complete).toHaveBeenCalledWith(expect.objectContaining({ businessId: "business", bookingId: "booking" }));
    expect(host.textContent).toContain("Fresh completion check");
  } finally { await act(async () => root.unmount()); vi.clearAllMocks(); }
});

it("reports failed cancellation, refreshes detail and blocks rapid duplicate submission", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<BusinessDashboard />));
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "View")!.click());
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Cancel booking")!.click());
    const yes = [...host.querySelectorAll("button")].find(button => button.textContent === "Yes")!;
    await act(async () => { yes.click(); yes.click(); });
    expect(fx.cancel).toHaveBeenCalledOnce(); expect(fx.success).not.toHaveBeenCalled();
    const callbacks = fx.cancel.mock.calls[0]![1];
    await act(async () => { callbacks.onError(new Error("Offline")); callbacks.onSettled(); });
    expect(fx.refetch).toHaveBeenCalledOnce(); expect(fx.error).toHaveBeenCalledWith(expect.stringContaining("Offline"));
  } finally { await act(async () => root.unmount()); vi.clearAllMocks(); }
});

it("offers business-context retry instead of an empty client list when the profile read fails", async () => {
  fx.section = "clients"; fx.profileError = true;
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<BusinessDashboard />));
    expect(host.textContent).toContain("Business details could not be loaded");
    await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "Retry business details")!.click());
    expect(fx.profileRetry).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); fx.section = "all-bookings"; fx.profileError = false; vi.clearAllMocks(); }
});
