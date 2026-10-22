"use client";

// Persistent, NON-SECRET record that the user asked to sign out and the server has not yet
// confirmed it. While it exists this browser must not restore the session from the HttpOnly
// refresh cookie (the cookie may still be valid server-side after a 429/5xx/network failure).
// It never grants authentication. A matching server acknowledgement or a completed explicitly
// authorized sign-in resolves it. Intent-scoped receipts prevent cross-tab delete/write races.
//
// localStorage is shared by every same-origin tab and survives reloads. If it is unavailable or
// throws, this tab still remembers the intent in memory, but the cross-reload guarantee is then
// lost — callers surface that via `persisted: false`.

const STORAGE_KEY = "bookly:logout-pending";
const RECEIPT_PREFIX = "bookly:logout-resolved:";
const RETRY_PREFIX = "bookly:logout-retry:";

export interface LogoutIntent {
  id: string;
  /** Correlation only. Legacy/unreadable intents stay pending without a verifiable target. */
  familyId?: string | undefined;
  startedAt: number;
  /** Earliest time (ms) the next logout attempt may be sent, e.g. from a 429 Retry-After. */
  retryAt?: number | undefined;
}

let memoryIntent: LogoutIntent | null = null;
// True when this tab could not rely on the shared record (its own write failed, or storage is
// unreadable): only then does the in-memory copy count. Otherwise the shared record is
// authoritative, so another tab clearing it is seen here immediately.
let memoryOnly = false;

const getStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

const createId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `logout-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Any value we cannot understand still counts as pending (fail closed). */
const parse = (raw: string): LogoutIntent => {
  try {
    const value = JSON.parse(raw) as Partial<LogoutIntent> | null;
    if (value && typeof value.id === "string" && typeof value.startedAt === "number") {
      return {
        id: value.id,
        familyId: typeof value.familyId === "string" ? value.familyId : undefined,
        startedAt: value.startedAt,
        retryAt: typeof value.retryAt === "number" ? value.retryAt : undefined,
      };
    }
  } catch {
    /* fall through */
  }
  return { id: "unreadable", startedAt: 0 };
};

const readStoredState = (): { usable: boolean; intent: LogoutIntent | null } => {
  const storage = getStorage();
  if (!storage) return { usable: false, intent: null };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { usable: true, intent: null };
    const intent = parse(raw);
    // An intent-scoped receipt cannot erase a newer marker, even if another tab changes
    // the shared pointer between our read and write. localStorage has no compare-and-delete.
    const receipt = storage.getItem(RECEIPT_PREFIX + intent.id);
    if (intent.id !== "unreadable" && receipt === JSON.stringify({ familyId: intent.familyId })) return { usable: true, intent: null };
    const deadline = storage.getItem(RETRY_PREFIX + intent.id);
    if (deadline !== null) {
      const retryAt = Number(deadline);
      intent.retryAt = Number.isFinite(retryAt) && retryAt > 0 ? retryAt : undefined;
    }
    return { usable: true, intent };
  } catch {
    return { usable: false, intent: null };
  }
};

const readStored = (): LogoutIntent | null => readStoredState().intent;

const writeStored = (intent: LogoutIntent): boolean => {
  const storage = getStorage();
  if (!storage) return false;
  try {
    const previous = storage.getItem(STORAGE_KEY);
    storage.setItem(STORAGE_KEY, JSON.stringify(intent));
    if (previous !== null && parse(previous).id !== intent.id) {
      // Only discard auxiliary records for the superseded ID; never delete the shared pointer.
      storage.removeItem(RECEIPT_PREFIX + parse(previous).id);
      storage.removeItem(RETRY_PREFIX + parse(previous).id);
    }
    return storage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

/** The pending intent, if any: the shared stored record first, then this tab's memory. */
export const readLogoutIntent = (): LogoutIntent | null => {
  const stored = readStoredState();
  if (stored.intent) {
    return memoryOnly && memoryIntent && sameLogoutIntent(stored.intent, memoryIntent)
      ? memoryIntent : stored.intent;
  }
  try {
    if (memoryIntent && getStorage()?.getItem(RECEIPT_PREFIX + memoryIntent.id) === JSON.stringify({ familyId: memoryIntent.familyId })) return null;
  } catch { /* preserve this tab's pending intent */ }
  return !stored.usable || memoryOnly ? memoryIntent : null;
};

/** Whether the pending intent survives a reload / is visible to newly opened tabs. */
export const isLogoutIntentPersisted = (): boolean => readStored() !== null;

export const hasLogoutIntent = (): boolean => readLogoutIntent() !== null;

/** Records the intent BEFORE any logout request is sent. Re-uses an existing intent. */
export const beginLogoutIntent = (familyId?: string): { intent: LogoutIntent; persisted: boolean } => {
  const existing = readLogoutIntent();
  const intent = existing ?? { id: createId(), familyId, startedAt: Date.now() };
  memoryIntent = intent;
  const persisted = existing && readStored() ? true : writeStored(intent);
  memoryOnly = !persisted;
  return { intent, persisted };
};

/** Learned from another tab's broadcast: keep this tab protected even if storage is unusable. */
export const rememberRemoteLogoutIntent = (intent?: LogoutIntent): void => {
  if (readStored()) return;
  memoryIntent = memoryIntent ?? intent ?? { id: "remote", startedAt: Date.now() };
  memoryOnly = true;
};

export const sameLogoutIntent = (a: LogoutIntent | null, b: Pick<LogoutIntent, "id" | "familyId">): boolean =>
  a !== null && a.id === b.id && a.familyId === b.familyId;

export const setLogoutRetryAt = (retryAt: number | undefined, expected?: LogoutIntent): void => {
  const intent = readLogoutIntent();
  if (!intent || (expected && !sameLogoutIntent(intent, expected))) return;
  const next = { ...intent, retryAt };
  memoryIntent = next;
  try {
    if (readStored()) getStorage()?.setItem(RETRY_PREFIX + intent.id, String(retryAt ?? 0));
  } catch { memoryOnly = true; /* retain this tab's deadline when its storage write failed */ }
};

/** Resolves this exact intent without deleting a shared pointer that another tab may replace.
 * Call only for matching server revocation or a completed explicitly authorized override. */
export const clearLogoutIntent = (expected?: LogoutIntent): boolean => {
  const current = readLogoutIntent();
  if (expected && !sameLogoutIntent(current, expected)) return false;
  memoryIntent = null;
  memoryOnly = false;
  const storage = getStorage();
  try {
    if (current) storage?.setItem(RECEIPT_PREFIX + current.id, JSON.stringify({ familyId: current.familyId }));
  } catch {
    /* the in-memory record is gone; nothing else can be done */
  }
  return readLogoutIntent() === null;
};

/** Another tab resolved the intent: drop this tab's memory copy too. */
export const forgetLogoutIntentMemory = (): void => {
  memoryIntent = null;
  memoryOnly = false;
};

/** `storage` events fire only in OTHER tabs; the originating tab updates itself directly. */
export const subscribeToLogoutIntentStorage = (
  onChange: (pending: boolean) => void,
): (() => void) => {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      onChange(hasLogoutIntent());
    } else if (event.key.startsWith(RECEIPT_PREFIX) || event.key.startsWith(RETRY_PREFIX)) {
      onChange(hasLogoutIntent());
    }
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
};
