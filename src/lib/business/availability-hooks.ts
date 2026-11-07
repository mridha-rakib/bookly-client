"use client";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { businessAvailabilityApi, type AvailabilityRulesInput, type LocalCalendarRange } from "@/lib/api/business-availability";
import { bookingKeys } from "@/lib/bookings/hooks";

export const businessAvailabilityKeys = {
  rules: (id: string) => ["businessAvailability", id, "rules"] as const,
  blocks: (id: string) => ["businessAvailability", id, "blocks"] as const,
};
export async function invalidateBusinessAvailability(client: QueryClient, businessId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["businessAvailability", businessId] }),
    client.invalidateQueries({ queryKey: ["availability", businessId] }),
    client.invalidateQueries({ queryKey: ["catalog", "availability", businessId] }),
    client.invalidateQueries({ queryKey: ["catalog", "business", businessId] }),
    client.invalidateQueries({ queryKey: bookingKeys.calendars(businessId) }),
    client.invalidateQueries({ queryKey: bookingKeys.rescheduleAvailability }),
    client.invalidateQueries({ queryKey: ["discovery"] }),
    client.invalidateQueries({ queryKey: ["favorite"] }),
  ]);
}
export const useBusinessAvailabilityRulesQuery = (id?: string) => useQuery({ queryKey: businessAvailabilityKeys.rules(id ?? ""), queryFn: () => businessAvailabilityApi.getRules(id!), enabled: Boolean(id) });
export const useCalendarBlocksQuery = (id?: string) => useQuery({ queryKey: businessAvailabilityKeys.blocks(id ?? ""), queryFn: () => businessAvailabilityApi.getBlocks(id!), enabled: Boolean(id) });
export function useUpdateBusinessAvailabilityMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ businessId, input }: { businessId: string; input: AvailabilityRulesInput }) => businessAvailabilityApi.putRules(businessId, input),
    onSuccess: async (_result, variables) => { await invalidateBusinessAvailability(client, variables.businessId); } });
}
export function useChangeCalendarBlocksMutation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ businessId, ...input }: { businessId: string; action: "BLOCK" | "UNBLOCK"; intervals: LocalCalendarRange[] }) => businessAvailabilityApi.changeBlocks(businessId, input),
    onSuccess: async (_result, variables) => { await invalidateBusinessAvailability(client, variables.businessId); } });
}
