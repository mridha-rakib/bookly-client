"use client";

import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import React, { useState, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  User02Icon,
  Notification01Icon,
  SecurityCheckIcon,
  Camera01Icon
} from "@hugeicons/core-free-icons";

import { SettingsInput } from "../settings/SettingsInput";
import { SettingsSubSidebar } from "../settings/SettingsSubSidebar";
import { Security2FAPanel } from "../settings/Security2FAPanel";
import { useCurrentUserQuery } from "@/lib/auth/hooks";

export default function StaffSettings() {
  const [activeSubTab, setActiveSubTab] = useState<string>("Personal info");

  // Personal Info — read-only, real (Batch 19): sourced from /auth/me. No PATCH /auth/me
  // equivalent exists for STAFF (only CUSTOMER has one — see Batch 17/18), so editing stays
  // honestly non-functional below instead of silently discarding changes to localStorage.
  const meQuery = useCurrentUserQuery();
  const personalName = meQuery.data?.profile?.fullName ?? "";
  const personalEmail = meQuery.data?.user.email ?? "";
  const personalRole = "Staff";
  const personalPhone = meQuery.data?.profile?.phone
    ? `${meQuery.data.profile.phone.countryCode} ${meQuery.data.profile.phone.nationalNumber}`
    : "";

  // Avatar is a browser-only preview — no backend avatar-upload capability exists yet for any
  // Business role.
  const [profileImage, setProfileImage] = useState<string>(
    () =>
      (typeof window !== "undefined" && localStorage.getItem("settingsProfileImage")) ||
      "/businessDashboard/downLogo.png",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setProfileImage(base64String);
        localStorage.setItem("settingsProfileImage", base64String);
        window.dispatchEvent(new Event("settingsProfileUpdate"));
      };
      reader.readAsDataURL(file);
    }
  };

  // Subtabs list
  const subTabs = [
    { name: "Personal info", icon: User02Icon },
    { name: "Notifications", icon: Notification01Icon },
    { name: "Security & Login", icon: SecurityCheckIcon }
  ];

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] select-none font-poppins">
      
      <DashboardHeader 
        title="Settings" 
        subtitle="Manage settings of your staff profile" 
      />

      <div className="flex-1 flex overflow-hidden w-full">
        <SettingsSubSidebar
          tabs={subTabs}
          activeSubTab={activeSubTab}
          setActiveSubTab={setActiveSubTab}
        />

        {/* Settings Right panel content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-8 bg-white border-l border-neutral-100 pb-20">
          
          {/* PERSONAL INFO TAB */}
          {activeSubTab === "Personal info" && (
            <div className="flex flex-col gap-6 w-full max-w-[640px]">
              <div className="flex flex-col gap-1">
                <h2 className="font-poppins font-medium text-base text-[#1A1A1A]">Personal info</h2>
                <p className="font-poppins font-normal text-xs text-[#888780] mt-0.5">Set your personal information</p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 flex flex-col gap-5">
                
                {/* Photo Upload Area */}
                <div>
                  <span className="font-poppins font-semibold text-[10px] tracking-[0.8px] uppercase text-[#6B7280]">
                    PHOTO
                  </span>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="relative w-20 h-20 rounded-full border border-neutral-200 overflow-hidden bg-neutral-100">
                      <Image src={profileImage} alt="Profile" className="w-full h-full object-cover" fill />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-1 right-1 w-6 h-6 bg-white border border-neutral-300 rounded-full flex items-center justify-center hover:bg-neutral-50 shadow-sm cursor-pointer"
                      >
                        <HugeiconsIcon icon={Camera01Icon} className="w-3.5 h-3.5 text-[#111111]" />
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Name */}
                <SettingsInput label="Name" value={personalName} onChange={() => {}} disabled={true} />

                {/* Email and Role Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingsInput
                    label="Email"
                    type="email"
                    value={personalEmail}
                    onChange={() => {}}
                    disabled={true}
                  />

                  <div className="flex flex-col gap-1">
                    <span className="font-poppins font-semibold text-[10px] tracking-[0.8px] uppercase text-[#6B7280]">
                      ROLE
                    </span>
                    <div className="h-10 border border-[#D3D1C7] bg-neutral-50 rounded-[8px] px-3.5 text-[14px] text-neutral-500 font-poppins flex items-center select-none">
                      {personalRole}
                    </div>
                  </div>
                </div>

                {/* Mobile number */}
                <SettingsInput
                  label="Mobile number"
                  value={personalPhone || "Not set"}
                  onChange={() => {}}
                  disabled={true}
                />

                <p className="font-poppins text-xs text-[#888780]">
                  Editing personal info isn&apos;t available yet.
                </p>

              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB: Read Only and Enabled by Default */}
          {activeSubTab === "Notifications" && (
            <div className="flex flex-col gap-[20px] w-full">
              <div className="flex flex-col gap-1">
                <h2 className="font-poppins font-medium text-base text-[#111111]">Notifications</h2>
                <p className="font-poppins font-normal text-xs text-[#666666]">Control your notification</p>
              </div>

              {/* Notification triggers section */}
              <div className="bg-white border border-[#E8E8E6] rounded-[12px] p-0.5 shadow-none flex flex-col opacity-90">
                {/* Header title */}
                <div className="p-5 border-b border-[#F0F0EE]">
                  <h3 className="font-poppins font-medium text-sm text-[#111111]">Notification triggers</h3>
                  <p className="font-poppins font-normal text-xs text-neutral-400 mt-0.5">Choose which events send messages</p>
                </div>

                {/* List items */}
                <div className="p-5 flex flex-col gap-5">
                  
                  {/* Row 1: New booking */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-[#111111] opacity-60">New booking</span>
                      <span className="text-xs text-neutral-400">When a client makes a new booking</span>
                    </div>
                    <button
                      disabled={true}
                      className="w-[38px] h-[21px] rounded-full transition-colors flex items-center p-0.5 cursor-not-allowed bg-neutral-300 opacity-60"
                    >
                      <div className="w-4 h-4 bg-white rounded-full transition-transform shadow-sm translate-x-[15px]" />
                    </button>
                  </div>

                  <div className="border-t border-[#666666]/20" />

                  {/* Row 2: Booking cancelled */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-[#111111] opacity-60">Booking cancelled</span>
                      <span className="text-xs text-neutral-400">When a booking is cancelled by client or staff</span>
                    </div>
                    <button
                      disabled={true}
                      className="w-[38px] h-[21px] rounded-full transition-colors flex items-center p-0.5 cursor-not-allowed bg-neutral-300 opacity-60"
                    >
                      <div className="w-4 h-4 bg-white rounded-full transition-transform shadow-sm translate-x-[15px]" />
                    </button>
                  </div>

                  <div className="border-t border-[#666666]/20" />

                  {/* Row 3: Reminder - 24h before */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-[#111111] opacity-60">Reminder - 24h before</span>
                      <span className="text-xs text-neutral-400">Sent to client the day before their appointment</span>
                    </div>
                    <button
                      disabled={true}
                      className="w-[38px] h-[21px] rounded-full transition-colors flex items-center p-0.5 cursor-not-allowed bg-neutral-300 opacity-60"
                    >
                      <div className="w-4 h-4 bg-white rounded-full transition-transform shadow-sm translate-x-[15px]" />
                    </button>
                  </div>

                  <div className="border-t border-[#666666]/20" />

                  {/* Row 4: Reminder - 1h before */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-[#111111] opacity-60">Reminder - 1h before</span>
                      <span className="text-xs text-neutral-400">Last minute reminder to reduce no-shows</span>
                    </div>
                    <button
                      disabled={true}
                      className="w-[38px] h-[21px] rounded-full transition-colors flex items-center p-0.5 cursor-not-allowed bg-neutral-300 opacity-60"
                    >
                      <div className="w-4 h-4 bg-white rounded-full transition-transform shadow-sm translate-x-[15px]" />
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* SECURITY & LOGIN TAB */}
          {activeSubTab === "Security & Login" && (
            <Security2FAPanel />
          )}

        </div>
      </div>
    </main>
  );
}
