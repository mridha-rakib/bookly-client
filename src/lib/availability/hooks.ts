"use client";

import { useQuery } from "@tanstack/react-query";

import { availabilityApi, type CompositeAvailabilityInput, type GetAvailabilityParams } from "@/lib/api/availability";

export const availabilityKeys = {
  all: ["availability"] as const,
  get: (businessId: string, serviceId: string, params: GetAvailabilityParams) =>
    [...availabilityKeys.all, businessId, serviceId, params] as const,
};

/** Real, server-computed slots (staff schedule + business hours + time off + existing
 * reservations already resolved) — never recompute availability client-side (see
 * lib/api/availability.ts's own doc comment). Used by the Business Owner reschedule flow. */
export const useAvailabilityQuery = (
  businessId: string | undefined,
  serviceId: string | undefined,
  params: GetAvailabilityParams,
  enabled = true,
) =>
  useQuery({
    queryKey: availabilityKeys.get(businessId ?? "", serviceId ?? "", params),
    queryFn: () => availabilityApi.get(businessId as string, serviceId as string, params),
    enabled: Boolean(businessId) && Boolean(serviceId) && enabled,
  });

/** The query key contains every line and scheduling input so older slot sets cannot be reused. */
export const useCompositeAvailabilityQuery = (
  scope: "customer" | "business",
  businessId: string | undefined,
  input: CompositeAvailabilityInput,
  enabled = true,
) => useQuery({
  queryKey: [...availabilityKeys.all, "composite", scope, businessId ?? "", input] as const,
  queryFn: () => availabilityApi.getComposite(scope, businessId as string, input),
  enabled: Boolean(businessId) && input.lines.length > 0 && enabled,
});
