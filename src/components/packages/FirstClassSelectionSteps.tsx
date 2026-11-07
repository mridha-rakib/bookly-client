"use client";

import { useEffect, type ReactNode } from "react";
import BookingServiceCard, { QuantityStepper } from "@/app/venue/components/BookingServiceCard";
import { VenuePackageCard } from "@/app/venue/components/VenueServices";
import TimeStep from "@/app/venue/components/TimeStep";
import type { TravelAddressFields } from "@/app/venue/components/TravelAddressStep";
import type { AvailabilitySlot, BusinessCatalog, CatalogStaffMember } from "@/lib/api/catalog";
import type { ConsentIntent, ConsentOffer } from "@/lib/api/package-consent";
import type { PackageOffer } from "@/lib/api/package-views";
import type { ClientPropertyType } from "@/lib/api/clients";
import type { BusinessCity } from "@/lib/constants/cities";
import { useServiceAvailabilityQuery } from "@/lib/catalog/hooks";
import { PackageUnavailable } from "./FirstClassPackageViews";

export type FirstClassStep = "services" | "addons" | "travel" | "professionals" | "time" | "payment";
export type Selection = ConsentIntent["selections"][number];
export type OfferItem = ConsentOffer["items"][number];
type Address = NonNullable<Selection["travelAddress"]>;

const objectIdLike = () => Array.from(crypto.getRandomValues(new Uint8Array(12)))
  .map((value) => value.toString(16).padStart(2, "0")).join("");
export const newSelection = (item: OfferItem): Selection => ({
  selectionId: objectIdLike(), definitionItemId: item.definitionItemId, serviceId: item.serviceId,
  staffMembershipId: "", startAt: "", addonIds: [],
});

const emptyAddress: Address = { city: "", area: "", streetName: "", streetNumber: "", propertyType: "" };
export const rowAddress = (row: Selection): Address => row.travelAddress ?? emptyAddress;
export const addressFields = (row: Selection): TravelAddressFields => {
  const address = rowAddress(row);
  return { propertyType: address.propertyType as ClientPropertyType | "", area: address.area, streetName: address.streetName,
    streetNumber: address.streetNumber, floorUnit: address.floorUnit ?? "", aptRoom: address.aptRoom ?? "",
    additionalDirections: address.additionalDirections ?? "" };
};

/** Whether one appointment satisfies the selection a step collects. Add-ons are optional. */
export function stepComplete(step: FirstClassStep, row: Selection, travel: boolean): boolean {
  if (step === "travel") {
    const address = rowAddress(row);
    return !travel || Boolean(address.city && address.propertyType && address.area.trim() && address.streetName.trim() && address.streetNumber.trim());
  }
  if (step === "professionals") return Boolean(row.staffMembershipId);
  if (step === "time") return Boolean(row.startAt);
  return true;
}

/** The quote intent carries a travel destination only for a travelling Business, without blank optional fields. */
export const intentSelections = (rows: Selection[], travel: boolean): Selection[] => rows.map(({ travelAddress, ...row }) => {
  if (!travel || !travelAddress) return row;
  const { floorUnit, aptRoom, additionalDirections, ...required } = travelAddress;
  return { ...row, travelAddress: { ...required, area: required.area.trim(), streetName: required.streetName.trim(), streetNumber: required.streetNumber.trim(),
    ...(floorUnit?.trim() ? { floorUnit: floorUnit.trim() } : {}), ...(aptRoom?.trim() ? { aptRoom: aptRoom.trim() } : {}),
    ...(additionalDirections?.trim() ? { additionalDirections: additionalDirections.trim() } : {}) } };
});

/** Server-eligible providers, presented with the catalogue's avatar where it has one. */
export const eligibleStaff = (item: OfferItem, catalog?: BusinessCatalog): CatalogStaffMember[] => item.providers.map((provider) =>
  catalog?.staff.find((member) => member.id === provider.id) ?? { id: provider.id, firstName: provider.name, role: "STAFF" });

