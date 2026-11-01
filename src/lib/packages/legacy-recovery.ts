import { z } from "zod";
import { packagesApi, type PackagePurchaseInput, type RedeemPackageSessionInput } from "@/lib/api/packages";
import { useAuthStore } from "@/lib/auth/store";
import { customerPaymentSession } from "@/lib/bookings/payment-session";
import { getStripe } from "@/lib/payments/stripe-client";

const id = z.string().regex(/^[a-f\d]{24}$/i);
const address = z.object({ city: z.string(), propertyType: z.string(), area: z.string(), streetName: z.string(), streetNumber: z.string(),
  floorUnit: z.string().optional(), aptRoom: z.string().optional(), additionalDirections: z.string().max(2000).optional() }).strict();
const common = { idempotencyKey: z.string().min(1).max(200), startAt: z.iso.datetime({ offset: true }),
  customerCity: z.string().optional(), travelAddress: address.optional(), notes: z.string().max(2000).optional() };
const purchase = z.object({ ...common, promoCode: z.undefined().optional(), serviceLines: z.array(z.object({ serviceId: id, staffMembershipId: id,
  addonIds: z.array(id).max(50), pricingInput: z.object({ hours: z.number().positive().optional(), personCount: z.number().int().positive().optional() }).strict() }).strict()).length(1) }).strict();
const redemption = z.object({ ...common, staffMembershipId: id, addonIds: z.array(id).max(50).optional() }).strict();
export const LEGACY_RECOVERY_CHANGED = "bookly:legacy-package-changed";
export const LEGACY_BODY_TTL = 24 * 60 * 60 * 1000;
export const LEGACY_POINTER_TTL = 7 * LEGACY_BODY_TTL;
const prefix = "bookly:legacy-package:v1:";
const pointerSchema = z.object({ version: z.literal(1), customerId: id, businessId: id,
  kind: z.enum(["PACKAGE_PURCHASE", "PACKAGE_REDEMPTION"]), packageId: id,
  idempotencyKey: z.string().min(1).max(200), savedAt: z.number().finite().nonnegative() }).strict();
export type LegacyPointer = z.infer<typeof pointerSchema>;
export type LegacyRecord = LegacyPointer & { input: PackagePurchaseInput | RedeemPackageSessionInput };
export type LegacyStatus = {
  state: "NOT_OBSERVED" | "UNRESOLVED" | "AUTHENTICATION_REQUIRED" | "PAYMENT_PROCESSING" | "FINALIZATION_PENDING" |
    "PAYMENT_FAILED" | "REFUND_PENDING" | "REFUNDED" | "RECONCILIATION_REQUIRED" | "COMMITTED";
  businessId: string; kind: LegacyPointer["kind"]; packageId: string; idempotencyKey: string;
  canDismiss: boolean; canResume: boolean; bookingId?: string; packageProgressId?: string;
};
const storageKey = (p: Pick<LegacyPointer, "customerId" | "businessId">) => `${prefix}${p.customerId}:${p.businessId}`;
const changed = () => window.dispatchEvent(new Event(LEGACY_RECOVERY_CHANGED));
const fresh = (savedAt: number, ttl: number) => savedAt <= Date.now() && Date.now() - savedAt < ttl;
const parseInput = (p: LegacyPointer, value: unknown) => {
  const input = (p.kind === "PACKAGE_PURCHASE" ? purchase : redemption).parse(value);
  if (input.idempotencyKey !== p.idempotencyKey ||
    ("serviceLines" in input && input.serviceLines[0].serviceId !== p.packageId)) throw Error("Original package identity does not match.");
  return input as LegacyRecord["input"];
};

/** Unresolved/expired identity is retained. Expiry is never proof of server failure. */
export function readLegacyRecovery(customerId: string): { pointer: LegacyPointer; record?: LegacyRecord; expired: boolean }[] {
  const result: { pointer: LegacyPointer; record?: LegacyRecord; expired: boolean }[] = [];
  for (const key of Object.keys(sessionStorage).filter((key) => key.startsWith(prefix) && !key.startsWith(`${prefix}${customerId}:`)))
    sessionStorage.removeItem(key);
  for (const key of Object.keys(localStorage).filter((key) => key.startsWith(`${prefix}${customerId}:`))) {
    const pointer = pointerSchema.parse(JSON.parse(localStorage.getItem(key) ?? "null"));
    if (pointer.customerId !== customerId || storageKey(pointer) !== key) throw Error("Saved package recovery data is invalid. Contact support before trying again.");
    let record: LegacyRecord | undefined;
    const expired = !fresh(pointer.savedAt, LEGACY_POINTER_TTL);
    try {
      if (!expired && fresh(pointer.savedAt, LEGACY_BODY_TTL)) {
        const body = z.object({ pointer: pointerSchema, input: z.unknown() }).strict().parse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
        if (JSON.stringify(body.pointer) === JSON.stringify(pointer)) record = { ...pointer, input: parseInput(pointer, body.input) };
      } else sessionStorage.removeItem(key);
    } catch { /* A missing/corrupt body permits only observation, never reconstruction. */ }
    result.push({ pointer, record, expired });
  }
  return result;
}

