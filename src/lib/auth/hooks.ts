"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import {
  authApi,
  customerAppleAuthStartUrl,
  customerFacebookAuthStartUrl,
  customerGoogleAuthStartUrl,
  professionalAppleAuthStartUrl,
  professionalFacebookAuthStartUrl,
  professionalGoogleAuthStartUrl,
  staffInvitationGoogleStartUrl,
} from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";

export const useCustomerEntryMutation = () => useMutation({ mutationFn: authApi.customerEntry });

/**
 * Phase 2B — Customer "Continue with Google". A navigation-only mutation (same idiom as
 * useLinkGoogleAccountMutation): it just does a full-page redirect to the backend start endpoint,
 * which owns the entire OAuth handshake. `isPending` stays true through the redirect so the
 * button can show a "Redirecting…" state. No session is created here — the backend redirects
 * back to /auth/google/callback and the auth store restores the session from the refresh cookie.
 */
export const useCustomerGoogleAuthMutation = () =>
  useMutation({
    mutationFn: async () => {
      window.location.assign(customerGoogleAuthStartUrl());
      // Resolve only after navigation is under way so the button never flips back to idle.
      await new Promise<void>(() => {});
    },
  });

export const useProfessionalEntryMutation = () =>
  useMutation({ mutationFn: authApi.professionalEntry });

/**
 * Phase 2C — Business Owner "Continue with Google". Navigation-only, same idiom as
 * useCustomerGoogleAuthMutation. No User or session is created here — the backend redirects back
 * to /auth/google/callback?flow=professional&status=… and, for a new owner, hands back a
 * RegistrationSession id to resume the existing onboarding (visit type is collected later, after
 * profile/phone verification — it is no longer needed up front).
 */
export const useProfessionalGoogleAuthMutation = () =>
  useMutation({
    mutationFn: async () => {
      window.location.assign(professionalGoogleAuthStartUrl());
      await new Promise<void>(() => {});
    },
  });

/**
 * Customer "Continue with Facebook" — LOGIN (and, email permitting, signup). Navigation-only,
 * exact same idiom as useCustomerGoogleAuthMutation: a synchronous full-page redirect to the
 * backend `start` endpoint, which owns the whole OAuth handshake and sets the CSRF nonce cookie.
 * No session is created here — the backend redirects back to /auth/facebook/callback?status=…
 * This is NOT the Settings "Link Facebook" flow and never hits its authenticated route.
 */
export const useCustomerFacebookAuthMutation = () =>
  useMutation({
    mutationFn: async () => {
      window.location.assign(customerFacebookAuthStartUrl());
      await new Promise<void>(() => {});
    },
  });

/** Business Owner "Continue with Facebook". Navigation-only, same idiom as
 * useProfessionalGoogleAuthMutation. */
export const useProfessionalFacebookAuthMutation = () =>
  useMutation({
    mutationFn: async () => {
      window.location.assign(professionalFacebookAuthStartUrl());
      await new Promise<void>(() => {});
    },
  });

/**
 * Customer "Continue with Apple" — LOGIN. Navigation-only, identical idiom to
 * useCustomerFacebookAuthMutation: a synchronous full-page redirect to the backend `start`
 * endpoint. The backend 302s to Apple; Apple POSTs its callback (form_post) to the backend, which
 * redirects to /auth/apple/callback?status=… No session, no cookie handled here. This is NOT the
 * Settings "Link Apple" flow.
 */
export const useCustomerAppleAuthMutation = () =>
  useMutation({
    mutationFn: async () => {
      window.location.assign(customerAppleAuthStartUrl());
      await new Promise<void>(() => {});
    },
  });

/** Business Owner "Continue with Apple". Navigation-only, same idiom as
 * useProfessionalGoogleAuthMutation. */
export const useProfessionalAppleAuthMutation = () =>
  useMutation({
    mutationFn: async () => {
      window.location.assign(professionalAppleAuthStartUrl());
      await new Promise<void>(() => {});
    },
  });

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

// --- Phase 2D: Staff/Supervisor invitation acceptance (public — no session yet) --------------

/** Fetches the safe, non-secret invitation info to render the accept screen. */
export const useStaffInvitationQuery = (token: string) =>
  useQuery({
    queryKey: ["staff-invitation", token],
    queryFn: () => authApi.getStaffInvitation(token),
    enabled: Boolean(token),
    retry: false,
  });

