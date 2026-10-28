import { z } from "zod";
import type { CreateBookingInput } from "@/lib/api/bookings";

const id = z.string().regex(/^[a-f\d]{24}$/i);
const inputSchema = z.object({
  idempotencyKey: z.string().min(1).max(200), startAt: z.iso.datetime({ offset: true }),
  serviceLines: z.array(z.object({ serviceId: id, staffMembershipId: id, addonIds: z.array(id).max(50),
    pricingInput: z.object({ hours: z.number().positive().optional(), personCount: z.number().int().positive().optional() }).strict() }).strict()).min(1).max(50),
  customerCity: z.string().optional(), notes: z.string().max(2000).optional(), promoCode: z.string().max(200).optional(),
  travelAddress: z.object({ city: z.string(), propertyType: z.string(), area: z.string(), streetName: z.string(),
    streetNumber: z.string(), floorUnit: z.string().optional(), aptRoom: z.string().optional(),
    additionalDirections: z.string().max(2000).optional() }).strict().optional(),
}).strict();
const recordSchema = z.object({ version: z.literal(1), customerId: id, businessId: id,
  savedAt: z.number().finite(), input: inputSchema }).strict();
export type BookingContinuation = { version: 1; customerId: string; businessId: string; savedAt: number; input: CreateBookingInput };
const prefix = "bookly:ordinary-booking:v1:";
const pointerPrefix = "bookly:ordinary-booking:v2:";
const pointerSchema = z.object({ version: z.literal(2), customerId: id, businessId: id,
  idempotencyKey: z.string().min(1).max(200), savedAt: z.number().finite() }).strict();
export type BookingRecoveryPointer = z.infer<typeof pointerSchema>;
// Browser convenience/privacy lifetimes only. Expiry never declares a payment failed,
// cancels a request, changes a server deadline or triggers another operation.
export const BOOKING_REQUEST_BODY_RETENTION_MS = 24 * 60 * 60 * 1000;
export const BOOKING_POINTER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const BOOKING_CONTINUATIONS_CHANGED = "bookly:ordinary-booking-changed";
const keyFor = (r: BookingContinuation) => `${prefix}${r.customerId}:${r.businessId}:${encodeURIComponent(r.input.idempotencyKey)}`;
const pointerKey = (r: BookingRecoveryPointer) => `${pointerPrefix}${r.customerId}:${r.businessId}:${encodeURIComponent(r.idempotencyKey)}`;
const pointerFor = (r: BookingContinuation): BookingRecoveryPointer => ({ version: 2, customerId: r.customerId,
  businessId: r.businessId, idempotencyKey: r.input.idempotencyKey, savedAt: r.savedAt });
const fresh = (savedAt: number, ttl: number) => savedAt <= Date.now() && Date.now() - savedAt < ttl;
const keys = (storage: Storage) => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => Boolean(k));

/** Remove persistent PII from old P4A records, retire expired cache, and purge another
 * account's tab-scoped request bodies. Server recovery history is never deleted here. */
