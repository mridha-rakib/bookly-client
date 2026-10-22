import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import type { AuthUser } from "@/lib/api/auth";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth/token-memory";

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiErrorDetail {
  path?: string;
  message: string;
  code?: string;
}

interface ApiErrorEnvelope {
  success: false;
  message?: string;
  errors?: ApiErrorDetail[];
  requestId?: string;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _authGeneration?: number;
  /** Logout confirmation is a server fact; a later local generation change must not discard it. */
  _ignoreAuthGeneration?: boolean;
}

interface RefreshAuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: AuthUser;
}

export class BooklyApiError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly errors: ApiErrorDetail[];
  public readonly requestId?: string;
  /** Raw Retry-After response header, when the server sent one and CORS exposes it. */
  public readonly retryAfter?: string;

  public constructor(input: {
    message: string;
    status?: number;
    code?: string;
    errors?: ApiErrorDetail[];
    requestId?: string;
    retryAfter?: unknown;
  }) {
    super(input.message);
    this.name = "BooklyApiError";
    this.status = input.status;
    this.code = input.code;
    this.errors = input.errors ?? [];
    this.requestId = input.requestId;
    if (typeof input.retryAfter === "string" || typeof input.retryAfter === "number") {
      this.retryAfter = String(input.retryAfter);
    }
  }
}

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:3000/api/v1";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

// Set once by the auth store so a permanently-failed refresh (dead/reused refresh token, not
// just a transient network blip) can flip the app's auth state to "unauthenticated" — without
// this, clearAccessToken() below only drops the in-memory access token, leaving the auth store
// still reporting "authenticated" and RequireBusinessOwner/etc. never redirecting to login.
let onSessionExpired: (() => void) | null = null;
let onSessionUnverified: (() => void) | null = null;
let onSessionRestored: ((auth: RefreshAuthResponse) => void) | null = null;

export const setOnSessionExpired = (handler: () => void): void => {
  onSessionExpired = handler;
};

export const setOnSessionUnverified = (handler: () => void): void => {
  onSessionUnverified = handler;
};

export const setOnSessionRestored = (handler: (auth: RefreshAuthResponse) => void): void => {
  onSessionRestored = handler;
};

/** Thrown instead of refreshing while a user-initiated logout is still unconfirmed. */
export class LogoutPendingError extends Error {
  public constructor() {
    super("Session restoration is blocked until sign-out is confirmed.");
    this.name = "LogoutPendingError";
  }
}

// Set by the auth store: while a logout is unconfirmed the refresh cookie must not be used to
// restore the session, and a new sign-in must first resolve (or explicitly replace) it.
let isRefreshBlocked: () => boolean = () => false;
export type SessionEstablishmentContext = { logoutIntentId: string; logoutFamilyId?: string | undefined } | undefined;
let beforeSessionEstablished: (() => Promise<SessionEstablishmentContext>) | null = null;
let afterSessionEstablished: ((context: SessionEstablishmentContext) => void) | null = null;
let canEstablishSession: ((context: SessionEstablishmentContext) => boolean) | null = null;

export const setRefreshBlocker = (handler: () => boolean): void => {
  isRefreshBlocked = handler;
};

export const setSessionEstablishingHooks = (hooks: {
  before: () => Promise<SessionEstablishmentContext>;
  after: (context: SessionEstablishmentContext) => void;
  canEstablish: (context: SessionEstablishmentContext) => boolean;
}): void => {
  beforeSessionEstablished = hooks.before;
  afterSessionEstablished = hooks.after;
  canEstablishSession = hooks.canEstablish;
};

// Every local login, logout and cross-tab session change advances this epoch. Requests,
// refresh waiters and interceptor callbacks may act only in the epoch that started them.
let authGeneration = 0;
export const getAuthGeneration = (): number => authGeneration;

export class StaleAuthGenerationError extends Error {
  public constructor() {
    super("Discarded an authentication operation after the session changed.");
    this.name = "StaleAuthGenerationError";
  }
}

/** Invalidate previous operations when an authenticated session is replaced or ended. */
export const invalidateInFlightAuth = (): void => {
  authGeneration += 1;
  refreshPromise = null;
};

const REFRESH_LOCK_NAME = "bookly-auth-refresh";

const SESSION_ESTABLISHING_URLS = [
  "/auth/customer/login", "/auth/professional/login", "/auth/super-admin/login",
  "/auth/customer/register/verify-phone-otp-complete",
  "/auth/professional/register/complete", "/auth/staff/invitation/accept/password",
];

