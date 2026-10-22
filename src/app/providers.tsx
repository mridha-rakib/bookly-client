"use client";

import React, { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

import LogoutPendingNotice from "@/components/auth/LogoutPendingNotice";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/lib/auth/store";
import { isOAuthCallbackPath } from "@/lib/auth/oauth-callback";
import { queryClient } from "@/lib/query-client";

export default function Providers({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const cacheEpoch = useAuthStore((state) => state.cacheEpoch);
  const oauthCallback = isOAuthCallbackPath(usePathname());

  useEffect(() => {
    void restoreSession({ resolveLogout: !oauthCallback });
  }, [restoreSession, oauthCallback]);

  return (
    <QueryClientProvider key={cacheEpoch} client={queryClient}>
      {children}
      <LogoutPendingNotice />
      <Toaster
        closeButton
        richColors
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "12px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
