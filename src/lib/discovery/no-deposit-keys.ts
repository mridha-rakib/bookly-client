import type { QueryClient } from "@tanstack/react-query";
export type HomeEligibilitySelection = { businessId: string; serviceId?: string };
export const homeNoDepositKey = (customerId: string | undefined, epoch: number, selections: HomeEligibilitySelection[]) => ["homeNoDeposit", customerId ?? "anonymous", epoch, selections] as const;
export const invalidateHomeNoDepositForBusiness = (client: QueryClient, businessId: string) => client.invalidateQueries({
  predicate: query => query.queryKey[0] === "homeNoDeposit" && Array.isArray(query.queryKey[3]) && query.queryKey[3].some((value: HomeEligibilitySelection) => value.businessId === businessId),
});
