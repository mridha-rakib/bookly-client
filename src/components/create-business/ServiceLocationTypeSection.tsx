"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building03Icon, Car01Icon } from "@hugeicons/core-free-icons";
import type { VisitType } from "@/lib/api/auth";

interface ServiceLocationTypeSectionProps {
  visitType: VisitType | undefined;
}

// Read-only display of the visit type chosen during onboarding (/professional/visit-type).
// Changing it isn't part of this flow — see DashboardCreateBusiness for where it's rendered.
export default function ServiceLocationTypeSection({ visitType }: ServiceLocationTypeSectionProps) {
  const display =
    visitType === "AT_BUSINESS_LOCATION"
      ? { icon: Building03Icon, label: "Customers visit my location" }
      : visitType === "TRAVEL_TO_CUSTOMER"
        ? { icon: Car01Icon, label: "I travel to customers" }
        : null;

  return (
    <div className="flex flex-col gap-4 w-full">
      <span className="font-poppins font-medium text-xs text-[#111111] tracking-[0.05em] uppercase">
        Service location type
      </span>

      <div className="flex items-center gap-3 h-11 w-full bg-white border border-[#D5D2C9] rounded-lg px-3">
        {display ? (
          <>
            <HugeiconsIcon icon={display.icon} size={18} className="text-[#5F5E5A] shrink-0" />
            <span className="text-xs font-poppins text-[#1A1A1A]">{display.label}</span>
          </>
        ) : (
          <span className="text-xs font-poppins text-neutral-500">Not set</span>
        )}
      </div>
    </div>
  );
}
