/** BC-F05B: pages must survive the Providers' auth-boundary remount (cacheEpoch key).
 * Real page components; only routing, transport hooks and chrome are mocked. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  search: new URLSearchParams(),
  invitationTokens: [] as string[],
  progress: undefined as undefined | Record<string, unknown>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => fx.search,
}));
vi.mock("next/link", () => ({ default: ({ children }: React.PropsWithChildren) => <a>{children}</a> }));
vi.mock("next/image", () => ({ default: ({ alt }: { alt?: string }) => <span>{alt}</span> }));
vi.mock("@/lib/maps/googleGeocoding", () => ({ geocodeAddress: async () => null }));
vi.mock("@/lib/business-taxonomy/hooks", () => ({
  useBusinessTaxonomyQuery: () => ({ data: { categories: [] }, isLoading: false }),
  subcategoriesFor: () => [],
}));
vi.mock("@/lib/auth/hooks", () => {
  const mutation = () => ({ mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false });
  return {
    useStaffInvitationQuery: (token: string) => {
      fx.invitationTokens.push(token);
      return { data: undefined, isLoading: true, isError: false, error: null };
    },
    useAcceptStaffInvitationPasswordMutation: mutation,
    useStaffInvitationGoogleMutation: mutation,
    useProfessionalRegistrationProgressQuery: () => ({
      data: fx.progress, isError: false, isLoading: false, refetch: vi.fn(),
    }),
    useSaveBusinessDetailsMutation: mutation,
    useSaveCategoriesMutation: mutation,
    useCompleteBusinessOwnerMutation: mutation,
  };
});

import AcceptInvitationPage from "@/app/staff/invite/accept/page";
import BusinessFormPage from "@/app/professional/business-form/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  fx.invitationTokens = [];
  fx.progress = undefined;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
const render = async (node: React.ReactNode) => {
  await act(async () => {
    root.render(node);
  });
};

describe("auth-boundary remount recovery", () => {
  it("keeps the captured staff invitation token after the URL is scrubbed and the page remounts", async () => {
    fx.search = new URLSearchParams("token=invite-token-abc");
    await render(<React.Fragment key="epoch-0"><AcceptInvitationPage /></React.Fragment>);
    expect(fx.invitationTokens.at(-1)).toBe("invite-token-abc");
    // The page scrubbed the address bar; the initial session restore then bumps cacheEpoch.
    fx.search = new URLSearchParams();
    await render(<React.Fragment key="epoch-1"><AcceptInvitationPage /></React.Fragment>);
    expect(fx.invitationTokens.at(-1)).toBe("invite-token-abc");
    expect(host.textContent).not.toContain("Missing invitation link");
  });

  it("restores the pending-approval step from a COMPLETED registration after remount", async () => {
    fx.search = new URLSearchParams("email=owner%40example.test&sessionId=6ae82c3e110356392b320e73");
    fx.progress = {
      sessionId: "6ae82c3e110356392b320e73", portal: "PROFESSIONAL", intendedRole: "BUSINESS_OWNER",
      currentStep: "COMPLETED", emailVerified: true, phoneVerified: true, email: "owner@example.test",
    };
    await render(<BusinessFormPage />);
    expect(host.textContent).toContain("pending approval");
    expect(host.querySelector("input[placeholder='Business Name']")).toBeNull();
  });

  it("still shows the editable business form for an in-progress registration", async () => {
    fx.search = new URLSearchParams("email=owner%40example.test&sessionId=6ae82c3e110356392b320e73");
    fx.progress = {
      sessionId: "6ae82c3e110356392b320e73", portal: "PROFESSIONAL", intendedRole: "BUSINESS_OWNER",
      currentStep: "VISIT_TYPE_SELECTED", emailVerified: true, phoneVerified: true, email: "owner@example.test",
    };
    await render(<BusinessFormPage />);
    expect(host.textContent).not.toContain("pending approval");
    expect(host.querySelector("input[placeholder='Business Name']")).not.toBeNull();
  });
});
