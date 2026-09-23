"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { CLIENT_PROPERTY_TYPES, type ClientPropertyType } from "@/lib/api/clients";
import type { BusinessCity } from "@/lib/constants/cities";

export interface TravelAddressFields {
  propertyType: ClientPropertyType | "";
  area: string;
  streetName: string;
  streetNumber: string;
  floorUnit: string;
  aptRoom: string;
  additionalDirections: string;
}

export const emptyTravelAddress: TravelAddressFields = {
  propertyType: "",
  area: "",
  streetName: "",
  streetNumber: "",
  floorUnit: "",
  aptRoom: "",
  additionalDirections: "",
};

interface TravelAddressStepProps {
  /** Canonical served-city list for the selected Service — never a hardcoded taxonomy, matches
   * exactly what the backend's requireServedCity validates against (service.servedCities). */
  servedCities: BusinessCity[];
  customerCity: BusinessCity | undefined;
  setCustomerCity: (city: BusinessCity) => void;
  address: TravelAddressFields;
  setAddress: (patch: Partial<TravelAddressFields>) => void;
}

const inputClass =
  "w-full h-11 px-3 bg-white border border-[#E8E8E4] rounded-lg text-sm font-poppins focus:outline-none focus:border-neutral-800";
const selectClass =
  "w-full h-11 px-3 pr-8 appearance-none bg-white border border-[#E8E8E4] rounded-lg text-sm font-poppins focus:outline-none focus:border-neutral-800 cursor-pointer";
const labelClass = "text-xs font-medium text-[#5F5E5A] font-poppins";

export default function TravelAddressStep({
  servedCities,
  customerCity,
  setCustomerCity,
  address,
  setAddress,
}: TravelAddressStepProps) {
  return (
    <>
      <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C]">Where should we come to?</h1>
      <p className="text-sm text-[#767676] -mt-6">
        This business travels to you. Tell us where to meet you for this appointment.
      </p>

      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>City *</label>
          <div className="relative w-full">
            <select
              value={customerCity ?? ""}
              onChange={(e) => setCustomerCity(e.target.value as BusinessCity)}
              className={selectClass}
            >
              <option value="">Select city</option>
              {servedCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
            />
          </div>
          {servedCities.length === 0 && (
            <span className="text-xs text-red-600">
              This service currently has no served cities configured. Please contact the business.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Property type *</label>
          <div className="relative w-full">
            <select
              value={address.propertyType}
              onChange={(e) => setAddress({ propertyType: e.target.value as ClientPropertyType })}
              className={selectClass}
            >
              <option value="">Select property type</option>
              {CLIENT_PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Area/neighborhood *</label>
          <input
            type="text"
            value={address.area}
            onChange={(e) => setAddress({ area: e.target.value })}
            placeholder="e.g. Mackenzie, Finikoudes"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Street name *</label>
            <input
              type="text"
              value={address.streetName}
              onChange={(e) => setAddress({ streetName: e.target.value })}
              placeholder="e.g. Emrou"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Street number *</label>
            <input
              type="text"
              value={address.streetNumber}
              onChange={(e) => setAddress({ streetNumber: e.target.value })}
              placeholder="e.g. 14"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Floor/unit</label>
            <input
              type="text"
              value={address.floorUnit}
              onChange={(e) => setAddress({ floorUnit: e.target.value })}
              placeholder="e.g. 3rd floor"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Apt/room no.</label>
            <input
              type="text"
              value={address.aptRoom}
              onChange={(e) => setAddress({ aptRoom: e.target.value })}
              placeholder="e.g. 5"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Additional directions</label>
          <textarea
            value={address.additionalDirections}
            onChange={(e) => setAddress({ additionalDirections: e.target.value })}
            placeholder="e.g. Blue gate on the left, ring twice."
            rows={3}
            className="w-full p-3 bg-white border border-[#E8E8E4] rounded-lg text-sm font-poppins focus:outline-none focus:border-neutral-800 resize-none leading-relaxed text-[#111111]"
          />
        </div>
      </div>
    </>
  );
}
