import React, { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import SupervisorSidebar from "@/components/dashboard/SupervisorSidebar";

vi.mock("next/image", () => ({ default: () => <span /> }));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => ({ data: { user: { email: "supervisor@example.test" }, business: { name: "Business" } } }) }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (selector: (value: unknown) => unknown) => selector({ logout: vi.fn() }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
function Wrapper() {
  const [collapsed, setCollapsed] = useState(false), [tab, setTab] = useState("Calendar"), [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  return <SupervisorSidebar isCollapsed={collapsed} setIsCollapsed={setCollapsed} activeTab={tab} setActiveTab={setTab} showFooterMenu={show} setShowFooterMenu={setShow} footerMenuRef={ref} />;
}
it("uses an overlay when expanded and collapses after a mobile navigation choice", async () => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  const host = document.createElement("div"), root = createRoot(host);
  try {
    await act(async () => root.render(<Wrapper />));
    expect(host.querySelector("aside")?.className).toContain("fixed");
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Staff"]')!.click());
    expect(host.querySelector("aside")?.className).toContain("w-[78px]");
    expect(host.querySelector('button[aria-label="Staff"]')?.getAttribute("aria-current")).toBe("page");
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals(); }
});
