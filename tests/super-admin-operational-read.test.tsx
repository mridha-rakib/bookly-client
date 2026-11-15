import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SuperAdminBookingDrawer from "@/components/super-admin/bookings/SuperAdminBookingDrawer";
import SuperAdminFinancePending from "@/components/super-admin/finance/SuperAdminFinancePending";
import SuperAdminFinanceLog from "@/components/super-admin/finance/SuperAdminFinanceLog";

const fx = vi.hoisted(() => ({ bookingRetry: vi.fn(), payoutRetry: vi.fn() }));
vi.mock("@/lib/superAdminBookings/hooks", () => ({ useSuperAdminBookingDetailQuery: () => ({ data: undefined, isError: true, isFetching: false, refetch: fx.bookingRetry }) }));
vi.mock("@/lib/superAdminFinance/hooks", () => ({
  useSuperAdminPendingPayoutsQuery: () => ({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: fx.payoutRetry }),
  useExecutePayoutMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useSuperAdminPlatformTransactionsQuery: () => ({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: fx.payoutRetry }),
  useSuperAdminPlatformPayoutHistoryQuery: () => ({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: fx.payoutRetry }),
}));
vi.mock("@/lib/superAdminPayoutDestination/hooks", () => ({ useSuperAdminPayoutDestinationQuery: () => ({}) }));

it("shows actionable errors instead of loading or zero pending payouts", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<><SuperAdminBookingDrawer bookingId="booking" onClose={() => {}} /><SuperAdminFinancePending /><SuperAdminFinanceLog /></>));
    expect(host.textContent).toContain("Could not load booking");
    expect(host.textContent).toContain("Couldn't load pending payouts");
    expect(host.textContent).not.toContain("0 businesses");
    expect(host.textContent).toContain("Could not load finance records");
    expect(host.textContent).not.toContain("No transactions recorded under this filter");
    const retries = [...host.querySelectorAll("button")].filter(button => button.textContent === "Retry");
    expect(retries).toHaveLength(3);
    act(() => retries.forEach(button => button.click()));
    expect(fx.bookingRetry).toHaveBeenCalledOnce();
    expect(fx.payoutRetry).toHaveBeenCalledTimes(2);
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});