/** Requests whose success replaces the shared refresh cookie with a NEW session. */
const isSessionEstablishing = (config: AxiosRequestConfig): boolean =>
  config.method?.toUpperCase() === "POST" && SESSION_ESTABLISHING_URLS.includes(config.url ?? "");

const isSessionCookieMutation = (config: AxiosRequestConfig): boolean => {
  const method = config.method?.toUpperCase();
  return isSessionEstablishing(config) ||
    (method === "POST" && config.url === "/auth/logout") ||
    (method === "DELETE" && config.url === "/auth/me");
};

/** Same-browser-profile tabs share the refresh cookie but not JS memory, so the module-level
 * refreshPromise below only dedupes refreshes within one tab. The Web Locks API additionally
 * serializes the actual HTTP call across tabs: whichever tab acquires "bookly-auth-refresh"
 * sends the refresh request first; by the time a second tab acquires the lock, the shared
 * cookie has already rotated, so its request naturally uses the current token instead of
 * racing the same old one. Login, registration completion and logout share this lock too.
 * Browsers without Web Locks fall back to same-tab refresh single-flight. The lock is
 * held only for the duration of one HTTP request-response and always released via `using`
 * semantics internal to `navigator.locks.request`. */
const withCrossTabRefreshLock = <T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (typeof navigator !== "undefined" && "locks" in navigator && navigator.locks) {
    // The generic callback type here doesn't let TS prove T can't itself be a Promise, so it
    // refuses to unify `() => Promise<T>` with `LockGrantedCallback<T>` on its own — this cast is
    // just working around that inference limit, not weakening the actual runtime behavior.
    // `signal` only abandons WAITING for the lock; the holder is never interrupted.
    return (signal
      ? navigator.locks.request(REFRESH_LOCK_NAME, { signal }, run)
      : navigator.locks.request(REFRESH_LOCK_NAME, run)) as Promise<T>;
  }
  if (signal?.aborted) return Promise.reject(signal.reason);
  return run();
};

export type LogoutRequestOutcome =
  | { kind: "confirmed" }
  | { kind: "superseded" }
  | { kind: "failed"; reason: "RATE_LIMITED" | "SERVER_ERROR" | "NETWORK" | "TIMEOUT" | "REJECTED" | "FAMILY_MISMATCH" | "UNVERIFIABLE"; retryAfterMs?: number };

const parseRetryAfterMs = (value: unknown): number | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(String(value));
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

/**
 * Sends POST /auth/logout under the same cross-tab cookie lock as refresh/login, so it carries
 * the newest refresh cookie. The whole operation — waiting for the lock AND the request — is
 * bounded by `timeoutMs`, so a hung refresh can never hold a logout back indefinitely.
 * `shouldSend` re-checks the exact intent inside the lock. Cookie replacement can bypass this
 * lock (OAuth); the backend must match the expected family before mutation. An HTTP 200 alone
 * is insufficient: its acknowledgement must match both the intent and family.
 */
export const sendLogoutRequest = async (options: {
  timeoutMs: number;
  shouldSend: () => boolean;
  intent: { id: string; familyId: string };
}): Promise<LogoutRequestOutcome> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("LOGOUT_TIMEOUT")), options.timeoutMs);
  try {
    return await withCrossTabRefreshLock(async (): Promise<LogoutRequestOutcome> => {
      if (!options.shouldSend()) return { kind: "superseded" };
      const config: AxiosRequestConfig & Pick<RetryableRequestConfig, "_ignoreAuthGeneration"> = {
        method: "POST",
        url: "/auth/logout",
        data: { intentId: options.intent.id, familyId: options.intent.familyId },
        signal: controller.signal,
        _ignoreAuthGeneration: true,
      };
      const response = await apiClient.request<ApiEnvelope<{ intentId: string; familyId: string; outcome: string }>>(config);
      const ack = response.data.data;
      if (!ack || ack.intentId !== options.intent.id || ack.familyId !== options.intent.familyId || ack.outcome !== "revoked") {
        return { kind: "failed", reason: "REJECTED" };
      }
      return { kind: "confirmed" };
    }, controller.signal);
  } catch (error) {
    if (controller.signal.aborted || axios.isCancel(error)) return { kind: "failed", reason: "TIMEOUT" };
    const normalized = normalizeApiError(error);
    const status = normalized.status;
    if (status === 429) {
      return { kind: "failed", reason: "RATE_LIMITED", retryAfterMs: parseRetryAfterMs(normalized.retryAfter) };
    }
    if (status !== undefined && status >= 500) return { kind: "failed", reason: "SERVER_ERROR" };
    if (normalized.code === "LOGOUT_FAMILY_MISMATCH") return { kind: "failed", reason: "FAMILY_MISMATCH" };
    if (normalized.code === "LOGOUT_UNVERIFIABLE") return { kind: "failed", reason: "UNVERIFIABLE" };
    if (status === undefined) return { kind: "failed", reason: "NETWORK" };
    return { kind: "failed", reason: "REJECTED" };
  } finally {
    clearTimeout(timer);
  }
};

