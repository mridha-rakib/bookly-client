import type { BookingDetail } from "@/lib/api/bookings";
import type { CustomerFinancialOutcome, PaymentProviderStatus, PaymentPersistenceStatus, PaymentCompensationStatus, RefundOperationStatus } from "@/lib/api/customer-financial-outcome";

export type FinancialRow = { label: string; amountCents?: number; tone?: "neutral" | "success" | "attention" };
type Outcome = NonNullable<BookingDetail["cancellationOutcome"]>;
type Settlement = Outcome["settlementStatus"];
export const isRecordedMoney = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const unavailable: FinancialRow = { label: "Financial outcome information is currently unavailable." };
const chargeLabels: Record<Settlement, string> = {
  NOT_APPLICABLE: "Additional card charge not confirmed.",
  PENDING: "Additional card charge is awaiting confirmation.",
  SUCCEEDED: "Additional card charge recorded as successful.",
  FAILED: "Additional card charge was not confirmed.",
  WAIVED: "Additional fee waived.",
};
const refundLabels: Record<Settlement, string> = {
  NOT_APPLICABLE: "Refund settlement information is unavailable.",
  PENDING: "Refund outcome is awaiting confirmation.",
  SUCCEEDED: "Refund recorded as successful.",
  FAILED: "Refund needs attention; completion is not confirmed.",
  WAIVED: "Refund settlement information is unavailable.",
};
const otherLabels: Record<Settlement, string> = {
  NOT_APPLICABLE: "No additional card charge recorded.",
  PENDING: "Settlement is awaiting confirmation.",
  SUCCEEDED: "Settlement recorded as successful.",
  FAILED: "Settlement needs attention.",
  WAIVED: "Additional fee waived.",
};

/** Classified amounts and last-recorded settlement; never a provider/bank receipt. */
export function presentCancellation(outcome: BookingDetail["cancellationOutcome"]): FinancialRow[] {
  if (!outcome || ![outcome.cancellationFeeCents, outcome.depositAppliedCents,
    outcome.additionalChargeCents, outcome.refundOwedCents].every(isRecordedMoney)) return [unavailable];
  const rows: FinancialRow[] = [];
  if (outcome.cancellationFeeCents > 0) rows.push({ label: "Classified cancellation fee", amountCents: outcome.cancellationFeeCents });
  if (outcome.depositAppliedCents > 0) rows.push({ label: "Already-paid amount applied to the fee", amountCents: outcome.depositAppliedCents });
  if (outcome.additionalChargeCents > 0) rows.push({ label: "Additional fee amount", amountCents: outcome.additionalChargeCents });
  if (outcome.refundOwedCents > 0) rows.push({ label: "Refund amount owed", amountCents: outcome.refundOwedCents });
  const status = outcome.settlementStatus;
  if (!Object.hasOwn(chargeLabels, status) || (outcome.additionalChargeCents > 0 && outcome.refundOwedCents > 0) ||
    outcome.depositAppliedCents > outcome.cancellationFeeCents || outcome.additionalChargeCents > outcome.cancellationFeeCents) {
    return [...rows, unavailable];
  }
  const label = outcome.refundOwedCents > 0 ? refundLabels[status]
    : outcome.additionalChargeCents > 0 ? chargeLabels[status] : otherLabels[status];
  const inconsistentRefund = outcome.refundOwedCents > 0 && (status === "WAIVED" || status === "NOT_APPLICABLE");
  rows.push({ label, tone: status === "SUCCEEDED" ? "success"
    : status === "FAILED" || status === "PENDING" || inconsistentRefund ? "attention" : "neutral" });
  return rows;
}

