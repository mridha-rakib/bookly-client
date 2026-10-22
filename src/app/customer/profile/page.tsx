"use client";

import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar02Icon,
  ArrowDown01Icon,
  UserIcon,
  Mail01Icon,
  SmartPhone01Icon,
  Location01Icon,
  Key01Icon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";

// Components
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AddToHomeScreenButton from "@/components/landing-page/AddToHomeScreenButton";
import EdgeSoftOrbsTop from "@/components/EdgeSoftOrbsTop";
import { Spinner } from "@/components/ui/spinner";

import { countries } from "@/components/CountryData";
import ProfileAvatar from "@/components/ProfileAvatar";
import AvatarCropModal from "@/components/media/AvatarCropModal";
import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import {
  useCurrentUserQuery,
  useRequestEmailChangeMutation,
  useRequestPhoneChangeMutation,
  useUpdateMyAvatarMutation,
  useUpdateMyProfileMutation,
  useVerifyEmailChangeMutation,
  useVerifyPhoneChangeMutation,
} from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import type { Gender } from "@/lib/api/auth";

type GenderOption = "Male" | "Female" | "Other";

const toDisplayGender = (gender: Gender): GenderOption =>
  gender === "male" ? "Male" : gender === "female" ? "Female" : "Other";

const toBackendGender = (gender: GenderOption): Gender =>
  gender === "Male" ? "male" : gender === "Female" ? "female" : "other";

type ProfileFormData = {
  firstName: string;
  lastName: string;
  countryCode: string;
  countryIso: string;
  phoneNumber: string;
  address: string;
  gender: GenderOption;
  dateOfBirth: string;
};

export default function ProfilePage() {
  return (
    <RequireCustomer>
      <ProfilePageContent />
    </RequireCustomer>
  );
}