let refreshPromise: Promise<RefreshAuthResponse> | null = null;

/**
 * THE canonical frontend entry point for POST /auth/refresh. Every caller — the response
 * interceptor below and `useAuthStore.restoreSession()` — must go through this function so
 * there is exactly one same-tab in-flight refresh (refreshPromise) and, where supported,
 * exactly one cross-tab in-flight refresh (the Web Locks request). Do not call
 * `authApi.refresh()` directly anywhere else.
 */
export const refreshSession = async (): Promise<RefreshAuthResponse> => {
  // Never use the refresh cookie while a user-initiated logout is unconfirmed.
  if (isRefreshBlocked()) throw new LogoutPendingError();
  const generationAtStart = authGeneration;

  if (!refreshPromise) {
    const pending = withCrossTabRefreshLock(() => {
      if (generationAtStart !== authGeneration) {
        throw new StaleAuthGenerationError();
      }
      // Re-checked under the lock: another tab may have started a logout meanwhile.
      if (isRefreshBlocked()) throw new LogoutPendingError();
      return apiClient
        .post<ApiEnvelope<RefreshAuthResponse>>("/auth/refresh")
        .then((response) => response.data.data);
    }).finally(() => {
      // An older generation must not erase a newer in-flight refresh.
      if (refreshPromise === pending) refreshPromise = null;
    });
    refreshPromise = pending;
  }

  let auth: RefreshAuthResponse;
  try {
    auth = await refreshPromise;
  } catch (error) {
    // Failed results can also arrive after another tab changed/ended the session.
    if (generationAtStart !== authGeneration) throw new StaleAuthGenerationError();
    throw error;
  }

  if (generationAtStart !== authGeneration) {
    // A logout (this tab or another) happened while the request was in flight. The new token
    // this response carries is real and valid, but applying it now would silently re-authenticate
    // a tab the user (or another tab) just logged out — discard it instead.
    throw new StaleAuthGenerationError();
  }

  // A logout that started elsewhere while this refresh was in flight wins.
  if (isRefreshBlocked()) throw new LogoutPendingError();

  setAccessToken(auth.accessToken);
  onSessionRestored?.(auth);
  return auth;
};

type RefreshFailureClass = "TERMINAL" | "REUSED" | "TRANSIENT" | "STALE";

/**
 * Classifies a refresh failure so the interceptor can react proportionately instead of treating
 * every failure as an unrecoverable session loss (the root cause identified by the auto-logout
 * audit):
 * - STALE: this tab's own logout raced the request; already handled, nothing more to do.
 * - TRANSIENT: rate limiting, network/server failures, or other non-auth errors prove nothing about
 *   whether the session is still valid, so it must never clear auth.
 * - REUSED: the backend's atomic rotation rejected this exact token as already-used. This is
 *   indistinguishable, from here, between a genuine stolen-token replay and this request simply
 *   having lost a legitimate same-cookie refresh race (another tab, or another call site in this
 *   tab, rotated first). Callers get exactly one bounded retry against the now-current cookie.
 * - TERMINAL: an explicit, unambiguous session-ending response (expired, revoked family,
 *   suspended, deleted, missing cookie, etc).
 */
export const classifyRefreshFailure = (error: unknown): RefreshFailureClass => {
  // A pending logout already ended this session locally; nothing more to do here.
  if (error instanceof StaleAuthGenerationError || error instanceof LogoutPendingError) {
    return "STALE";
  }

  const normalized = normalizeApiError(error);

  if (normalized.status === 401 && normalized.code === "REFRESH_TOKEN_REUSED") {
    return "REUSED";
  }

  // Only an explicit authentication/authorization rejection ends the session.
  // In particular 429 is a limiter decision, not evidence of revoked credentials.
  return normalized.status === 401 || normalized.status === 403 ? "TERMINAL" : "TRANSIENT";
};

