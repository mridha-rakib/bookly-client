"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { paymentsApi } from "@/lib/api/payments";
import { useAuthStore } from "@/lib/auth/store";

/** P2.2.5 — the signed-in Customer's saved card, keyed by identity and auth epoch so another
 * account never sees it after logout or an account switch. */
export const useSavedCardScope = (): string | null => {
  const userId = useAuthStore((state) =>
    state.status === "authenticated" && state.user?.role === "CUSTOMER" ? state.user.id : undefined,
  );
  const epoch = useAuthStore((state) => state.cacheEpoch);
  return userId ? `${userId}:${epoch}` : null;
};

export const savedCardKeys = {
  status: (scope: string | null) => ["savedCardStatus", scope] as const,
};

export const useSavedCardStatusQuery = () => {
  const scope = useSavedCardScope();
  const query = useQuery({
    queryKey: savedCardKeys.status(scope),
    queryFn: () => paymentsApi.getSavedCardStatus(),
    enabled: Boolean(scope),
  });
  return { ...query, data: scope ? query.data : undefined };
};

/** Removal is confirmed by the server before the UI changes (no optimistic removal). On success
 * only this Customer's saved-card reads are refreshed: the card page and the package saved-card
 * summary (checkout's payment step re-reads card status every time it opens). */
export const useRemoveSavedCardMutation = () => {
  const queryClient = useQueryClient();
  const scope = useSavedCardScope();
  const userId = useAuthStore((state) => state.user?.id);
  return useMutation({
    mutationFn: (paymentMethodId: string) => paymentsApi.removeSavedCard(paymentMethodId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: savedCardKeys.status(scope) });
      if (userId) void queryClient.invalidateQueries({ queryKey: ["packageSavedCard", userId] });
    },
  });
};
