"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building03Icon, Car01Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import RoleCard from "@/components/select-role/RoleCard";

export default function ProfessionalVisitTypePage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<"location" | "travel">("travel");

  const handleContinue = () => {
    router.push(`/professional/auth?type=${selectedType}`);
  };

  return (
    <AuthLayout onBack={() => router.push("/")} imageSrc="/img/authImg3.png">
      <div className="w-full max-w-[818px] flex flex-col items-center">
        {/* Header info */}
        <div className="w-full text-left mb-8 px-4 md:px-0">
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#1A1A1A] mt-1 mb-2">
            How do customer visit you?
          </h1>
          <p className="text-sm text-[#707070]">
            This helps us set up your booking flow correctly
          </p>
        </div>

        {/* Visit Options */}
        <div className="flex flex-col gap-4 w-full px-4 md:px-0">
          <RoleCard
            title="I welcome customer at my location"
            description="Salon, barber, studio, spa, etc."
            icon={<HugeiconsIcon icon={Building03Icon} size={28} />}
            selected={selectedType === "location"}
            onClick={() => setSelectedType("location")}
          />
          <RoleCard
            title="I travel to my customers"
            description="Mobile groomer, photographer, DJ, home visits, etc."
            icon={<HugeiconsIcon icon={Car01Icon} size={28} />}
            selected={selectedType === "travel"}
            onClick={() => setSelectedType("travel")}
          />
        </div>

        {/* Continue button */}
        <div className="w-full max-w-[818px] mt-8 px-4 md:px-0">
          <button
            onClick={handleContinue}
            className="w-full h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
          >
            Continue
          </button>
        </div>

        {/* Footer trouble support */}
        <div className="text-center mt-8">
          <p className="text-sm text-[#707070]">
            Having trouble?{" "}
            <a
              href="#"
              className="font-semibold text-[#240183] hover:underline"
              onClick={(e) => {
                e.preventDefault();
                router.push("/contact-support");
              }}
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
