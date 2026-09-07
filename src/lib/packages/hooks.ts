"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  packagesApi,
  type PackagePurchaseInput,
  type RedeemPackageSessionInput,
} from "@/lib/api/packages";

export const packageKeys = {
  all: ["packages"] as const,
  list: () => [...packageKeys.all, "list"] as const,
  detail: (packageProgressId: string) => [...packageKeys.all, "detail", packageProgressId] as const,
};

/** "My Packages" — cross-business, matches useMyBookingsQuery's own cross-business convention. */
export const useMyPackagesQuery = () =>
  useQuery({
    queryKey: packageKeys.list(),
    queryFn: () => packagesApi.listForCustomer(),
  });

export const usePackageDetailQuery = (packageProgressId: string | undefined) =>
  useQuery({
    queryKey: packageKeys.detail(packageProgressId ?? ""),
    queryFn: () => packagesApi.getForCustomer(packageProgressId as string),
    enabled: Boolean(packageProgressId),
  });

/** Read-only quote for a Package purchase — same "recompute the real, server-trusted quote"
 * pattern as usePreviewCustomerBookingMutation. Never trust a client-computed total. */
export const usePreviewPackagePurchaseMutation = () =>
  useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: PackagePurchaseInput }) =>
      packagesApi.previewPurchase(businessId, input),
  });

/** The real Package purchase — may return `{status: "requires_action", clientSecret}` for 3DS,
 * same discriminated shape and same "retry with the same idempotencyKey" contract as
 * useFinalizeCustomerBookingMutation. */
export const usePurchasePackageMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: PackagePurchaseInput }) =>
      packagesApi.purchase(businessId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packageKeys.list() });
    },
  });
};

/** Redeem one remaining session — the base session itself is always $0, but a selected Add-on
 * or (for a TRAVEL_TO_CUSTOMER business) a real travel fee may still require payment, so this
 * may return `{status: "requires_action", clientSecret}` for 3DS, same discriminated shape as
 * usePurchasePackageMutation above. */
export const useRedeemPackageSessionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      packageProgressId,
      input,
    }: {
      businessId: string;
      packageProgressId: string;
      input: RedeemPackageSessionInput;
    }) => packagesApi.redeemSession(businessId, packageProgressId, input),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: packageKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: packageKeys.detail(variables.packageProgressId),
      });
    },
  });
};

/** Whole-Package refund/void — only succeeds while completely unused (see packagesApi.voidPackage's
 * own doc comment). */
export const useVoidPackageMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      packageProgressId,
      reason,
    }: {
      businessId: string;
      packageProgressId: string;
      reason?: string;
    }) => packagesApi.voidPackage(businessId, packageProgressId, reason),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: packageKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: packageKeys.detail(variables.packageProgressId),
      });
    },
  });
};
