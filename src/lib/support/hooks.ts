"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type CreateSupportTicketInput, supportApi } from "@/lib/api/support";

export const supportKeys = {
  all: ["support"] as const,
  list: (pagination: { page?: number; limit?: number }) =>
    [...supportKeys.all, "list", pagination] as const,
  detail: (ticketId: string) => [...supportKeys.all, "detail", ticketId] as const,
  messages: (ticketId: string, pagination: { page?: number; limit?: number }) =>
    [...supportKeys.all, "messages", ticketId, pagination] as const,
};

export const useSupportTicketsQuery = (pagination: { page?: number; limit?: number } = {}) =>
  useQuery({
    queryKey: supportKeys.list(pagination),
    queryFn: () => supportApi.list(pagination),
  });

export const useSupportTicketQuery = (ticketId: string | undefined) =>
  useQuery({
    queryKey: supportKeys.detail(ticketId ?? ""),
    queryFn: () => supportApi.getById(ticketId as string),
    enabled: Boolean(ticketId),
  });

export const useSupportMessagesQuery = (
  ticketId: string | undefined,
  pagination: { page?: number; limit?: number } = {},
) =>
  useQuery({
    queryKey: supportKeys.messages(ticketId ?? "", pagination),
    queryFn: () => supportApi.listMessages(ticketId as string, pagination),
    enabled: Boolean(ticketId),
  });

export const useCreateSupportTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) => supportApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};

export const useReplySupportTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      supportApi.reply(ticketId, message),
    onSuccess: (_message, variables) => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.detail(variables.ticketId) });
      void queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};

export const useReopenSupportTicketMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => supportApi.reopen(ticketId),
    onSuccess: (_ticket, ticketId) => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.detail(ticketId) });
      void queryClient.invalidateQueries({ queryKey: supportKeys.all });
    },
  });
};
