"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { CatalogService } from "@/lib/api/catalog";
import type { PackageOffer } from "@/lib/api/package-views";
import { formatBookingMoney } from "@/lib/bookings/format";

export function venueServiceFilters(subcategories: string[], services: CatalogService[]) {
  const categories = [...new Set([
    ...subcategories,
    ...services.map((service) => service.subcategory || service.category),
  ].filter(Boolean))];
  return [
    { id: "All", label: "All" },
    { id: "Featured", label: "Featured" },
    { id: "Packages", label: "Packages" },
    ...categories.map((label) => ({ id: `category:${label}`, label })),
  ];
}

type Offering = { kind: "service"; value: CatalogService } | { kind: "first-class"; value: PackageOffer };

export function venueServiceResults(services: CatalogService[], packages: PackageOffer[], filter: string): Offering[] {
  const category = filter.startsWith("category:") ? filter.slice("category:".length) : undefined;
  const matches = services.filter((service) => filter === "All" ||
    (filter === "Featured" && service.isFeatured) ||
    (filter === "Packages" && service.isPackageDeal) ||
    (category !== undefined && (service.category === category || service.subcategory === category)));
  // Preserve existing Service order; the separate catalogue has no cross-product sort key.
  // It also exposes no authoritative featured/category membership for first-class definitions.
  return [
    ...matches.map((value): Offering => ({ kind: "service", value })),
    ...(filter === "All" || filter === "Packages"
      ? packages.map((value): Offering => ({ kind: "first-class", value })) : []),
  ];
}

export default function VenueServices({ services, subcategories, selectedFilter, onSelectFilter,
  serviceLoading, serviceError, packages, packageLoading, packageError, isCustomer, renderService, onRetryPackages, packageRefreshing = false,
}: {
  services: CatalogService[]; subcategories: string[]; selectedFilter: string;
  onSelectFilter: (filter: string) => void; serviceLoading: boolean; serviceError: boolean;
  packages: PackageOffer[]; packageLoading: boolean; packageError: unknown; isCustomer: boolean;
  renderService: (service: CatalogService) => ReactNode;
  onRetryPackages?: () => void; packageRefreshing?: boolean;
}) {
  const results = venueServiceResults(services, packages, selectedFilter);
  const showPackages = selectedFilter === "All" || selectedFilter === "Packages";
  return <>
    <div className="flex flex-wrap gap-2 mb-2" role="group" aria-label="Service filters">
      {venueServiceFilters(subcategories, services).map((filter) => <button
        key={filter.id} type="button" onClick={() => onSelectFilter(filter.id)}
        aria-pressed={selectedFilter === filter.id}
        className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase border transition-all duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] focus-visible:ring-offset-2 shrink-0 ${selectedFilter === filter.id
          ? "bg-black border-black text-white shadow-sm"
          : "bg-white border-neutral-200 text-[#4E5F78] hover:bg-neutral-100 hover:border-neutral-400 hover:text-[#0D0D0D] hover:shadow-sm motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95 motion-safe:active:translate-y-0"}`}
      >{filter.label}</button>)}
    </div>
    <div className="flex flex-col gap-4" aria-label="Filtered services and packages">
      {serviceLoading && <p role="status" className="text-sm text-neutral-500">Loading services…</p>}
      {serviceError && <p role="alert" className="text-sm text-red-600">Services could not be loaded right now.</p>}
      {showPackages && isCustomer && packageLoading && <p role="status" className="text-sm text-neutral-500">Loading multi-service packages…</p>}
      {showPackages && isCustomer && Boolean(packageError) && <div role="alert" className="space-y-3 text-sm text-neutral-500"><p>Multi-service packages could not be loaded. Services and Package Deals remain available.</p>
        {onRetryPackages && <button type="button" className="min-h-11 rounded-xl border border-[#C6C6CB] px-4 py-2 text-[#240183] disabled:opacity-60" disabled={packageRefreshing} onClick={onRetryPackages}>{packageRefreshing ? "Loading packages…" : "Retry multi-service packages"}</button>}</div>}
      {showPackages && !isCustomer && <p className="text-sm text-neutral-500"><Link href="/customer" className="underline">Sign in as a Customer</Link> to view multi-service packages.</p>}
      {results.map((entry) => <div key={`${entry.kind}:${entry.value.id}`} data-offering-kind={entry.kind} data-offering-id={entry.value.id}>
        {entry.kind === "service" ? renderService(entry.value) : <VenuePackageCard offer={entry.value} />}
      </div>)}
      {!results.length && !serviceLoading && !serviceError && !(showPackages && isCustomer && (packageLoading || packageError)) &&
        <p className="text-sm text-neutral-500">{services.length ? "No offerings match this filter." : "This business has no bookable offerings for this filter yet."}</p>}
      <button type="button" onClick={() => onSelectFilter("All")} className="self-start bg-[#FFFFFF] border border-[#C6C6CB] rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-neutral-50 transition-colors cursor-pointer">See all</button>
    </div>
  </>;
}

/** `action` replaces the details link, e.g. inside the Booking wizard where the card is the selection itself. */
export function VenuePackageCard({ offer, action }: { offer: PackageOffer; action?: ReactNode }) {
  return <article className="min-w-0 w-full bg-white border border-[#E5E5E5] rounded-xl p-5 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 shadow-sm transition-all">
    <div className="flex flex-col gap-1.5 min-w-0 flex-1">
      <h4 className="font-inter font-medium text-lg text-[#0D0D0D] break-words">{offer.name}</h4>
      <span className="text-xs font-semibold text-[#45474B]">Multi-service package</span>
      {offer.description && <p className="text-sm text-[#45474B] mt-1 break-words">{offer.description}</p>}
      <ul className="space-y-1 text-sm text-[#45474B]">{offer.items.map((item) => <li key={item.itemId} className="break-words">
        {item.name} · {item.quantity} {item.quantity === 1 ? "session" : "sessions"} · {item.pricingMode === "PER_PERSON" ? "Group: one credit = one participant / seat" : "Fixed"}
      </li>)}</ul>
      <span className="text-sm text-[#45474B]">{offer.items.reduce((total, item) => total + item.quantity, 0)} total sessions · {offer.validity.mode === "FOREVER" ? "No expiry" : `${offer.validity.months} calendar months from purchase`}</span>
      <span className="text-xs font-semibold text-[#45474B] uppercase tracking-wide mt-1">Package bundle total</span>
      <span className="font-semibold text-lg text-[#0D0D0D]">{formatBookingMoney(offer.bundlePriceCents)}</span>
      {/* Server-reported only: the detail page still requires real appointments, an authoritative quote and consent. */}
      {action === undefined && <p className="text-sm text-[#45474B] mt-1">{offer.checkoutAvailable === true ? "Checkout available — choose initial appointments on the details page." : "Checkout unavailable."}</p>}
    </div>
    {action !== undefined ? action : <Link href={`/customer/package-consent/${offer.businessId}/${offer.id}`} aria-label={`View details of ${offer.name}`}
      className="inline-flex min-h-11 items-center justify-center text-sm font-semibold rounded-full border border-[#B3B3B3] bg-[#FCFAF9] text-[#0D0D0D] px-5 py-2 shadow-sm shrink-0 hover:bg-[#0D0D0D] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] focus-visible:ring-offset-2">View details</Link>}
  </article>;
}
