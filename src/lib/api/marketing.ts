import { apiRequest } from "./client";

/**
 * Marketing Email Stage M2 — public unsubscribe. No auth. The backend accepts the signed token
 * in the request body; a bad/missing token returns a generic failure (no account info). Returns
 * nothing meaningful on success — the page only needs to know it resolved.
 */
export const marketingApi = {
  unsubscribe: (token: string) =>
    apiRequest<undefined>({
      method: "POST",
      url: "/marketing/unsubscribe",
      data: { token },
    }),
};
