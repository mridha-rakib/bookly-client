import { apiRequest } from "@/lib/api/client";
import type { DayOfWeek } from "@/lib/api/staff";
import type { BusinessCity } from "@/lib/constants/cities";

// Matches api/src/modules/services/service.types.ts.
export type ServiceStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
/** The subset of statuses a client may set directly when creating/editing a Service. */
export type EditableServiceStatus = "DRAFT" | "ACTIVE" | "INACTIVE";
export type ServicePricingMode = "FIXED" | "HOURLY" | "PER_PERSON";
export type ServiceScheduleMode = "AUTO" | "MANUAL";

export interface ServiceCategory {
  id: string;
  businessId: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceFixedPricing {
  priceCents: number;
  durationMin: number;
  bookingIntervalMin?: number;
  bufferAfterMin?: number;
  processingTimeMin?: number;
  discountPercent?: number;
}

export interface ServiceHourlyPricing {
  ratePerHourCents: number;
  minHours: number;
  maxHours: number;
  bufferAfterMin?: number;
}

export interface ServicePerPersonPricing {
  ratePerPersonCents: number;
  minPersons: number;
  maxPersons: number;
  durationMin: number;
  bookingIntervalMin?: number;
  bufferAfterMin?: number;
}

export interface ServicePackagePricing {
  durationMin: number;
  bookingIntervalMin?: number;
  bufferAfterMin?: number;
  processingTimeMin?: number;
  sessionsInPackage: number;
  bundlePriceCents: number;
  discountPercent?: number;
}

export interface ServiceManualScheduleDay {
  dayOfWeek: DayOfWeek;
  isOpen: boolean;
  /** Canonical 24-hour "HH:mm" values — never AM/PM display strings. */
  times: string[];
}

export interface ServiceSessionExpiryAlert {
  enabled: boolean;
  minutesBeforeSessionEnds?: number;
}

export interface AssignedServiceStaff {
  membershipId: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  employmentActive: boolean;
}

export interface Service {
  id: string;
  businessId: string;
  status: ServiceStatus;
  isFeatured: boolean;
  isPackageDeal: boolean;
  category: string;
  /** Absent while the Service is a DRAFT — category/subcategory may not be chosen yet. */
  subcategory?: string;
  serviceCategoryId?: string;
  serviceCategoryName?: string;
  name: string;
  packageServicesName?: string;
  description?: string;
  pricingMode?: ServicePricingMode;
  fixedPricing?: ServiceFixedPricing;
  hourlyPricing?: ServiceHourlyPricing;
  perPersonPricing?: ServicePerPersonPricing;
  packagePricing?: ServicePackagePricing;
  sessionExpiryAlert: ServiceSessionExpiryAlert;
  scheduleMode: ServiceScheduleMode;
  manualSchedule: ServiceManualScheduleDay[];
  servedCities: BusinessCity[];
  assignedStaff: AssignedServiceStaff[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface ServiceStatusCounts {
  draft: number;
  active: number;
  inactive: number;
  archived: number;
}

export interface ServiceListResponse {
  services: Service[];
  counts: ServiceStatusCounts;
}

export interface ListServicesParams {
  status?: "DRAFT" | "ACTIVE" | "INACTIVE";
  archived?: boolean;
}

// Matches api/src/modules/services/service.schema.ts's shared create/update body shape —
// PATCH is full-replace semantics for the whole pricing/schedule configuration, not a
// partial merge (see service.repository.ts replaceById). Validation is status-aware there:
// DRAFT tolerates missing serviceCategoryId/subcategory/pricing/etc — only `name` + `status`
// are unconditionally required.
export interface ServiceInput {
  status: EditableServiceStatus;
  isFeatured: boolean;
  isPackageDeal: boolean;
  serviceCategoryId?: string;
  subcategory?: string;
  name: string;
  packageServicesName?: string;
  description?: string;
  pricingMode?: ServicePricingMode;
  fixedPricing?: ServiceFixedPricing;
  hourlyPricing?: ServiceHourlyPricing;
  perPersonPricing?: ServicePerPersonPricing;
  packagePricing?: ServicePackagePricing;
  sessionExpiryAlert: ServiceSessionExpiryAlert;
  scheduleMode: ServiceScheduleMode;
  manualSchedule?: ServiceManualScheduleDay[];
  servedCities: BusinessCity[];
  assignedStaffMembershipIds: string[];
}

export const servicesApi = {
  listServices: (businessId: string, params: ListServicesParams = {}) =>
    apiRequest<ServiceListResponse>({
      method: "GET",
      url: `/businesses/${businessId}/services`,
      params: {
        ...(params.status ? { status: params.status } : {}),
        ...(params.archived !== undefined ? { archived: String(params.archived) } : {}),
      },
    }),

  getService: (businessId: string, serviceId: string) =>
    apiRequest<Service>({ method: "GET", url: `/businesses/${businessId}/services/${serviceId}` }),

  createService: (businessId: string, input: ServiceInput) =>
    apiRequest<Service>({ method: "POST", url: `/businesses/${businessId}/services`, data: input }),

  updateService: (businessId: string, serviceId: string, input: ServiceInput) =>
    apiRequest<Service>({
      method: "PATCH",
      url: `/businesses/${businessId}/services/${serviceId}`,
      data: input,
    }),

  updateServiceStatus: (businessId: string, serviceId: string, status: "ACTIVE" | "INACTIVE") =>
    apiRequest<Service>({
      method: "PATCH",
      url: `/businesses/${businessId}/services/${serviceId}/status`,
      data: { status },
    }),

  archiveService: (businessId: string, serviceId: string) =>
    apiRequest<undefined>({
      method: "DELETE",
      url: `/businesses/${businessId}/services/${serviceId}`,
    }),

  restoreService: (businessId: string, serviceId: string, status: "ACTIVE" | "INACTIVE") =>
    apiRequest<Service>({
      method: "POST",
      url: `/businesses/${businessId}/services/${serviceId}/restore`,
      data: { status },
    }),

  listCategories: (businessId: string, includeInactive = false) =>
    apiRequest<ServiceCategory[]>({
      method: "GET",
      url: `/businesses/${businessId}/service-categories`,
      params: { includeInactive: String(includeInactive) },
    }),

  createCategory: (businessId: string, name: string) =>
    apiRequest<ServiceCategory>({
      method: "POST",
      url: `/businesses/${businessId}/service-categories`,
      data: { name },
    }),

  updateCategory: (
    businessId: string,
    categoryId: string,
    input: { name?: string; active?: boolean },
  ) =>
    apiRequest<ServiceCategory>({
      method: "PATCH",
      url: `/businesses/${businessId}/service-categories/${categoryId}`,
      data: input,
    }),
};
