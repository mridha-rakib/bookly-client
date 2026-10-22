import { QueryClient, type QueryKey } from "@tanstack/react-query";

// Queries may retry a network/server failure once. Client errors (including 429)
// need an explicit later attempt; mutations remain non-retrying below.
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (error instanceof Error && error.name === "StaleAuthGenerationError") return false;
  const httpError = error as { status?: number; response?: { status?: number } } | null;
  const status = httpError?.status ?? httpError?.response?.status;
  return failureCount < 1 && (status === undefined || status >= 500);
};

// The current identity's client is also accessible to non-React auth teardown.
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export let queryClient = createQueryClient();

/** Cache ownership is the client instance, rather than a partial list of private keys.
 * Only audited anonymous content/configuration survives an identity boundary.
 * Old callbacks retain the retired client, so they cannot write into the new cache. */
export const rotateQueryClient = (): void => {
  const previous = queryClient;
  const next = createQueryClient();
  for (const query of previous.getQueryCache().getAll()) {
    if (isPublicQuery(query.queryKey) && query.state.status === "success" && !query.state.isInvalidated) {
      next.setQueryData(query.queryKey, query.state.data, { updatedAt: query.state.dataUpdatedAt });
    }
  }
  queryClient = next;
  void previous.cancelQueries();
  previous.clear();
};

const isPublicQuery = (key: QueryKey): boolean =>
  (key.length === 2 && key[0] === "platformSettings" && key[1] === "publicBookingConfig") ||
  // GET /discovery/categories and /discovery/founding-partners take no auth middleware and their
  // controllers ignore the request, so the payload is identical for every identity. (Not
  // homeSections: it can be personalized for a signed-in customer.)
  (key.length === 2 && key[0] === "discovery" && (key[1] === "categories" || key[1] === "foundingPartners")) ||
  (key[0] === "content" && (
    key[1] === "publicFaqs" ||
    (key[1] === "blog" && (key[2] === "publicList" || key[2] === "publicDetail")) ||
    (key[1] === "staticPages" && key[2] === "public")
  ));
