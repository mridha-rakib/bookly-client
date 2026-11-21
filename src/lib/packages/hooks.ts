"use client";
import { invalidateBusinessBookingViews } from "@/lib/bookings/dashboard-cache";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  packagesApi,
  type AcceptedPackagePurchaseInput,
  type PackageRedemptionPreviewInput,
  type PackagePurchaseInput,
  type RecordLegacyPackageBalanceInput,
  type RedeemPackageSessionInput,
} from "@/lib/api/packages";

export const packageKeys = {
  all: ["packages"] as const,
  list: () => [...packageKeys.all, "list"] as const,
  detail: (packageProgressId: string) => [...packageKeys.all, "detail", packageProgressId] as const,
  businessDetail: (businessId: string, packageProgressId: string) =>
    [...packageKeys.all, "business", businessId, "detail", packageProgressId] as const,
  legacyBalance: (businessId: string, packageProgressId: string) =>
    [...packageKeys.all, "business", businessId, "balance", packageProgressId] as const,
};

const customerBookingListsKey = ["customerBookings", "list"] as const;

/** "My Packages" — cross-business, matches useMyBookingsQuery's own cross-business convention. */
export const useMyPackagesQuery = () =>
  useQuery({
    queryKey: packageKeys.list(),
    queryFn: () => packagesApi.listForCustomer(),
  });

export const usePackageDetailQuery = (
  packageProgressId: string | undefined,
  { enabled = true, refetchOnMount = true }: { enabled?: boolean; refetchOnMount?: boolean } = {},
) =>
  useQuery({
    queryKey: packageKeys.detail(packageProgressId ?? ""),
    queryFn: () => packagesApi.getForCustomer(packageProgressId as string),
    enabled: enabled && Boolean(packageProgressId),
    refetchOnMount,
    refetchInterval: query => query.state.data?.voidRefundSettlement?.status === "PENDING" ? 3000 : false,
  });

/** One business-scoped cache entry shared by appointment history and package actions. */
export const useBusinessPackageDetailQuery = (
  businessId: string,
  packageProgressId: string,
  { enabled = true, refetchOnMount = true }: { enabled?: boolean; refetchOnMount?: boolean } = {},
) => useQuery({
  queryKey: packageKeys.businessDetail(businessId, packageProgressId),
  queryFn: () => packagesApi.getForBusiness(businessId, packageProgressId),
  enabled: enabled && Boolean(businessId) && Boolean(packageProgressId),
  refetchOnMount,
  refetchInterval: query => query.state.data?.voidRefundSettlement?.status === "PENDING" ? 3000 : false,
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
    mutationFn: ({ businessId, input }: { businessId: string; input: AcceptedPackagePurchaseInput }) =>
      packagesApi.purchase(businessId, input),
    onSuccess: (_result, variables) => {
      void invalidateBusinessBookingViews(queryClient, variables.businessId);
      void queryClient.invalidateQueries({ queryKey: packageKeys.list() });
      // Session 1 is a real Booking; refresh the cross-business customer list explicitly.
      void queryClient.invalidateQueries({ queryKey: customerBookingListsKey });
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
      void invalidateBusinessBookingViews(queryClient, variables.businessId);
      void queryClient.invalidateQueries({ queryKey: packageKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: packageKeys.detail(variables.packageProgressId),
      });
      void queryClient.invalidateQueries({ queryKey: customerBookingListsKey });
    },
  });
};

export const usePreviewPackageRedemptionMutation = () =>
  useMutation({
    mutationFn: ({
      businessId,
      packageProgressId,
      input,
    }: {
      businessId: string;
      packageProgressId: string;
      input: PackageRedemptionPreviewInput;
    }) => packagesApi.previewRedemption(businessId, packageProgressId, input),
  });

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
      void invalidateBusinessBookingViews(queryClient, variables.businessId);
      void queryClient.invalidateQueries({ queryKey: packageKeys.list() });
      void queryClient.invalidateQueries({
        queryKey: packageKeys.detail(variables.packageProgressId),
      });
      void queryClient.invalidateQueries({ queryKey: customerBookingListsKey });
    },
  });
};

/** Fix #3 — Owner-only Legacy Package purchase balance. */
export const useLegacyPackageBalanceQuery = (
  businessId: string,
  packageProgressId: string,
  { enabled = true }: { enabled?: boolean } = {},
) =>
  useQuery({
    queryKey: packageKeys.legacyBalance(businessId, packageProgressId),
    queryFn: () => packagesApi.getLegacyBalance(businessId, packageProgressId),
    enabled: enabled && Boolean(businessId) && Boolean(packageProgressId),
  });

/** Records a real venue payment; every package/booking view is refreshed from the server after. */
export const useRecordLegacyPackageBalanceMutation = (businessId: string, packageProgressId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordLegacyPackageBalanceInput) =>
      packagesApi.recordLegacyBalancePayment(businessId, packageProgressId, input),
    onSuccess: (balance) => {
      queryClient.setQueryData(packageKeys.legacyBalance(businessId, packageProgressId), balance);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: packageKeys.all });
      void invalidateBusinessBookingViews(queryClient, businessId);
    },
  });
};
