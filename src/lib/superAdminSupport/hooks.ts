"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type ListSuperAdminSupportParams, superAdminSupportApi } from "@/lib/api/superAdminSupport";
import {
  applyConfirmedSupportReply,
  currentSupportScope,
  SUPPORT_ADMIN_ROLES,
  type SupportConversationConfig,
  useSupportConversation,
  useSupportScope,
} from "@/lib/support/conversation";

/** P1.8 — keys carry the Super Admin identity scope (`userId:cacheEpoch`). */
export const superAdminSupportKeys = {
  all: ["superAdminSupport"] as const,
  lists: (scope: string | null) => [...superAdminSupportKeys.all, "list", scope] as const,
  list: (params: ListSuperAdminSupportParams, scope: string | null) =>
    [...superAdminSupportKeys.lists(scope), params] as const,
  detail: (ticketId: string, scope: string | null) =>
    [...superAdminSupportKeys.all, "detail", scope, ticketId] as const,
};

export const superAdminSupportConversationConfig: SupportConversationConfig = {
  keyRoot: superAdminSupportKeys.all,
  roles: SUPPORT_ADMIN_ROLES,
  fetchPage: superAdminSupportApi.listMessageHistory,
};

const useAdminScope = () => useSupportScope(SUPPORT_ADMIN_ROLES);
const isCurrentAdminScope = (scope: string | null): scope is string =>
  Boolean(scope) && scope === currentSupportScope(SUPPORT_ADMIN_ROLES);

export const useSuperAdminSupportTicketsQuery = (params: ListSuperAdminSupportParams = {}) => {
  const scope = useAdminScope();
  const query = useQuery({
    queryKey: superAdminSupportKeys.list(params, scope),
    queryFn: () => superAdminSupportApi.list(params),
    enabled: Boolean(scope),
  });
  return { ...query, isLoading: query.isPending && !query.isError, data: scope ? query.data : undefined };
};

export const useSuperAdminSupportTicketQuery = (ticketId: string | undefined) => {
  const scope = useAdminScope();
  const query = useQuery({
    queryKey: superAdminSupportKeys.detail(ticketId ?? "", scope),
    queryFn: () => superAdminSupportApi.getById(ticketId as string),
    enabled: Boolean(ticketId && scope),
  });
  return { ...query, isLoading: query.isPending && !query.isError, data: scope ? query.data : undefined };
};

/** Latest-first conversation with "Load older messages" (see lib/support/conversation.ts). */
export const useSuperAdminSupportConversation = (ticketId: string | undefined) =>
  useSupportConversation(superAdminSupportConversationConfig, ticketId);

export const useSuperAdminReplySupportMutation = () => {
  const queryClient = useQueryClient();
  const scope = useAdminScope();
  return useMutation({
    mutationFn: async ({ ticketId, message }: { ticketId: string; message: string }) => ({
      created: await superAdminSupportApi.reply(ticketId, message),
      scope,
    }),
    onSuccess: ({ created, scope: requestScope }, variables) => {
      if (!isCurrentAdminScope(requestScope)) return;
      void queryClient.invalidateQueries({
        queryKey: superAdminSupportKeys.detail(variables.ticketId, requestScope),
      });
      void queryClient.invalidateQueries({ queryKey: superAdminSupportKeys.lists(requestScope) });
      void applyConfirmedSupportReply(
        superAdminSupportConversationConfig,
        queryClient,
        requestScope,
        created,
      );
    },
  });
};

export const useSuperAdminChangeSupportStatusMutation = () => {
  const queryClient = useQueryClient();
  const scope = useAdminScope();
  return useMutation({
    mutationFn: ({
      ticketId,
      status,
    }: {
      ticketId: string;
      status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
    }) => superAdminSupportApi.changeStatus(ticketId, status),
    onSuccess: (_ticket, variables) => {
      if (!isCurrentAdminScope(scope)) return;
      void queryClient.invalidateQueries({
        queryKey: superAdminSupportKeys.detail(variables.ticketId, scope),
      });
      void queryClient.invalidateQueries({ queryKey: superAdminSupportKeys.lists(scope) });
    },
  });
};

export const useSuperAdminReopenSupportMutation = () => {
  const queryClient = useQueryClient();
  const scope = useAdminScope();
  return useMutation({
    mutationFn: (ticketId: string) => superAdminSupportApi.reopen(ticketId),
    onSuccess: (_ticket, ticketId) => {
      if (!isCurrentAdminScope(scope)) return;
      void queryClient.invalidateQueries({ queryKey: superAdminSupportKeys.detail(ticketId, scope) });
      void queryClient.invalidateQueries({ queryKey: superAdminSupportKeys.lists(scope) });
    },
  });
};
