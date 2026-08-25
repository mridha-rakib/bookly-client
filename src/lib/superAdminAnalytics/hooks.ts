"use client";

import { useQuery } from "@tanstack/react-query";

import type { AnalyticsPeriodParams } from "@/lib/api/superAdminAnalytics";
import { superAdminAnalyticsApi } from "@/lib/api/superAdminAnalytics";

export const superAdminAnalyticsKeys = {
  all: ["superAdminAnalytics"] as const,
  bookings: (period: AnalyticsPeriodParams) => [...superAdminAnalyticsKeys.all, "bookings", period] as const,
  businesses: (period: AnalyticsPeriodParams) =>
    [...superAdminAnalyticsKeys.all, "businesses", period] as const,
  customers: (period: AnalyticsPeriodParams) =>
    [...superAdminAnalyticsKeys.all, "customers", period] as const,
  topServices: (period: AnalyticsPeriodParams & { limit?: number }) =>
    [...superAdminAnalyticsKeys.all, "topServices", period] as const,
  cities: () => [...superAdminAnalyticsKeys.all, "cities"] as const,
  recentActivity: (limit?: number) => [...superAdminAnalyticsKeys.all, "recentActivity", limit] as const,
};

export const useSuperAdminBookingAnalyticsQuery = (period: AnalyticsPeriodParams = {}) =>
  useQuery({
    queryKey: superAdminAnalyticsKeys.bookings(period),
    queryFn: () => superAdminAnalyticsApi.getBookingAnalytics(period),
  });

export const useSuperAdminBusinessAnalyticsQuery = (period: AnalyticsPeriodParams = {}) =>
  useQuery({
    queryKey: superAdminAnalyticsKeys.businesses(period),
    queryFn: () => superAdminAnalyticsApi.getBusinessAnalytics(period),
  });

export const useSuperAdminCustomerAnalyticsQuery = (period: AnalyticsPeriodParams = {}) =>
  useQuery({
    queryKey: superAdminAnalyticsKeys.customers(period),
    queryFn: () => superAdminAnalyticsApi.getCustomerAnalytics(period),
  });

export const useSuperAdminTopServicesQuery = (period: AnalyticsPeriodParams & { limit?: number } = {}) =>
  useQuery({
    queryKey: superAdminAnalyticsKeys.topServices(period),
    queryFn: () => superAdminAnalyticsApi.getTopServices(period),
  });

export const useSuperAdminCityCoverageQuery = () =>
  useQuery({
    queryKey: superAdminAnalyticsKeys.cities(),
    queryFn: () => superAdminAnalyticsApi.getCityCoverage(),
  });

export const useSuperAdminRecentActivityQuery = (limit?: number) =>
  useQuery({
    queryKey: superAdminAnalyticsKeys.recentActivity(limit),
    queryFn: () => superAdminAnalyticsApi.getRecentActivity(limit),
  });
