import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SuperAdminCustomers from "@/components/super-admin/customers/SuperAdminCustomers";
import SuperAdminCustomerDetail from "@/components/super-admin/customers/SuperAdminCustomerDetail";
import { CustomerExport } from "@/components/super-admin/customers/CustomerShared";
import { superAdminCustomersApi, type SuperAdminCustomerDetail as CustomerDetailDto } from "@/lib/api/superAdminCustomers";
import { apiRequest } from "@/lib/api/client";
import { useSuperAdminCustomerDetailQuery, useSuperAdminCustomersQuery } from "@/lib/superAdminCustomers/hooks";

vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/superAdminCustomers/hooks", () => ({ useSuperAdminCustomerDetailQuery: vi.fn(), useSuperAdminCustomersQuery: vi.fn() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const customer = {
  id: "customer-global", email: "dana@example.com", firstName: "Dana", lastName: "Klein", status: "SUSPENDED",
  createdAt: "2026-01-01T00:00:00Z", businessCount: 2, hasSavedCard: true,
  savedCard: { brand: "visa", last4: "4242" }, marketingConsent: false,
  statistics: { total: 62, completed: 52, noShows: 3, upcoming: 7 }, bookingsTotal: 62,
  bookingPagination: { page: 1, limit: 20, total: 62 }, relationshipPagination: { page: 1, limit: 20, total: 22 },
  relationships: [
    { id: "relationship-a", businessId: "a", businessName: "Business A", classification: "RETURNING", archived: false, financialState: "CONSUMED", lastBooking: null, notes: "Real note" },
    { id: "relationship-b", businessId: "b", businessName: "Business B", classification: "FIRST", archived: false, financialState: "ELIGIBLE", lastBooking: null, notes: null },
  ],
  bookings: [{ id: "booking-1", businessId: "a", businessName: "Business A", reference: "BK-1", status: "CANCELLED_BY_CUSTOMER", source: "BOOKLY_MANAGED", primaryServiceName: "Service A",
    schedule: { startAt: "2030-01-01T10:00:00Z", endAt: "2030-01-01T11:00:00Z", timezone: "Europe/Nicosia" },
    totalCents: 10000, depositCents: 2000, actualOnlinePaidCents: 500, currency: "EUR", packageSessions: [] }],
} as unknown as CustomerDetailDto;

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  vi.mocked(apiRequest).mockReset();
  vi.mocked(useSuperAdminCustomersQuery).mockReturnValue({ data: { customers: [customer], pagination: { page: 1, limit: 20, total: 1 } }, isLoading: false, isError: false } as unknown as ReturnType<typeof useSuperAdminCustomersQuery>);
  vi.mocked(useSuperAdminCustomerDetailQuery).mockReturnValue({ data: customer, isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useSuperAdminCustomerDetailQuery>);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const click = async (node: Element | null) => { if (!node) throw Error("Missing control"); await act(async () => (node as HTMLElement).click()); };

describe("Super Admin Customers component interactions", () => {
  it("shows one identity with actual indicators and opens the selected Customer", async () => {
    function Screen() {
      const [id, setId] = useState<string | null>(null);
      return <SuperAdminCustomers viewingCustomerId={id} setViewingCustomerId={setId} />;
    }
    await render(<Screen />);
    expect(host.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(host.textContent).toContain("Not opted in"); expect(host.textContent).toContain("Suspended");
    const view = [...host.querySelectorAll("button")].find((button) => button.textContent === "View Customer");
    await click(view ?? null);
    expect(useSuperAdminCustomerDetailQuery).toHaveBeenLastCalledWith("customer-global", 1, 1);
    expect(host.textContent).toContain("Customer–Business Relationships");
  });

  it("shows full-history KPIs, Business-specific relationships, and actual paid amounts", async () => {
    await render(<SuperAdminCustomerDetail customerId={customer.id} onBack={vi.fn()} />);
    const stats = host.querySelector('[aria-label="Booking statistics"]');
    expect(stats?.textContent).toContain("62"); expect(stats?.textContent).toContain("52");
    expect(host.textContent).toContain("Returning"); expect(host.textContent).toContain("First");
    expect(host.textContent).toContain("€5.00"); expect(host.textContent).not.toContain("€20.00");
    expect(host.textContent).toContain("Cancelled by customer"); expect(host.textContent).toContain("visa •••• 4242");
    expect(host.textContent).toContain("Not provided");
  });

  it("drives Booking and relationship pagination independently", async () => {
    await render(<SuperAdminCustomerDetail customerId={customer.id} onBack={vi.fn()} />);
    await click(host.querySelector('[aria-label="Customer booking history pagination"] button:last-child'));
    expect(useSuperAdminCustomerDetailQuery).toHaveBeenLastCalledWith(customer.id, 2, 1);
    await click(host.querySelector('[aria-label="Customer relationships pagination"] button:last-child'));
    expect(useSuperAdminCustomerDetailQuery).toHaveBeenLastCalledWith(customer.id, 2, 2);
  });

  it("shows a recoverable error instead of an endless loading state", async () => {
    const refetch = vi.fn();
    vi.mocked(useSuperAdminCustomerDetailQuery).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as unknown as ReturnType<typeof useSuperAdminCustomerDetailQuery>);
    await render(<SuperAdminCustomerDetail customerId={customer.id} onBack={vi.fn()} />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Failed to load");
    await click([...host.querySelectorAll("button")].find((button) => button.textContent === "Retry") ?? null);
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("applies the stored status filter on the server and resets list pagination", async () => {
    await render(<SuperAdminCustomers />);
    await click([...host.querySelectorAll("button")].find((button) => button.textContent === "Dormant") ?? null);
    expect(useSuperAdminCustomersQuery).toHaveBeenLastCalledWith({ status: "DORMANT", page: 1, limit: 20 });
  });

  it("reports export failures and retains the declared scope", async () => {
    await render(<CustomerExport scope="All matching customers" load={vi.fn().mockRejectedValue(new Error("Offline"))} />);
    await click(host.querySelector("button"));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Export failed");
    expect(host.textContent).toContain("All matching customers");
  });

  it("downloads the authorized CSV using its provided filename and releases the object URL", async () => {
    const createUrl = vi.fn(() => "blob:customers"), revokeUrl = vi.fn();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: createUrl, revokeObjectURL: revokeUrl }));
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download); });
    try {
      await render(<CustomerExport scope="All matching customers" load={vi.fn().mockResolvedValue({ csv: '"Name"\r\n"Dana"', filename: "bookly-customers.csv" })} />);
      await click(host.querySelector("button"));
      expect(clicked).toEqual(["bookly-customers.csv"]);
      expect(createUrl).toHaveBeenCalledOnce(); expect(revokeUrl).toHaveBeenCalledWith("blob:customers");
    } finally { vi.unstubAllGlobals(); }
  });

  it("uses authenticated API wrappers with exact detail and CSV scope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    await superAdminCustomersApi.getById(customer.id, 3, 2);
    expect(apiRequest).toHaveBeenLastCalledWith({ method: "GET", url: `/super-admin/customers/${customer.id}`, params: { page: 3, relationshipsPage: 2 } });
    await superAdminCustomersApi.exportCustomers({ q: "Dana", status: "SUSPENDED", page: 5 });
    expect(apiRequest).toHaveBeenLastCalledWith({ method: "GET", url: "/super-admin/customers/export", params: { q: "Dana", status: "SUSPENDED" } });
    await superAdminCustomersApi.exportBookings(customer.id);
    expect(apiRequest).toHaveBeenLastCalledWith({ method: "GET", url: `/super-admin/customers/${customer.id}/bookings/export` });
  });
});
