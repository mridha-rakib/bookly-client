"use client";

import Image from "next/image";
import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

// Components
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AddToHomeScreenButton from "@/components/landing-page/AddToHomeScreenButton";
import EdgeSoftOrbsTop from "@/components/EdgeSoftOrbsTop";
import { Spinner } from "@/components/ui/spinner";

import { countries } from "@/components/CountryData";
import ProfileAvatar from "@/components/ProfileAvatar";
import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import {
  useCurrentUserQuery,
  useRequestEmailChangeMutation,
  useRequestPhoneChangeMutation,
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

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState("");
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  // Avatar is a browser-only preview — no backend avatar-upload capability exists yet, so it is
  // never sent to the server and never claimed to be account data. See Navbar.tsx for the reader.
  const [avatar, setAvatar] = useState(
    () =>
      (typeof window !== "undefined" && localStorage.getItem("customerAvatarUrl")) ||
      "/img/authImg.png",
  );
  const persistAvatar = (newAvatar: string) => {
    setAvatar(newAvatar);
    if (typeof window !== "undefined") {
      localStorage.setItem("customerAvatarUrl", newAvatar);
      window.dispatchEvent(new Event("profileUpdate"));
    }
  };

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
            <div className="w-full box-border flex flex-col md:flex-row items-start p-6 md:p-8 gap-8 bg-white border border-[#C6C6CB] rounded-xl shadow-[0px_2px_4px_rgba(0,0,0,0.05)]">
              <ProfileAvatar avatarUrl={avatar} onAvatarChange={persistAvatar} />

              <div className="flex-1 flex flex-col gap-8 w-full">
                {!isEditing ? (
                  <div className="w-full flex flex-col gap-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 w-full max-w-[682px]">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Full name
                        </span>
                        <span className="font-manrope font-medium text-[18px] leading-7 text-[#1C1B1C] break-words">
                          {displayFullName}
                        </span>
                      </div>

                      <div className="flex flex-col items-start gap-1">
                        <span className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Email address
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-manrope font-medium text-[18px] leading-7 text-[#1C1B1C] break-words">
                            {email}
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsEmailModalOpen(true)}
                            className="font-manrope font-semibold text-xs text-[#0C7C93] hover:underline cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-1">
                        <span className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Phone number
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-manrope font-medium text-[18px] leading-7 text-[#1C1B1C] flex items-center gap-1.5">
                            <Image src={`https://flagcdn.com/w20/${formData.countryIso}.png`} alt="Flag" className="w-4 h-3 object-cover shrink-0" width={16} height={12} />
                            <span>{displayPhone}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsPhoneModalOpen(true)}
                            className="font-manrope font-semibold text-xs text-[#0C7C93] hover:underline cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-1">
                        <span className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          My address
                        </span>
                        <span className="font-manrope font-medium text-[18px] leading-7 text-[#1C1B1C] break-words">
                          {profile.address || "Not set"}
                        </span>
                      </div>

                      <div className="flex flex-col items-start gap-1">
                        <span className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Gender
                        </span>
                        <span className="font-manrope font-medium text-[18px] leading-7 text-[#1C1B1C]">
                          {toDisplayGender(profile.gender)}
                        </span>
                      </div>

                      <div className="flex flex-col items-start gap-1">
                        <span className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Date of birth
                        </span>
                        <span className="font-manrope font-medium text-[18px] leading-7 text-[#1C1B1C]">
                          {formatDateDisplay(profile.dateOfBirth ?? "")}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-row justify-end items-center gap-4 w-full pt-4 border-t border-neutral-100 max-w-[682px]">
                      <button
                        onClick={startEditing}
                        style={{
                          background: "linear-gradient(0deg, rgba(12, 192, 223, 0.2), rgba(12, 192, 223, 0.2)), #8EBAC5"
                        }}
                        className="w-[132px] h-[46px] flex justify-center items-center rounded-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="font-manrope font-semibold text-base leading-6 text-[#111111]">
                          Edit Profile
                        </span>
                      </button>

                      <button
                        onClick={() => router.push("/customer/settings")}
                        className="w-[171.59px] h-[46px] box-border border border-[#C6C6CB] flex justify-center items-center rounded-lg hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="font-manrope font-semibold text-base leading-6 text-[#1C1B1C]">
                          Change Password
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSave} className="w-full flex flex-col gap-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 w-full max-w-[682px]">
                      <div className="flex flex-col gap-1 w-full">
                        <label className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          First name
                        </label>
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          required
                          className="w-full h-11 px-4 border border-[#C6C6CB] rounded-lg text-sm focus:outline-none focus:border-[#8EBAC5] font-manrope font-medium text-[#1C1B1C]"
                        />
                      </div>

                      <div className="flex flex-col gap-1 w-full">
                        <label className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Last name
                        </label>
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          required
                          className="w-full h-11 px-4 border border-[#C6C6CB] rounded-lg text-sm focus:outline-none focus:border-[#8EBAC5] font-manrope font-medium text-[#1C1B1C]"
                        />
                      </div>

                      <div className="flex flex-col gap-1 w-full">
                        <label className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Email
                        </label>
                        <div className="w-full h-11 px-4 flex items-center border border-[#E5E5E5] bg-[#F7F7F7] rounded-lg text-sm font-manrope font-medium text-[#76777B]">
                          {email}
                        </div>
                        <span className="font-manrope text-[11px] text-[#76777B]">
                          Use the &quot;Change&quot; link on your profile to update your email.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 w-full">
                        <label className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Phone number
                        </label>
                        <div className="w-full h-11 px-4 flex items-center gap-1.5 border border-[#E5E5E5] bg-[#F7F7F7] rounded-lg text-sm font-manrope font-medium text-[#76777B]">
                          <Image src={`https://flagcdn.com/w20/${formData.countryIso}.png`} alt="Flag" className="w-4 h-3 object-cover shrink-0" width={16} height={12} />
                          <span>{displayPhone}</span>
                        </div>
                        <span className="font-manrope text-[11px] text-[#76777B]">
                          Use the &quot;Change&quot; link on your profile to update your phone number.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 w-full">
                        <label className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          My Address
                        </label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full h-11 px-4 border border-[#C6C6CB] rounded-lg text-sm focus:outline-none focus:border-[#8EBAC5] font-manrope font-medium text-[#1C1B1C]"
                        />
                      </div>

                      <div className="flex flex-col gap-1 w-full">
                        <label className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Gender
                        </label>
                        <div className="relative w-full">
                          <select
                            value={formData.gender}
                            onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderOption })}
                            className="w-full h-11 px-4 border border-[#C6C6CB] rounded-lg text-sm focus:outline-none focus:border-[#8EBAC5] appearance-none font-manrope font-medium text-[#1C1B1C] cursor-pointer"
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

                      <div className="flex flex-col gap-1 w-full">
                        <label className="font-manrope font-semibold text-[12px] leading-4 tracking-[0.6px] uppercase text-[#45474B]">
                          Date of birth
                        </label>
                        <div className="relative w-full">
                          <input
                            type="date"
                            ref={dateInputRef}
                            value={formData.dateOfBirth}
                            onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                            onClick={triggerDatePicker}
                            className="w-full h-11 pl-4 pr-10 border border-[#C6C6CB] rounded-lg text-sm focus:outline-none focus:border-[#8EBAC5] font-manrope font-medium text-[#1C1B1C] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden"
                          />
                          <button
                            type="button"
                            onClick={triggerDatePicker}
                            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center text-[#45474B] hover:text-[#111111]"
                          >
                            <HugeiconsIcon icon={Calendar02Icon} size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {formError && (
                      <p className="text-sm text-red-600 font-manrope max-w-[682px]">{formError}</p>
                    )}

                    <div className="flex flex-row justify-end items-center gap-4 w-full pt-4 border-t border-neutral-100 max-w-[682px]">
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={updateMutation.isPending}
                        className="h-[46px] px-6 border border-[#C6C6CB] flex justify-center items-center rounded-lg hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer font-manrope font-semibold text-base text-[#1C1B1C] disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        style={{
                          background: "linear-gradient(0deg, rgba(12, 192, 223, 0.2), rgba(12, 192, 223, 0.2)), #8EBAC5"
                        }}
                        className="h-[46px] px-8 flex justify-center items-center rounded-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer font-manrope font-semibold text-base text-[#111111] disabled:opacity-60"
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
