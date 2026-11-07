"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/store";
import { homeNoDepositKey, type HomeEligibilitySelection } from "./no-deposit-keys";

export function useHomeNoDepositEligibility(input: HomeEligibilitySelection[]) {
  const user = useAuthStore(state => state.user), status = useAuthStore(state => state.status);
  const initializing = useAuthStore(state => state.isInitializing), epoch = useAuthStore(state => state.cacheEpoch);
  const selections = [...new Map(input.map(value => [`${value.businessId}:${value.serviceId ?? ""}`, value])).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
  const eligibleActor = status === "authenticated" && !initializing && user?.role === "CUSTOMER" && user.status === "ACTIVE";
  const enabled = eligibleActor && selections.length > 0 && selections.length <= 60;
  const client = useQueryClient();
  const previousScope = useRef<{ id: string; epoch: number } | undefined>(undefined);
  useEffect(() => {
    const previous = previousScope.current;
    if (previous && (!eligibleActor || previous.id !== user?.id || previous.epoch !== epoch)) {
      client.removeQueries({ queryKey: ["homeNoDeposit", previous.id, previous.epoch] });
    }
    previousScope.current = eligibleActor && user ? { id: user.id, epoch } : undefined;
  }, [client, eligibleActor, user, epoch]);
  const query = useQuery({
    queryKey: homeNoDepositKey(user?.id, epoch, selections),
    queryFn: () => apiRequest<{ scope: "NEW_ORDINARY_BOOKING"; selections: (HomeEligibilitySelection & { noDepositNeeded: boolean })[] }>({ method: "GET", url: "/discovery/no-deposit-eligibility", params: { selections: JSON.stringify(selections) } }),
    enabled, staleTime: 0, refetchOnMount: "always",
  });
  return { isEligible: (businessId: string, serviceId?: string) => Boolean(enabled && !query.isFetching && !query.isError && query.data?.scope === "NEW_ORDINARY_BOOKING" && query.data.selections.some(value => value.businessId === businessId && value.serviceId === serviceId && value.noDepositNeeded)) };
}
