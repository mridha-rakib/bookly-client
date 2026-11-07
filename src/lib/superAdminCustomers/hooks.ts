"use client";

import { useQuery } from "@tanstack/react-query";

import {
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
