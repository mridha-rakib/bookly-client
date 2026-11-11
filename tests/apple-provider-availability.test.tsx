import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fx = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiRequest: fx.request }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/lib/auth/hooks", () => {
  const mutation = () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() });
  return { useCustomerAppleAuthMutation: mutation, useCustomerEntryMutation: mutation, useCustomerFacebookAuthMutation: mutation, useCustomerGoogleAuthMutation: mutation, useSendCustomerEmailOtpMutation: mutation, useProfessionalAppleAuthMutation: mutation, useProfessionalEntryMutation: mutation, useProfessionalFacebookAuthMutation: mutation, useProfessionalGoogleAuthMutation: mutation, useSendProfessionalEmailOtpMutation: mutation };
});
vi.mock("@/components/auth/AuthLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/auth/AuthCard", () => ({ default: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
vi.mock("@/components/auth/SocialButton", () => ({ default: ({ label }: { label: string }) => <button>{label}</button> }));
import CustomerAuthPage from "@/app/customer/page";
import ProfessionalAuthPage from "@/app/professional/auth/page";
import { useAppleOAuthAvailability } from "@/lib/auth/providers";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root, queryClient: QueryClient;
beforeEach(() => {
  fx.request.mockReset(); host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
});
afterEach(async () => { await act(async () => root.unmount()); queryClient.clear(); host.remove(); });
const render = async (element: React.ReactNode) => {
  await act(async () => { root.render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>); await new Promise((resolve) => setTimeout(resolve, 0)); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
};
const LinkingProbe = () => { const apple = useAppleOAuthAvailability(); return apple.linking ? <button>Link Apple</button> : null; };

describe("Apple capability UI", () => {
  it.each([["customer", CustomerAuthPage], ["professional", ProfessionalAuthPage]] as const)("hides disabled Apple login on the actual %s page, keeping other providers", async (_portal, Page) => {
    fx.request.mockResolvedValue({ apple: { customer: false, professional: false, linking: false } });
    await render(<Page />);
    expect(host.textContent).not.toContain("Continue With Apple"); expect(host.textContent).toContain("Continue With Google"); expect(host.textContent).toContain("Continue With Facebook");
    expect(fx.request).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", url: "/auth/providers" }));
  });
  it.each([["customer", CustomerAuthPage], ["professional", ProfessionalAuthPage]] as const)("shows Apple on the actual %s page only when the backend enables it", async (_portal, Page) => {
    fx.request.mockResolvedValue({ apple: { customer: true, professional: true, linking: true } }); await render(<Page />);
    expect(host.textContent).toContain("Continue With Apple");
  });
  it("hides Apple linking on capability failure", async () => {
    fx.request.mockRejectedValue(new Error("Unavailable")); await render(<LinkingProbe />); expect(host.textContent).not.toContain("Link Apple");
  });
  it("does not offer Apple linking while capability discovery is pending", async () => {
    fx.request.mockImplementation(() => new Promise(() => {})); await render(<LinkingProbe />); expect(host.textContent).not.toContain("Link Apple");
  });
  it("shows linking only for the server linking capability", async () => {
    fx.request.mockResolvedValue({ apple: { customer: false, professional: false, linking: true } }); await render(<LinkingProbe />); expect(host.textContent).toContain("Link Apple");
  });
});
