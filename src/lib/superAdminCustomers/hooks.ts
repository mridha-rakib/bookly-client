"use client";

import { useQuery } from "@tanstack/react-query";

import { type ListSuperAdminCustomersParams, superAdminCustomersApi } from "@/lib/api/superAdminCustomers";

export const superAdminCustomersKeys = {
  all: ["superAdminCustomers"] as const,
  list: (params: ListSuperAdminCustomersParams) =>
    [...superAdminCustomersKeys.all, "list", params] as const,
  detail: (userId: string) => [...superAdminCustomersKeys.all, "detail", userId] as const,
};

export const useSuperAdminCustomersQuery = (params: ListSuperAdminCustomersParams = {}) =>
  useQuery({
    queryKey: superAdminCustomersKeys.list(params),
    queryFn: () => superAdminCustomersApi.list(params),
  });

export const useSuperAdminCustomerDetailQuery = (userId: string | undefined) =>
  useQuery({
    queryKey: superAdminCustomersKeys.detail(userId ?? ""),
    queryFn: () => superAdminCustomersApi.getById(userId as string),
    enabled: Boolean(userId),
  });
