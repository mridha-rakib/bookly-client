import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ push: vi.fn(), request: vi.fn(), complete: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }), useSearchParams: () => new URLSearchParams("email=synthetic%40example.test") }));
vi.mock("@/lib/auth/password-recovery", () => ({ requestRecovery: state.request, completeRecovery: state.complete }));
import CustomerForgot from "@/app/customer/forgot-password/page";
import ProfessionalForgot from "@/app/professional/forgot-password/page";
import CustomerNew from "@/app/customer/new-password/page";
import ProfessionalNew from "@/app/professional/new-password/page";
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); state.push.mockReset(); state.request.mockReset(); state.complete.mockReset(); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const submit = async () => { await act(async () => { host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); };
const fill = async () => { const inputs = host.querySelectorAll("input"); await act(async () => { for (const input of inputs) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "new-password"); input.dispatchEvent(new Event("input", { bubbles: true })); } }); };

describe("password recovery frontend", () => {
  for (const [portal, Forgot, New] of [["customer", CustomerForgot, CustomerNew], ["professional", ProfessionalForgot, ProfessionalNew]] as const) {
    it(`${portal} initiates before navigating`, async () => {
      state.request.mockResolvedValue(true); await act(async () => root.render(<Forgot />)); await submit();
      expect(state.request).toHaveBeenCalledWith(portal, "synthetic@example.test");
      expect(state.push).toHaveBeenCalledWith(expect.stringContaining(`/${portal}/verify`));
    });
    it(`${portal} asks the user to wait when a request is throttled`, async () => {
      state.request.mockResolvedValue(false); await act(async () => root.render(<Forgot />)); await submit();
      expect(state.push).not.toHaveBeenCalled();
      expect(host.textContent).toContain("Please wait before requesting another code");
    });
    it(`${portal} keeps the form on initiation failure`, async () => {
      state.request.mockRejectedValue(new Error("network")); await act(async () => root.render(<Forgot />)); await submit();
      expect(state.push).not.toHaveBeenCalled(); expect(host.textContent).toContain("Could not start recovery");
    });
    it(`${portal} displays success only after confirmed completion`, async () => {
      state.complete.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(undefined);
      await act(async () => root.render(<New />)); await fill(); await submit();
      expect(state.complete).toHaveBeenCalledWith(portal, "new-password"); expect(host.textContent).not.toContain("Successfully Changed"); expect(host.textContent).toContain("Password could not be changed");
      await submit(); expect(host.textContent).toContain("Successfully Changed");
    });
  }
});
