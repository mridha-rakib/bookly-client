import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LegacyPackageRecovery from "@/components/packages/LegacyPackageRecovery";
import { apiRequest } from "@/lib/api/client";
import { packagesApi } from "@/lib/api/packages";
import { useAuthStore } from "@/lib/auth/store";
import { getStripe } from "@/lib/payments/stripe-client";
import { continueLegacyRecovery, LEGACY_BODY_TTL, LEGACY_POINTER_TTL, readLegacyRecovery,
  resolveLegacyRecovery, saveLegacyRecovery, type LegacyStatus, type LegacyRecord } from "@/lib/packages/legacy-recovery";

vi.mock("@/lib/api/client", async (original) => ({ ...await original<object>(), apiRequest: vi.fn() }));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: vi.fn() }));
const customer = "1".repeat(24), business = "2".repeat(24), service = "3".repeat(24), progress = "4".repeat(24), staff = "5".repeat(24), booking = "6".repeat(24);
const input = { idempotencyKey: "original-legacy", startAt: "2030-08-21T07:00:00.000Z", serviceLines: [{ serviceId: service, staffMembershipId: staff, addonIds: [], pricingInput: {} }] };
const redemption = { idempotencyKey: "original-redemption", startAt: input.startAt, staffMembershipId: staff, addonIds: [] };
const save = (kind: "PACKAGE_PURCHASE" | "PACKAGE_REDEMPTION" = "PACKAGE_PURCHASE") => saveLegacyRecovery(customer, business, kind,
  kind === "PACKAGE_PURCHASE" ? service : progress, kind === "PACKAGE_PURCHASE" ? input : redemption);
const status = (record: LegacyRecord, state: LegacyStatus["state"] = "NOT_OBSERVED", extra: Partial<LegacyStatus> = {}): LegacyStatus => ({
  state, businessId: record.businessId, kind: record.kind, packageId: record.packageId, idempotencyKey: record.idempotencyKey,
  canDismiss: state === "COMMITTED", canResume: state !== "COMMITTED", ...(state === "COMMITTED" ? { bookingId: booking, packageProgressId: progress } : {}), ...extra,
});
let root: Root | undefined, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.mocked(apiRequest).mockReset(); vi.mocked(getStripe).mockReset();
  localStorage.clear(); sessionStorage.clear();
  useAuthStore.setState({ status: "authenticated", isInitializing: false, cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
    user: { id: customer, role: "CUSTOMER", email: "legacy@example.test", status: "ACTIVE" } });
  host = document.createElement("div"); document.body.append(host);
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; host.remove(); vi.restoreAllMocks(); });
const render = async () => { root = createRoot(host); await act(async () => { root!.render(<QueryClientProvider client={new QueryClient()}><LegacyPackageRecovery /></QueryClientProvider>); }); };
const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === label);
  expect(button).toBeTruthy(); await act(async () => button!.click());
};

it.each(["PACKAGE_PURCHASE", "PACKAGE_REDEMPTION"] as const)("retains original %s key on lost response and checks before same-key replay", async (kind) => {
  const record = save(kind);
  let reads = 0, writes = 0;
  vi.mocked(apiRequest).mockImplementation(async (request) => {
    if (request.method === "GET") { reads++; return status(record, writes === 2 ? "COMMITTED" : "NOT_OBSERVED") as never; }
    writes++;
    expect(request.data).toEqual(record.input);
    if (writes === 1) throw Error("Synthetic lost HTTP response");
    return { id: booking } as never;
  });
  await expect(continueLegacyRecovery(record, () => true)).rejects.toThrow("Synthetic lost HTTP response");
  expect(readLegacyRecovery(customer)[0]?.record?.input.idempotencyKey).toBe(record.idempotencyKey);
  expect(await continueLegacyRecovery(record, () => true)).toMatchObject({ state: "COMMITTED", bookingId: booking, packageProgressId: progress });
  expect(reads).toBe(3); expect(writes).toBe(2);
  const calls = vi.mocked(apiRequest).mock.calls.map(([request]) => request);
  expect(calls[0]).toMatchObject({ method: "GET", url: `/businesses/${business}/bookings/packages/operations/status`,
    params: { kind, packageId: record.packageId, idempotencyKey: record.idempotencyKey } });
  expect(calls.filter((r) => r.method === "POST").map((r) => r.url)).toEqual(kind === "PACKAGE_PURCHASE"
    ? [`/businesses/${business}/bookings/packages/purchase`, `/businesses/${business}/bookings/packages/purchase`]
    : [`/businesses/${business}/bookings/packages/${progress}/sessions`, `/businesses/${business}/bookings/packages/${progress}/sessions`]);
});

