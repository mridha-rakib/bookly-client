import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import SuperAdminBusinesses from "@/components/super-admin/businesses/SuperAdminBusinesses";

const fx = vi.hoisted(() => ({
  detail: { data: undefined as { status: string } | undefined, isError: false, isFetching: false, refetch: vi.fn() },
  approve: vi.fn(), reject: vi.fn(), suspend: vi.fn(),
}));
vi.mock("@/lib/superAdminBusiness/hooks", () => ({
  useSuperAdminBusinessesQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useSuperAdminBusinessDetailQuery: () => fx.detail,
  useApproveBusinessMutation: () => ({ mutate: fx.approve, isPending: false }),
  useRejectBusinessMutation: () => ({ mutate: fx.reject, isPending: false }),
  useSuspendBusinessMutation: () => ({ mutate: fx.suspend, isPending: false }),
}));
vi.mock("@/components/super-admin/businesses/SuperAdminBusinessReview", () => ({ default: (props: { onApprove: (id: string) => void; actionError?: string }) => <><button onClick={() => props.onApprove("business")}>Approve</button><p>{props.actionError}</p></> }));
vi.mock("@/components/super-admin/businesses/business-detail/SuperAdminBusinessDetail", () => ({ default: () => null }));
vi.mock("@/components/super-admin/businesses/SuperAdminBusinessesFilter", () => ({ default: () => null }));
vi.mock("@/components/super-admin/businesses/SuperAdminBusinessesTabs", () => ({ default: () => null }));
vi.mock("@/components/super-admin/businesses/SuperAdminBusinessesTable", () => ({ default: () => null }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("shows a retry when the selected business read fails", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fx.detail.data = undefined; fx.detail.isError = true;
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<SuperAdminBusinesses viewingBusinessId="business" />));
    expect(host.textContent).toContain("Failed to load this business");
    expect(host.textContent).not.toContain("Loading");
    act(() => host.querySelector("button")?.click());
    expect(fx.detail.refetch).toHaveBeenCalledOnce();
  } finally { act(() => root.unmount()); }
});

it("keeps review open on failure and suppresses duplicate submissions until settled", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fx.detail.data = { status: "PENDING" }; fx.detail.isError = false;
  const host = document.createElement("div"), root = createRoot(host), navigate = vi.fn();
  try {
    act(() => root.render(<SuperAdminBusinesses viewingBusinessId="business" setViewingBusinessId={navigate} />));
    const button = host.querySelector("button")!;
    act(() => { button.click(); button.click(); });
    expect(fx.approve).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    const callbacks = fx.approve.mock.calls[0][1];
    act(() => { callbacks.onError(new Error("Approval failed")); callbacks.onSettled(); });
    expect(navigate).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Approval failed");
    act(() => button.click());
    expect(fx.approve).toHaveBeenCalledTimes(2);
    act(() => fx.approve.mock.calls[1][1].onSuccess());
    expect(navigate).toHaveBeenCalledWith(null);
  } finally { act(() => root.unmount()); }
});
