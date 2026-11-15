import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffMember, StaffTimeOffEntry } from "@/lib/api/staff";

type Request = { method?: string; url: string; data?: unknown };
const fx = vi.hoisted(() => ({
  requests: [] as Request[],
  respond: undefined as undefined | ((request: Request) => Promise<unknown>),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<object>()),
  apiRequest: (request: Request) => {
    fx.requests.push(request);
    return fx.respond!(request);
  },
}));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/business/hooks", () => ({ useManagedBusinessContext: () => ({ businessId: "business-a", isLoading: false }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: fx.success, error: fx.error } }));

import SupervisorStaffSchedule from "@/components/dashboard/SupervisorStaffSchedule";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root, client: QueryClient;
let timeOff: StaffTimeOffEntry[];
let failNext: Map<string, Error>;
const OFF_DAYS = ["WEDNESDAY", "SATURDAY", "SUNDAY"] as const;

const member = (): StaffMember => ({
  membershipId: "staff-a", userId: "user-a", businessId: "business-a", name: "Alex", email: "a@example.test",
  role: "STAFF", employmentActive: true, isOwner: false, createdAt: "2026-01-01T00:00:00Z",
  schedule: [{ dayOfWeek: "THURSDAY", intervals: [{ startTime: "10:00", endTime: "16:00" }] }],
  offDays: [...OFF_DAYS], timeOff: [...timeOff],
});

