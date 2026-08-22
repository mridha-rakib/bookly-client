import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * The ONLY Stripe key this codebase ever sends to the browser — `NEXT_PUBLIC_*` is Next.js's own
 * convention for a variable that is safe to expose client-side (see `NEXT_PUBLIC_API_BASE_URL`
 * for the existing precedent this mirrors). The secret key never leaves the backend (see
 * api/src/modules/payment/stripe-client.ts).
 *
 * NOT configured in this repository as of Batch 4 (no real Stripe TEST credentials exist here —
 * see the Batch 4 final report). `getStripe()` resolves to `null` when unset, and every caller
 * (see PaymentStep.tsx) must handle that by showing a clear "payments unavailable" state rather
 * than crashing.
 */
let stripePromise: Promise<Stripe | null> | undefined;

export const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const publishableKey = process.env["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"];
    stripePromise = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);
  }
  return stripePromise;
};
