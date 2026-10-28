import { apiRequest } from "./client";

export interface PackageOffer {
  id: string; businessId: string; name: string; description?: string;
  currency: "EUR"; bundlePriceCents: number;
  validity: { mode: "FINITE" | "FOREVER"; months?: number };
  fulfilmentMode: string; checkoutAvailable: boolean;
  items: Array<{ itemId: string; serviceId: string; name: string; quantity: number;
    pricingMode: string; group?: { credits: number; partySize: number } }>;
}
export interface OwnedPackageView {
  operations?: Array<{ action: string; state: string; resultStatus: string | null; disclosure: string | null; amountCents: number | null; notificationStates: string[]; sessionAcceptanceRecordedAt?: string | null }>;
  payments?: Array<{ kind: string; amountCents: number | null; providerState: string; persistenceState: string; compensationState: string }>;
  id: string; schemaVersion: 2; businessId: string; name: string; currency: "EUR";
  bundlePriceCents: number; status: string; originBookingId: string; actionsAvailable: boolean;
  /** Server-verified commercial completion of the original purchase. Anything other than
   * VERIFIED (including absent) means no usable credits are shown. */
  purchaseCompletion?: "VERIFIED" | "NOT_ESTABLISHED";
  validity: { mode: "FINITE" | "FOREVER"; expiresAt: string | null; timezone: string | null } | null;
  penalty: { appointmentCapCents: number; lifetimeCapCents: number; purchaseDepositOffset: false } | null;
  purchaseFinancials: { totalCents: number; depositCents: number; balanceSettled: boolean;
    outstandingBalanceCents: number; venueAttestedCents: number } | null;
  items: Array<{ id: string; serviceId: string; name: string; pricingMode: string;
    group: { credits: number; partySize: number } | null;
    total: number; remaining: number; scheduled: number; completed: number; forfeited: number; expired: number;
    travelCities: Array<{ city: string; feeCents: number }> }>;
  sessions: Array<{ bookingId: string; itemId: string; status: string; restoration: string | null;
    booking: { status: string; role: "PURCHASE" | "REDEMPTION" | "UNKNOWN"; startAt: string;
      endAt: string; timezone: string; staffId: string; occupiedDurationMin: number | null;
      staffName?: string | null;
      travelFeeCents: number; addonsSubtotalCents: number; depositCents: number;
      balanceSettled: boolean; outstandingBalanceCents: number; venueAttestedCents: number } | null }>;
}
export interface PackageSettlementView {
  operations?: OwnedPackageView["operations"]; payments?: OwnedPackageView["payments"];
  originBookingId: string; purchaseFinancials: OwnedPackageView["purchaseFinancials"];
  purchaseCompletion?: OwnedPackageView["purchaseCompletion"];
  packageProgressId?: string;
  session: OwnedPackageView["sessions"][number] | null; actionsAvailable: boolean;
}
export const packageViewsApi = {
  catalogue: (businessId: string, packageId?: string) => apiRequest<{ packages: PackageOffer[] }>({
    method: "GET", url: `/package-views/catalog/${encodeURIComponent(businessId)}${packageId ? `/${encodeURIComponent(packageId)}` : ""}` }),
  owned: (id?: string, before?: string) => apiRequest<{ packages: OwnedPackageView[]; hasMore: boolean; nextCursor?: string | null }>({
    method: "GET", url: `/package-views/owned${id ? `/${encodeURIComponent(id)}` : ""}`,
    ...(!id && before ? { params: { before } } : {}) }),
  settlement: (businessId: string, bookingId: string) => apiRequest<PackageSettlementView>({
    method: "GET", url: `/package-views/settlement/${encodeURIComponent(businessId)}/${encodeURIComponent(bookingId)}` }),
};