beforeEach(() => {
  vi.clearAllMocks();
  fx.requests = [];
  failNext = new Map();
  timeOff = [{ id: "to-1", type: "SICK_LEAVE", startDate: "2026-11-20", endDate: "2026-11-20" }];
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  // A stand-in for the persisted API: the Staff list embeds the member's time off, as the
  // real list DTO does for both Owner and Supervisor.
  fx.respond = async (request) => {
    const key = `${request.method ?? "GET"} ${request.url}`;
    const failure = failNext.get(key);
    if (failure) {
      failNext.delete(key);
      throw failure;
    }
    if (key === "GET /businesses/business-a/staff") return { members: [member()] };
    if (key === "POST /businesses/business-a/staff/staff-a/time-off") {
      const input = request.data as { type: StaffTimeOffEntry["type"]; startDate: string; endDate?: string };
      const created = { id: `to-${timeOff.length + 1}`, type: input.type, startDate: input.startDate, endDate: input.endDate ?? input.startDate };
      timeOff.push(created);
      return created;
    }
    if (key.startsWith("DELETE /businesses/business-a/staff/staff-a/time-off/")) {
      const id = key.split("/").at(-1);
      timeOff = timeOff.filter((entry) => entry.id !== id);
      return undefined;
    }
    throw new Error(`Unexpected ${key}`);
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
});

async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); }
async function waitFor(check: () => void) {
  for (let i = 0; i < 100; i++) {
    try { check(); return; } catch (error) { if (i === 99) throw error; }
    await settle();
  }
}
async function render() {
  await act(async () => root.render(<QueryClientProvider client={client}><SupervisorStaffSchedule /></QueryClientProvider>));
  await settle();
}
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function setValue(node: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const proto = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const dateInputs = () => [...host.querySelectorAll<HTMLInputElement>('input[type="date"]')];
const writes = () => fx.requests.filter((r) => r.method && r.method !== "GET");
const panelText = () => host.querySelector('[aria-label="Time off for Alex"]')?.textContent ?? "";

describe("Supervisor team time off", () => {
  it("blocks rapid duplicate time-off submissions before pending state renders", async () => {
    await render();
    await waitFor(() => expect(button("+ Add time off")).toBeTruthy());
    await click(button("+ Add time off"));
    await setValue(dateInputs()[0]!, "2026-12-22");
    let release!: (value: unknown) => void;
    const original = fx.respond!;
    fx.respond = (request) => request.method === "POST" ? new Promise(resolve => { release = resolve; }) : original(request);
    const save = button("Save time off")!;
    await act(async () => { save.click(); save.click(); });
    await waitFor(() => expect(writes()).toHaveLength(1));
    await act(async () => { release({ id: "new", type: "ANNUAL_HOLIDAY", startDate: "2026-12-22", endDate: "2026-12-22" }); });
  });
  it("shows persisted time off and adds an entry through the existing API without touching the schedule", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await render();
    await waitFor(() => expect(panelText()).toContain("20 Nov 2026 · Sick leave"));
    expect(host.textContent).toContain("Wed · Off");
    expect(button("Edit")).toBeUndefined();

    await click(button("+ Add time off"));
    await setValue(host.querySelector<HTMLSelectElement>('[aria-label="Time off for Alex"] select')!, "ANNUAL_HOLIDAY");
    await setValue(dateInputs()[0]!, "2026-12-22");
    await setValue(dateInputs()[1]!, "2026-12-31");
    await click(button("Save time off"));

    await waitFor(() => expect(panelText()).toContain("22 Dec 2026 - 31 Dec 2026 · Annual Holiday"));
    expect(writes()).toEqual([{ method: "POST", url: "/businesses/business-a/staff/staff-a/time-off",
      data: { type: "ANNUAL_HOLIDAY", startDate: "2026-12-22", endDate: "2026-12-31" } }]);
    // Recurring off-days are untouched: no schedule write, and the list still shows them.
    expect(host.textContent).toContain("Wed · Off");
    expect(fx.success).toHaveBeenCalledWith("Time off added");
    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    for (const key of [["staff", "list", "business-a"], ["staff", "my-schedule", "business-a"], ["availability", "business-a"],
      ["catalog", "availability", "business-a"], ["bookings", "calendar", "business-a"], ["dashboardOverview", "business-a"]]) {
      expect(keys).toContain(JSON.stringify(key));
    }
    expect(keys.some((key) => key.includes("business-b"))).toBe(false);
  });

  it("validates dates before sending and keeps entered values when the server rejects an overlap", async () => {
    await render();
    await waitFor(() => expect(button("+ Add time off")).toBeTruthy());
    await click(button("+ Add time off"));
    await click(button("Save time off"));
    expect(host.textContent).toContain("Choose a start date.");
    await setValue(dateInputs()[0]!, "2026-12-10");
    await setValue(dateInputs()[1]!, "2026-12-01");
    await click(button("Save time off"));
    expect(host.textContent).toContain("End date must be on or after the start date.");
    expect(writes()).toEqual([]);

    failNext.set("POST /businesses/business-a/staff/staff-a/time-off", new Error("This time off overlaps an existing entry"));
    await setValue(dateInputs()[1]!, "");
    await setValue(dateInputs()[0]!, "2026-11-20");
    await click(button("Save time off"));
    await waitFor(() => expect(host.querySelector('[aria-label="Time off for Alex"] [role="alert"]')).toBeTruthy());
    expect(dateInputs()[0]!.value).toBe("2026-11-20");
    expect(fx.success).not.toHaveBeenCalled();
    expect(timeOff).toHaveLength(1);
  });

  it("removes only after confirmation, and a failed removal keeps the entry", async () => {
    await render();
    await waitFor(() => expect(panelText()).toContain("Sick leave"));
    await click(host.querySelector('[aria-label="Remove time off 20 Nov 2026"]'));
    expect(panelText()).toContain("Remove this time off?");
    await click(button("Keep"));
    expect(writes()).toEqual([]);

    failNext.set("DELETE /businesses/business-a/staff/staff-a/time-off/to-1", new Error("Unavailable"));
    await click(host.querySelector('[aria-label="Remove time off 20 Nov 2026"]'));
    await click(button("Confirm remove"));
    await waitFor(() => expect(fx.error).toHaveBeenCalledTimes(1));
    expect(panelText()).toContain("Sick leave");

    await click(button("Confirm remove"));
    await waitFor(() => expect(panelText()).toContain("No time off recorded"));
    expect(writes().map((r) => `${r.method} ${r.url}`)).toEqual([
      "DELETE /businesses/business-a/staff/staff-a/time-off/to-1",
      "DELETE /businesses/business-a/staff/staff-a/time-off/to-1",
    ]);
    expect(host.textContent).toContain("Wed · Off");
  });

  it("a failed team read offers Retry", async () => {
    failNext.set("GET /businesses/business-a/staff", new Error("Network unavailable"));
    await render();
    await waitFor(() => expect(button("Retry")).toBeTruthy());
    expect(panelText()).toBe("");
    await click(button("Retry"));
    await waitFor(() => expect(panelText()).toContain("Sick leave"));
  });
});
