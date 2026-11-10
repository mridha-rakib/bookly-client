import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/api/auth";
import { BooklyApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/store";

type Request = { method?: string; url: string };
const fx = vi.hoisted(() => ({
  requests: [] as Request[],
  respond: undefined as undefined | ((request: Request) => Promise<unknown>),
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<object>()),
  apiRequest: (request: Request) => {
    fx.requests.push(request);
    return fx.respond!(request);
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/EdgeSoftOrbsTop", () => ({ default: () => null }));
vi.mock("@stripe/react-stripe-js", () => ({ Elements: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/lib/payments/stripe-client", () => ({ getStripe: () => null }));
vi.mock("@/components/payments/CardCollectionForm", () => ({
  CardCollectionForm: () => <div data-testid="add-card-form">Add card form</div>,
}));

import PaymentCardPage from "@/app/customer/payment-card/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root, client: QueryClient;
let cards: Record<string, { paymentMethodId: string; brand: string; last4: string; expMonth: number; expYear: number } | null>;
let deleteResponse: () => Promise<unknown>;
const previousAuth = useAuthStore.getState();

function auth(id: string, role: AuthUser["role"] = "CUSTOMER") {
  useAuthStore.setState({
    user: { id, role, email: `${id}@example.test`, status: "ACTIVE" },
    status: "authenticated",
    isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  });
}

beforeEach(() => {
  fx.requests = [];
  cards = { "customer-1": { paymentMethodId: "pm_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 }, "customer-2": null };
  deleteResponse = async () => {
    cards["customer-1"] = null;
    return { removed: true, paymentMethodId: "pm_1", alreadyDetached: false };
  };
  auth("customer-1");
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  fx.respond = async (request) => {
    const user = useAuthStore.getState().user!.id;
    if (request.url === "/payments/card-status") {
      const card = cards[user];
      return card ? { hasSavedCard: true, card } : { hasSavedCard: false };
    }
    if (request.method === "DELETE") return deleteResponse();
    throw new Error(`Unexpected ${request.url}`);
  };
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  useAuthStore.setState(previousAuth);
});

async function settle() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); }); }
async function waitFor(check: () => void) {
  for (let i = 0; i < 100; i++) {
    try { check(); return; } catch (error) { if (i === 99) throw error; }
    await settle();
  }
}
async function render() {
  await act(async () => root.render(<QueryClientProvider client={client}><PaymentCardPage /></QueryClientProvider>));
  await settle();
}
const button = (label: string) => [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
const deletes = () => fx.requests.filter((r) => r.method === "DELETE");

describe("Customer saved-card removal", () => {
  it("shows safe card metadata; Remove needs confirmation and Keep sends nothing", async () => {
    await render();
    await waitFor(() => expect(host.textContent).toContain("•••• 4242"));
    expect(host.textContent).toContain("visa");
    expect(host.textContent).toContain("Expires 12/30");
    expect(host.textContent).not.toContain("pm_1");
    await click(button("Remove card"));
    expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain("no longer be available for future Bookly payments");
    await click(button("Keep card"));
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
    expect(deletes()).toHaveLength(0);
  });

  it("confirmed removal calls the server once, refreshes saved-card reads and shows the empty state", async () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const original = deleteResponse;
    deleteResponse = async () => { await gate; return original(); };
    await render();
    await waitFor(() => expect(button("Remove card")).toBeTruthy());
    await click(button("Remove card"));
    const confirm = [...host.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent === "Remove card")!;
    await click(confirm);
    await waitFor(() => expect(button("Removing…")?.disabled).toBe(true));
    await click(button("Removing…")); // duplicate click while pending
    expect(host.textContent).toContain("•••• 4242"); // not removed before the server confirms
    release();
    await waitFor(() => expect(host.querySelector('[data-testid="add-card-form"]')).toBeTruthy());
    expect(deletes()).toEqual([{ method: "DELETE", url: "/payments/payment-methods/pm_1" }]);
    expect(host.textContent).not.toContain("•••• 4242");
    expect(host.textContent).toContain("Card removed.");
    const keys = invalidate.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey));
    expect(keys.some((key) => key.startsWith('["savedCardStatus","customer-1:'))).toBe(true);
    expect(keys).toContain(JSON.stringify(["packageSavedCard", "customer-1"]));
  });

  it("a protected card (active booking or payment) stays displayed with the server's reason", async () => {
    deleteResponse = async () => {
      throw new BooklyApiError({
        message: "This card can't be removed yet",
        status: 409,
        errors: [{ message: "You have an upcoming booking secured by this card (late-cancellation and no-show terms). Remove the card after it is completed or cancelled.", code: "ACTIVE_BOOKING" }],
      });
    };
    await render();
    await waitFor(() => expect(button("Remove card")).toBeTruthy());
    await click(button("Remove card"));
    await click([...host.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent === "Remove card"));
    await waitFor(() => expect(host.querySelector('[data-testid="card-removal-error"]')?.textContent).toContain("upcoming booking secured by this card"));
    expect(host.textContent).toContain("•••• 4242");
  });

  it("an already-removed card says so and refreshes to the current state", async () => {
    deleteResponse = async () => {
      cards["customer-1"] = null;
      throw new BooklyApiError({ message: "Not found", status: 404, errors: [{ message: "This saved card was not found", code: "PAYMENT_METHOD_NOT_FOUND" }] });
    };
    await render();
    await waitFor(() => expect(button("Remove card")).toBeTruthy());
    await click(button("Remove card"));
    await click([...host.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent === "Remove card"));
    await waitFor(() => expect(host.textContent).toContain("This card was already removed."));
    await waitFor(() => expect(host.querySelector('[data-testid="add-card-form"]')).toBeTruthy());
  });

  it("another account never sees the previous Customer's card; a failed read offers Retry", async () => {
    await render();
    await waitFor(() => expect(host.textContent).toContain("•••• 4242"));
    await act(async () => auth("customer-2"));
    await waitFor(() => expect(host.querySelector('[data-testid="add-card-form"]')).toBeTruthy());
    expect(host.textContent).not.toContain("•••• 4242");

    let failOnce = true;
    const respond = fx.respond!;
    fx.respond = async (request) => {
      if (request.url === "/payments/card-status" && failOnce) {
        failOnce = false;
        throw new Error("Network unavailable");
      }
      return respond(request);
    };
    await act(async () => auth("customer-1"));
    await waitFor(() => expect(button("Retry")).toBeTruthy());
    await click(button("Retry"));
    await waitFor(() => expect(host.textContent).toContain("•••• 4242"));
  });
});
