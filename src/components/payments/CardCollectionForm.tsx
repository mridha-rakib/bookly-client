"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, CreditCardPosIcon } from "@hugeicons/core-free-icons";
import { CardCvcElement, CardExpiryElement, CardNumberElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeCardNumberElementChangeEvent } from "@stripe/stripe-js";

import { paymentsApi } from "@/lib/api/payments";

// Card-brand UX polish — the three static badges below react to Stripe's OWN `brand` field from
// CardNumberElement's change event (the exact same tokenized-in-an-iframe Element, never a
// second card-number reader): Stripe remains the sole authority on brand, this only decides
// which of the three ALREADY-EXISTING badges to visually emphasize. Any brand Stripe reports
// that isn't one of these three (discover/diners/jcb/unionpay/unknown) intentionally maps to
// `null` — never guessed onto the nearest badge.
type DisplayableBrand = "visa" | "mastercard" | "amex";
const displayableBrands: Record<string, DisplayableBrand> = {
  visa: "visa",
  mastercard: "mastercard",
  amex: "amex",
};

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
 *
 * Batch 9 — extracted out of venue/components/PaymentStep.tsx so customer/payment-card/page.tsx
 * (the standalone "manage my saved card" screen, previously a fully separate fake raw-input
 * form) can reuse the exact same real flow instead of duplicating it.
 */
export function CardCollectionForm({
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
  // Stripe-reported brand only (`event.brand`) — never derived from the card number itself,
  // which this component never has access to in the first place.
  const [detectedBrand, setDetectedBrand] = useState<DisplayableBrand | null>(null);

  const handleCardNumberChange = (event: StripeCardNumberElementChangeEvent) => {
    setDetectedBrand(displayableBrands[event.brand] ?? null);
  };

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
          <span className="text-[11px] font-bold text-[#16123E] tracking-widest uppercase">Name on Card</span>
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
              <CardNumberElement
                options={{ style: stripeElementStyle, placeholder: "4444 4444 4444 4444" }}
                onChange={handleCardNumberChange}
              />
            </div>
            <div
              className="flex items-center gap-1.5 shrink-0"
              aria-label={detectedBrand ? `Detected card brand: ${detectedBrand}` : "Card brand not yet detected"}
            >
              <div
                title="Visa"
                aria-current={detectedBrand === "visa"}
                className={`px-1.5 py-0.5 bg-[#1A1F71] text-white text-[9px] font-bold rounded transition-opacity ${
                  detectedBrand && detectedBrand !== "visa" ? "opacity-40" : "opacity-100"
                }`}
              >
                VISA
              </div>
              <div
                title="Mastercard"
                aria-current={detectedBrand === "mastercard"}
                className={`px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded transition-opacity ${
                  detectedBrand && detectedBrand !== "mastercard" ? "opacity-40" : "opacity-100"
                }`}
              >
                MC
              </div>
              <div
                title="American Express"
                aria-current={detectedBrand === "amex"}
                className={`px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded transition-opacity ${
                  detectedBrand && detectedBrand !== "amex" ? "opacity-40" : "opacity-100"
                }`}
              >
                AMEX
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 w-full">
          <div className="flex flex-col gap-2 flex-1">
            <span className="text-[11px] font-bold text-[#16123E] tracking-widest uppercase">Expiration Date</span>
            <div className="border border-[#ECEBEF] rounded-xl px-4 py-3.5 flex items-center bg-white">
              {/* Expiry-input fix — CardNumberElement/CardCvcElement (above/below) are both
                  wrapped in a `w-full` div so Stripe's injected Element container fills this
                  flex row's main axis; CardExpiryElement was missing it, leaving the actual
                  iframe click/focus target sized to its own intrinsic width while this
                  surrounding box (border/padding) visually spanned the full field — most clicks
                  inside the visible box landed outside the real iframe. */}
              <div className="w-full">
                <CardExpiryElement options={{ style: stripeElementStyle }} />
              </div>
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
