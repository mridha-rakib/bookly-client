"use client";

import { create } from "zustand";

import type { AuthResponse, AuthUser } from "@/lib/api/auth";
import {
  BooklyApiError,
  classifyRefreshFailure,
  getAuthGeneration,
  invalidateInFlightAuth,
  refreshSession,
  sendLogoutRequest,
  setOnSessionExpired,
  setOnSessionRestored,
  setOnSessionUnverified,
  setRefreshBlocker,
  setSessionEstablishingHooks,
} from "@/lib/api/client";
import {
  postAuthLoggedOut,
  postAuthLogoutConfirmed,
  postAuthLogoutPending,
  postAuthSessionChanged,
  rememberAnnouncedSession,
  subscribeToAuthBroadcast,
  wasSessionAnnounced,
} from "@/lib/auth/auth-channel";
import {
  beginLogoutIntent,
  clearLogoutIntent,
  forgetLogoutIntentMemory,
  hasLogoutIntent,
  isLogoutIntentPersisted,
  readLogoutIntent,
  rememberRemoteLogoutIntent,
  sameLogoutIntent,
  setLogoutRetryAt,
  subscribeToLogoutIntentStorage,
} from "@/lib/auth/logout-intent";
import type { LogoutIntent } from "@/lib/auth/logout-intent";
import { clearAccessToken, getAccessToken, getSessionFamilyId, setAccessToken } from "@/lib/auth/token-memory";
import { rotateQueryClient } from "@/lib/query-client";

type AuthStatus = "unknown" | "authenticated" | "unauthenticated" | "unverified";

/**
 * Sign-out has three distinct truths, kept separate so the UI never over-claims:
 * - local sign-out: immediate on logout() — `status` becomes "unauthenticated";
 * - "inProgress"/"unconfirmed": the server has not acknowledged POST /auth/logout yet, so the
 *   refresh cookie may still be valid and this browser must not restore it;
 * - "confirmed": the server acknowledged the logout (shown briefly, then "idle").
 */
export type LogoutPhase = "idle" | "inProgress" | "unconfirmed" | "confirmed";
export type LogoutFailureReason = "RATE_LIMITED" | "SERVER_ERROR" | "NETWORK" | "TIMEOUT" | "REJECTED" | "FAMILY_MISMATCH" | "UNVERIFIABLE";
/** "superseded": the pending intent was resolved elsewhere (another tab, or a new sign-in that
 * replaced the refresh cookie) — no claim is made that THIS request revoked anything. */
export type LogoutOutcome = "confirmed" | "unconfirmed" | "superseded";

export interface LogoutStatus {
  phase: LogoutPhase;
  /** Earliest time (ms) another attempt may be sent; set from a 429 Retry-After. */
  retryAt: number | null;
  reason: LogoutFailureReason | null;
  /** False when browser storage is unavailable: the pending state then cannot survive a reload. */
  persisted: boolean;
  /** The user explicitly chose to sign in again without a confirmed sign-out. */
  signInOverride: boolean;
}

interface AuthState {
  cacheEpoch: number;
  user: AuthUser | null;
  accessTokenExpiresAt: string | null;
  status: AuthStatus;
  isInitializing: boolean;
  isLoggingOut: boolean;
  logoutState: LogoutStatus;
  setAuth: (auth: AuthResponse) => void;
  clearAuth: () => void;
  /** `broadcast: false` avoids cross-tab echo. `resolveLogout: false` protects an OAuth callback
   * locally without automatically signing out a possibly newer provider-issued cookie. */
  restoreSession: (options?: { broadcast?: boolean; resolveLogout?: boolean }) => Promise<void>;
  /** Never rejects: the outcome says whether the server confirmed the sign-out. */
  logout: () => Promise<LogoutOutcome>;
  retryLogout: () => Promise<LogoutOutcome>;
  allowSignInDuringPendingLogout: () => void;
  dismissLogoutNotice: () => void;
}

