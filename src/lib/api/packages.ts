import { apiRequest } from "@/lib/api/client";
import type {
  BookingCreationPreview,
  CreateBookingInput,
  FinalizeBookingResult,
} from "@/lib/api/bookings";

/**
 * Package Deal purchase / session-redemption client — matches
 * api/src/modules/package-progress/package-progress.dto.ts and the new
 * `/businesses/:businessId/bookings/packages/*` + `/me/packages` endpoints exactly (see
 * BookingCreationService's own "Customer: Package purchase / session redemption" doc comment
 * for the full lifecycle this reuses/extends).
 */

export type PackageProgressSessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "FORFEITED";

export interface PackageProgressSession {
  sessionIndex: number;
  bookingId: string;
  status: PackageProgressSessionStatus;
  /** `null` is a safe degraded response for a legacy/corrupt dangling relationship. It never
   * invents a Booking summary and lets a future package timeline retain the historical entry. */
  booking: {
    status: string;
    schedule: { timezone: string; startAt: string; endAt: string };
    professional: { membershipId: string; displayName?: string };
  } | null;
}

/**
 * Approved payment/unlock rule (Phase 4B): `status` is derived server-side, never stored —
 * precedence is VOIDED (refunded) > AWAITING_BALANCE (session 1's venue balance not yet
 * recorded settled — sessions 2..N cannot be redeemed yet) > DEPLETED (no sessions left) >
 * ACTIVE. `balanceSettled`/`outstandingBalanceCents` mirror the Booking's own authoritative
 * financial state (never a second, separately-tracked payment-status field).
 */
export interface PackageProgress {
  id: string;
  businessId: string;
  serviceId: string;
  totalSessions: number;
  remainingSessions: number;
  completedSessions: number;
  status: "ACTIVE" | "AWAITING_BALANCE" | "DEPLETED" | "VOIDED";
  balanceSettled: boolean;
  outstandingBalanceCents: number;
  sessions: PackageProgressSession[];
  originBookingId: string;
  purchaseSnapshot: {
    name: string;
    packageServicesName?: string;
    bundlePriceCents: number;
    durationMin: number;
    sessionsInPackage: number;
    discountPercent?: number;
  };
  fulfilmentEntitlement: {
    mode: "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";
    travelCities?: Array<{
      city: NonNullable<PackagePurchaseInput["customerCity"]>;
      feeCents: number;
    }>;
  } | null;
  voidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackageProgressListResponse {
  packages: PackageProgress[];
}

/** A Package purchase is always exactly one service line for one Package Deal Service —
 * enforced server-side (BOOKING_PACKAGE_PURCHASE_INVALID_LINES); this type mirrors
 * CreateBookingInput but the wizard always builds it with a single-entry serviceLines array. */
export type PackagePurchaseInput = Omit<CreateBookingInput, "promoCode">;

export interface RedeemPackageSessionInput {
  staffMembershipId: string;
  startAt: string;
  /** Approved Add-on rule: the Package base session is $0, but a selected Add-on remains real,
   * separately payable money — reuses the same validation/pricing any normal booking uses. */
  addonIds?: string[];
  travelAddress?: PackagePurchaseInput["travelAddress"];
  customerCity?: PackagePurchaseInput["customerCity"];
  notes?: string;
  idempotencyKey: string;
}

export type PackageRedemptionPreviewInput = Pick<
  RedeemPackageSessionInput,
  "addonIds" | "travelAddress" | "customerCity"
>;

export interface PackageRedemptionPreview {
  finalizable: true;
  taxMode: "PRE_ACTIVATION";
  fulfilment: {
    mode: "AT_BUSINESS_LOCATION" | "TRAVEL_TO_CUSTOMER";
    travelAddress?: NonNullable<PackagePurchaseInput["travelAddress"]>;
  };
  packageBaseCents: 0;
  addonsSubtotalCents: number;
  travelFeeCents: number;
  subtotalCents: number;
  totalCents: number;
  depositCents: number;
  customerChargeNowCents: number;
  balanceDueCents: number;
  currency: "EUR";
  requiresSavedCard: boolean;
  hasSavedCard: boolean;
}

export const packagesApi = {
  previewPurchase: (businessId: string, input: PackagePurchaseInput) =>
    apiRequest<BookingCreationPreview>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/packages/preview`,
      data: input,
    }),

  purchase: (businessId: string, input: PackagePurchaseInput) =>
    apiRequest<FinalizeBookingResult>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/packages/purchase`,
      data: input,
    }),

  redeemSession: (businessId: string, packageProgressId: string, input: RedeemPackageSessionInput) =>
    apiRequest<FinalizeBookingResult>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/packages/${packageProgressId}/sessions`,
      data: input,
    }),

  previewRedemption: (
    businessId: string,
    packageProgressId: string,
    input: PackageRedemptionPreviewInput,
  ) =>
    apiRequest<PackageRedemptionPreview>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/packages/${packageProgressId}/redemption-preview`,
      data: input,
    }),

  /** Whole-Package refund/void (approved rule) — only succeeds while completely unused; see
   * BookingLifecycleService.voidUnusedPackage's own doc comment for the full eligibility rule. */
  voidPackage: (businessId: string, packageProgressId: string, reason?: string) =>
    apiRequest<{
      packageProgressId: string;
      voidedAt?: string;
      remainingSessions: number;
      totalSessions: number;
    }>({
      method: "POST",
      url: `/businesses/${businessId}/bookings/packages/${packageProgressId}/void`,
      data: { reason },
    }),

  listForCustomer: () =>
    apiRequest<PackageProgressListResponse>({ method: "GET", url: "/me/packages" }),

  getForCustomer: (packageProgressId: string) =>
    apiRequest<PackageProgress>({ method: "GET", url: `/me/packages/${packageProgressId}` }),
};
