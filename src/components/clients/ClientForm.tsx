"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";


import React, { RefObject } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  User02Icon,
  PencilEdit02Icon,
  Mail01Icon,
  Calendar03Icon,
  ScissorIcon,
  Calendar02Icon
} from "@hugeicons/core-free-icons";
import { BUSINESS_CITIES } from "@/lib/constants/cities";

interface ClientFormProps {
  editingClientIndex: number | null;
  isViewingClient: boolean;
  setIsAddingClient: (val: boolean) => void;
  setEditingClientIndex: (idx: number | null) => void;
  setIsViewingClient: (val: boolean) => void;

  clientFirstName: string;
  setClientFirstName: (val: string) => void;
  clientLastName: string;
  setClientLastName: (val: string) => void;
  clientPhone: string;
  setClientPhone: (val: string) => void;
  clientEmail: string;
  setClientEmail: (val: string) => void;
  clientDob: string;
  setClientDob: (val: string) => void;
  clientGender: string;
  setClientGender: (val: string) => void;
  clientCity: string;
  setClientCity: (val: string) => void;
  clientPropertyType: string;
  setClientPropertyType: (val: string) => void;
  clientArea: string;
  setClientArea: (val: string) => void;
  clientStreetName: string;
  setClientStreetName: (val: string) => void;
  clientStreetNumber: string;
  setClientStreetNumber: (val: string) => void;
  clientFloor: string;
  setClientFloor: (val: string) => void;
  clientAptNo: string;
  setClientAptNo: (val: string) => void;
  clientDirections: string;
  setClientDirections: (val: string) => void;
  clientNotes: string;
  setClientNotes: (val: string) => void;
  clientTag: string;
  setClientTagState: (val: string) => void;

  clientAvatar: string;
  clientAvatarInputRef: RefObject<HTMLInputElement | null>;
  handleClientAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  clientPhoneCode: string;
  setClientPhoneCode: (val: string) => void;
  clientPhoneFlag: string;
  setClientPhoneFlag: (val: string) => void;
  isClientPhoneDropdownOpen: boolean;
  setIsClientPhoneDropdownOpen: (val: boolean) => void;
  phoneCountries: Array<{ name: string; code: string; flag: string }>;

  handleSaveClient: () => void;
  handleAddClient: () => void;

  /** True only for a LINKED Client — name/phone/email/gender are managed by the Customer's own Bookly account. */
  identityFieldsDisabled?: boolean;
  /** Field-path -> message, e.g. { "address.city": "Required" }, surfaced under each input. */
  serverErrors?: Record<string, string>;
  isSubmitting?: boolean;
}

