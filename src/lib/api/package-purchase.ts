import { apiRequest } from "./client";

export type PackagePurchaseResult = {
  state: "COMPLETE" | "CONSENT_PENDING" | "PAYMENT_PENDING" | "COMPENSATION" | "UNRESOLVED";
  operationId: string; quoteId: string; termsHash: string; disclosureHash: string;
  issuedAt: string; expiresAt: string; canStartNewQuote: false;
  purchaseCompletion?: "VERIFIED"; packageProgressId?: string; bookingIds?: string[];
  providerStatus?: string; persistenceStatus?: string; compensationStatus?: string; clientSecret?: string;
};
const send = (action: "purchase" | "purchase-status", businessId: string, operationId: string) =>
  apiRequest<PackagePurchaseResult>({ method: "POST", url: `/package-views/actions/${action}`, data: { businessId, operationId } });
export const packagePurchaseApi = {
  complete: (businessId: string, operationId: string) => send("purchase", businessId, operationId),
  status: (businessId: string, operationId: string) => send("purchase-status", businessId, operationId),
};
