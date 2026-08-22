"use client";

import React, { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock01Icon, InformationCircleIcon, CreditCardPosIcon } from "@hugeicons/core-free-icons";
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { paymentsApi, type SavedCardStatus } from "@/lib/api/payments";
import { getStripe } from "@/lib/payments/stripe-client";

type BookingStep = "addons" | "professionals" | "time" | "payment" | "confirmed" | null;

interface PaymentStepProps {
  hasSavedCard: boolean;
  setHasSavedCard: (val: boolean) => void;
  isReplacingCard: boolean;
  setIsReplacingCard: (val: boolean) => void;
  setBookingStep: (step: BookingStep) => void;
  setPromoDiscountPercent: (val: number) => void;
  setPromoDeductedAmount: (val: number) => void;
  promoCode: string;
  setPromoCode: (val: string) => void;
}

const stripeElementStyle = {
  base: {
    fontSize: "16px",
    fontWeight: "500",
    color: "#16123E",
    fontFamily: "inherit",
    "::placeholder": { color: "#5E598B" },
  },
  invalid: { color: "#dc2626" },
};

/**
 * Batch 4 — the raw `<input type="text">` card-number/expiry/CVV fields this component
 * previously rendered would have collected real PAN/CVC directly into this app's own state and
 * (had it ever been wired to a backend) posted them to our server — a real PCI-compliance
 * violation and exactly what "never store raw card number/CVC" forbids. This is the minimal fix:
 * the SAME three visual fields, same labels, same layout, now backed by real Stripe Elements,
 * which tokenize the card inside Stripe's own iframe and never let raw card data touch this
 * component's state or this app's server at all.
 */
function CardCollectionForm({
  onSaved,
  onCancel,
}: {
  onSaved: (card: { brand: string; last4: string }) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSave = async () => {
    if (!stripe || !elements) return;
    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) return;

    setSaving(true);
    setError(undefined);
    try {
      const { clientSecret } = await paymentsApi.createSetupIntent();
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: name ? { name } : undefined,
        },
      });

      if (result.error) {
        setError(result.error.message ?? "This card could not be saved.");
        return;
      }
      if (!result.setupIntent) {
        setError("This card could not be saved.");
        return;
      }

      const summary = await paymentsApi.confirmSavedPaymentMethod(result.setupIntent.id);
      onSaved({ brand: summary.brand, last4: summary.last4 });
    } catch {
      setError("This card could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-[#F1F5F9] rounded-2xl p-6 shadow-sm flex flex-col gap-5 w-full relative">
        <div className="flex flex-col gap-2 w-full">
          <span className="text-[11px] font-bold text-[#16123E] tracking-widest uppercase">Name</span>
          <div className="border border-[#ECEBEF] rounded-xl px-4 py-3.5 flex items-center bg-white">
            <input
              type="text"
              placeholder="Name on card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-base font-medium text-[#16123E] placeholder-[#5E598B] border-none outline-none bg-transparent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <span className="text-[11px] font-bold text-[#16123E] tracking-widest uppercase">Card Number</span>
          <div className="border border-[#ECEBEF] rounded-xl px-4 py-3.5 flex items-center justify-between bg-white">
            <div className="w-full">
              <CardNumberElement options={{ style: stripeElementStyle, placeholder: "4444 4444 4444 4444" }} />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="px-1.5 py-0.5 bg-[#1A1F71] text-white text-[9px] font-bold rounded">VISA</div>
              <div className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">MC</div>
              <div className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded">AMEX</div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 w-full">
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-[11px] font-bold text-[#16123E] tracking-widest uppercase">Expiration Date</span>
            <div className="border border-[#ECEBEF] rounded-xl px-4 py-3.5 flex items-center bg-white">
              <CardExpiryElement options={{ style: stripeElementStyle }} />
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#16123E] tracking-widest uppercase">Security Code</span>
              <HugeiconsIcon icon={InformationCircleIcon} size={14} className="text-[#16123E]" />
            </div>
            <div className="border border-[#ECEBEF] rounded-xl px-4 py-3.5 flex items-center justify-between bg-white">
              <div className="w-full">
                <CardCvcElement options={{ style: stripeElementStyle }} />
              </div>
              <HugeiconsIcon icon={CreditCardPosIcon} size={20} className="text-[#5E598B] shrink-0" />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-3 mt-4 w-full">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2.5 border border-neutral-300 rounded-lg text-sm font-semibold hover:bg-neutral-50 cursor-pointer text-[#1C1B1C] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !stripe}
          className="px-5 py-2.5 bg-[#2E9DA7] text-white rounded-lg text-sm font-semibold hover:opacity-90 cursor-pointer transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save card"}
        </button>
      </div>
    </>
  );
}

export default function PaymentStep({
  hasSavedCard,
  setHasSavedCard,
  isReplacingCard,
  setIsReplacingCard,
  setBookingStep,
  setPromoDiscountPercent,
  setPromoDeductedAmount,
  promoCode,
  setPromoCode,
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

      {/* Promo Code Application Section */}
      <div className="flex flex-col gap-2.5 w-full mt-6 bg-white border border-[#ECEBEF] rounded-xl p-5 shadow-sm font-sans">
        <span className="text-[11px] font-bold text-[#16123E] tracking-widest uppercase">Promo Code</span>
        <div className="flex gap-2">
          <input
            type="text"
            id="promo-code-input"
            defaultValue={promoCode}
            placeholder="Enter promo code"
            className="flex-grow border border-[#ECEBEF] rounded-lg px-4 py-2 text-sm font-medium text-[#16123E] placeholder-[#5E598B] bg-white outline-none focus:border-[#2E9DA7]"
          />
          <button
            onClick={() => {
              const inputEl = document.getElementById("promo-code-input") as HTMLInputElement;
              const feedbackEl = document.getElementById("promo-feedback");
              if (inputEl && inputEl.value.trim().toUpperCase() === "BOOKLY20") {
                setPromoDiscountPercent(20);
                setPromoDeductedAmount(18);
                setPromoCode("BOOKLY20");
                if (feedbackEl) {
                  feedbackEl.classList.add("hidden");
                  feedbackEl.innerHTML = "";
                }
              } else {
                setPromoDiscountPercent(0);
                setPromoDeductedAmount(0);
                setPromoCode("");
                if (feedbackEl) {
                  feedbackEl.classList.remove("hidden");
                  feedbackEl.innerHTML = `<span class="text-xs text-red-600 font-medium">✗ Invalid promo code</span>`;
                }
              }
            }}
            className="bg-[#2E9DA7] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
          >
            Apply
          </button>
        </div>
        {/* Dynamic Promo Code Feedback container */}
        <div id="promo-feedback" className="hidden mt-2"></div>
      </div>

      {/* Special requests textarea */}
      <div className="flex flex-col gap-2 w-full mt-6">
        <div className="border border-[#E8E8E4] rounded-lg p-4 bg-white shadow-sm w-full">
          <textarea
            rows={3}
            placeholder="Got a special request? Leave a note here."
            className="w-full text-sm text-[#1C1C1A] placeholder-neutral-400 outline-none border-none resize-none bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