/** Accepts the invitation by setting a password; the backend creates User+Profile+Membership
 * in one transaction and returns a session, which we push into the auth store. */
export const useAcceptStaffInvitationPasswordMutation = () => {
  const setAuth = useAuthStore((state) => state.setAuth);
  return useMutation({
    mutationFn: authApi.acceptStaffInvitationWithPassword,
    onSuccess: setAuth,
  });
};

/** Navigation-only, same idiom as the other Google mutations — full-page redirect to the
 * backend start endpoint, which re-validates the token and owns the OAuth handshake. */
export const useStaffInvitationGoogleMutation = () =>
  useMutation({
    mutationFn: async (token: string) => {
      window.location.assign(staffInvitationGoogleStartUrl(token));
      await new Promise<void>(() => {});
    },
  });

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

// Onboarding-only recovery: replace an unverified registration phone and send a fresh code to it
// in one call — see AuthService.changeProfessionalPhone. Rejected server-side once verified.
export const useChangeProfessionalPhoneMutation = () =>
  useMutation({ mutationFn: authApi.changeProfessionalPhone });

// Post-phone-verification, pre-Business-Form onboarding step. Same allow-list on the backend
// (PHONE_VERIFIED or, idempotently, VISIT_TYPE_SELECTED) as a resume/confirm — see
// AuthService.saveProfessionalVisitType.
export const useSaveProfessionalVisitTypeMutation = () =>
  useMutation({ mutationFn: authApi.saveProfessionalVisitType });

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

// Customer account closure. Deliberately no store side-effect here: on success the modal
// navigates to /account-closed, and THAT page runs the client auth teardown (clearAuth +
// queryClient.clear). Clearing auth from this hook would race RequireCustomer's
// "unauthenticated -> /select-role" redirect on the Settings page.
export const useDeleteMyAccountMutation = () =>
  useMutation({ mutationFn: authApi.deleteMyAccount });

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

// Shared by the Google + Facebook "Link" mutations (customer/settings Linked Accounts). Both
// fetch a provider consent URL over an authenticated request, then do a full-page redirect; on
// success the browser leaves the page, so the mutation never needs to "finish". The provider
// redirects back to /customer/settings?linkedAccount=<provider>&result=... where the page shows a
// toast and ["auth","me"] refetches on the fresh page load.
//
// `disabled={isPending}` alone can't stop a fast double-click: `isPending` only disables the
// button on the next React commit, so a second click landing in that gap starts a second
// authorize-url request (two signed states minted, two rate-limit hits). The synchronous `ref`
// guard here closes that gap — it's set before the first await and released only on failure, so
// one click = one authorize-url call = one redirect, while a failed attempt stays retryable.
const useProviderLinkMutation = (getAuthUrl: () => Promise<{ authUrl: string }>) => {
  const redirecting = useRef(false);
  return useMutation({
    mutationFn: async () => {
      if (redirecting.current) {
        return;
      }
      redirecting.current = true;
      try {
        const { authUrl } = await getAuthUrl();
        window.location.href = authUrl;
        // Intentionally not released here — navigation is underway; keep the button locked.
      } catch (error) {
        redirecting.current = false;
        throw error;
      }
    },
  });
};

export const useLinkGoogleAccountMutation = () => useProviderLinkMutation(authApi.getGoogleLinkUrl);

// Unlink is an in-page action — on success we invalidate ["auth","me"] so the Linked Accounts
// row re-renders as "Not connected" (same idiom as useDisconnectGoogleCalendarMutation).
export const useUnlinkGoogleAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.unlinkGoogleAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
};

// Customer -> Facebook account linking. Same navigate-away idiom + double-click guard as
// useLinkGoogleAccountMutation (see useProviderLinkMutation). LINKING only, never "Continue with
// Facebook" login.
export const useLinkFacebookAccountMutation = () =>
  useProviderLinkMutation(authApi.getFacebookLinkUrl);

export const useUnlinkFacebookAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.unlinkFacebookAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
};

// Customer -> Apple account linking. Same navigate-away idiom + synchronous double-click ref
// guard as the Google/Facebook link mutations (useProviderLinkMutation). LINKING only.
export const useLinkAppleAccountMutation = () => useProviderLinkMutation(authApi.getAppleLinkUrl);

export const useUnlinkAppleAccountMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.unlinkAppleAccount,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
};
