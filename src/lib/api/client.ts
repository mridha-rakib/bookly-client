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

  public constructor(input: {
    message: string;
    status?: number;
    code?: string;
    errors?: ApiErrorDetail[];
    requestId?: string;
  }) {
    super(input.message);
    this.name = "BooklyApiError";
    this.status = input.status;
    this.code = input.code;
    this.errors = input.errors ?? [];
    this.requestId = input.requestId;
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

export const setOnSessionExpired = (handler: () => void): void => {
  onSessionExpired = handler;
};

// Bumped by the auth store on every logout (local, or learned from another tab) so a refresh
// that was already in flight at that moment can never apply its result afterwards and silently
// resurrect a session that has just been deliberately ended. See invalidateInFlightAuth().
let authGeneration = 0;

export class StaleAuthGenerationError extends Error {
  public constructor() {
    super("Discarded a refresh result because a logout happened while it was in flight.");
    this.name = "StaleAuthGenerationError";
  }
}

/** Call on any logout (local `logout()`, a terminal refresh failure, or an AUTH_LOGGED_OUT /
 * AUTH_SESSION_CHANGED event from another tab) — see auth/store.ts. */
export const invalidateInFlightAuth = (): void => {
  authGeneration += 1;
  refreshPromise = null;
};

const REFRESH_LOCK_NAME = "bookly-auth-refresh";

/** Same-browser-profile tabs share the refresh cookie but not JS memory, so the module-level
 * refreshPromise below only dedupes refreshes within one tab. The Web Locks API additionally
 * serializes the actual HTTP call across tabs: whichever tab acquires "bookly-auth-refresh"
 * sends the refresh request first; by the time a second tab acquires the lock, the shared
 * cookie has already rotated, so its request naturally uses the current token instead of
 * racing the same old one. Browsers without Web Locks (older Safari/Firefox) simply fall back
 * to the existing same-tab-only single-flight — no deadlock risk, since the lock (when used) is
 * held only for the duration of one HTTP request-response and always released via `using`
 * semantics internal to `navigator.locks.request`. */
const withCrossTabRefreshLock = <T>(run: () => Promise<T>): Promise<T> => {
  if (typeof navigator !== "undefined" && "locks" in navigator && navigator.locks) {
    // The generic callback type here doesn't let TS prove T can't itself be a Promise, so it
    // refuses to unify `() => Promise<T>` with `LockGrantedCallback<T>` on its own — this cast is
    // just working around that inference limit, not weakening the actual runtime behavior.
    return navigator.locks.request(REFRESH_LOCK_NAME, run) as Promise<T>;
  }
  return run();
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
  const generationAtStart = authGeneration;

  refreshPromise ??= withCrossTabRefreshLock(() =>
    apiClient
      .post<ApiEnvelope<RefreshAuthResponse>>("/auth/refresh")
      .then((response) => response.data.data),
  ).finally(() => {
    refreshPromise = null;
  });

  const auth = await refreshPromise;

  if (generationAtStart !== authGeneration) {
    // A logout (this tab or another) happened while the request was in flight. The new token
    // this response carries is real and valid, but applying it now would silently re-authenticate
    // a tab the user (or another tab) just logged out — discard it instead.
    throw new StaleAuthGenerationError();
  }

  setAccessToken(auth.accessToken);
  return auth;
};

type RefreshFailureClass = "TERMINAL" | "REUSED" | "TRANSIENT" | "STALE";

/**
 * Classifies a refresh failure so the interceptor can react proportionately instead of treating
 * every failure as an unrecoverable session loss (the root cause identified by the auto-logout
 * audit):
 * - STALE: this tab's own logout raced the request; already handled, nothing more to do.
 * - TRANSIENT: no response reached us at all, or the server 5xx'd — this proves nothing about
 *   whether the session is still valid, so it must never clear auth.
 * - REUSED: the backend's atomic rotation rejected this exact token as already-used. This is
 *   indistinguishable, from here, between a genuine stolen-token replay and this request simply
 *   having lost a legitimate same-cookie refresh race (another tab, or another call site in this
 *   tab, rotated first). Callers get exactly one bounded retry against the now-current cookie.
 * - TERMINAL: an explicit, unambiguous session-ending response (expired, revoked family,
 *   suspended, deleted, missing cookie, etc).
 */
const classifyRefreshFailure = (error: unknown): RefreshFailureClass => {
  if (error instanceof StaleAuthGenerationError) {
    return "STALE";
  }

  const normalized = normalizeApiError(error);

  if (normalized.status === undefined || normalized.status >= 500) {
    return "TRANSIENT";
  }

  if (normalized.status === 401 && normalized.code === "REFRESH_TOKEN_REUSED") {
    return "REUSED";
  }

  return "TERMINAL";
};

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const config = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;
    const requestUrl = config?.url ?? "";
    const isRefreshRequest = requestUrl.includes("/auth/refresh");

    if (status === 401 && config && !config._retry && !isRefreshRequest) {
      config._retry = true;

      try {
        await refreshSession();
        return apiClient(config);
      } catch (firstRefreshError) {
        const failureClass = classifyRefreshFailure(firstRefreshError);

        if (failureClass === "REUSED") {
          try {
            await refreshSession();
            return apiClient(config);
          } catch (secondRefreshError) {
            const secondFailureClass = classifyRefreshFailure(secondRefreshError);
            // A second consecutive REUSED is treated as terminal too — no unbounded retrying.
            if (secondFailureClass === "TRANSIENT" || secondFailureClass === "STALE") {
              return Promise.reject(normalizeApiError(error));
            }
            clearAccessToken();
            onSessionExpired?.();
          }
        } else if (failureClass === "TERMINAL") {
          clearAccessToken();
          onSessionExpired?.();
        }
        // TRANSIENT: leave auth state untouched — a later request gets its own refresh attempt.
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
    });
  }

  if (error instanceof Error) {
    return new BooklyApiError({ message: error.message });
  }

  return new BooklyApiError({ message: "Something went wrong. Please try again." });
};

export const apiRequest = async <T>(config: AxiosRequestConfig): Promise<T> => {
  const response: AxiosResponse<ApiEnvelope<T>> = await apiClient.request<ApiEnvelope<T>>(config);
  return response.data.data;
};