export function pruneBookingRecoveryStorage(customerId: string) {
  if (typeof window === "undefined") return;
  try {
    for (const key of keys(localStorage)) {
      if (key.startsWith(prefix)) {
        try {
          const old = recordSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
          if (old.success && old.data.customerId === customerId) {
            const record = old.data as BookingContinuation, pointer = pointerFor(record);
            if (fresh(record.savedAt, BOOKING_POINTER_RETENTION_MS)) localStorage.setItem(pointerKey(pointer), JSON.stringify(pointer));
            if (fresh(record.savedAt, BOOKING_REQUEST_BODY_RETENTION_MS)) sessionStorage.setItem(keyFor(record), JSON.stringify(record));
          }
        } catch { /* Retire the old persistent body even if migration storage is unavailable. */ }
        localStorage.removeItem(key);
      } else if (key.startsWith(pointerPrefix)) {
        try {
          const parsed = pointerSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
          if (!parsed.success || pointerKey(parsed.data) !== key || !fresh(parsed.data.savedAt, BOOKING_POINTER_RETENTION_MS)) localStorage.removeItem(key);
        } catch { localStorage.removeItem(key); }
      }
    }
    for (const key of keys(sessionStorage).filter((k) => k.startsWith(prefix))) {
      try {
        const parsed = recordSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
        if (!parsed.success || parsed.data.customerId !== customerId || keyFor(parsed.data as BookingContinuation) !== key ||
            !fresh(parsed.data.savedAt, BOOKING_REQUEST_BODY_RETENTION_MS) || !localStorage.getItem(pointerKey(pointerFor(parsed.data as BookingContinuation))))
          sessionStorage.removeItem(key);
      } catch { sessionStorage.removeItem(key); }
    }
  } catch { /* Cache access is optional for server-owned status discovery. */ }
}
export function readBookingRecoveryPointers(customerId: string): BookingRecoveryPointer[] {
  pruneBookingRecoveryStorage(customerId);
  const pointers: BookingRecoveryPointer[] = [];
  try {
    for (const key of keys(localStorage).filter((k) => k.startsWith(`${pointerPrefix}${customerId}:`))) {
      try { const parsed = pointerSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? "null"));
        if (parsed.success && parsed.data.customerId === customerId && pointerKey(parsed.data) === key &&
            fresh(parsed.data.savedAt, BOOKING_POINTER_RETENTION_MS)) pointers.push(parsed.data);
      } catch { /* No untrusted local record grants authority. */ }
    }
  } catch { return []; }
  return pointers;
}
export function readBookingContinuations(customerId: string): BookingContinuation[] {
  if (typeof window === "undefined") return [];
  pruneBookingRecoveryStorage(customerId);
  const records: BookingContinuation[] = [];
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(`${prefix}${customerId}:`)) continue;
      try {
        const parsed = recordSchema.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
        if (!parsed.success || parsed.data.customerId !== customerId || !fresh(parsed.data.savedAt, BOOKING_REQUEST_BODY_RETENTION_MS)) continue;
        const record = parsed.data as BookingContinuation;
        if (keyFor(record) === key && localStorage.getItem(pointerKey(pointerFor(record)))) records.push(record);
      } catch { /* An untrusted/malformed browser record cannot grant a request. */ }
    }
  } catch { return []; }
  return records.sort((a, b) => b.savedAt - a.savedAt);
}
/** Save BEFORE dispatch. Only immutable request fields, no provider result, secret or token.
 * Missing server status is never permission to generate a replacement key. */
export function saveBookingContinuation(customerId: string, businessId: string, input: CreateBookingInput): BookingContinuation {
  const proposed = recordSchema.parse({ version: 1, customerId, businessId, savedAt: Date.now(), input }) as BookingContinuation;
  const pointers = readBookingRecoveryPointers(customerId);
  const prior = readBookingContinuations(customerId).find((r) => r.businessId === businessId && r.input.idempotencyKey === input.idempotencyKey);
  if (!prior && pointers.some((r) => r.businessId === businessId && r.idempotencyKey === input.idempotencyKey))
    throw Error("The original checkout details are no longer available in this tab. Check the original request in My Bookings.");
  if (prior && JSON.stringify(prior.input) !== JSON.stringify(proposed.input))
    throw Error("This Booking request is already saved. Continue the original request from Booking recovery.");
  if (pointers.some((r) => r.businessId === businessId && r.idempotencyKey !== input.idempotencyKey))
    throw Error("Check your saved Booking request below before starting another booking at this venue.");
  const record = prior ?? proposed;
  try {
    sessionStorage.setItem(keyFor(record), JSON.stringify(record));
    const pointer = pointerFor(record); localStorage.setItem(pointerKey(pointer), JSON.stringify(pointer));
  }
  catch { throw Error("Save access is required to safely resume this Booking after refresh. Enable site storage and try again."); }
  window.dispatchEvent(new Event(BOOKING_CONTINUATIONS_CHANGED));
  return record;
}
/** Called only after an explicit server-verified terminal outcome in the recovery UI. */
export function dismissBookingContinuation(record: BookingContinuation) {
  return dismissBookingRecoveryPointer(record.customerId, record.businessId, record.input.idempotencyKey);
}
export function dismissBookingRecoveryPointer(customerId: string, businessId: string, idempotencyKey: string) {
  const pointer: BookingRecoveryPointer = { version: 2, customerId, businessId, idempotencyKey, savedAt: 0 };
  const bodyKey = `${prefix}${customerId}:${businessId}:${encodeURIComponent(idempotencyKey)}`;
  try { sessionStorage.removeItem(bodyKey); localStorage.removeItem(bodyKey); localStorage.removeItem(pointerKey(pointer)); } catch { return false; }
  window.dispatchEvent(new Event(BOOKING_CONTINUATIONS_CHANGED));
  return true;
}
