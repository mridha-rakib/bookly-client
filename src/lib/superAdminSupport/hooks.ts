"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type ListSuperAdminSupportParams, superAdminSupportApi } from "@/lib/api/superAdminSupport";

export const superAdminSupportKeys = {
  all: ["superAdminSupport"] as const,
  list: (params: ListSuperAdminSupportParams) =>
    [...superAdminSupportKeys.all, "list", params] as const,
  detail: (ticketId: string) => [...superAdminSupportKeys.all, "detail", ticketId] as const,
  messages: (ticketId: string, pagination: { page?: number; limit?: number }) =>
    [...superAdminSupportKeys.all, "messages", ticketId, pagination] as const,
};

export const useSuperAdminSupportTicketsQuery = (params: ListSuperAdminSupportParams = {}) =>
  useQuery({
    queryKey: superAdminSupportKeys.list(params),
    queryFn: () => superAdminSupportApi.list(params),
  });

export const useSuperAdminSupportTicketQuery = (ticketId: string | undefined) =>
  useQuery({
    queryKey: superAdminSupportKeys.detail(ticketId ?? ""),
    queryFn: () => superAdminSupportApi.getById(ticketId as string),
    enabled: Boolean(ticketId),
  });

export const useSuperAdminSupportMessagesQuery = (
  ticketId: string | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: superAdminSupportKeys.messages(ticketId ?? "", pagination),
    queryFn: () => superAdminSupportApi.listMessages(ticketId as string, pagination),
    enabled: Boolean(ticketId),
  });

export const useSuperAdminReplySupportMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      superAdminSupportApi.reply(ticketId, message),
    onSuccess: (_message, variables) => {
      void queryClient.invalidateQueries({
        queryKey: superAdminSupportKeys.detail(variables.ticketId),
      });
      void queryClient.invalidateQueries({ queryKey: superAdminSupportKeys.all });
    },
  });
};

export const useSuperAdminChangeSupportStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      status,
    }: {
      ticketId: string;
      status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
    }) => superAdminSupportApi.changeStatus(ticketId, status),
    onSuccess: (_ticket, variables) => {
      void queryClient.invalidateQueries({
        queryKey: superAdminSupportKeys.detail(variables.ticketId),
      });
      void queryClient.invalidateQueries({ queryKey: superAdminSupportKeys.all });
    },
  });
};

export const useSuperAdminReopenSupportMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => superAdminSupportApi.reopen(ticketId),
    onSuccess: (_ticket, ticketId) => {
      void queryClient.invalidateQueries({ queryKey: superAdminSupportKeys.detail(ticketId) });
      void queryClient.invalidateQueries({ queryKey: superAdminSupportKeys.all });
    },
  });
};
