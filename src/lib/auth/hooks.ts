"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";

export const useCustomerEntryMutation = () => useMutation({ mutationFn: authApi.customerEntry });

export const useProfessionalEntryMutation = () =>
  useMutation({ mutationFn: authApi.professionalEntry });

export const useCustomerLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: authApi.customerLogin,
    onSuccess: setAuth,
  });
};

export const useProfessionalLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: authApi.professionalLogin,
    onSuccess: setAuth,
  });
};

// Only writes auth state when the response role actually is SUPER_ADMIN — the backend
// (roleMatchesPortal) already guarantees this, but the store is not the security boundary,
// so the dashboard guard must never be reachable off an unexpected role.
export const useSuperAdminLoginMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: authApi.superAdminLogin,
    onSuccess: (auth) => {
      if (auth.user.role === "SUPER_ADMIN") {
        setAuth(auth);
      }
    },
  });
};

export const useSendCustomerEmailOtpMutation = () =>
  useMutation({ mutationFn: authApi.sendCustomerEmailOtp });

export const useResendCustomerEmailOtpMutation = () =>
  useMutation({ mutationFn: authApi.resendCustomerEmailOtp });

export const useVerifyCustomerEmailOtpMutation = () =>
  useMutation({ mutationFn: authApi.verifyCustomerEmailOtp });

export const useSubmitCustomerProfileMutation = () =>
  useMutation({ mutationFn: authApi.submitCustomerProfile });

export const useSendCustomerPhoneOtpMutation = () =>
  useMutation({ mutationFn: authApi.sendCustomerPhoneOtp });

export const useResendCustomerPhoneOtpMutation = () =>
  useMutation({ mutationFn: authApi.resendCustomerPhoneOtp });

export const useCompleteCustomerPhoneOtpMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: authApi.completeCustomerPhoneOtp,
    onSuccess: setAuth,
  });
};

export const useSendProfessionalEmailOtpMutation = () =>
  useMutation({ mutationFn: authApi.sendProfessionalEmailOtp });

export const useResendProfessionalEmailOtpMutation = () =>
  useMutation({ mutationFn: authApi.resendProfessionalEmailOtp });

export const useVerifyProfessionalEmailOtpMutation = () =>
  useMutation({ mutationFn: authApi.verifyProfessionalEmailOtp });

export const useSubmitProfessionalProfileMutation = () =>
  useMutation({ mutationFn: authApi.submitProfessionalProfile });

export const useSendProfessionalPhoneOtpMutation = () =>
  useMutation({ mutationFn: authApi.sendProfessionalPhoneOtp });

export const useResendProfessionalPhoneOtpMutation = () =>
  useMutation({ mutationFn: authApi.resendProfessionalPhoneOtp });

export const useVerifyProfessionalPhoneOtpMutation = () =>
  useMutation({ mutationFn: authApi.verifyProfessionalPhoneOtp });

export const useSaveBusinessDetailsMutation = () =>
  useMutation({ mutationFn: authApi.saveBusinessDetails });

export const useSaveCategoriesMutation = () => useMutation({ mutationFn: authApi.saveCategories });

export const useCompleteBusinessOwnerMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: authApi.completeBusinessOwner,
    onSuccess: setAuth,
  });
};

// Authoritative registration-session data (email, verified name/phone) for hydrating
// read-only identity fields — survives refresh/remount since it's re-fetched from the
// server rather than kept only in transient React state.
export const useProfessionalRegistrationProgressQuery = (sessionId: string) =>
  useQuery({
    queryKey: ["professional-registration-progress", sessionId],
    queryFn: () => authApi.professionalProgress(sessionId),
    enabled: Boolean(sessionId),
    retry: 1,
  });

// GET /auth/me — the only source for a SUPERVISOR's (or STAFF's) businessId today; Business
// Owners should keep using useMyBusinessProfileQuery (lib/business/hooks.ts), which is already
// the established idiom for the Owner dashboard.
export const useCurrentUserQuery = (options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    // Default (undefined) keeps the existing always-on behaviour for authenticated screens.
    // Shared components mounted on public pages (Navbar) pass `enabled: false` when the auth
    // store is not "authenticated" so GET /auth/me is never fired for an anonymous visitor.
    ...(options?.enabled === undefined ? {} : { enabled: options.enabled }),
  });

export const useUpdateMyProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.updateMyProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
    },
  });
};

// Customer avatar upload/replace. The endpoint returns the full current-user payload, so on
// success we write it straight into the ["auth","me"] cache — Profile, Navbar and the customer
// dropdown all read the new avatarUrl from that single cache entry, no second request, no
// per-surface avatar state.
export const useUpdateMyAvatarMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.updateMyAvatar,
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
    },
  });
};

export const useChangeMyPasswordMutation = () =>
  useMutation({ mutationFn: authApi.changeMyPassword });

// Batch 18 — Customer email/phone self-change. Requesting/resending never touches cached /auth/me
// state (the old contact stays authoritative until verified); only a successful verify updates it.
export const useRequestEmailChangeMutation = () =>
  useMutation({ mutationFn: authApi.requestEmailChange });

export const useVerifyEmailChangeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.verifyEmailChange,
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
    },
  });
};

export const useRequestPhoneChangeMutation = () =>
  useMutation({ mutationFn: authApi.requestPhoneChange });

export const useVerifyPhoneChangeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.verifyPhoneChange,
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
    },
  });
};
