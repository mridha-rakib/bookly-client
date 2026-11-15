import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CardCollectionForm } from "@/components/payments/CardCollectionForm";

const fx = vi.hoisted(() => ({ create: vi.fn(), confirm: vi.fn(), save: vi.fn() }));
vi.mock("@stripe/react-stripe-js", () => ({ CardCvcElement: () => null, CardExpiryElement: () => null, CardNumberElement: () => null, useElements: () => ({ getElement: () => ({}) }), useStripe: () => ({ confirmCardSetup: fx.confirm }) }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/lib/api/payments", () => ({ paymentsApi: { createSetupIntent: fx.create, confirmSavedPaymentMethod: fx.save } }));

let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); fx.create.mockReset(); fx.confirm.mockReset(); fx.save.mockReset(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it("sends one setup request on rapid clicks and reports success only after server confirmation", async () => {
  let release!: (value: { clientSecret: string }) => void;
  fx.create.mockReturnValue(new Promise(resolve => { release = resolve; }));
  fx.confirm.mockResolvedValue({ setupIntent: { id: "synthetic" } });
  fx.save.mockResolvedValue({ brand: "visa", last4: "4242" });
  const onSaved = vi.fn();
  act(() => root.render(<CardCollectionForm onSaved={onSaved} onCancel={() => {}} />));
  const button = [...host.querySelectorAll("button")].find(item => item.textContent === "Save card")!;
  act(() => { button.click(); button.click(); });
  expect(fx.create).toHaveBeenCalledOnce(); expect(onSaved).not.toHaveBeenCalled();
  await act(async () => release({ clientSecret: "synthetic" }));
  expect(fx.confirm).toHaveBeenCalledOnce(); expect(fx.save).toHaveBeenCalledOnce(); expect(onSaved).toHaveBeenCalledOnce();
});
