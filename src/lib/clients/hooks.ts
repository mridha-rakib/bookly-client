"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  clientsApi,
  type CreateClientInput,
  type ListClientsParams,
  type UpdateClientInput,
} from "@/lib/api/clients";

export const clientKeys = {
  all: ["clients"] as const,
  list: (businessId: string, params: ListClientsParams) =>
    [...clientKeys.all, "list", businessId, params] as const,
  detail: (businessId: string, clientId: string) =>
    [...clientKeys.all, "detail", businessId, clientId] as const,
};

export const useClientsQuery = (
  businessId: string | undefined,
  params: ListClientsParams = {},
  enabled = true,
) =>
  useQuery({
    queryKey: clientKeys.list(businessId ?? "", params),
    queryFn: () => clientsApi.listClients(businessId as string, params),
    enabled: Boolean(businessId) && enabled,
  });

export const useClientQuery = (businessId: string | undefined, clientId: string | undefined) =>
  useQuery({
    queryKey: clientKeys.detail(businessId ?? "", clientId ?? ""),
    queryFn: () => clientsApi.getClient(businessId as string, clientId as string),
    enabled: Boolean(businessId) && Boolean(clientId),
  });

// A Client mutation can move a row between the default/archived buckets or flip its link
// state, so any narrower invalidation risks leaving a stale list cached under a different
// filter combination — same rationale as Services' invalidateServiceCaches.
const invalidateClientCaches = (queryClient: ReturnType<typeof useQueryClient>, businessId: string) => {
  void queryClient.invalidateQueries({ queryKey: [...clientKeys.all, "list", businessId] });
  void queryClient.invalidateQueries({ queryKey: [...clientKeys.all, "detail", businessId] });
};

export const useCreateClientMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, input }: { businessId: string; input: CreateClientInput }) =>
      clientsApi.createClient(businessId, input),
    onSuccess: (_client, variables) => {
      invalidateClientCaches(queryClient, variables.businessId);
    },
  });
};

export const useUpdateClientMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      businessId,
      clientId,
      input,
    }: {
      businessId: string;
      clientId: string;
      input: UpdateClientInput;
    }) => clientsApi.updateClient(businessId, clientId, input),
    onSuccess: (_client, variables) => {
      invalidateClientCaches(queryClient, variables.businessId);
    },
  });
};

export const useArchiveClientMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, clientId }: { businessId: string; clientId: string }) =>
      clientsApi.archiveClient(businessId, clientId),
    onSuccess: (_result, variables) => {
      invalidateClientCaches(queryClient, variables.businessId);
    },
  });
};

export const useRestoreClientMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, clientId }: { businessId: string; clientId: string }) =>
      clientsApi.restoreClient(businessId, clientId),
    onSuccess: (_client, variables) => {
      invalidateClientCaches(queryClient, variables.businessId);
    },
  });
};
