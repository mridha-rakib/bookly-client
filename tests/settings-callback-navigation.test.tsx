import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import type { BusinessCancellationPolicy } from "@/lib/api/business-cancellation-policy";
import DashboardSettings from "@/components/dashboard/DashboardSettings";

const fx = vi.hoisted(() => ({ refetch: vi.fn(), save: vi.fn(), policy: {
  isSuccess: false, isPending: false, isFetching: false, isError: false,
  data: undefined as BusinessCancellationPolicy | undefined, refetch: vi.fn(),
} }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/settings/Security2FAPanel", () => ({ Security2FAPanel: () => null }));
vi.mock("@/components/settings/PayoutDestinationSettings", () => ({ PayoutDestinationSettings: () => null }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: { user: {}, profile: {} } }) }));
vi.mock("@/lib/business/hooks", () => ({ useMyBusinessProfileQuery: () => ({ data: { primary: { id: "business" } } }),
  useBusinessQuery: () => ({}), useUpdateBusinessMutation: () => ({}),
  useGoogleCalendarStatusQuery: () => ({ refetch: fx.refetch }),
  useConnectGoogleCalendarMutation: () => ({}), useDisconnectGoogleCalendarMutation: () => ({}) }));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({}), useUploadOwnerAvatarMutation: () => ({}) }));
vi.mock("@/lib/business/cancellation-policy-hooks", () => ({ useCancellationPolicyQuery: () => fx.policy, useUpdateCancellationPolicyMutation: () => ({ mutateAsync: fx.save }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  Object.assign(fx.policy, { isSuccess: false, isPending: false, isFetching: false, isError: false, data: undefined });
  vi.clearAllMocks();
});

it.each(["loading", "failed"])("policy %s never enables saving placeholder rules", async (state) => {
  fx.policy.isPending = state === "loading"; fx.policy.isError = state === "failed";
  window.history.replaceState(null, "", "/business-dashboard?section=settings");
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<DashboardSettings />));
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Cancellation & No-show")!.click());
    expect(host.querySelector("fieldset")!.disabled).toBe(true);
    const save = [...host.querySelectorAll("button")].find((b) => b.textContent === "Save changes")!;
    expect(save.disabled).toBe(true);
    await act(async () => save.click());
    expect(fx.save).not.toHaveBeenCalled();
    if (state === "failed") {
      await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Retry cancellation policy")!.click());
      expect(fx.policy.refetch).toHaveBeenCalledOnce();
    }
  } finally { await act(async () => root.unmount()); }
});

it("a loaded policy supports keyboard-native fee controls and validates before the existing PUT", async () => {
  Object.assign(fx.policy, { isSuccess: true, data: { businessId: "business", configured: false, tiers: [] } });
  window.history.replaceState(null, "", "/business-dashboard?section=settings");
  const host = document.createElement("div"), root = createRoot(host);
  async function amount(value: string) {
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('input[type="number"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  try {
    await act(async () => root.render(<DashboardSettings />));
    await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Cancellation & No-show")!.click());
    const toggle = host.querySelector<HTMLButtonElement>('[role="checkbox"]')!;
    expect(toggle.tagName).toBe("BUTTON");
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    await amount("19");
    const save = () => [...host.querySelectorAll("button")].find((b) => b.textContent === "Save changes")!;
    await act(async () => save().click());
    expect(fx.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain("whole percentages between 20 and 100");
    await amount("33");
    await act(async () => save().click());
    // Normal fee windows are listed first (more than 24 h is fixed free); all five rows are still
    // saved so the First-Class-only 72 h / 24-72 h rows are preserved.
    expect(fx.save).toHaveBeenCalledWith(expect.objectContaining({ tiers: expect.arrayContaining([{ tier: "BETWEEN_12_AND_24_HOURS", mode: "PERCENTAGE", percentage: 33 }]), noShowPercentage: 20 }));
    expect((fx.save.mock.calls[0]![0] as { tiers: unknown[] }).tiers).toHaveLength(5);
    expect(host.textContent).toContain("Free cancellation. The customer's deposit is refunded in full");
    expect(host.textContent).toContain("First-Class Packages only");
  } finally { await act(async () => root.unmount()); }
});

it.each(["connected", "error"])("consumes the %s result without losing the Settings/Integration destination", async (outcome) => {
  fx.refetch.mockClear();
  window.history.replaceState({ preserved: true }, "", `/business-dashboard?section=settings&settingsTab=Integration&googleCalendar=${outcome}&filter=retained#integration`);
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<DashboardSettings />));
    const params = new URLSearchParams(window.location.search);
    expect(params.get("section")).toBe("settings");
    expect(params.get("settingsTab")).toBe("Integration");
    expect(params.get("filter")).toBe("retained");
    expect(params.has("googleCalendar")).toBe(false);
    expect(window.location.hash).toBe("#integration");
    expect(window.history.state).toEqual({ preserved: true });
    expect(fx.refetch).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("Google Calendar");
  } finally {
    await act(async () => root.unmount()); window.history.replaceState(null, "", "/");
  }
});
