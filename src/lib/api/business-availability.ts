import { apiRequest } from "@/lib/api/client";

export interface ClosedPeriod { startDate: string; endDate: string; note?: string }
export interface AvailabilityRulesInput {
  minimumNoticeMinutes: number | null;
  maximumAdvanceMonths: number | null;
  closedPeriods: ClosedPeriod[];
  publicVisible: boolean;
}
export interface BusinessAvailabilityRules extends AvailabilityRulesInput { businessId: string; timezone: string; overlappingBookings?: number }
export interface CalendarBlock { staffMembershipId?: string; startAt: string; endAt: string }
export interface LocalCalendarRange { staffMembershipId?: string; startDate: string; startTime: string; endDate: string; endTime: string }
export interface CalendarBlocks { businessId: string; timezone: string; blocks: CalendarBlock[]; closedPeriods: ClosedPeriod[] }
export const businessAvailabilityApi = {
  getRules: (businessId: string) => apiRequest<BusinessAvailabilityRules>({ method: "GET", url: `/businesses/${businessId}/availability-rules` }),
  putRules: (businessId: string, input: AvailabilityRulesInput) => apiRequest<BusinessAvailabilityRules>({ method: "PUT", url: `/businesses/${businessId}/availability-rules`, data: input }),
  getBlocks: (businessId: string) => apiRequest<CalendarBlocks>({ method: "GET", url: `/businesses/${businessId}/calendar-blocks` }),
  changeBlocks: (businessId: string, input: { action: "BLOCK" | "UNBLOCK"; intervals: LocalCalendarRange[] }) => apiRequest<{ businessId: string; blocks: CalendarBlock[]; overlappingBookings: number }>({ method: "PUT", url: `/businesses/${businessId}/calendar-blocks`, data: input }),
};

export const NOTICE_OPTIONS = [["", "Not configured"], ["15", "Up to 15 minutes before start time"], ["30", "Up to 30 minutes before start time"], ["60", "Up to 1 hour before start time"], ["120", "Up to 2 hours before start time"], ["1440", "Up to 24 hours before start time"]] as const;
export const ADVANCE_OPTIONS = [["", "Not configured"], ["12", "12 months in the future"], ["6", "6 months in the future"], ["3", "3 months in the future"], ["1", "1 month in the future"]] as const;
