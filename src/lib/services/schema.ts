import { z } from "zod";

import type { ServiceInput } from "@/lib/api/services";
import { BUSINESS_CITIES } from "@/lib/constants/cities";

// Client-side mirror of api/src/modules/services/service.schema.ts's discriminated rules —
// for immediate inline UX feedback only. The server remains the authority (see
// service.service.ts / service.schema.ts); nothing here replaces that validation.
const centsSchema = z.number().int("Must be a whole number of cents").min(0);
const positiveIntSchema = z.number().int().min(1, "Must be at least 1");
const nonNegIntSchema = z.number().int().min(0);
const discountPercentSchema = z.number().min(0).max(100, "Must be between 0 and 100");

const fixedPricingSchema = z.object({
  priceCents: centsSchema,
  durationMin: positiveIntSchema,
  bookingIntervalMin: positiveIntSchema.optional(),
  bufferAfterMin: nonNegIntSchema.optional(),
  processingTimeMin: nonNegIntSchema.optional(),
  discountPercent: discountPercentSchema.optional(),
});

const hourlyPricingSchema = z
  .object({
    ratePerHourCents: centsSchema,
    minHours: positiveIntSchema,
    maxHours: positiveIntSchema,
    bufferAfterMin: nonNegIntSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.maxHours < value.minHours) {
      context.addIssue({
        code: "custom",
        path: ["maxHours"],
        message: "Max hours must be greater than or equal to min hours",
      });
    }
  });

const perPersonPricingSchema = z
  .object({
    ratePerPersonCents: centsSchema,
    minPersons: positiveIntSchema,
    maxPersons: positiveIntSchema,
    durationMin: positiveIntSchema,
    bookingIntervalMin: positiveIntSchema.optional(),
    bufferAfterMin: nonNegIntSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.maxPersons < value.minPersons) {
      context.addIssue({
        code: "custom",
        path: ["maxPersons"],
        message: "Max persons must be greater than or equal to min persons",
      });
    }
  });

const packagePricingSchema = z.object({
  durationMin: positiveIntSchema,
  bookingIntervalMin: positiveIntSchema.optional(),
  bufferAfterMin: nonNegIntSchema.optional(),
  processingTimeMin: nonNegIntSchema.optional(),
  sessionsInPackage: positiveIntSchema,
  bundlePriceCents: centsSchema,
  discountPercent: discountPercentSchema.optional(),
});

const manualScheduleDaySchema = z.object({
  dayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
  isOpen: z.boolean(),
  times: z.array(z.string()),
});

export const serviceInputSchema = z
  .object({
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
    isFeatured: z.boolean(),
    isPackageDeal: z.boolean(),
    serviceCategoryId: z.string().min(1, "Select a service category").optional(),
    subcategory: z.string().min(1, "Select a sub category").optional(),
    name: z.string().trim().min(1, "Required").max(200),
    packageServicesName: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    pricingMode: z.enum(["FIXED", "HOURLY", "PER_PERSON"]).optional(),
    fixedPricing: fixedPricingSchema.optional(),
    hourlyPricing: hourlyPricingSchema.optional(),
    perPersonPricing: perPersonPricingSchema.optional(),
    packagePricing: packagePricingSchema.optional(),
    sessionExpiryAlert: z.object({
      enabled: z.boolean(),
      minutesBeforeSessionEnds: positiveIntSchema.optional(),
    }),
    scheduleMode: z.enum(["AUTO", "MANUAL"]),
    manualSchedule: z.array(manualScheduleDaySchema).optional(),
    servedCities: z.array(z.enum(BUSINESS_CITIES)),
    assignedStaffMembershipIds: z.array(z.string()),
  })
  .superRefine((value, context) => {
    // DRAFT tolerates incomplete data — a Business Owner may save a Service before picking a
    // category, pricing, or schedule. Only `name` (checked above, unconditionally) is
    // required. Mirrors api/src/modules/services/service.schema.ts's status-aware validation.
    if (value.status === "DRAFT") {
      return;
    }

    if (!value.serviceCategoryId) {
      context.addIssue({ code: "custom", path: ["serviceCategoryId"], message: "Select a service category" });
    }
    if (!value.subcategory) {
      context.addIssue({ code: "custom", path: ["subcategory"], message: "Select a sub category" });
    }

    if (value.isPackageDeal) {
      if (!value.packagePricing) {
        context.addIssue({ code: "custom", path: ["packagePricing"], message: "Required" });
      }
      if (!value.packageServicesName) {
        context.addIssue({ code: "custom", path: ["packageServicesName"], message: "Required" });
      }
    } else {
      if (!value.pricingMode) {
        context.addIssue({ code: "custom", path: ["pricingMode"], message: "Select a pricing type" });
      } else if (value.pricingMode === "FIXED" && !value.fixedPricing) {
        context.addIssue({ code: "custom", path: ["fixedPricing"], message: "Required" });
      } else if (value.pricingMode === "HOURLY" && !value.hourlyPricing) {
        context.addIssue({ code: "custom", path: ["hourlyPricing"], message: "Required" });
      } else if (value.pricingMode === "PER_PERSON" && !value.perPersonPricing) {
        context.addIssue({ code: "custom", path: ["perPersonPricing"], message: "Required" });
      }
    }

    if (value.sessionExpiryAlert.enabled && value.sessionExpiryAlert.minutesBeforeSessionEnds === undefined) {
      context.addIssue({
        code: "custom",
        path: ["sessionExpiryAlert", "minutesBeforeSessionEnds"],
        message: "Required when alerts are enabled",
      });
    }

    if (value.scheduleMode === "MANUAL") {
      const openDaysWithoutTimes = (value.manualSchedule ?? []).filter(
        (day) => day.isOpen && day.times.length === 0,
      );
      if (!value.manualSchedule || value.manualSchedule.every((day) => !day.isOpen)) {
        context.addIssue({ code: "custom", path: ["manualSchedule"], message: "Set at least one open day" });
      } else if (openDaysWithoutTimes.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["manualSchedule"],
          message: `Add at least one time for ${openDaysWithoutTimes[0]!.dayOfWeek}`,
        });
      }
    }
  });

export type ServiceFormErrors = Record<string, string>;

/** Flattens a ZodError into `{ "fixedPricing.priceCents": "message" }` for simple field lookup. */
export const flattenServiceErrors = (error: z.ZodError): ServiceFormErrors => {
  const errors: ServiceFormErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
};

export const validateServiceInput = (
  input: ServiceInput,
): { success: true; data: ServiceInput } | { success: false; errors: ServiceFormErrors } => {
  const result = serviceInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as ServiceInput };
  }
  return { success: false, errors: flattenServiceErrors(result.error) };
};
