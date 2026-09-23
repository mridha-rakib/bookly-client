"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { superAdminPayoutDestinationApi } from "@/lib/api/superAdminPayoutDestination";

/** Mirrors lib/superAdminFinance/hooks.ts's key/enabled-gating convention exactly. */
export const superAdminPayoutDestinationKeys = {
  all: ["superAdminPayoutDestination"] as const,
  detail: (businessId: string) => [...superAdminPayoutDestinationKeys.all, businessId] as const,
};

export const useSuperAdminPayoutDestinationQuery = (
  businessId: string | undefined,
  options: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: superAdminPayoutDestinationKeys.detail(businessId ?? ""),
    queryFn: () => superAdminPayoutDestinationApi.get(businessId as string),
    enabled: Boolean(businessId) && (options.enabled ?? true),
  });

/**
 * Deliberately a mutation and NOT a query: revealing decrypts and audits server-side and is
 * rate-limited, so it must only ever run from an explicit operator click. Its result is never
 * cached by React Query — the caller holds the plaintext IBAN in local component state and
 * clears it on close/unmount/confirm.
 */
export const useRevealSuperAdminPayoutDestinationMutation = () =>
  useMutation({
    mutationFn: ({ businessId }: { businessId: string }) =>
      superAdminPayoutDestinationApi.reveal(businessId),
    gcTime: 0,
  });
