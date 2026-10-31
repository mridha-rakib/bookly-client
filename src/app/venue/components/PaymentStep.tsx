"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock01Icon } from "@hugeicons/core-free-icons";
import { Elements } from "@stripe/react-stripe-js";

import { paymentsApi, type SavedCardStatus } from "@/lib/api/payments";
import { getStripe } from "@/lib/payments/stripe-client";
import { CardCollectionForm } from "@/components/payments/CardCollectionForm";
import { useAuthStore } from "@/lib/auth/store";
import { customerPaymentSession } from "@/lib/bookings/payment-session";

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

export default function PaymentStep(props: PaymentStepProps) {
  const session = useAuthStore(customerPaymentSession);
  return <PaymentStepContent key={session ?? "no-customer-session"} {...props} session={session} />;
}

type DisplayCard = Pick<NonNullable<SavedCardStatus["card"]>, "brand" | "last4"> &
  Partial<Pick<NonNullable<SavedCardStatus["card"]>, "expMonth" | "expYear">>;

function PaymentStepContent({
  hasSavedCard,
  setHasSavedCard,
  isReplacingCard,
  setIsReplacingCard,
  setBookingStep,
  notes,
  setNotes,
  session,
}: PaymentStepProps & { session: string | undefined }) {
  const [card, setCard] = useState<DisplayCard | undefined>(undefined);
  const [readState, setReadState] = useState<"loading" | "error" | "ready">("loading");
  const mounted = useRef(false);
  const activeRead = useRef<object | null>(null);
  const saved = useRef(false);
  const live = useCallback(() => mounted.current && session !== undefined &&
    session === customerPaymentSession(useAuthStore.getState()), [session]);

  const loadCard = useCallback(() => {
    if (!live() || activeRead.current || saved.current) return;
    const request = {};
    activeRead.current = request;
    const current = () => live() && activeRead.current === request;
    setReadState("loading");
    // Unknown readiness blocks Booking confirmation; it does not establish card absence.
    setHasSavedCard(false);
    void paymentsApi.getSavedCardStatus()
      .then((status) => {
        if (!current()) return;
        if (status.hasSavedCard && !status.card) throw new Error("Saved card details unavailable");
        setCard(status.hasSavedCard ? status.card : undefined);
        setHasSavedCard(status.hasSavedCard);
        setReadState("ready");
      })
      .catch(() => {
        if (current()) setReadState("error");
      })
      .finally(() => {
        if (activeRead.current === request) activeRead.current = null;
      });
  }, [live, setHasSavedCard]);

  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(loadCard, 0);
    return () => {
      clearTimeout(timer);
      mounted.current = false;
      activeRead.current = null;
    };
  }, [loadCard]);

  const handleSaved = (card: { brand: string; last4: string }) => {
    if (!live()) return;
    // A confirmed save supersedes every earlier status read, including rejected reads.
    saved.current = true;
    activeRead.current = null;
    setCard(card);
    setReadState("ready");
    setHasSavedCard(true);
    setIsReplacingCard(false);
  };

  return (
    <div className="flex flex-col w-full lg:w-[714px] font-manrope">
      <h1 className="font-semibold text-3xl md:text-4xl text-[#1C1B1C] mb-8 font-poppins">Payment</h1>

      {readState === "loading" && (
        <p role="status" className="text-sm text-[#5E598B] mb-4">Loading saved card status…</p>
      )}
      {readState !== "ready" && (
        <div className="mb-4">
          {readState === "error" && (
            <p role="alert" className="text-sm text-red-600 mb-2">
              Saved card status could not be loaded. Your saved card has not been changed.
            </p>
          )}
          <button type="button" onClick={loadCard} disabled={readState === "loading" || !session}
            aria-label="Retry saved card status" aria-busy={readState === "loading"}
            className="px-5 py-2.5 border border-neutral-300 rounded-lg text-sm font-semibold hover:bg-neutral-50 cursor-pointer text-[#1C1B1C] disabled:opacity-50 disabled:cursor-not-allowed">
            {readState === "loading" ? "Checking saved card…" : "Retry"}
          </button>
        </div>
      )}

      {hasSavedCard && card && (
        <div className="flex flex-col w-full mb-6">
          <span className="text-xs font-bold text-[#16123E] tracking-widest uppercase mb-3">Primary Card</span>
          <div className="border border-[#ECEBEF] rounded-xl p-5 flex items-center justify-between bg-white shadow-sm w-full">
            <div className="flex items-center gap-4">
              <div className="w-12 h-8 bg-[#1A1F71] text-white text-xs font-extrabold flex items-center justify-center rounded uppercase tracking-wider">
                {card.brand}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-base font-bold text-[#16123E]">•••• •••• •••• {card.last4}</span>
                {card.expMonth !== undefined && card.expMonth > 0 && card.expYear !== undefined && (
                  <span className="text-xs text-[#5E598B]">
                    Expires {String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}
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
            <CardCollectionForm onSaved={handleSaved} onCancel={() => { if (live()) setIsReplacingCard(false); }} />
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
