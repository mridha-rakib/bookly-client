import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import SuperAdminFinanceLog from "@/components/super-admin/finance/SuperAdminFinanceLog";
// Captured from the isolated "serves persisted platform fees" Super Admin HTTP integration test.
import captured from "./admin-finance-http-synthetic.json";
// Captured directly from the isolated 3.7F ledger-status HTTP test.
import statuses from "./admin-finance-states-http-synthetic.json";
import payout from "./admin-payout-http-synthetic.json";

it("renders a persisted Admin HTTP transaction through the real request adapter", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const oldAdapter = apiClient.defaults.adapter;
  const requests: string[] = [];
  apiClient.defaults.adapter = async (config) => {
    requests.push(config.url ?? "");
    const isFee = config.url === "/super-admin/finance/transactions" && config.params?.types === "PLATFORM_FEE";
    const data = isFee ? captured : config.url === "/super-admin/finance/payouts"
      ? { success: true, message: "Payouts", data: { payouts: [], pagination: { page: 1, limit: 20, total: 0 } } }
      : { success: true, message: "Transactions", data: { transactions: [], pagination: { page: 1, limit: 20, total: 0 } } };
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><SuperAdminFinanceLog /></QueryClientProvider>));
    const tab = [...host.querySelectorAll("button")].find(button => button.textContent === "Activation fees");
    await act(async () => { tab?.click(); await new Promise(resolve => setTimeout(resolve, 40)); });
    const row = captured.data.transactions[0];
    expect(requests).toContain("/super-admin/finance/transactions");
    expect(host.textContent).toContain(row.businessName);
    expect(host.textContent).toContain(row.bookingReference);
    expect(host.textContent).toContain(row.customerName);
    expect(host.textContent).toContain("€16.00");
    expect(host.textContent).toContain("Settled");
    expect(host.textContent).toContain("2 total");
  } finally { await act(async () => root.unmount()); client.clear(); apiClient.defaults.adapter = oldAdapter; vi.unstubAllGlobals(); }
});

it("renders captured pending, failed, waived, settled and refund ledger states through Axios", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const oldAdapter = apiClient.defaults.adapter;
  apiClient.defaults.adapter = async (config) => ({
    data: config.url === "/super-admin/finance/payouts"
      ? payout
      : config.params?.types === "REFUND" ? statuses.refunds : statuses.fees,
    status: 200, statusText: "OK", headers: {}, config,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div"), root = createRoot(host);
  const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); }); };
  const rowFor = (cents: number) => [...host.querySelectorAll("tbody tr")].find(row => row.textContent?.includes(`€${(cents / 100).toFixed(2)}`));
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><SuperAdminFinanceLog /></QueryClientProvider>));
    await settle();
    for (const [cents, label] of [[111, "Pending"], [222, "Failed"], [333, "Waived"], [444, "Pending payout"]] as const) {
      expect(rowFor(cents)?.textContent).toContain(label);
    }
    const fee = statuses.fees.data.transactions[0];
    expect(host.textContent).toContain(fee.businessName);
    expect(host.textContent).toContain(fee.bookingReference);
    expect(host.textContent).toContain(fee.customerName);
    expect(host.textContent).toContain(new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(fee.date)));
    expect(host.textContent).toContain("4 total");
    const refundTab = [...host.querySelectorAll("button")].find(button => button.textContent === "Refunds issued");
    await act(async () => { refundTab?.click(); });
    await settle();
    expect(rowFor(555)?.textContent).toContain("Pending");
    expect(rowFor(666)?.textContent).toContain("Failed");
    expect(rowFor(777)?.textContent).toContain("Refunded");
    expect(rowFor(555)?.textContent).not.toContain("Refunded");
    expect(rowFor(666)?.textContent).not.toContain("Refunded");
    expect(host.textContent).toContain("3 total");
    const payoutsTab = [...host.querySelectorAll("button")].find(button => button.textContent === "Payout records");
    await act(async () => { payoutsTab?.click(); });
    await settle();
    expect(host.textContent).toContain(payout.data.payouts[0].businessName);
    expect(host.textContent).toContain("€4.44");
    expect(host.textContent).toContain("Payout recorded");
    expect(host.textContent).toContain("Bookly does not execute or verify the external transfer");
  } finally { await act(async () => root.unmount()); client.clear(); apiClient.defaults.adapter = oldAdapter; vi.unstubAllGlobals(); }
});
