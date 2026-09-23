import { apiRequest } from "@/lib/api/client";

// Roles a Business Owner may assign to a Staff member. Deliberately excludes
// BUSINESS_OWNER — see api/src/modules/staff/staff.types.ts (server-side allowlist).
export type StaffCreatableRole = "SUPERVISOR" | "STAFF";
export type StaffDisplayRole = "BUSINESS_OWNER" | StaffCreatableRole;

export interface StaffPhone {
  countryCode: string;
  nationalNumber: string;
  e164: string;
}

// Matches api/src/modules/staff/staff-schedule.types.ts DayOfWeek — Monday-first, matching
// the existing Add Staff form's day-chip order.
export const daysOfWeek = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
] as const;
export type DayOfWeek = (typeof daysOfWeek)[number];

// Canonical 24-hour "HH:mm" — never displayed to users directly, see lib/staff/format.ts.
export interface ScheduleInterval {
  startTime: string;
  endTime: string;
}

/** A weekday's working hours — zero or more non-overlapping working intervals (split
 * shifts). Gaps between intervals are unavailable for booking (breaks). Empty `intervals`
 * means "no hours configured yet" — distinct from being listed in `offDays`. */
export interface ScheduleDay {
  dayOfWeek: DayOfWeek;
  intervals: ScheduleInterval[];
}

export type StaffTimeOffType = "ANNUAL_HOLIDAY" | "SICK_LEAVE";

export interface StaffTimeOffEntry {
  id: string;
  type: StaffTimeOffType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD; equals startDate for a single day
}

// Matches api/src/modules/staff/staff.service.ts StaffMemberDto.
export interface StaffMember {
  membershipId: string | null; // null for the synthesized Business Owner row
  userId: string;
  businessId: string;
  name: string;
  email: string;
  phone?: StaffPhone;
  role: StaffDisplayRole;
  employmentActive: boolean;
  isOwner: boolean;
  createdAt: string;
  /** Empty for the synthesized Owner row — Owner has no schedule in this phase. */
  schedule: ScheduleDay[];
  /**
   * Explicit recurring weekly Weekend/Off days — never overlaps `schedule`. Empty for the
   * synthesized Owner row and for any schedule saved before this concept existed (a weekday
   * simply absent from `schedule` is NOT the same as an explicit off day here — see
   * api/src/modules/staff/staff-schedule.model.ts).
   */
  offDays: DayOfWeek[];
  /** Empty for the synthesized Owner row — Owner has no time off in this phase. */
  timeOff: StaffTimeOffEntry[];
  avatarUrl?: string;
}

export interface UploadStaffAvatarResult {
  userId: string;
  avatarUrl: string;
}

/** Phase 2D — a PENDING invitation (no User/membership yet) shown alongside members. */
export interface PendingStaffInvitation {
  invitationId: string;
  businessId: string;
  email: string;
  name: string;
  role: StaffCreatableRole;
  status: "PENDING";
  invitedAt: string;
  expiresAt: string;
}

export interface StaffListResponse {
  businessId: string;
  members: StaffMember[];
  /** Empty until someone is invited but has not yet accepted. */
  invitations: PendingStaffInvitation[];
}

export interface CreateStaffInput {
  name: string;
  email: string;
  role: StaffCreatableRole;
  phone?: string;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  role?: StaffCreatableRole;
  phone?: string;
  employmentActive?: boolean;
}

export interface PutScheduleInput {
  days: ScheduleDay[];
  /** Explicit recurring weekly Weekend/Off days. Optional — omitting it keeps exactly the
   * pre-existing behavior (backend defaults it to []). */
  offDays?: DayOfWeek[];
}

export interface CreateTimeOffInput {
  type: StaffTimeOffType;
  startDate: string;
  /** Omit for a single-day entry. */
  endDate?: string;
}