function ProfilePageContent() {
  const router = useRouter();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;

  // App Install Banner State
  const [showBanner, setShowBanner] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  const meQuery = useCurrentUserQuery();
  const updateMutation = useUpdateMyProfileMutation();
  const avatarMutation = useUpdateMyAvatarMutation();

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState("");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  // Avatar: the backend (GET /auth/me -> profile.avatarUrl) is the source of truth. The only
  // local state here is a transient object URL for the crop preview and a surfaced error.
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropBaseName, setCropBaseName] = useState<string | undefined>(undefined);
  const [avatarError, setAvatarError] = useState("");
  const cropSourceRef = useRef<string | null>(null);

  const setCropSourceTracked = (next: string | null) => {
    if (cropSourceRef.current) URL.revokeObjectURL(cropSourceRef.current);
    cropSourceRef.current = next;
    setCropSource(next);
  };

  const openCropWithFile = (file: File) => {
    setAvatarError("");
    setCropSourceTracked(URL.createObjectURL(file));
    setCropBaseName(file.name);
  };

  const closeCrop = () => {
    setCropSourceTracked(null);
    setCropBaseName(undefined);
  };

  // Crop confirmed -> dedicated upload immediately (avatar persistence is intentionally NOT
  // tied to the text-profile "Save" button — the previous implementation also committed the
  // photo on its own, and email/phone likewise have their own commit paths). Success is only
  // shown once the server has persisted it (mutation resolved + ["auth","me"] cache updated).
  const handleCroppedAvatar = async (file: File) => {
    closeCrop();
    setAvatarError("");
    try {
      await avatarMutation.mutateAsync(file);
    } catch (error) {
      setAvatarError(toUserMessage(error));
    }
  };

  // Revoke a lingering crop object URL on unmount (e.g. navigating away with the modal open).
  useEffect(
    () => () => {
      if (cropSourceRef.current) URL.revokeObjectURL(cropSourceRef.current);
    },
    [],
  );

  // One-time cleanup of the deprecated browser-only avatar key (now that the backend is the
  // source of truth). Touches only this key; unrelated stored data is left untouched.
  useEffect(() => {
    try {
      localStorage.removeItem("customerAvatarUrl");
    } catch {
      /* ignore storage access errors */
    }
  }, []);

  const profile = meQuery.data?.profile;
  const email = meQuery.data?.user.email ?? "";
  const phoneCountryCode = profile?.phone?.countryCode ?? "+357";
  const phoneNationalNumber = profile?.phone?.nationalNumber ?? "";

  const buildFormData = (): ProfileFormData => ({
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    countryCode: phoneCountryCode,
    countryIso: countries.find((c) => c.code === phoneCountryCode)?.iso ?? "cy",
    phoneNumber: phoneNationalNumber,
    address: profile?.address ?? "",
    gender: profile ? toDisplayGender(profile.gender) : "Male",
    dateOfBirth: profile?.dateOfBirth ?? "",
  });

  const [formData, setFormData] = useState<ProfileFormData>(buildFormData);

  const startEditing = () => {
    setFormData(buildFormData());
    setFormError("");
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setFormError("Please enter both a first and last name.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        gender: toBackendGender(formData.gender),
        address: formData.address.trim() || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      setFormError(toUserMessage(error));
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormError("");
  };

  const triggerDatePicker = () => {
    if (dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch {
        dateInputRef.current.focus();
      }
    }
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return "Not set";
    const parts = dateString.split("-");
    if (parts.length !== 3) return dateString;
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const displayFullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";
  const displayPhone = phoneNationalNumber ? `${phoneCountryCode} ${phoneNationalNumber}` : "Not set";

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden font-poppins">
      <EdgeSoftOrbsTop size={380} duration={56} intensity={0.85} blend="screen" zIndex={-5} />

      <div className="absolute top-0 left-0 -z-10 w-full pointer-events-none opacity-40">
        <Image src="/designImg/topEllipes.svg" alt="" className="absolute top-0 left-0 w-[500px] h-[500px]" width={24} height={24} />
      </div>

      {showBanner && (
        <div className="w-full bg-[#96C3CD] text-[#111111] px-3 sm:px-[16px] py-2.5 sm:py-[16px] flex items-center justify-between transition-all duration-300 relative z-50 text-[10px] sm:text-xs md:text-sm font-medium">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-[17px] h-[20px] flex items-center justify-center shrink-0">
              <Image src="/img/smallBLogo.svg" alt="B" className="w-full h-full object-contain" fill />
            </div>
            <span className="truncate">Book local services in Cyprus — instantly, any time</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <AddToHomeScreenButton size="small" className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs" />
            <button
              onClick={() => setShowBanner(false)}
              className="text-[#1C1B1C] hover:opacity-75 transition-opacity cursor-pointer p-1"
              aria-label="Close Banner"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 xl:px-[68px] mt-6 md:mt-[40px]">
        <nav className="flex flex-row items-center p-0 gap-3 h-6">
          <button
            onClick={() => router.push("/")}
            className="font-poppins font-normal text-sm leading-5 tracking-[0.075em] uppercase text-black hover:opacity-70 transition-opacity cursor-pointer"
          >
            Home
          </button>
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 7L14.5 12L9.5 17" stroke="#0C0C0C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-poppins font-normal text-sm leading-5 tracking-[0.075em] uppercase text-black">
            {isEditing ? "Edit Profile" : "Profile details"}
          </span>
        </nav>
      </div>

      <main className="flex-1 w-full max-w-[908px] mx-auto px-4 md:px-8 xl:px-0 mt-6 flex flex-col items-start gap-8 z-10 relative">
        <div className="flex flex-col items-start p-0 gap-8 w-full">
          <div className="w-full flex flex-col items-start p-0 self-stretch">
            <h1 className="font-manrope font-bold text-[30px] leading-[36px] tracking-[-0.75px] text-[#1C1B1C] self-stretch">
              {isEditing ? "Edit Profile" : "Profile Details"}
            </h1>
          </div>

          {meQuery.isLoading && (
            <div className="w-full flex items-center justify-center py-24">
              <Spinner className="text-[#8EBAC5]" />
            </div>
          )}

          {meQuery.isError && (
            <div className="w-full bg-white border border-[#C6C6CB] rounded-xl p-8 text-sm text-red-600">
              We couldn&apos;t load your profile right now. Please refresh the page.
            </div>
          )}

          {!meQuery.isLoading && !meQuery.isError && profile && (
            <div className="w-full box-border flex flex-col md:flex-row items-stretch p-6 md:p-8 lg:p-9 gap-8 bg-white border border-neutral-200/80 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)]">
              {/* Left Column: Avatar & Account Badge */}
              <div className="flex flex-col items-center shrink-0 w-full md:w-[150px] md:pr-8 md:border-r border-neutral-100 gap-3">
                <ProfileAvatar
                  avatarUrl={profile.avatarUrl}
                  onSelectFile={openCropWithFile}
                  onValidationError={setAvatarError}
                  uploading={avatarMutation.isPending}
                  error={avatarError}
                />
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#2E9DA7]/10 text-[#195156] border border-[#2E9DA7]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2E9DA7]" />
                  <span>Customer</span>
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 flex flex-col justify-between gap-6 w-full min-w-0">
                {!isEditing ? (
                  <div className="w-full flex flex-col gap-6">
                    {/* Information Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                      {/* Full Name */}
                      <div className="group bg-neutral-50/70 hover:bg-neutral-50/90 border border-neutral-200/60 hover:border-neutral-200 rounded-xl p-4 transition-all duration-150 flex flex-col justify-between min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-md bg-white border border-neutral-200/60 flex items-center justify-center text-[#0C7C93] shadow-2xs shrink-0">
                            <HugeiconsIcon icon={UserIcon} size={13} />
                          </span>
                          <span className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                            Full Name
                          </span>
                        </div>
                        <span className="font-manrope font-semibold text-[16px] text-[#1C1B1C] truncate" title={displayFullName}>
                          {displayFullName}
                        </span>
                      </div>

                      {/* Email Address */}
                      <div className="group bg-neutral-50/70 hover:bg-neutral-50/90 border border-neutral-200/60 hover:border-neutral-200 rounded-xl p-4 transition-all duration-150 flex flex-col justify-between min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-md bg-white border border-neutral-200/60 flex items-center justify-center text-[#0C7C93] shadow-2xs shrink-0">
                              <HugeiconsIcon icon={Mail01Icon} size={13} />
                            </span>
                            <span className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                              Email Address
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsEmailModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-[#0C7C93] bg-[#0C7C93]/10 hover:bg-[#0C7C93]/20 active:scale-95 transition-all cursor-pointer shrink-0"
                          >
                            Change
                          </button>
                        </div>
                        <span className="font-manrope font-semibold text-[15px] text-[#1C1B1C] truncate" title={email}>
                          {email}
                        </span>
                      </div>

                      {/* Phone Number */}
                      <div className="group bg-neutral-50/70 hover:bg-neutral-50/90 border border-neutral-200/60 hover:border-neutral-200 rounded-xl p-4 transition-all duration-150 flex flex-col justify-between min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-md bg-white border border-neutral-200/60 flex items-center justify-center text-[#0C7C93] shadow-2xs shrink-0">
                              <HugeiconsIcon icon={SmartPhone01Icon} size={13} />
                            </span>
                            <span className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                              Phone Number
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsPhoneModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-[#0C7C93] bg-[#0C7C93]/10 hover:bg-[#0C7C93]/20 active:scale-95 transition-all cursor-pointer shrink-0"
                          >
                            Change
                          </button>
                        </div>
                        <div className="flex items-center gap-2 font-manrope font-semibold text-[15px] text-[#1C1B1C] min-w-0">
                          <Image
                            src={`https://flagcdn.com/w20/${formData.countryIso}.png`}
                            alt="Flag"
                            className="w-4 h-3 object-cover rounded-[2px] shrink-0 shadow-2xs"
                            width={16}
                            height={12}
                          />
                          <span className="truncate">{displayPhone}</span>
                        </div>
                      </div>

                      {/* My Address */}
                      <div className="group bg-neutral-50/70 hover:bg-neutral-50/90 border border-neutral-200/60 hover:border-neutral-200 rounded-xl p-4 transition-all duration-150 flex flex-col justify-between min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-md bg-white border border-neutral-200/60 flex items-center justify-center text-[#0C7C93] shadow-2xs shrink-0">
                            <HugeiconsIcon icon={Location01Icon} size={13} />
                          </span>
                          <span className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                            My Address
                          </span>
                        </div>
                        <span className="font-manrope font-semibold text-[15px] text-[#1C1B1C] truncate" title={profile.address || "Not set"}>
                          {profile.address || <span className="text-neutral-400 font-normal italic">Not set</span>}
                        </span>
                      </div>

                      {/* Gender */}
                      <div className="group bg-neutral-50/70 hover:bg-neutral-50/90 border border-neutral-200/60 hover:border-neutral-200 rounded-xl p-4 transition-all duration-150 flex flex-col justify-between min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-md bg-white border border-neutral-200/60 flex items-center justify-center text-[#0C7C93] shadow-2xs shrink-0">
                            <HugeiconsIcon icon={UserIcon} size={13} />
                          </span>
                          <span className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                            Gender
                          </span>
                        </div>
                        <span className="font-manrope font-semibold text-[15px] text-[#1C1B1C]">
                          {toDisplayGender(profile.gender)}
                        </span>
                      </div>

                      {/* Date of Birth */}
                      <div className="group bg-neutral-50/70 hover:bg-neutral-50/90 border border-neutral-200/60 hover:border-neutral-200 rounded-xl p-4 transition-all duration-150 flex flex-col justify-between min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-6 h-6 rounded-md bg-white border border-neutral-200/60 flex items-center justify-center text-[#0C7C93] shadow-2xs shrink-0">
                            <HugeiconsIcon icon={Calendar02Icon} size={13} />
                          </span>
                          <span className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                            Date of Birth
                          </span>
                        </div>
                        <span className="font-manrope font-semibold text-[15px] text-[#1C1B1C]">
                          {formatDateDisplay(profile.dateOfBirth ?? "") || <span className="text-neutral-400 font-normal italic">Not set</span>}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex flex-col sm:flex-row justify-end items-center gap-3 w-full pt-5 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => router.push("/customer/settings")}
                        className="w-full sm:w-auto h-11 px-5 border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 flex justify-center items-center gap-2 rounded-xl active:scale-95 transition-all cursor-pointer font-manrope font-semibold text-sm text-[#1C1B1C] shadow-2xs"
                      >
                        <HugeiconsIcon icon={Key01Icon} size={16} className="text-neutral-500" />
                        <span>Change Password</span>
                      </button>

                      <button
                        type="button"
                        onClick={startEditing}
                        className="w-full sm:w-auto h-11 px-6 bg-[#2E9DA7] hover:bg-[#25858e] text-white flex justify-center items-center gap-2 rounded-xl active:scale-95 transition-all cursor-pointer font-manrope font-semibold text-sm shadow-[0_2px_8px_rgba(46,157,167,0.25)] hover:shadow-[0_4px_12px_rgba(46,157,167,0.35)]"
                      >
                        <HugeiconsIcon icon={PencilEdit02Icon} size={16} className="text-white" />
                        <span>Edit Profile</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSave} className="w-full flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                          First name
                        </label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          required
                          className="w-full h-11 px-4 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#2E9DA7] focus:ring-2 focus:ring-[#2E9DA7]/15 font-manrope font-medium text-[#1C1B1C] transition-all bg-white"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                          Last name
                        </label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          required
                          className="w-full h-11 px-4 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#2E9DA7] focus:ring-2 focus:ring-[#2E9DA7]/15 font-manrope font-medium text-[#1C1B1C] transition-all bg-white"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                          Email
                        </label>
                        <div className="w-full h-11 px-4 flex items-center border border-neutral-200/80 bg-neutral-50 rounded-xl text-sm font-manrope font-medium text-neutral-500">
                          {email}
                        </div>
                        <span className="font-manrope text-[11px] text-neutral-400">
                          Use the &quot;Change&quot; link on your profile to update your email.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                          Phone number
                        </label>
                        <div className="w-full h-11 px-4 flex items-center gap-2 border border-neutral-200/80 bg-neutral-50 rounded-xl text-sm font-manrope font-medium text-neutral-500">
                          <Image src={`https://flagcdn.com/w20/${formData.countryIso}.png`} alt="Flag" className="w-4 h-3 object-cover rounded-[2px] shrink-0" width={16} height={12} />
                          <span>{displayPhone}</span>
                        </div>
                        <span className="font-manrope text-[11px] text-neutral-400">
                          Use the &quot;Change&quot; link on your profile to update your phone number.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                          My Address
                        </label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full h-11 px-4 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#2E9DA7] focus:ring-2 focus:ring-[#2E9DA7]/15 font-manrope font-medium text-[#1C1B1C] transition-all bg-white"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                          Gender
                        </label>
                        <div className="relative w-full">
                          <select
                            value={formData.gender}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderOption })}
                            className="w-full h-11 px-4 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#2E9DA7] focus:ring-2 focus:ring-[#2E9DA7]/15 appearance-none font-manrope font-medium text-[#1C1B1C] cursor-pointer bg-white transition-all"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                            <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="text-[#45474B]" />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <label className="font-manrope font-semibold text-[11px] leading-4 tracking-wider uppercase text-neutral-500">
                          Date of birth
                        </label>
                        <div className="relative w-full">
                          <input
                            type="date"
                            ref={dateInputRef}
                            value={formData.dateOfBirth}
                            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                            onClick={triggerDatePicker}
                            className="w-full h-11 pl-4 pr-10 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:border-[#2E9DA7] focus:ring-2 focus:ring-[#2E9DA7]/15 font-manrope font-medium text-[#1C1B1C] cursor-pointer bg-white transition-all [&::-webkit-calendar-picker-indicator]:hidden"
                          />
                          <button
                            type="button"
                            onClick={triggerDatePicker}
                            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                          >
                            <HugeiconsIcon icon={Calendar02Icon} size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {formError && (
                      <p className="text-sm text-red-600 font-manrope">{formError}</p>
                    )}

                    <div className="flex flex-row justify-end items-center gap-3 w-full pt-5 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={updateMutation.isPending}
                        className="w-full sm:w-auto h-11 px-6 border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50 flex justify-center items-center rounded-xl active:scale-95 transition-all cursor-pointer font-manrope font-semibold text-sm text-[#1C1B1C] disabled:opacity-50 shadow-2xs"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="w-full sm:w-auto h-11 px-8 bg-[#2E9DA7] hover:bg-[#25858e] flex justify-center items-center rounded-xl active:scale-95 transition-all cursor-pointer font-manrope font-semibold text-sm text-white disabled:opacity-60 shadow-[0_2px_8px_rgba(46,157,167,0.25)] hover:shadow-[0_4px_12px_rgba(46,157,167,0.35)]"
                      >
                        {updateMutation.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="h-[500px] w-full" />

      <Footer />

      {isEmailModalOpen && (
        <ChangeEmailModal currentEmail={email} onClose={() => setIsEmailModalOpen(false)} />
      )}
      {isPhoneModalOpen && (
        <ChangePhoneModal
          currentCountryCode={phoneCountryCode}
          onClose={() => setIsPhoneModalOpen(false)}
        />
      )}

      {/* key={cropSource} remounts so each new pick starts centred at 1x. */}
      <AvatarCropModal
        key={cropSource}
        open={cropSource !== null}
        imageSrc={cropSource}
        baseName={cropBaseName}
        title="Adjust your photo"
        confirmLabel="Use photo"
        onCancel={closeCrop}
        onConfirm={handleCroppedAvatar}
      />
    </div>
  );
}

type ChangeEmailModalProps = {
  currentEmail: string;
  onClose: () => void;
};

function ChangeEmailModal({ currentEmail, onClose }: ChangeEmailModalProps) {
  const requestMutation = useRequestEmailChangeMutation();
  const verifyMutation = useVerifyEmailChangeMutation();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await requestMutation.mutateAsync({ currentPassword, newEmail });
      setStep("otp");
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await verifyMutation.mutateAsync(code);
      onClose();
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  const isPending = requestMutation.isPending || verifyMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#C6C6CB] p-6 w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-200">
        <h3 className="font-manrope font-bold text-xl text-[#020305] mb-1">Change email</h3>
        <p className="font-manrope text-sm text-[#4E5F78] mb-4">
          Current email: <span className="font-medium text-[#1C1B1C]">{currentEmail}</span>
        </p>

        {step === "form" ? (
          <form onSubmit={handleRequest} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">
                Current password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">
                New email
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-600 font-manrope">{error}</p>}

            <div className="flex flex-row justify-end items-center gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 border border-[#C6C6CB] rounded-lg hover:bg-neutral-50 font-manrope font-semibold text-sm text-[#020305] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-manrope font-semibold text-sm cursor-pointer disabled:opacity-60"
              >
                {requestMutation.isPending ? "Sending..." : "Send code"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <p className="font-manrope text-sm text-[#4E5F78]">
              Enter the 4-digit code we sent to <span className="font-medium text-[#1C1B1C]">{newEmail}</span>.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="1234"
                className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm tracking-[6px]"
              />
            </div>

            {error && <p className="text-sm text-red-600 font-manrope">{error}</p>}

            <div className="flex flex-row justify-end items-center gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 border border-[#C6C6CB] rounded-lg hover:bg-neutral-50 font-manrope font-semibold text-sm text-[#020305] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || code.length !== 4}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-manrope font-semibold text-sm cursor-pointer disabled:opacity-60"
              >
                {verifyMutation.isPending ? "Verifying..." : "Verify"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

type ChangePhoneModalProps = {
  currentCountryCode: string;
  onClose: () => void;
};

function ChangePhoneModal({ currentCountryCode, onClose }: ChangePhoneModalProps) {
  const requestMutation = useRequestPhoneChangeMutation();
  const verifyMutation = useVerifyPhoneChangeMutation();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [countryCode, setCountryCode] = useState(currentCountryCode);
  const [nationalNumber, setNationalNumber] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await requestMutation.mutateAsync({ currentPassword, countryCode, nationalNumber });
      setStep("otp");
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await verifyMutation.mutateAsync(code);
      onClose();
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  const isPending = requestMutation.isPending || verifyMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#C6C6CB] p-6 w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-200">
        <h3 className="font-manrope font-bold text-xl text-[#020305] mb-4">Change phone number</h3>

        {step === "form" ? (
          <form onSubmit={handleRequest} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">
                Current password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 w-24">
                <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">
                  Code
                </label>
                <input
                  type="text"
                  required
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  placeholder="+357"
                  className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">
                  New phone number
                </label>
                <input
                  type="tel"
                  required
                  value={nationalNumber}
                  onChange={(e) => setNationalNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="99123456"
                  className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600 font-manrope">{error}</p>}

            <div className="flex flex-row justify-end items-center gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 border border-[#C6C6CB] rounded-lg hover:bg-neutral-50 font-manrope font-semibold text-sm text-[#020305] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-manrope font-semibold text-sm cursor-pointer disabled:opacity-60"
              >
                {requestMutation.isPending ? "Sending..." : "Send code"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <p className="font-manrope text-sm text-[#4E5F78]">
              Enter the 4-digit code we texted to{" "}
              <span className="font-medium text-[#1C1B1C]">
                {countryCode} {nationalNumber}
              </span>
              .
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={4}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="1234"
                className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm tracking-[6px]"
              />
            </div>

            {error && <p className="text-sm text-red-600 font-manrope">{error}</p>}

            <div className="flex flex-row justify-end items-center gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="px-4 py-2 border border-[#C6C6CB] rounded-lg hover:bg-neutral-50 font-manrope font-semibold text-sm text-[#020305] cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || code.length !== 4}
                className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-manrope font-semibold text-sm cursor-pointer disabled:opacity-60"
              >
                {verifyMutation.isPending ? "Verifying..." : "Verify"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
