import { beforeEach, describe, expect, it, vi } from "vitest";
const fx = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiRequest: fx.request }));
import { getRecovery, requestRecovery } from "@/lib/auth/password-recovery";
const token = "x".repeat(64);
beforeEach(() => { sessionStorage.clear(); fx.request.mockReset(); });
describe("recovery request cooldown", () => {
  it("keeps a server-confirmed previous challenge", async () => {
    sessionStorage.setItem("bookly-password-recovery-customer", JSON.stringify({ email: "synthetic@example.test", challenge: token }));
    fx.request.mockResolvedValue({ challenge: token });
    expect(await requestRecovery("customer", "synthetic@example.test")).toBe(true);
    expect(fx.request).toHaveBeenCalledWith(expect.objectContaining({ data: { email: "synthetic@example.test", previousChallenge: token } }));
    expect(getRecovery("customer")?.challenge).toBe(token);
  });
  it("does not overwrite a challenge or advance when the server returns none", async () => {
    sessionStorage.setItem("bookly-password-recovery-customer", JSON.stringify({ email: "synthetic@example.test", challenge: token }));
    fx.request.mockResolvedValue({ challenge: "" });
    expect(await requestRecovery("customer", "synthetic@example.test")).toBe(false);
    expect(getRecovery("customer")?.challenge).toBe(token);
    expect(await requestRecovery("professional", "synthetic@example.test")).toBe(false);
    expect(getRecovery("professional")).toBeNull();
  });
});
