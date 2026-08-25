"use client";

import { useQuery } from "@tanstack/react-query";

import { type ListSuperAdminBookingsParams, superAdminBookingsApi } from "@/lib/api/superAdminBookings";

export const superAdminBookingsKeys = {
  all: ["superAdminBookings"] as const,
  list: (params: ListSuperAdminBookingsParams) =>
    [...superAdminBookingsKeys.all, "list", params] as const,
  detail: (bookingId: string) => [...superAdminBookingsKeys.all, "detail", bookingId] as const,
};

export const useSuperAdminBookingsQuery = (params: ListSuperAdminBookingsParams = {}) =>
  useQuery({
    queryKey: superAdminBookingsKeys.list(params),
    queryFn: () => superAdminBookingsApi.list(params),
  });

export const useSuperAdminBookingDetailQuery = (bookingId: string | undefined) =>
  useQuery({
    queryKey: superAdminBookingsKeys.detail(bookingId ?? ""),
    queryFn: () => superAdminBookingsApi.getById(bookingId as string),
    enabled: Boolean(bookingId),
  });
