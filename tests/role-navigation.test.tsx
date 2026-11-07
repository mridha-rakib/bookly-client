import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, UserRole } from "@/lib/api/auth";

const fx = vi.hoisted(() => ({
  auth: { user: null as AuthUser | null, status: "unauthenticated", isInitializing: false,
    logout: vi.fn(), restoreSession: vi.fn() },
  replace: vi.fn(), push: vi.fn(), enabled: false,
  me: undefined as undefined | { user: { id: string }; profile: { avatarUrl: string } },
}));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (state: typeof fx.auth) => unknown) => select(fx.auth) }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: (options?: { enabled: boolean }) => {
  fx.enabled = options?.enabled ?? true;
  return { data: fx.me };
} }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: fx.replace, push: fx.push }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <span data-src={src}>{alt}</span> }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => <span /> }));
vi.mock("@/hooks/usePWAInstall", () => ({ usePWAInstall: () => ({ installPWA: vi.fn() }) }));
vi.mock("@/components/auth/SessionRecovery", () => ({ default: () => <p>Session recovery</p> }));

import Navbar from "@/components/Navbar";
import RequireCustomer from "@/components/auth/RequireCustomer";
import RequireBusinessOwner from "@/components/auth/RequireBusinessOwner";
import RequireSupervisor from "@/components/auth/RequireSupervisor";
import RequireStaff from "@/components/auth/RequireStaff";
import RequireSuperAdmin from "@/components/auth/RequireSuperAdmin";
import StaffSidebar from "@/components/dashboard/StaffSidebar";
import SupervisorSidebar from "@/components/dashboard/SupervisorSidebar";
import { getAuthenticatedHomePath } from "@/lib/auth/routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const roles: UserRole[] = ["CUSTOMER", "BUSINESS_OWNER", "SUPERVISOR", "STAFF", "SUPER_ADMIN"];
const guards = [RequireCustomer, RequireBusinessOwner, RequireSupervisor, RequireStaff, RequireSuperAdmin];
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  fx.auth.user = null;
  fx.auth.status = "unauthenticated";
  fx.auth.isInitializing = false;
  fx.me = undefined;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const render = async (node: React.ReactNode) => { await act(async () => { root.render(node); }); };