/** Bounds the whole logout attempt: waiting for the cross-tab cookie lock AND the request. */
export const LOGOUT_TIMEOUT_MS = 15_000;
/** Automatic retries after 5xx/network/timeout; after these only manual retries happen. */
export const LOGOUT_AUTO_RETRY_DELAYS_MS = [2_000, 10_000, 30_000] as const;
const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;
const MAX_RETRY_AFTER_MS = 15 * 60_000;

export const LOGOUT_PENDING_CODE = "LOGOUT_PENDING";

const idleLogout: LogoutStatus = {
  phase: "idle",
  retryAt: null,
  reason: null,
  persisted: true,
  signInOverride: false,
};

let logoutInFlight: Promise<LogoutOutcome> | null = null;
let inFlightIntent: LogoutIntent | null = null;
let observedIntent: LogoutIntent | null = null;
let autoRetryTimer: ReturnType<typeof setTimeout> | null = null;
let autoRetriesUsed = 0;

const clearAutoRetry = (): void => {
  if (autoRetryTimer !== null) clearTimeout(autoRetryTimer);
  autoRetryTimer = null;
};

/** Shared by setAuth() and restoreSession() so both write identical state for an authenticated
 * response; broadcasting is the caller's decision (see restoreSession's `broadcast` option). */
const applyAuth = (
  set: (partial: Partial<AuthState>) => void,
  auth: Pick<AuthResponse, "accessToken" | "accessTokenExpiresAt" | "user">,
): void => {
  const current = useAuthStore.getState();
  const changed = current.user?.id !== auth.user.id || current.user?.role !== auth.user.role;
  if (changed) {
    rotateQueryClient();
  }
  setAccessToken(auth.accessToken);
  set({
    cacheEpoch: current.cacheEpoch + (changed ? 1 : 0),
    user: auth.user,
    accessTokenExpiresAt: auth.accessTokenExpiresAt,
    status: "authenticated",
    isInitializing: false,
  });
};

const setLogoutStatus = (patch: Partial<LogoutStatus>, extra: Partial<AuthState> = {}): void => {
  useAuthStore.setState({ ...extra, logoutState: { ...useAuthStore.getState().logoutState, ...patch } });
};

/** Local sign-out protection for this tab: stale operations, token, caches and status. */
const enterLocalSignedOut = (): void => {
  const state = useAuthStore.getState();
  if (state.status === "unauthenticated" && state.user === null &&
      state.accessTokenExpiresAt === null && !state.isInitializing && getAccessToken() === null) return;
  state.clearAuth();
};

/** Repeated storage/broadcast notifications update the deadline without retiring caches again. */
const syncPendingLogoutStatus = (): void => {
  observedIntent = readLogoutIntent();
  const state = useAuthStore.getState();
  if (state.logoutState.phase === "inProgress" && inFlightIntent && observedIntent &&
      sameLogoutIntent(inFlightIntent, observedIntent)) return;
  const retryAt = readLogoutIntent()?.retryAt ?? null;
  const persisted = isLogoutIntentPersisted();
  const reason = retryAt !== null ? "RATE_LIMITED" :
    state.logoutState.reason === "RATE_LIMITED" ? null : state.logoutState.reason;
  if (state.logoutState.phase !== "unconfirmed" || state.logoutState.retryAt !== retryAt ||
      state.logoutState.persisted !== persisted || state.logoutState.reason !== reason) {
    setLogoutStatus({ phase: "unconfirmed", retryAt, persisted, reason }, { isLoggingOut: false });
  }
};

const scheduleAutoRetry = (delayMs: number): void => {
  clearAutoRetry();
  if (autoRetriesUsed >= LOGOUT_AUTO_RETRY_DELAYS_MS.length) return;
  autoRetriesUsed += 1;
  const expected = readLogoutIntent();
  autoRetryTimer = setTimeout(() => {
    autoRetryTimer = null;
    if (expected && sameLogoutIntent(readLogoutIntent(), expected)) void resolvePendingLogout(false, expected);
  }, delayMs);
};

