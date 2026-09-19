// Same-origin, same-browser-profile cross-tab auth event channel. Bookly's product model is
// "one session per browser profile / cookie jar" (see auto-logout audit, 2026-09): every tab
// sharing the refresh cookie must converge to the same account. This channel carries EVENTS
// ONLY — never an access token, refresh token, cookie value, or other credential/secret — so a
// message here can never itself grant access to anything.
"use client";

const CHANNEL_NAME = "bookly-auth";

export type AuthBroadcastEvent =
  | { type: "AUTH_LOGGED_OUT"; sourceTabId: string }
  | { type: "AUTH_SESSION_CHANGED"; sourceTabId: string };

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
