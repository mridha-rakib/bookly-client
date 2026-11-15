import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import DashboardStaffList from "@/components/dashboard/DashboardStaffList";
import { BooklyApiError } from "@/lib/api/client";

const fx = vi.hoisted(() => ({ invite: vi.fn(), timeOff: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/staff/StaffCard", () => ({ default: ({ staff, onEdit }: { staff: { id: string }; onEdit: (id: string) => void }) => <button onClick={() => onEdit(staff.id)}>Edit member</button> }));
vi.mock("@/components/staff/StaffAccessChangeModal", () => ({ default: () => null }));
vi.mock("@/components/staff/StaffPhotoCropModal", () => ({ default: () => null }));
vi.mock("@/components/staff/StaffAvailabilityTable", () => ({ default: () => null }));
vi.mock("@/components/staff/StaffRolePermissions", () => ({ default: () => null }));
vi.mock("@/lib/business/hooks", () => ({ useMyBusinessProfileQuery: () => ({ data: { primary: { id: "business" } } }) }));
vi.mock("@/lib/staff/hooks", () => ({
  useStaffListQuery: () => ({ data: { members: [{ membershipId: "member", userId: "user", name: "Alex", email: "alex@example.com", role: "STAFF", employmentActive: true, schedule: [], offDays: [], timeOff: [] }], invitations: [] } }),
  useCreateStaffMutation: () => ({ mutateAsync: fx.invite }),
  useCreateStaffTimeOffMutation: () => ({ mutateAsync: fx.timeOff }),
  useUpdateStaffMutation: () => ({}), useRemoveStaffMutation: () => ({}), usePutStaffScheduleMutation: () => ({}),
  useRemoveStaffTimeOffMutation: () => ({}), useUploadStaffAvatarMutation: () => ({}),
  useResendStaffInvitationMutation: () => ({}), useRevokeStaffInvitationMutation: () => ({}),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("does not offer unsaved schedule or photo controls when inviting staff", () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<DashboardStaffList />));
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Add Staff member"))!.click());
    expect(host.textContent).toContain("after the invitation is accepted");
    expect(host.textContent).not.toContain("Staff Working Hours");
    expect(host.querySelector('[aria-label="Change staff photo"]')).toBeNull();
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Save changes")!.click());
    expect(host.textContent).toContain("Enter a name and email address");
    expect(fx.invite).not.toHaveBeenCalled();
  } finally { act(() => root.unmount()); }
});

it("requires an explicit date before creating staff time off", () => {
  const host = document.createElement("div"), root = createRoot(host);
  try {
    act(() => root.render(<DashboardStaffList />));
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent === "Edit member")!.click());
    expect(host.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe("");
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Add Holidays"))!.click());
    expect(host.textContent).toContain("Choose a start date");
    expect(fx.timeOff).not.toHaveBeenCalled();
  } finally { act(() => root.unmount()); }
});

it("submits one invitation with the entered identity under rapid clicks", () => {
  const host = document.createElement("div"), root = createRoot(host);
  fx.invite.mockImplementation(() => new Promise(() => {}));
  try {
    act(() => root.render(<DashboardStaffList />));
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Add Staff member"))!.click());
    const name = host.querySelector<HTMLInputElement>('input[placeholder="Hohb doe"]')!;
    const email = host.querySelector<HTMLInputElement>('input[type="email"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => { setValue.call(name, "Alex Test"); name.dispatchEvent(new Event("input", { bubbles: true })); setValue.call(email, "alex@example.com"); email.dispatchEvent(new Event("input", { bubbles: true })); });
    const save = [...host.querySelectorAll("button")].find(button => button.textContent === "Save changes")!;
    act(() => { save.click(); save.click(); });
    expect(fx.invite).toHaveBeenCalledOnce();
    expect(fx.invite).toHaveBeenCalledWith(expect.objectContaining({ businessId: "business", input: expect.objectContaining({ name: "Alex Test", email: "alex@example.com" }) }));
  } finally { act(() => root.unmount()); vi.clearAllMocks(); }
});

it("explains how to recover an invitation whose email failed", async () => {
  const host = document.createElement("div"), root = createRoot(host);
  fx.invite.mockRejectedValue(new BooklyApiError({ message: "Email failed", code: "STAFF_INVITATION_EMAIL_FAILED" }));
  try {
    act(() => root.render(<DashboardStaffList />));
    act(() => [...host.querySelectorAll("button")].find(button => button.textContent?.includes("Add Staff member"))!.click());
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const name = host.querySelector<HTMLInputElement>('input[placeholder="Hohb doe"]')!, email = host.querySelector<HTMLInputElement>('input[type="email"]')!;
    act(() => { setValue.call(name, "Alex"); name.dispatchEvent(new Event("input", { bubbles: true })); setValue.call(email, "alex@example.com"); email.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => { [...host.querySelectorAll("button")].find(button => button.textContent === "Save changes")!.click(); });
    expect(host.textContent).toContain("resend the pending invitation");
  } finally { act(() => root.unmount()); vi.clearAllMocks(); }
});
