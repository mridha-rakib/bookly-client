import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  api: {
    status: vi.fn(),
    enroll: vi.fn(),
    activate: vi.fn(),
    manage: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
    cancel: vi.fn(),
  },
  login: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  replace: vi.fn(),
  clearAuth: vi.fn(),
  setAuth: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock("@/lib/auth/hooks", () => ({
  useProfessionalLoginMutation: () => ({ mutateAsync: fx.login, isPending: false }),
  useProfessionalGoogleAuthMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: fx.success } }));
vi.mock("@/components/auth/SocialButton", () => ({
  default: () => <button type="button">Social sign-in</button>,
}));
vi.mock("@/lib/api/twoFactor", () => ({ twoFactorApi: fx.api }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: fx.replace, push: fx.push }),
  useSearchParams: () => new URLSearchParams("email=owner%40example.test"),
}));
vi.mock("@/lib/auth/store", () => ({
  useAuthStore: { getState: () => ({ clearAuth: fx.clearAuth, setAuth: fx.setAuth }) },
}));
vi.mock("@/lib/auth/auth-channel", () => ({ postAuthLoggedOut: fx.broadcast }));
vi.mock("@/components/auth/AuthLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/auth/AuthCard", () => ({
  default: ({
    children,
    title,
    subtitle,
  }: {
    children: React.ReactNode;
    title: string;
    subtitle: string;
  }) => (
    <section>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </section>
  ),
}));

import ProfessionalPasswordPage from "@/app/professional/password/page";
import TwoFactorSettings from "@/components/settings/TwoFactorSettings";
import TwoFactorChallenge from "@/components/auth/TwoFactorChallenge";
import { BooklyApiError } from "@/lib/api/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
const codes = ["a".repeat(32), "b".repeat(32)];
const setup = {
  setupId: "c".repeat(64),
  manualKey: "FIXTUREMANUALKEY",
  qrDataUrl: "data:image/png;base64,fixture",
  expiresAt: "2099-01-01T10:00:00Z",
};
const auth = {
  accessToken: "new-token",
  accessTokenExpiresAt: "2099-01-01T10:00:00Z",
  user: { id: "owner", email: "owner@example.test", role: "BUSINESS_OWNER", status: "ACTIVE" },
};
const failure = (code: string, message: string) =>
  new BooklyApiError({ code, message, status: 400, errors: [{ code, message }] });
