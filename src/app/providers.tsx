"use client";

import React, { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/lib/auth/store";
import { queryClient } from "@/lib/query-client";

export default function Providers({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
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
