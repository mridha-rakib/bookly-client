import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StaffMySchedule from "@/components/dashboard/StaffMySchedule";
import BookingDetailReadError from "@/components/dashboard/BookingDetailReadError";

const fx = vi.hoisted(() => ({
  user: { isLoading: true, isError: false, isFetching: false, data: undefined as unknown, refetch: vi.fn() },
  schedule: { isLoading: false, isError: false, isFetching: false, data: undefined as unknown, error: new Error("Offline"), refetch: vi.fn() },
  services: { isLoading: false, isError: false, isFetching: false, data: undefined as unknown, error: new Error("Offline"), refetch: vi.fn() },
}));
vi.mock("@/lib/auth/hooks", () => ({ useCurrentUserQuery: () => fx.user }));
vi.mock("@/lib/staff/hooks", () => ({ useMyScheduleQuery: () => fx.schedule, useMyAssignedServicesQuery: () => fx.services }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));

describe("dashboard read recovery", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const render = (node: React.ReactElement) => act(() => root.render(node));
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.assign(fx.user, { isLoading: true, isError: false, isFetching: false, data: undefined });
    Object.assign(fx.schedule, { isLoading: false, isError: false, isFetching: false, data: undefined });
    Object.assign(fx.services, { isLoading: false, isError: false, isFetching: false, data: undefined });
    fx.user.refetch.mockReset(); fx.schedule.refetch.mockReset(); fx.services.refetch.mockReset();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  it("does not show an empty staff schedule before access is resolved", () => {
    render(<StaffMySchedule />); expect(host.textContent).toContain("Loading your staff access");
    expect(host.textContent).not.toContain("No hours configured");
    Object.assign(fx.user, { isLoading: false, isError: true }); render(<StaffMySchedule />);
    act(() => host.querySelector("button")!.click()); expect(fx.user.refetch).toHaveBeenCalledOnce();
    Object.assign(fx.user, { isError: false, data: {} }); render(<StaffMySchedule />);
    expect(host.textContent).toContain("not linked to an active business");
  });
  it("retries failed staff schedule and services independently", () => {
    Object.assign(fx.user, { isLoading: false, data: { business: { id: "business" } } });
    Object.assign(fx.schedule, { isError: true, isFetching: true });
    Object.assign(fx.services, { isError: true });
    render(<StaffMySchedule />);
    const buttons = host.querySelectorAll("button"); expect(buttons[0].disabled).toBe(true);
    act(() => buttons[1].click()); expect(fx.services.refetch).toHaveBeenCalledOnce();
    Object.assign(fx.schedule, { isError: false, data: [] }); Object.assign(fx.services, { isError: false, data: [] });
    render(<StaffMySchedule />); expect(host.textContent).toContain("No services are assigned");
  });
  it("retries booking details and blocks duplicate pending attempts", () => {
    const retry = vi.fn(); render(<BookingDetailReadError retry={retry} pending={false} />);
    act(() => host.querySelector("button")!.click()); expect(retry).toHaveBeenCalledOnce();
    render(<BookingDetailReadError retry={retry} pending />); expect(host.querySelector("button")?.disabled).toBe(true);
  });
});
