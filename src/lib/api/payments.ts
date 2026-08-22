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
  card?: { brand: string; last4: string; expMonth: number; expYear: number };
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
};
