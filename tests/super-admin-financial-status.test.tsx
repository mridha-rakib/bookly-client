import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SuperAdminFinanceLog from "@/components/super-admin/finance/SuperAdminFinanceLog";

const rows = vi.hoisted(() => ["PENDING", "FAILED", "SUCCEEDED", "WAIVED"].map((status, index) => ({ id: String(index), status, type: "NO_SHOW_FEE", owner: "BUSINESS", date: "2030-01-01T00:00:00Z", businessName: "Salon", bookingReference: "BK", customerName: "Jane", grossCents: 1000, netCents: 1000 })));
vi.mock("@/lib/superAdminFinance/hooks", () => ({
  useSuperAdminPlatformTransactionsQuery: () => ({ data: { transactions: rows, pagination: { total: 4 } }, isLoading: false, isError: false }),
  useSuperAdminPlatformPayoutHistoryQuery: () => ({ data: { payouts: [{ id: "p", businessName: "Salon", periodStart: "2030-01-01T00:00:00Z", periodEnd: "2030-01-02T00:00:00Z", grossBusinessOwnedCents: 1000, processingFeesCents: 0, netPayoutCents: 1000, status: "PAID" }], pagination: { total: 1 } }, isLoading: false, isError: false }),
}));

it("distinguishes pending, failed, waived and succeeded fees", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminFinanceLog />));
    const tableRows = [...host.querySelectorAll("tbody tr")];
    expect(tableRows[0].textContent).toContain("Pending");
    expect(tableRows[1].textContent).toContain("Failed");
    expect(tableRows[2].textContent).toContain("Pending payout");
    expect(tableRows[3].textContent).toContain("Waived");
    expect(tableRows[0].textContent).not.toContain("Payout recorded");
    expect(tableRows[1].textContent).not.toContain("Payout recorded");
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});

it("describes a payout as self-attested without claiming Bookly executed or verified a transfer", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminFinanceLog />));
    const tab = [...host.querySelectorAll("button")].find(button => button.textContent === "Payout records");
    act(() => tab?.click());
    expect(host.querySelector("tbody")?.textContent).toContain("Payout recorded");
    expect(host.textContent).toContain("Bookly does not execute or verify the external transfer");
  } finally { act(() => root.unmount()); vi.unstubAllGlobals(); }
});

it("does not label pending or failed refunds as refunded", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  rows.forEach(row => { row.type = "REFUND"; });
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminFinanceLog />));
    const tableRows = [...host.querySelectorAll("tbody tr")];
    expect(tableRows[0].textContent).toContain("Pending");
    expect(tableRows[0].textContent).not.toContain("Refunded");
    expect(tableRows[1].textContent).toContain("Failed");
    expect(tableRows[1].textContent).not.toContain("Refunded");
    expect(tableRows[2].textContent).toContain("Refunded");
  } finally { rows.forEach(row => { row.type = "NO_SHOW_FEE"; }); act(() => root.unmount()); vi.unstubAllGlobals(); }
});

it("renders a successful platform fee using its HTTP amount and references", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  rows[2].type = "PLATFORM_FEE";
  rows[2].businessName = "Salon";
  rows[2].bookingReference = "BK-123";
  rows[2].customerName = "Jane Doe";
  rows[2].grossCents = 1600;
  rows[2].netCents = 1600;
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminFinanceLog />));
    const row = [...host.querySelectorAll("tbody tr")][2].textContent ?? "";
    expect(row).toContain("Salon");
    expect(row).toContain("BK-123");
    expect(row).toContain("Jane Doe");
    expect(row).toContain("16.00");
    expect(row).toContain("€");
    expect(row).toContain("Settled");
  } finally {
    rows[2].type = "NO_SHOW_FEE";
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
