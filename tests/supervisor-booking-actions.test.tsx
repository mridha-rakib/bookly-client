import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SupervisorDashboard from "@/components/dashboard/SupervisorDashboard";

const fx = vi.hoisted(() => ({ cancel: vi.fn(), complete: vi.fn(), refetch: vi.fn(), error: vi.fn(), success: vi.fn(), meError: false, meRetry: vi.fn() }));
vi.mock("@/components/dashboard/SupervisorSidebar", () => ({ default: ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => <><button onClick={() => setActiveTab("All Bookings")}>Bookings tab</button><button onClick={() => setActiveTab("Clients")}>Clients tab</button><button onClick={() => setActiveTab("Calendar")}>Calendar tab</button></> }));
vi.mock("@/components/dashboard/DashboardCalendar", () => ({ default: ({ onNewBookingClick }: { onNewBookingClick: () => void }) => <button onClick={onNewBookingClick}>New booking</button> }));
vi.mock("@/components/dashboard/DashboardBookingForm", () => ({ default: () => <div>Booking editor</div> }));
vi.mock("@/components/dashboard/DashboardBookingsList", () => ({ default: ({ onViewBookingDetails }: { onViewBookingDetails: (id: string) => void }) => <button onClick={() => onViewBookingDetails("booking")}>View booking</button> }));
vi.mock("@/components/clients/ClientBookingHistoryCard", () => ({ default: ({ onCompleteBooking, onCancelBooking }: { onCompleteBooking: () => void; onCancelBooking: () => void }) => <><button onClick={onCompleteBooking}>Complete booking</button><button onClick={onCancelBooking}>Cancel booking</button></> }));
vi.mock("@/components/dashboard/CalendarBookingCompletion", () => ({ default: (props: unknown) => { fx.complete(props); return <div>Fresh completion check</div>; } }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: fx.meError ? undefined : { business: { id: "business" } }, isError: fx.meError, refetch: fx.meRetry }) }));
vi.mock("@/lib/business/hooks", () => ({ useManagedBusinessContext: () => ({ businessId: "business" }) }));
vi.mock("@/lib/bookings/hooks", () => ({
  useBookingDetailQuery: () => ({ data: { id: "booking", serviceLines: [], packageSessions: [] }, refetch: fx.refetch }),
  useCancelByBusinessMutation: () => ({ mutate: fx.cancel }), useCancelNoShowMutation: () => ({ mutate: vi.fn() }),
  useRescheduleByOwnerMutation: () => ({}), useWaiveFeeMutation: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { error: fx.error, success: fx.success } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("uses a fresh business-scoped completion check", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<SupervisorDashboard />));
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Bookings tab")!.click());
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "View booking")!.click());
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Complete booking")!.click());
    expect(fx.complete).toHaveBeenCalledWith(expect.objectContaining({ businessId: "business", bookingId: "booking" }));
  } finally { await act(async () => root.unmount()); vi.clearAllMocks(); }
});

it("blocks duplicate cancellation and reports failure after refreshing detail", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<SupervisorDashboard />));
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Bookings tab")!.click());
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "View booking")!.click());
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Cancel booking")!.click());
    const yes = [...host.querySelectorAll("button")].find(b => b.textContent === "Yes")!;
    await act(async () => { yes.click(); yes.click(); });
    expect(fx.cancel).toHaveBeenCalledOnce();
    const callbacks = fx.cancel.mock.calls[0]![1];
    await act(async () => { callbacks.onError(new Error("Offline")); callbacks.onSettled(); });
    expect(fx.refetch).toHaveBeenCalledOnce();
    expect(fx.error).toHaveBeenCalledWith(expect.stringContaining("Offline"));
  } finally { await act(async () => root.unmount()); vi.clearAllMocks(); }
});

it("navigation closes a booking editor and client context failures can be retried", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<SupervisorDashboard />));
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "New booking")!.click());
    expect(host.textContent).toContain("Booking editor");
    fx.meError = true;
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Clients tab")!.click());
    expect(host.textContent).toContain("Business details could not be loaded");
    await act(async () => [...host.querySelectorAll("button")].find(b => b.textContent === "Retry business details")!.click());
    expect(fx.meRetry).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); fx.meError = false; vi.clearAllMocks(); }
});