export function saveLegacyRecovery(customerId: string, businessId: string, kind: LegacyPointer["kind"], packageId: string,
  input: LegacyRecord["input"]): LegacyRecord {
  const pointer = pointerSchema.parse({ version: 1, customerId, businessId, kind, packageId, idempotencyKey: input.idempotencyKey, savedAt: Date.now() });
  const parsed = parseInput(pointer, input);
  if (readLegacyRecovery(customerId).some((r) => r.pointer.businessId === businessId))
    throw Error("Resolve the original package request below before starting another request at this venue.");
  const record = { ...pointer, input: parsed };
  const key = storageKey(pointer);
  try {
    sessionStorage.setItem(key, JSON.stringify({ pointer, input: parsed }));
    localStorage.setItem(key, JSON.stringify(pointer));
  } catch (error) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    throw Error("Could not safely save the original package request. No package request was sent.", { cause: error });
  }
  changed();
  return record;
}

export function assertLegacyStatus(pointer: LegacyPointer, status: LegacyStatus) {
  if (status.businessId !== pointer.businessId || status.kind !== pointer.kind || status.packageId !== pointer.packageId ||
    status.idempotencyKey !== pointer.idempotencyKey ||
    (status.state === "COMMITTED" && (!status.bookingId || !status.packageProgressId)))
    throw Error("Package status did not match the original request.");
}

export function resolveLegacyRecovery(pointer: LegacyPointer, status: LegacyStatus) {
  assertLegacyStatus(pointer, status);
  if (!status.canDismiss) throw Error("The original package request is still unresolved.");
  const key = storageKey(pointer);
  const current = pointerSchema.parse(JSON.parse(localStorage.getItem(key) ?? "null"));
  if (current.idempotencyKey !== pointer.idempotencyKey || current.kind !== pointer.kind ||
    current.packageId !== pointer.packageId || current.savedAt !== pointer.savedAt) throw Error("The saved package request changed.");
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
  changed();
}

export const observeLegacyRecovery = async (pointer: LegacyPointer) => {
  const status = await packagesApi.operationStatus(pointer.businessId, pointer.kind, pointer.packageId, pointer.idempotencyKey);
  assertLegacyStatus(pointer, status);
  return status;
};

/** Every later retry first observes the original operation. Secrets remain ephemeral. */
export async function continueLegacyRecovery(record: LegacyRecord, live: () => boolean): Promise<LegacyStatus> {
  const session = customerPaymentSession(useAuthStore.getState());
  const current = () => live() && Boolean(session) && session === customerPaymentSession(useAuthStore.getState()) &&
    useAuthStore.getState().user?.id === record.customerId;
  const guard = () => { if (!current()) throw Error("Sign in to the original account to recover this package request."); };
  guard();
  const retained = readLegacyRecovery(record.customerId).find((r) => r.pointer.businessId === record.businessId);
  if (!retained?.record || retained.pointer.idempotencyKey !== record.idempotencyKey ||
    JSON.stringify(retained.record.input) !== JSON.stringify(record.input)) throw Error("Only status recovery is available for this saved request.");
  let status = await observeLegacyRecovery(record); guard();
  if (status.canDismiss) return status;
  if (!status.canResume) throw Error("The original package request is pending recovery. Check its status; do not pay again.");
  const submit = () => record.kind === "PACKAGE_PURCHASE"
    ? packagesApi.purchase(record.businessId, record.input as PackagePurchaseInput)
    : packagesApi.redeemSession(record.businessId, record.packageId, record.input as RedeemPackageSessionInput);
  let result = await submit(); guard();
  if ("clientSecret" in result) {
    const stripe = await getStripe(); guard();
    if (!stripe) throw Error("Payment authentication is unavailable. Your original request is retained.");
    const confirmation = await stripe.confirmCardPayment(result.clientSecret); guard();
    if (confirmation.error) throw Error(confirmation.error.message ?? "Payment authentication is incomplete.");
    result = await submit(); guard();
    if ("clientSecret" in result) throw Error("Payment authentication is still pending. Continue the original request.");
  }
  status = await observeLegacyRecovery(record); guard();
  if (status.state !== "COMMITTED") throw Error("Package finalization is unresolved. Check the original request below.");
  return status;
}
