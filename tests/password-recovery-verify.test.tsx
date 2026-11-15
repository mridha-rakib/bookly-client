import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
const fx = vi.hoisted(() => ({ push: vi.fn(), verify: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: fx.push }), useSearchParams: () => new URLSearchParams("email=synthetic%40example.test&flow=reset") }));
vi.mock("@/lib/auth/password-recovery", () => ({ verifyRecovery: fx.verify, resendRecovery: vi.fn() }));
vi.mock("@/lib/auth/hooks", () => { const mutation = () => ({ isPending: false, mutateAsync: vi.fn() }); return { useVerifyCustomerEmailOtpMutation: mutation, useResendCustomerEmailOtpMutation: mutation, useVerifyProfessionalEmailOtpMutation: mutation, useResendProfessionalEmailOtpMutation: mutation }; });
vi.mock("@/components/ui/sonner", () => ({ toast: { error: fx.error, success: vi.fn() } }));
vi.mock("@/hooks/useOtpInput", () => ({ useOtpInput: () => ({ value: "1234", values: ["1", "2", "3", "4"], activeBox: 0, registerRef: () => () => {}, setActiveBox: vi.fn(), handleKeyDown: vi.fn(), handleChange: vi.fn(), handlePaste: vi.fn() }) }));
import Customer from "@/app/customer/verify/page";
import Professional from "@/app/professional/verify/page";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
describe("recovery verification", () => {
  for (const [portal, Page] of [["customer", Customer], ["professional", Professional]] as const) {
    it(`${portal} waits for verification and does not navigate on failure`, async () => {
      fx.push.mockReset(); fx.verify.mockReset(); fx.error.mockReset();
      let reject!: (reason: Error) => void;
      fx.verify.mockReturnValue(new Promise((_, fail) => { reject = fail; }));
      const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
      await act(async () => { root.render(<Page />); });
      await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      expect(fx.verify).toHaveBeenCalledWith(portal, "1234"); expect(fx.push).not.toHaveBeenCalled();
      expect(host.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(true);
      await act(async () => { reject(new Error("invalid")); });
      expect(fx.error).toHaveBeenCalled(); expect(fx.push).not.toHaveBeenCalled();
      fx.verify.mockResolvedValue(undefined);
      await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
      expect(fx.push).toHaveBeenCalledWith(`/${portal}/new-password`);
      act(() => root.unmount()); host.remove();
    });
  }
});
