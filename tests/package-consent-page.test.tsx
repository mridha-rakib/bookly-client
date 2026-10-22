import { describe, expect, it, vi } from "vitest";
import Page from "@/app/customer/package-consent/[businessId]/[packageId]/page";
vi.mock("@/components/auth/RequireCustomer", () => ({ default: () => null }));
vi.mock("@/components/packages/PackageConsentReview", () => ({ default: () => null }));
describe("server UI gate", () => {
  it("defaults off and never renders authenticated review", async () => {
    vi.stubEnv("PACKAGE_CONSENT_UI_ENABLED", undefined);
    const page = await Page({
      params: Promise.resolve({ businessId: "b", packageId: "p" }),
      searchParams: Promise.resolve({}),
    });
    expect(page.type).toBe("main");
    expect(JSON.stringify(page)).toContain("unavailable");
    vi.unstubAllEnvs();
  });
  it("explicit enabled configuration renders the protected consent component", async () => {
    vi.stubEnv("PACKAGE_CONSENT_UI_ENABLED", "true");
    const page = await Page({
      params: Promise.resolve({ businessId: "b", packageId: "p" }),
      searchParams: Promise.resolve({ operation: "o" }),
    });
    expect(page.type).not.toBe("main");
    expect(page.props.children.props.initialOperationId).toBe("o");
    vi.unstubAllEnvs();
  });
});