export const durationLabel = (serviceId: string, catalog?: BusinessCatalog) => {
  const service = catalog?.services.find((candidate) => candidate.id === serviceId);
  const minutes = service?.isPackageDeal ? service.packagePricing?.durationMin : service?.fixedPricing?.durationMin ?? service?.perPersonPricing?.durationMin;
  return minutes === undefined ? undefined : minutesLabel(minutes);
};
export const minutesLabel = (minutes: number) => {
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 > 0 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`;
};

/** Identifies which initial appointment a per-appointment step is configuring, and which still need input. */
export function AppointmentSwitcher({ appointments, activeId, onSelect, locked }: {
  appointments: Array<{ id: string; name: string; complete: boolean; status: string }>; activeId?: string;
  onSelect: (id: string) => void; locked: boolean;
}) {
  const active = appointments.findIndex((appointment) => appointment.id === activeId);
  const ready = appointments.filter((appointment) => appointment.complete).length;
  return <div className="flex flex-col gap-3">
    {appointments.length > 1 ? <section aria-label="Your initial appointments" className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-[#1C1B1C]">Your {appointments.length} initial appointments</h2>
        <span className="text-sm text-[#45474B]">{ready} of {appointments.length} ready for this step</span>
      </div>
      <div role="group" aria-label="Appointment being configured" className="mt-3 grid gap-2 sm:grid-cols-2">
        {appointments.map((appointment, index) => {
          const current = appointment.id === activeId;
          return <button key={appointment.id} type="button" aria-pressed={current} onClick={() => onSelect(appointment.id)}
            className={`flex min-h-14 min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] ${current ? "border-[#1C1B1C] bg-[#F5F4EE] ring-1 ring-[#1C1B1C]" : "border-neutral-200 bg-white hover:bg-neutral-50"}`}>
            <span aria-hidden="true" className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${current ? "bg-[#1C1B1C] text-white" : "bg-neutral-100 text-[#1C1B1C]"}`}>{index + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[#1C1B1C]">Appointment {index + 1} · {appointment.name}</span>
              <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${appointment.complete ? "bg-[#E1F5EE] text-[#245C4A]" : "bg-[#FEF8CF] text-[#322509]"}`}>
                {appointment.complete ? "✓ " : ""}{appointment.status}
              </span>
            </span>
          </button>;
        })}
      </div>
    </section> : null}
    {active >= 0 && <p className="text-base text-[#45474B]">
      {appointments.length > 1 ? `Configuring appointment ${active + 1} of ${appointments.length}: ` : "Configuring: "}
      <span className="font-semibold text-[#1C1B1C]">{appointments[active]!.name}</span> · included in your package
    </p>}
    {locked && <p role="status" className="rounded-lg bg-[#F5F4EE] p-3 text-sm text-[#45474B]">These selections are bound to your original Package quote and cannot be edited here.</p>}
  </div>;
}

/** Normal Booking's Services step presentation for the Package's included services. */
export function FirstClassServicesStep({ offer, offerSummary, catalog, selections, locked, onChange }: {
  offer: ConsentOffer; offerSummary?: PackageOffer; catalog?: BusinessCatalog; selections: Selection[];
  locked: boolean; onChange: (next: Selection[]) => void;
}) {
  const setCount = (item: OfferItem, count: number) => {
    if (locked) return;
    const own = selections.filter((row) => row.definitionItemId === item.definitionItemId);
    if (count < own.length) {
      const removed = new Set(own.slice(count).map((row) => row.selectionId));
      onChange(selections.filter((row) => !removed.has(row.selectionId)));
    } else if (count > own.length && count <= item.quantity && item.providers.length)
      onChange([...selections, ...Array.from({ length: count - own.length }, () => newSelection(item))]);
  };
  const included = offer.items.reduce((total, item) => total + item.quantity, 0);
  return <>
    <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C]">Select Services</h1>
    {offerSummary ? <VenuePackageCard offer={offerSummary} action={null} /> : <h2 className="text-xl font-semibold text-[#0D0D0D]">{offer.name}</h2>}
    {offer.checkoutAvailable === false && <PackageUnavailable reason={offer.checkoutUnavailableReason} />}
    <section aria-label="Initial appointments summary" className="rounded-xl border border-neutral-200 bg-white p-4 text-[#1C1B1C]">
      <p className="text-base">Choose at least one appointment to book now. Sessions you do not book now stay in My Packages as credits for later.</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {([["Included", included], ["Booking now", selections.length], ["Kept as credits", included - selections.length]] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-[#F5F4EE] px-2 py-2">
          <dt className="text-xs font-medium text-[#45474B]">{label}</dt><dd className="text-lg font-semibold">{value}</dd>
        </div>)}
      </dl>
      <p className="mt-3 text-sm text-[#45474B]">Times use the business timezone ({offer.timezone}).</p>
    </section>
    {locked && <p role="status" className="rounded-lg bg-[#F5F4EE] p-3 text-sm text-[#45474B]">These selections are bound to your original Package quote and cannot be edited here.</p>}
    <h2 className="text-xl font-semibold text-[#1C1B1C]">Included services</h2>
    <div className="flex flex-col gap-4" aria-label="Services included in this package">
      {offer.items.map((item) => {
        const count = selections.filter((row) => row.definitionItemId === item.definitionItemId).length;
        const duration = durationLabel(item.serviceId, catalog);
        const description = catalog?.services.find((service) => service.id === item.serviceId)?.description;
        const unavailable = !item.providers.length;
        return <BookingServiceCard key={item.definitionItemId} name={item.name} selected={count > 0} disabled={locked || (unavailable && count === 0)}
          onToggle={() => setCount(item, count > 0 ? 0 : 1)}>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-inter font-medium text-lg text-[#0D0D0D] break-words">{item.name}</h4>
            <span className="rounded-full bg-[#E1F5EE] px-2.5 py-0.5 text-xs font-semibold text-[#245C4A]">Included in package</span>
          </div>
          {duration && <span className="text-sm text-[#45474B]">{duration} per session</span>}
          {description && <p className="text-sm text-[#45474B] break-words">{description}</p>}
          <p className="text-sm text-[#1C1B1C]">
            <span className="font-semibold">{item.quantity}</span> {item.quantity === 1 ? "session" : "sessions"} included ·{" "}
            <span className="font-semibold">{count}</span> booking now · <span className="font-semibold">{item.quantity - count}</span> kept as credits
          </p>
          {unavailable && <p role="status" className="text-sm text-red-700">No eligible professionals are currently offered for this service, so it cannot be booked now.</p>}
          {item.quantity > 1 && <QuantityStepper label="Initial appointments" value={count}
            canDecrement={!locked && count > 0} canIncrement={!locked && !unavailable && count < item.quantity}
            onDecrement={() => setCount(item, count - 1)} onIncrement={() => setCount(item, count + 1)} />}
        </BookingServiceCard>;
      })}
    </div>
  </>;
}

const monthRange = (month: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { fromDate: `${month.getFullYear()}-${pad(month.getMonth() + 1)}-01`, toDate: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}` };
};

