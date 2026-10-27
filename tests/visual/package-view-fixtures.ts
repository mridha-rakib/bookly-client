import type { OwnedPackageView, PackageOffer, PackageSettlementView } from "../../src/lib/api/package-views";
import type { SessionReviewTerms } from "../../src/components/packages/FirstClassPackageViews";
export const offer: PackageOffer = {
  id: "111111111111111111111111", businessId: "222222222222222222222222",
  name: "Complete wellbeing — Massage, Facial and Group Movement with a long package name",
  description: "A mixed package with exact service quantities and a separate one-seat group entitlement.",
  currency: "EUR", bundlePriceCents: 24000, validity: { mode: "FINITE", months: 6 },
  fulfilmentMode: "AT_BUSINESS_LOCATION", checkoutAvailable: false,
  items: [{ itemId: "fixed", serviceId: "massage", name: "Restorative massage", quantity: 6, pricingMode: "FIXED" },
    { itemId: "group", serviceId: "movement", name: "Small-group movement", quantity: 4, pricingMode: "PER_PERSON", group: { credits: 1, partySize: 1 } }],
};
export const owned: OwnedPackageView = {
  id: "333333333333333333333333", businessId: offer.businessId, schemaVersion: 2, name: offer.name,
  currency: "EUR", bundlePriceCents: 24000, status: "RECORDED", originBookingId: "444444444444444444444444", actionsAvailable: false,
  validity: { mode: "FINITE", expiresAt: "2027-04-25T10:00:00Z", timezone: "Asia/Nicosia" },
  penalty: { appointmentCapCents: 2500, lifetimeCapCents: 24000, purchaseDepositOffset: false },
  purchaseFinancials: { totalCents: 24000, depositCents: 3500, balanceSettled: false, outstandingBalanceCents: 15500, venueAttestedCents: 5000 },
  items: [{ id: "fixed", serviceId: "massage", name: "Restorative massage", pricingMode: "FIXED", group: null,
    total: 6, remaining: 1, scheduled: 1, completed: 2, forfeited: 1, expired: 1, travelCities: [] },
    { id: "group", serviceId: "movement", name: "Small-group movement", pricingMode: "PER_PERSON", group: { credits: 1, partySize: 1 },
      total: 4, remaining: 2, scheduled: 1, completed: 1, forfeited: 0, expired: 0, travelCities: [] }],
  sessions: [{ bookingId: "444444444444444444444444", itemId: "fixed", status: "SCHEDULED", restoration: null,
    booking: { status: "UPCOMING", role: "PURCHASE", startAt: "2026-11-02T10:00:00Z", endAt: "2026-11-02T11:00:00Z", timezone: "Asia/Nicosia", staffId: "provider", occupiedDurationMin: 75, travelFeeCents: 0, addonsSubtotalCents: 0, depositCents: 3500, balanceSettled: false, outstandingBalanceCents: 15500, venueAttestedCents: 5000 } },
    { bookingId: "555555555555555555555555", itemId: "group", status: "SCHEDULED", restoration: null,
      booking: { status: "PENDING", role: "REDEMPTION", startAt: "2026-11-09T10:00:00Z", endAt: "2026-11-09T11:00:00Z", timezone: "Asia/Nicosia", staffId: "provider", occupiedDurationMin: 60, travelFeeCents: 1200, addonsSubtotalCents: 500, depositCents: 0, balanceSettled: false, outstandingBalanceCents: 1700, venueAttestedCents: 0 } }],
  operations: [{ action: "REDEEM", state: "PERSISTING", resultStatus: null, disclosure: "Independent session dues pending. No confirmed booking result.", amountCents: 1700, notificationStates: ["BLOCKED_UNVERIFIED"] }],
  payments: [{ kind: "SESSION_DUES", amountCents: 1700, providerState: "REQUIRES_ACTION", persistenceState: "PERSISTING", compensationState: "NOT_REQUIRED" }],
};
export const terms: SessionReviewTerms = { disclosure: "VISUAL FIXTURE: Server-authored disclosure example. One Group credit = one participant / seat. Travel EUR 12.00; Add-on EUR 5.00; total EUR 17.00, payable online. This is not consent or a live quote.",
  travelCents: 1200, addonsCents: 500, totalCents: 1700, paymentState: "REQUIRES_ACTION", quoteState: "CURRENT",
  providers: [{ id: "provider", name: "Alex — existing permitted professional" }], slots: [{ id: "slot", label: "9 Nov 2026, 12:00 (Asia/Nicosia)" }] };
export const settlement: PackageSettlementView = { originBookingId: owned.originBookingId, purchaseFinancials: owned.purchaseFinancials, session: owned.sessions[1], actionsAvailable: false, operations: owned.operations, payments: owned.payments };
