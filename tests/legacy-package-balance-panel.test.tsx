import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LegacyPackageBalancePanel from "@/components/packages/LegacyPackageBalancePanel";
import { BooklyApiError } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/auth";
import type { LegacyPackageBalance, PackageProgress } from "@/lib/api/packages";
import { useAuthStore } from "@/lib/auth/store";
import { isLikelyVoidEligible } from "@/lib/packages/presentation";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: request,
}));

const BUSINESS = "111111111111111111111111";
const PACKAGE = "222222222222222222222222";
const BALANCE_URL = `/businesses/${BUSINESS}/bookings/packages/${PACKAGE}/balance`;
const RECORD_URL = `/businesses/${BUSINESS}/bookings/packages/${PACKAGE}/balance-payments`;

const balance = (overrides: Partial<LegacyPackageBalance> = {}): LegacyPackageBalance => ({
  packageProgressId: PACKAGE,
  originBookingId: "333333333333333333333333",
  originBookingStatus: "CANCELLED_BY_CUSTOMER",
  currency: "EUR",
  originalBalanceCents: 41_500,
  paidCents: 0,
  outstandingCents: 41_500,
  settlementStatus: "NOT_RECORDED",
  balanceSettled: false,
  recordable: true,
  payments: [],
  ...overrides,
});

let host: HTMLDivElement;
let root: Root;
let client: QueryClient;

const signIn = (role: AuthUser["role"]) =>
  useAuthStore.setState({
    status: "authenticated",
    user: { id: "user", role } as AuthUser,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  });

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

const render = async () => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <LegacyPackageBalancePanel businessId={BUSINESS} packageId={PACKAGE} />
      </QueryClientProvider>,
    );
  });
  await flush();
};

const button = (text: string) =>
  Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes(text));
