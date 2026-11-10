import { apiRequest } from "@/lib/api/client";

/** Matches api/src/modules/payment/*.ts — Customer saved-card management. Never handles raw
 * card data itself: `createSetupIntent`'s `clientSecret` is handed to Stripe.js
 * (`stripe.confirmCardSetup`), which tokenizes the card in the browser and talks to Stripe
 * directly: this client never sees a PAN/CVC. */

export interface CreateSetupIntentResponse {
  setupIntentId: string;
  clientSecret: string;
}

export interface SavedCardStatus {
  hasSavedCard: boolean;
  /** `paymentMethodId` (a Stripe `pm_…` id, never card data) addresses a removal request. */
  card?: { paymentMethodId?: string; brand: string; last4: string; expMonth: number; expYear: number };
}

export interface RemoveSavedCardResult {
  removed: true;
  paymentMethodId: string;
  alreadyDetached: boolean;
}

export interface PaymentMethodSummary {
  paymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export const paymentsApi = {
  createSetupIntent: () =>
    apiRequest<CreateSetupIntentResponse>({ method: "POST", url: "/payments/setup-intent" }),

  confirmSavedPaymentMethod: (setupIntentId: string) =>
    apiRequest<PaymentMethodSummary>({
      method: "POST",
      url: "/payments/confirm-card",
      data: { setupIntentId },
    }),

  getSavedCardStatus: () =>
    apiRequest<SavedCardStatus>({ method: "GET", url: "/payments/card-status" }),

  /** P2.2.5 — detaches the saved card at Stripe and removes it from Bookly (server-authorized). */
  removeSavedCard: (paymentMethodId: string) =>
    apiRequest<RemoveSavedCardResult>({
      method: "DELETE",
      url: `/payments/payment-methods/${encodeURIComponent(paymentMethodId)}`,
    }),
};