/** Historical terms only: promo cash amount is distinct from original deposit entitlement. */
export function presentOnlineSnapshot(booking: BookingDetail): FinancialRow {
  if (booking.source !== "BOOKLY_MANAGED") return { label: "Bookly online payment information is unavailable for this booking." };
  const amount = booking.promo ? booking.promo.chargeCents
    : booking.paymentSummary?.actualOnlinePaidCents ?? booking.financials?.depositCents;
  if (!isRecordedMoney(amount)) return { label: "Historical online amount is unavailable." };
  return {
    label: booking.financials.platformFeeCents > 0 ? "Historical platform booking charge"
      : amount > 0 ? "Historical service deposit amount" : "Historical online amount",
    amountCents: amount,
  };
}

const paymentLabels: Record<PaymentProviderStatus, string> = {
  NOT_CREATED: "Payment has not been confirmed.", CREATED: "Payment has not yet been confirmed.",
  REQUIRES_ACTION: "Payment authentication was not completed.", PROCESSING: "Payment is processing; outcome is not yet confirmed.",
  UNKNOWN: "Payment outcome is being checked.", FAILED: "Payment was not confirmed.",
  CANCELED: "Payment attempt cancelled.", SUCCEEDED: "Payment success evidence is unavailable.",
};
const persistenceLabels: Record<PaymentPersistenceStatus, string> = {
  NOT_STARTED: "Payment-linked booking persistence has not started.", PERSISTING: "Payment-linked booking persistence is in progress.",
  COMPLETED: "Payment-linked booking persistence is recorded.", FAILED: "Payment-linked booking persistence needs attention.",
};
const compensationLabels: Record<PaymentCompensationStatus, string> = {
  NOT_REQUIRED: "", REQUIRED: "Payment recovery needs attention.", REFUND_PENDING: "Recovery refund outcome is awaiting confirmation.",
  REFUNDED: "Recovery refund is recorded; see refund observations for available evidence.",
  RECONCILIATION_REQUIRED: "Payment recovery outcome is being checked.", FAILED: "Payment recovery needs attention.",
};
const operationLabels: Record<RefundOperationStatus, string> = {
  CREATED: "Refund request recorded; completion is not confirmed.", PROVIDER_PENDING: "Refund is pending with the payment provider.",
  RECONCILIATION_REQUIRED: "Refund outcome is being checked.", FAILED: "Refund needs attention; completion is not confirmed.",
  SUCCEEDED: "Refund success evidence is unavailable.",
};

