import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosAdapter } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PackageConsentReview from "@/components/packages/PackageConsentReview";
import { apiClient } from "@/lib/api/client";
import { setAccessToken } from "@/lib/auth/token-memory";
import {
  matchesConsentAcceptance,
  type ConsentAccepted,
  type ConsentAction,
} from "@/lib/api/package-consent";

const presentation = {
  version: 1 as const,
  templateVersion: 1 as const,
  presentationId: "1".repeat(24),
  challenge: "2".repeat(64),
  quoteHash: "3".repeat(64),
  disclosureHash: "4".repeat(64),
  text: "Package: Hair.\n\nExact terms <script>window.forged=true</script>\nExpiry alone never charges money.",
};
let root: Root, container: HTMLDivElement;
let calls: { url: string; data: Record<string, unknown> }[];
let errorStatus: number | undefined;
let badConfirmation: boolean;
let lostResponse: boolean;
let delayAccept: (() => void) | undefined;
let acceptedData: ConsentAccepted | undefined;
const acceptedFor = (action: ConsentAction): ConsentAccepted => ({
  state: "ACCEPTED_IMMUTABLE",
  acceptanceId: "5".repeat(24),
  acceptedAt: "2026-10-22T00:00:00.000Z",
  presentationId: presentation.presentationId,
  quoteHash: presentation.quoteHash,
  disclosureHash: badConfirmation ? "tampered" : presentation.disclosureHash,
  eventId: action.eventId,
});
const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
const render = async (operation = "op") => {
  await act(async () =>
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          createElement(PackageConsentReview, {
            businessId: "business",
            packageId: "package",
            initialOperationId: operation || undefined,
          }),
        ),
      ),
    ),
  );
  await flush();
};
const button = () =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Accept these terms"),
  )!;
const check = async () => {
  await act(async () =>
    (container.querySelector('input[type="checkbox"]') as HTMLInputElement).click(),
  );
};
const submit = async () => {
  await act(async () => button().click());
  await flush();
};

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  calls = [];
  errorStatus = undefined;
  badConfirmation = false;
  lostResponse = false;
  delayAccept = undefined;
  acceptedData = undefined;
  setAccessToken("fixture.jwt.signature");
  const adapter: AxiosAdapter = async (config) => {
    const url = config.url ?? "",
      data = typeof config.data === "string" ? JSON.parse(config.data) : (config.data ?? {});
    calls.push({ url, data });
    if (url.endsWith("/auth/refresh") || (errorStatus && url.endsWith("/acceptance"))) {
      const status = url.endsWith("/auth/refresh") ? 401 : errorStatus!;
      throw new AxiosError("failure", undefined, config, undefined, {
        config,
        headers: {},
        status,
        statusText: "Error",
        data: {
          success: false,
          message: status === 401 ? "Session expired" : "Terms changed or request denied",
          errors: [{ code: "PACKAGE_CONSENT_CHANGED" }],
        },
      });
    }
    let payload: unknown = {};
    if (url.includes("/offers/"))
      payload = {
        businessId: "business",
        packageId: "package",
        name: "Hair Package",
        revision: 4,
        timezone: "Asia/Dhaka",
        items: [
          {
            definitionItemId: "item",
            serviceId: "service",
            name: "Hair",
            quantity: 3,
            providers: [{ id: "staff", name: "Professional" }],
          },
        ],
      };
    if (url.endsWith("/presentation"))
      payload = { ...presentation, ...(acceptedData ? { accepted: acceptedData } : {}) };
    if (url.endsWith("/quotes")) payload = { operationId: data.operationId };
    if (url.endsWith("/acceptance")) {
      if (delayAccept)
        await new Promise<void>((resolve) => {
          delayAccept = resolve;
        });
      acceptedData = acceptedFor(data as ConsentAction);
      payload = acceptedData;
      if (lostResponse) {
        lostResponse = false;
        throw new Error("Network response lost");
      }
    }
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      config,
      data: { success: true, message: "OK", data: payload },
    };
  };
  apiClient.defaults.adapter = adapter;
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllEnvs();
});

