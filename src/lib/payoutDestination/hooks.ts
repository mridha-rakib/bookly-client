"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  payoutDestinationApi,
  type UpdatePayoutDestinationInput,
} from "@/lib/api/payoutDestination";

/**
 * Mirrors lib/finance/hooks.ts's query-key/enabled-gating convention exactly.
 *
 * NOTE on cache discipline: none of these mutations ever write the raw IBAN, the current
 * password or the OTP token into the React Query cache — the update mutation's `onSuccess`
 * invalidates the query so the masked summary is re-read from the backend rather than being
 * reconstructed client-side from what the owner typed.
 */
export const payoutDestinationKeys = {
  all: ["payoutDestination"] as const,
  detail: (businessId: string) => [...payoutDestinationKeys.all, businessId] as const,
};

export const usePayoutDestinationQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: payoutDestinationKeys.detail(businessId ?? ""),
    queryFn: () => payoutDestinationApi.get(businessId as string),
    enabled: Boolean(businessId),
  });

export const useUpdatePayoutDestinationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      input,
    }: {
      businessId: string;
      input: UpdatePayoutDestinationInput;
    }) => payoutDestinationApi.update(businessId, input),
    onSuccess: (_view, variables) => {
      void queryClient.invalidateQueries({
        queryKey: payoutDestinationKeys.detail(variables.businessId),
      });
    },
  });
};

/** OAuth-only owners only — see payoutDestinationApi.requestStepUpOtp's own comment. */
export const useRequestPayoutStepUpOtpMutation = () =>
  useMutation({
    mutationFn: ({ businessId }: { businessId: string }) =>
      payoutDestinationApi.requestStepUpOtp(businessId),
  });

/** The returned `otpAuthorizationToken` is short-lived and single-use: it is consumed by the
 * immediately-following update call. If that update fails, a NEW code must be requested — the
 * same token can never be retried. */
export const useVerifyPayoutStepUpOtpMutation = () =>
  useMutation({
    mutationFn: ({ businessId, code }: { businessId: string; code: string }) =>
      payoutDestinationApi.verifyStepUpOtp(businessId, code),
  });
