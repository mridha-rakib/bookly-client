"use client";

import React, { useId } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { CLIENT_PROPERTY_TYPES, type ClientPropertyType } from "@/lib/api/clients";
import type { BusinessCity } from "@/lib/constants/cities";
import { BookingVisitBadge } from "@/components/bookings/BookingBadges";

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
  context?: React.ReactNode;
}

const inputClass =
  "w-full h-12 px-3 bg-white border border-[#C6C6CB] rounded-lg text-base sm:text-sm text-[#1C1B1C] placeholder:text-[#767676] font-poppins focus:outline-none focus:border-neutral-800 focus-visible:ring-2 focus-visible:ring-[#2E9DA7]";
const selectClass =
  "w-full h-12 px-3 pr-8 appearance-none bg-white border border-[#C6C6CB] rounded-lg text-base sm:text-sm text-[#1C1B1C] font-poppins focus:outline-none focus:border-neutral-800 focus-visible:ring-2 focus-visible:ring-[#2E9DA7] cursor-pointer";
const labelClass = "text-sm font-medium text-[#1C1B1C] font-poppins";

export default function TravelAddressStep({
  servedCities,
  customerCity,
  setCustomerCity,
  address,
  setAddress,
  context,
}: TravelAddressStepProps) {
  const id = useId();
  return (
    <>
      <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C]">Where should we come to?</h1>
      <div className="-mt-3 flex flex-col gap-2">
        <BookingVisitBadge mode="TRAVEL_TO_CUSTOMER" />
        <p className="text-sm text-[#45474B]">
          This business travels to you. Tell us where to meet you for this appointment.
        </p>
        <p className="text-sm text-[#45474B]">Fields marked <span aria-hidden="true">*</span><span className="sr-only">with an asterisk</span> are required.</p>
      </div>
      {context}

      <div className="flex flex-col gap-4 w-full">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-city`} className={labelClass}>City <span aria-hidden="true" className="text-red-700">*</span></label>
          <div className="relative w-full">
            <select
              id={`${id}-city`}
              aria-required="true"
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
            <span className="text-sm text-red-700">
              This service currently has no served cities configured. Please contact the business.
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-property`} className={labelClass}>Property type <span aria-hidden="true" className="text-red-700">*</span></label>
          <div className="relative w-full">
            <select
              id={`${id}-property`}
              aria-required="true"
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
          <label htmlFor={`${id}-area`} className={labelClass}>Area/neighborhood <span aria-hidden="true" className="text-red-700">*</span></label>
          <input
              id={`${id}-area`}
              aria-required="true"
            type="text"
            value={address.area}
            onChange={(e) => setAddress({ area: e.target.value })}
            placeholder="e.g. Mackenzie, Finikoudes"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-street`} className={labelClass}>Street name <span aria-hidden="true" className="text-red-700">*</span></label>
            <input
              id={`${id}-street`}
              aria-required="true"
              type="text"
              value={address.streetName}
              onChange={(e) => setAddress({ streetName: e.target.value })}
              placeholder="e.g. Emrou"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-number`} className={labelClass}>Street number <span aria-hidden="true" className="text-red-700">*</span></label>
            <input
              id={`${id}-number`}
              aria-required="true"
              type="text"
              value={address.streetNumber}
              onChange={(e) => setAddress({ streetNumber: e.target.value })}
              placeholder="e.g. 14"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-floor`} className={labelClass}>Floor/unit <span className="font-normal text-[#5F5E5A]">(optional)</span></label>
            <input
              id={`${id}-floor`}
              type="text"
              value={address.floorUnit}
              onChange={(e) => setAddress({ floorUnit: e.target.value })}
              placeholder="e.g. 3rd floor"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-apt`} className={labelClass}>Apt/room no. <span className="font-normal text-[#5F5E5A]">(optional)</span></label>
            <input
              id={`${id}-apt`}
              type="text"
              value={address.aptRoom}
              onChange={(e) => setAddress({ aptRoom: e.target.value })}
              placeholder="e.g. 5"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-directions`} className={labelClass}>Additional directions <span className="font-normal text-[#5F5E5A]">(optional)</span></label>
          <textarea
              id={`${id}-directions`}
            value={address.additionalDirections}
            onChange={(e) => setAddress({ additionalDirections: e.target.value })}
            placeholder="e.g. Blue gate on the left, ring twice."
            rows={3}
            className="w-full p-3 bg-white border border-[#C6C6CB] rounded-lg text-base sm:text-sm font-poppins placeholder:text-[#767676] focus:outline-none focus:border-neutral-800 focus-visible:ring-2 focus-visible:ring-[#2E9DA7] resize-none leading-relaxed text-[#111111]"
          />
        </div>
      </div>
    </>
  );
}
