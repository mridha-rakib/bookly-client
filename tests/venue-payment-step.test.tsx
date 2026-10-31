import React, { act, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import PaymentStep from "@/app/venue/components/PaymentStep";
import { paymentsApi, type SavedCardStatus } from "@/lib/api/payments";
import { bookingsApi } from "@/lib/api/bookings";
import { useAuthStore } from "@/lib/auth/store";

type SavedCard = { brand: string; last4: string };
const fx = vi.hoisted(() => ({
  readiness: vi.fn(), replacement: vi.fn(), navigate: vi.fn(), notes: vi.fn(),
  saveCallbacks: [] as Array<(card: SavedCard) => void>,
}));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: () => null }));
// Only the existing Stripe child is substituted. Exercise real PaymentStep request/lifetime logic.
vi.mock("@/components/payments/CardCollectionForm", () => ({
  CardCollectionForm: ({ onSaved, onCancel }: { onSaved: (card: SavedCard) => void; onCancel: () => void }) => {
    fx.saveCallbacks.push(onSaved);
    return <>
      <button type="button" onClick={() => onSaved({ brand: "mastercard", last4: "4444" })}>Save test card</button>
      <button type="button" onClick={onCancel}>Cancel test card</button>
    </>;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const originalAuth = useAuthStore.getState();
const existingCard: SavedCardStatus = {
  hasSavedCard: true, card: { brand: "visa", last4: "1111", expMonth: 7, expYear: 2031 },
};
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("Uninitialized deferred"); };
  let reject: (reason: Error) => void = () => { throw new Error("Uninitialized deferred"); };
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function Harness({ initiallyReady = false }: { initiallyReady?: boolean }) {
  const [ready, setReady] = useState(initiallyReady);
  const [replacing, setReplacing] = useState(false);
  const [notes, setNotes] = useState("Existing booking note");
  const updateReady = useCallback((value: boolean) => { fx.readiness(value); setReady(value); }, []);
  const updateReplacing = useCallback((value: boolean) => { fx.replacement(value); setReplacing(value); }, []);
  return <>
    <output data-testid="readiness">{String(ready)}</output>
    <PaymentStep hasSavedCard={ready} setHasSavedCard={updateReady}
      isReplacingCard={replacing} setIsReplacingCard={updateReplacing}
      setBookingStep={fx.navigate} notes={notes}
      setNotes={(value) => { fx.notes(value); setNotes(value); }} />
  </>;
}
function authenticate(id = "customer-a") {
  useAuthStore.setState({
    user: { id, email: `${id}@example.com`, role: "CUSTOMER", status: "ACTIVE" },
    status: "authenticated", isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  });
}
let host: HTMLDivElement, root: Root, unmounted: boolean;
const flush = async () => {
  await act(async () => { await new Promise((done) => setTimeout(done, 20)); });
};
async function mount(initiallyReady = false) {
  await act(async () => root.render(<Harness initiallyReady={initiallyReady} />)); await flush();
}
function button(label: string) {
  const node = [...host.querySelectorAll("button")].find((item) =>
    item.getAttribute("aria-label") === label || item.textContent === label);
  if (!node) throw new Error(`Missing button: ${label}`);
  return node;
}
async function click(label: string) {
  await act(async () => button(label).click()); await flush();
}
function latestSave() {
  const save = fx.saveCallbacks.at(-1);
  if (!save) throw new Error("Card collection is not mounted");
  return save;
}
const readiness = () => host.querySelector('[data-testid="readiness"]')?.textContent;

beforeEach(() => {
  authenticate();
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host); unmounted = false;
  fx.readiness.mockReset(); fx.replacement.mockReset(); fx.navigate.mockReset(); fx.notes.mockReset();
  fx.saveCallbacks.length = 0;
  vi.spyOn(paymentsApi, "getSavedCardStatus").mockResolvedValue(existingCard);
  vi.spyOn(paymentsApi, "createSetupIntent");
  vi.spyOn(paymentsApi, "confirmSavedPaymentMethod");
  vi.spyOn(bookingsApi, "finalizeCustomerBooking");
});
afterEach(async () => {
  if (!unmounted) await act(async () => root.unmount());
  host.remove(); vi.restoreAllMocks(); useAuthStore.setState(originalAuth);
});

it("loads and displays the actual saved card and expiry", async () => {
  await mount();
  expect(paymentsApi.getSavedCardStatus).toHaveBeenCalledTimes(1);
  expect(readiness()).toBe("true");
  expect(host.textContent).toContain("1111"); expect(host.textContent).toContain("Expires 07/31");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("treats confirmed absence separately from unknown status", async () => {
  vi.mocked(paymentsApi.getSavedCardStatus).mockResolvedValue({ hasSavedCard: false });
  await mount();
  expect(readiness()).toBe("false"); expect(button("Save test card")).toBeDefined();
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(host.querySelector('[aria-label="Retry saved card status"]')).toBeNull();
});

it("shows loading without inventing saved-card readiness from a previous parent value", async () => {
  const read = deferred<SavedCardStatus>();
  vi.mocked(paymentsApi.getSavedCardStatus).mockReturnValue(read.promise);
  await mount(true);
  expect(readiness()).toBe("false");
  expect(host.querySelector('[role="status"]')?.textContent).toContain("Loading saved card status");
  expect(button("Retry saved card status").disabled).toBe(true);
  expect(fx.readiness).not.toHaveBeenCalledWith(true);
  await act(async () => read.resolve(existingCard)); await flush();
  expect(readiness()).toBe("true");
});

it("shows an accessible failure and explicitly retries only the status GET", async () => {
  vi.mocked(paymentsApi.getSavedCardStatus).mockRejectedValueOnce(new Error("offline"));
  await mount();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("status could not be loaded");
  expect(host.textContent).toContain("Your saved card has not been changed");
  expect(button("Retry saved card status").disabled).toBe(false);
  await click("Retry saved card status");
  expect(paymentsApi.getSavedCardStatus).toHaveBeenCalledTimes(2);
  expect(readiness()).toBe("true"); expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(paymentsApi.createSetupIntent).not.toHaveBeenCalled();
  expect(paymentsApi.confirmSavedPaymentMethod).not.toHaveBeenCalled();
  expect(bookingsApi.finalizeCustomerBooking).not.toHaveBeenCalled();
});

it("does not overlap retry reads even for synchronous duplicate clicks", async () => {
  const read = deferred<SavedCardStatus>();
  vi.mocked(paymentsApi.getSavedCardStatus).mockRejectedValueOnce(new Error("offline"))
    .mockReturnValueOnce(read.promise);
  await mount();
  await act(async () => { button("Retry saved card status").click(); button("Retry saved card status").click(); });
  await flush();
  expect(paymentsApi.getSavedCardStatus).toHaveBeenCalledTimes(2);
  expect(button("Retry saved card status").disabled).toBe(true);
  expect(button("Retry saved card status").getAttribute("aria-busy")).toBe("true");
  await click("Retry saved card status");
  expect(paymentsApi.getSavedCardStatus).toHaveBeenCalledTimes(2);
  await act(async () => read.resolve(existingCard)); await flush();
  expect(readiness()).toBe("true");
});

it.each(["resolve", "reject"] as const)("a newer card save supersedes an initial read that later %s", async (outcome) => {
  const read = deferred<SavedCardStatus>();
  vi.mocked(paymentsApi.getSavedCardStatus).mockReturnValue(read.promise);
  await mount(); await click("Save test card");
  const calls = fx.readiness.mock.calls.length;
  await act(async () => {
    if (outcome === "resolve") read.resolve({ hasSavedCard: false });
    else read.reject(new Error("late failure"));
  }); await flush();
  expect(readiness()).toBe("true"); expect(host.textContent).toContain("4444");
  expect(host.textContent).not.toContain("Expires");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(fx.readiness).toHaveBeenCalledTimes(calls);
});

it("a delayed retry cannot overwrite a newer saved replacement", async () => {
  const read = deferred<SavedCardStatus>();
  vi.mocked(paymentsApi.getSavedCardStatus).mockRejectedValueOnce(new Error("offline"))
    .mockReturnValueOnce(read.promise);
  await mount(); await click("Retry saved card status");
  await click("Save test card"); await click("Replace card");
  await act(async () => latestSave()({ brand: "amex", last4: "5555" })); await flush();
  await act(async () => read.resolve(existingCard)); await flush();
  expect(readiness()).toBe("true"); expect(host.textContent).toContain("5555");
  expect(host.textContent).not.toContain("1111"); expect(host.textContent).not.toContain("4444");
  expect(host.querySelector('[role="alert"]')).toBeNull();
});

it("does not start the deferred initial read after a card has already been saved", async () => {
  vi.useFakeTimers();
  try {
    act(() => root.render(<Harness />));
    act(() => button("Save test card").click());
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    expect(paymentsApi.getSavedCardStatus).not.toHaveBeenCalled();
    expect(readiness()).toBe("true"); expect(host.textContent).toContain("4444");
  } finally {
    vi.useRealTimers();
  }
});

it("does not update the parent after unmount, from either a read or a retained save callback", async () => {
  const read = deferred<SavedCardStatus>();
  vi.mocked(paymentsApi.getSavedCardStatus).mockReturnValue(read.promise);
  await mount(); const saved = latestSave();
  await act(async () => root.unmount()); unmounted = true;
  fx.readiness.mockClear(); fx.replacement.mockClear();
  await act(async () => { saved({ brand: "amex", last4: "5555" }); read.resolve(existingCard); }); await flush();
  expect(fx.readiness).not.toHaveBeenCalled(); expect(fx.replacement).not.toHaveBeenCalled();
});

it.each(["account", "session"] as const)("rejects obsolete callbacks across a changed %s", async (change) => {
  const old = deferred<SavedCardStatus>(), current = deferred<SavedCardStatus>();
  vi.mocked(paymentsApi.getSavedCardStatus).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  await mount(); const oldSave = latestSave();
  await act(async () => authenticate(change === "account" ? "customer-b" : "customer-a")); await flush();
  expect(paymentsApi.getSavedCardStatus).toHaveBeenCalledTimes(2);
  const calls = fx.readiness.mock.calls.length;
  await act(async () => {
    oldSave({ brand: "visa", last4: "9999" }); old.resolve(existingCard);
  }); await flush();
  expect(fx.readiness).toHaveBeenCalledTimes(calls); expect(readiness()).toBe("false");
  expect(host.textContent).not.toContain("9999"); expect(host.textContent).not.toContain("1111");
  expect(button("Retry saved card status").disabled).toBe(true);
  await act(async () => current.resolve({ hasSavedCard: true,
    card: { brand: "amex", last4: "2222", expMonth: 8, expYear: 2032 } })); await flush();
  expect(readiness()).toBe("true"); expect(host.textContent).toContain("2222");
});

it("preserves card replacement, cancellation and navigation callbacks", async () => {
  await mount(); await click("Replace card");
  expect(fx.replacement).toHaveBeenLastCalledWith(true);
  await click("Cancel test card");
  expect(fx.replacement).toHaveBeenLastCalledWith(false);
  expect(host.textContent).toContain("1111");
  await click("Cancel"); expect(fx.navigate).toHaveBeenCalledExactlyOnceWith("time");
});

it("keeps Booking notes and their existing maximum length", async () => {
  await mount();
  const input = host.querySelector("textarea");
  if (!input) throw new Error("Missing Booking notes");
  expect(input.value).toBe("Existing booking note"); expect(input.maxLength).toBe(2000);
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
  const setValue = descriptor?.set;
  if (!setValue) throw new Error("Missing textarea value setter");
  await act(async () => {
    setValue.call(input, "Updated booking note");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(fx.notes).toHaveBeenCalledWith("Updated booking note");
  expect(input.value).toBe("Updated booking note");
});

it("does not accept hasSavedCard without the corresponding card details", async () => {
  vi.mocked(paymentsApi.getSavedCardStatus).mockResolvedValue({ hasSavedCard: true });
  await mount();
  expect(readiness()).toBe("false"); expect(host.querySelector('[role="alert"]')).not.toBeNull();
  expect(fx.readiness).not.toHaveBeenCalledWith(true);
});