it.each(["PACKAGE_PURCHASE", "PACKAGE_REDEMPTION"] as const)("refresh recovers committed %s read-only without another mutation", async (kind) => {
  const record = save(kind);
  sessionStorage.clear(); // A restored browser can retain only the narrow identity pointer.
  vi.mocked(apiRequest).mockResolvedValue(status(record, "COMMITTED"));
  await render();
  expect(host.textContent).toContain("Your original booking is confirmed");
  expect(host.querySelector("a")?.getAttribute("href")).toBe(`/customer/bookings/view?id=${booking}`);
  expect(vi.mocked(apiRequest).mock.calls.every(([r]) => r.method === "GET")).toBe(true);
  await click("Dismiss resolved package request");
  expect(readLegacyRecovery(customer)).toHaveLength(0);
});

it("later UI retry observes a committed response loss instead of dispatching again", async () => {
  const record = save("PACKAGE_REDEMPTION");
  vi.mocked(apiRequest).mockResolvedValue(status(record, "COMMITTED"));
  expect((await continueLegacyRecovery(record, () => true)).bookingId).toBe(booking);
  expect(apiRequest).toHaveBeenCalledTimes(1);
  expect(readLegacyRecovery(customer)).toHaveLength(1);
});

it.each(["UNRESOLVED", "PAYMENT_PROCESSING", "FINALIZATION_PENDING", "REFUND_PENDING", "RECONCILIATION_REQUIRED"] as const)("%s blocks replacement operations and never invents success", async (state) => {
  const record = save();
  vi.mocked(apiRequest).mockResolvedValue(status(record, state, { canResume: false }));
  await expect(continueLegacyRecovery(record, () => true)).rejects.toThrow("pending recovery");
  expect(() => saveLegacyRecovery(customer, business, "PACKAGE_REDEMPTION", progress, redemption)).toThrow("Resolve the original");
  expect(() => resolveLegacyRecovery(record, status(record, state, { canDismiss: false }))).toThrow("unresolved");
  expect(vi.mocked(apiRequest).mock.calls.every(([r]) => r.method === "GET")).toBe(true);
});

it("status outage preserves the operation and does not dispatch", async () => {
  const record = save(); vi.mocked(apiRequest).mockRejectedValue(Error("Synthetic status outage"));
  await expect(continueLegacyRecovery(record, () => true)).rejects.toThrow("status outage");
  expect(readLegacyRecovery(customer)).toHaveLength(1);
  expect(apiRequest).toHaveBeenCalledTimes(1);
});

it.each(["PACKAGE_PURCHASE", "PACKAGE_REDEMPTION"] as const)("3DS interruption and resume keeps original %s request and never persists secrets", async (kind) => {
  const record = save(kind); let writes = 0;
  vi.mocked(apiRequest).mockImplementation(async (request) => {
    if (request.method === "GET") return status(record, writes === 3 ? "COMMITTED" : "AUTHENTICATION_REQUIRED") as never;
    writes++; return (writes === 3 ? { id: booking } : { status: "requires_action", clientSecret: "ephemeral-test-secret" }) as never;
  });
  const confirm = vi.fn().mockResolvedValueOnce({ error: { message: "Interrupted challenge" } }).mockResolvedValueOnce({});
  vi.mocked(getStripe).mockResolvedValue({ confirmCardPayment: confirm } as never);
  await expect(continueLegacyRecovery(record, () => true)).rejects.toThrow("Interrupted challenge");
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain("ephemeral-test-secret");
  expect((await continueLegacyRecovery(record, () => true)).state).toBe("COMMITTED");
  expect(vi.mocked(apiRequest).mock.calls.filter(([r]) => r.method === "POST").every(([r]) => JSON.stringify(r.data) === JSON.stringify(record.input))).toBe(true);
});

