import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import StaffSettings from "@/components/dashboard/StaffSettings";

const query = vi.hoisted(() => ({ isLoading: false, isError: true, isFetching: false, data: undefined, refetch: vi.fn() }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => query }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/settings/Security2FAPanel", () => ({ Security2FAPanel: () => null }));

it("shows a retry instead of empty profile values when the read fails", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    act(() => root.render(<StaffSettings />));
    expect(host.textContent).toContain("Your profile could not be loaded");
    expect(host.textContent).not.toContain("Not set");
    const retry = [...host.querySelectorAll("button")].find((button) => button.textContent === "Retry");
    expect(retry).toBeDefined();
    act(() => retry?.click());
    expect(query.refetch).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
