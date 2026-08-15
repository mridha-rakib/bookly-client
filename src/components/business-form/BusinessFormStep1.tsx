"use client";

import React from "react";
import dynamic from "next/dynamic";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { BUSINESS_CITIES } from "@/lib/constants/cities";

// Dynamically import the map to avoid SSR issues with Leaflet
const BusinessMap = dynamic(() => import("./BusinessMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] sm:h-[400px] md:h-[485px] bg-[#FCFAF9] border border-[#E8E8E4] rounded-2xl flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-[#8EBAC5] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-[#4D4D4D]">Loading map engine...</p>
      </div>
    </div>
  ),
});

export interface BusinessFormStep1Errors {
  businessName?: string;
  ownerName?: string;
  mobileNumber?: string;
  area?: string;
  streetName?: string;
  streetNumber?: string;
  briefDesc?: string;
}

export interface BusinessFormStep1Props {
  emailParam: string;
  businessName: string;
  setBusinessName: (val: string) => void;
  ownerName: string;
  setOwnerName: (val: string) => void;
  city: string;
  setCity: (val: string) => void;
  countryCode: string;
  setCountryCode: (val: string) => void;
  mobileNumber: string;
  setMobileNumber: (val: string) => void;
  area: string;
  setArea: (val: string) => void;
  streetName: string;
  setStreetName: (val: string) => void;
  streetNumber: string;
  setStreetNumber: (val: string) => void;
  floorUnit: string;
  setFloorUnit: (val: string) => void;
  aptRoom: string;
  setAptRoom: (val: string) => void;
  briefDesc: string;
  setBriefDesc: (val: string) => void;
  coordinates: { lat: number; lng: number };
  setCoordinates: (coords: { lat: number; lng: number }) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  errors?: BusinessFormStep1Errors;
  onSubmit: (e: React.FormEvent) => void;
}

