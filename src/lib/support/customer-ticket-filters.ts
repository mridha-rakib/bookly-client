"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  SUPPORT_TICKET_STATUSES,
  type SupportTicketListParams,
  type SupportTicketStatus,
} from "@/lib/api/support";
import { useSupportTicketsQuery } from "./hooks";

const CHANGE = "bookly-customer-ticket-filters";
const PAGE_SIZE = 20;
type QueryParams = Pick<URLSearchParams, "get" | "getAll">;

export const parseCustomerTicketFilters = (params: QueryParams) => {
  const q = (params.get("q") ?? "").trim();
  const rawStatus = params.get("status") ?? "";
  const rawPage = params.get("page") ?? "1";
  const page = Number(rawPage);
  const status = SUPPORT_TICKET_STATUSES.includes(rawStatus as SupportTicketStatus)
    ? (rawStatus as SupportTicketStatus)
    : undefined;
  const valid =
    q.length <= 100 &&
    (!rawStatus || Boolean(status)) &&
    /^\d+$/.test(rawPage) &&
    Number.isSafeInteger(page) &&
    page >= 1 &&
    page <= Math.floor(Number.MAX_SAFE_INTEGER / 50) &&
    ["q", "status", "page"].every((key) => params.getAll(key).length <= 1);
  return { q, status, page: valid ? page : 1, valid };
};

export const customerTicketsHref = (params: SupportTicketListParams, ticketId?: string) => {
  const query = new URLSearchParams();
  if (ticketId) query.set("id", ticketId);
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.status) query.set("status", params.status);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const path = ticketId ? "/customer/tickets/view" : "/customer/tickets";
  return query.size ? `${path}?${query}` : path;
};

const subscribe = (notify: () => void) => {
  window.addEventListener("popstate", notify);
  window.addEventListener(CHANGE, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(CHANGE, notify);
  };
};
const snapshot = () => window.location.search;
const serverSnapshot = () => "";
const navigate = (params: SupportTicketListParams, replace = false) => {
  const href = customerTicketsHref(params);
  if (window.location.pathname + window.location.search === href) return;
  // Next's supported native history integration preserves Back/Forward without a route fetch.
  window.history[replace ? "replaceState" : "pushState"](null, "", href);
  window.dispatchEvent(new Event(CHANGE));
};

export const useCustomerTicketsPage = () => {
  const search = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const filters = parseCustomerTicketFilters(new URLSearchParams(search));
  const { q, status, page, valid } = filters;
  const [input, setInput] = useState({ draft: q, applied: q });
  // Browser Back/Forward and external URL changes also restore the visible search input.
  if (input.applied !== q) setInput({ draft: q, applied: q });
  const draft = input.applied === q ? input.draft : q;
  useEffect(() => {
    if (!valid || draft.trim() === q) return;
    const timeout = setTimeout(
      () => navigate({ q: draft.trim(), ...(status ? { status } : {}), page: 1 }),
      350,
    );
    return () => clearTimeout(timeout);
  }, [draft, q, status, valid, search]);
  const query = useSupportTicketsQuery(
    { q, ...(status ? { status } : {}), page, limit: PAGE_SIZE },
    valid,
  );
  const total = query.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const outOfRange = Boolean(query.data) && page > totalPages;
  useEffect(() => {
    if (outOfRange) navigate({ q, ...(status ? { status } : {}), page: totalPages }, true);
  }, [outOfRange, q, status, totalPages]);
  return {
    page,
    total,
    totalPages,
    q,
    status,
    draft,
    error: valid ? null : "Invalid ticket filters. Clear filters to try again.",
    setSearch: (draft: string) => setInput({ draft, applied: q }),
    setStatus: (value: string) => {
      if (value && !SUPPORT_TICKET_STATUSES.includes(value as SupportTicketStatus)) return;
      navigate({
        q: draft.trim(),
        ...(value ? { status: value as SupportTicketStatus } : {}),
        page: 1,
      });
    },
    clearSearch: () => {
      setInput({ draft: "", applied: "" });
      navigate({ ...(status ? { status } : {}), page: 1 });
    },
    clearFilters: () => {
      setInput({ draft: "", applied: "" });
      navigate({});
    },
    setPage: (next: number | ((page: number) => number)) =>
      navigate({
        q,
        ...(status ? { status } : {}),
        page: typeof next === "function" ? next(page) : next,
      }),
    href: (id: string) => customerTicketsHref({ q, ...(status ? { status } : {}), page }, id),
    ticketsQuery: { ...query, isLoading: query.isLoading || outOfRange },
  };
};
