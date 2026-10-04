/**
 * A session-scoped, customer-auth return destination. Store only an internal
 * pathname plus search string; never let authentication turn this into an
 * external redirect.
 */
const POST_LOGIN_REDIRECT_KEY = "bookly:post_login_redirect";
const SAFE_ORIGIN = "https://bookly.invalid";

export const isSafeInternalPostLoginPath = (value: string | null | undefined): value is string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return false;
  // Backslashes and fragments can be normalized unexpectedly by URL parsers/browsers.
  if (value.includes("\\") || value.includes("#")) return false;

  try {
    const parsed = new URL(value, SAFE_ORIGIN);
    return (
      parsed.origin === SAFE_ORIGIN &&
      `${parsed.pathname}${parsed.search}` === value
    );
  } catch {
    return false;
  }
};

export const storePostLoginRedirect = (path: string): boolean => {
  if (!isSafeInternalPostLoginPath(path)) return false;

  try {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
    return true;
  } catch {
    return false;
  }
};

/** Consumes once, clearing invalid/stale values as well as valid ones. */
export const consumePostLoginRedirect = (): string | undefined => {
  try {
    const stored = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
    return isSafeInternalPostLoginPath(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
};

export const clearPostLoginRedirect = (): void => {
  try {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // Storage can be unavailable in private/locked-down browser contexts.
  }
};
