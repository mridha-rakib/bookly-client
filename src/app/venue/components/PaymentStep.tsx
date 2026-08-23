"use client";

import React, { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock01Icon } from "@hugeicons/core-free-icons";
import { Elements } from "@stripe/react-stripe-js";

import { paymentsApi, type SavedCardStatus } from "@/lib/api/payments";
import { getStripe } from "@/lib/payments/stripe-client";
import { CardCollectionForm } from "@/components/payments/CardCollectionForm";

type BookingStep = "addons" | "professionals" | "time" | "payment" | "confirmed" | null;

interface PaymentStepProps {
  hasSavedCard: boolean;
  setHasSavedCard: (val: boolean) => void;
  isReplacingCard: boolean;
  setIsReplacingCard: (val: boolean) => void;
  setBookingStep: (step: BookingStep) => void;
  notes: string;
  setNotes: (val: string) => void;
}

export default function PaymentStep({
  hasSavedCard,
  setHasSavedCard,
  isReplacingCard,
  setIsReplacingCard,
  setBookingStep,
  notes,
  setNotes,
}: PaymentStepProps) {
  const [cardStatus, setCardStatus] = useState<SavedCardStatus | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    paymentsApi
      .getSavedCardStatus()
      .then((status) => {
        setCardStatus(status);
        setHasSavedCard(status.hasSavedCard);
      })
      .catch(() => setLoadError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaved = (card: { brand: string; last4: string }) => {
    setCardStatus({ hasSavedCard: true, card: { ...card, expMonth: 0, expYear: 0 } });
    setHasSavedCard(true);
    setIsReplacingCard(false);
  };

  return (
    <div className="flex flex-col w-full lg:w-[714px] font-manrope">
      <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C] mb-8 font-poppins">Payment</h1>

      {loadError && (
        <p className="text-sm text-red-600 mb-4">
          Payments could not be loaded right now. Please try again shortly.
        </p>
      )}

      {hasSavedCard && cardStatus?.card && (
        <div className="flex flex-col w-full mb-6">
          <span className="text-xs font-bold text-[#16123E] tracking-widest uppercase mb-3">Primary Card</span>
          <div className="border border-[#ECEBEF] rounded-xl p-5 flex items-center justify-between bg-white shadow-sm w-full">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 bg-[#1A1F71] text-white text-xs font-extrabold flex items-center justify-center rounded uppercase tracking-wider">
                {cardStatus.card.brand}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-base font-bold text-[#16123E]">•••• •••• •••• {cardStatus.card.last4}</span>
                {cardStatus.card.expMonth > 0 && (
                  <span className="text-xs text-[#5E598B]">
                    Expires {String(cardStatus.card.expMonth).padStart(2, "0")}/{String(cardStatus.card.expYear).slice(-2)}
                  </span>
                )}
              </div>
            </div>
            <HugeiconsIcon icon={SquareLock01Icon} size={20} className="text-[#5E598B]" />
          </div>

          {!isReplacingCard && (
            <div className="flex items-center justify-end gap-3 mt-4 w-full">
              <button
                onClick={() => setBookingStep("time")}
                className="px-5 py-2.5 border border-neutral-300 rounded-lg text-sm font-semibold hover:bg-neutral-50 cursor-pointer text-[#1C1B1C]"
              >
                Cancel
              </button>
              <button
                onClick={() => setIsReplacingCard(true)}
                className="px-5 py-2.5 bg-[#2E9DA7] text-white rounded-lg text-sm font-semibold hover:opacity-90 cursor-pointer transition-opacity"
              >
                Replace card
              </button>
            </div>
          )}
        </div>
      )}

      {(!hasSavedCard || isReplacingCard) && (
        <div className="flex flex-col w-full">
          <h2 className="text-[#1E293B] font-semibold text-xl font-inter mb-4">Payment method</h2>
          <Elements stripe={getStripe()}>
            <CardCollectionForm onSaved={handleSaved} onCancel={() => setIsReplacingCard(false)} />
          </Elements>
        </div>
      )}

      {/* Special requests textarea — persisted as the real Booking's `notes` field */}
      <div className="flex flex-col gap-2 w-full mt-6">
        <div className="border border-[#E8E8E4] rounded-lg p-4 bg-white shadow-sm w-full">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={2000}
            placeholder="Got a special request? Leave a note here."
            className="w-full text-sm text-[#1C1C1A] placeholder-neutral-400 outline-none border-none resize-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
