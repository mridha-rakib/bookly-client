"use client";

import { skipToken, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import type { SupportMessage, SupportMessageHistoryParams, SupportMessageHistoryResult } from "@/lib/api/support";
import { useAuthStore } from "@/lib/auth/store";

/**
 * P1.8 — one conversation-history model for every Support view (Customer, Business requester and
 * Super Admin). A ticket opens on its newest bounded page; older history is fetched on demand in
 * bounded keyset pages (server cursor = `(createdAt, _id)`), and messages are never edited or
 * deleted, so already-loaded pages are immutable and never downloaded again.
 *
 * Two cache entries per (identity scope, ticket), each with a single writer:
 * - `latest`: the newest window, refreshed by its own query (and appended to by a confirmed
 *   reply). A refresh merges into what is already held; if more new messages arrived than one
 *   page holds, the gap is walked back to contiguity.
 * - `older`: pages loaded through "Load older messages"; written only by that action.
 * The view is their id-deduplicated union in `(createdAt, id)` order.
 */

export const SUPPORT_CONVERSATION_PAGE_SIZE = 50;
const MAX_GAP_PAGES = 10;

export const SUPPORT_REQUESTER_ROLES = ["CUSTOMER", "BUSINESS_OWNER", "SUPERVISOR", "STAFF"] as const;
export const SUPPORT_ADMIN_ROLES = ["SUPER_ADMIN"] as const;

/** `${userId}:${cacheEpoch}` for an eligible, settled, non-suspended session — otherwise null,
 * which disables reads and masks any cached data (same contract as the P1.7 favorite scope). */
export const currentSupportScope = (roles: readonly string[]): string | null => {
  const { user, status, isInitializing, cacheEpoch } = useAuthStore.getState();
  return status === "authenticated" &&
    !isInitializing &&
    user != null &&
    roles.includes(user.role) &&
    user.status !== "SUSPENDED"
    ? `${user.id}:${cacheEpoch}`
    : null;
};

export const useSupportScope = (roles: readonly string[]): string | null => {
  useAuthStore((state) => state.user);
  useAuthStore((state) => state.status);
  useAuthStore((state) => state.isInitializing);
  useAuthStore((state) => state.cacheEpoch);
  return currentSupportScope(roles);
};

const compareMessages = (a: SupportMessage, b: SupportMessage): number => {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (byTime !== 0) return byTime;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
};

/** Union by message id, chronological with the server's `_id` tie-breaker. */
export const mergeSupportMessages = (...lists: SupportMessage[][]): SupportMessage[] => {
  const byId = new Map<string, SupportMessage>();
  for (const list of lists) for (const message of list) byId.set(message.id, message);
  return [...byId.values()].sort(compareMessages);
};

export type SupportConversationWindow = {
  messages: SupportMessage[];
  total: number;
  hasOlder: boolean;
  olderCursor: string | null;
};

type OlderWindow = Omit<SupportConversationWindow, "total">;

export type SupportConversationConfig = {
  keyRoot: readonly unknown[];
  roles: readonly string[];
  fetchPage: (ticketId: string, params: SupportMessageHistoryParams) => Promise<SupportMessageHistoryResult>;
};

export const supportConversationKeys = (keyRoot: readonly unknown[]) => ({
  all: [...keyRoot, "conversation"] as const,
  ticket: (scope: string | null, ticketId: string) => [...keyRoot, "conversation", scope, ticketId] as const,
  latest: (scope: string | null, ticketId: string) =>
    [...keyRoot, "conversation", scope, ticketId, "latest"] as const,
  older: (scope: string | null, ticketId: string) =>
    [...keyRoot, "conversation", scope, ticketId, "older"] as const,
});

const fetchLatestWindow = async (
  config: SupportConversationConfig,
  queryClient: QueryClient,
  scope: string,
  ticketId: string,
): Promise<SupportConversationWindow> => {
  const keys = supportConversationKeys(config.keyRoot);
  const latestKey = keys.latest(scope, ticketId);
  const held = queryClient.getQueryData<SupportConversationWindow>(latestKey);
  const heldNewest = held?.messages.at(-1);

  const page = await config.fetchPage(ticketId, { limit: SUPPORT_CONVERSATION_PAGE_SIZE });
  let messages = page.messages;
  let hasOlder = page.history.hasOlder;
  let olderCursor = page.history.olderCursor;

  if (heldNewest) {
    // More new messages than one page holds: walk back until the fresh window meets held history.
    let walked = 0;
    while (hasOlder && olderCursor && messages[0] && compareMessages(messages[0], heldNewest) > 0) {
      if (walked >= MAX_GAP_PAGES) {
        // Too far apart to stitch: start again from this fresh window; drop disconnected history.
        queryClient.removeQueries({ queryKey: keys.older(scope, ticketId), exact: true });
        return { messages, total: page.pagination.total, hasOlder, olderCursor };
      }
      walked += 1;
      const older = await config.fetchPage(ticketId, {
        before: olderCursor,
        limit: SUPPORT_CONVERSATION_PAGE_SIZE,
      });
      messages = [...older.messages, ...messages];
      hasOlder = older.history.hasOlder;
      olderCursor = older.history.olderCursor;
    }
  }

  // Re-read after the awaits so a reply confirmed meanwhile is merged, never overwritten.
  const current = queryClient.getQueryData<SupportConversationWindow>(latestKey) ?? held;
  if (current && current.messages.length > 0) {
    return {
      messages: mergeSupportMessages(current.messages, messages),
      total: page.pagination.total,
      hasOlder: current.hasOlder,
      olderCursor: current.olderCursor,
    };
  }
  return { messages, total: page.pagination.total, hasOlder, olderCursor };
};

export type SupportConversation = {
  messages: SupportMessage[];
  total: number;
  hasOlder: boolean;
  /** No conversation data yet (first read in flight, or session not yet eligible). */
  isLoading: boolean;
  /** The first read failed: nothing to show — never presented as an empty conversation. */
  isError: boolean;
  retry: () => void;
  loadOlder: () => void;
  isLoadingOlder: boolean;
  /** The last older-page read failed; loaded messages are kept and `loadOlder` retries. */
  olderError: unknown;
};

export const useSupportConversation = (
  config: SupportConversationConfig,
  ticketId: string | undefined,
): SupportConversation => {
  const queryClient = useQueryClient();
  const scope = useSupportScope(config.roles);
  const keys = supportConversationKeys(config.keyRoot);
  const id = ticketId ?? "";
  const enabled = Boolean(scope && ticketId);

  const latestQuery = useQuery({
    queryKey: keys.latest(scope, id),
    queryFn: () => fetchLatestWindow(config, queryClient, scope as string, id),
    enabled,
  });
  const olderQuery = useQuery<OlderWindow>({
    queryKey: keys.older(scope, id),
    queryFn: skipToken,
    staleTime: Infinity,
  });

  const olderMutation = useMutation({
    mutationKey: [...keys.all, "older", scope],
    mutationFn: async (variables: { scope: string; ticketId: string; before: string }) => {
      const page = await config.fetchPage(variables.ticketId, {
        before: variables.before,
        limit: SUPPORT_CONVERSATION_PAGE_SIZE,
      });
      return { variables, page };
    },
    onSuccess: ({ variables, page }) => {
      // A late page for a previous identity is discarded; one for a previous ticket still lands
      // in that ticket's own entry and never in the one now on screen.
      if (variables.scope !== currentSupportScope(config.roles)) return;
      queryClient.setQueryData<OlderWindow>(keys.older(variables.scope, variables.ticketId), (previous) => ({
        messages: mergeSupportMessages(previous?.messages ?? [], page.messages),
        hasOlder: page.history.hasOlder,
        olderCursor: page.history.olderCursor,
      }));
    },
  });

  const { reset: resetOlderMutation } = olderMutation;
  useEffect(() => {
    resetOlderMutation();
  }, [scope, id, resetOlderMutation]);

  const latest = enabled ? latestQuery.data : undefined;
  const older = enabled ? olderQuery.data : undefined;
  const messages = latest ? mergeSupportMessages(older?.messages ?? [], latest.messages) : [];
  const boundary = older ?? latest;
  const hasOlder = Boolean(boundary?.hasOlder && boundary.olderCursor);

  const mutationIsCurrent =
    olderMutation.variables?.scope === scope && olderMutation.variables?.ticketId === id;
  const isLoadingOlder = olderMutation.isPending && mutationIsCurrent;

  const loadOlder = useCallback(() => {
    const before = boundary?.olderCursor;
    if (!scope || !ticketId || !before || olderMutation.isPending) return;
    olderMutation.mutate({ scope, ticketId, before });
  }, [boundary?.olderCursor, scope, ticketId, olderMutation]);

  const { refetch } = latestQuery;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    messages,
    total: latest?.total ?? 0,
    hasOlder,
    isLoading: !latest && !(enabled && latestQuery.isError),
    isError: enabled && !latest && latestQuery.isError,
    retry,
    loadOlder,
    isLoadingOlder,
    olderError: mutationIsCurrent && olderMutation.isError ? olderMutation.error : null,
  };
};

/** After a confirmed reply: show it immediately in its own ticket's window (deduplicated), then
 * refresh that window's newest page — never older pages, never another ticket or identity. */
export const applyConfirmedSupportReply = async (
  config: SupportConversationConfig,
  queryClient: QueryClient,
  scope: string,
  message: SupportMessage,
): Promise<void> => {
  if (scope !== currentSupportScope(config.roles)) return;
  const latestKey = supportConversationKeys(config.keyRoot).latest(scope, message.ticketId);
  queryClient.setQueryData<SupportConversationWindow>(latestKey, (previous) => {
    if (!previous) return previous;
    if (previous.messages.some((existing) => existing.id === message.id)) return previous;
    return {
      ...previous,
      messages: mergeSupportMessages(previous.messages, [message]),
      total: previous.total + 1,
    };
  });
  await queryClient.invalidateQueries({ queryKey: latestKey, exact: true });
};
