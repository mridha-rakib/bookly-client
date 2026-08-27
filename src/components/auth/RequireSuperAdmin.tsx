"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import { authRoutes, getAuthenticatedUserHomePath } from "@/lib/auth/routes";
import { useAuthStore } from "@/lib/auth/store";

interface RequireSuperAdminProps {
  children: React.ReactNode;
}

/** Batch 8 — the Super Admin dashboard previously had no route guard at all (confirmed by
 * investigation). Mirrors RequireBusinessOwner/RequireSupervisor, except unauthenticated
 * users go to the dedicated Super Admin login (the professional portal rejects this role). */
export default function RequireSuperAdmin({ children }: RequireSuperAdminProps) {
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
      router.replace(authRoutes.superAdminLogin);
      return;
    }

    if (status === "authenticated" && user?.role !== "SUPER_ADMIN") {
      router.replace(user ? getAuthenticatedUserHomePath(user) : authRoutes.professionalAuth);
    }
  }, [router, status, user]);

  if (status !== "authenticated" || isInitializing || user?.role !== "SUPER_ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins">
        <Spinner className="text-[#240183]" />
      </div>
    );
  }

  return <>{children}</>;
}