/**
 * Single-flight resolution of an exact pending intent. The server matches its family against
 * trusted cookie data before revocation; only the matching acknowledgement resolves it.
 * A failed or lost response keeps the intent — the server may or
 * may not have revoked — and retries are bounded and honor Retry-After.
 */
const resolvePendingLogout = (manual: boolean, expected?: LogoutIntent): Promise<LogoutOutcome> => {
  const intent = readLogoutIntent();
  if (expected && !sameLogoutIntent(intent, expected)) {
    if (intent) syncPendingLogoutStatus();
    return Promise.resolve("superseded");
  }
  if (logoutInFlight && intent && sameLogoutIntent(inFlightIntent, intent)) return logoutInFlight;
  if (!intent) {
    clearAutoRetry();
    const { phase } = useAuthStore.getState().logoutState;
    if (phase === "inProgress" || phase === "unconfirmed") setLogoutStatus({ ...idleLogout }, { isLoggingOut: false });
    return Promise.resolve("superseded");
  }

  observedIntent = intent;
  if (!intent.familyId) {
    clearAutoRetry();
    setLogoutStatus({ phase: "unconfirmed", reason: "REJECTED", retryAt: null }, { isLoggingOut: false });
    return Promise.resolve("unconfirmed");
  }
  const target = { ...intent, familyId: intent.familyId };

  const now = Date.now();
  if (intent.retryAt !== undefined && intent.retryAt > now) {
    // Rate limited: do not send before Retry-After, manual or automatic.
    setLogoutStatus({ phase: "unconfirmed", retryAt: intent.retryAt, reason: "RATE_LIMITED" }, { isLoggingOut: false });
    if (autoRetryTimer === null) scheduleAutoRetry(intent.retryAt - now);
    return Promise.resolve("unconfirmed");
  }

  clearAutoRetry();
  if (manual) autoRetriesUsed = 0;
  setLogoutStatus({ phase: "inProgress", retryAt: null, reason: null }, { isLoggingOut: true });

  inFlightIntent = intent;
  const attempt = (async (): Promise<LogoutOutcome> => {
    const outcome = await sendLogoutRequest({
      timeoutMs: LOGOUT_TIMEOUT_MS,
      intent: target,
      shouldSend: () => sameLogoutIntent(readLogoutIntent(), intent),
    });

    // A later intent/explicit override owns state now. Even a valid old acknowledgement
    // must not clear its marker, update its countdown, or broadcast its confirmation.
    if (!sameLogoutIntent(readLogoutIntent(), intent)) return "superseded";

    if (outcome.kind === "confirmed") {
      if (!clearLogoutIntent(intent)) {
        syncPendingLogoutStatus();
        return "superseded";
      }
      observedIntent = null;
      autoRetriesUsed = 0;
      setLogoutStatus({ ...idleLogout, phase: "confirmed" }, { isLoggingOut: false });
      postAuthLogoutConfirmed(target);
      return "confirmed";
    }

    if (outcome.kind === "superseded") {
      forgetLogoutIntentMemory();
      setLogoutStatus({ ...idleLogout }, { isLoggingOut: false });
      return "superseded";
    }

    let retryAt: number | null = null;
    let delay: number | undefined;
    if (outcome.reason === "RATE_LIMITED") {
      delay = Math.min(Math.max(outcome.retryAfterMs ?? DEFAULT_RATE_LIMIT_RETRY_MS, 1_000), MAX_RETRY_AFTER_MS);
      retryAt = Date.now() + delay;
      setLogoutRetryAt(retryAt, intent);
    } else {
      setLogoutRetryAt(undefined, intent);
      delay = LOGOUT_AUTO_RETRY_DELAYS_MS[autoRetriesUsed];
    }
    if (!sameLogoutIntent(readLogoutIntent(), intent)) {
      syncPendingLogoutStatus();
      return "superseded";
    }
    setLogoutStatus(
      { phase: "unconfirmed", retryAt, reason: outcome.reason, persisted: isLogoutIntentPersisted() },
      { isLoggingOut: false },
    );
    // A 4xx other than 429 will not change by itself: manual retry only.
    if (!["REJECTED", "FAMILY_MISMATCH", "UNVERIFIABLE"].includes(outcome.reason) && delay !== undefined) scheduleAutoRetry(delay);
    return "unconfirmed";
  })().finally(() => {
    if (logoutInFlight === attempt) {
      logoutInFlight = null;
      inFlightIntent = null;
    }
  });
  logoutInFlight = attempt;
  return attempt;
};