describe("Customer terms interaction and bounded real API-client dispatches", () => {
  it("renders exact text safely, starts unchecked and disables submit", async () => {
    await render();
    expect(container.querySelector('[aria-label="Exact Package terms"]')?.textContent).toBe(
      presentation.text,
    );
    expect(container.querySelector("script")).toBeNull();
    expect((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(
      false,
    );
    expect(button().disabled).toBe(true);
    expect(calls).toHaveLength(1);
    expect(container.querySelector("label")?.textContent).toContain(
      "applicable monetary penalty terms",
    );
  });
  it("submits exact presentation metadata only after explicit checkbox/action", async () => {
    await render();
    await check();
    await submit();
    const request = calls.find((c) => c.url.endsWith("/acceptance"))!;
    expect(request.data).toMatchObject({
      action: "ACCEPT_PACKAGE_CHECKOUT_TERMS",
      presentationId: presentation.presentationId,
      challenge: presentation.challenge,
      quoteHash: presentation.quoteHash,
      disclosureHash: presentation.disclosureHash,
    });
    expect(request.data).not.toHaveProperty("acceptedAt");
    expect(request.data).not.toHaveProperty("text");
    expect(container.textContent).toContain("Terms accepted");
    expect(container.textContent).toContain("No Package purchase has been made");
    expect(calls).toHaveLength(2);
  });
  it("prevents duplicate clicks while submitting", async () => {
    await render();
    await check();
    delayAccept = () => {};
    await act(async () => {
      button().click();
      button().click();
    });
    await flush();
    expect(calls.filter((c) => c.url.endsWith("/acceptance"))).toHaveLength(1);
    expect(container.textContent).toContain("Recording acceptance");
    await act(async () => delayAccept?.());
    await flush();
    expect(container.textContent).toContain("Terms accepted");
  });
  it("network loss shows no fake success and manual retry reuses event identity", async () => {
    await render();
    await check();
    lostResponse = true;
    await submit();
    expect(container.textContent).not.toContain("Terms accepted");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    await submit();
    const sent = calls.filter((c) => c.url.endsWith("/acceptance"));
    expect(sent).toHaveLength(2);
    expect(sent[1].data).toEqual(sent[0].data);
    expect(container.textContent).toContain("Terms accepted");
  });
  it.each([403, 409, 429])("does not retry HTTP %i or misreport success", async (status) => {
    await render();
    await check();
    errorStatus = status;
    await submit();
    expect(calls.filter((c) => c.url.endsWith("/acceptance"))).toHaveLength(1);
    expect(container.textContent).not.toContain("Terms accepted");
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });
  it("401 uses the existing bounded refresh path, then shows session failure", async () => {
    await render();
    await check();
    errorStatus = 401;
    await submit();
    expect(calls.filter((c) => c.url.endsWith("/auth/refresh"))).toHaveLength(1);
    expect(calls.filter((c) => c.url.endsWith("/acceptance"))).toHaveLength(1);
    expect(container.textContent).not.toContain("Terms accepted");
  });
  it("rejects a confirmation for different disclosure", async () => {
    await render();
    await check();
    badConfirmation = true;
    await submit();
    expect(container.textContent).toContain("does not match");
    expect(container.textContent).not.toContain("Terms accepted");
  });
  it("reload of already accepted terms shows canonical confirmation without re-affirming", async () => {
    acceptedData = acceptedFor({ eventId: "stored-event" } as ConsentAction);
    await render();
    expect(container.textContent).toContain("Terms accepted");
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(calls).toHaveLength(1);
  });
  it("selection entry uses server offer and generates no quote on render", async () => {
    await render("");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/offers/");
    expect(container.textContent).toContain("Hair Package");
    const add = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Add Hair"),
    )!;
    await act(async () => add.click());
    expect(container.querySelector("legend")?.textContent).toContain("Hair");
    expect(calls).toHaveLength(1);
  });
  it("confirmation identity comparison requires same event, quote and disclosure", () => {
    const action = { eventId: "event" } as ConsentAction;
    expect(matchesConsentAcceptance(presentation, action, acceptedFor(action))).toBe(true);
    expect(
      matchesConsentAcceptance(presentation, action, {
        ...acceptedFor(action),
        eventId: "another",
      }),
    ).toBe(false);
  });
});
