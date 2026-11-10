"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  type CustomerStatusAction,
  type ListSuperAdminCustomersParams,
  superAdminCustomersApi,
} from "@/lib/api/superAdminCustomers";

export const superAdminCustomersKeys = {
  all: ["superAdminCustomers"] as const,
  list: (params: ListSuperAdminCustomersParams) =>
    [...superAdminCustomersKeys.all, "list", params] as const,
  detail: (userId: string, page = 1, relationshipsPage = 1) =>
    [...superAdminCustomersKeys.all, "detail", userId, page, relationshipsPage] as const,
};

export const useSuperAdminCustomersQuery = (params: ListSuperAdminCustomersParams = {}) =>
  useQuery({
    queryKey: superAdminCustomersKeys.list(params),
    queryFn: () => superAdminCustomersApi.list(params),
  });

export const useSuperAdminCustomerDetailQuery = (
  userId: string | undefined,
  page = 1,
  relationshipsPage = 1,
) =>
  useQuery({
    queryKey: superAdminCustomersKeys.detail(userId ?? "", page, relationshipsPage),
    queryFn: () => superAdminCustomersApi.getById(userId as string, page, relationshipsPage),
    enabled: Boolean(userId),
  });

/** P2.2.6 — suspend / reactivate. On success or a status conflict, only the Super Admin
 * Customer directory and detail reads are refreshed (the server state is the outcome). */
export const useChangeCustomerStatusMutation = () => {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: superAdminCustomersKeys.all });
  return useMutation({
    mutationFn: (input: { userId: string; action: CustomerStatusAction; reason?: string }) =>
      superAdminCustomersApi.changeStatus(input.userId, input.action, input.reason),
    onSuccess: refresh,
    onError: (error: unknown) => {
      const status = (error as { status?: number } | null)?.status;
      if (status === 404 || status === 409) void refresh();
    },
  });
};
