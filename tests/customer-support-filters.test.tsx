import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/lib/auth/store";
import { supportKeys } from "@/lib/support/hooks";
import { parseCustomerTicketFilters } from "@/lib/support/customer-ticket-filters";
import type { SupportTicket } from "@/lib/api/support";

type Request = { method?: string; url: string; params?: Record<string, string>; data?: unknown };
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
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

import CustomerTicketsPage from "@/app/customer/tickets/page";
import CustomerTicketView from "@/app/customer/tickets/view/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
const initialAuth = useAuthStore.getState();
let root: Root, host: HTMLDivElement, client: QueryClient;
let tickets: Array<SupportTicket & { owner: string }>;
let delay: ((request: Request) => Promise<void>) | undefined;
let fail: boolean;
function auth(id: string | null) {
  useAuthStore.setState({
    user: id ? { id, email: `${id}@example.test`, role: "CUSTOMER", status: "ACTIVE" } : null,
    status: id ? "authenticated" : "unauthenticated",
    isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  });
}
beforeEach(() => {
  window.history.replaceState(null, "", "/customer/tickets");
  fx.requests = [];
  fail = false;
  delay = undefined;
  auth("A");
  tickets = ["A", "B"].flatMap((owner) =>
    Array.from({ length: 65 }, (_, index) => ({
      id: `${owner}-${index + 1}`,
      owner,
      reference: `SUP-${owner}-${index + 1}`,
      subject: `${owner} ${index % 2 ? "Refund" : "Booking help"} ${index + 1}`,
      status: (["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const)[index % 4] ?? "OPEN",
      createdAt: new Date(Date.UTC(2026, 10, 1, 0, index)).toISOString(),
      updatedAt: "2026-11-01T00:00:00Z",
      statusHistory: [],
    })),
  );
  fx.respond = async (request) => {
    const owner = useAuthStore.getState().user?.id;
    const owned = tickets.filter((ticket) => ticket.owner === owner);
    if (delay) await delay(request);
    if (fail) throw new Error("Support temporarily unavailable");
    if (request.method === "POST" && request.url === "/me/support/tickets") return owned[0];
    if (request.url === "/me/support/tickets") {
      const page = Number(request.params?.page ?? 1),
        limit = Number(request.params?.limit ?? 20);
      const q = (request.params?.q ?? "").toLowerCase();
      const rows = owned
        .filter(
          (ticket) =>
            (!request.params?.status || ticket.status === request.params.status) &&
            (!q ||
              ticket.subject.toLowerCase().includes(q) ||
              ticket.reference.toLowerCase().includes(q)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        tickets: rows.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: rows.length },
      };
    }
    if (request.url.endsWith("/messages"))
      return {
        messages: [],
        pagination: { limit: 50, total: 0 },
        history: { hasOlder: false, olderCursor: null },
      };
    return owned.find((ticket) => request.url.endsWith(`/${ticket.id}`));
  };
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  useAuthStore.setState(initialAuth);
  vi.useRealTimers();
});
async function render(node: React.ReactNode = <CustomerTicketsPage />) {
  await act(async () =>
    root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>),
  );
}
async function tick() {
  await act(async () => {
    if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(1);
    else await new Promise((done) => setTimeout(done, 5));
  });
}
async function wait(check: () => void) {
  for (let n = 0; n < 150; n++) {
    try {
      check();
      return;
    } catch (error) {
      if (n === 149) throw error;
    }
    await tick();
  }
}
const lists = () =>
  fx.requests.filter(
    (request) => request.url === "/me/support/tickets" && request.method === "GET",
  );
const button = (text: string) =>
  [...host.querySelectorAll("button")].find((node) => node.textContent?.trim() === text);
const links = () => [...host.querySelectorAll('a[href^="/customer/tickets/view"]')];
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function search(value: string) {
  const node = host.querySelector('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function status(value: string) {
  const node = host.querySelector("select")!;
  await act(async () => {
    node.value = value;
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function location(query: string) {
  await act(async () => {
    window.history.replaceState(null, "", `/customer/tickets${query}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

describe("Customer ticket search and status filters", () => {
  it("retains ordinary real-API pagination, badges and ticket navigation", async () => {
    await render();
    await wait(() => expect(links()).toHaveLength(20));
    expect(lists()[0]?.params).toEqual({ page: "1", limit: "20" });
    await click(button("Next →"));
    await wait(() => expect(host.textContent).toContain("Page 2 of 4"));
    expect(lists().at(-1)?.params?.page).toBe("2");
    expect(links()[0]?.getAttribute("href")).toContain("page=2");
  });
  it("debounces normalized search for 350 ms and sends a single combined request", async () => {
    await render();
    await wait(() => expect(links()).toHaveLength(20));
    vi.useFakeTimers();
    const before = lists().length;
    await search("ref");
    await search("  Refund  ");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(349);
    });
    expect(lists()).toHaveLength(before);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    await wait(() => expect(lists().at(-1)?.params?.q).toBe("Refund"));
    expect(lists()).toHaveLength(before + 1);
    expect(lists().at(-1)?.params).toEqual({ page: "1", limit: "20", q: "Refund" });
    expect(new URLSearchParams(window.location.search).get("q")).toBe("Refund");
  });
  it("combines search/status and resets page one when the status changes", async () => {
    await location("?q=Refund&page=2");
    await render();
    await wait(() => expect(host.textContent).toContain("Page 2 of 2"));
    await status("PENDING");
    await wait(() =>
      expect(lists().at(-1)?.params).toEqual({
        page: "1",
        limit: "20",
        q: "Refund",
        status: "PENDING",
      }),
    );
    await wait(() => expect(links()).toHaveLength(16));
    expect((host.querySelector("select") as HTMLSelectElement).value).toBe("PENDING");
    expect(links().every((link) => link.textContent?.includes("Pending"))).toBe(true);
  });
  it("search changes reset a later page before requesting the new result set", async () => {
    await location("?page=3");
    await render();
    await wait(() => expect(host.textContent).toContain("Page 3 of 4"));
    await search("SUP-A-1");
    await wait(() => expect(lists().at(-1)?.params?.q).toBe("SUP-A-1"));
    expect(lists().at(-1)?.params?.page).toBe("1");
    expect(
      lists().some((entry) => entry.params?.q === "SUP-A-1" && entry.params.page !== "1"),
    ).toBe(false);
  });
  it("restores filters/page from a URL and a Back/Forward popstate update", async () => {
    await location("?q=Refund&page=2");
    await render();
    await wait(() => expect(host.textContent).toContain("Page 2 of 2"));
    expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe("Refund");
    await location("?status=RESOLVED");
    await wait(() => expect(lists().at(-1)?.params?.status).toBe("RESOLVED"));
    expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe("");
    await location("?q=Refund&page=2");
    await wait(() => expect(host.textContent).toContain("Page 2 of 2"));
    expect((host.querySelector("select") as HTMLSelectElement).value).toBe("");
  });
  it("distinguishes a filtered empty result and clears every filter in one action", async () => {
    await location("?q=not-found&status=OPEN");
    await render();
    await wait(() =>
      expect(host.textContent).toContain("No tickets match your search or filters."),
    );
    expect(host.textContent).not.toContain("You have no support tickets yet.");
    await click(button("Clear filters"));
    await wait(() => expect(links()).toHaveLength(20));
    expect(window.location.search).toBe("");
    expect(lists().at(-1)?.params).toEqual({ page: "1", limit: "20" });
  });
  it("retains the ordinary empty state for an account with no tickets", async () => {
    tickets = [];
    await render();
    await wait(() => expect(host.textContent).toContain("You have no support tickets yet."));
  });
  it("shows an API failure and Retry instead of fake tickets or an empty result", async () => {
    fail = true;
    await render();
    await wait(() => expect(host.textContent).toContain("Your tickets could not be loaded"));
    expect(host.textContent).not.toContain("No tickets match");
    expect(links()).toHaveLength(0);
    fail = false;
    await click(button("Retry"));
    await wait(() => expect(links()).toHaveLength(20));
  });
  it("a slow old-page response cannot replace a newer status/search result", async () => {
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    delay = (request) =>
      request.params?.page === "2" && !request.params.status ? gate : Promise.resolve();
    await render();
    await wait(() => expect(links()).toHaveLength(20));
    await click(button("Next →"));
    await wait(() => expect(lists().at(-1)?.params?.page).toBe("2"));
    await status("CLOSED");
    await wait(() => expect(links()).toHaveLength(16));
    const expected = links().map((link) => link.textContent);
    await act(async () => release());
    await tick();
    expect(links().map((link) => link.textContent)).toEqual(expected);
    expect(links().every((link) => link.textContent?.includes("Closed"))).toBe(true);
  });
  it("never displays another account's cached or late tickets after an account switch", async () => {
    await render();
    await wait(() => expect(links()).toHaveLength(20));
    await act(async () => auth("B"));
    expect(links().some((link) => link.textContent?.includes("SUP-A"))).toBe(false);
    await wait(() => expect(links()[0]?.textContent).toContain("SUP-B"));
    await act(async () => auth(null));
    expect(links()).toHaveLength(0);
  });
  it("a late list response from the previous account stays outside the current account's list", async () => {
    let release!: () => void;
    const gate = new Promise<void>((done) => {
      release = done;
    });
    delay = () => (useAuthStore.getState().user?.id === "A" ? gate : Promise.resolve());
    await render();
    await wait(() => expect(lists()).toHaveLength(1));
    await act(async () => auth("B"));
    await wait(() => expect(links()[0]?.textContent).toContain("SUP-B"));
    await act(async () => release());
    await tick();
    expect(links().some((link) => link.textContent?.includes("SUP-A"))).toBe(false);
    expect(links()[0]?.textContent).toContain("SUP-B");
  });
  it("clear-search and Escape preserve the status filter and reset the page", async () => {
    await location("?q=Refund&status=PENDING");
    await render();
    await wait(() => expect(links()).toHaveLength(16));
    await click(host.querySelector('[aria-label="Clear search"]'));
    await wait(() =>
      expect(lists().at(-1)?.params).toEqual({ page: "1", limit: "20", status: "PENDING" }),
    );
    await search("draft");
    await act(async () =>
      host
        .querySelector('input[type="search"]')!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    );
    expect((host.querySelector('input[type="search"]') as HTMLInputElement).value).toBe("");
  });
  it("rejects invalid URL filters without sending them to the API, and permits clearing", async () => {
    await location("?status=IN_PROGRESS&page=-1");
    await render();
    expect(host.textContent).toContain("Invalid ticket filters");
    expect(lists()).toHaveLength(0);
    await click(button("Reset ticket filters"));
    await wait(() => expect(links()).toHaveLength(20));
    for (const query of ["?q=" + "x".repeat(101), "?page=Infinity", "?status=OPEN&status=CLOSED"])
      expect(parseCustomerTicketFilters(new URLSearchParams(query)).valid).toBe(false);
  });
  it("uses normalized scoped keys and invalidates every list variant after ticket creation", async () => {
    await render();
    await wait(() => expect(links()).toHaveLength(20));
    const scope = `A:${useAuthStore.getState().cacheEpoch}`;
    expect(supportKeys.list({ q: " Refund ", status: "OPEN", page: 2 }, scope)).toEqual(
      supportKeys.list({ q: "Refund", status: "OPEN", page: 2, limit: 20 }, scope),
    );
    expect(supportKeys.list({ q: "Refund" }, scope)).not.toEqual(
      supportKeys.list({ q: "Refund" }, "B:1"),
    );
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await click(button("New ticket"));
    await act(async () => {
      const input = host.querySelector('input[type="text"]')!;
      const textarea = host.querySelector("textarea")!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "New subject",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
        textarea,
        "Message",
      );
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      host
        .querySelector("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: supportKeys.lists(scope) });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: supportKeys.all });
  });
  it("the detail Back link preserves the validated list context", async () => {
    await location("?id=A-1&q=Refund&status=OPEN&page=2");
    await render(<CustomerTicketView />);
    await wait(() => expect(host.textContent).toContain("Back to My Tickets"));
    const back = [...host.querySelectorAll("a")].find((link) =>
      link.textContent?.includes("Back to My Tickets"),
    );
    expect(back?.getAttribute("href")).toBe("/customer/tickets?q=Refund&status=OPEN&page=2");
  });
});
