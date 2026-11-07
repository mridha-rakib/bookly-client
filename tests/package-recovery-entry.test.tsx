import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PackagePurchaseEntry } from "@/components/packages/PackagePurchaseEntry";
vi.mock("@/lib/packages/view-hooks", () => ({ usePackageView: () => ({ isError: true, data: undefined }) }));
vi.mock("@/components/packages/FirstClassPackageIntegration", () => ({ PackageCatalogue: () => <p>Catalogue unavailable</p> }));
vi.mock("@/components/packages/PackageConsentReview", () => ({ default: ({ initialOperationId }: { initialOperationId?: string }) => <p>Original operation {initialOperationId}</p> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it("an archived/unavailable catalogue cannot hide the original operation recovery entry", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<PackagePurchaseEntry businessId="business" packageId="package" operationId="original" />));
    expect(host.textContent).toBe("Original operation original");
    await act(async () => root.render(<PackagePurchaseEntry businessId="business" packageId="package" />));
    // The read-only catalogue keeps its navigation back to the venue.
    expect(host.textContent).toBe("← Back to venueCatalogue unavailable");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/venue?id=business");
  } finally { await act(async () => root.unmount()); }
});