const click = async (text: string) => {
  const target = button(text);
  if (!target) throw new Error(`No button "${text}" in: ${host.textContent}`);
  await act(async () => { target.click(); });
  await flush();
};
const typeInto = async (label: string, value: string) => {
  const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!input) throw new Error(`No input ${label}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const choosePartial = async () => {
  const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  await act(async () => { radios[1]?.click(); });
};
const recordCalls = () =>
  request.mock.calls
    .map(([config]) => config as AxiosRequestConfig)
    .filter((config) => config.method === "POST" && config.url === RECORD_URL);

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  request.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  client.clear();
  useAuthStore.setState({ status: "unauthenticated", user: null });
  vi.unstubAllGlobals();
});

describe("Fix #3 — Legacy Package balance panel", () => {
  it("shows the server balance and records the full outstanding amount bound to what was displayed", async () => {
    signIn("BUSINESS_OWNER");
    let current = balance();
    request.mockImplementation(async (config: AxiosRequestConfig) => {
      if (config.method === "GET" && config.url === BALANCE_URL) return current;
      if (config.method === "POST" && config.url === RECORD_URL) {
        current = balance({
          paidCents: 41_500,
          outstandingCents: 0,
          settlementStatus: "PAID_IN_FULL",
          balanceSettled: true,
          recordable: false,
          blockedReason: "SETTLED",
          payments: [{ amountCents: 41_500, recordedAt: "2030-08-22T09:00:00.000Z", source: "BALANCE_RECORDING" }],
        });
        return current;
      }
      throw new Error(`unexpected ${config.method} ${config.url}`);
    });
    await render();
    expect(host.textContent).toContain("Balance due at venue€415.00");
    expect(host.textContent).toContain("Outstanding€415.00");
    expect(host.textContent).toContain("Not yet recorded");

    await click("Record venue payment");
    expect(recordCalls()).toHaveLength(0);
    expect(host.textContent).toContain("Record €415.00 received at the venue?");
    await click("Confirm payment");

    const [call] = recordCalls();
    expect(call?.data).toMatchObject({ settlement: "FULL", expectedOutstandingCents: 41_500 });
    expect(call?.data).not.toHaveProperty("amountCents");
    expect(typeof (call?.data as { idempotencyKey?: unknown }).idempotencyKey).toBe("string");
    expect(host.textContent).toContain("Paid in full");
    expect(host.textContent).toContain("The customer can schedule their remaining sessions");
    expect(button("Record venue payment")).toBeUndefined();
  });

  it("validates a partial amount exactly and never sends an amount at or above the outstanding balance", async () => {
    signIn("BUSINESS_OWNER");
    let current = balance();
    request.mockImplementation(async (config: AxiosRequestConfig) => {
      if (config.method === "POST")
        current = balance({ paidCents: 10_000, outstandingCents: 31_500, settlementStatus: "PARTIALLY_PAID" });
      return current;
    });
    await render();
    await choosePartial();
    for (const bad of ["415", "500", "0", "12.345", "abc"]) {
      await typeInto("Amount received", bad);
      await click("Record venue payment");
      expect(host.querySelector('[role="alert"]')).not.toBeNull();
    }
    expect(recordCalls()).toHaveLength(0);
    await typeInto("Amount received", "100.00");
    await click("Record venue payment");
    await click("Confirm payment");
    expect(recordCalls()[0]?.data).toMatchObject({
      settlement: "PARTIAL",
      amountCents: 10_000,
      expectedOutstandingCents: 41_500,
    });
    expect(host.textContent).toContain("Partially paid");
    expect(host.textContent).toContain("Outstanding€315.00");
    expect(button("Record venue payment")).toBeDefined();
  });

  it("retries a lost response with the same key, and re-reads the balance after a changed-balance refusal", async () => {
    signIn("BUSINESS_OWNER");
    let reads = 0;
    let posts = 0;
    request.mockImplementation(async (config: AxiosRequestConfig) => {
      if (config.method === "GET") {
        reads += 1;
        return reads === 1 ? balance() : balance({ paidCents: 1_000, outstandingCents: 40_500, settlementStatus: "PARTIALLY_PAID" });
      }
      posts += 1;
      if (posts === 1) throw new BooklyApiError({ message: "Network Error" });
      throw new BooklyApiError({ message: "changed", status: 409, code: "PACKAGE_BALANCE_CHANGED" });
    });
    await render();
    await click("Record venue payment");
    await click("Confirm payment");
    await click("Confirm payment");
    const [first, second] = recordCalls();
    expect((first?.data as { idempotencyKey: string }).idempotencyKey).toBe(
      (second?.data as { idempotencyKey: string }).idempotencyKey,
    );
    expect(reads).toBeGreaterThanOrEqual(2);
    expect(host.textContent).toContain("Outstanding€405.00");
    expect(host.textContent).not.toContain("Record €415.00 received");
  });

  it("explains a blocked balance without offering a recording action", async () => {
    signIn("BUSINESS_OWNER");
    request.mockResolvedValue(balance({ recordable: false, blockedReason: "UPFRONT_REVERSED", originBookingStatus: "CANCELLED_BY_BUSINESS" }));
    await render();
    expect(host.textContent).toContain("refunded or disputed");
    expect(button("Record venue payment")).toBeUndefined();
  });

  it.each(["SUPERVISOR", "STAFF", "CUSTOMER"] as const)("renders nothing and requests nothing for %s", async (role) => {
    signIn(role);
    request.mockResolvedValue(balance());
    await render();
    expect(host.textContent).toBe("");
    expect(request).not.toHaveBeenCalled();
  });

  it("does not offer the unused-package refund once a venue payment is recorded", () => {
    const pkg = {
      status: "AWAITING_BALANCE",
      sessions: [{ sessionIndex: 1, bookingId: "b", status: "CANCELLED", booking: null }],
    } as unknown as PackageProgress;
    expect(isLikelyVoidEligible(pkg)).toBe(true);
    expect(isLikelyVoidEligible({ ...pkg, balancePaymentRecorded: true })).toBe(false);
  });
});
