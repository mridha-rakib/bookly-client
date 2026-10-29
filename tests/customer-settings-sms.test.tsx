import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SettingsPage from "@/app/customer/settings/page";
import { authApi, type CurrentUserResponse } from "@/lib/api/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/EdgeSoftOrbsTop", () => ({ default: () => null }));
// Exercise the Settings integration and real query/mutation hooks; auth admission is unchanged.
vi.mock("@/components/auth/RequireCustomer", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const fixture = (sms = false, id = "customer-a"): CurrentUserResponse => ({
  user: { id, email: `${id}@example.com`, role: "CUSTOMER", status: "ACTIVE", hasPassword: true },
  profile: {
    firstName: "Customer", lastName: "Fixture", fullName: "Customer Fixture",
    gender: "other", defaultLanguage: "EN",
    notifications: { appointmentReminderEmail: true, appointmentReminderSms: sms, marketingEmail: false },
  },
  business: null,
  linkedAccounts: [],
});
function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error("Deferred promise not initialized"); };
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
let host: HTMLDivElement, root: Root, cache: QueryClient;
const newCache = () => new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const flush = async () => {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)); });
};
const render = async (key = "account-a") => {
  await act(async () => root.render(
    <QueryClientProvider key={key} client={cache}><SettingsPage /></QueryClientProvider>,
  ));
  await flush();
};
function toggle(label = "Appointment reminder text message") {
  const element = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!element) throw new Error(`Missing preference switch: ${label}`);
  return element;
}
const click = async (label?: string) => {
  await act(async () => toggle(label).click());
  await flush();
};

beforeEach(() => {
  host = document.createElement("div"); document.body.append(host);
  root = createRoot(host); cache = newCache();
  vi.spyOn(authApi, "me").mockResolvedValue(fixture());
  vi.spyOn(authApi, "updateMyProfile").mockResolvedValue(fixture(true));
});
afterEach(async () => {
  await act(async () => root.unmount());
  cache.clear(); host.remove(); vi.restoreAllMocks();
});

it("reads default-off SMS from the server and explains delivery and queued-message limits", async () => {
  await render();
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(toggle().disabled).toBe(false);
  expect(host.textContent).toContain("optional notifications");
  expect(host.textContent).toContain("verified phone number and configured SMS services");
  expect(host.textContent).toContain("Delivery isn't guaranteed");
  expect(host.textContent).toContain("may not cancel texts already queued");
  expect(toggle().parentElement?.textContent).not.toContain("Coming soon");
  expect(authApi.updateMyProfile).not.toHaveBeenCalled();
});

it.each([true, false])("saves SMS=%s only and uses the response for cache and UI", async (next) => {
  vi.mocked(authApi.me).mockResolvedValue(fixture(!next));
  vi.mocked(authApi.updateMyProfile).mockResolvedValue(fixture(next));
  await render(); await click();
  expect(authApi.updateMyProfile).toHaveBeenCalledTimes(1);
  expect(vi.mocked(authApi.updateMyProfile).mock.calls[0]?.[0]).toEqual({
    notifications: { appointmentReminderSms: next },
  });
  expect(cache.getQueryData(["auth", "me"])).toEqual(fixture(next));
  expect(toggle().getAttribute("aria-checked")).toBe(String(next));
  expect(host.textContent).toContain("Your reminder preferences have been updated.");
  expect(toggle("Appointment reminder email").getAttribute("aria-checked")).toBe("true");
});

it("does not invent success when the response retains the previous preference", async () => {
  vi.mocked(authApi.updateMyProfile).mockResolvedValue(fixture(false));
  await render(); await click();
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(cache.getQueryData(["auth", "me"])).toEqual(fixture(false));
});

it("shows an inline error without success feedback or changing confirmed preferences", async () => {
  vi.mocked(authApi.updateMyProfile).mockRejectedValue(new Error("Save unavailable"));
  await render(); await click();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("couldn't save your notification preference");
  expect(host.textContent).not.toContain("preferences have been updated");
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(cache.getQueryData(["auth", "me"])).toEqual(fixture());
  expect(toggle().disabled).toBe(false);
  expect(toggle().getAttribute("aria-busy")).toBe("false");
  vi.mocked(authApi.updateMyProfile).mockResolvedValue(fixture(true));
  await click();
  expect(host.querySelector('[role="alert"]')).toBeNull();
  expect(toggle().getAttribute("aria-checked")).toBe("true");
});