beforeEach(() => {
  vi.clearAllMocks();
  fx.login.mockResolvedValue(auth);
  fx.api.status.mockResolvedValue({ enabled: false, recoveryCodesRemaining: 0, enrollmentAvailable: true });
  fx.api.enroll.mockResolvedValue(setup);
  fx.api.activate.mockResolvedValue({ recoveryCodes: codes, signInRequired: true });
  fx.api.manage.mockResolvedValue({ recoveryCodes: [], signInRequired: true });
  fx.api.challenge.mockResolvedValue({ expiresAt: "2099-01-01T10:00:00Z" });
  fx.api.verify.mockResolvedValue(auth);
  fx.api.cancel.mockResolvedValue({});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(node: React.ReactNode) {
  await act(async () => root.render(node));
}
const button = (text: string) =>
  [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === text);
async function click(node: Element | undefined | null) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function input(value: string) {
  const node = host.querySelector('input:not([type="checkbox"])')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () =>
    host
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
}

describe("Professional authenticator settings", () => {
  it("shows Off and a functional enable action without unsupported email-authentication copy", async () => {
    await render(<TwoFactorSettings />);
    expect(host.textContent).toContain("Two-factor authentication: Off");
    expect(button("Enable 2FA")).toBeTruthy();
    expect(host.textContent).not.toContain("Not available yet");
    expect(host.textContent).toContain("complete sign-in within the last five minutes");
  });
  it("shows QR/manual key and expiry, then displays recovery codes once after confirmed activation", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    await render(<TwoFactorSettings />);
    await click(button("Enable 2FA"));
    expect(host.querySelector("img")?.getAttribute("src")).toBe(setup.qrDataUrl);
    expect(host.textContent).toContain(setup.manualKey);
    expect(host.textContent).toContain("Setup expires");
    expect(host.textContent).toContain("Two-factor authentication: Off");
    await input("123456");
    await submit();
    expect(fx.api.activate).toHaveBeenCalledWith(setup.setupId, "123456");
    expect(host.textContent).toContain(codes[0]);
    expect(host.textContent).not.toContain(setup.manualKey);
    expect(host.textContent).toContain("shown only now");
    expect((button("Continue to sign in") as HTMLButtonElement).disabled).toBe(true);
    await click(host.querySelector('[type="checkbox"]'));
    await click(button("Continue to sign in"));
    expect(fx.clearAuth).toHaveBeenCalled();
    expect(fx.broadcast).toHaveBeenCalled();
    expect(fx.replace).toHaveBeenCalledWith("/professional/auth");
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });
  it("abandoned setup stays off and a verification error can be retried safely", async () => {
    await render(<TwoFactorSettings />);
    await click(button("Enable 2FA"));
    await click(button("Cancel setup"));
    expect(fx.api.activate).not.toHaveBeenCalled();
    await click(button("Enable 2FA"));
    await input("123456");
    fx.api.activate.mockRejectedValueOnce(
      failure("TWO_FACTOR_INVALID", "Setup expired. Start again."),
    );
    await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("expired");
    expect(host.textContent).not.toContain(codes[0]);
    await submit();
    expect(host.textContent).toContain(codes[0]);
  });
  it("shows On and the safe remaining count; replacing codes requires proof and confirmation", async () => {
    fx.api.status.mockResolvedValue({ enabled: true, recoveryCodesRemaining: 7 });
    fx.api.manage.mockResolvedValue({ recoveryCodes: codes, signInRequired: true });
    await render(<TwoFactorSettings />);
    expect(host.textContent).toContain("Two-factor authentication: On");
    expect(host.textContent).toContain("7 recovery codes remaining");
    await click(button("Regenerate recovery codes"));
    expect(host.textContent).toContain("previous unused codes will stop working");
    await input("a".repeat(32));
    await submit();
    expect(fx.api.manage).toHaveBeenCalledWith("regenerate", "a".repeat(32));
    expect(host.textContent).toContain(codes[1]);
  });
  it("disable is confirmed with factor proof; Cancel performs no change", async () => {
    fx.api.status.mockResolvedValue({ enabled: true, recoveryCodesRemaining: 7 });
    await render(<TwoFactorSettings />);
    await click(button("Disable 2FA"));
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain(
      "authenticator and recovery codes will stop working",
    );
    await click(button("Cancel"));
    expect(fx.api.manage).not.toHaveBeenCalled();
    await click(button("Disable 2FA"));
    await input("123456");
    await submit();
    expect(fx.api.manage).toHaveBeenCalledWith("disable", "123456");
    expect(host.textContent).toContain("All previous sessions have ended");
  });
  it("an unavailable status offers Retry and a failed security change never shows success", async () => {
    fx.api.status.mockRejectedValueOnce(
      failure("TWO_FACTOR_UNAVAILABLE", "Temporarily unavailable"),
    );
    await render(<TwoFactorSettings />);
    expect(host.textContent).toContain("Temporarily unavailable");
    await click(button("Retry"));
    await click(button("Enable 2FA"));
    await input("123456");
    fx.api.activate.mockRejectedValueOnce(failure("TWO_FACTOR_UNAVAILABLE", "Try again"));
    await submit();
    expect(host.textContent).toContain("Try again");
    expect(host.textContent).not.toContain("Security settings updated");
  });
});

describe("Second-factor sign-in", () => {
  it("retires previous account state, waits for verification, and authenticates only after success", async () => {
    let resolve!: (value: unknown) => void;
    fx.api.verify.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await render(<TwoFactorChallenge />);
    expect(fx.clearAuth).toHaveBeenCalledTimes(1);
    expect(fx.setAuth).not.toHaveBeenCalled();
    await input("123456");
    await submit();
    expect(host.textContent).toContain("Verifying…");
    expect(fx.setAuth).not.toHaveBeenCalled();
    expect(fx.replace).not.toHaveBeenCalled();
    await act(async () => resolve(auth));
    expect(fx.setAuth).toHaveBeenCalledWith(auth);
    expect(fx.replace).toHaveBeenCalledTimes(1);
  });
  it("recovery-code alternative sends only the proof, without an account id or credentials", async () => {
    await render(<TwoFactorChallenge />);
    await click(button("Use a recovery code"));
    await input(codes[0]);
    await submit();
    expect(fx.api.verify).toHaveBeenCalledWith(codes[0]);
    expect(fx.setAuth).toHaveBeenCalledWith(auth);
  });
  it("recovery sign-in can replace the last code and requires saving the new set before continuing", async () => {
    fx.api.verify.mockResolvedValueOnce({ ...auth, recoveryCodes: codes });
    await render(<TwoFactorChallenge />);
    await click(button("Use a recovery code"));
    await click(host.querySelector('[type="checkbox"]'));
    await input(codes[0]);
    await submit();
    expect(fx.api.verify).toHaveBeenCalledWith(codes[0], true);
    expect(host.textContent).toContain("Save your new recovery codes");
    expect(host.textContent).toContain(codes[1]);
    expect(fx.setAuth).not.toHaveBeenCalled();
    expect((button("Continue to Bookly") as HTMLButtonElement).disabled).toBe(true);
    await click(host.querySelector('[type="checkbox"]'));
    await click(button("Continue to Bookly"));
    expect(fx.setAuth).toHaveBeenCalledWith(auth);
    expect(fx.setAuth.mock.calls[0]?.[0]).not.toHaveProperty("recoveryCodes");
  });
  it("invalid/expired proof never authenticates and permits a safe retry or cancel", async () => {
    fx.api.verify.mockRejectedValueOnce(
      failure("TWO_FACTOR_INVALID", "Verification failed or challenge expired"),
    );
    await render(<TwoFactorChallenge />);
    await input("123456");
    await submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("expired");
    expect(fx.setAuth).not.toHaveBeenCalled();
    await submit();
    expect(fx.setAuth).toHaveBeenCalledTimes(1);
  });
  it("an expired challenge shows a return path and cancel cannot create a session", async () => {
    fx.api.challenge.mockRejectedValueOnce(failure("TWO_FACTOR_INVALID", "Challenge expired"));
    await render(<TwoFactorChallenge />);
    expect(host.textContent).toContain("Challenge expired");
    await click(button("Cancel and return to sign in"));
    expect(fx.api.cancel).toHaveBeenCalled();
    expect(fx.replace).toHaveBeenCalledWith("/professional/auth");
    expect(fx.setAuth).not.toHaveBeenCalled();
  });
});

describe("Professional password sign-in handoff", () => {
  it("first-factor success requiring 2FA routes to verification without a success toast or dashboard", async () => {
    fx.login.mockRejectedValueOnce(
      new BooklyApiError({
        status: 428,
        code: "TWO_FACTOR_REQUIRED",
        message: "Additional verification is required",
        errors: [],
      }),
    );
    await render(<ProfessionalPasswordPage />);
    await input("password");
    await submit();
    expect(fx.replace).toHaveBeenCalledWith("/professional/two-factor");
    expect(fx.push).not.toHaveBeenCalled();
    expect(fx.success).not.toHaveBeenCalled();
    expect((host.querySelector('input[type="password"]') as HTMLInputElement).value).toBe("");
  });
  it("accounts without 2FA retain their ordinary successful sign-in", async () => {
    await render(<ProfessionalPasswordPage />);
    await input("password");
    await submit();
    expect(fx.success).toHaveBeenCalledTimes(1);
    expect(fx.push).toHaveBeenCalledTimes(1);
    expect(fx.replace).not.toHaveBeenCalledWith("/professional/two-factor");
  });
});
