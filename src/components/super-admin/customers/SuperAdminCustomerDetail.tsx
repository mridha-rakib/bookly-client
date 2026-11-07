"use client";

import React, { useState } from "react";
import {
  BOOKING_STATUS_LABELS,
  formatBookingDate,
  formatBookingTime,
  formatPackageSessionLabel,
} from "@/lib/bookings/format";
import { useSuperAdminCustomerDetailQuery } from "@/lib/superAdminCustomers/hooks";
import { superAdminCustomersApi } from "@/lib/api/superAdminCustomers";
import { CustomerAvatar, CustomerExport, CustomerPagination } from "./CustomerShared";

const statusLabels: Record<string, string> = {
  ACTIVE: "Active",
  DORMANT: "Dormant",
  SUSPENDED: "Suspended",
  DELETED: "Deleted",
};
const bookingLabels = { ...BOOKING_STATUS_LABELS, CANCELLED_BY_CUSTOMER: "Cancelled by customer" };
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(cents / 100);
const tableClass =
  "w-full text-left text-xs [&_th]:whitespace-nowrap [&_th]:bg-gray-50 [&_th]:p-4 [&_th]:font-semibold [&_td]:p-4 [&_tbody_tr]:border-t [&_tbody_tr]:border-gray-100";

export default function SuperAdminCustomerDetail({
  customerId,
  onBack,
}: {
  customerId: string;
  onBack: () => void;
}) {
  const [page, setPage] = useState(1),
    [relationshipsPage, setRelationshipsPage] = useState(1);
  const {
    data: customer,
    isLoading,
    isError,
    refetch,
  } = useSuperAdminCustomerDetailQuery(customerId, page, relationshipsPage);
  if (isError)
    return (
      <div role="alert" className="rounded-xl border bg-white p-8 text-rose-600">
        Failed to load this customer.{" "}
        <button onClick={() => void refetch()} className="underline">
          Retry
        </button>{" "}
        <button onClick={onBack} className="underline">
          Back to Customers
        </button>
      </div>
    );
  if (isLoading || !customer)
    return (
      <div role="status" className="p-8 text-center text-gray-500">
        Loading customer…
      </div>
    );
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;
  return (
    <div className="flex w-full flex-col gap-6 pb-12 font-sans">
      <nav aria-label="Breadcrumb" className="flex gap-2 text-xs text-gray-500">
        <button onClick={onBack} className="hover:underline">
          Customers
        </button>
        <span aria-hidden="true">›</span>
        <span className="text-gray-900">{name}</span>
      </nav>
      <section
        aria-label="Customer profile"
        className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:flex-row"
      >
        <CustomerAvatar customer={customer} />
        <div className="flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-gray-100 pb-4">
            <h2 className="text-xl font-bold text-gray-900">{name}</h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${customer.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : customer.status === "SUSPENDED" ? "bg-rose-50 text-rose-700" : "bg-gray-100 text-gray-600"}`}
            >
              {statusLabels[customer.status]}
            </span>
          </div>
          <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Email", customer.email],
              ["Phone", customer.phone?.e164 ?? "Not provided"],
              [
                "Member since",
                new Date(customer.createdAt).toLocaleDateString("en-GB", {
                  timeZone: "UTC",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
              ],
              ["Location / profile address", customer.address ?? "Not provided"],
              ["Marketing consent", customer.marketingConsent ? "Opted in" : "Not opted in"],
              [
                "Saved card",
                customer.hasSavedCard
                  ? customer.savedCard
                    ? `${customer.savedCard.brand} •••• ${customer.savedCard.last4}`
                    : "Saved card on file"
                  : "No saved card",
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="mt-1 break-words text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section aria-label="Booking statistics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Total Bookings", customer.statistics.total, "text-indigo-600"],
          ["Completed", customer.statistics.completed, "text-emerald-600"],
          ["No-shows", customer.statistics.noShows, "text-rose-600"],
          ["Upcoming", customer.statistics.upcoming, "text-indigo-600"],
        ].map(([label, count, color]) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${color}`}>{count}</p>
          </div>
        ))}
      </section>
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Customer–Business Relationships
        </h3>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Business</th>
                <th>Relationship status</th>
                <th>Last Booking</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {!customer.relationships.length && (
                <tr>
                  <td colSpan={4} className="text-center text-gray-500">
                    No Business relationships.
                  </td>
                </tr>
              )}
              {customer.relationships.map((relationship) => (
                <tr key={relationship.id}>
                  <td className="font-medium text-gray-900">{relationship.businessName}</td>
                  <td>
                    <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
                      {relationship.classification === "RETURNING" ? "Returning" : "First"}
                    </span>
                    {relationship.archived && <span className="ml-2 text-gray-500">Archived</span>}
                    {relationship.financialState &&
                      ["FIRST_PENDING", "RESTORATION_PENDING"].includes(
                        relationship.financialState,
                      ) && (
                        <p className="mt-2 text-gray-500">
                          {relationship.financialState === "FIRST_PENDING"
                            ? "First payment pending"
                            : "Restoration pending"}
                        </p>
                      )}
                  </td>
                  <td className="whitespace-nowrap">
                    {relationship.lastBooking
                      ? `${formatBookingDate(relationship.lastBooking.startAt, relationship.lastBooking.timezone)} ${formatBookingTime(relationship.lastBooking.startAt, relationship.lastBooking.timezone)}`
                      : "No bookings"}
                  </td>
                  <td className="min-w-48 whitespace-pre-wrap break-words">
                    {relationship.notes ?? "No notes"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CustomerPagination
          label="Customer relationships pagination"
          pagination={customer.relationshipPagination}
          onChange={setRelationshipsPage}
        />
      </section>
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Booking History</h3>
          <CustomerExport
            scope="All bookings for this customer across all Businesses"
            load={() => superAdminCustomersApi.exportBookings(customerId)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Business</th>
                <th>Service / Package</th>
                <th>Amount</th>
                <th>Online paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!customer.bookings.length && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-500">
                    No bookings on this page.
                  </td>
                </tr>
              )}
              {customer.bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="whitespace-nowrap">
                    <p>{formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}</p>
                    <p className="mt-1 text-gray-500">
                      {formatBookingTime(booking.schedule.startAt, booking.schedule.timezone)} ·{" "}
                      {booking.schedule.timezone}
                    </p>
                  </td>
                  <td>{booking.businessName}</td>
                  <td>
                    <p>{booking.primaryServiceName}</p>
                    {booking.packageSessions.map((session) => (
                      <p
                        key={`${session.packageProgressId}:${session.sessionIndex}`}
                        className="mt-1 text-gray-500"
                      >
                        {formatPackageSessionLabel(session)}
                      </p>
                    ))}
                  </td>
                  <td className="whitespace-nowrap">
                    {money(booking.totalCents, booking.currency)}
                  </td>
                  <td className="whitespace-nowrap">
                    {money(booking.actualOnlinePaidCents, booking.currency)}
                  </td>
                  <td>
                    <span className="whitespace-nowrap rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                      {bookingLabels[booking.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CustomerPagination
          label="Customer booking history pagination"
          pagination={customer.bookingPagination}
          onChange={setPage}
        />
      </section>
    </div>
  );
}