const startLogout = (): Promise<LogoutOutcome> => {
  // A second click while a logout is in flight shares that attempt instead of "succeeding".
  const existing = readLogoutIntent();
  if (!existing && getAccessToken() === null && useAuthStore.getState().logoutState.phase === "confirmed") {
    return Promise.resolve("confirmed");
  }
  if (logoutInFlight && existing && sameLogoutIntent(inFlightIntent, existing)) return logoutInFlight;
  // 1. Record the intent before anything is sent, so a reload can never restore the session.
  const { intent, persisted } = beginLogoutIntent(getSessionFamilyId());
  observedIntent = intent;
  if (!existing) invalidateInFlightAuth();
  // 2–4. Immediate local protection: invalidate stale operations, retire caches, drop the token.
  enterLocalSignedOut();
  setLogoutStatus({ phase: "inProgress", retryAt: null, reason: null, persisted, signInOverride: false });
  // Other tabs must stop using the session and must not restore it while this is unconfirmed.
  postAuthLogoutPending(intent);
  // 5–7. Ask the server; only its acknowledgement resolves the intent.
  return resolvePendingLogout(true, intent);
};

export const useAuthStore = create<AuthState>((set, get) => ({
  cacheEpoch: 0,
  user: null,
  accessTokenExpiresAt: null,
  status: "unknown",
  isInitializing: false,
  isLoggingOut: false,
  logoutState: { ...idleLogout },

  setAuth: (auth) => {
    if (hasLogoutIntent()) {
      enterLocalSignedOut();
      syncPendingLogoutStatus();
      return;
    }
    invalidateInFlightAuth();
    applyAuth(set, auth);
    // Bookly is one session per browser profile: any tab that just established an authenticated
    // session (password/OTP login, OAuth callback, or an ordinary boot-time restore) tells every
    // other same-origin tab so they converge to it too. Harmless when it's the same account
    // (other tabs just re-confirm it); see the AUTH_SESSION_CHANGED handler below for how a tab
    // that was showing a *different* account switches over.
    postAuthSessionChanged();
    rememberAnnouncedSession(getSessionFamilyId());
  },

  clearAuth: () => {
    // Guarantees a refresh that was already in flight when this ran can never apply its result
    // afterwards and silently re-authenticate this tab.
    invalidateInFlightAuth();
    const current = get();
    const changed = current.status !== "unauthenticated" || current.user !== null ||
      current.accessTokenExpiresAt !== null || getAccessToken() !== null;
    // Retiring the same already-signed-out identity again would remount all restoration callers.
    if (changed) rotateQueryClient();
    clearAccessToken();
    set({
      user: null,
      cacheEpoch: current.cacheEpoch + (changed ? 1 : 0),
      accessTokenExpiresAt: null,
      status: "unauthenticated",
      isInitializing: false,
    });
  },

  restoreSession: async (options) => {
    if (hasLogoutIntent()) {
      // Boot, reload, a new tab, a guard or OAuth callback: an unconfirmed logout must never be
      // undone by the refresh cookie. Stay signed out and try to finish the logout instead.
      enterLocalSignedOut();
      syncPendingLogoutStatus();
      // Provider callbacks may already carry a newer cookie. A stale callback must only
      // protect local state, never automatically revoke whichever family that cookie names.
      if (options?.resolveLogout === false) {
        clearAutoRetry();
        return;
      }
      void resolvePendingLogout(false);
      return;
    }

    if (get().isInitializing) {
      return;
    }

    set({ isInitializing: true });
    const generation = getAuthGeneration();

    try {
      // Canonical refresh primitive — same-tab single-flight and (where supported) cross-tab
      // Web Locks serialization live here, shared with the apiClient response interceptor. Do
      // not call authApi.refresh() directly.
      const auth = await refreshSession();
      if (generation !== getAuthGeneration()) return;
      applyAuth(set, auth);
      // A boot/guard restore of the session family this profile already announced is a routine
      // reload: other tabs already hold it, and a notice would make each of them retire its cache,
      // refresh and refetch for nothing. A new family (any sign-in path, including OAuth/redirect
      // callbacks, or the same user signed in again) or an unknown one is still announced.
      const familyId = getSessionFamilyId();
      if (options?.broadcast !== false && !wasSessionAnnounced(familyId)) {
        postAuthSessionChanged();
      }
      rememberAnnouncedSession(familyId);
    } catch (error) {
      if (generation !== getAuthGeneration()) return;
      const failureClass = classifyRefreshFailure(error);
      if (failureClass === "TRANSIENT") {
        // Retain the user/token for recovery, but fail closed until refresh succeeds.
        // This separate state also prevents guards from repeatedly restoring "unknown".
        set({ status: "unverified", isInitializing: false });
      } else if (failureClass !== "STALE") {
        get().clearAuth();
      } else {
        set({ isInitializing: false });
      }
    }
  },

  logout: () => startLogout(),
  retryLogout: () => resolvePendingLogout(true),

  allowSignInDuringPendingLogout: () => {
    if (hasLogoutIntent()) setLogoutStatus({ signInOverride: true });
  },

  dismissLogoutNotice: () => {
    if (get().logoutState.phase === "confirmed") setLogoutStatus({ ...idleLogout });
  },
}));

