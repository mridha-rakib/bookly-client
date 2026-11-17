import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SuperAdminFinancePending from "@/components/super-admin/finance/SuperAdminFinancePending";
import PayoutBreakdownCard from "@/components/super-admin/businesses/business-detail/PayoutBreakdownCard";
import { BooklyApiError } from "@/lib/api/client";

/** Finance Gap 02 — the Super Admin records an already-completed external transfer, bound to the
 * exact reviewed amount + payable snapshot (the server refuses anything else). */
const DIGEST = "a".repeat(64);
const fx = vi.hoisted(() => ({
  payable: { data: undefined as unknown, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() },
  mutation: { isPending: false, isError: false, error: null as unknown, mutate: vi.fn(), reset: vi.fn() },
}));
const listRow = {
  businessId: "b1", businessName: "Salon", city: "Limassol", category: "Hair", grossCents: 1600,
  processingFeesCents: 0, refundsCents: 0, netCents: 1600, transactionCount: 1,
  noShowAmountCents: 0, cancellationAmountCents: 0, depositAmountCents: 1600,
};
vi.mock("@/lib/superAdminFinance/hooks", () => ({
  useSuperAdminPendingPayoutsQuery: () => ({ data: { items: [listRow], totalPendingCents: 1600, businessCount: 1 }, isLoading: false, isError: false }),
  useSuperAdminBusinessPayableQuery: () => fx.payable,
  useExecutePayoutMutation: () => fx.mutation,
}));
vi.mock("@/lib/superAdminPayoutDestination/hooks", () => ({ useSuperAdminPayoutDestinationQuery: () => ({ data: { configured: true } }) }));
vi.mock("@/components/super-admin/finance/PayoutDestinationPanel", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fx.payable.data = { ...listRow, processingFeesCents: 55, netCents: 1545, snapshotDigest: DIGEST };
  Object.assign(fx.payable, { isFetching: false, isError: false });
  Object.assign(fx.mutation, { isPending: false, isError: false, error: null });
  fx.mutation.mutate.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);

describe("Super Admin manual bank-transfer recording", () => {
  it("pending list: confirms exactly the current reviewed amount and snapshot, never the list row", () => {
    act(() => root.render(<SuperAdminFinancePending />));
    expect(host.textContent).not.toContain("SEPA");
    act(() => button("Record Bank Transfer")!.click());
    const text = host.textContent ?? "";
    expect(text).toContain("Confirm Completed Transfer");
    expect(text).toContain("already transferred exactly €15.45");
    expect(text).toContain("Bookly does not send or verify this transfer");
    expect(text).toContain("The amount owed is now €15.45 (the list showed €16.00)");
    act(() => button("Record transfer as paid")!.click());
    expect(fx.mutation.mutate).toHaveBeenCalledOnce();
    expect(fx.mutation.mutate.mock.calls[0]![0]).toEqual({
      businessId: "b1", expectedNetCents: 1545, snapshotDigest: DIGEST, providerReference: undefined,
    });
  });

  it("pending list: cannot confirm without a current snapshot, and explains a refused stale record", () => {
    fx.payable.data = { ...listRow, snapshotDigest: undefined };
    act(() => root.render(<SuperAdminFinancePending />));
    act(() => button("Record Bank Transfer")!.click());
    expect(button("Record transfer as paid")!.disabled).toBe(true);
    fx.payable.data = { ...listRow, netCents: 1545, snapshotDigest: DIGEST };
    Object.assign(fx.mutation, {
      isError: true,
      error: new BooklyApiError({ message: "changed", status: 409, code: "FINANCE_PAYOUT_SNAPSHOT_CHANGED" }),
    });
    act(() => root.render(<SuperAdminFinancePending />));
    expect(host.textContent).toContain("The amount owed changed after you reviewed it — nothing was recorded");
  });

  it("business detail: records the displayed amount + snapshot and shows dispute deductions", () => {
    const payable = { ...listRow, grossCents: 1600, processingFeesCents: 55, disputeAdjustmentsCents: 500, netCents: 1045, snapshotDigest: DIGEST };
    act(() => root.render(<PayoutBreakdownCard businessId="b1" businessName="Salon" payable={payable} />));
    expect(host.textContent).toContain("Disputes");
    expect(host.textContent).toContain("-€5.00");
    expect(host.textContent).toContain("Net to transfer");
    act(() => button("Record Bank Transfer")!.click());
    expect(host.textContent).toContain("Record a completed transfer of €10.45 to Salon");
    expect(host.textContent).toContain("already transferred exactly €10.45");
    act(() => button("Record transfer as paid")!.click());
    expect(fx.mutation.mutate.mock.calls[0]![0]).toEqual({ businessId: "b1", expectedNetCents: 1045, snapshotDigest: DIGEST });
  });
});
