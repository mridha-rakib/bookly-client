// Test-only identity; never imported by a production route or used against a real API.
export const fixtureUser = { id: "fixture-customer", role: "CUSTOMER", firstName: "Fixture", lastName: "Customer" };
const state = {
  user: typeof window !== "undefined" && new URLSearchParams(window.location.search).get("state") === "anonymous" ? null : fixtureUser,
  status: typeof window !== "undefined" && new URLSearchParams(window.location.search).get("state") === "anonymous" ? "unauthenticated" : "authenticated",
  cacheEpoch: 1, isInitializing: false, isLoggingOut: false,
  logout: async () => "confirmed", restoreSession: async () => undefined,
  logoutState: { phase: "idle", retryAt: null, reason: null, persisted: false, signInOverride: false },
};
export const useAuthStore = Object.assign(function useAuthStore<T>(selector: (value: typeof state) => T) { return selector(state); }, {
  getState: () => state,
});
