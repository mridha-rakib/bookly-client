import React from "react";
import { formatBookingMoney } from "@/lib/bookings/format";
import type { FinancialRow } from "@/lib/bookings/customer-financial";

export default function CustomerFinancialRows({ rows, rowClassName = "flex justify-between items-center gap-3 text-sm" }: { rows: FinancialRow[]; rowClassName?: string }) {
  return <>{rows.map((row, index) => (
    <div key={`${row.label}-${index}`} className={`${rowClassName} ${
      row.tone === "success" ? "text-[#1F8900]" : row.tone === "attention" ? "text-amber-800" : "text-[#4E5F78]"
    }`}>
      <span>{row.label}</span>
      {row.amountCents !== undefined && <span className="font-manrope shrink-0">{formatBookingMoney(row.amountCents)}</span>}
    </div>
  ))}</>;
}
