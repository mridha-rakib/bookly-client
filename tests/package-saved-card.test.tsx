import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { PackageSavedCard } from "@/components/packages/PackageSavedCard";
import { paymentsApi } from "@/lib/api/payments";
vi.mock("@/lib/api/payments", () => ({ paymentsApi: { getSavedCardStatus: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it.each([true, false])("checkout reads masked saved-card status, hasSavedCard=%s, without starting payment", async (hasSavedCard) => {
  vi.mocked(paymentsApi.getSavedCardStatus).mockResolvedValue({ hasSavedCard, ...(hasSavedCard ? { card: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } } : {}) });
  const host = document.createElement("div"), root = createRoot(host), client = new QueryClient();
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><PackageSavedCard /></QueryClientProvider>));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(host.textContent).toContain(hasSavedCard ? "visa ending 4242" : "Save a payment card");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/customer/payment-card");
    expect(host.querySelector("a")?.target).toBe("_blank");
    expect(host.querySelector('input[type="password"]')).toBeNull();
  } finally { await act(async () => root.unmount()); client.clear(); }
});
