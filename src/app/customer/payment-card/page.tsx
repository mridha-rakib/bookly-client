"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Elements } from "@stripe/react-stripe-js";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, SquareLock01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EdgeSoftOrbsTop from "@/components/EdgeSoftOrbsTop";

import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import { paymentsApi, type SavedCardStatus } from "@/lib/api/payments";
import { getStripe } from "@/lib/payments/stripe-client";
import { CardCollectionForm } from "@/components/payments/CardCollectionForm";

export default function PaymentCardPage() {
  return (
    <RequireCustomer>
      <PaymentCardPageContent />
    </RequireCustomer>
  );
}

function PaymentCardPageContent() {
  const router = useRouter();

  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  const [cardStatus, setCardStatus] = useState<SavedCardStatus | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    paymentsApi
      .getSavedCardStatus()
      .then(setCardStatus)
      .catch(() => setLoadError(true));
  }, []);

  const hasSavedCard = Boolean(cardStatus?.hasSavedCard);

  const handleSaved = (card: { brand: string; last4: string }) => {
    setCardStatus({ hasSavedCard: true, card: { ...card, expMonth: 0, expYear: 0 } });
    setIsReplacing(false);
    setToastMessage(hasSavedCard ? "Card replaced successfully." : "Card added successfully.");
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden font-poppins">
      <EdgeSoftOrbsTop size={380} duration={56} intensity={0.85} blend="screen" zIndex={-5} />

      <div className="absolute top-0 left-0 -z-10 w-full pointer-events-none opacity-40">
        <Image src="/designImg/topEllipes.svg" alt="" className="absolute top-0 left-0 w-[500px] h-[500px]" width={24} height={24} />
      </div>

      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-grow w-full max-w-[1440px] mx-auto px-4 md:px-8 xl:px-[130px] pt-8 pb-24 z-10">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#808080] uppercase tracking-wider mb-8">
          <span className="cursor-pointer hover:text-black transition-colors" onClick={() => router.push("/")}>Home</span>
          <span>&gt;</span>
          <span className="text-[#1C1B1C]">Payment Card</span>
        </div>

        <div className="w-full flex flex-col lg:flex-row gap-[102px] items-start">
          <div className="w-full lg:w-[259px] shrink-0 flex flex-col gap-2">
            <h1 className="font-manrope font-extrabold text-[30px] leading-[36px] tracking-[-0.75px] text-[#1C1B1C] whitespace-nowrap">
              Payment card
            </h1>
            <p className="font-manrope font-normal text-[16px] leading-6 text-[#45474B] whitespace-nowrap">
              Manage your saved payment card.
            </p>
          </div>

          <div className="flex-1 w-full max-w-[717px] flex flex-col items-start gap-5 min-h-[500px] lg:mt-[108px]">
            <h2 className="w-full md:w-auto h-9 font-manrope font-medium text-[24px] leading-[36px] flex items-center text-[#1C1B1C] flex-none order-0 flex-grow-0 whitespace-nowrap">
              {hasSavedCard ? "Your saved card" : "Add payment card information"}
            </h2>

            {loadError && (
              <p className="text-sm text-red-600">Your saved card could not be loaded right now. Please try again shortly.</p>
            )}

            {hasSavedCard && (
              <div className="w-full flex flex-row items-start gap-3 bg-[#FDF4E6] border border-[#F5E6D3]/60 rounded-xl p-4 text-sm text-[#111111]/80 select-none">
                <HugeiconsIcon icon={InformationCircleIcon} className="w-5 h-5 text-[#4F80E1] shrink-0 mt-0.5" />
                <span className="font-poppins font-normal text-xs sm:text-[13px] text-[#111111] leading-relaxed">
                  This card secures your bookings for deposit, no-show, and late-cancellation charges. Removing a
                  saved card isn&apos;t supported yet — to use a different card, replace it below.
                </span>
              </div>
            )}

            {hasSavedCard && cardStatus?.card && (
              <div className="w-full flex flex-col items-start gap-4">
                <span className="text-sm font-medium tracking-[1px] uppercase text-[#111111]">Primary card</span>

                <div className="w-full h-[76px] bg-white border border-[#111111]/60 rounded-xl px-5 py-3 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-[51.62px] h-[36px] bg-[#F5F4EE] rounded flex items-center justify-center p-2 shrink-0 select-none uppercase text-[10px] font-extrabold text-[#1A1F71]">
                      {cardStatus.card.brand}
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-base font-semibold text-[#000000] font-poppins leading-none">
                        •••• {cardStatus.card.last4}
                      </span>
                      {cardStatus.card.expMonth > 0 && (
                        <span className="text-[12px] font-medium text-[#111111] font-poppins">
                          Expires {String(cardStatus.card.expMonth).padStart(2, "0")}/{String(cardStatus.card.expYear).slice(-2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <HugeiconsIcon icon={SquareLock01Icon} size={24} className="text-[#0C0C0C]" />
                </div>

                {!isReplacing && (
                  <div className="w-full flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={() => setIsReplacing(true)}
                      className="h-11 px-5 flex items-center justify-center rounded-lg text-sm font-semibold bg-[#8EBAC5] hover:bg-[#72A6B2] text-white cursor-pointer transition-colors"
                    >
                      Replace card
                    </button>
                  </div>
                )}
              </div>
            )}

            {(!hasSavedCard || isReplacing) && (
              <div className="w-full flex flex-col gap-5 mt-4">
                <div className="w-full bg-white border border-[#F1F5F9] rounded-2xl p-6 shadow-sm flex flex-col gap-6">
                  <p className="text-sm sm:text-base font-normal text-[#111111] font-poppins leading-relaxed">
                    {hasSavedCard
                      ? "Enter your new card details below. Your new card takes over immediately."
                      : "Enter your card details below. Your card is stored securely by Stripe — Bookly never sees your card number or security code."}
                  </p>
                  <hr className="border-[#111111]/20 w-full" />
                  <Elements stripe={getStripe()}>
                    <CardCollectionForm onSaved={handleSaved} onCancel={() => (hasSavedCard ? setIsReplacing(false) : router.push("/"))} />
                  </Elements>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {showSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-[#1A1A1A] text-white py-3.5 px-5 rounded-xl shadow-lg z-[1000] flex items-center gap-3 border border-white/10">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} className="text-[#2E9DA7]" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
