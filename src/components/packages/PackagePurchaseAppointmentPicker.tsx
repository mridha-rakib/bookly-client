"use client";
import { useState } from "react";
import { catalogApi, type AvailabilityResult } from "@/lib/api/catalog";
import type { ConsentIntent, ConsentOffer } from "@/lib/api/package-consent";
import type { BusinessCity } from "@/lib/constants/cities";
import { formatBookingMoney } from "@/lib/bookings/format";

export function PackagePurchaseAppointmentPicker({ businessId, row, item, travel, disabled, onChange }: {
  businessId: string; row: ConsentIntent["selections"][number]; item: ConsentOffer["items"][number];
  travel: boolean; disabled: boolean; onChange: (next: ConsentIntent["selections"][number]) => void;
}) {
  const [date, setDate] = useState(""); const [slots, setSlots] = useState<AvailabilityResult>();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const address: NonNullable<typeof row.travelAddress> = row.travelAddress ?? { city: "", area: "", streetName: "", streetNumber: "", propertyType: "Apartment" };
  function update(next: typeof row) { setSlots(undefined); onChange({ ...next, startAt: "" }); }
  return <fieldset disabled={disabled || busy} className="space-y-3">
    <label>Professional<select aria-label="Package appointment professional" required value={row.staffMembershipId} onChange={(e) => update({ ...row, staffMembershipId: e.target.value })}>
      <option value="">Select a professional</option>{item.providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    {travel && <fieldset><legend>Travel address</legend><label>City<select required value={address.city} onChange={(e) => update({ ...row, travelAddress: { ...address, city: e.target.value } })}><option value="">Select a permitted city</option>{item.travelCities?.map((city) => <option key={city}>{city}</option>)}</select></label>
      {(["area", "streetName", "streetNumber"] as const).map((field) => <label className="block" key={field}>{field}<input required value={address[field]} onChange={(e) => update({ ...row, travelAddress: { ...address, [field]: e.target.value } })} /></label>)}
      {(["floorUnit", "aptRoom", "additionalDirections"] as const).map((field) => <label className="block" key={field}>
        {field === "floorUnit" ? "Floor / unit" : field === "aptRoom" ? "Apartment / room" : "Additional directions"}
        <input aria-label={`Package travel ${field}`} value={address[field] ?? ""}
          onChange={(e) => update({ ...row, travelAddress: { ...address, [field]: e.target.value } })} />
      </label>)}
      <label>Property type<select value={address.propertyType} onChange={(e) => update({ ...row, travelAddress: { ...address, propertyType: e.target.value } })}>{["Apartment", "Villa", "House", "Hotel", "Office", "Other"].map((p) => <option key={p}>{p}</option>)}</select></label>
    </fieldset>}
    <label>Date<input aria-label="Package appointment date" type="date" required value={date} onChange={(e) => { setDate(e.target.value); update(row); }} /></label>
    <button type="button" disabled={!date || !row.staffMembershipId || (travel && !address.city)} onClick={() => {
      setBusy(true); setError(""); void catalogApi.getServiceAvailability(businessId, row.serviceId, {
        fromDate: date, toDate: date, staffMembershipId: row.staffMembershipId, partySize: 1,
        ...(travel ? { customerCity: address.city as BusinessCity } : {}),
      }).then(setSlots).catch(() => setError("Available times could not be loaded. No appointment was reserved.")).finally(() => setBusy(false));
    }}>Find available times</button>
    <label>Time<select aria-label="Package appointment time" required value={row.startAt} onChange={(e) => onChange({ ...row, startAt: e.target.value })}>
      <option value="">Select a server time</option>{slots?.days.flatMap((d) => d.slots).filter((s) => s.eligibleStaffMembershipIds.includes(row.staffMembershipId)).map((s) => <option key={s.startAt} value={s.startAt}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: slots.timezone }).format(new Date(s.startAt))} ({slots.timezone})</option>)}</select></label>
    {item.addons?.map((addon) => <label className="block" key={addon.id}><input type="checkbox" checked={row.addonIds.includes(addon.id)} onChange={(e) => onChange({ ...row, addonIds: e.target.checked ? [...row.addonIds, addon.id] : row.addonIds.filter((id) => id !== addon.id) })} />{addon.name} · {formatBookingMoney(addon.priceCents)} (confirmed by quote)</label>)}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