export default function BusinessFormStep1({
  emailParam,
  businessName,
  setBusinessName,
  ownerName,
  setOwnerName,
  city,
  setCity,
  countryCode,
  setCountryCode,
  mobileNumber,
  setMobileNumber,
  area,
  setArea,
  streetName,
  setStreetName,
  streetNumber,
  setStreetNumber,
  floorUnit,
  setFloorUnit,
  aptRoom,
  setAptRoom,
  briefDesc,
  setBriefDesc,
  coordinates,
  setCoordinates,
  searchQuery,
  setSearchQuery,
  errors = {},
  onSubmit,
}: BusinessFormStep1Props) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <div className="w-full max-w-[973px] flex flex-col items-center gap-[72px]">
      {/* Header */}
      <div className="flex flex-col items-center text-center gap-2">
        <h1 className="text-[28px] font-medium text-[#262626] tracking-tight leading-9">
          Business Form
        </h1>
        <p className="text-sm font-normal text-[#4D4D4D] leading-5 tracking-wide">
          Fill up this information so that you can set up your business
        </p>
      </div>

      {/* Form Fields */}
      <form onSubmit={onSubmit} className="w-full flex flex-col gap-10">

        {/* Business & Owner Names */}
        <div className="flex flex-col md:flex-row gap-4 w-full">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-sm font-normal text-[#111111]">Business Name *</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business Name"
              className="w-full h-[52px] bg-white border border-[#E8E8E4] rounded-lg px-3 py-1.5 text-base text-[#212121] placeholder-[#212121]/50 focus:outline-none focus:border-[#8EBAC5]"
            />
            {errors.businessName && (
              <span className="text-xs text-red-500 pl-1">{errors.businessName}</span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-sm font-normal text-[#111111]">Owner Name *</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Owner Name"
              disabled
              title="Owner name comes from your registration profile and can't be edited here"
              className="w-full h-[52px] bg-[#E0E0E0] border border-[#E8E8E4] rounded-lg px-3 py-1.5 text-base text-[#808080] placeholder-[#808080]/50 cursor-not-allowed focus:outline-none"
            />
            {errors.ownerName && <span className="text-xs text-red-500 pl-1">{errors.ownerName}</span>}
          </div>
        </div>

        {/* Email & City */}
        <div className="flex flex-col md:flex-row gap-4 w-full">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-sm font-normal text-[#111111]">Email *</label>
            <input
              type="email"
              value={emailParam}
              disabled
              className="w-full h-12 bg-[#E0E0E0] rounded-xl px-4 py-3.5 text-sm text-[#808080] font-normal cursor-not-allowed border-none focus:outline-none"
            />
          </div>
          <div className="flex-1 flex flex-col gap-2 relative">
            <label className="text-sm font-normal text-[#111111]">City *</label>
            <div className="relative">
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-[52px] bg-white border border-[#E8E8E4] rounded-lg pl-3 pr-10 text-base text-[#212121] focus:outline-none focus:border-[#8EBAC5] appearance-none cursor-pointer"
              >
                {BUSINESS_CITIES.map((cityOption) => (
                  <option key={cityOption} value={cityOption}>
                    {cityOption}
                  </option>
                ))}
              </select>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                size={24}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#141B34] pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Mobile Number */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-sm font-medium text-[#262626] tracking-tight">Mobile number *</label>
          <div className="flex w-full h-12">
            {/* Selector */}
            <div ref={dropdownRef} className="relative flex items-center bg-[#E0E0E0] rounded-l-xl px-4 py-3.5 border-r border-[#D2D2D2] gap-1.5 min-w-[141px]">
              {(() => {
                const countriesList = [
                  { code: "+357", flag: "https://flagcdn.com/w20/cy.png", name: "Cyprus (+357)" },
                  { code: "+880", flag: "https://flagcdn.com/w20/bd.png", name: "Bangladesh (+880)" },
                  { code: "+1", flag: "https://flagcdn.com/w20/us.png", name: "United States (+1)" },
                  { code: "+44", flag: "https://flagcdn.com/w20/gb.png", name: "United Kingdom (+44)" },
                  { code: "+30", flag: "https://flagcdn.com/w20/gr.png", name: "Greece (+30)" },
                  { code: "+91", flag: "https://flagcdn.com/w20/in.png", name: "India (+91)" },
                  { code: "+61", flag: "https://flagcdn.com/w20/au.png", name: "Australia (+61)" },
                  { code: "+971", flag: "https://flagcdn.com/w20/ae.png", name: "United Arab Emirates (+971)" },
                  { code: "+49", flag: "https://flagcdn.com/w20/de.png", name: "Germany (+49)" },
                  { code: "+33", flag: "https://flagcdn.com/w20/fr.png", name: "France (+33)" },
                ];
                const current = countriesList.find((c) => c.code === countryCode) || countriesList[0];
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsOpen(!isOpen)}
                      disabled
                      title="Mobile number comes from your verified registration phone and can't be edited here"
                      className="flex items-center gap-1.5 cursor-not-allowed focus:outline-none w-full"
                    >
                      <img
                        src={current.flag}
                        alt="Country Flag"
                        className="rounded-sm object-cover w-5 h-3.5 shrink-0"
                        draggable="false"
                      />
                      <span className="text-sm text-[#808080] font-normal">{countryCode}</span>
                      <HugeiconsIcon icon={ArrowDown01Icon} size={20} className="text-[#666666] ml-auto" />
                    </button>

                    {/* Custom Dropdown list with flag images */}
                    {isOpen && (
                      <div className="absolute top-full left-0 mt-2 bg-white border border-[#E8E6FF] rounded-xl shadow-lg z-50 w-[240px] max-h-[220px] overflow-y-auto flex flex-col p-1.5 gap-0.5">
                        {countriesList.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setCountryCode(c.code);
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 text-sm text-[#1A1A1A] hover:bg-[#F5F5F7] rounded-lg transition-colors w-full text-left"
                          >
                            <img
                              src={c.flag}
                              alt={c.name}
                              className="w-5 h-3.5 rounded-sm object-cover shrink-0"
                              draggable="false"
                            />
                            <span className="font-semibold text-xs text-[#1A1A1A] shrink-0 w-[42px]">{c.code}</span>
                            <span className="text-[#707070] text-xs truncate">{c.name.split(" (")[0]}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            {/* Input */}
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="1234556666"
              disabled
              title="Mobile number comes from your verified registration phone and can't be edited here"
              className="flex-1 bg-[#E0E0E0] rounded-r-xl px-4 text-sm text-[#808080] font-normal cursor-not-allowed focus:outline-none"
            />
          </div>
          {errors.mobileNumber && (
            <span className="text-xs text-red-500 pl-1">{errors.mobileNumber}</span>
          )}
        </div>

        {/* Address Sections */}
        <div className="flex flex-col gap-3 w-full">
          <span className="text-xs font-medium text-[#111111] tracking-wider uppercase">ADDRESS</span>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-normal text-[#111111] flex gap-0.5">
              Area/neighborhood <span className="text-xs text-[#E24B4A]">*</span>
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Mackenzie, finikoudes"
              className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 py-2 text-sm text-[#212121] placeholder-[#1C1C1A]/50 focus:outline-none focus:border-[#8EBAC5]"
            />
            {errors.area && <span className="text-xs text-red-500 pl-1">{errors.area}</span>}
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-normal text-[#111111] flex gap-0.5">
                Street name <span className="text-xs text-[#E24B4A]">*</span>
              </label>
              <input
                type="text"
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                placeholder="e.g. Emrou"
                className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 py-2 text-sm text-[#212121] placeholder-[#1C1C1A]/50 focus:outline-none focus:border-[#8EBAC5]"
              />
              {errors.streetName && (
                <span className="text-xs text-red-500 pl-1">{errors.streetName}</span>
              )}
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-normal text-[#111111] flex gap-0.5">
                Street number <span className="text-xs text-[#E24B4A]">*</span>
              </label>
              <input
                type="text"
                value={streetNumber}
                onChange={(e) => setStreetNumber(e.target.value)}
                placeholder="e.g. 14"
                className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 py-2 text-sm text-[#212121] placeholder-[#1C1C1A]/50 focus:outline-none focus:border-[#8EBAC5]"
              />
              {errors.streetNumber && (
                <span className="text-xs text-red-500 pl-1">{errors.streetNumber}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-normal text-[#111111]">Floor /unit</label>
              <input
                type="text"
                value={floorUnit}
                onChange={(e) => setFloorUnit(e.target.value)}
                placeholder="e.g. 3rd floor"
                className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 py-2 text-sm text-[#212121] placeholder-[#1C1C1A]/50 focus:outline-none focus:border-[#8EBAC5]"
              />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-normal text-[#111111]">Apt/room no.</label>
              <input
                type="text"
                value={aptRoom}
                onChange={(e) => setAptRoom(e.target.value)}
                placeholder="e.g. 5"
                className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 py-2 text-sm text-[#212121] placeholder-[#1C1C1A]/50 focus:outline-none focus:border-[#8EBAC5]"
              />
            </div>
          </div>
        </div>

        {/* Map Section */}
        <div className="flex flex-col gap-3 w-full">
          <span className="text-xs font-medium text-[#111111] uppercase tracking-wider">LOCATION</span>

          <BusinessMap
            lat={coordinates.lat}
            lng={coordinates.lng}
            onChange={(lat, lng) => setCoordinates({ lat, lng })}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Brief Description */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs font-normal text-[#111111]">Brief description *</label>
          <input
            type="text"
            value={briefDesc}
            onChange={(e) => setBriefDesc(e.target.value)}
            placeholder="write about your business"
            className="w-full h-[52px] bg-white border border-[#E8E8E4] rounded-lg px-3 py-1.5 text-base text-[#212121] placeholder-[#212121]/50 focus:outline-none focus:border-[#8EBAC5]"
          />
          {errors.briefDesc && <span className="text-xs text-red-500 pl-1">{errors.briefDesc}</span>}
        </div>

        {/* Next Button Row */}
        <div className="flex justify-end mt-4">
          <button
            type="submit"
            className="w-[78.13px] h-[48px] bg-gradient-to-r from-[#8EBAC5] to-[#8EBAC5]/80 hover:scale-105 transition-all duration-150 rounded-xl flex items-center justify-center text-lg font-medium text-[#111111] shadow-md border border-[#8EBAC5]/25 cursor-pointer active:scale-95"
          >
            Next
          </button>
        </div>

      </form>
    </div>
  );
}
