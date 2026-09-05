"use client";

import Image from "next/image";
import React, { useState } from "react";

interface BusinessInfoSectionProps {
  businessName: string;
  setBusinessName: (v: string) => void;
  regNumber: string;
  setRegNumber: (v: string) => void;
  phoneCode: string;
  setPhoneCode: (v: string) => void;
  phoneFlag: string;
  setPhoneFlag: (v: string) => void;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
}

export default function BusinessInfoSection({
  businessName,
  setBusinessName,
  regNumber,
  setRegNumber,
  phoneCode,
  setPhoneCode,
  phoneFlag,
  setPhoneFlag,
  phoneNumber,
  setPhoneNumber,
  description,
  setDescription
}: BusinessInfoSectionProps) {
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  
  const countries = [
    { name: "Cyprus", code: "+357", flag: "cy" },
    { name: "Greece", code: "+30", flag: "gr" },
    { name: "United Kingdom", code: "+44", flag: "gb" },
    { name: "United States", code: "+1", flag: "us" }
  ];

  return (
    <div className="flex flex-col gap-4 w-full">
      <span className="font-poppins font-medium text-xs text-[#111111] tracking-[0.05em] uppercase">
        Business information
      </span>

      <div className="flex flex-col gap-4 w-full">
        {/* Business name */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs font-semibold text-[#1A1A1A]">Business name</label>
          <input
            type="text"
            placeholder="Salon Cyprus"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full h-11 bg-white border border-[#D5D2C9] rounded-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
          />
        </div>

        {/* Registration number */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs font-semibold text-[#1A1A1A]">Business registration number</label>
          <input
            type="text"
            placeholder="e.g. HE 123455"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            className="w-full h-11 bg-white border border-[#D5D2C9] rounded-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
          />
        </div>

        {/* Phone number */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs font-semibold text-[#1A1A1A]">Phone number</label>
          <div className="flex h-11 w-full relative">
            {/* Flag Selector Trigger */}
            <button
              type="button"
              onClick={() => setShowCountryDropdown(!showCountryDropdown)}
              className="box-border flex flex-row items-center justify-center gap-1.5 px-3 w-[96px] h-11 bg-white border border-[#D5D2C9] rounded-l-lg hover:bg-neutral-50 transition-colors select-none text-xs"
            >
              <Image src={`https://flagcdn.com/w40/${phoneFlag}.png`} className="w-[26px] h-[14px] object-cover rounded-sm shrink-0 border border-neutral-100" alt="flag" width={24} height={24} />
              <span className="text-[#1C1C1A]/50 font-medium">{phoneCode}</span>
              <span className="text-[10px] text-neutral-400">▼</span>
            </button>

            {/* Country dropdown */}
            {showCountryDropdown && (
              <div className="absolute top-12 left-0 bg-white border border-neutral-200 rounded-lg shadow-lg z-20 w-[180px] p-1">
                {countries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setPhoneCode(c.code);
                      setPhoneFlag(c.flag);
                      setShowCountryDropdown(false);
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-neutral-50 rounded text-left font-poppins"
                  >
                    <Image src={`https://flagcdn.com/w40/${c.flag}.png`} className="w-[20px] h-[12px] object-cover rounded-sm shrink-0 border border-neutral-100" alt="flag" width={24} height={24} />
                    <span className="font-semibold text-neutral-800">{c.code}</span>
                    <span className="text-neutral-500 text-[10px] ml-auto">{c.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Actual phone input */}
            <input
              type="text"
              placeholder="1111111111"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="flex-1 h-11 bg-white border border-[#D5D2C9] border-l-0 rounded-r-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
            />
          </div>
        </div>

        {/* Brief description */}
        <div className="flex flex-col gap-2 w-full">
          <label className="text-xs font-semibold text-[#1A1A1A]">Brief description</label>
          <textarea
            placeholder="Tell customers what your business offers"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-white border border-[#D5D2C9] rounded-lg px-3 py-2 text-xs font-poppins focus:outline-none focus:border-black resize-none"
          />
        </div>
      </div>
    </div>
  );
}
