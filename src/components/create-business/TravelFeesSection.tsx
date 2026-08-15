"use client";

import React from "react";

export interface TravelFeeRow {
  name: string;
  active: boolean;
  fee: string;
}

interface TravelFeesSectionProps {
  cityFees: TravelFeeRow[];
  toggleCityActive: (idx: number) => void;
  updateCityFee: (idx: number, val: string) => void;
}

export default function TravelFeesSection({
  cityFees,
  toggleCityActive,
  updateCityFee
}: TravelFeesSectionProps) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-wide">
        Travel fees
      </span>
      <p className="text-[11px] text-neutral-500 -mt-1 leading-relaxed">
        Set your travel fee per city. This fee is added automatically to every booking total and shown clearly to the customer at checkout. You keep 100% of the travel fee. Enable the cities you serve and set your travel fee for each. Set €0.00 for free travel to that city.
      </p>

      <div className="flex flex-col gap-6 w-full">
        {/* Table Header */}
        <div className="flex flex-row justify-between items-center text-xs font-semibold text-[#1C1B1C] border-b border-neutral-100 pb-3">
          <span className="w-1/3">City</span>
          <span className="w-1/3 text-center">Active</span>
          <span className="w-1/3 text-right">Travel Fee</span>
        </div>

        {/* Cities rows */}
        <div className="flex flex-col gap-4">
          {cityFees.map((city, idx) => (
            <div key={city.name} className="flex flex-row justify-between items-center text-sm">
              {/* City Name */}
              <span className="w-1/3 font-medium text-[#111111]">{city.name}</span>

              {/* Active Toggle */}
              <div className="w-1/3 flex justify-center">
                <button
                  type="button"
                  onClick={() => toggleCityActive(idx)}
                  className={`w-[38px] h-[21px] rounded-full p-[2.5px] transition-colors duration-200 focus:outline-none flex items-center ${
                    city.active ? "bg-[#26C08F]" : "bg-neutral-300"
                  }`}
                >
                  <div
                    className={`w-[16px] h-[16px] bg-white rounded-full transition-transform duration-200 ${
                      city.active ? "translate-x-[17px]" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Travel Fee Input */}
              <div className="w-1/3 flex justify-end">
                <div className="flex items-center gap-1 border-b border-black w-[55px] pb-1">
                  <span className="text-[#757575] text-xs font-semibold select-none">€</span>
                  <input
                    type="text"
                    value={city.fee}
                    onChange={(e) => updateCityFee(idx, e.target.value)}
                    className="w-full bg-transparent text-right text-sm font-poppins focus:outline-none text-[#757575]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Note */}
        <p className="text-[11px] text-neutral-600 mt-2 italic leading-relaxed border-t border-neutral-100 pt-4">
          * These fees apply to all your services. The customer sees the travel fee as a separate line item at checkout before confirming the booking.
        </p>
      </div>
    </div>
  );
}