// A new sign-in may replace the refresh cookie only after the pending logout is resolved — or
// after the user explicitly chose to sign in anyway. In that case the previous session's
// server-side revocation stays UNCONFIRMED (it is never reported as revoked); what changes is
// that this browser no longer holds its refresh cookie, so it can no longer be restored here.
setSessionEstablishingHooks({
  before: async () => {
    const intent = readLogoutIntent();
    if (!intent) return;
    if (useAuthStore.getState().logoutState.signInOverride) {
      return { logoutIntentId: intent.id, logoutFamilyId: intent.familyId };
    }
    const outcome = await resolvePendingLogout(true, intent);
    if (outcome === "unconfirmed") {
      throw new BooklyApiError({
        message: "Your previous sign-out hasn't been confirmed yet. Retry sign-out first.",
        code: LOGOUT_PENDING_CODE,
      });
    }
  },
  canEstablish: (context) => {
    const intent = readLogoutIntent();
    return !intent || Boolean(context && useAuthStore.getState().logoutState.signInOverride &&
      sameLogoutIntent(intent, { id: context.logoutIntentId, familyId: context.logoutFamilyId }));
  },
  after: (context) => {
    const intent = readLogoutIntent();
    if (!intent || !context || !sameLogoutIntent(intent, { id: context.logoutIntentId, familyId: context.logoutFamilyId })) return;
    // The new session's Set-Cookie replaced the old refresh cookie on this browser.
    clearAutoRetry();
    if (!clearLogoutIntent(intent)) return;
    observedIntent = null;
    setLogoutStatus({ ...idleLogout }, { isLoggingOut: false });
  },
});

setRefreshBlocker(hasLogoutIntent);

// The apiClient interceptor calls this when a 401-triggered refresh permanently fails (dead or
// reused refresh token) — it only owns the raw in-memory access token, not this store's
// "authenticated" status, so without this wiring the app would keep rendering as logged in while
// every request silently 401s. Reuses the existing clearAuth() so the existing Require*
// guards' status==="unauthenticated" redirect handles the rest. A terminal failure here means the
// shared session genuinely ended, so every other tab is told too.
setOnSessionExpired(() => {
  useAuthStore.getState().clearAuth();
  postAuthLoggedOut();
});

