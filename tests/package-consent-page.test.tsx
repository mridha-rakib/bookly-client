import { describe, expect, it, vi } from "vitest";
import Page from "@/app/customer/package-consent/[businessId]/[packageId]/page";
import RequireCustomer from "@/components/auth/RequireCustomer";
vi.mock("@/components/auth/RequireCustomer", () => ({ default: () => null }));
vi.mock("@/components/packages/FirstClassPackageIntegration", () => ({ PackageCatalogue: () => null }));
describe("S6 existing detail destination", () => {
  it.each([undefined, "true"])("UI flag %s cannot expose consent finalization", async (flag) => {
    vi.stubEnv("PACKAGE_CONSENT_UI_ENABLED", flag);
    const page = await Page({ params: Promise.resolve({ businessId: "b", packageId: "p" }), searchParams: Promise.resolve({ operation: "old" }) });
    expect(page.type).toBe(RequireCustomer);
    const children = page.props.children.props.children.props.children;
    expect(children[0].props.children).toContain("Back to venue");
    expect(children[1].props).toEqual({ businessId: "b", packageId: "p", operationId: "old" });
    vi.unstubAllEnvs();
  });
});
