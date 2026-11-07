"use client";
import { useEffect, useRef, useState } from "react";
import { catalogApi, type AvailabilityResult } from "@/lib/api/catalog";
import type { ConsentIntent, ConsentOffer } from "@/lib/api/package-consent";
import type { BusinessCity } from "@/lib/constants/cities";
import { formatBookingMoney } from "@/lib/bookings/format";
import { packageFieldClass, packageSecondaryCta } from "./package-cta";

export function PackagePurchaseAppointmentPicker({ businessId, row, item, travel, disabled, onChange }: {
  businessId: string; row: ConsentIntent["selections"][number]; item: ConsentOffer["items"][number];
  travel: boolean; disabled: boolean; onChange: (next: ConsentIntent["selections"][number]) => void;
}) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<AvailabilityResult>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0), inFlight = useRef(false);
  useEffect(() => () => { sequence.current += 1; }, []);
  const address: NonNullable<typeof row.travelAddress> = row.travelAddress ?? { city: "", area: "", streetName: "", streetNumber: "", propertyType: "Apartment" };
  function update(next: typeof row) {
    sequence.current += 1;
    setSlots(undefined); setError(""); onChange({ ...next, startAt: "" });
  }
  async function findTimes() {
    if (inFlight.current || disabled || !date || !row.staffMembershipId || (travel && !address.city)) return;
    inFlight.current = true;
    const request = ++sequence.current;
    setBusy(true); setError(""); setSlots(undefined);
    // Refetching may discover lost capacity. An old selected time cannot survive a failed read.
    onChange({ ...row, startAt: "" });
    try {
      const result = await catalogApi.getServiceAvailability(businessId, row.serviceId, {
        fromDate: date, toDate: date, staffMembershipId: row.staffMembershipId, partySize: 1,
        ...(travel ? { customerCity: address.city as BusinessCity } : {}),
      });
      if (request === sequence.current) setSlots(result);
    } catch {
      if (request === sequence.current) setError("Available times could not be loaded. Choose Find available times to retry. No appointment was reserved.");
    } finally {
      inFlight.current = false;
      if (request === sequence.current) setBusy(false);
    }
  }
  const offered = slots?.days.flatMap((day) => day.slots).filter((slot) => slot.eligibleStaffMembershipIds.includes(row.staffMembershipId)) ?? [];
  const formatTime = (instant: string) => slots ? `${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: slots.timezone }).format(new Date(instant))} (${slots.timezone})` : "";
  const addressLabels = { area: "Area", streetName: "Street name", streetNumber: "Street number", floorUnit: "Floor / unit", aptRoom: "Apartment / room", additionalDirections: "Additional directions" };
  return <fieldset disabled={disabled || busy} aria-busy={busy} className="min-w-0 space-y-4">
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="block min-w-0 text-sm font-medium">Professional<select className={packageFieldClass} aria-label="Package appointment professional" required value={row.staffMembershipId} onChange={(e) => update({ ...row, staffMembershipId: e.target.value })}>
        <option value="">Select a professional</option>{item.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
      <label className="block min-w-0 text-sm font-medium">Date<input className={packageFieldClass} aria-label="Package appointment date" type="date" required value={date} onChange={(e) => { setDate(e.target.value); update(row); }} /></label>
    </div>
    {!item.providers.length && <p role="status" className="text-sm text-[#5F5E5A]">No eligible professionals are currently offered for this service.</p>}
    {travel && <fieldset className="grid min-w-0 gap-4 rounded-xl bg-[#F5F4EE] p-4 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold">Travel address</legend>
      <label className="block min-w-0 text-sm">City<select className={packageFieldClass} aria-label="Package travel city" required value={address.city} onChange={(e) => update({ ...row, travelAddress: { ...address, city: e.target.value } })}><option value="">Select a permitted city</option>{item.travelCities?.map((city) => <option key={city}>{city}</option>)}</select></label>
      {(["area", "streetName", "streetNumber", "floorUnit", "aptRoom", "additionalDirections"] as const).map((field) => <label className="block min-w-0 text-sm" key={field}>{addressLabels[field]}
        <input className={packageFieldClass} aria-label={`Package travel ${field}`} required={["area", "streetName", "streetNumber"].includes(field)} value={address[field] ?? ""} onChange={(e) => update({ ...row, travelAddress: { ...address, [field]: e.target.value } })} />
      </label>)}
      <label className="block min-w-0 text-sm">Property type<select className={packageFieldClass} value={address.propertyType} onChange={(e) => update({ ...row, travelAddress: { ...address, propertyType: e.target.value } })}>{["Apartment", "Villa", "House", "Hotel", "Office", "Other"].map((property) => <option key={property}>{property}</option>)}</select></label>
    </fieldset>}
    <button className={`${packageSecondaryCta} w-full sm:w-auto`} type="button" disabled={busy || !date || !row.staffMembershipId || (travel && !address.city)} onClick={() => void findTimes()}>Find available times</button>
    {busy && <p role="status" className="text-sm">Loading current availability…</p>}
    {slots && !offered.length && <p role="status" className="rounded-xl bg-[#F5F4EE] p-3 text-sm">No available times for this professional on this date. Choose another date or professional.</p>}
    <label className="block min-w-0 text-sm font-medium">Time<select className={packageFieldClass} aria-label="Package appointment time" required disabled={!offered.length} value={row.startAt} onChange={(e) => onChange({ ...row, startAt: e.target.value })}>
      <option value="">Select a server time</option>{offered.map((slot) => <option key={slot.startAt} value={slot.startAt}>{formatTime(slot.startAt)}{slot.remainingCapacity !== undefined ? ` · ${slot.remainingCapacity} seat${slot.remainingCapacity === 1 ? "" : "s"} available` : ""}</option>)}</select></label>
    {row.startAt && <p aria-live="polite" className="rounded-xl bg-[#E1F5EE] p-3 text-sm text-[#245C4A]">Selected: {item.name} · {item.providers.find((provider) => provider.id === row.staffMembershipId)?.name} · {formatTime(row.startAt)}</p>}
    {item.addons?.length ? <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Optional add-ons</legend>{item.addons.map((addon) => <label className="flex items-start gap-3 text-sm" key={addon.id}><input className="mt-1 h-4 w-4 shrink-0 accent-[#2E9DA7]" type="checkbox" checked={row.addonIds.includes(addon.id)} onChange={(e) => onChange({ ...row, addonIds: e.target.checked ? [...row.addonIds, addon.id] : row.addonIds.filter((id) => id !== addon.id) })} /><span>{addon.name} · {formatBookingMoney(addon.priceCents)} (confirmed by quote)</span></label>)}</fieldset> : null}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </fieldset>;
}
