"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { staffAppointmentsApi, type StaffAppointmentDetail, type StaffAppointmentListParams } from "@/lib/api/staff-appointments";
import { useAuthStore } from "@/lib/auth/store";
import { staffKeys } from "@/lib/staff/hooks";

/** P4C-1 — read-only Staff appointment queries. Refetched on mount (default staleness) and on
 * explicit retry; no polling. Keys sit under `staffKeys.all`, which identity rotation clears. */
export const staffAppointmentKeys = {
  all: (businessId: string) => [...staffKeys.all, "my-appointments", businessId] as const,
  list: (businessId: string, params: StaffAppointmentListParams) =>
    [...staffAppointmentKeys.all(businessId), "list", params] as const,
  detail: (businessId: string, bookingId: string) =>
    [...staffAppointmentKeys.all(businessId), "detail", bookingId] as const,
};

export const useMyAppointmentsQuery = (businessId: string | undefined, params: StaffAppointmentListParams) =>
  useQuery({
    queryKey: staffAppointmentKeys.list(businessId ?? "", params),
    queryFn: () => staffAppointmentsApi.listMine(businessId as string, params),
    enabled: Boolean(businessId),
    // Preserve paging within the same Business, never a previous tenant's appointments.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[staffKeys.all.length + 1] === businessId ? previous : undefined,
  });

/** D-S2: sensitive detail lives only in this mounted view, outside the shared Query cache.
 * Clear before revalidation, on hidden tab, identity/tenant changes, errors and unmount.
 * Abort and ignore late responses; an old response never restores authorization.
 */
export const useMyAppointmentQuery = (businessId: string | undefined, bookingId: string | undefined) => {
  const epoch = useAuthStore((state) => state.cacheEpoch);
  const status = useAuthStore((state) => state.status);
  const actor = useAuthStore((state) => state.user);
  const enabled = Boolean(businessId && bookingId && status === "authenticated" && actor?.role === "STAFF" && actor.status === "ACTIVE");
  const scope = JSON.stringify([epoch, status, actor?.id, businessId, bookingId]);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    scope: string; data?: StaffAppointmentDetail; error?: unknown; loading: boolean;
  }>({ scope, loading: true });
  const refetch = useCallback(() => {
    setState({ scope, loading: true });
    setRevision((value) => value + 1);
  }, [scope]);

  useEffect(() => {
    let active = true;
    let request: AbortController | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      request?.abort();
      clearTimeout(expiryTimer);
      setState({ scope, loading: true });
    };
    const load = () => {
      clear();
      if (!enabled || document.visibilityState === "hidden") return;
      const current = new AbortController();
      request = current;
      void staffAppointmentsApi.getMine(businessId!, bookingId!, current.signal).then(
        (data) => {
          if (active && !current.signal.aborted) {
            setState({ scope, data, loading: false });
            if (data.travelAddress) {
              // Re-authorize at the operational window's end; never retain an ended address.
              const remaining = new Date(data.schedule.endAt).getTime() - Date.now();
              expiryTimer = setTimeout(load, Math.min(Math.max(remaining, 0), 2_147_483_647));
            }
          }
        },
        (error: unknown) => {
          if (active && !current.signal.aborted) setState({ scope, error, loading: false });
        },
      );
    };
    const visibility = () => document.visibilityState === "hidden" ? clear() : load();
    load();
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      request?.abort();
      clearTimeout(expiryTimer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [scope, revision, enabled, businessId, bookingId]);

  const current = enabled && state.scope === scope;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    isLoading: enabled && (!current || state.loading),
    isError: current && state.error !== undefined,
    refetch,
  };
};