apiClient.interceptors.request.use((config) => {
  const owned = config as RetryableRequestConfig;
  if (
    !owned._ignoreAuthGeneration &&
    owned._authGeneration !== undefined &&
    owned._authGeneration !== authGeneration
  ) {
    throw new StaleAuthGenerationError();
  }
  owned._authGeneration = authGeneration;
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const owned = response.config as RetryableRequestConfig;
    if (!owned._ignoreAuthGeneration && owned._authGeneration !== authGeneration) {
      throw new StaleAuthGenerationError();
    }
    return response;
  },
  async (error: AxiosError<ApiErrorEnvelope>) => {
    if (error instanceof StaleAuthGenerationError) throw error;
    const config = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;
    const requestUrl = config?.url ?? "";
    const isRefreshRequest = requestUrl.includes("/auth/refresh");
    if (config?._ignoreAuthGeneration) return Promise.reject(normalizeApiError(error));
    const generation = config?._authGeneration ?? authGeneration;
    if (generation !== authGeneration) throw new StaleAuthGenerationError();

    if (status === 401 && config && !config._retry && !isRefreshRequest && !isSessionCookieMutation(config)) {
      config._retry = true;

      try {
        await refreshSession();
        if (generation !== authGeneration) throw new StaleAuthGenerationError();
        return apiClient(config);
      } catch (firstRefreshError) {
        if (generation !== authGeneration) throw new StaleAuthGenerationError();
        const failureClass = classifyRefreshFailure(firstRefreshError);

        if (failureClass === "REUSED") {
          try {
            await refreshSession();
            if (generation !== authGeneration) throw new StaleAuthGenerationError();
            return apiClient(config);
          } catch (secondRefreshError) {
            if (generation !== authGeneration) throw new StaleAuthGenerationError();
            const secondFailureClass = classifyRefreshFailure(secondRefreshError);
            // A second consecutive REUSED is treated as terminal too — no unbounded retrying.
            if (secondFailureClass === "TRANSIENT" || secondFailureClass === "STALE") {
              if (secondFailureClass === "TRANSIENT") onSessionUnverified?.();
              return Promise.reject(normalizeApiError(secondRefreshError));
            }
            clearAccessToken();
            onSessionExpired?.();
          }
        } else if (failureClass === "TERMINAL") {
          clearAccessToken();
          onSessionExpired?.();
        } else if (failureClass === "TRANSIENT") {
          onSessionUnverified?.();
          // Surface the actual refresh failure (e.g. 429), not the original 401.
          return Promise.reject(normalizeApiError(firstRefreshError));
        }
        // STALE: a logout already handled this; nothing more to do here.
      }
    }

    return Promise.reject(normalizeApiError(error));
  },
);

export const normalizeApiError = (error: unknown): BooklyApiError => {
  if (error instanceof BooklyApiError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
    const body = error.response?.data;
    const firstError = body?.errors?.[0];

    return new BooklyApiError({
      message: firstError?.message ?? body?.message ?? error.message,
      status: error.response?.status,
      code: firstError?.code,
      errors: body?.errors,
      requestId: body?.requestId,
      retryAfter: error.response?.headers?.["retry-after"],
    });
  }

  if (error instanceof Error) {
    return new BooklyApiError({ message: error.message });
  }

  return new BooklyApiError({ message: "Something went wrong. Please try again." });
};

export const apiRequest = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const generation = authGeneration;
  const run = async (): Promise<T> => {
    if (generation !== authGeneration) throw new StaleAuthGenerationError();
    const response: AxiosResponse<ApiEnvelope<T>> = await apiClient.request<ApiEnvelope<T>>(config);
    if (generation !== authGeneration) throw new StaleAuthGenerationError();
    return response.data.data;
  };
  if (isSessionEstablishing(config)) {
    // An unconfirmed logout is resolved (outside the lock — it takes the lock itself) before a
    // new sign-in may replace the refresh cookie; it throws if that is not possible.
    const context = await beforeSessionEstablished?.();
    const result = await withCrossTabRefreshLock(() => {
      if (canEstablishSession && !canEstablishSession(context)) throw new LogoutPendingError();
      return run();
    });
    if (canEstablishSession && !canEstablishSession(context)) throw new LogoutPendingError();
    // The new session's Set-Cookie has replaced the previous refresh cookie.
    afterSessionEstablished?.(context);
    return result;
  }
  // Login/logout must also wait for a refresh's Set-Cookie before writing the shared cookie.
  // These endpoints never enter interceptor refresh, avoiding recursive lock acquisition.
  return isSessionCookieMutation(config) ? withCrossTabRefreshLock(run) : run();
};
