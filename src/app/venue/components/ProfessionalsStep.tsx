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
  /** False when the Booking contract requires one concrete professional. */
  allowNoPreference?: boolean;
  context?: React.ReactNode;
}

const cardClass = (selected: boolean) =>
  `w-full bg-white border rounded-lg p-4 sm:p-6 flex justify-between items-center gap-4 shadow-sm relative transition-all cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7] focus-visible:ring-offset-2 ${selected ? "border-[#2BB54F] ring-1 ring-[#2BB54F]" : "border-neutral-200"}`;

/** The selection indicator is presentational; the whole card is the control. */
function SelectionMark({ selected }: { selected: boolean }) {
  return <span aria-hidden="true" className={`text-sm font-semibold rounded-full border transition-all shadow-sm shrink-0 ${
    selected ? "bg-[#2BB54F] border-[#2BB54F] text-white w-8 h-8 flex items-center justify-center p-0" : "bg-white border-[#D3D3D3] text-[#0D0D0D] px-5 py-2"
  }`}>{selected ? "✓" : "Select"}</span>;
}

function ProfessionalCard({ selected, onSelect, label, children }: { selected: boolean; onSelect: () => void; label: string; children: React.ReactNode }) {
  return <div role="button" tabIndex={0} aria-pressed={selected} aria-label={selected ? `${label}, selected` : `Select ${label}`}
    onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }}
    className={cardClass(selected)}>
    {children}
    <SelectionMark selected={selected} />
  </div>;
}

export default function ProfessionalsStep({
  staff,
  isLoading,
  selectedProfessional,
  setSelectedProfessional,
  allowNoPreference = true,
  context,
}: ProfessionalsStepProps) {
  return (
    <>
      <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C]">Select Professional</h1>
      {context}

      <div className="flex flex-col gap-4 w-full">
        {isLoading ? (
          <p role="status" className="text-sm text-[#45474B]">Loading professionals…</p>
        ) : (
          <>
            {/* No Preference — resolves to ANY_STAFF; the backend/availability picks an
                eligible staff member from the chosen slot's eligibleStaffMembershipIds. */}
            {allowNoPreference && <ProfessionalCard selected={selectedProfessional === ANY_STAFF} onSelect={() => setSelectedProfessional(ANY_STAFF)} label="No Preference">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200 shrink-0">
                  <span className="text-xl" aria-hidden="true">⭐️</span>
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <h4 className="font-semibold text-lg text-[#0D0D0D]">No Preference</h4>
                  <span className="text-sm text-[#5F5E5A]">Assign automatically to any professional</span>
                </div>
              </div>
            </ProfessionalCard>}

            {staff.length === 0 ? (
              <p role="status" className="rounded-lg bg-[#F5F4EE] p-4 text-sm text-[#45474B]">
                {allowNoPreference ? "No professionals are assigned to this service yet." : "No eligible professionals are currently offered for this service. Please contact the business or choose another service."}
              </p>
            ) : (
              staff.map((member) => {
                const name = [member.firstName, member.lastName].filter(Boolean).join(" ");
                const selected = selectedProfessional === member.id;
                return (
                  <ProfessionalCard key={member.id} selected={selected} onSelect={() => setSelectedProfessional(member.id)} label={name}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 rounded-full overflow-hidden relative border border-neutral-100 shrink-0 bg-neutral-100">
                        <Image src={member.avatarUrl || "/image/profile.jpg"} alt="" fill className="object-cover" />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <h4 className="font-semibold text-lg text-[#0D0D0D] break-words">{name}</h4>
                        <span className="text-sm text-[#5F5E5A]">{selected ? "Selected professional" : "Professional"}</span>
                      </div>
                    </div>
                  </ProfessionalCard>
                );
              })
            )}
          </>
        )}
      </div>
    </>
  );
}
