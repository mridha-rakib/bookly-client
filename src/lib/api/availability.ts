import { apiRequest } from "@/lib/api/client";

/** Matches api/src/modules/availability/availability.service.ts AvailabilitySlot/AvailabilityDay/
 * AvailabilityResult — the real, server-computed slot engine (staff schedule + business hours +
 * time off + existing reservations, all already resolved). Never recomputed client-side. */
export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  eligibleStaffMembershipIds: string[];
  remainingCapacity?: number;
  source: "AUTO" | "MANUAL";
}

export interface AvailabilityDay {
  date: string;
  isOpen: boolean;
  slots: AvailabilitySlot[];
}

export interface AvailabilityResult {
  businessId: string;
  serviceId: string;
  timezone: string;
  capacityMax: number;
  days: AvailabilityDay[];
}

export interface GetAvailabilityParams {
  fromDate: string;
  toDate: string;
  staffMembershipId?: string;
  partySize?: number;
  customerCity?: string;
}

export const availabilityApi = {
  get: (businessId: string, serviceId: string, params: GetAvailabilityParams) =>
    apiRequest<AvailabilityResult>({
      method: "GET",
      url: `/businesses/${businessId}/services/${serviceId}/availability`,
      params,
    }),
};
