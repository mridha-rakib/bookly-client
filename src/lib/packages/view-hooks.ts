"use client";
import { useQuery } from "@tanstack/react-query";
import { packageViewsApi } from "@/lib/api/package-views";
import { useAuthStore } from "@/lib/auth/store";

// No polling/retries. Include user and cache epoch, in addition to existing query-client rotation.
export function usePackageView(kind: "catalogue" | "owned" | "settlement", businessId?: string, id?: string, before?: string) {
  const user = useAuthStore((s) => s.user);
  const epoch = useAuthStore((s) => s.cacheEpoch);
  const status = useAuthStore((s) => s.status);
  const roleAllowed = kind === "settlement" ? ["BUSINESS_OWNER", "SUPERVISOR"].includes(user?.role ?? "") : user?.role === "CUSTOMER";
  return useQuery<Awaited<ReturnType<typeof packageViewsApi.catalogue>> | Awaited<ReturnType<typeof packageViewsApi.owned>> | Awaited<ReturnType<typeof packageViewsApi.settlement>>>({
    queryKey: ["packageViews", user?.id, epoch, kind, businessId, id, before],
    queryFn: () => kind === "catalogue" ? packageViewsApi.catalogue(businessId!, id)
      : kind === "owned" ? packageViewsApi.owned(id, before) : packageViewsApi.settlement(businessId!, id!),
    enabled: status === "authenticated" && roleAllowed && (kind === "owned" || Boolean(businessId)) && (kind !== "settlement" || Boolean(id)),
    retry: false, staleTime: 30_000, refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
}
