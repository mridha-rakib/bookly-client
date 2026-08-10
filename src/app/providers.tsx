"use client";

import React, { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/lib/auth/store";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );
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