it.each(["businessId", "kind", "packageId", "idempotencyKey"] as const)("status identity mismatch %s never dispatches or resolves", async (field) => {
  const record = save(); const mismatched = { ...status(record, "COMMITTED"), [field]: "wrong" };
  vi.mocked(apiRequest).mockResolvedValue(mismatched);
  await expect(continueLegacyRecovery(record, () => true)).rejects.toThrow("did not match");
  expect(readLegacyRecovery(customer)).toHaveLength(1);
});

it.each([LEGACY_BODY_TTL, LEGACY_POINTER_TTL])( "expired data at %i ms allows status only and blocks a fresh key", async (age) => {
  const record = save(); const saved = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(saved + age + 1);
  const retained = readLegacyRecovery(customer)[0];
  expect(retained?.record).toBeUndefined();
  expect(retained?.pointer.idempotencyKey).toBe(record.idempotencyKey);
  await expect(continueLegacyRecovery(record, () => true)).rejects.toThrow("Only status recovery");
  expect(() => save()).toThrow("Resolve the original");
});

it("corrupt pointer fails closed and corrupt body permits only status", async () => {
  const record = save(); const key = Object.keys(localStorage)[0];
  sessionStorage.setItem(key, '{"cardNumber":"do-not-restore"}');
  expect(readLegacyRecovery(customer)[0]?.record).toBeUndefined();
  await expect(continueLegacyRecovery(record, () => true)).rejects.toThrow("Only status recovery");
  localStorage.setItem(key, "not JSON");
  expect(() => save()).toThrow();
  await render(); expect(host.textContent).toContain("Contact support"); expect(apiRequest).not.toHaveBeenCalled();
});

it("forbidden credential fields are rejected before storage or dispatch", () => {
  expect(() => saveLegacyRecovery(customer, business, "PACKAGE_PURCHASE", service, { ...input, clientSecret: "secret" } as never)).toThrow();
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
});

it("storage failure removes partial recovery data and sends no package request", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw Error("storage full"); });
  expect(() => save()).toThrow("No package request was sent");
  expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0); expect(apiRequest).not.toHaveBeenCalled();
});

it.each(["logout", "account", "same-user-new-session"] as const)("%s during status read fences all later mutation and success", async (mode) => {
  const record = save(); let resolve!: (value: LegacyStatus) => void;
  vi.mocked(apiRequest).mockReturnValue(new Promise<LegacyStatus>((done) => { resolve = done; }));
  const task = continueLegacyRecovery(record, () => true);
  useAuthStore.setState(mode === "logout" ? { status: "unauthenticated", user: null } :
    mode === "account" ? { user: { id: "7".repeat(24), role: "CUSTOMER", email: "other@example.test", status: "ACTIVE" } } :
    { cacheEpoch: useAuthStore.getState().cacheEpoch + 1 });
  resolve(status(record));
  await expect(task).rejects.toThrow("original account");
  expect(apiRequest).toHaveBeenCalledTimes(1);
  if (mode === "account") expect(readLegacyRecovery("7".repeat(24))).toHaveLength(0);
});

it("double click on Continue dispatches only one original mutation", async () => {
  const record = save("PACKAGE_REDEMPTION"); let finish!: (value: object) => void; let writes = 0;
  vi.mocked(apiRequest).mockImplementation(async (request) => {
    if (request.method === "GET") return status(record, writes ? "COMMITTED" : "NOT_OBSERVED") as never;
    writes++; return new Promise((resolve) => { finish = resolve; }) as never;
  });
  await render();
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === "Continue original package request")!;
  await act(async () => { button.click(); button.click(); });
  expect(writes).toBe(1);
  await act(async () => finish({ id: booking }));
  expect(host.textContent).toContain("original booking is confirmed");
});

it("real legacy status transport preserves explicit operation kind and package selector", async () => {
  vi.mocked(apiRequest).mockResolvedValue({});
  await packagesApi.operationStatus(business, "PACKAGE_REDEMPTION", progress, "key");
  expect(apiRequest).toHaveBeenCalledWith({ method: "GET", url: `/businesses/${business}/bookings/packages/operations/status`,
    params: { kind: "PACKAGE_REDEMPTION", packageId: progress, idempotencyKey: "key" } });
});
