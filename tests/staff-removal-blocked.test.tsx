import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import DashboardStaffList from "@/components/dashboard/DashboardStaffList";
import { BooklyApiError } from "@/lib/api/client";

/** Fix #6 — a removal or deactivation refused because of unresolved appointments is explained,
 * never reported as success, and leaves the professional active and listed. */
const fx = vi.hoisted(() => ({ remove: vi.fn(), update: vi.fn(), success: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/staff/StaffCard", () => ({
  default: ({ staff, onEdit, onToggleStatus }: { staff: { id: string; status: string }; onEdit: (id: string) => void; onToggleStatus: (id: string) => void }) => (
    <div>
      <span>Status: {staff.status}</span>
      <button onClick={() => onEdit(staff.id)}>Edit member</button>
      <button onClick={() => onToggleStatus(staff.id)}>Toggle access</button>
    </div>
  ),
}));
vi.mock("@/components/staff/StaffPhotoCropModal", () => ({ default: () => null }));
vi.mock("@/components/staff/StaffAvailabilityTable", () => ({ default: () => null }));
vi.mock("@/components/staff/StaffRolePermissions", () => ({ default: () => null }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: fx.success, error: vi.fn() } }));
vi.mock("@/lib/business/hooks", () => ({ useMyBusinessProfileQuery: () => ({ data: { primary: { id: "business", name: "Salon" } } }) }));
vi.mock("@/lib/staff/hooks", () => ({
  useStaffListQuery: () => ({ data: { members: [{ membershipId: "member", userId: "user", name: "Alex", email: "alex@example.com", role: "STAFF", employmentActive: true, schedule: [], offDays: [], timeOff: [] }], invitations: [] } }),
  useCreateStaffMutation: () => ({}), useCreateStaffTimeOffMutation: () => ({}),
  useUpdateStaffMutation: () => ({ mutateAsync: fx.update, isPending: false }),
  useRemoveStaffMutation: () => ({ mutateAsync: fx.remove, isPending: false }),
  usePutStaffScheduleMutation: () => ({}), useRemoveStaffTimeOffMutation: () => ({}),
  useUploadStaffAvatarMutation: () => ({}), useResendStaffInvitationMutation: () => ({}),
  useRevokeStaffInvitationMutation: () => ({}),
}));

const blocked = () =>
  new BooklyApiError({
    message: "This staff member has active or upcoming bookings. Resolve or reassign these appointments before removing the staff member.",
    status: 409,
    code: "STAFF_REMOVAL_BLOCKED_BY_BOOKINGS",
  });
const button = (host: HTMLElement, text: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("confirm", () => true);
  fx.remove.mockReset(); fx.update.mockReset(); fx.success.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

it("explains a blocked removal, keeps the edit form open and reports no success", async () => {
  fx.remove.mockRejectedValue(blocked());
  await act(async () => root.render(<DashboardStaffList />));
  await act(async () => button(host, "Edit member")!.click());
  await act(async () => button(host, "Delete")!.click());
  expect(fx.remove).toHaveBeenCalledOnce();
  expect(host.textContent).toContain("active or upcoming bookings");
  expect(host.textContent).toContain("Nothing was changed");
  expect(button(host, "Delete")).toBeDefined(); // still editing the same member
  expect(fx.success).not.toHaveBeenCalled();
});

it("explains a blocked deactivation inside the confirmation dialog and keeps the member active", async () => {
  fx.update.mockRejectedValue(blocked());
  await act(async () => root.render(<DashboardStaffList />));
  await act(async () => button(host, "Toggle access")!.click());
  await act(async () => button(host, "Continue")!.click());
  await act(async () => button(host, "Deactivate Staff")!.click());
  expect(fx.update).toHaveBeenCalledWith(expect.objectContaining({ input: { employmentActive: false } }));
  expect(host.textContent).toContain("active or upcoming bookings");
  expect(button(host, "Deactivate Staff")).toBeDefined(); // dialog stays open on the error
  expect(host.textContent).toContain("Status: Active");
  expect(fx.success).not.toHaveBeenCalled();
});
