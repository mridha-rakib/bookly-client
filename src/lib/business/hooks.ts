"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  businessApi,
  type BusinessDetail,
  type BusinessTravelCitySetting,
  type BusinessMediaRole,
  type UpdateBusinessInput,
} from "@/lib/api/business";

export const businessKeys = {
  all: ["businesses"] as const,
  profile: () => [...businessKeys.all, "profile"] as const,
  detail: (businessId: string) => [...businessKeys.all, "detail", businessId] as const,
  media: (businessId: string) => [...businessKeys.all, "media", businessId] as const,
  travelSettings: (businessId: string) =>
    [...businessKeys.all, "travel-settings", businessId] as const,
};

export const useMyBusinessProfileQuery = () =>
  useQuery({
    queryKey: businessKeys.profile(),
    queryFn: businessApi.getMyProfile,
  });

export const useBusinessQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: businessKeys.detail(businessId ?? ""),
    queryFn: () => businessApi.getBusiness(businessId as string),
    enabled: Boolean(businessId),
  });

export const useUpdateBusinessMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: UpdateBusinessInput }) =>
      businessApi.updateBusiness(businessId, input),
    onSuccess: (business: BusinessDetail) => {
      queryClient.setQueryData(businessKeys.detail(business.id), business);
      void queryClient.invalidateQueries({ queryKey: businessKeys.profile() });
    },
  });
};

export const useBusinessMediaQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: businessKeys.media(businessId ?? ""),
    queryFn: () => businessApi.getBusinessMedia(businessId as string),
    enabled: Boolean(businessId),
  });

export const useUploadBusinessMediaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, file }: { businessId: string; file: File }) =>
      businessApi.uploadBusinessMedia(businessId, file),
    onSuccess: (_media, variables) => {
      void queryClient.invalidateQueries({ queryKey: businessKeys.media(variables.businessId) });
    },
  });
};

export const useDeleteBusinessMediaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      mediaId,
    }: {
      businessId: string;
      mediaId: string;
      role?: BusinessMediaRole;
    }) => businessApi.deleteBusinessMedia(businessId, mediaId),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: businessKeys.media(variables.businessId) });
      if (variables.role === "PROFILE") {
        void queryClient.invalidateQueries({ queryKey: businessKeys.profile() });
      }
    },
  });
};

export const useSetBusinessProfileMediaMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, mediaId }: { businessId: string; mediaId: string }) =>
      businessApi.setBusinessProfileMedia(businessId, mediaId),
    onSuccess: (_media, variables) => {
      void queryClient.invalidateQueries({ queryKey: businessKeys.media(variables.businessId) });
      void queryClient.invalidateQueries({ queryKey: businessKeys.profile() });
    },
  });
};

export const useBusinessTravelSettingsQuery = (businessId: string | undefined) =>
  useQuery({
    queryKey: businessKeys.travelSettings(businessId ?? ""),
    queryFn: () => businessApi.getBusinessTravelSettings(businessId as string),
    enabled: Boolean(businessId),
  });

export const useUpdateBusinessTravelSettingsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      cities,
    }: {
      businessId: string;
      cities: BusinessTravelCitySetting[];
    }) => businessApi.updateBusinessTravelSettings(businessId, cities),
    onSuccess: (settings) => {
      queryClient.setQueryData(businessKeys.travelSettings(settings.businessId), settings);
    },
  });
};

// Step 1: request an OTP be sent to the target account email. No profile invalidation
// here — requesting a code must not make a Secondary card appear.
export const useRequestBusinessLinkVerificationMutation = () =>
  useMutation({
    mutationFn: (email: string) => businessApi.requestBusinessLinkVerification(email),
  });

export const useResendBusinessLinkVerificationMutation = () =>
  useMutation({
    mutationFn: (verificationId: string) =>
      businessApi.resendBusinessLinkVerification(verificationId),
  });

// Step 2: only on success does the relationship exist, so this is the only step that
// invalidates the profile query.
export const useVerifyBusinessLinkMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ verificationId, code }: { verificationId: string; code: string }) =>
      businessApi.verifyBusinessLink(verificationId, code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: businessKeys.profile() });
    },
  });
};

export const useUnlinkBusinessMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (businessId: string) => businessApi.unlinkBusiness(businessId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: businessKeys.profile() });
    },
  });
};
