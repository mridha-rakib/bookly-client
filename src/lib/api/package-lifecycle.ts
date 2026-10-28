import { apiRequest, BooklyApiError } from "./client";

export type PackageLifecycleAction = "redeem" | "reschedule" | "cancel" | "complete" | "mark-no-show" | "no-show" | "reverse-no-show" | "expire" | "settlement";
export interface PackageLifecycleScope { businessId: string; packageProgressId: string }
export interface SessionDues {
  addonIds: string[]; paymentMethod: "VENUE" | "ONLINE";
  travelAddress?: { city: string; area: string; streetName: string; streetNumber: string;
    propertyType: string; floorUnit?: string; aptRoom?: string; additionalDirections?: string };
}
export interface PackageLifecycleRequest extends PackageLifecycleScope {
  key: string; bookingId?: string; packageItemId?: string; staffMembershipId?: string; startAt?: string;
  dues?: SessionDues;
  venuePayment?: { settlement: "FULL" | "PARTIAL" | "NOT_PAID"; amountCents?: number; note?: string };
}
export type PackageLifecycleResult =
  | { state: "COMMITTED"; status: string; bookingId?: string; startAt?: string; endAt?: string; committedAt: string }
  | { state: "PAYMENT_PENDING"; providerStatus: string; paymentAttemptId?: string; clientSecret?: string }
  | { state: "UNRESOLVED" };
export interface PackageSessionQuote {
  quoteId: string; challenge: string; termsHash: string; disclosureHash: string; disclosure: string;
  travelCents: number; addonsCents: number; totalCents: number; currency: "EUR"; paymentMethod: "VENUE" | "ONLINE";
}
export interface PackageSessionSelection {
  timezone: string; providers: Array<{ id: string; name: string }>;
  addons: Array<{ id: string; name: string; priceCents: number }>;
  days: Array<{ date: string; isOpen: boolean; slots: Array<{ startAt: string; endAt: string; eligibleStaffMembershipIds: string[] }> }>;
}
const action = <T>(name: string, data: unknown) => apiRequest<T>({ method: "POST", url: `/package-views/actions/${name}`, data });
export const packageLifecycleApi = {
  execute: (name: PackageLifecycleAction, input: PackageLifecycleRequest) => action<PackageLifecycleResult>(name, input),
  selection: (input: PackageLifecycleScope & { packageItemId: string; fromDate: string; toDate: string; travelAddress?: SessionDues["travelAddress"] }) => action<PackageSessionSelection>("selection", input),
  quote: (input: PackageLifecycleRequest) => action<PackageSessionQuote>("session-quote", input),
  /** Read-only: the server reports the exact retained redemption as COMMITTED or UNRESOLVED.
   * It never creates, retries or pays for a Booking. */
  redemptionStatus: (input: PackageLifecycleRequest) => action<Extract<PackageLifecycleResult, { state: "COMMITTED" | "UNRESOLVED" }>>("session-status", input),
  /** Read-only: the exact retained cancel/reschedule/expiry (Customer or management) or
   * management complete/no-show/settlement request, COMMITTED or UNRESOLVED. The server binds
   * it to the same actor. It never repeats the action. */
  actionStatus: (name: Exclude<PackageLifecycleAction, "redeem">, input: PackageLifecycleRequest) =>
    action<Extract<PackageLifecycleResult, { state: "COMMITTED" | "UNRESOLVED" }>>(`${name}-status`, input),
  accept: (input: PackageLifecycleRequest, quote: PackageSessionQuote) => action<{ state: "ACCEPTED" }>("session-acceptance", {
    ...input, acceptance: { quoteId: quote.quoteId, termsHash: quote.termsHash, disclosureHash: quote.disclosureHash,
      challenge: quote.challenge, action: "ACCEPT_SESSION_DUES" },
  }),
};
export function packageLifecycleError(error: unknown): string {
  if (error instanceof BooklyApiError) {
    const messages: Record<number, string> = {
      402: "Payment failed or a saved payment method is required. Booking is unconfirmed. Review payment settings before retrying the same request.",
      403: "Your current role or Business access does not permit this action.",
      404: "This package or appointment is unavailable to your account.",
      409: "Package credits, terms or availability changed. Refresh and review before continuing.",
      503: "Package actions are unavailable or recovery is pending. No success is confirmed. Keep the same request for retry.",
    };
    if (error.status && messages[error.status]) return messages[error.status]!;
  }
  return "The result is unconfirmed. Retry the same request; do not submit a second operation.";
}