/** Normal Booking's Time step bound to one appointment's own service, professional and city. */
export function FirstClassTimeStep({ businessId, row, travel, timezone, visibleMonth, onMonth, dateIso, onDate, slot, onSlot, onStale, context }: {
  businessId: string; row: Selection; travel: boolean; timezone: string; visibleMonth: Date;
  onMonth: (delta: number) => void; dateIso?: string; onDate: (dateIso: string) => void;
  slot?: AvailabilitySlot; onSlot: (slot: AvailabilitySlot) => void; onStale: () => void; context?: ReactNode;
}) {
  const range = monthRange(visibleMonth);
  const city = rowAddress(row).city;
  const availability = useServiceAvailabilityQuery(businessId, row.serviceId, row.staffMembershipId && (!travel || city) ? {
    ...range, staffMembershipId: row.staffMembershipId, partySize: 1, ...(travel ? { customerCity: city as BusinessCity } : {}),
  } : undefined);
  const day = dateIso ? availability.data?.days.find((candidate) => candidate.date === dateIso) : undefined;
  const settled = Boolean(availability.data) && !availability.isFetching && !availability.isLoading;
  // A fresh read that no longer offers this professional the chosen time cannot keep it.
  const stale = Boolean(row.startAt && dateIso && settled && dateIso >= range.fromDate && dateIso <= range.toDate &&
    !day?.slots.some((candidate) => candidate.startAt === row.startAt && candidate.eligibleStaffMembershipIds.includes(row.staffMembershipId)));
  useEffect(() => { if (stale) onStale(); }, [stale, onStale]);
  return <TimeStep timezone={timezone} visibleMonth={visibleMonth} onPrevMonth={() => onMonth(-1)} onNextMonth={() => onMonth(1)}
    availability={availability.data} isLoading={availability.isLoading} isError={availability.isError} onRetry={() => void availability.refetch()}
    selectedDateIso={dateIso} onSelectDate={onDate} selectedSlot={stale ? undefined : slot} onSelectSlot={onSlot} context={context} />;
}
