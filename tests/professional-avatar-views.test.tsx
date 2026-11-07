import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import StaffSettings from "@/components/dashboard/StaffSettings";
import SupervisorSettings from "@/components/dashboard/SupervisorSettings";
import StaffSidebar from "@/components/dashboard/StaffSidebar";
import SupervisorSidebar from "@/components/dashboard/SupervisorSidebar";

const fx = vi.hoisted(() => ({ avatarUrl: "https://media.example/own.png" as string | undefined }));
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => React.createElement("span", { "data-image": src, "aria-label": alt }) }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: { user: { email: "member@example.test" }, profile: { avatarUrl: fx.avatarUrl } } }) }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (state: { logout: () => void }) => unknown) => select({ logout: vi.fn() }) }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/settings/Security2FAPanel", () => ({ Security2FAPanel: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { localStorage.clear(); fx.avatarUrl = "https://media.example/own.png"; });

it.each(["Staff settings", "Supervisor settings", "Staff sidebar", "Supervisor sidebar"])("%s uses persisted identity media and never a shared browser preview", async (view) => {
  localStorage.setItem("settingsProfileImage", "data:image/png;base64,foreign-preview");
  const host = document.createElement("div"), root = createRoot(host);
  const sidebar = { isCollapsed: false, setIsCollapsed: vi.fn(), activeTab: "Settings", setActiveTab: vi.fn(), showFooterMenu: false, setShowFooterMenu: vi.fn(), footerMenuRef: { current: null } };
  const node = () => view === "Staff settings" ? <StaffSettings /> : view === "Supervisor settings" ? <SupervisorSettings /> : view === "Staff sidebar" ? <StaffSidebar {...sidebar} /> : <SupervisorSidebar {...sidebar} />;
  try {
    await act(async () => root.render(node()));
    expect(host.querySelector('[aria-label="Profile"], [aria-label="User Profile"]')?.getAttribute("data-image")).toBe("https://media.example/own.png");
    expect(host.querySelector('input[type="file"]')).toBeNull();
    if (view.endsWith("sidebar")) expect(sidebar.footerMenuRef.current).not.toBeNull();
    fx.avatarUrl = undefined;
    await act(async () => root.render(node()));
    expect(host.querySelector('[aria-label="Profile"], [aria-label="User Profile"]')?.getAttribute("data-image")).toBe("/businessDashboard/downLogo.png");
    expect(host.innerHTML).not.toContain("foreign-preview");
  } finally { await act(async () => root.unmount()); }
});
