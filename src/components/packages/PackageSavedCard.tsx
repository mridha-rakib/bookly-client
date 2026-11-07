"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { paymentsApi } from "@/lib/api/payments";
import { useAuthStore } from "@/lib/auth/store";
import { packageSecondaryCta } from "./package-cta";

/** Reuses saved-card management; this read never sets up a card or starts a payment. */
export function PackageSavedCard() {
  const userId = useAuthStore((state) => state.user?.id);
  const epoch = useAuthStore((state) => state.cacheEpoch);
  const card = useQuery({ queryKey: ["packageSavedCard", userId, epoch], queryFn: paymentsApi.getSavedCardStatus,
    retry: false, refetchOnWindowFocus: true, staleTime: 0 });
  return <section aria-label="Saved payment card" className="space-y-3 rounded-xl bg-[#F5F4EE] p-4 text-sm">
    <h3 className="font-semibold">Saved payment card</h3>
    {card.isPending ? <p role="status">Loading saved card…</p> : card.isError ? <p role="alert">Saved card status could not be loaded. No payment has been started by this check.</p>
      : card.data.hasSavedCard ? <p>{card.data.card ? `${card.data.card.brand} ending ${card.data.card.last4}` : "A saved card is available."} The server verifies the method and amount when purchasing.</p>
        : <p>Save a payment card before an online payment is required, then return to this original purchase.</p>}
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link className={packageSecondaryCta} href="/customer/payment-card" target="_blank" rel="noopener noreferrer">Manage saved card (new tab)</Link>
      <button className={packageSecondaryCta} type="button" disabled={card.isFetching} onClick={() => void card.refetch()}>Check saved card again</button>
    </div>
  </section>;
}
