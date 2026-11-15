"use client";
import React from "react";
import { useServiceAddonsQuery } from "@/lib/catalog/hooks";
import type { CatalogService, CatalogStaffMember } from "@/lib/api/catalog";
import { effectivePricingInput, type VenuePricingInput } from "../pricing-input";

export type ParallelLineSelection = { serviceId: string; staffMembershipId: string; addonIds: string[]; pricingInput: VenuePricingInput };
export function ParallelServiceEditor({ businessId, service, staff, line, usedStaff, onChange, onRemove }: {
  businessId: string; service: CatalogService; staff: CatalogStaffMember[]; line: ParallelLineSelection;
  usedStaff: string[]; onChange: (line: ParallelLineSelection) => void; onRemove: () => void;
}) {
  const addons = useServiceAddonsQuery(businessId, service.id);
  const quantity = effectivePricingInput(service, line.pricingInput);
  const candidates = staff.filter((person) => service.assignedStaffMembershipIds.includes(person.id));
  return <section className="border border-neutral-200 rounded-xl p-4 space-y-3" aria-label={`Service ${service.name}`}>
    <div className="flex justify-between gap-3"><h3 className="font-semibold">{service.name}</h3><button type="button" className="underline" onClick={onRemove} aria-label={`Remove ${service.name}`}>Remove</button></div>
    <label className="block text-sm">Professional for {service.name}<select aria-label={`Professional for ${service.name}`} className="block w-full border rounded-lg p-2" value={line.staffMembershipId} onChange={(event) => onChange({ ...line, staffMembershipId: event.target.value })}>
      <option value="">Choose a professional</option>{candidates.map((person) => <option key={person.id} value={person.id} disabled={usedStaff.includes(person.id) && person.id !== line.staffMembershipId}>{[person.firstName, person.lastName].filter(Boolean).join(" ")}</option>)}
    </select></label>
    {service.hourlyPricing && !service.isPackageDeal && <label className="block text-sm">Hours for {service.name}<input aria-label={`Hours for ${service.name}`} type="number" min={service.hourlyPricing.minHours} max={service.hourlyPricing.maxHours} value={quantity.hours ?? service.hourlyPricing.minHours} onChange={(event) => onChange({ ...line, pricingInput: { hours: Number(event.target.value) } })} className="block border rounded p-2" /></label>}
    {service.perPersonPricing && <label className="block text-sm">Participants for {service.name}<input aria-label={`Participants for ${service.name}`} type="number" min={service.perPersonPricing.minPersons} max={service.perPersonPricing.maxPersons} value={quantity.personCount ?? service.perPersonPricing.minPersons} onChange={(event) => onChange({ ...line, pricingInput: { personCount: Number(event.target.value) } })} className="block border rounded p-2" /></label>}
    <fieldset><legend className="text-sm font-semibold">Add-ons for {service.name}</legend>
      {addons.isLoading && <p role="status">Loading add-ons...</p>}
      {addons.isError && <p role="alert">Could not load add-ons. <button type="button" onClick={() => void addons.refetch()} className="underline">Retry</button></p>}
      {!addons.isLoading && !addons.isError && !addons.data?.addons.length && <p className="text-xs">No add-ons available.</p>}
      {addons.data?.addons.map((addon) => <label key={addon.id} className="block text-sm"><input type="checkbox" checked={line.addonIds.includes(addon.id)} onChange={(event) => onChange({ ...line, addonIds: event.target.checked ? [...line.addonIds, addon.id] : line.addonIds.filter((id) => id !== addon.id) })} /> {addon.name}</label>)}
    </fieldset>
  </section>;
}
