import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

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
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
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

let refreshPromise: Promise<RefreshAuthResponse> | null = null;

const refreshAccessToken = async (): Promise<RefreshAuthResponse> => {
  refreshPromise ??= apiClient
    .post<ApiEnvelope<RefreshAuthResponse>>("/auth/refresh")
    .then((response) => {
      const auth = response.data.data;
      setAccessToken(auth.accessToken);
      return auth;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
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
        await refreshAccessToken();
        return apiClient(config);
      } catch {
        clearAccessToken();
        onSessionExpired?.();
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
