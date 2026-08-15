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

// Canonical 24-hour "HH:mm" — never displayed to users directly, see lib/utils/staffTime.ts.
export interface ScheduleDay {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
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
  /** Empty for the synthesized Owner row — Owner has no time off in this phase. */
  timeOff: StaffTimeOffEntry[];
  avatarUrl?: string;
}

export interface UploadStaffAvatarResult {
  userId: string;
  avatarUrl: string;
}

export interface StaffListResponse {
  businessId: string;
  members: StaffMember[];
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
}

export interface CreateTimeOffInput {
  type: StaffTimeOffType;
  startDate: string;
  /** Omit for a single-day entry. */
  endDate?: string;
}

export const staffApi = {
  listStaff: (businessId: string) =>
    apiRequest<StaffListResponse>({ method: "GET", url: `/businesses/${businessId}/staff` }),

  createStaff: (businessId: string, input: CreateStaffInput) =>
    apiRequest<StaffMember>({
      method: "POST",
      url: `/businesses/${businessId}/staff`,
      data: input,
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
};
