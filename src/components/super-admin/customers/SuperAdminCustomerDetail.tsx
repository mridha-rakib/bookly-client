"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar01Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { BOOKING_STATUS_LABELS, bookingClientBadge, formatBookingDate, formatBookingMoney, formatBookingTime } from "@/lib/bookings/format";
import { useSuperAdminCustomerDetailQuery } from "@/lib/superAdminCustomers/hooks";

interface SuperAdminCustomerDetailProps {
  customerId: string;
  onBack: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  DORMANT: "Dormant",
  SUSPENDED: "Suspended",
};

const CLIENT_BADGE_CLASS: Record<string, string> = {
  New: "bg-[#ECECFC] text-[#6366F1]",
  Manual: "bg-[#FEF6C7] text-[#323232]",
  Returning: "bg-[#E3E3E3] text-[#323232]",
};

export default function SuperAdminCustomerDetail({ customerId, onBack }: SuperAdminCustomerDetailProps) {
  const { data: customer, isLoading, isError } = useSuperAdminCustomerDetailQuery(customerId);

  if (isLoading || !customer) {
    return <div className="p-8 text-center text-gray-400">Loading…</div>;
  }
  if (isError) {
    return <div className="p-8 text-center text-rose-500">Failed to load this customer.</div>;
  }

  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const completed = customer.bookings.filter((b) => b.status === "COMPLETED").length;
  const noShows = customer.bookings.filter((b) => b.status.startsWith("NO_SHOW")).length;
  const upcoming = customer.bookings.filter((b) => b.status === "UPCOMING" || b.status === "PENDING").length;

  return (
    <div className="flex flex-col gap-6 w-full pb-12 font-sans">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <button onClick={onBack} className="hover:text-gray-900 transition-colors bg-transparent border-none p-0 cursor-pointer">
          Customers
        </button>
        <span className="text-gray-300">›</span>
        <span className="text-[#111827]">{name}</span>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col md:flex-row items-start gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg text-[#4338CA] bg-[#EEF2FF] shrink-0">
          {initials}
        </div>

        <div className="flex-1 w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full border-b border-gray-100 pb-4 mb-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-xl text-[#111827]">{name}</h2>
                <span
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-full ${
                    customer.status === "ACTIVE"
                      ? "bg-emerald-50 text-[#16A34A]"
                      : customer.status === "DORMANT"
                        ? "bg-amber-50 text-[#A37616]"
                        : "bg-rose-50 text-[#E14747]"
                  }`}
                >
                  {STATUS_LABEL[customer.status]}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <HugeiconsIcon icon={Calendar01Icon} className="w-3.5 h-3.5" />
                <span>
                  Registered{" "}
                  {new Date(customer.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 text-xs text-gray-500">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={Mail01Icon} className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span>{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-1.5">
                  <span>{customer.phone.e164}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards Row — computed from the same bounded booking history below */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-500">Total Bookings</span>
          <span className="text-3xl font-bold text-[#6366F1]">{customer.bookingsTotal}</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-500">Completed</span>
          <span className="text-3xl font-bold text-[#16A34A]">{completed}</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-500">No-Shows</span>
          <span className="text-3xl font-bold text-[#DC2626]">{noShows}</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 flex flex-col gap-1">
          <span className="text-[13px] font-medium text-gray-500">Upcoming</span>
          <span className="text-3xl font-bold text-[#6366F1]">{upcoming}</span>
        </div>
      </div>

      {/* Booking History Section */}
      <div className="bg-white rounded-xl shadow-[0px_4px_12px_rgba(0,0,0,0.08)] border border-gray-100 p-6 flex flex-col gap-4 w-full">
        <h3 className="font-semibold text-lg text-[#111827]">Booking History</h3>

        {customer.bookings.length === 0 ? (
          <p className="text-sm text-gray-400">No bookings yet.</p>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-gray-200 text-gray-700 font-semibold">
                  <th className="p-4 whitespace-nowrap">Date & Time</th>
                  <th className="p-4 whitespace-nowrap">Service</th>
                  <th className="p-4 whitespace-nowrap text-center">Amount</th>
                  <th className="p-4 whitespace-nowrap text-center">Type</th>
                  <th className="p-4 whitespace-nowrap text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customer.bookings.map((b) => {
                  const badge = bookingClientBadge(b.source, b.platformFeeCents);
                  return (
                    <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 whitespace-nowrap">
                            {formatBookingDate(b.schedule.startAt, b.schedule.timezone)}
                          </span>
                          <span className="text-gray-500 text-[11px] whitespace-nowrap">
                            {formatBookingTime(b.schedule.startAt, b.schedule.timezone)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-900 font-normal whitespace-nowrap">{b.primaryServiceName}</td>
                      <td className="p-4 text-gray-900 font-normal whitespace-nowrap text-center">
                        {formatBookingMoney(b.totalCents)}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CLIENT_BADGE_CLASS[badge]}`}>
                          {badge}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-center">
                        <span className="inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full bg-gray-100 text-gray-700">
                          {BOOKING_STATUS_LABELS[b.status]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {customer.bookingsTotal > customer.bookings.length && (
          <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
            Showing the {customer.bookings.length} most recent of {customer.bookingsTotal} total bookings.
          </p>
        )}
      </div>
    </div>
  );
}
