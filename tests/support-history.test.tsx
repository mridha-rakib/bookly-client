import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";
import CustomerTicketsPage from "@/app/customer/tickets/page";
import CustomerTicketViewPage from "@/app/customer/tickets/view/page";
import RequesterTicketDetail from "@/components/support/RequesterTicketDetail";
import SuperAdminSupport from "@/components/super-admin/support/SuperAdminSupport";

type Request = { method?: string; url: string; params?: Record<string, string>; data?: unknown };
type Msg = { id: string; ticketId: string; senderRole: string; message: string; createdAt: string };
type Ticket = { id: string; owner: string; subject: string; status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED"; createdAt: string };

const fx = vi.hoisted(() => ({
  requests: [] as Request[],
  respond: undefined as undefined | ((request: Request) => Promise<unknown>),
  search: "",
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<object>()),
  apiRequest: (request: Request) => {
    fx.requests.push(request);
    return fx.respond!(request);
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(fx.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let host: HTMLDivElement, root: Root, client: QueryClient;
let tickets: Ticket[];
let messages: Map<string, Msg[]>;
let gates: Map<string, Promise<void>>;
let failures: Set<string>;
let nextId: number;
const previousAuth = useAuthStore.getState();

const hex = (n: number) => n.toString(16).padStart(24, "0");
const base = Date.parse("2026-11-01T09:00:00.000Z");
/** Three messages share each timestamp, so page boundaries cross identical createdAt values. */
const seedConversation = (ticketId: string, count: number, label = "Message") => {
  const list: Msg[] = [];
  for (let n = 1; n <= count; n += 1) {
    list.push({ id: hex(nextId++), ticketId, senderRole: n % 2 ? "CUSTOMER" : "SUPER_ADMIN", message: `${label} ${n}`,
      createdAt: new Date(base + Math.floor((n - 1) / 3) * 60_000).toISOString() });
  }
  messages.set(ticketId, list);
};
const sortKey = (m: Msg) => [Date.parse(m.createdAt), m.id] as const;
const before = (m: Msg, ms: number, id: string) => {
  const [t, mid] = sortKey(m);
  return t < ms || (t === ms && mid < id);
};

function auth(id: string | null, role: AuthUser["role"] = "CUSTOMER") {
  useAuthStore.setState({
    user: id ? { id, role, email: `${id}@example.test`, status: "ACTIVE" } : null,
    status: id ? "authenticated" : "unauthenticated",
    isInitializing: false,
    cacheEpoch: useAuthStore.getState().cacheEpoch + 1,
  });
}

const ticketDto = (t: Ticket) => ({ id: t.id, reference: `SUP-${t.id}`, subject: t.subject, status: t.status,
  createdAt: t.createdAt, updatedAt: t.createdAt, statusHistory: [] });
const adminDto = (t: Ticket) => ({ ...ticketDto(t), requesterUserId: t.owner, requesterRole: "CUSTOMER",
  requesterDisplayName: "Casey Customer", requesterEmail: "casey@example.test" });

beforeEach(() => {
  fx.requests = [];
  fx.search = "";
  nextId = 1;
  messages = new Map();
  gates = new Map();
  failures = new Set();
  tickets = [];
  auth("u1");
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);

  fx.respond = async (request) => {
    const user = useAuthStore.getState().user;
    const admin = request.url.startsWith("/super-admin/");
    const path = request.url.replace(/^\/(me|super-admin)\/support\/tickets/, "");
    const visible = (t: Ticket) => admin || t.owner === user?.id;
    const gateKey = `${request.method ?? "GET"} ${request.url} ${request.params?.before ?? ""}`;
    const gate = [...gates.entries()].find(([key]) => gateKey.startsWith(key));
    if (gate) await gate[1];
    const failure = [...failures].find((key) => gateKey.startsWith(key));
    if (failure) {
      failures.delete(failure);
      throw new Error("Network unavailable");
    }

    if (path === "") {
      const page = Number(request.params?.page ?? 1), limit = Number(request.params?.limit ?? 20);
      const own = tickets.filter(visible).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      const rows = own.slice((page - 1) * limit, page * limit);
      return { tickets: rows.map(admin ? adminDto : ticketDto), pagination: { page, limit, total: own.length } };
    }
    const [, ticketId, action] = path.split("/");
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || !visible(ticket)) throw Object.assign(new Error("Not found"), { status: 404 });
    if (!action) return admin ? adminDto(ticket) : ticketDto(ticket);
    if (action === "status") {
      ticket.status = (request.data as { status: Ticket["status"] }).status;
      return adminDto(ticket);
    }
    const all = (messages.get(ticket.id) ?? []).slice().sort((a, b) => {
      const [ta, ia] = sortKey(a), [tb, ib] = sortKey(b);
      return ta - tb || ia.localeCompare(ib);
    });
    if (request.method === "POST") {
      const created = { id: hex(nextId++), ticketId: ticket.id, senderRole: admin ? "SUPER_ADMIN" : "CUSTOMER",
        message: (request.data as { message: string }).message, createdAt: new Date(base + 86_400_000 + nextId).toISOString() };
      messages.set(ticket.id, [...all, created]);
      return created;
    }
    expect(request.params?.history).toBe("latest");
    const limit = Number(request.params?.limit ?? 50);
    let pool = all;
    if (request.params?.before) {
      const [ms, id] = request.params.before.split("_");
      pool = all.filter((m) => before(m, Number(ms), id));
    }
    const page = pool.slice(-limit);
    const hasOlder = pool.length > limit;
    return { messages: page, pagination: { limit, total: all.length },
      history: { hasOlder, olderCursor: hasOlder ? `${Date.parse(page[0].createdAt)}_${page[0].id}` : null } };
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
async function render(node: React.ReactNode) {
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>));
  await settle();
}
async function click(node: Element | null | undefined) {
  expect(node).toBeTruthy();
  await act(async () => node!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
const button = (label: string | RegExp) => [...host.querySelectorAll("button")].find((b) =>
  typeof label === "string" ? b.textContent?.trim() === label : label.test(b.textContent ?? ""));
/** Numbers of rendered leaf nodes whose whole text is `<label> <n>`, in document order. */
const shown = (label = "Message") =>
  [...host.querySelectorAll("*")]
    .filter((node) => node.childElementCount === 0)
    .map((node) => new RegExp(`^${label} (\\d+)$`).exec(node.textContent?.trim() ?? ""))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]));
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const messageRequests = () => fx.requests.filter((r) => r.url.endsWith("/messages") && r.method !== "POST");
async function type(node: HTMLTextAreaElement | null, value: string) {
  expect(node).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(node, value);
    node!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const deferred = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
};

describe("G3 — Customer My Tickets server pagination", () => {
  beforeEach(() => {
    for (let n = 1; n <= 51; n += 1) {
      tickets.push({ id: `t${String(n).padStart(3, "0")}`, owner: "u1", subject: `Ticket ${n}`, status: "OPEN",
        createdAt: new Date(base + (51 - n) * 1000).toISOString() });
    }
    tickets.push({ id: "other", owner: "u2", subject: "Ticket of another customer", status: "OPEN", createdAt: new Date(base).toISOString() });
  });

  it("reaches ticket 51 and later pages through server page/limit requests with an accurate total", async () => {
    await render(<CustomerTicketsPage />);
    await waitFor(() => expect(host.textContent).toContain("Showing 1–20 of 51"));
    expect(fx.requests.at(-1)?.params).toEqual({ page: "1", limit: "20" });
    expect(shown("Ticket")).toEqual(range(1, 20));
    expect(host.textContent).not.toContain("another customer");

    await click(button("Next →"));
    await waitFor(() => expect(host.textContent).toContain("Showing 21–40 of 51"));
    await click(button("Next →"));
    await waitFor(() => expect(host.textContent).toContain("Showing 41–51 of 51"));
    expect(shown("Ticket")).toEqual(range(41, 51));
    expect(host.textContent).toContain("Page 3 of 3");
    expect(button("Next →")?.disabled).toBe(true);
    expect(fx.requests.filter((r) => r.url === "/me/support/tickets").map((r) => r.params?.page)).toEqual(["1", "2", "3"]);
  });

  it("moves to the last available page when the current page's final ticket disappears", async () => {
    await render(<CustomerTicketsPage />);
    await waitFor(() => expect(host.textContent).toContain("Showing 1–20 of 51"));
    await click(button("Next →"));
    await waitFor(() => expect(host.textContent).toContain("Page 2 of 3"));
    await click(button("Next →"));
    await waitFor(() => expect(host.textContent).toContain("Showing 41–51 of 51"));

    tickets = tickets.filter((t) => Number(t.subject.split(" ")[1]) <= 40 && t.owner === "u1");
    await act(async () => { await client.invalidateQueries({ queryKey: ["support"] }); });
    await waitFor(() => expect(host.textContent).toContain("Showing 21–40 of 40"));
    expect(host.textContent).toContain("Page 2 of 2");
  });

  it("shows a retryable failure instead of an empty ticket list", async () => {
    failures.add("GET /me/support/tickets ");
    await render(<CustomerTicketsPage />);
    await waitFor(() => expect(host.textContent).toContain("Your tickets could not be loaded right now."));
    expect(host.textContent).not.toContain("You have no support tickets yet.");
    await click(button("Retry"));
    await waitFor(() => expect(host.textContent).toContain("Showing 1–20 of 51"));
  });
});

describe("G4 — latest-first conversation history", () => {
  beforeEach(() => {
    tickets.push({ id: "t1", owner: "u1", subject: "Long thread", status: "OPEN", createdAt: new Date(base).toISOString() });
    tickets.push({ id: "t2", owner: "u1", subject: "Second thread", status: "OPEN", createdAt: new Date(base).toISOString() });
    seedConversation("t1", 130);
    seedConversation("t2", 3, "Other");
    fx.search = "id=t1";
  });

  it("opens on the latest messages and loads every older page once, in order, across identical timestamps", async () => {
    await render(<CustomerTicketViewPage />);
    await waitFor(() => expect(shown()).toEqual(range(81, 130)));
    expect(host.textContent).toContain("Showing the latest 50 of 130 messages");
    expect(messageRequests()[0]?.params).toEqual({ history: "latest", limit: "50" });

    await click(button("Load older messages"));
    await waitFor(() => expect(shown()).toEqual(range(31, 130)));
    await click(button("Load older messages"));
    await waitFor(() => expect(shown()).toEqual(range(1, 130)));
    expect(button("Load older messages")).toBeUndefined();
    expect(new Set(shown()).size).toBe(130);

    const befores = messageRequests().map((r) => r.params?.before ?? null);
    expect(befores).toEqual([null, expect.any(String), expect.any(String)]);
    expect(new Set(befores).size).toBe(3);
  });

  it("keeps loaded history and offers Retry when an older page fails", async () => {
    await render(<CustomerTicketViewPage />);
    await waitFor(() => expect(shown()).toEqual(range(81, 130)));
    failures.add("GET /me/support/tickets/t1/messages 1");
    await click(button("Load older messages"));
    await waitFor(() => expect(host.textContent).toContain("Older messages could not be loaded."));
    expect(shown()).toEqual(range(81, 130));
    await click(button("Retry"));
    await waitFor(() => expect(shown()).toEqual(range(31, 130)));
    expect(host.textContent).not.toContain("Older messages could not be loaded.");
  });

  it("a failed first read is an error with Retry, never an empty conversation", async () => {
    failures.add("GET /me/support/tickets/t1/messages ");
    await render(<CustomerTicketViewPage />);
    await waitFor(() => expect(host.textContent).toContain("The conversation could not be loaded."));
    expect(host.textContent).not.toContain("No messages yet.");
    await click(button("Retry"));
    await waitFor(() => expect(shown()).toEqual(range(81, 130)));
  });

  it("a reply sent while older history is loading appears once and is not overwritten", async () => {
    await render(<CustomerTicketViewPage />);
    await waitFor(() => expect(shown()).toEqual(range(81, 130)));
    const gate = deferred();
    gates.set("GET /me/support/tickets/t1/messages 1", gate.promise);
    await click(button("Load older messages"));
    await waitFor(() => expect(button("Loading older messages…")).toBeTruthy());

    await type(host.querySelector("textarea"), "Message 131");
    await click(button("Send reply"));
    await waitFor(() => expect(shown()).toEqual(range(81, 131)));

    gate.release();
    await waitFor(() => expect(shown()).toEqual(range(31, 131)));
    await settle();
    expect(shown().filter((n) => n === 131)).toHaveLength(1);
    expect(host.textContent).toContain("Showing the latest 101 of 131 messages");
  });

  it("refreshes after many new replies without gaps or duplicates", async () => {
    await render(<CustomerTicketViewPage />);
    await waitFor(() => expect(shown()).toEqual(range(81, 130)));
    const list = messages.get("t1")!;
    for (let n = 131; n <= 200; n += 1) {
      list.push({ id: hex(nextId++), ticketId: "t1", senderRole: "SUPER_ADMIN", message: `Message ${n}`,
        createdAt: new Date(base + 10 * 86_400_000 + n).toISOString() });
    }
    await act(async () => { await client.invalidateQueries({ queryKey: ["support"] }); });
    await waitFor(() => expect(shown()).toEqual(range(81, 200)));
  });

  it("switching tickets never shows a late page from the previous ticket", async () => {
    auth("u1", "STAFF");
    await render(<RequesterTicketDetail ticketId="t1" />);
    await waitFor(() => expect(shown()).toEqual(range(81, 130)));
    const gate = deferred();
    gates.set("GET /me/support/tickets/t1/messages 1", gate.promise);
    await click(button("Load older messages"));

    await render(<RequesterTicketDetail ticketId="t2" />);
    await waitFor(() => expect(shown("Other")).toEqual([1, 2, 3]));
    gate.release();
    await settle();
    await settle();
    expect(shown()).toEqual([]);
    expect(shown("Other")).toEqual([1, 2, 3]);
    expect(button("Loading older messages…")).toBeUndefined();

    await render(<RequesterTicketDetail ticketId="t1" />);
    await waitFor(() => expect(shown()).toEqual(range(31, 130)));
  });

  it("account switch and logout never expose the previous Customer's conversation", async () => {
    await render(<CustomerTicketViewPage />);
    await waitFor(() => expect(shown()).toEqual(range(81, 130)));

    const gate = deferred();
    gates.set("GET /me/support/tickets/t1", gate.promise);
    await act(async () => auth("u2"));
    await settle();
    expect(shown()).toEqual([]);
    gate.release();
    await waitFor(() => expect(host.textContent).toContain("could not be loaded"));
    expect(shown()).toEqual([]);

    await act(async () => auth(null));
    await settle();
    expect(shown()).toEqual([]);
    // Every cached Support entry is bound to the identity that read it; nothing is held unscoped.
    const cached = client.getQueryCache().getAll().filter((q) => q.state.data !== undefined);
    expect(cached.length).toBeGreaterThan(0);
    expect(cached.every((q) => typeof q.queryKey[2] === "string" && /^u[12]:\d+$/.test(q.queryKey[2] as string))).toBe(true);
    expect(cached.some((q) => (q.queryKey[2] as string).startsWith("u1:") && q.queryKey[1] === "conversation")).toBe(true);
  });
});

describe("G4 — Super Admin conversation", () => {
  beforeEach(() => {
    auth("admin", "SUPER_ADMIN");
    tickets.push({ id: "t1", owner: "u1", subject: "Long thread", status: "OPEN", createdAt: new Date(base).toISOString() });
    seedConversation("t1", 130);
  });

  it("paginates history and preserves reply and status changes", async () => {
    await render(<SuperAdminSupport />);
    await waitFor(() => expect(host.textContent).toContain("Long thread"));
    await click([...host.querySelectorAll("tr")].find((row) => row.textContent?.includes("Long thread")));
    await waitFor(() => expect(shown()).toEqual(range(81, 130)));
    expect(host.textContent).toContain("130 messages");
    expect(messageRequests().every((r) => r.url === "/super-admin/support/tickets/t1/messages")).toBe(true);

    await click(button("Load older messages"));
    await waitFor(() => expect(shown()).toEqual(range(31, 130)));

    await type(host.querySelector("textarea"), "Message 131");
    await click(button("Send Reply"));
    await waitFor(() => expect(shown()).toEqual(range(31, 131)));
    expect(fx.requests.some((r) => r.method === "POST" && r.url === "/super-admin/support/tickets/t1/messages")).toBe(true);

    const select = host.querySelector("select")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "RESOLVED");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => expect(host.textContent).toContain("RESOLVED"));
    expect(fx.requests.some((r) => r.url === "/super-admin/support/tickets/t1/status")).toBe(true);
    expect(shown()).toEqual(range(31, 131));
    expect(new Set(shown()).size).toBe(101);
  });
});
