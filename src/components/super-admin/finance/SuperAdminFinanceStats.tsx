"use client";

import React from "react";

import { formatBookingMoney } from "@/lib/bookings/format";
import type { PlatformFinanceSummary } from "@/lib/api/superAdminFinance";
import type { PromoDiscountedMoney } from "@/lib/api/promo";

interface SuperAdminFinanceStatsProps {
  summary?: PlatformFinanceSummary;
  isLoading?: boolean;
  discountedMoney?: PromoDiscountedMoney;
  isDiscountedMoneyLoading?: boolean;
}

export default function SuperAdminFinanceStats({
  summary,
  isLoading,
  discountedMoney,
  isDiscountedMoneyLoading,
}: SuperAdminFinanceStatsProps) {
  const amount = (cents: number | undefined) =>
    cents !== undefined ? formatBookingMoney(cents) : isLoading ? "…" : "—";

  const cards = [
    {
      title: "Activation fees — Bookly revenue",
      value: amount(summary?.bookly.netCents),
      subtitle: "Net of Bookly's own Stripe fee",
      valueColor: "text-[#6366F1]",
    },
    {
      title: "Collected for businesses",
      value: amount(summary?.collectedForBusinesses.amountCents),
      subtitle: summary
        ? `No-show ${formatBookingMoney(summary.collectedForBusinesses.noShowAmountCents)} · Late cancel ${formatBookingMoney(summary.collectedForBusinesses.cancellationAmountCents)}`
        : isLoading
          ? "Loading…"
          : "—",
      valueColor: "text-[#6366F1]",
    },
    {
      title: "Sent to businesses via SEPA",
      value: amount(summary?.sentToBusinesses.amountCents),
      subtitle: summary ? `${summary.sentToBusinesses.payoutCount} payouts sent (all time)` : "—",
      valueColor: "text-[#8D1212]",
    },
    {
      title: "Pending payouts",
      value: amount(summary?.pendingPayouts.amountCents),
      subtitle: summary
        ? `${summary.pendingPayouts.businessCount} business${summary.pendingPayouts.businessCount === 1 ? "" : "es"} awaiting SEPA`
        : "—",
      valueColor: "text-[#D97706]",
    },
    {
      title: "Discounted money",
      value: amount(discountedMoney?.totalCents),
      subtitle: discountedMoney
        ? `${discountedMoney.count} Promo redemption${discountedMoney.count === 1 ? "" : "s"} · Bookly-funded`
        : isDiscountedMoneyLoading
          ? "Loading…"
          : "—",
      valueColor: "text-[#0CC0DF]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full">
      {cards.map((c, idx) => (
        <div
          key={idx}
          className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-2 font-sans"
        >
          <span className="text-[13px] font-medium text-gray-500">{c.title}</span>
          <span className={`text-3xl font-bold ${c.valueColor}`}>{c.value}</span>
          <span className="text-[12px] font-normal text-gray-400">{c.subtitle}</span>
        </div>
      ))}
    </div>
  );
}