/** Source-specific observations. No sum across pages, payment systems or merchant dispute movements. */
export function presentFinancialOutcome(outcome: CustomerFinancialOutcome | undefined): FinancialRow[] {
  if (!outcome || outcome.currency !== "EUR") return [unavailable];
  const rows: FinancialRow[] = [{ label: "Last recorded payment observations" }];
  for (const payment of outcome.payments.items) {
    if (!isRecordedMoney(payment.amountCents) || !Object.hasOwn(paymentLabels, payment.providerStatus)) { rows.push(unavailable); continue; }
    const confirmed = payment.providerStatus === "SUCCEEDED" && payment.providerConfirmed === true;
    rows.push({ label: confirmed ? "Payment provider confirmed payment" : `${paymentLabels[payment.providerStatus]} Expected payment amount`,
      amountCents: payment.amountCents, tone: confirmed ? "success" : "attention" });
    rows.push({ label: Object.hasOwn(persistenceLabels, payment.persistenceStatus) ? persistenceLabels[payment.persistenceStatus] : unavailable.label });
    if (payment.compensationStatus !== "NOT_REQUIRED") rows.push({ label: Object.hasOwn(compensationLabels, payment.compensationStatus)
      ? compensationLabels[payment.compensationStatus] : unavailable.label, tone: "attention" });
    if (confirmed && !payment.accountingConfirmed) rows.push({ label: "Payment accounting confirmation is unavailable.", tone: "attention" });
  }
  if (outcome.payments.items.length === 0) rows.push({ label: "No matching recorded payment observations in this view." });
  if (outcome.payments.hasMore) rows.push({ label: "More payment records exist; this view is limited." });
  rows.push({ label: "Last recorded refund observations" });
  for (const refund of outcome.refunds.items) {
    if (!isRecordedMoney(refund.amountCents)) { rows.push(unavailable); continue; }
    if (refund.origin === "PROVIDER_EXTERNAL") {
      if (refund.state !== "ACCOUNTED" || refund.providerConfirmed !== true || refund.accountingConfirmed !== true) { rows.push(unavailable); continue; }
      rows.push({ label: "Payment provider confirmed an external refund", amountCents: refund.amountCents, tone: "success" });
    } else if (refund.origin === "BOOKLY" && Object.hasOwn(operationLabels, refund.status)) {
      const confirmed = refund.status === "SUCCEEDED" && refund.providerConfirmed === true;
      rows.push({ label: confirmed ? "Payment provider confirmed a refund" : `${operationLabels[refund.status]} Recorded refund request amount`,
        amountCents: refund.amountCents, tone: confirmed ? "success" : "attention" });
      if (confirmed && !refund.accountingConfirmed) rows.push({ label: "Refund accounting is awaiting confirmation.", tone: "attention" });
    } else rows.push(unavailable);
  }
  if (outcome.refunds.items.length === 0) rows.push({ label: "No matching recorded refund observations in this view." });
  if (outcome.refunds.hasMore) rows.push({ label: "More refund records exist; this view is limited." });
  rows.push({ label: "Last recorded payment disputes" });
  const openDisputes = new Set(["needs_response", "under_review", "warning_needs_response", "warning_under_review"]);
  const closedDisputes = new Set(["won", "lost", "prevented", "warning_closed"]);
  for (const dispute of outcome.disputes.items) {
    if (!isRecordedMoney(dispute.amountCents)) { rows.push(unavailable); continue; }
    rows.push({ label: dispute.final && closedDisputes.has(dispute.providerStatus)
      ? "Payment dispute closed. Disputed amount" : !dispute.final && openDisputes.has(dispute.providerStatus)
        ? "Payment dispute is under review. Disputed amount" : "Payment dispute status is unavailable. Recorded disputed amount",
    amountCents: dispute.amountCents });
  }
  if (outcome.disputes.items.length === 0) rows.push({ label: "No matching recorded disputes in this view." });
  if (outcome.disputes.hasMore) rows.push({ label: "More dispute records exist; this view is limited." });
  rows.push({ label: "These observations do not establish bank arrival or a complete financial history. Dispute outcomes do not establish a customer refund." });
  return rows;
}

const venueLabels: Record<BookingDetail["paymentSummary"]["venueSettlementStatus"], string> = {
  NOT_REQUIRED: "No venue balance due in the booking record.",
  NOT_RECORDED: "Venue payment has not been recorded.",
  NOT_PAID: "Business recorded the venue balance as unpaid.",
  PARTIALLY_PAID: "Business recorded a partial venue payment.",
  PAID_IN_FULL: "Business recorded the venue balance as paid in full.",
};
export function presentVenuePayment(booking: BookingDetail): FinancialRow[] {
  if (booking.completionPayment?.paid === true && !isRecordedMoney(booking.completionPayment.amountCents))
    return [{ label: "Business recorded a venue payment; the amount and remaining balance are unavailable." }];
  const summary = booking.paymentSummary;
  if (summary && Object.hasOwn(venueLabels, summary.venueSettlementStatus)) {
    const rows: FinancialRow[] = [{ label: venueLabels[summary.venueSettlementStatus] }];
    if (isRecordedMoney(summary.venuePaidCents) && summary.venuePaidCents > 0)
      rows.push({ label: "Business-recorded venue payment", amountCents: summary.venuePaidCents });
    if (isRecordedMoney(summary.outstandingVenueBalanceCents))
      rows.push({ label: "Outstanding venue balance in booking record", amountCents: summary.outstandingVenueBalanceCents });
    return rows;
  }
  if (booking.completionPayment?.paid === true) return [{ label: "Business recorded a venue payment; settlement details are unavailable." }];
  if (booking.completionPayment?.paid === false) return [{ label: "Business recorded venue payment as unpaid." }];
  return [{ label: "Venue payment has not been recorded." }];
}
