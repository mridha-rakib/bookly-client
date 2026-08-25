"use client";

import Image from "next/image";
import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

// Components
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EdgeSoftOrbsTop from "@/components/EdgeSoftOrbsTop";
import { countries, Country } from "@/components/CountryData";
import RequireCustomer from "@/components/auth/RequireCustomer";

import { useAuthStore } from "@/lib/auth/store";
import { useChangeMyPasswordMutation } from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";

export default function SettingsPage() {
  return (
    <RequireCustomer>
      <SettingsPageContent />
    </RequireCustomer>
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const timezoneDropdownRef = useRef<HTMLDivElement>(null);

  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;

  // App Install Banner State
  const [showBanner, setShowBanner] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  // General Preferences — session-only display state. No backend field exists for a customer's
  // language/timezone preference, so this is deliberately never persisted (localStorage or
  // otherwise) to avoid implying it is saved to the account.
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Country>({
    name: "United States",
    code: "+1",
    iso: "us",
  });
  const [langSearch, setLangSearch] = useState("");

  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState("(UTC+02:00) Athens, Cyprus");
  const timezones = [
    "(UTC+02:00) Athens, Cyprus",
    "(UTC+00:00) London, United Kingdom",
    "(UTC+01:00) Berlin, Germany",
    "(UTC+05:30) New Delhi, India",
    "(UTC-05:00) New York, United States",
  ];

  // Modals
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);

  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  // Password change — the only Security & Data control with a real backend endpoint.
  const changePasswordMutation = useChangeMyPasswordMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
      closePasswordModal();
      showSuccessToast("Your password has been changed successfully.");
    } catch (error) {
      setPasswordError(toUserMessage(error));
    }
  };

  // Delete Account — no backend lifecycle exists yet (bookings/payments/reviews/audit retention
  // implications are unresolved), so this is deliberately non-functional rather than faking a
  // real deletion and clearing the session.
  const handleDeleteAccountSubmit = () => {
    setIsDeleteModalOpen(false);
    showSuccessToast("Account deletion isn't available yet. Please contact support.");
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden font-poppins">
      {/* Background Soft Orbs */}
      <EdgeSoftOrbsTop size={380} duration={56} intensity={0.85} blend="screen" zIndex={-5} />

      <div className="absolute top-0 left-0 -z-10 w-full pointer-events-none opacity-40">
        <Image src="/designImg/topEllipes.svg" alt="" className="absolute top-0 left-0 w-[500px] h-[500px]" width={24} height={24} />
      </div>

      {/* App Install Banner */}
      {showBanner && (
        <div className="w-full bg-[#96C3CD] text-[#111111] px-3 sm:px-[16px] py-2.5 sm:py-[16px] flex items-center justify-between transition-all duration-300 relative z-50 text-[10px] sm:text-xs md:text-sm font-medium">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-[17px] h-[20px] flex items-center justify-center shrink-0">
              <Image src="/img/smallBLogo.svg" alt="B" className="w-full h-full object-contain" fill />
            </div>
            <span className="truncate">Book local services in Cyprus — instantly, any time</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
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

      {/* Navbar */}
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      {/* Breadcrumbs */}
      <div className="w-full max-w-[1024px] mx-auto px-4 md:px-8 xl:px-0 mt-6 md:mt-[40px]">
        <nav className="flex flex-row items-center p-0 gap-3 h-6">
          <button
            onClick={() => router.push("/")}
            className="font-poppins font-normal text-sm leading-5 tracking-[0.075em] uppercase text-black hover:opacity-70 transition-opacity cursor-pointer"
          >
            Home
          </button>
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 7L14.5 12L9.5 17" stroke="#0C0C0C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-poppins font-normal text-sm leading-5 tracking-[0.075em] uppercase text-black">
            Settings
          </span>
        </nav>
      </div>

      {/* Main Settings Form Container */}
      <main className="flex-grow w-full max-w-[1024px] mx-auto px-4 md:px-8 xl:px-0 mt-[40px] flex flex-col gap-10">

        {/* Header */}
        <div className="w-full flex flex-col items-start p-0 gap-2">
          <h1 className="font-manrope font-bold text-[30px] leading-[36px] text-[#020305]">
            Settings
          </h1>
          <p className="font-manrope font-normal text-base leading-6 text-[#4E5F78]">
            Update your personal information, security, and preferences.
          </p>
        </div>

        {/* Sections Container */}
        <div className="w-full flex flex-col gap-8">

          {/* Linked Accounts Section — not available yet: no OAuth/social-auth capability exists */}
          <section className="bg-white border border-[#C6C6CB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl flex flex-col items-start overflow-hidden">
            <div className="w-full box-border border-b border-[#C6C6CB] px-6 py-4 flex flex-row items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <Image src="/settingsIcons/link.svg" alt="Link" className="w-full h-full object-contain" fill />
              </div>
              <h2 className="font-manrope font-bold text-lg leading-[28px] text-[#020305]">
                Linked Accounts
              </h2>
            </div>

            <div className="w-full p-6 flex flex-col gap-4 max-w-[910px]">
              {[
                { name: "Google", icon: "/settingsIcons/google.svg" },
                { name: "Facebook", icon: "/settingsIcons/facebook.svg" },
                { name: "Apple", icon: "/settingsIcons/apple.svg" },
              ].map((provider) => (
                <div
                  key={provider.name}
                  className="w-full box-border flex flex-row justify-between items-center p-4 border border-[#C6C6CB] rounded-lg"
                >
                  <div className="flex flex-row items-center gap-4">
                    <div className="w-10 h-10 bg-[#EBE7E7] rounded-full flex items-center justify-center shrink-0">
                      <Image src={provider.icon} alt={provider.name} className="w-6 h-6 object-contain" width={24} height={24} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-manrope font-bold text-base text-[#020305]">{provider.name}</span>
                      <span className="font-manrope font-normal text-sm text-[#4E5F78]">Not connected</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => showSuccessToast(`Linking a ${provider.name} account isn't available yet.`)}
                    className="font-manrope font-semibold text-sm text-[#4E5F78] px-3 py-1.5 rounded-md hover:bg-neutral-50 transition-colors"
                  >
                    Link
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Notification Preferences Section — not available yet: no backend preference field
              exists, and nothing on the notification-sending side would consume it. */}
          <section className="bg-white border border-[#C6C6CB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl flex flex-col items-start overflow-hidden">
            <div className="w-full box-border border-b border-[#C6C6CB] px-6 py-4 flex flex-row items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <Image src="/settingsIcons/notification.svg" alt="Notification" className="w-full h-full object-contain" fill />
              </div>
              <h2 className="font-manrope font-bold text-lg leading-[28px] text-[#020305]">
                Notification Preferences
              </h2>
            </div>

            <div className="w-full p-6 flex flex-col gap-6">
              <p className="font-manrope font-normal text-sm text-[#4E5F78]">
                Notification preferences aren&apos;t configurable yet — you&apos;ll always receive booking confirmations and reminders by email.
              </p>

              <div className="w-full flex flex-col gap-4">
                <div className="w-full border-b border-[#C6C6CB] pb-2">
                  <h3 className="font-manrope font-bold text-base text-[#020305]">
                    Appointment Notifications
                  </h3>
                </div>

                {[
                  { label: "Email", description: "Receive booking confirmations and reminders via email." },
                  { label: "Text message", description: "Get real-time updates directly to your phone." },
                ].map((item, i) => (
                  <div
                    key={item.label}
                    className={`flex flex-row justify-between items-center py-4 ${i > 0 ? "border-t border-[#C6C6CB]" : ""}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-manrope font-bold text-base text-[#020305]">{item.label}</span>
                      <span className="font-manrope font-normal text-sm text-[#4E5F78]">{item.description}</span>
                    </div>
                    <div
                      title="Not configurable yet"
                      className="relative w-11 h-6 rounded-full bg-[#76777B] opacity-50 cursor-not-allowed"
                    >
                      <span className="absolute top-0.5 left-[22px] w-5 h-5 bg-white rounded-full" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="w-full flex flex-col gap-4 mt-4">
                <div className="w-full border-b border-[#C6C6CB] pb-2">
                  <h3 className="font-manrope font-bold text-base text-[#020305]">
                    Marketing Notifications
                  </h3>
                </div>

                <div className="flex flex-row justify-between items-center py-4">
                  <div className="flex flex-col">
                    <span className="font-manrope font-bold text-base text-[#020305]">Email</span>
                    <span className="font-manrope font-normal text-sm text-[#4E5F78]">
                      Be the first to know about discounts and local events via email.
                    </span>
                  </div>
                  <div
                    title="Not configurable yet"
                    className="relative w-11 h-6 rounded-full bg-[#76777B] opacity-50 cursor-not-allowed"
                  >
                    <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* General Preferences Section — display-only for this session; no backend field to
              persist to, so nothing is written to storage. */}
          <section className="bg-white border border-[#C6C6CB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl flex flex-col items-start relative z-20">
            <div className="w-full box-border border-b border-[#C6C6CB] px-6 py-4 flex flex-row items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <Image src="/settingsIcons/preferences.svg" alt="Preferences" className="w-full h-full object-contain" fill />
              </div>
              <h2 className="font-manrope font-bold text-lg leading-[28px] text-[#020305]">
                General Preferences
              </h2>
            </div>

            <div className="w-full p-6 flex flex-col sm:flex-row gap-6">

              {/* Language Dropdown Container */}
              <div className="flex-1 flex flex-col gap-2 relative" ref={langDropdownRef}>
                <span className="font-manrope font-bold text-sm text-[#020305]">Language</span>
                <button
                  type="button"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="w-full box-border flex flex-row justify-between items-center p-3 bg-white border border-[#C6C6CB] rounded-lg text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Image src={`https://flagcdn.com/w20/${selectedLang.iso}.png`} alt={selectedLang.name} className="w-5 h-3.5 object-cover shrink-0" width={20} height={12} />
                    <span className="font-manrope font-normal text-base text-[#1C1B1C] truncate">
                      {selectedLang.name}
                    </span>
                  </div>
                  <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4 text-neutral-500" />
                </button>

                {showLangDropdown && (
                  <div className="absolute top-[80px] left-0 w-full max-h-[220px] bg-white border border-[#C6C6CB] rounded-xl shadow-lg z-50 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-[#C6C6CB]">
                      <input
                        type="text"
                        placeholder="Search language..."
                        value={langSearch}
                        onChange={(e) => setLangSearch(e.target.value)}
                        className="w-full h-8 px-2 border border-neutral-200 rounded text-xs focus:outline-none font-manrope"
                      />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {countries
                        .filter(c => c.name.toLowerCase().includes(langSearch.toLowerCase()))
                        .map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSelectedLang(c);
                              setShowLangDropdown(false);
                              setLangSearch("");
                            }}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 text-left w-full transition-colors cursor-pointer"
                          >
                            <Image src={`https://flagcdn.com/w20/${c.iso}.png`} alt={c.name} className="w-5 h-3.5 object-cover shrink-0" width={20} height={12} />
                            <span className="font-manrope font-normal text-sm text-[#1C1B1C]">
                              {c.name}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Timezone Dropdown Container */}
              <div className="flex-1 flex flex-col gap-2 relative" ref={timezoneDropdownRef}>
                <span className="font-manrope font-bold text-sm text-[#020305]">Timezone</span>
                <button
                  type="button"
                  onClick={() => setShowTimezoneDropdown(!showTimezoneDropdown)}
                  className="w-full box-border flex flex-row justify-between items-center p-3 bg-white border border-[#C6C6CB] rounded-lg text-left cursor-pointer"
                >
                  <span className="font-manrope font-normal text-base text-[#1C1B1C] truncate">
                    {selectedTimezone}
                  </span>
                  <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4 text-neutral-500" />
                </button>

                {showTimezoneDropdown && (
                  <div className="absolute top-[80px] left-0 w-full bg-white border border-[#C6C6CB] rounded-xl shadow-lg z-50 overflow-hidden py-1">
                    {timezones.map((tz, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedTimezone(tz);
                          setShowTimezoneDropdown(false);
                        }}
                        className="px-4 py-2 hover:bg-neutral-50 text-left w-full transition-colors cursor-pointer font-manrope font-normal text-sm text-[#1C1B1C]"
                      >
                        {tz}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </section>

          {/* Security & Data Section */}
          <section className="bg-white border border-[#C6C6CB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl flex flex-col items-start overflow-hidden">
            <div className="w-full box-border border-b border-[#C6C6CB] px-6 py-4 flex flex-row items-center gap-2">
              <div className="w-4 h-5 flex items-center justify-center">
                <Image src="/settingsIcons/security.svg" alt="Security" className="w-full h-full object-contain" fill />
              </div>
              <h2 className="font-manrope font-bold text-lg leading-[28px] text-[#020305]">
                Security & Data
              </h2>
            </div>

            <div className="w-full p-6 flex flex-col gap-6">

              {/* Password */}
              <div className="flex flex-row justify-between items-center gap-4">
                <div className="flex-grow flex flex-col">
                  <span className="font-manrope font-bold text-sm text-[#020305]">Password</span>
                  <span className="font-manrope font-normal text-sm text-[#4E5F78]">
                    Ensure your account is using a long, random password to stay secure.
                  </span>
                </div>
                <button
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="box-border flex flex-row justify-center items-center px-4 py-2 bg-white border border-[#C6C6CB] hover:bg-neutral-50 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-lg font-manrope font-semibold text-sm text-[#020305] whitespace-nowrap cursor-pointer"
                >
                  Change Password
                </button>
              </div>

              {/* Delete Account */}
              <div className="flex flex-row justify-between items-center gap-4 border-t border-[#C6C6CB] pt-6">
                <div className="flex-grow flex flex-col">
                  <span className="font-manrope font-bold text-sm text-[#BA1A1A]">Delete Account</span>
                  <span className="font-manrope font-normal text-sm text-[#4E5F78]">
                    Permanently delete your account and all of its associated data. This action cannot be undone.
                  </span>
                </div>
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex flex-row justify-center items-center px-4 py-2 bg-[#BA1A1A] hover:bg-red-700 shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-lg font-manrope font-semibold text-sm text-white whitespace-nowrap cursor-pointer"
                >
                  Delete account
                </button>
              </div>

            </div>
          </section>

        </div>
      </main>

      {/* Spacing Gap */}
      <div className="h-[200px]" />

      {/* Footer */}
      <Footer />

      {/* Change Password Dialog Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#C6C6CB] p-6 w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-manrope font-bold text-xl text-[#020305] mb-4">
              Change Password
            </h3>
            <form onSubmit={handlePasswordChangeSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">Current Password</label>
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
                <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600 font-manrope">{passwordError}</p>
              )}

              <div className="flex flex-row justify-end items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={changePasswordMutation.isPending}
                  className="px-4 py-2 border border-[#C6C6CB] rounded-lg hover:bg-neutral-50 font-manrope font-semibold text-sm text-[#020305] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="px-4 py-2 bg-[#1A1A1A] hover:bg-black text-white rounded-lg font-manrope font-semibold text-sm cursor-pointer disabled:opacity-60"
                >
                  {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Dialog Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[300] p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#C6C6CB] p-6 w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="font-manrope font-bold text-xl text-[#BA1A1A] mb-2">
              Delete Account
            </h3>
            <p className="font-manrope font-normal text-sm text-[#4E5F78] mb-6">
              Are you sure you want to delete your account? This action is permanent and cannot be undone. All of your appointments, profile data, and settings will be lost.
            </p>
            <div className="flex flex-row justify-end items-center gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-[#C6C6CB] rounded-lg hover:bg-neutral-50 font-manrope font-semibold text-sm text-[#020305] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccountSubmit}
                className="px-4 py-2 bg-[#BA1A1A] hover:bg-red-700 text-white rounded-lg font-manrope font-semibold text-sm cursor-pointer"
              >
                Yes, delete my account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Info Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1A1A] text-white py-3.5 px-5 rounded-xl shadow-lg z-[1000] flex items-center gap-3 border border-white/10 max-w-[360px]">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} className="text-[#2E9DA7] shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
