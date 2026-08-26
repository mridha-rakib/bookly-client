"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";


import React, { useState, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  User02Icon,
  UserGroup03Icon,
  Appointment02Icon,
  CreditCardPosIcon,
  Notification01Icon,
  SecurityCheckIcon,
  Camera01Icon,
  InformationCircleIcon,
  Tick01Icon
} from "@hugeicons/core-free-icons";

import { SettingsInput } from "../settings/SettingsInput";
import { SettingsSubSidebar } from "../settings/SettingsSubSidebar";
import { Security2FAPanel } from "../settings/Security2FAPanel";
import { useCurrentUserQuery } from "@/lib/auth/hooks";
import { useMyBusinessProfileQuery } from "@/lib/business/hooks";
import { useStaffListQuery } from "@/lib/staff/hooks";
import {
  cancellationTiers,
  type CancellationFeeMode,
} from "@/lib/api/business-cancellation-policy";
import {
  useCancellationPolicyQuery,
  useUpdateCancellationPolicyMutation,
} from "@/lib/business/cancellation-policy-hooks";

// Batch 19 — fixed five-window labels matching cancellationTiers' order exactly (see
// api/.../business-cancellation-policy.model.ts's own comment on why this UI never lets an
// owner omit/reorder/duplicate a window).
const CANCELLATION_TIER_LABELS: Record<(typeof cancellationTiers)[number], string> = {
  MORE_THAN_72_HOURS: "More than 72 hours",
  BETWEEN_24_AND_72_HOURS: "24 - 72 hours",
  BETWEEN_12_AND_24_HOURS: "12 - 24 hours",
  BETWEEN_2_AND_12_HOURS: "2 - 12 hours",
  UNDER_2_HOURS: "Under 2 hours",
};

type CancellationRuleFormState = { mode: CancellationFeeMode; percentage: number };

