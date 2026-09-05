import { apiRequest } from "@/lib/api/client";
import { type DayOfWeek, daysOfWeek } from "@/lib/api/staff";

export { daysOfWeek };
export type { DayOfWeek };

// Matches api/src/modules/business-hours/business-hours.model.ts BusinessOpeningHoursSlot.
export interface BusinessHoursSlot {
  startTime: string;
  endTime: string;
}

// Matches api/src/modules/business-hours/business-hours.service.ts BusinessHoursDayDto.
export interface BusinessHoursDay {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  slots: BusinessHoursSlot[];
}

// Matches api/src/modules/business-hours/business-hours.service.ts BusinessHoursDto.
export interface BusinessHours {
  businessId: string;
  configured: boolean;
  days: BusinessHoursDay[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PutBusinessHoursInput {
  days: BusinessHoursDay[];
}

export const businessHoursApi = {
  get: (businessId: string) =>
    apiRequest<BusinessHours>({
      method: "GET",
      url: `/businesses/${businessId}/opening-hours`,
    }),

  put: (businessId: string, input: PutBusinessHoursInput) =>
    apiRequest<BusinessHours>({
      method: "PUT",
      url: `/businesses/${businessId}/opening-hours`,
      data: input,
    }),
};
