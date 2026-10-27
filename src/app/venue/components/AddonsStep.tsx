"use client";

import React from "react";

import type { CatalogAddon } from "@/lib/api/catalog";
import { formatBookingMoney } from "@/lib/bookings/format";

interface AddonsStepProps {
  addons: CatalogAddon[];
  isLoading?: boolean;
  selectedAddonIds: string[];
  setSelectedAddonIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function AddonsStep({
  addons,
  isLoading,
  selectedAddonIds,
  setSelectedAddonIds,
}: AddonsStepProps) {
  const toggle = (id: string) =>
    setSelectedAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <>
      <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C]">Select Add-ons</h1>

      <div className="flex flex-col gap-5 w-full">
        {isLoading ? (
          <p className="text-sm text-[#767676]">Loading add-ons…</p>
        ) : addons.length === 0 ? (
          <p className="text-sm text-[#767676]">No add-ons are available for this service.</p>
        ) : (
          addons.map((addon) => {
            const selected = selectedAddonIds.includes(addon.id);
            return (
              <div
                key={addon.id}
                className={`w-full bg-white border rounded-lg p-6 flex justify-between items-center gap-4 shadow-sm relative transition-all ${selected ? "border-[#2BB54F] shadow-md" : "border-neutral-200"}`}
              >
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <h4 className="font-semibold text-lg text-[#0D0D0D]">{addon.name}</h4>
                  {addon.description ? (
                    <p className="text-sm text-[#767676]">{addon.description}</p>
                  ) : null}
                  <span className="font-semibold text-lg text-[#0D0D0D]">
                    {addon.priceCents !== undefined ? formatBookingMoney(addon.priceCents) : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(addon.id)}
                  aria-label={selected ? `Remove ${addon.name}` : `Add ${addon.name}`}
                  className={`text-sm font-semibold rounded-full border transition-all cursor-pointer shadow-sm shrink-0 ${
                    selected
                      ? "bg-[#2BB54F] border-[#2BB54F] text-white w-8 h-8 min-w-8 min-h-8 flex items-center justify-center p-0 aspect-square"
                      : "bg-white border-[#D3D3D3] text-[#0D0D0D] hover:bg-neutral-50 px-5 py-2"
                  }`}
                >
                  {selected ? (
                    <svg
                      className="w-4 h-4 text-white shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3.5}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    "Add"
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
