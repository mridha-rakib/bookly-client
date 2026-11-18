"use client";

import type { CatalogBusiness } from "@/lib/api/catalog";
import { buildVenueDirectionsUrl } from "@/lib/venue/directions";

const LINK_CLASS = "font-inter font-normal text-[15.8px] text-[#2366C5] hover:underline whitespace-nowrap shrink-0";

/** "Get Directions" for the Venue summary cards: opens Google Maps directions to the Business's
 * own saved location in a new tab. Without a usable saved location it is not a link. */
export default function VenueDirectionsLink({ business }: { business: CatalogBusiness | undefined }) {
  const url = buildVenueDirectionsUrl(business);
  if (!url)
    return (
      <span className="font-inter font-normal text-[15.8px] text-[#767676] whitespace-nowrap shrink-0" aria-disabled="true">
        Directions unavailable
      </span>
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Get directions to ${business?.name?.trim() || "this business"} (opens Google Maps)`}
      className={LINK_CLASS}
    >
      Get Directions
    </a>
  );
}
