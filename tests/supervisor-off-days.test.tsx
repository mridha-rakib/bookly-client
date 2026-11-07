import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffMember } from "@/lib/api/staff";

const fx = vi.hoisted(() => ({ businessId: "business-a" as string | undefined,
  members: [] as StaffMember[], pending: false, fetching: false, save: vi.fn(), success: vi.fn(), error: vi.fn(),
  apiSave: vi.fn(),
}));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/lib/business/hooks", () => ({ useManagedBusinessContext: () => ({ businessId: fx.businessId, isLoading: false }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: fx.success, error: fx.error } }));
vi.mock("@/lib/staff/hooks", () => ({
  useStaffListQuery: () => ({ data: { members: fx.members }, isLoading: false, isError: false, isFetching: fx.fetching }),
  usePutStaffScheduleMutation: () => ({ mutateAsync: fx.save, isPending: fx.pending }),
}));
vi.mock("@/lib/api/staff", async importOriginal => ({ ...(await importOriginal<object>()), staffApi: { putSchedule: fx.apiSave } }));

import SupervisorStaffSchedule from "@/components/dashboard/SupervisorStaffSchedule";
import { summarizeScheduleForCard } from "@/lib/staff/format";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const member = (id = "staff-a"): StaffMember => ({
  membershipId: id, userId: id, businessId: "business-a", name: id, role: "STAFF", employmentActive: true,
  isOwner: false, schedule: [{ dayOfWeek: "THURSDAY", intervals: [{ startTime: "10:00", endTime: "16:00" }] }],
  offDays: ["WEDNESDAY", "SATURDAY", "SUNDAY"],
} as StaffMember);
beforeEach(() => {
  vi.clearAllMocks(); fx.businessId = "business-a"; fx.members = [member()]; fx.pending = false; fx.fetching = false;
  fx.save.mockResolvedValue([]); fx.apiSave.mockResolvedValue([]);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const render = async (node: React.ReactNode = <SupervisorStaffSchedule />) => { await act(async () => { root.render(node); }); };
const button = (text: string) => Array.from(host.querySelectorAll("button")).find(node => node.textContent === text)!;
const click = async (node: Element) => { await act(async () => { node.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); };

describe("Supervisor off-day draft and save", () => {
  it("shows authoritative off-days and changes Thursday without submitting a stale replacement", async () => {
    await render(); expect(host.textContent).toContain("Wed · Off");
    expect(summarizeScheduleForCard(fx.members[0].schedule, fx.members[0].offDays)).toContain("Weekend:");
    await click(button("Edit schedule"));
    expect(host.textContent?.match(/Recurring day off/g)).toHaveLength(3);
    const select = host.querySelector<HTMLSelectElement>('select[aria-label="Start shift time"]')!;
    await act(async () => { select.value = "11:00"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await click(button("Save"));
    expect(fx.save).toHaveBeenCalledWith({ businessId: "business-a", staffId: "staff-a", input: {
      days: [{ dayOfWeek: "THURSDAY", intervals: [{ startTime: "11:00", endTime: "16:00" }] }],
    } });
    expect(fx.members[0].schedule[0].intervals[0].startTime).toBe("10:00");
    expect(fx.success).toHaveBeenCalledTimes(1);
    expect(button("Edit schedule")).toBeDefined();
    fx.members = [{ ...member(), schedule: fx.save.mock.calls[0][0].input.days }];
    await render(); await click(button("Edit schedule"));
    expect(host.querySelector<HTMLSelectElement>('select[aria-label="Start shift time"]')?.value).toBe("11:00");
    expect(host.textContent?.match(/Recurring day off/g)).toHaveLength(3);
  });
  it("submits only an intentional off-day-to-working change and preserves remaining off-day display", async () => {
    await render(); await click(button("Edit schedule"));
    await click(host.querySelector('[aria-label="Set working hours for Wed"]')!);
    expect(host.textContent?.match(/Recurring day off/g)).toHaveLength(2);
    await click(button("Save"));
    expect(fx.save.mock.calls[0][0].input.days.map((day: { dayOfWeek: string }) => day.dayOfWeek)).toEqual(["WEDNESDAY", "THURSDAY"]);
    expect(fx.save.mock.calls[0][0].input).not.toHaveProperty("offDays");
  });
  it("failed saves retain draft and off-days without a success toast; refetch does not reset edits", async () => {
    fx.save.mockRejectedValue(new Error("Save unavailable"));
    await render(); await click(button("Edit schedule"));
    await click(host.querySelector('[aria-label="Set working hours for Fri"]')!);
    fx.fetching = true; await render(); expect(button("Save").disabled).toBe(true);
    fx.fetching = false; await render(); await click(button("Save"));
    expect(fx.error).toHaveBeenCalledTimes(1); expect(fx.success).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Remove first interval for Fri"]')).not.toBeNull();
    expect(host.textContent?.match(/Recurring day off/g)).toHaveLength(3);
  });
  it("rejects an externally changed schedule until explicit reload, without silently discarding draft", async () => {
    await render(); await click(button("Edit schedule"));
    fx.members = [{ ...member(), offDays: ["SATURDAY", "SUNDAY"] }]; await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("changed while you were editing");
    expect(button("Save").disabled).toBe(true);
    expect(host.textContent?.match(/Recurring day off/g)).toHaveLength(3);
    await click(button("Reload schedule")); expect(button("Save").disabled).toBe(false);
    expect(host.textContent?.match(/Recurring day off/g)).toHaveLength(2);
  });
  it("switches Staff drafts correctly and retires them on Business change or member removal", async () => {
    fx.members.push({ ...member("staff-b"), offDays: ["MONDAY"] });
    await render(); await click(button("Edit schedule"));
    await click(button("Edit schedule")); // second member replaces the first editor
    expect(host.textContent?.match(/Recurring day off/g)).toHaveLength(1);
    await click(button("Save")); expect(fx.save.mock.calls[0][0].staffId).toBe("staff-b");
    await click(button("Edit schedule"));
    fx.members = []; await render(); expect(host.textContent).toContain("no longer available");
    expect(button("Save")).toBeUndefined();
    fx.businessId = "business-b"; fx.members = [member("other-staff")]; await render();
    expect(host.textContent).not.toContain("no longer available"); expect(button("Save")).toBeUndefined();
  });
  it("handles missing legacy fields and empty weeks; locks editing while saving", async () => {
    fx.members = [{ ...member(), schedule: undefined, offDays: undefined } as unknown as StaffMember];
    await render(); await click(button("Edit schedule"));
    expect(host.textContent).not.toContain("Recurring day off");
    fx.pending = true; await render(); expect(host.querySelector("fieldset")?.disabled).toBe(true);
    expect(button("Cancel").disabled).toBe(true);
    fx.pending = false; await render(); await click(button("Save"));
    expect(fx.save.mock.calls[0][0].input).toEqual({ days: [] });
  });
});

it("the real schedule mutation invalidates only established relevant query families", async () => {
  const { usePutStaffScheduleMutation } = await vi.importActual<typeof import("@/lib/staff/hooks")>("@/lib/staff/hooks");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const keys = [ ["staff", "list", "business-a"], ["staff", "my-schedule", "business-a"],
    ["staff", "my-services", "business-a"], ["bookings", "calendar", "business-a"],
    ["availability", "business-a"], ["catalog", "availability", "business-a", "service"],
    ["catalog", "business", "business-a"], ["dashboardOverview", "business-a"],
    ["bookingRescheduleAvailability", "customer", "business-a", "booking-a"],
    ["bookingRescheduleAvailability", "business", "business-b", "booking-b"],
    ["staff", "list", "business-b"], ["catalog", "availability", "business-b", "service"], ["finance", "summary", "business-a"] ];
  keys.forEach(key => client.setQueryData(key, {}));
  let save!: () => Promise<unknown>;
  function Probe() { const mutation = usePutStaffScheduleMutation(); save = () => mutation.mutateAsync({ businessId: "business-a", staffId: "staff-a", input: { days: [] } }); return null; }
  await render(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
  await act(async () => { await save(); });
  for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(key[2] !== "business-b" && key[0] !== "finance");
  expect(fx.apiSave).toHaveBeenCalledWith("business-a", "staff-a", { days: [] });
  client.clear();
});
