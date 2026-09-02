"use client";

import Image from "next/image";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

// Components
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EdgeSoftOrbsTop from "@/components/EdgeSoftOrbsTop";
import RequireCustomer from "@/components/auth/RequireCustomer";

import { useAuthStore } from "@/lib/auth/store";
import {
  useChangeMyPasswordMutation,
  useCurrentUserQuery,
  useDeleteMyAccountMutation,
  useUpdateMyProfileMutation,
} from "@/lib/auth/hooks";
import type { NotificationPreferences } from "@/lib/api/auth";
import { toUserMessage } from "@/lib/auth/messages";

/** The customer-configurable optional notification channels (24h appointment reminder + the
 * marketing-email opt-in). All persisted on `profile.notifications`. */
type NotificationChannel = keyof NotificationPreferences;

/** Accessible on/off switch reused by every notification-preference row (appointment reminders
 * and marketing email). Reflects server state only — never local optimistic CSS. Disabled while
 * the current-user query is still loading or a mutation for this row is in flight. */
function ReminderToggle({
  checked,
  disabled,
  busy,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-[#2E9DA7]" : "bg-[#C6C6CB]"}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  return (
    <RequireCustomer>
      <SettingsPageContent />
    </RequireCustomer>
  );
}

function SettingsPageContent() {
  const router = useRouter();

  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;

  // App Install Banner State
  const [showBanner, setShowBanner] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  // General Preferences — neither control here is a configurable customer preference. Language is
  // English-only (no localization layer). Timezone is not a customer-owned setting at all: every
  // appointment is shown in its venue's local timezone (the authoritative Booking.schedule
  // timezone), so this row only explains that rule — it is not persisted anywhere.

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

  // Notification preferences — the ONLY notification controls with a real backend. Authoritative
  // state is profile.notifications from ["auth","me"]; a toggle performs a real PATCH /auth/me
  // and the mutation writes the full server payload back into that same cache. These govern only
  // OPTIONAL mail (the 24h appointment reminder and the marketing-email opt-in) — they can never
  // suppress booking confirmations, cancellations, invoices, no-show notices, or security mail.
  const meQuery = useCurrentUserQuery();
  const updateProfileMutation = useUpdateMyProfileMutation();
  const [pendingChannel, setPendingChannel] = useState<NotificationChannel | null>(null);
  const reminderPrefs = meQuery.data?.profile?.notifications;

  const handleNotificationToggle = (channel: NotificationChannel, next: boolean) => {
    if (updateProfileMutation.isPending) {
      return;
    }
    setPendingChannel(channel);
    updateProfileMutation.mutate(
      { notifications: { [channel]: next } },
      {
        onSuccess: () =>
          showSuccessToast(
            channel === "marketingEmail"
              ? "Your marketing email preference has been updated."
              : "Your reminder preferences have been updated.",
          ),
        onError: (error) => showSuccessToast(toUserMessage(error)),
        onSettled: () => setPendingChannel(null),
      },
    );
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
              <Image src="/img/smallBLogo.svg" alt="B" className="w-full h-full object-contain" width={17} height={20} />
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
                <Image src="/settingsIcons/link.svg" alt="Link" className="w-full h-full object-contain" width={20} height={20} />
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

          {/* Notification Preferences Section — the Appointment reminder Email row and the
              Marketing Email row are real, server-backed toggles (PATCH /auth/me →
              profile.notifications, written back into the ["auth","me"] cache). Only the SMS
              reminder row stays disabled / "Coming soon" (no SMS reminder sender yet). */}
          <section className="bg-white border border-[#C6C6CB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl flex flex-col items-start overflow-hidden">
            <div className="w-full box-border border-b border-[#C6C6CB] px-6 py-4 flex flex-row items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <Image src="/settingsIcons/notification.svg" alt="Notification" className="w-full h-full object-contain" width={20} height={20} />
              </div>
              <h2 className="font-manrope font-bold text-lg leading-[28px] text-[#020305]">
                Notification Preferences
              </h2>
            </div>

            <div className="w-full p-6 flex flex-col gap-6">
              <p className="font-manrope font-normal text-sm text-[#4E5F78]">
                Choose which optional emails you&apos;d like to receive. Booking confirmations, cancellations and important account messages are always sent.
              </p>

              <div className="w-full flex flex-col gap-4">
                <div className="w-full border-b border-[#C6C6CB] pb-2">
                  <h3 className="font-manrope font-bold text-base text-[#020305]">
                    Appointment Reminders
                  </h3>
                </div>

                {meQuery.isError && (
                  <p className="font-manrope font-normal text-sm text-[#BA1A1A]">
                    We couldn&apos;t load your reminder preferences. Refresh to try again.
                  </p>
                )}

                <div className="flex flex-row justify-between items-center py-4">
                  <div className="flex flex-col">
                    <span className="font-manrope font-bold text-base text-[#020305]">Email</span>
                    <span className="font-manrope font-normal text-sm text-[#4E5F78]">
                      A reminder email 24 hours before your appointment.
                    </span>
                  </div>
                  <ReminderToggle
                    label="Appointment reminder email"
                    checked={reminderPrefs?.appointmentReminderEmail ?? false}
                    disabled={!meQuery.isSuccess || updateProfileMutation.isPending}
                    busy={pendingChannel === "appointmentReminderEmail"}
                    onChange={(next) => handleNotificationToggle("appointmentReminderEmail", next)}
                  />
                </div>

                <div className="flex flex-row justify-between items-center py-4 border-t border-[#C6C6CB]">
                  <div className="flex flex-col">
                    <span className="font-manrope font-bold text-base text-[#020305]">Text message</span>
                    <span className="font-manrope font-normal text-sm text-[#4E5F78]">
                      A reminder text 24 hours before your appointment. Coming soon.
                    </span>
                  </div>
                  <ReminderToggle
                    label="Appointment reminder text message"
                    checked={reminderPrefs?.appointmentReminderSms ?? false}
                    disabled
                    busy={false}
                    onChange={() => undefined}
                  />
                </div>
              </div>

              <div className="w-full flex flex-col gap-4 mt-4">
                <div className="w-full border-b border-[#C6C6CB] pb-2">
                  <h3 className="font-manrope font-bold text-base text-[#020305]">
                    Marketing Notifications
                  </h3>
                </div>

                {/* Marketing Email — a real, server-backed opt-in (M3C). Same wiring as the
                    Appointment reminder Email row: PATCH /auth/me { notifications: { marketingEmail } },
                    the mutation writes the fresh server payload into the ["auth","me"] cache, and
                    an error leaves the cache untouched so the switch re-renders from server truth
                    (natural revert). Default OFF server-side. */}
                <div className="flex flex-row justify-between items-center py-4">
                  <div className="flex flex-col">
                    <span className="font-manrope font-bold text-base text-[#020305]">Email</span>
                    <span className="font-manrope font-normal text-sm text-[#4E5F78]">
                      Occasional Bookly news, offers, and product updates. Booking confirmations,
                      reminders you&apos;ve enabled, and account messages are managed separately.
                    </span>
                  </div>
                  <ReminderToggle
                    label="Marketing email"
                    checked={reminderPrefs?.marketingEmail ?? false}
                    disabled={!meQuery.isSuccess || updateProfileMutation.isPending}
                    busy={pendingChannel === "marketingEmail"}
                    onChange={(next) => handleNotificationToggle("marketingEmail", next)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* General Preferences Section — both rows are disabled, read-only explanatory fields,
              not configurable customer preferences: Language (English-only) and Timezone
              (appointments always shown in the venue's local timezone). Nothing here persists. */}
          <section className="bg-white border border-[#C6C6CB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl flex flex-col items-start relative z-20">
            <div className="w-full box-border border-b border-[#C6C6CB] px-6 py-4 flex flex-row items-center gap-2">
              <div className="w-5 h-5 flex items-center justify-center">
                <Image src="/settingsIcons/preferences.svg" alt="Preferences" className="w-full h-full object-contain" width={20} height={20} />
              </div>
              <h2 className="font-manrope font-bold text-lg leading-[28px] text-[#020305]">
                General Preferences
              </h2>
            </div>

            <div className="w-full p-6 flex flex-col sm:flex-row gap-6">

              {/* Language — not a configurable control: the customer experience is English-only
                  and nothing consumes a stored language preference, so this is a read-only,
                  disabled field rather than a picker (mirrors the Notification Preferences
                  "not configurable yet" treatment). */}
              <div className="flex-1 flex flex-col gap-2">
                <span className="font-manrope font-bold text-sm text-[#020305]">Language</span>
                <input
                  type="text"
                  value="English"
                  readOnly
                  disabled
                  aria-label="Language"
                  title="Not configurable yet"
                  className="w-full box-border p-3 bg-neutral-50 border border-[#C6C6CB] rounded-lg font-manrope font-normal text-base text-[#4E5F78] cursor-not-allowed"
                />
                <span className="font-manrope font-normal text-xs text-[#4E5F78]">
                  Language selection isn&apos;t available yet — the customer experience is currently in English.
                </span>
              </div>

              {/* Timezone — not a configurable control: appointment times are always shown in the
                  venue's local timezone (Booking.schedule.timezone), so this is a read-only,
                  disabled field that states the rule rather than a picker (mirrors the Language
                  treatment above). Nothing here is persisted. */}
              <div className="flex-1 flex flex-col gap-2">
                <span className="font-manrope font-bold text-sm text-[#020305]">Timezone</span>
                <input
                  type="text"
                  value="Venue local timezone"
                  readOnly
                  disabled
                  aria-label="Timezone"
                  title="Not configurable"
                  className="w-full box-border p-3 bg-neutral-50 border border-[#C6C6CB] rounded-lg font-manrope font-normal text-base text-[#4E5F78] cursor-not-allowed"
                />
                <span className="font-manrope font-normal text-xs text-[#4E5F78]">
                  Appointment times are shown in the venue&apos;s local timezone.
                </span>
              </div>

            </div>
          </section>

          {/* Security & Data Section */}
          <section className="bg-white border border-[#C6C6CB] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-xl flex flex-col items-start overflow-hidden">
            <div className="w-full box-border border-b border-[#C6C6CB] px-6 py-4 flex flex-row items-center gap-2">
              <div className="w-4 h-5 flex items-center justify-center">
                <Image src="/settingsIcons/security.svg" alt="Security" className="w-full h-full object-contain" width={16} height={20} />
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

              {/* Delete Account — soft delete + anonymization (DELETE /auth/me). Personal
                  details are removed, the email is freed and every session ends; bookings and
                  their payment history are retained in anonymized form. Blocked while an
                  upcoming booking exists. */}
              <div className="flex flex-row justify-between items-center gap-4 border-t border-[#C6C6CB] pt-6">
                <div className="flex-grow flex flex-col">
                  <span className="font-manrope font-bold text-sm text-[#020305]">Delete Account</span>
                  <span className="font-manrope font-normal text-sm text-[#4E5F78]">
                    Permanently close your account. Your personal details are removed; your bookings
                    and receipts are kept in anonymized form as required. This can&apos;t be undone.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="box-border flex flex-row justify-center items-center px-4 py-2 bg-[#BA1A1A] hover:bg-[#a01414] shadow-[0px_1px_2px_rgba(0,0,0,0.05)] rounded-lg font-manrope font-semibold text-sm text-white whitespace-nowrap cursor-pointer"
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

      {/* Delete Account Dialog Modal */}
      {isDeleteModalOpen && <DeleteAccountModal onClose={() => setIsDeleteModalOpen(false)} />}

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

/**
 * Account-closure confirmation dialog. Reuses the same modal recipe as the Change Password /
 * Change Email dialogs (inline overlay, local state, `toUserMessage` inline errors,
 * `isPending`-gated buttons). Requires the current password AND the typed word "DELETE". On
 * success it navigates to /account-closed while still authenticated — that page performs the
 * auth teardown, avoiding a redirect race with RequireCustomer on this page.
 */
function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const deleteMutation = useDeleteMyAccountMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [error, setError] = useState("");

  const canSubmit =
    currentPassword.length > 0 && confirmationText === "DELETE" && !deleteMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      await deleteMutation.mutateAsync({ currentPassword, confirmationText });
      router.replace("/account-closed");
    } catch (err) {
      setError(toUserMessage(err));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-[#C6C6CB] p-6 w-full max-w-[480px] animate-in fade-in zoom-in-95 duration-200">
        <h3 className="font-manrope font-bold text-xl text-[#020305] mb-1">Delete account</h3>
        <p className="font-manrope text-sm text-[#4E5F78] mb-4">
          This permanently closes your account and signs you out. Your bookings and receipts are
          kept in anonymized form as required. This can&apos;t be undone.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-manrope font-semibold text-xs text-[#4E5F78] uppercase">
              Current Password
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
              Type DELETE to confirm
            </label>
            <input
              type="text"
              required
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="w-full h-11 px-3 border border-[#C6C6CB] rounded-lg focus:outline-none focus:border-[#0CC0DF] font-manrope text-sm tracking-[2px]"
            />
          </div>

          {error && <p className="text-sm text-red-600 font-manrope">{error}</p>}

          <div className="flex flex-row justify-end items-center gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 border border-[#C6C6CB] rounded-lg hover:bg-neutral-50 font-manrope font-semibold text-sm text-[#020305] cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 bg-[#BA1A1A] hover:bg-[#a01414] text-white rounded-lg font-manrope font-semibold text-sm cursor-pointer disabled:opacity-60"
            >
              {deleteMutation.isPending ? "Closing account..." : "Delete account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
