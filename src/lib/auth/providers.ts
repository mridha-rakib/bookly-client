"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";

type AppleAvailability = { customer: boolean; professional: boolean; linking: boolean };

/** A missing/older API, pending request or failed request must never offer an unavailable login. */
export const useAppleOAuthAvailability = (): AppleAvailability => {
  const { data, isError, isFetching } = useQuery({
    queryKey: ["auth", "providers"],
    queryFn: ({ signal }) => apiRequest<{ apple: AppleAvailability }>({
      method: "GET", url: "/auth/providers", signal, timeout: 5000,
    }),
    retry: false,
    staleTime: 0,
  });
  return {
    customer: !isError && !isFetching && data?.apple?.customer === true,
    professional: !isError && !isFetching && data?.apple?.professional === true,
    linking: !isError && !isFetching && data?.apple?.linking === true,
  };
};