// Matches api/src/modules/staff/staff.service.ts StaffAssignedServiceDto — a deliberately
// minimal read for Staff/Supervisor self-service "my assigned services", not the full
// owner-facing Service shape.
export interface StaffAssignedService {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  status: string;
}

export const staffApi = {
  listStaff: (businessId: string) =>
    apiRequest<StaffListResponse>({ method: "GET", url: `/businesses/${businessId}/staff` }),

  // Phase 2D — issues a PENDING invitation and emails a link; no User is created until the
  // invitee accepts (password or Google).
  createStaff: (businessId: string, input: CreateStaffInput) =>
    apiRequest<PendingStaffInvitation>({
      method: "POST",
      url: `/businesses/${businessId}/staff`,
      data: input,
    }),

  resendInvitation: (businessId: string, invitationId: string) =>
    apiRequest<PendingStaffInvitation>({
      method: "POST",
      url: `/businesses/${businessId}/staff/invitations/${invitationId}/resend`,
    }),

  revokeInvitation: (businessId: string, invitationId: string) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: `/businesses/${businessId}/staff/invitations/${invitationId}`,
    }),

  updateStaff: (businessId: string, staffId: string, input: UpdateStaffInput) =>
    apiRequest<StaffMember>({
      method: "PATCH",
      url: `/businesses/${businessId}/staff/${staffId}`,
      data: input,
    }),

  removeStaff: (businessId: string, staffId: string) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: `/businesses/${businessId}/staff/${staffId}`,
    }),

  uploadStaffAvatar: (businessId: string, staffId: string, file: File) => {
    const data = new FormData();
    data.append("file", file);
    return apiRequest<UploadStaffAvatarResult>({
      method: "PUT",
      url: `/businesses/${businessId}/staff/${staffId}/avatar`,
      data,
    });
  },

  // Business Owner self-service — the Owner has no staffId (never a StaffMembership), so this
  // hits the dedicated /staff/me/avatar endpoint instead of the staffId-based route above.
  uploadOwnerAvatar: (businessId: string, file: File) => {
    const data = new FormData();
    data.append("file", file);
    return apiRequest<UploadStaffAvatarResult>({
      method: "PUT",
      url: `/businesses/${businessId}/staff/me/avatar`,
      data,
    });
  },

  getSchedule: (businessId: string, staffId: string) =>
    apiRequest<ScheduleDay[]>({
      method: "GET",
      url: `/businesses/${businessId}/staff/${staffId}/schedule`,
    }),

  putSchedule: (businessId: string, staffId: string, input: PutScheduleInput) =>
    apiRequest<ScheduleDay[]>({
      method: "PUT",
      url: `/businesses/${businessId}/staff/${staffId}/schedule`,
      data: input,
    }),

  listTimeOff: (businessId: string, staffId: string) =>
    apiRequest<StaffTimeOffEntry[]>({
      method: "GET",
      url: `/businesses/${businessId}/staff/${staffId}/time-off`,
    }),

  createTimeOff: (businessId: string, staffId: string, input: CreateTimeOffInput) =>
    apiRequest<StaffTimeOffEntry>({
      method: "POST",
      url: `/businesses/${businessId}/staff/${staffId}/time-off`,
      data: input,
    }),

  removeTimeOff: (businessId: string, staffId: string, timeOffId: string) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: `/businesses/${businessId}/staff/${staffId}/time-off/${timeOffId}`,
    }),

  // Phase 4A self-service — Staff/Supervisor reading their OWN schedule/assigned services via
  // their own active StaffMembership (never a staffId path param the caller could substitute).
  getMySchedule: (businessId: string) =>
    apiRequest<ScheduleDay[]>({
      method: "GET",
      url: `/businesses/${businessId}/staff/me/schedule`,
    }),

  listMyAssignedServices: (businessId: string) =>
    apiRequest<StaffAssignedService[]>({
      method: "GET",
      url: `/businesses/${businessId}/staff/me/services`,
    }),
};
