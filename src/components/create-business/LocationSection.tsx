"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import BusinessProfileMap, { type ProfileMarkerMediaState } from "./BusinessProfileMap";

interface LocationSectionProps {
  searchLocation: string;
  setSearchLocation: (v: string) => void;
  handleLocationSearch: (e: React.FormEvent) => void;
  /** The persisted business coordinate — undefined only when the business genuinely
   * has no stored location yet (a real edge case, not the normal loaded state). */
  lat?: number;
  lng?: number;
  /** What the circular marker should currently show — loading/ready/empty, derived by
   * DashboardCreateBusiness from useBusinessMediaQuery's own loading state (see
   * BusinessProfileMap's ProfileMarkerMediaState doc). */
  profileMedia: ProfileMarkerMediaState;
  /** Temporary, display-only recenter target from the Search button — never a real
   * location change (see BusinessProfileMap/DashboardCreateBusiness). */
  previewCenter?: { lat: number; lng: number } | null;
  /** For the marker hover popup — the actual business name and its resolved
   * human-readable address, decoupled from whatever the search field currently shows
   * (see `resolvedLocationLabel` in DashboardCreateBusiness). */
  businessName?: string;
  displayAddress?: string;
}

export default function LocationSection({
  searchLocation,
  setSearchLocation,
  handleLocationSearch,
  lat,
  lng,
  profileMedia,
  previewCenter,
  businessName,
  displayAddress,
}: LocationSectionProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <span className="font-poppins font-medium text-xs text-[#111111] tracking-[0.05em] uppercase">
        Location
      </span>

      <div className="flex flex-col gap-4 w-full">
        {/* Map Search input */}
        <form onSubmit={handleLocationSearch} className="flex justify-between items-center gap-4 w-full border border-[#D3D1C7] rounded-lg px-3 h-9 bg-white">
          <HugeiconsIcon icon={Search01Icon} className="w-[18px] h-[18px] text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Search location to update map..."
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            className="flex-grow h-full bg-transparent text-xs font-poppins focus:outline-none"
          />
          <button type="submit" className="text-xs font-semibold hover:text-[#0F6E56]">Search</button>
        </form>

        {/* Read-only Google Map — same footprint the previous Embed iframe used. Only
            shown when the business actually has a persisted coordinate; a business
            with none yet gets a plain placeholder rather than a misleading blank/default
            map. */}
        <div className="relative w-full h-[450px] rounded-xl overflow-hidden border border-neutral-200">
          {lat !== undefined && lng !== undefined ? (
            <BusinessProfileMap
              lat={lat}
              lng={lng}
              profileMedia={profileMedia}
              previewCenter={previewCenter}
              businessName={businessName}
              displayAddress={displayAddress}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#EAE8E4]">
              <p className="text-xs text-neutral-500 px-6 text-center">No location set for this business yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