const signIn = (role: UserRole, id = "current") => {
  fx.auth.status = "authenticated";
  fx.auth.user = { id, role, email: `${id}@example.test`, status: "ACTIVE" };
};
const navbar = () => <Navbar isLoggedIn={false} setIsLoggedIn={() => {}} selectedLanguage="ENG" setSelectedLanguage={() => {}} />;
const click = async (button: Element) => { await act(async () => { button.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };
const openAccount = async () => {
  const avatar = Array.from(host.querySelectorAll("button")).find(button => button.textContent?.includes("User Avatar"));
  expect(avatar).toBeDefined();
  await click(avatar!);
};

describe("public account navigation", () => {
  it.each(roles)("uses the authenticated %s role in both menus despite a false caller flag", async role => {
    signIn(role); await render(navbar()); await openAccount();
    const accountLinks = Array.from(host.querySelectorAll("a")).filter(link => link.textContent?.includes("Dashboard"));
    expect(accountLinks).toHaveLength(2);
    expect(accountLinks.every(link => link.getAttribute("href") === getAuthenticatedHomePath(role))).toBe(true);
    const customerLinks = host.querySelectorAll('a[href^="/customer/"]');
    expect(customerLinks.length > 0).toBe(role === "CUSTOMER");
    if (role === "CUSTOMER") {
      expect(host.querySelectorAll('a[href="/customer/payment-card"]')).toHaveLength(2);
      expect(host.querySelectorAll('a[href="/customer/tickets"]')).toHaveLength(2);
    }
  });
  it("uses shared logout even when a caller supplied a no-op", async () => {
    signIn("BUSINESS_OWNER"); await render(navbar()); await openAccount();
    const button = Array.from(host.querySelectorAll("button")).find(item => item.textContent === "Logout")!;
    await click(button); expect(fx.auth.logout).toHaveBeenCalledTimes(1);
  });
  it("removes customer links and previous avatar immediately on account changes and logout", async () => {
    signIn("CUSTOMER", "old"); fx.me = { user: { id: "old" }, profile: { avatarUrl: "/old-avatar.png" } };
    await render(navbar()); await openAccount(); expect(host.querySelector('[data-src="/old-avatar.png"]')).not.toBeNull();
    signIn("BUSINESS_OWNER", "new"); await render(navbar());
    expect(host.querySelector('a[href^="/customer/"]')).toBeNull();
    expect(host.querySelector('[data-src="/old-avatar.png"]')).toBeNull();
    fx.auth.status = "unauthenticated"; fx.auth.user = null; await render(navbar());
    expect(host.textContent).not.toContain("Dashboard"); expect(fx.enabled).toBe(false);
  });
  it.each(["unknown", "unverified"])("hides authenticated chrome during %s", async status => {
    signIn("CUSTOMER"); fx.auth.status = status; await render(navbar());
    expect(host.textContent).not.toContain("User Avatar"); expect(fx.enabled).toBe(false);
  });
});

describe("protected role layouts", () => {
  roles.forEach((allowed, index) => {
    const Guard = guards[index];
    it.each(roles)(`${allowed} layout rejects every other role: %s`, async actual => {
      signIn(actual); await render(<Guard><p>Protected dashboard data</p></Guard>);
      expect(host.textContent?.includes("Protected dashboard data")).toBe(actual === allowed);
      if (actual !== allowed) expect(fx.replace).toHaveBeenCalledWith(getAuthenticatedHomePath(actual));
      else expect(fx.replace).not.toHaveBeenCalled();
    });
    it(`${allowed} rejects anonymous deep links`, async () => {
      await render(<Guard><p>Protected dashboard data</p></Guard>);
      expect(host.textContent).not.toContain("Protected dashboard data"); expect(fx.replace).toHaveBeenCalled();
    });
    it(`${allowed} restores unknown sessions without rendering protected data`, async () => {
      fx.auth.status = "unknown"; await render(<Guard><p>Protected dashboard data</p></Guard>);
      expect(host.textContent).not.toContain("Protected dashboard data"); expect(fx.auth.restoreSession).toHaveBeenCalled();
    });
    it(`${allowed} fails closed during session recovery`, async () => {
      signIn(allowed); fx.auth.status = "unverified";
      await render(<Guard><p>Protected dashboard data</p></Guard>);
      expect(host.textContent).toBe("Session recovery");
    });
    it(`${allowed} removes its content on a same-role account logout`, async () => {
      signIn(allowed); await render(<Guard><p>Protected dashboard data</p></Guard>);
      fx.auth.status = "unauthenticated"; fx.auth.user = null;
      await render(<Guard><p>Protected dashboard data</p></Guard>);
      expect(host.textContent).not.toContain("Protected dashboard data");
    });
  });
});

describe("employment role sidebars", () => {
  it.each([false, true])("Staff exposes its schedule and appointments without client/team management (collapsed=%s)", async isCollapsed => {
    await render(<StaffSidebar isCollapsed={isCollapsed} setIsCollapsed={() => {}} activeTab="Dashboard"
      setActiveTab={() => {}} showFooterMenu={false} setShowFooterMenu={() => {}} footerMenuRef={{ current: null }} />);
    expect(host.textContent).toContain("My schedule");
    expect(host.textContent).toContain("Upcoming");
    expect(host.textContent).not.toContain("Clients");
    expect(host.textContent).not.toContain("Reviews");
    expect(host.textContent).not.toContain("Finance");
  });
  it("Supervisor exposes existing operations without owner finance or identity settings", async () => {
    await render(<SupervisorSidebar isCollapsed={false} setIsCollapsed={() => {}} activeTab="Calendar"
      setActiveTab={() => {}} showFooterMenu={false} setShowFooterMenu={() => {}} footerMenuRef={{ current: null }} />);
    expect(host.textContent).toContain("Clients");
    expect(host.textContent).toContain("Staff");
    expect(host.textContent).not.toContain("Finance");
    expect(host.textContent).not.toContain("Payouts");
    expect(host.textContent).not.toContain("Business Profile");
  });
});
