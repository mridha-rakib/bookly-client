"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { User02Icon, Building03Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import RoleCard from "@/components/select-role/RoleCard";

export default function SelectRolePage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"customer" | "professional" | null>("customer");

  const handleContinue = () => {
    if (selectedRole === "customer") {
      router.push("/customer");
    } else if (selectedRole === "professional") {
      router.push("/professional");
    }
  };

  return (
    <AuthLayout onBack={() => router.push("/")} imageSrc={selectedRole === "customer" ? "/img/authImg.png" : "/img/authImg2.png"}>
      <div className="w-full max-w-[818px] flex flex-col items-center">
        {/* Header info */}
        <div className="w-full text-left mb-8 px-4 md:px-0">
          <p className="text-sm font-semibold text-[#707070] mb-2 uppercase tracking-wide">
            Sign up / Log in
          </p>
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#1A1A1A] mt-1 mb-2">
            Who are you signing up as?
          </h1>
          <p className="text-sm text-[#707070]">
            Choose the option that best describes you
          </p>
        </div>

        {/* Role Options */}
        <div className="flex flex-col gap-4 w-full px-4 md:px-0">
          <RoleCard
            title="Bookly for customers"
            description="Book salons and saps near you"
            icon={<HugeiconsIcon icon={User02Icon} size={28} />}
            selected={selectedRole === "customer"}
            onClick={() => setSelectedRole("customer")}
          />
          <RoleCard
            title="Bookly for professionals"
            description="Manage and grow your business"
            icon={<HugeiconsIcon icon={Building03Icon} size={28} />}
            selected={selectedRole === "professional"}
            onClick={() => setSelectedRole("professional")}
          />
        </div>

        {/* Continue button */}
        <div className="w-full max-w-[818px] mt-8 px-4 md:px-0">
          <button
            onClick={handleContinue}
            disabled={!selectedRole}
            className="w-full h-12 bg-[#1A1A1A] hover:bg-black disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
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
