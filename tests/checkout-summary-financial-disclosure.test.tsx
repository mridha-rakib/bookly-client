import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CheckoutSummaryAside from "@/app/venue/components/CheckoutSummaryAside";
import type { BookingCreationPreview } from "@/lib/api/bookings";
import { formatBookingMoney } from "@/lib/bookings/format";

// Only visual dependencies are stubbed; the real financial renderer and formatter run.
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

function quote(total = 10000, upfront = 2000, tax = 380, travel = 0): BookingCreationPreview {
  return {
    finalizable: true, isFirstBooking: upfront > 0, taxMode: "PRE_ACTIVATION",
    business: { id: "business", name: "Business", timezone: "Europe/Nicosia" },
    schedule: { timezone: "Europe/Nicosia", startAt: "2030-08-20T07:00:00Z", endAt: "2030-08-20T08:00:00Z" },
    fulfilment: { mode: travel ? "TRAVEL_TO_CUSTOMER" : "AT_BUSINESS_LOCATION" },
    serviceLines: [{ serviceId: "service", staffMembershipId: "staff",
      serviceSnapshot: { name: "Service", pricingMode: "FIXED", durationMin: 60 }, addons: [], amountCents: total - travel }],
    financials: { currency: "EUR", servicesSubtotalCents: total - travel, addonsSubtotalCents: 0,
      serviceDiscountCents: 0, travelFeeCents: travel, eligiblePlatformFeeBasisCents: total - travel,
      platformFeeCents: upfront, depositCents: upfront, totalCents: total, balanceDueCents: total - upfront },
    preTaxChargeCents: upfront, taxCents: tax, dueNowCents: upfront, balanceDueCents: total - upfront,
    requiresSavedCard: true, hasSavedCard: true,
  };
}

describe("checkout pre-activation financial disclosure", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("innerWidth", 1440);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function render(preview?: BookingCreationPreview, props: Partial<ComponentProps<typeof CheckoutSummaryAside>> = {}) {
    await act(async () => root.render(createElement(CheckoutSummaryAside, {
      bookingStep: "payment", preview, showPolicy: true, setShowPolicy: vi.fn(),
      onContinue: vi.fn(), canContinue: Boolean(preview), ...props,
    })));
  }
  function amount(scope: Element, label: string) {
    const text = Array.from(scope.querySelectorAll("span")).find(el => el.textContent === label);
    expect(text, label).toBeDefined();
    return text!.parentElement!.querySelectorAll("span")[1]?.textContent;
  }
  function assertAmounts(scope: Element, total: number, due: number, remaining: number, tax: number) {
    expect(amount(scope, "Booking total")).toBe(formatBookingMoney(total));
    expect(amount(scope, "Due now")).toBe(formatBookingMoney(due));
    const upfrontLabel = Array.from(scope.querySelectorAll("span")).find(el => el.textContent === "Upfront payment")!;
    expect(upfrontLabel.parentElement!.parentElement!.lastElementChild!.textContent).toBe(formatBookingMoney(due));
    expect(amount(scope, "Remaining at appointment")).toBe(formatBookingMoney(remaining));
    const info = scope.querySelector('[aria-label="Calculated VAT information"]')!;
    expect(info.textContent).toContain(formatBookingMoney(tax));
    expect(info.textContent).toContain("Informational only — not charged in this checkout.");
  }

  it.each([
    ["FIRST ordinary", 10000, 2000, 380, 0, false],
    ["RETURNING ordinary", 10000, 0, 0, 0, false],
    ["FIRST package", 16000, 3200, 608, 0, true],
    ["RETURNING package", 16000, 0, 0, 0, true],
    ["FIRST travel", 11000, 2000, 380, 1000, false],
    ["RETURNING travel", 11000, 0, 0, 1000, false],
    ["FIRST zero calculated VAT", 10000, 2000, 0, 0, false],
  ] as const)("renders %s without adding VAT to payable amounts", async (_name, total, due, tax, travel, pkg) => {
    await render(quote(total, due, tax, travel), { isPackagePurchase: pkg, packageSessionsTotal: pkg ? 5 : undefined });
    const aside = container.querySelector("aside")!;
    assertAmounts(aside, total, due, total - due, tax);
    expect(aside.textContent).not.toMatch(/before VAT|at the venue|cash or card/);
    if (travel) expect(amount(aside, "Travel fee")).toBe(formatBookingMoney(travel));
  });

  it.each([1500, 0])("renders a server-discounted promo booking with %i due now", async due => {
    const preview = quote(7500, due, due ? 285 : 0);
    preview.financials.servicesSubtotalCents = 10000;
    preview.promo = { code: "SAVE25", type: "FIXED", value: 2500, promoEligibleBaseCents: 10000, discountCents: 2500 };
    await render(preview);
    assertAmounts(container.querySelector("aside")!, 7500, due, 7500 - due, due ? 285 : 0);
    expect(container.textContent).toContain("Promo discount (SAVE25)");
  });

  it.each([false, true])("does not fabricate financial amounts without a quote (failed=%s)", async failed => {
    await render(undefined, { previewError: failed });
    for (const label of ["Booking total", "Due now", "Remaining at appointment"])
      expect(amount(container.querySelector("aside")!, label)).toBe("—");
    expect(container.textContent).not.toContain("€0.00");
    expect(container.textContent).not.toContain("not charged in this checkout");
    const confirm = Array.from(container.querySelectorAll("button")).find(button => button.textContent === "Confirm")!;
    expect(confirm.disabled).toBe(true);
  });

  it("does not invent a disclosure phase for an older response", async () => {
    const preview = quote();
    Reflect.deleteProperty(preview, "taxMode");
    await render(preview);
    const info = container.querySelector('[aria-label="Calculated VAT information"]')!;
    expect(info.textContent).toContain("unavailable until a supported quote is obtained");
    expect(info.textContent).not.toContain(formatBookingMoney(380));
  });

  it("keeps the mobile footer due now and expanded drawer disclosure consistent", async () => {
    vi.stubGlobal("innerWidth", 375);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 600, bottom: 50 } as DOMRect);
    const onContinue = vi.fn();
    await render(quote(), { onContinue });
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Toggle booking price summary"]')!;
    expect(toggle.textContent).toContain(formatBookingMoney(2000));
    expect(toggle.textContent).not.toContain(formatBookingMoney(2380));
    await act(async () => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelectorAll('[aria-label="Calculated VAT information"]')).toHaveLength(2);
    const drawer = container.querySelector("h2")!.parentElement!.parentElement!.parentElement!;
    assertAmounts(drawer, 10000, 2000, 8000, 380);
    const confirm = Array.from(container.querySelectorAll("button")).filter(button => button.textContent === "Confirm").at(-1)!;
    await act(async () => confirm.click());
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it.each([
    { canContinue: false, isSubmitting: false },
    { canContinue: true, isSubmitting: true },
  ])("preserves desktop and mobile confirmation gates: %o", async gates => {
    vi.stubGlobal("innerWidth", 375);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 600, bottom: 50 } as DOMRect);
    const onContinue = vi.fn();
    await render(quote(), { ...gates, onContinue });
    const buttons = Array.from(container.querySelectorAll("button")).filter(button =>
      button.textContent === "Confirm" || button.textContent === "Confirming…");
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button.disabled).toBe(true);
      await act(async () => button.click());
    }
    expect(onContinue).not.toHaveBeenCalled();
  });
});
