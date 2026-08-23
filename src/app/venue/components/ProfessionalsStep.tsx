"use client";

import React from "react";
import Image from "next/image";

import type { CatalogStaffMember } from "@/lib/api/catalog";
import { ANY_STAFF } from "@/lib/api/catalog";

interface ProfessionalsStepProps {
  staff: CatalogStaffMember[];
  isLoading?: boolean;
  selectedProfessional: string | null;
  setSelectedProfessional: (prof: string | null) => void;
}

export default function ProfessionalsStep({
  staff,
  isLoading,
  selectedProfessional,
  setSelectedProfessional,
}: ProfessionalsStepProps) {
  return (
    <>
      <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C]">Select Professional</h1>

      <div className="flex flex-col gap-5 w-full">
        {isLoading ? (
          <p className="text-sm text-[#767676]">Loading professionals…</p>
        ) : (
          <>
            {/* No Preference — resolves to ANY_STAFF; the backend/availability picks an
                eligible staff member from the chosen slot's eligibleStaffMembershipIds. */}
            <div
              onClick={() => setSelectedProfessional(ANY_STAFF)}
              className={`w-full bg-white border rounded-lg p-6 flex justify-between items-center shadow-sm relative transition-all cursor-pointer hover:shadow-md ${selectedProfessional === ANY_STAFF ? "border-[#2BB54F]" : "border-neutral-200"}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200 shrink-0">
                  <span className="text-xl">⭐️</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="font-semibold text-lg text-[#0D0D0D]">No Preference</h4>
                  <span className="text-sm text-neutral-400">Assign automatically to any professional</span>
                </div>
              </div>
              <button
                className={`text-sm font-semibold rounded-full border transition-all cursor-pointer shadow-sm ${
                  selectedProfessional === ANY_STAFF
                    ? "bg-[#2BB54F] border-[#2BB54F] text-white w-8 h-8 flex items-center justify-center p-0"
                    : "bg-white border-[#D3D3D3] text-[#0D0D0D] px-5 py-2"
                }`}
              >
                {selectedProfessional === ANY_STAFF ? "✓" : "Select"}
              </button>
            </div>

            {staff.length === 0 ? (
              <p className="text-sm text-[#767676]">No professionals are assigned to this service yet.</p>
            ) : (
              staff.map((member) => {
                const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
                const selected = selectedProfessional === member.id;
                return (
                  <div
                    key={member.id}
                    onClick={() => setSelectedProfessional(member.id)}
                    className={`w-full bg-white border rounded-lg p-6 flex justify-between items-center shadow-sm relative transition-all cursor-pointer hover:shadow-md ${selected ? "border-[#2BB54F]" : "border-neutral-200"}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden relative border border-neutral-100 shrink-0 bg-neutral-100">
                        <Image src="/image/profile.jpg" alt={name} fill className="object-cover" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h4 className="font-semibold text-lg text-[#0D0D0D]">{name}</h4>
                        <span className="text-sm text-neutral-400">Professional</span>
                      </div>
                    </div>
                    <button
                      className={`text-sm font-semibold rounded-full border transition-all cursor-pointer shadow-sm ${
                        selected
                          ? "bg-[#2BB54F] border-[#2BB54F] text-white w-8 h-8 flex items-center justify-center p-0"
                          : "bg-white border-[#D3D3D3] text-[#0D0D0D] px-5 py-2"
                      }`}
                    >
                      {selected ? "✓" : "Select"}
                    </button>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </>
  );
}