setOnSessionUnverified(() => {
  useAuthStore.setState({ status: "unverified", isInitializing: false });
});

// Interceptor-driven recovery must unlock guards and update the user/expiry too.
setOnSessionRestored((auth) => {
  const previous = useAuthStore.getState().user;
  const switched = previous !== null && (previous.id !== auth.user.id || previous.role !== auth.user.role);
  if (switched) invalidateInFlightAuth();
  applyAuth(useAuthStore.setState, auth);
  if (switched) {
    postAuthSessionChanged();
    rememberAnnouncedSession(getSessionFamilyId());
  }
});

/** Another tab started a sign-out (broadcast or storage): stop using the session here too. */
const onRemoteLogoutPending = (intent?: LogoutIntent): void => {
  const current = readLogoutIntent();
  rememberRemoteLogoutIntent(current ?? intent);
  enterLocalSignedOut();
  syncPendingLogoutStatus();
};

// Cross-tab convergence for Bookly's "one session per browser profile" model. Never touches a
// token — these events carry no credentials (see auth-channel.ts) — this tab always re-derives
// its own session from the shared HttpOnly refresh cookie via the canonical refreshSession().
subscribeToAuthBroadcast((event) => {
  if (event.type === "AUTH_LOGOUT_PENDING") {
    if (typeof event.intentId !== "string") return;
    onRemoteLogoutPending({ id: event.intentId, familyId: event.familyId, startedAt: Date.now() });
    return;
  }

  if (event.type === "AUTH_LOGOUT_CONFIRMED") {
    const target = { id: event.intentId, familyId: event.familyId };
    const current = readLogoutIntent();
    if (!event.familyId || !sameLogoutIntent(observedIntent, target) ||
        (current && !sameLogoutIntent(current, target))) return;
    // Resolves only the pending sign-out. It deliberately does not clear auth: a tab that has
    // since signed in again holds a different session that this older logout did not end.
    if (current && !clearLogoutIntent(current)) return;
    forgetLogoutIntentMemory();
    observedIntent = null;
    clearAutoRetry();
    if (useAuthStore.getState().logoutState.phase !== "idle") {
      setLogoutStatus({ ...idleLogout, phase: "confirmed" }, { isLoggingOut: false });
    }
    return;
  }

  if (event.type === "AUTH_LOGGED_OUT") {
    // Guard first: a refresh this tab already had in flight for the old session must not be
    // allowed to resurrect it after this.
    invalidateInFlightAuth();
    useAuthStore.getState().clearAuth();
    return;
  }

  // AUTH_SESSION_CHANGED while a logout is unconfirmed is stale: restoring now would reuse the
  // very cookie the user asked to sign out of.
  if (hasLogoutIntent()) return;

  // AUTH_SESSION_CHANGED: another tab just authenticated (possibly as a different account).
  // Drop this tab's stale in-memory access token immediately — do not wait for its natural
  // ~15 minute expiry — then re-derive the current shared session from the cookie. `broadcast:
  // false` stops this from re-announcing the very change it's reacting to (which would ping-pong
  // between tabs forever).
  invalidateInFlightAuth();
  clearAccessToken();
  rotateQueryClient();
  useAuthStore.setState({ cacheEpoch: useAuthStore.getState().cacheEpoch + 1, user: null, accessTokenExpiresAt: null, status: "unknown", isInitializing: false });
  void useAuthStore.getState().restoreSession({ broadcast: false });
});

// Browsers without BroadcastChannel still see the shared record change (other tabs only).
subscribeToLogoutIntentStorage((pending) => {
  if (pending) {
    onRemoteLogoutPending();
    return;
  }
  clearAutoRetry();
  if (!hasLogoutIntent() && useAuthStore.getState().logoutState.phase !== "idle") {
    setLogoutStatus({ ...idleLogout }, { isLoggingOut: false });
  }
});