export default function ClientForm({
  editingClientIndex,
  isViewingClient,
  setIsAddingClient,
  setEditingClientIndex,
  setIsViewingClient,

  clientFirstName,
  setClientFirstName,
  clientLastName,
  setClientLastName,
  clientPhone,
  setClientPhone,
  clientEmail,
  setClientEmail,
  clientDob,
  setClientDob,
  clientGender,
  setClientGender,
  clientCity,
  setClientCity,
  clientPropertyType,
  setClientPropertyType,
  clientArea,
  setClientArea,
  clientStreetName,
  setClientStreetName,
  clientStreetNumber,
  setClientStreetNumber,
  clientFloor,
  setClientFloor,
  clientAptNo,
  setClientAptNo,
  clientDirections,
  setClientDirections,
  clientNotes,
  setClientNotes,
  clientTag,
  setClientTagState,

  clientAvatar,
  clientAvatarInputRef,
  handleClientAvatarChange,

  clientPhoneCode,
  setClientPhoneCode,
  clientPhoneFlag,
  setClientPhoneFlag,
  isClientPhoneDropdownOpen,
  setIsClientPhoneDropdownOpen,
  phoneCountries,

  handleSaveClient,
  handleAddClient,
  identityFieldsDisabled = false,
  serverErrors,
  isSubmitting = false
}: ClientFormProps) {
  const errorFor = (field: string) => serverErrors?.[field];
  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] relative">
      {/* Client Add/Edit Header */}
      <DashboardHeader title={editingClientIndex !== null ? "Edit Client" : "Add Client"} subtitle={editingClientIndex !== null ? "Update client info in your system" : "Create new client info in your system"} />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Client Form Wrapper */}
      <div className="flex-1 p-6 md:p-8 xl:p-10 flex flex-col lg:flex-row gap-8 items-start w-full">
        <div className="flex-1 flex flex-col gap-6 w-full">
          {/* Back / Breadcrumbs */}
          <div
            onClick={() => {
              setIsAddingClient(false);
              setEditingClientIndex(null);
              setIsViewingClient(false);
            }}
            className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-900 font-poppins select-none"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4 text-neutral-600" />
            <span>Clients</span>
            <span className="text-neutral-300 font-normal">&gt;</span>
            <span className="text-[#0F1E35] font-semibold">
              {isViewingClient ? "View client" : editingClientIndex !== null ? "Edit client" : "Add client"}
            </span>
          </div>

          <fieldset disabled={isViewingClient} className="space-y-6">
            {/* Personal Information Header */}
            <div>
              <h3 className="font-poppins text-[11px] font-medium tracking-[0.66px] uppercase text-[#888780]">Personal information</h3>
            </div>

            {identityFieldsDisabled && (
              <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg p-3 text-[11px] text-[#5F5E5A] font-poppins leading-[16px]">
                This client is linked to a Bookly customer account — name, phone, email, and gender are managed by the customer and shown here read-only. Address, notes, and tags remain editable.
              </div>
            )}

            {/* Avatar Picker */}
            <div 
              onClick={() => clientAvatarInputRef.current?.click()}
              className="relative w-14 h-14 bg-[#E1F5EE] rounded-full flex items-center justify-center select-none cursor-pointer hover:opacity-95 transition-opacity"
            >
              {clientAvatar ? (
                <Image src={clientAvatar} className="w-full h-full rounded-full object-cover" alt="client avatar" fill />
              ) : (
                <HugeiconsIcon icon={User02Icon} className="w-[22px] h-[22px] text-[#ABAAA6]" />
              )}
              <div className="absolute right-0 bottom-0 w-6 h-6 bg-white border border-[#E8E8E6] rounded-full flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={PencilEdit02Icon} className="w-3 h-3 text-[#757575]" />
              </div>
            </div>
            <input 
              type="file"
              ref={clientAvatarInputRef}
              onChange={handleClientAvatarChange}
              accept="image/*"
              className="hidden"
            />

            {/* First and Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-poppins text-xs font-medium text-[#5F5E5A] flex items-center gap-0.5">
                  <span>First name</span>
                  <span className="text-[#E24B4A]">*</span>
                </label>
                <input
                  type="text"
                  value={clientFirstName}
                  onChange={(e) => setClientFirstName(e.target.value)}
                  placeholder="e.g. Maria"
                  disabled={identityFieldsDisabled}
                  className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800 disabled:bg-[#FAFAF8] disabled:text-[#5F5E5A]"
                />
                {errorFor("firstName") && (
                  <span className="text-[11px] text-[#E24B4A] font-poppins">{errorFor("firstName")}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-poppins text-xs font-medium text-[#5F5E5A]">Last name</label>
                <input
                  type="text"
                  value={clientLastName}
                  onChange={(e) => setClientLastName(e.target.value)}
                  placeholder="e.g. Papadopoulou"
                  disabled={identityFieldsDisabled}
                  className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800 disabled:bg-[#FAFAF8] disabled:text-[#5F5E5A]"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-2">
              <label className="font-poppins text-xs font-medium text-[#5F5E5A] flex items-center gap-0.5">
                <span>Phone</span>
                <span className="text-[#E24B4A]">*</span>
              </label>
              <div className="flex w-full h-[38px] relative">
                <div
                  onClick={() => !identityFieldsDisabled && setIsClientPhoneDropdownOpen(!isClientPhoneDropdownOpen)}
                  className={`bg-white border border-[#E8E8E4] border-r-0 rounded-l-lg px-3 flex items-center gap-1.5 text-xs text-neutral-500 shrink-0 select-none ${identityFieldsDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-neutral-50/50"}`}
                >
                  <Image src={`https://flagcdn.com/w20/${clientPhoneFlag}.png`} alt="flag" className="w-[18px] h-[12px] object-cover rounded-sm border border-neutral-100 shrink-0" width={24} height={24} />
                  <span>{clientPhoneCode}</span>
                  <svg className="w-3 h-3 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Dropdown menu */}
                {isClientPhoneDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent"
                      onClick={() => setIsClientPhoneDropdownOpen(false)}
                    />
                    <div className="absolute top-[40px] left-0 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 w-[180px] p-1 flex flex-col gap-0.5 text-xs">
                      {phoneCountries.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setClientPhoneCode(c.code);
                            setClientPhoneFlag(c.flag);
                            setIsClientPhoneDropdownOpen(false);
                          }}
                          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-neutral-50 rounded text-left font-poppins"
                        >
                          <Image src={`https://flagcdn.com/w40/${c.flag}.png`} className="w-[20px] h-[12px] object-cover rounded-sm shrink-0 border border-neutral-100" alt="flag" width={24} height={24} />
                          <span className="font-semibold text-neutral-800">{c.code}</span>
                          <span className="text-neutral-500 text-[10px] ml-auto">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="1111111111"
                  disabled={identityFieldsDisabled}
                  className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-r-lg px-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800 disabled:bg-[#FAFAF8] disabled:text-[#5F5E5A]"
                />
              </div>
              <span className="text-[11px] text-[#ABAAA6] font-poppins">Used for SMS reminders and booking confirmations</span>
              {errorFor("phone.nationalNumber") && (
                <span className="text-[11px] text-[#E24B4A] font-poppins">{errorFor("phone.nationalNumber")}</span>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="font-poppins text-xs font-medium text-[#5F5E5A] flex items-center gap-0.5">
                <span>Email</span>
                <span className="text-[#E24B4A]">*</span>
              </label>
              <div className="flex items-center gap-3 border border-[#E8E8E4] rounded-lg px-3 bg-white h-[38px]">
                <HugeiconsIcon icon={Mail01Icon} className="w-5 h-5 text-neutral-400" />
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@email.com"
                  disabled={identityFieldsDisabled}
                  className="w-full h-full text-xs placeholder-neutral-400 focus:outline-none disabled:text-[#5F5E5A]"
                />
              </div>
              {errorFor("email") && (
                <span className="text-[11px] text-[#E24B4A] font-poppins">{errorFor("email")}</span>
              )}
            </div>

            {/* Date of Birth & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-poppins text-xs font-medium text-[#5F5E5A]">Date of birth</label>
                <div className="flex items-center gap-3 border border-[#E8E8E4] rounded-lg px-3 bg-white h-[38px]">
                  <HugeiconsIcon icon={Calendar03Icon} className="w-5 h-5 text-neutral-400" />
                  <input
                    type="text"
                    value={clientDob}
                    onChange={(e) => setClientDob(e.target.value)}
                    placeholder="1/6/2026"
                    className="w-full h-full text-xs placeholder-neutral-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-poppins text-xs font-medium text-[#5F5E5A]">Gender</label>
                <div className="relative">
                  <select
                    value={clientGender}
                    onChange={(e) => setClientGender(e.target.value)}
                    disabled={identityFieldsDisabled}
                    className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs text-neutral-700 appearance-none focus:outline-none focus:border-neutral-800 disabled:bg-[#FAFAF8] disabled:text-[#5F5E5A]"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="border border-[#E8E8E6] rounded-xl p-5 bg-white flex flex-col gap-4">
              <h4 className="font-poppins text-xs font-semibold text-[#5F5E5A] tracking-wider uppercase">Address</h4>

              <div className="flex flex-col gap-2">
                <label className="font-poppins text-xs font-medium text-[#5F5E5A] flex items-center gap-0.5">
                  <span>City</span>
                  <span className="text-[#E24B4A]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={clientCity}
                    onChange={(e) => setClientCity(e.target.value)}
                    className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs text-neutral-700 appearance-none focus:outline-none focus:border-neutral-800"
                  >
                    <option value="">Select city</option>
                    {BUSINESS_CITIES.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errorFor("address.city") && (
                  <span className="text-[11px] text-[#E24B4A] font-poppins">{errorFor("address.city")}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-poppins text-xs font-medium text-[#5F5E5A] flex items-center gap-0.5">
                  <span>Property type</span>
                  <span className="text-[#E24B4A]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={clientPropertyType}
                    onChange={(e) => setClientPropertyType(e.target.value)}
                    className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs text-neutral-700 appearance-none focus:outline-none focus:border-neutral-800"
                  >
                    <option value="">Select property type</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Villa">Villa</option>
                    <option value="House">House</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Office">Office</option>
                    <option value="Other">Other</option>
                  </select>
                  <div className="absolute right-3 top-3.5 pointer-events-none">
                    <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errorFor("address.propertyType") && (
                  <span className="text-[11px] text-[#E24B4A] font-poppins">{errorFor("address.propertyType")}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-poppins text-xs font-medium text-[#5F5E5A] flex items-center gap-0.5">
                  <span>Area/neighborhood</span>
                  <span className="text-[#E24B4A]">*</span>
                </label>
                <input
                  type="text"
                  value={clientArea}
                  onChange={(e) => setClientArea(e.target.value)}
                  placeholder="e.g. Mackenzie, finikoudes"
                  className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800"
                />
                {errorFor("address.area") && (
                  <span className="text-[11px] text-[#E24B4A] font-poppins">{errorFor("address.area")}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-poppins text-xs font-medium text-[#5F5E5A] flex items-center gap-0.5">
                    <span>Street name</span>
                    <span className="text-[#E24B4A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientStreetName}
                    onChange={(e) => setClientStreetName(e.target.value)}
                    placeholder="e.g. Emrou"
                    className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800"
                  />
                  {errorFor("address.streetName") && (
                    <span className="text-[11px] text-[#E24B4A] font-poppins">{errorFor("address.streetName")}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-poppins text-xs font-medium text-[#5F5E5A] flex items-center gap-0.5">
                    <span>Street number</span>
                    <span className="text-[#E24B4A]">*</span>
                  </label>
                  <input
                    type="text"
                    value={clientStreetNumber}
                    onChange={(e) => setClientStreetNumber(e.target.value)}
                    placeholder="e.g. 14"
                    className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800"
                  />
                  {errorFor("address.streetNumber") && (
                    <span className="text-[11px] text-[#E24B4A] font-poppins">{errorFor("address.streetNumber")}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="font-poppins text-xs font-medium text-[#5F5E5A]">Floor /unit</label>
                  <input
                    type="text"
                    value={clientFloor}
                    onChange={(e) => setClientFloor(e.target.value)}
                    placeholder="e.g. 3rd floor"
                    className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-poppins text-xs font-medium text-[#5F5E5A]">Apt/room no.</label>
                  <input
                    type="text"
                    value={clientAptNo}
                    onChange={(e) => setClientAptNo(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg px-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-poppins text-xs font-medium text-[#5F5E5A]">Additional directions</label>
                <textarea
                  value={clientDirections}
                  onChange={(e) => setClientDirections(e.target.value)}
                  placeholder="e.g. Blue gate on the left, ring twice. Hotel name if applicable. Parking availale in front."
                  className="w-full h-24 bg-white border border-[#E8E8E4] rounded-lg p-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800 resize-none"
                />
              </div>
            </div>

            {/* Notes Section */}
            <div className="flex flex-col gap-2">
              <label className="font-poppins text-xs font-medium text-[#5F5E5A]">Notes</label>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="e.g. Prefers ammonia-free colour. Sensitive scalp."
                className="w-full h-24 bg-white border border-[#E8E8E4] rounded-lg p-3 text-xs placeholder-neutral-400 focus:outline-none focus:border-neutral-800 resize-none"
              />
              <span className="text-[11px] text-[#ABAAA6] font-poppins">Visible to staff only — allergy info, preferences,</span>
            </div>

            {/* Tags Section */}
            <div className="flex flex-col gap-3">
              <label className="font-poppins text-xs font-medium text-[#5F5E5A]">Client tags</label>
              <div className="flex flex-wrap items-center gap-2 select-none">
                {["VIP", "Regular", "New", "No-show"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setClientTagState(tag)}
                    className={`h-8 px-4 rounded-full text-xs font-medium border transition-all ${clientTag === tag
                        ? "bg-[#E8E8E4] border-white text-[#5F5E5A] font-semibold"
                        : "bg-white border-[#E8E8E4] text-[#5F5E5A]"
                      }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-[#ABAAA6] font-poppins">Tags help you filter and identify clients quickly</span>
            </div>
          </fieldset>
        </div>

        {/* Right Column: Preview (280px width) */}
        <div className="w-full lg:w-[280px] bg-white border border-[#EEECEA] rounded-xl p-5 flex flex-col gap-6 shrink-0 shadow-sm relative lg:sticky lg:top-6">
          <span className="font-poppins font-medium text-[13px] text-[#1C1C1A]">Client preview</span>

          {/* Avatar & Name */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-[#E1F5EE] rounded-full flex items-center justify-center overflow-hidden">
              {clientAvatar ? (
                <Image src={clientAvatar} className="w-full h-full object-cover" alt="client avatar preview" fill />
              ) : (
                <HugeiconsIcon icon={User02Icon} className="w-[26px] h-[26px] text-[#ABAAA6]" />
              )}
            </div>
            <span className={`font-poppins font-semibold text-sm leading-[21px] text-center ${clientFirstName || clientLastName ? "text-[#1C1C1A]" : "text-[#D3D1C7]"}`}>
              {clientFirstName || clientLastName ? `${clientFirstName} ${clientLastName}`.trim() : "Full name"}
            </span>
          </div>

          <div className="border-t border-[#F0F0EE] w-full" />

          {/* Details List */}
          <div className="flex flex-col gap-4">
            {/* Phone Row */}
            <div className="flex items-start gap-3">
              <div className="w-[15px] h-[15px] flex items-center justify-center shrink-0 mt-0.5">
                <Image src="/Icons/phone.svg" alt="Phone" className="w-[15px] h-[15px] object-contain opacity-60" width={24} height={24} />
              </div>
              <div className="flex flex-col">
                <span className="font-poppins text-[10px] text-[#ABAAA6] leading-none">Phone</span>
                <span className={`font-poppins text-xs mt-1 ${clientPhone ? "text-neutral-800" : "text-[#D3D1C7]"}`}>
                  {clientPhone ? `${clientPhoneCode} ${clientPhone}` : "—"}
                </span>
              </div>
            </div>

            {/* Email Row */}
            <div className="flex items-start gap-3">
              <div className="w-[15px] h-[15px] flex items-center justify-center shrink-0 mt-0.5">
                <HugeiconsIcon icon={Mail01Icon} className="w-[15px] h-[15px] text-[#888780]" />
              </div>
              <div className="flex flex-col">
                <span className="font-poppins text-[10px] text-[#ABAAA6] leading-none">Email</span>
                <span className={`font-poppins text-xs mt-1 ${clientEmail ? "text-neutral-800" : "text-[#D3D1C7]"} break-all`}>
                  {clientEmail || "—"}
                </span>
              </div>
            </div>

            {/* Staff Row */}
            <div className="flex items-start gap-3">
              <div className="w-[15px] h-[15px] flex items-center justify-center shrink-0 mt-0.5">
                <HugeiconsIcon icon={ScissorIcon} className="w-[15px] h-[15px] text-[#888780]" />
              </div>
              <div className="flex flex-col">
                <span className="font-poppins text-[10px] text-[#ABAAA6] leading-none">Staff</span>
                <span className="font-poppins text-xs mt-1 text-[#D3D1C7]">—</span>
              </div>
            </div>

            {/* Birthday Row */}
            <div className="flex items-start gap-3">
              <div className="w-[15px] h-[15px] flex items-center justify-center shrink-0 mt-0.5">
                <HugeiconsIcon icon={Calendar02Icon} className="w-[15px] h-[15px] text-[#888780]" />
              </div>
              <div className="flex flex-col">
                <span className="font-poppins text-[10px] text-[#ABAAA6] leading-none">Birthday</span>
                <span className={`font-poppins text-xs mt-1 ${clientDob ? "text-neutral-800" : "text-[#D3D1C7]"}`}>
                  {clientDob || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-[#F0F0EE] w-full" />

          {/* Validation Warnings */}
          {(!clientFirstName || !clientPhone) && (
            <div className="bg-[#FAFAF8] border border-[#E8E8E4] rounded-lg p-3 flex gap-2 items-start text-[11px] text-[#ABAAA6] leading-[16px]">
              <svg className="w-4 h-4 text-[#ABAAA6] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>First name and phone number are required to continue.</span>
            </div>
          )}

          {errorFor("root") && (
            <div className="bg-[#FCE4E4] border border-[#F3B3B3] rounded-lg p-3 text-[11px] text-[#BA1A1A] leading-[16px] font-poppins">
              {errorFor("root")}
            </div>
          )}

          {/* Form Action buttons block */}
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={editingClientIndex !== null ? handleSaveClient : handleAddClient}
              disabled={!clientFirstName || !clientPhone || isSubmitting}
              className={`w-full h-10 rounded-lg text-xs font-semibold text-white font-poppins transition-all select-none ${clientFirstName && clientPhone && !isSubmitting
                  ? "bg-[#0F1E35] hover:bg-[#1C3252] cursor-pointer"
                  : "bg-[#D3D1C7] cursor-not-allowed"
                }`}
            >
              {isSubmitting ? "Saving..." : editingClientIndex !== null ? "Save changes" : "Add client"}
            </button>
            <button
              onClick={() => {
                setIsAddingClient(false);
                setEditingClientIndex(null);
                setIsViewingClient(false);
              }}
              className="w-full h-[38px] bg-white border border-[#E8E8E4] rounded-lg text-xs font-semibold text-[#5F5E5A] font-poppins hover:bg-neutral-50 transition-all select-none"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    
      </div></main>
  );
}
