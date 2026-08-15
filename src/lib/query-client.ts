import { QueryClient } from "@tanstack/react-query";

// Singleton so it can be cleared from outside React (e.g. the auth store's
// logout action) without prop-drilling or context lookups.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
