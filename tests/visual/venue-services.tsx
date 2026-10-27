import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VenueDetailsPage from "../../src/app/venue/page";
import "../../src/app/globals.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={queryClient}>
  <div role="note" className="border-2 border-[#240183] bg-white p-3 text-center text-sm font-bold text-[#240183]">VISUAL FIXTURE — NOT LIVE PURCHASE DATA · Actual Venue page with isolated catalogue/identity adapters</div>
  <VenueDetailsPage />
</QueryClientProvider>);
