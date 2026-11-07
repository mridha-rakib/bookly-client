"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { formatBookingDate, formatBookingMoney } from "@/lib/bookings/format";

export interface BookingSelection {
  name: string; durationLabel?: string; quantityLabel?: string; indicativePriceCents?: number;
  appointments: Array<{ id: string; name: string; professional?: string; avatarUrl?: string; durationLabel?: string;
    startAt?: string; timezone?: string; locationLabel?: string; address?: string;
    addons: Array<{ id: string; name: string; priceCents?: number }>;
    /** Set when amounts come from an authoritative quote rather than the catalogue. */
    quoted?: boolean; amounts?: Array<{ label: string; cents: number }>; status?: string }>;
}

const pending = (text: string) => <span className="font-normal text-[#5F5E5A]">{text}</span>;
function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-1">
    <dt className="text-[#45474B]">{label}</dt><dd className="min-w-0 font-medium text-[#1C1B1C] break-words">{children}</dd>
  </div>;
}

/** In-memory selections are not a financial quote or a reserved appointment. */
export default function BookingSelectionSummary({ selection }: { selection: BookingSelection }) {
  const several = selection.appointments.length > 1;
  return <section aria-label="Selected booking details" className="space-y-4 text-sm break-words">
    <div className="space-y-1"><h3 className="font-semibold text-base text-[#1C1B1C]">{selection.name}</h3>
      {selection.durationLabel && <p className="text-[#45474B]">{selection.durationLabel}</p>}
      {selection.quantityLabel && <p className="text-[#45474B]">{selection.quantityLabel}</p>}
      {selection.indicativePriceCents !== undefined && <p className="text-[#45474B]"><span className="font-semibold text-[#1C1B1C]">Catalogue amount: {formatBookingMoney(selection.indicativePriceCents)}</span> · indicative; final amount requires a quote.</p>}
    </div>
    {selection.appointments.length === 0 && <p className="rounded-lg bg-[#F5F4EE] p-3 text-[#45474B]">No appointments selected yet.</p>}
    {selection.appointments.map((appointment, index) => <article key={appointment.id} aria-label={several ? `Appointment ${index + 1}` : "Appointment"}
      className={several ? "rounded-lg border border-neutral-200 p-3" : "border-t border-neutral-200 pt-3"}>
      {several && <h4 className="mb-1 font-semibold text-[#1C1B1C]">Appointment {index + 1}: {appointment.name}</h4>}
      <dl>
        {!several && <Row label="Service">{appointment.name}</Row>}
        {appointment.durationLabel && <Row label="Duration">{appointment.durationLabel}</Row>}
        <Row label="Professional">{appointment.professional
          ? <span className="inline-flex items-center gap-2">{appointment.avatarUrl && <Image src={appointment.avatarUrl} alt="" width={24} height={24} className="rounded-full" />}<span>Professional: {appointment.professional}</span></span>
          : pending("Not chosen yet")}</Row>
        <Row label="Date & time">{appointment.startAt && appointment.timezone
          ? <>{formatBookingDate(appointment.startAt, appointment.timezone)} · {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: appointment.timezone }).format(new Date(appointment.startAt))} <span className="font-normal text-[#45474B]">({appointment.timezone})</span></>
          : pending("Not chosen yet")}</Row>
        {(appointment.locationLabel || appointment.address) && <Row label="Location">
          {appointment.locationLabel && <span className="block">{appointment.locationLabel}</span>}
          {appointment.address ? <span className="block whitespace-pre-wrap font-normal">{appointment.address}</span> : pending("Address not entered yet")}
        </Row>}
        <Row label="Add-ons">{appointment.addons.length > 0
          ? <ul>{appointment.addons.map((addon) => <li key={addon.id}>{addon.name} · <span className="font-normal">{addon.priceCents === undefined ? "Amount pending quote" : `${formatBookingMoney(addon.priceCents)}${appointment.quoted ? " (quoted)" : " indicative"}`}</span></li>)}</ul>
          : pending("None")}</Row>
        {appointment.amounts?.map((amount) => <Row key={amount.label} label={amount.label}>{formatBookingMoney(amount.cents)}</Row>)}
        {appointment.status && <Row label="Status">{appointment.status}</Row>}
      </dl>
    </article>)}
  </section>;
}
