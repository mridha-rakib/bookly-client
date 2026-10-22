// Same-origin, same-browser-profile cross-tab auth event channel. Bookly's product model is
// "one session per browser profile / cookie jar" (see auto-logout audit, 2026-09): every tab
// sharing the refresh cookie must converge to the same account. This channel carries EVENTS
// ONLY — never an access token, refresh token, cookie value, or other credential/secret — so a
// message here can never itself grant access to anything.
"use client";

const CHANNEL_NAME = "bookly-auth";

export type AuthBroadcastEvent =
  | { type: "AUTH_LOGGED_OUT"; sourceTabId: string }
  | { type: "AUTH_SESSION_CHANGED"; sourceTabId: string }
  // A user started signing out; the server has not confirmed it yet (see logout-intent.ts).
  | { type: "AUTH_LOGOUT_PENDING"; sourceTabId: string; intentId: string; familyId?: string | undefined }
  // POST /auth/logout succeeded: the pending sign-out is resolved.
  | { type: "AUTH_LOGOUT_CONFIRMED"; sourceTabId: string; intentId: string; familyId: string };

// Non-secret, ephemeral, per-tab identifier — only used so a tab can ignore the events it sent
// itself. Not derived from and not linked to any user/session identity.
export const currentTabId: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}-${Date.now()}`;

let channel: BroadcastChannel | null = null;

const getChannel = (): BroadcastChannel | null => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
};

const post = (event: AuthBroadcastEvent): void => {
  getChannel()?.postMessage(event);
};

export const postAuthLoggedOut = (): void => {
  post({ type: "AUTH_LOGGED_OUT", sourceTabId: currentTabId });
};

export const postAuthSessionChanged = (): void => {
  post({ type: "AUTH_SESSION_CHANGED", sourceTabId: currentTabId });
};

// Which server session this browser profile has already announced. The refresh family (`sid`)
// identifies one server session: every sign-in path (password, OTP, registration, OAuth or any
// other redirect callback) issues a NEW family, and refresh rotation keeps it (api
// token.service.ts). So a restore that yields the already-announced family is a routine reload
// with nothing new for other tabs, while a new family — a different account OR the same account
// signed in again — is announced. Non-secret correlation only (logout-intent.ts persists the
// same value); it decides whether to SEND a notice and is never an authentication input.
// Unknown family or unusable storage: announce, exactly as before.
const ANNOUNCED_SESSION_KEY = "bookly-auth-announced-session";

const getStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const wasSessionAnnounced = (familyId: string | undefined): boolean => {
  if (!familyId) return false;
  try {
    return getStorage()?.getItem(ANNOUNCED_SESSION_KEY) === familyId;
  } catch {
    return false;
  }
};

export const rememberAnnouncedSession = (familyId: string | undefined): void => {
  if (!familyId) return;
  try {
    getStorage()?.setItem(ANNOUNCED_SESSION_KEY, familyId);
  } catch {
    // Without a shared record every restore simply keeps announcing.
  }
};

export const postAuthLogoutPending = (intent: { id: string; familyId?: string | undefined }): void => {
  post({ type: "AUTH_LOGOUT_PENDING", sourceTabId: currentTabId, intentId: intent.id, familyId: intent.familyId });
};

export const postAuthLogoutConfirmed = (intent: { id: string; familyId: string }): void => {
  post({ type: "AUTH_LOGOUT_CONFIRMED", sourceTabId: currentTabId, intentId: intent.id, familyId: intent.familyId });
};

/** Returns an unsubscribe function. A no-op subscription (unsubscribe does nothing) on browsers
 * without BroadcastChannel — those tabs simply don't get cross-tab sync, they keep today's
 * per-tab-only behavior. */
export const subscribeToAuthBroadcast = (
  onEvent: (event: AuthBroadcastEvent) => void,
): (() => void) => {
  const ch = getChannel();
  if (!ch) {
    return () => {};
  }

  const listener = (message: MessageEvent<AuthBroadcastEvent>) => {
    if (message.data.sourceTabId === currentTabId) {
      return;
    }
    onEvent(message.data);
  };

  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
};