it("disables loading and unavailable preferences without sending a mutation", async () => {
  const read = deferred<CurrentUserResponse>();
  vi.mocked(authApi.me).mockReturnValue(read.promise);
  await render(); await click();
  expect(toggle().disabled).toBe(true);
  expect(authApi.updateMyProfile).not.toHaveBeenCalled();
  await act(async () => read.resolve(fixture())); await flush();
  expect(toggle().disabled).toBe(false);
});

it("keeps switches disabled when the current-user read fails", async () => {
  vi.mocked(authApi.me).mockRejectedValue(new Error("Read unavailable"));
  await render(); await click();
  expect(toggle().disabled).toBe(true);
  expect(host.textContent).toContain("couldn't load your reminder preferences");
  expect(authApi.updateMyProfile).not.toHaveBeenCalled();
});

it("blocks synchronous double clicks and all preference switches while pending", async () => {
  const save = deferred<CurrentUserResponse>();
  vi.mocked(authApi.updateMyProfile).mockReturnValue(save.promise);
  await render();
  await act(async () => { toggle().click(); toggle().click(); }); await flush();
  expect(authApi.updateMyProfile).toHaveBeenCalledTimes(1);
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(toggle().getAttribute("aria-busy")).toBe("true");
  for (const button of host.querySelectorAll<HTMLButtonElement>('[role="switch"]')) {
    expect(button.disabled).toBe(true);
  }
  await click();
  expect(authApi.updateMyProfile).toHaveBeenCalledTimes(1);
  await act(async () => save.resolve(fixture(true))); await flush();
  expect(toggle().getAttribute("aria-checked")).toBe("true");
  expect(toggle().disabled).toBe(false);
});

it.each([
  ["Appointment reminder email", "appointmentReminderEmail", false],
  ["Marketing email", "marketingEmail", true],
] as const)("preserves the existing %s payload", async (label, channel, next) => {
  const result = fixture();
  if (result.profile) result.profile.notifications[channel] = next;
  vi.mocked(authApi.updateMyProfile).mockResolvedValue(result);
  await render(); await click(label);
  expect(authApi.updateMyProfile).toHaveBeenCalledTimes(1);
  expect(vi.mocked(authApi.updateMyProfile).mock.calls[0]?.[0]).toEqual({ notifications: { [channel]: next } });
  expect(toggle(label).getAttribute("aria-checked")).toBe(String(next));
  expect(toggle().getAttribute("aria-checked")).toBe("false");
});

it("reloads the preference from the server after remount", async () => {
  await render(); await click();
  await act(async () => root.unmount()); cache.clear();
  vi.mocked(authApi.me).mockResolvedValue(fixture(true));
  root = createRoot(host); cache = newCache(); await render();
  expect(authApi.me).toHaveBeenCalledTimes(2);
  expect(toggle().getAttribute("aria-checked")).toBe("true");
});

it("does not leak account A state or a late save into a remounted account B cache", async () => {
  const save = deferred<CurrentUserResponse>();
  vi.mocked(authApi.updateMyProfile).mockReturnValue(save.promise);
  await render(); await click();
  const oldCache = cache;
  // Existing Providers keys its QueryClientProvider by cacheEpoch and rotates client identity.
  cache = newCache();
  vi.mocked(authApi.me).mockResolvedValue(fixture(false, "customer-b"));
  await render("account-b");
  await act(async () => save.resolve(fixture(true))); await flush();
  expect(cache.getQueryData(["auth", "me"])).toEqual(fixture(false, "customer-b"));
  expect(toggle().getAttribute("aria-checked")).toBe("false");
  expect(host.textContent).not.toContain("preferences have been updated");
  expect(host.querySelector('[role="alert"]')).toBeNull();
  oldCache.clear();
});
