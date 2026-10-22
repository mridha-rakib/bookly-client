let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;

/** Non-secret correlation from the in-memory JWT, never an authentication proof. */
export const getSessionFamilyId = (): string | undefined => {
  try {
    const payload = accessToken?.split(".")[1];
    if (!payload) return undefined;
    const { sid } = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { sid?: unknown };
    return typeof sid === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sid)
      ? sid : undefined;
  } catch {
    return undefined;
  }
};

export const setAccessToken = (token: string): void => {
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};