export default function DashboardSettings() {
  const [activeSubTab, setActiveSubTab] = useState<string>("Personal info");

  const meQuery = useCurrentUserQuery();
  const businessProfileQuery = useMyBusinessProfileQuery();
  const businessId = businessProfileQuery.data?.primary?.id;

  // Personal Info — read-only, real (Batch 19): sourced from /auth/me. There is no PATCH /auth/me
  // equivalent for BUSINESS_OWNER (only CUSTOMER has one, see Batch 17/18), so editing stays
  // honestly non-functional below rather than silently discarding changes.
  const personalName = meQuery.data?.profile?.fullName ?? "";
  const personalEmail = meQuery.data?.user.email ?? "";
  const personalRole = "Owner";
  const personalPhone = meQuery.data?.profile?.phone
    ? `${meQuery.data.profile.phone.countryCode} ${meQuery.data.profile.phone.nationalNumber}`
    : "";

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

  // Role tab — real Staff list (Batch 19), same query the real Staff page uses. Role editing
  // stays on that page (single mutation path — see staff.route.ts); this tab is read-only.
  const staffListQuery = useStaffListQuery(businessId);
  const staffMembers = staffListQuery.data?.members ?? [];

  // Cancellation & No-show — real (Batch 19), see business-cancellation-policy-hooks.ts.
  const cancellationPolicyQuery = useCancellationPolicyQuery(businessId);
  const updateCancellationPolicyMutation = useUpdateCancellationPolicyMutation(businessId);
  const [cancellationForm, setCancellationForm] = useState<
    Record<(typeof cancellationTiers)[number], CancellationRuleFormState>
  >(() =>
    Object.fromEntries(
      cancellationTiers.map((tier) => [tier, { mode: "FREE" as CancellationFeeMode, percentage: 20 }]),
    ) as Record<(typeof cancellationTiers)[number], CancellationRuleFormState>,
  );
  const [noShowPercent, setNoShowPercent] = useState(20);
  const [cancellationFormError, setCancellationFormError] = useState("");
  const [cancellationFormInitialized, setCancellationFormInitialized] = useState(false);

  if (cancellationPolicyQuery.data && !cancellationFormInitialized) {
    setCancellationFormInitialized(true);
    const byTier = new Map(cancellationPolicyQuery.data.tiers.map((rule) => [rule.tier, rule]));
    setCancellationForm(
      Object.fromEntries(
        cancellationTiers.map((tier) => {
          const rule = byTier.get(tier);
          return [tier, { mode: rule?.mode ?? "FREE", percentage: rule?.percentage ?? 20 }];
        }),
      ) as Record<(typeof cancellationTiers)[number], CancellationRuleFormState>,
    );
    if (cancellationPolicyQuery.data.noShowPercentage !== undefined) {
      setNoShowPercent(cancellationPolicyQuery.data.noShowPercentage);
    }
  }

  const handleSaveCancellationPolicy = async () => {
    setCancellationFormError("");
    try {
      await updateCancellationPolicyMutation.mutateAsync({
        tiers: cancellationTiers.map((tier) => {
          const rule = cancellationForm[tier];
          return rule.mode === "FREE"
            ? { tier, mode: "FREE" as const }
            : { tier, mode: "PERCENTAGE" as const, percentage: rule.percentage };
        }),
        noShowPercentage: noShowPercent,
      });
    } catch (error) {
      setCancellationFormError(
        error instanceof Error ? error.message : "Couldn't save the cancellation policy.",
      );
    }
  };

  // Payments — no backend exists for a Business's payout bank details anywhere in this codebase
  // (confirmed — Finance/payout modules only ever read Stripe-derived data, never a
  // Business-submitted IBAN). Kept local/decorative and honestly non-functional below rather than
  // silently discarding what would look like real bank details.
  const [bankHolder, setBankHolder] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankVat, setBankVat] = useState("");

  const subTabs = [
    { name: "Personal info", icon: User02Icon },
    { name: "Role", icon: UserGroup03Icon },
    { name: "Cancellation & No-show", icon: Appointment02Icon },
    { name: "Payments", icon: CreditCardPosIcon },
    { name: "Integration", icon: UserGroup03Icon },
    { name: "Notifications", icon: Notification01Icon },
    { name: "Security & 2FA", icon: SecurityCheckIcon }
  ];

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      
      {/* Header Row */}
      <DashboardHeader title="Settings" subtitle="Bank information, notifications, integration and more" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Settings Panel Grid */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full mt-4">
        
        {/* Left Submenu Navigation Component */}
        <SettingsSubSidebar
          tabs={subTabs}
          activeSubTab={activeSubTab}
          setActiveSubTab={setActiveSubTab}
        />

        {/* Right Submenu Details Panel Container */}
        <div className="flex-1 w-full bg-transparent">
          
          {/* TAB 1: Personal Info */}
          {activeSubTab === "Personal info" && (
            <div className="flex flex-col gap-[14px] w-full">
              <div>
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

                  <SettingsInput label="Role" value={personalRole} onChange={() => {}} disabled={true} />
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

          {/* TAB 2: Role */}
          {activeSubTab === "Role" && (
            <div className="flex flex-col gap-[14px] w-full">
              <div>
                <h2 className="font-poppins font-medium text-base text-[#1A1A1A]">Role</h2>
                <p className="font-poppins font-normal text-xs text-[#888780] mt-0.5">
                  Your team&apos;s roles — manage members from the Staff page
                </p>
              </div>

              {/* Members Table Card */}
              <div className="bg-white border border-[#E2E8F0] rounded-[16px] overflow-hidden flex flex-col">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F7F5F1] text-[10px] font-semibold text-[#6B7280] tracking-[0.7px] uppercase border-b border-[#E2E8F0] h-[48px]">
                      <th className="py-3 px-6">MEMBER</th>
                      <th className="py-3 px-6">ROLE</th>
                      <th className="py-3 px-6">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {staffListQuery.isLoading && (
                      <tr>
                        <td className="py-6 px-6 text-xs text-neutral-400" colSpan={3}>
                          Loading team members…
                        </td>
                      </tr>
                    )}
                    {!staffListQuery.isLoading && staffMembers.length === 0 && (
                      <tr>
                        <td className="py-6 px-6 text-xs text-neutral-400" colSpan={3}>
                          No team members yet.
                        </td>
                      </tr>
                    )}
                    {staffMembers.map((m) => (
                      <tr key={m.userId} className="hover:bg-neutral-50/50 h-[72px]">
                        <td className="py-2.5 px-6">
                          <div className="flex items-center gap-3">
                            <Image src={m.avatarUrl || "/businessDashboard/downLogo.png"} alt={m.name} className="w-10 h-10 rounded-full object-cover border border-[#E2E8F0]" width={40} height={40} />
                            <div className="flex flex-col">
                              <span className="font-poppins font-medium text-[16px] leading-[28px] text-[#16123E]">
                                {m.name}
                              </span>
                              <span className="font-poppins font-normal text-xs text-[#808080]">
                                {m.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-6">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                            m.role === "BUSINESS_OWNER" ? "bg-[#E0F3F5] text-[#2E9DA7]" :
                            m.role === "SUPERVISOR" ? "bg-[#E6F1FB] text-[#3760B7]" :
                            "bg-[#F5F4EE] text-[#5F5E5A]"
                          }`}>
                            {m.role === "BUSINESS_OWNER" ? "Owner" : m.role === "SUPERVISOR" ? "Supervisor" : "Staff"}
                          </span>
                        </td>
                        <td className="py-2.5 px-6">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#DCFCE7] text-[#05895A] text-xs font-semibold rounded-full">
                            <span className="w-1.5 h-1.5 bg-[#02CC87] rounded-full" />
                            {m.employmentActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Cancellation & No-show */}
          {activeSubTab === "Cancellation & No-show" && (
            <div className="flex flex-col gap-[20px] w-full">
              <div>
                <h2 className="font-poppins font-semibold text-[14px] leading-[21px] text-[#111111]">
                  Booking Rules
                </h2>
                <p className="font-poppins font-normal text-xs text-[#666666] mt-0.5">
                  Slots, buffers, cancellations
                </p>
              </div>

              <div className="bg-white border border-neutral-100 rounded-[12px] p-5 flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h3 className="font-poppins font-normal text-[13px] text-[#1A1A1A]">
                    Cancellation window
                  </h3>
                  <p className="font-poppins font-normal text-[11px] text-[#757575] leading-[16px]">
                    Set cancellation policy based on the appointment time, but the percentage can not be less than 20% e.g., If the client wants to cancel the appointment more than 24 hours before then he can set the cancellation fee as free.
                  </p>
                </div>

                <div className="border border-neutral-200 rounded-[12px] p-5 flex flex-col gap-4">
                  {cancellationTiers.map((tier) => {
                    const rule = cancellationForm[tier];
                    const isFree = rule.mode === "FREE";
                    return (
                      <div key={tier} className="flex flex-col gap-3 pb-3 border-b border-neutral-100 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between w-full">
                          <span className="font-inter font-normal text-xs text-black">
                            {CANCELLATION_TIER_LABELS[tier]}
                          </span>

                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() =>
                              setCancellationForm((prev) => ({
                                ...prev,
                                [tier]: isFree
                                  ? { mode: "PERCENTAGE", percentage: prev[tier].percentage }
                                  : { mode: "FREE", percentage: prev[tier].percentage },
                              }))
                            }
                          >
                            {isFree ? (
                              <div className="w-5 h-5 bg-[#111111] rounded-[4px] flex items-center justify-center">
                                <HugeiconsIcon icon={Tick01Icon} className="w-3.5 h-3.5 text-white" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 border-2 border-[#666666] rounded-[4px]" />
                            )}
                            <span className="font-inter font-normal text-xs text-black select-none">
                              Free of charge
                            </span>
                          </div>
                        </div>

                        {!isFree && (
                          <div className="flex items-center border border-[#D3D1C7] rounded-[8px] overflow-hidden h-9 px-4">
                            <span className="font-poppins font-normal text-xs text-[#757575] mr-2">%</span>
                            <input
                              type="number"
                              min={20}
                              max={100}
                              value={rule.percentage}
                              onChange={(e) =>
                                setCancellationForm((prev) => ({
                                  ...prev,
                                  [tier]: { mode: "PERCENTAGE", percentage: Number(e.target.value) },
                                }))
                              }
                              className="flex-1 text-[13px] text-[#1A1A1A] font-poppins focus:outline-none h-full bg-transparent"
                            />
                          </div>
                        )}

                        {isFree && (
                          <div className="flex items-center border border-[#D3D1C7] bg-[#FCFAF9] rounded-[8px] overflow-hidden h-9 px-4">
                            <span className="font-poppins font-normal text-xs text-neutral-400">
                              Free cancellation
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <h3 className="font-poppins font-semibold text-[13px] text-[#1A1A1A]">
                    No-show percentage
                  </h3>
                  <span className="font-poppins font-normal text-[11px] text-neutral-500">
                    Fixed amount charged on booking
                  </span>
                  <div className="flex items-center border border-[#D3D1C7] rounded-[8px] overflow-hidden h-10 px-4 w-full">
                    <span className="font-poppins font-normal text-xs text-[#757575] mr-2">%</span>
                    <input
                      type="number"
                      min={20}
                      max={100}
                      value={noShowPercent}
                      onChange={(e) => setNoShowPercent(Number(e.target.value))}
                      className="flex-1 text-[13px] text-[#1A1A1A] font-poppins focus:outline-none h-full bg-transparent"
                    />
                  </div>
                </div>

                {cancellationFormError && (
                  <p className="text-xs text-red-600 font-poppins">{cancellationFormError}</p>
                )}

                <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-neutral-100">
                  <button
                    disabled={updateCancellationPolicyMutation.isPending}
                    onClick={() => setCancellationFormInitialized(false)}
                    className="px-4 py-2 border border-[#DEDDE3] rounded-[8px] text-xs font-semibold text-[#5B5D58] hover:bg-neutral-50 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={updateCancellationPolicyMutation.isPending}
                    onClick={handleSaveCancellationPolicy}
                    className="px-4 py-2 bg-[#111111] hover:bg-black text-white rounded-[8px] text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {updateCancellationPolicyMutation.isPending ? "Saving..." : "Save changes"}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: Payments */}
          {activeSubTab === "Payments" && (
            <div className="flex flex-col gap-[14px] w-full">
              <div>
                <h2 className="font-poppins font-medium text-base text-[#1A1A1A]">Payment info</h2>
                <p className="font-poppins font-normal text-xs text-[#888780] mt-0.5">Set your payment information</p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 flex flex-col gap-5">
                <span className="font-poppins font-semibold text-[13px] text-[#1A1A1A]">
                  Payout Bank Account Details (SEPA)
                </span>

                <div className="bg-[#F7F5F1] border border-[#E2E8F0] rounded-lg p-3 flex gap-2">
                  <HugeiconsIcon icon={InformationCircleIcon} className="w-5 h-5 text-[#6B7280] shrink-0 mt-0.5" />
                  <span className="text-xs text-[#5B5D58] font-medium leading-[18px]">
                    Bank details management isn&apos;t available yet.
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  <SettingsInput
                    label="Account holder name/Business name"
                    value={bankHolder}
                    onChange={setBankHolder}
                    disabled={true}
                  />

                  <SettingsInput label="IBAN" value={bankIban} onChange={setBankIban} disabled={true} />

                  <SettingsInput label="Bank name" value={bankName} onChange={setBankName} disabled={true} />

                  <SettingsInput
                    label="VAT no. (optional)"
                    value={bankVat}
                    onChange={setBankVat}
                    placeholder="e.g. 123"
                    disabled={true}
                  />
                </div>

                <button
                  disabled={true}
                  className="w-full bg-neutral-200 text-neutral-400 py-2.5 rounded-[12px] font-semibold text-sm mt-2 cursor-not-allowed"
                >
                  Update bank details
                </button>

              </div>
            </div>
          )}

          {/* TAB 5: Integration */}
          {activeSubTab === "Integration" && (
            <div className="flex flex-col gap-[14px] w-full">
              <div>
                <h2 className="font-poppins font-medium text-base text-[#1A1A1A]">Integration</h2>
                <p className="font-poppins font-normal text-xs text-[#888780] mt-0.5">Connect your google calendar, and social media accounts</p>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 flex flex-col gap-6">
                <span className="font-semibold text-sm text-[#1A1A1A]">Connected apps</span>
                <span className="text-[11px] text-neutral-400 -mt-4">Third-party tools that extend Bookly</span>

                {/* App 1: Google Calendar */}
                <div className="border border-neutral-100 rounded-[12px] p-4 flex flex-col items-start gap-3">
                  <div className="flex items-center gap-3">
                    <Image src="/Icons/Google.svg" alt="Google" className="w-8 h-8 object-contain" width={32} height={32} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-[#111111]">Google Calendar</span>
                      <span className="text-xs text-[#666666] mt-0.5">Not connected</span>
                    </div>
                  </div>
                  <button
                    disabled={true}
                    className="px-4 py-1.5 border border-[#DEDDE3] rounded-lg text-xs font-semibold text-neutral-400 cursor-not-allowed"
                  >
                    Connect
                  </button>
                </div>

                {/* App 2: Instagram */}
                <div className="border border-neutral-100 rounded-[12px] p-4 flex flex-col items-start gap-3">
                  <div className="flex items-center gap-3">
                    <Image src="/Icons/instagram1.svg" alt="Instagram" className="w-8 h-8 object-contain" width={32} height={32} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-[#111111]">Instagram</span>
                      <span className="text-xs text-[#666666] mt-0.5">Not connected</span>
                    </div>
                  </div>
                  <button disabled={true} className="px-4 py-1.5 bg-neutral-200 text-neutral-400 rounded-lg text-xs font-semibold cursor-not-allowed">
                    Connect
                  </button>
                </div>

                {/* App 3: Facebook */}
                <div className="border border-neutral-100 rounded-[12px] p-4 flex flex-col items-start gap-3">
                  <div className="flex items-center gap-3">
                    <Image src="/Icons/Facebook.svg" alt="Facebook" className="w-8 h-8 object-contain" width={32} height={32} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-[#111111]">Facebook</span>
                      <span className="text-xs text-[#666666] mt-0.5">Not connected</span>
                    </div>
                  </div>
                  <button disabled={true} className="px-4 py-1.5 bg-neutral-200 text-neutral-400 rounded-lg text-xs font-semibold cursor-not-allowed">
                    Connect
                  </button>
                </div>

                <p className="text-[11px] text-neutral-400">Integrations aren&apos;t available yet.</p>

              </div>
            </div>
          )}

          {/* TAB 6: Notifications */}
          {activeSubTab === "Notifications" && (
            <div className="flex flex-col gap-[20px] w-full">
              <div className="flex flex-col gap-1">
                <h2 className="font-poppins font-medium text-base text-[#111111]">Notifications</h2>
                <p className="font-poppins font-normal text-xs text-[#666666]">Control your notification</p>
              </div>

              {/* Notification triggers section */}
              <div className="bg-white border border-[#E8E8E6] rounded-[12px] p-0.5 shadow-none flex flex-col">
                {/* Header title */}
                <div className="p-5 border-b border-[#F0F0EE]">
                  <h3 className="font-poppins font-medium text-sm text-[#111111]">Notification triggers</h3>
                  <p className="font-poppins font-normal text-xs text-neutral-400 mt-0.5">Notification preferences aren&apos;t configurable yet — you&apos;ll always receive the existing booking emails.</p>
                </div>

                {/* List items */}
                <div className="p-5 flex flex-col gap-5">

                  {[
                    { label: "New booking", description: "When a client makes a new booking" },
                    { label: "Booking cancelled", description: "When a booking is cancelled by client or staff" },
                    { label: "Reminder - 24h before", description: "Sent to client the day before their appointment" },
                    { label: "Reminder - 1h before", description: "Last minute reminder to reduce no-shows" },
                  ].map((row, i) => (
                    <React.Fragment key={row.label}>
                      {i > 0 && <div className="border-t border-[#666666]/20" />}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-[#111111]">{row.label}</span>
                          <span className="text-xs text-neutral-400">{row.description}</span>
                        </div>
                        <div
                          title="Not configurable yet"
                          className="w-[38px] h-[21px] rounded-full bg-neutral-300 opacity-60 cursor-not-allowed flex items-center p-0.5"
                        >
                          <div className="w-4 h-4 bg-white rounded-full" />
                        </div>
                      </div>
                    </React.Fragment>
                  ))}

                </div>

              </div>
            </div>
          )}

          {/* TAB 7: Security & 2FA */}
          {activeSubTab === "Security & 2FA" && (
            <Security2FAPanel />
          )}

        </div>

      </div>
    
      </div></main>
  );
}
