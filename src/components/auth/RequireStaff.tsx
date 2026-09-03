"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import { authRoutes, getAuthenticatedUserHomePath } from "@/lib/auth/routes";
import { useAuthStore } from "@/lib/auth/store";

interface RequireStaffProps {
  children: React.ReactNode;
}

/**
 * Phase 2D — mirrors RequireSupervisor. `/staff-dashboard` previously had no client auth gate at
 * all. The backend remains the source of truth for every staff API call; this only stops a
 * wrong-role or signed-out browser from rendering the staff shell.
 */
export default function RequireStaff({ children }: RequireStaffProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    if (status === "unknown") {
      void restoreSession();
    }
  }, [restoreSession, status]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(authRoutes.professionalAuth);
      return;
    }

    if (status === "authenticated" && user?.role !== "STAFF") {
      router.replace(user ? getAuthenticatedUserHomePath(user) : authRoutes.professionalAuth);
    }
  }, [router, status, user]);

  if (status !== "authenticated" || isInitializing || user?.role !== "STAFF") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins">
        <Spinner className="text-[#240183]" />
      </div>
    );
  }

  return <>{children}</>;
}
