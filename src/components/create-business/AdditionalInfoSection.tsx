"use client";

import React from "react";

interface AdditionalInfoSectionProps {
  additionalInfo: string[];
  addInfoField: () => void;
  removeInfoField: (idx: number) => void;
  updateInfoField: (idx: number, val: string) => void;
}

export default function AdditionalInfoSection({
  additionalInfo,
  addInfoField,
  removeInfoField,
  updateInfoField
}: AdditionalInfoSectionProps) {
  return (
    <div className="flex flex-col gap-6 w-full">
      <span className="font-poppins font-semibold text-sm text-[#111111] -mb-2">
        Additional Business information (max 3, saved in your private profile)
      </span>

      <div className="flex flex-col gap-4 w-full">
        {additionalInfo.map((info, idx) => (
          <div key={idx} className="flex flex-col gap-1 w-full pb-2">
            <div className="flex justify-between items-center w-full text-xs font-semibold text-[#111111]">
              <span>Info</span>
              <div className="flex items-center gap-3">
                {additionalInfo.length < 3 && idx === additionalInfo.length - 1 && (
                  <button type="button" onClick={addInfoField} className="text-neutral-500 hover:text-black font-semibold text-base leading-none">
                    +
                  </button>
                )}
                {additionalInfo.length > 1 && (
                  <button type="button" onClick={() => removeInfoField(idx)} className="text-neutral-500 hover:text-red-500 font-semibold text-sm leading-none">
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Underlined input field */}
            <div className="flex items-center gap-3 border-b border-black py-1.5 w-full">
              {/* Info Circle Icon */}
              <svg className="w-5 h-5 text-[#757575] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <input
                type="text"
                placeholder="This is text (100 max character)"
                value={info}
                onChange={(e) => updateInfoField(idx, e.target.value)}
                maxLength={100}
                className="w-full bg-transparent text-sm font-poppins text-neutral-800 focus:outline-none placeholder-[#757575]"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
