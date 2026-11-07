"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { type CreateSupportTicketInput, type SupportMessage, supportApi } from "@/lib/api/support";
import {
  applyConfirmedSupportReply,
  currentSupportScope,
  SUPPORT_REQUESTER_ROLES,
  type SupportConversationConfig,
  useSupportConversation as useSupportConversationHistory,
  useSupportScope,
} from "@/lib/support/conversation";

/** P1.8 — every key carries the requester identity scope (`userId:cacheEpoch`), so a previous
 * account's tickets/messages can never be served from cache to the next session. */
export const supportKeys = {
  all: ["support"] as const,
  lists: (scope: string | null) => [...supportKeys.all, "list", scope] as const,
  list: (pagination: { page?: number; limit?: number }, scope: string | null) =>
    [...supportKeys.lists(scope), pagination] as const,
  detail: (ticketId: string, scope: string | null) =>
    [...supportKeys.all, "detail", scope, ticketId] as const,
};

export const supportConversationConfig: SupportConversationConfig = {
  keyRoot: supportKeys.all,
  roles: SUPPORT_REQUESTER_ROLES,
  fetchPage: supportApi.listMessageHistory,
};

const useRequesterScope = () => useSupportScope(SUPPORT_REQUESTER_ROLES);

export const useSupportTicketsQuery = (pagination: { page?: number; limit?: number } = {}) => {
  const scope = useRequesterScope();
  const query = useQuery({
    queryKey: supportKeys.list(pagination, scope),
    queryFn: () => supportApi.list(pagination),
    enabled: Boolean(scope),
  });
  return { ...query, isLoading: query.isPending && !query.isError, data: scope ? query.data : undefined };
};

/** Server-paginated "My Tickets" page state. If the requested page is beyond the current total
 * (e.g. its last row is no longer in the result), it moves to the last available page. */
export const useSupportTicketsPage = (pageSize: number) => {
  const [page, setPage] = useState(1);
  const ticketsQuery = useSupportTicketsQuery({ page, limit: pageSize });
  const total = ticketsQuery.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const loadedTickets = ticketsQuery.data?.tickets.length ?? 0;

  const pageOutOfRange = Boolean(ticketsQuery.data) && page > 1 && loadedTickets === 0;
  // Render-time adjustment (no effect cascade): step back toward the last available page.
  if (pageOutOfRange) setPage(Math.max(1, Math.min(page - 1, totalPages)));

  return {
    page,
    setPage,
    totalPages,
    total,
    // While moving back to an available page, show loading rather than a false "no tickets".
    ticketsQuery: { ...ticketsQuery, isLoading: ticketsQuery.isLoading || pageOutOfRange },
  };
};

export const useSupportTicketQuery = (ticketId: string | undefined) => {
  const scope = useRequesterScope();
  const query = useQuery({
    queryKey: supportKeys.detail(ticketId ?? "", scope),
    queryFn: () => supportApi.getById(ticketId as string),
    enabled: Boolean(ticketId && scope),
  });
  return { ...query, isLoading: query.isPending && !query.isError, data: scope ? query.data : undefined };
};

/** Latest-first conversation with "Load older messages" (see lib/support/conversation.ts). */
export const useSupportConversation = (ticketId: string | undefined) =>
  useSupportConversationHistory(supportConversationConfig, ticketId);

export const useCreateSupportTicketMutation = () => {
  const queryClient = useQueryClient();
  const scope = useRequesterScope();
  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) => supportApi.create(input),
    onSuccess: () => {
      if (scope && scope === currentSupportScope(SUPPORT_REQUESTER_ROLES)) {
        void queryClient.invalidateQueries({ queryKey: supportKeys.lists(scope) });
      }
    },
  });
};

export const useReplySupportTicketMutation = () => {
  const queryClient = useQueryClient();
  const scope = useRequesterScope();
  return useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => {
      const created: SupportMessage = await supportApi.reply(ticketId, message);
      return { created, scope };
    },
    onSuccess: ({ created, scope: requestScope }, variables) => {
      if (!requestScope || requestScope !== currentSupportScope(SUPPORT_REQUESTER_ROLES)) return;
      void queryClient.invalidateQueries({ queryKey: supportKeys.detail(variables.ticketId, requestScope) });
      void queryClient.invalidateQueries({ queryKey: supportKeys.lists(requestScope) });
      void applyConfirmedSupportReply(supportConversationConfig, queryClient, requestScope, created);
    },
  });
};

export const useReopenSupportTicketMutation = () => {
  const queryClient = useQueryClient();
  const scope = useRequesterScope();
  return useMutation({
    mutationFn: (ticketId: string) => supportApi.reopen(ticketId),
    onSuccess: (_ticket, ticketId) => {
      if (!scope || scope !== currentSupportScope(SUPPORT_REQUESTER_ROLES)) return;
      void queryClient.invalidateQueries({ queryKey: supportKeys.detail(ticketId, scope) });
      void queryClient.invalidateQueries({ queryKey: supportKeys.lists(scope) });
    },
  });
};
