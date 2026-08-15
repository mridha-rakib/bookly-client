"use client";

import React from "react";
import { BUSINESS_CITIES } from "@/lib/constants/cities";

interface AddressSectionProps {
  city: string;
  setCity: (v: string) => void;
  streetName: string;
  setStreetName: (v: string) => void;
  streetNumber: string;
  setStreetNumber: (v: string) => void;
  neighborhood: string;
  setNeighborhood: (v: string) => void;
  floorUnit: string;
  setFloorUnit: (v: string) => void;
  roomNo: string;
  setRoomNo: (v: string) => void;
}

export default function AddressSection({
  city,
  setCity,
  streetName,
  setStreetName,
  streetNumber,
  setStreetNumber,
  neighborhood,
  setNeighborhood,
  floorUnit,
  setFloorUnit,
  roomNo,
  setRoomNo
}: AddressSectionProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      <span className="font-poppins font-medium text-xs text-[#111111] tracking-[0.05em] uppercase">
        Address
      </span>

      <div className="flex flex-col gap-4 w-full">
        {/* City dropdown */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs font-semibold text-[#1A1A1A]">City</label>
          <div className="relative h-11 w-full">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full h-full appearance-none bg-white border border-[#D5D2C9] rounded-lg px-3 pr-10 text-xs font-poppins focus:outline-none focus:border-black cursor-pointer"
            >
              {BUSINESS_CITIES.map((cityOption) => (
                <option key={cityOption} value={cityOption}>
                  {cityOption}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-3.5 pointer-events-none text-neutral-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Stacked Address Fields */}
        <div className="flex flex-col gap-4 w-full">
          {/* Street name & Street number */}
          <div className="flex flex-col md:flex-row gap-4 w-full justify-between">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#5F5E5A]">
                Street name <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Emrou"
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                className="w-full h-11 bg-white border border-[#D5D2C9] rounded-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#5F5E5A]">
                Street number <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 14"
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
                className="w-full h-11 bg-white border border-[#D5D2C9] rounded-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
              />
            </div>
          </div>

          {/* Area / neighborhood */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-xs font-semibold text-[#5F5E5A]">
              Area/neighborhood <span className="text-[#E24B4A]">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Mackenzie, finikoudes"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full h-11 bg-white border border-[#D5D2C9] rounded-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
            />
          </div>

          {/* Floor/unit & Room No */}
          <div className="flex flex-col md:flex-row gap-4 w-full justify-between">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#5F5E5A]">Floor /unit</label>
              <input
                type="text"
                placeholder="e.g. 3rd floor"
                value={floorUnit}
                onChange={(e) => setFloorUnit(e.target.value)}
                className="w-full h-11 bg-white border border-[#D5D2C9] rounded-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#5F5E5A]">Apt/room no.</label>
              <input
                type="text"
                placeholder="e.g. 5"
                value={roomNo}
                onChange={(e) => setRoomNo(e.target.value)}
                className="w-full h-11 bg-white border border-[#D5D2C9] rounded-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
