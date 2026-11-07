import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ClientsPage from "@/components/clients/ClientsPage";
import ArchivedClientsList from "@/components/clients/ArchivedClientsList";
import type ClientForm from "@/components/clients/ClientForm";
import type ClientsList from "@/components/clients/ClientsList";
import type { BusinessClientDto } from "@/lib/api/clients";
import { clientInputSchema, clientUpdateSchema } from "@/lib/clients/schema";

const fx = vi.hoisted(() => ({ list: vi.fn(), history: vi.fn(), update: vi.fn(), refetch: vi.fn(),
  dto: {} as BusinessClientDto, error: false }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DashboardHeader", () => ({ default: () => null }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/staff/hooks", () => ({ useStaffListQuery: () => ({ data: { members: [] } }) }));
vi.mock("@/lib/clients/hooks", () => ({
  useClientsQuery: (business: string, params: { page: number; limit: number }) => {
    fx.list(business, params);
    return { data: { clients: [fx.dto], pagination: { ...params, total: 121 }, stats: { totalClients: 121, newThisMonth: 1 } },
      isLoading: false, isError: fx.error, error: new Error("Directory failed"), refetch: fx.refetch };
  },
  useClientQuery: (_business: string, id?: string) => ({ data: id ? fx.dto : undefined, isError: false }),
  useCreateClientMutation: () => ({ mutate: vi.fn() }),
  useUpdateClientMutation: () => ({ mutate: fx.update }),
  useArchiveClientMutation: () => ({ mutate: vi.fn() }),
  useRestoreClientMutation: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/lib/bookings/hooks", () => ({ useBusinessBookingsQuery: (business: string, params: object) => {
  fx.history(business, params);
  return { data: { bookings: [], pagination: { page: 1, limit: 20, total: 121 } }, isLoading: false, isError: false };
} }));
vi.mock("@/components/clients/ClientsList", () => ({ default: (p: ComponentProps<typeof ClientsList>) => createElement("div", {},
  createElement("button", { onClick: () => p.onViewClient?.(p.clientsData[0]!) }, "View"),
  createElement("button", { onClick: () => p.onEditClient?.(p.clientsData[0]!) }, "Edit"),
  createElement("button", { onClick: () => p.onPageChange?.(6) }, "Page 6"),
  createElement("button", { onClick: () => p.onSearchChange?.("Beyond 100") }, "Search"),
  createElement("button", { onClick: () => p.onTagChange?.("VIP") }, "VIP")) }));
vi.mock("@/components/clients/ClientForm", () => ({ default: (p: ComponentProps<typeof ClientForm>) => createElement("div", {},
  createElement("p", {}, `City:${p.clientCity};Directions:${p.clientDirections}`),
  createElement("button", { onClick: () => p.setClientNotes("New notes") }, "Change notes"),
  createElement("button", { onClick: p.handleSaveClient }, "Save")) }));
let host: HTMLDivElement, root: Root;
const button = (name: string) => Array.from(host.querySelectorAll("button")).find(b => b.textContent?.trim() === name)!;
const click = async (name: string) => { await act(async () => button(name).click()); };
const input = async (selector: string, value: string) => {
  const field = host.querySelector<HTMLInputElement>(selector)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true })); });
};
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  fx.list.mockClear(); fx.history.mockClear(); fx.update.mockClear(); fx.refetch.mockClear(); fx.error = false;
  fx.dto = { id: "client", businessId: "business", firstName: "At-location client", email: "client@example.com",
    phone: { countryCode: "+357", nationalNumber: "99112233", e164: "+35799112233" },
    linkState: "LINKED", createdAt: "2026-11-01T10:00:00Z", updatedAt: "2026-11-01T10:00:00Z" } as BusinessClientDto;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const mount = async () => { await act(async () => root.render(createElement(ClientsPage, { businessId: "business" }))); };
it("views an address-less Client and scopes canonical history to both identifiers", async () => {
  await mount(); await click("View");
  expect(host.textContent).toContain("At-location client");
  expect(fx.history).toHaveBeenLastCalledWith("business", expect.objectContaining({ businessClientId: "client", page: 1, limit: 20 }));
});
it.each([false, true])("saves non-address edits with saved-address=%s", async (withAddress) => {
  if (withAddress) fx.dto.address = { city: "Larnaca", propertyType: "Apartment", area: "Centre", streetName: "Main", streetNumber: "1", additionalDirections: "Blue door" };
  await mount(); await click("Edit"); await click("Change notes"); await click("Save");
  expect(fx.update).toHaveBeenCalledOnce();
  const payload = fx.update.mock.calls[0]![0];
  expect(payload).toMatchObject({ businessId: "business", clientId: "client", input: { notes: "New notes" } });
  expect(payload.input).not.toHaveProperty("firstName");
  if (withAddress) expect(payload.input.address).toMatchObject(fx.dto.address!);
  else expect(payload.input).not.toHaveProperty("address");
});
it("allows optional address on PATCH while validating any supplied address and preserving create rules", () => {
  expect(clientUpdateSchema.safeParse({ notes: "Edited" }).success).toBe(true);
  expect(clientUpdateSchema.safeParse({ address: { city: "Larnaca" } }).success).toBe(false);
  expect(clientInputSchema.safeParse({ firstName: "Client", email: "client@example.com", phone: fx.dto.phone }).success).toBe(false);
});
it("requests active pages beyond 100 and resets paging for server search/tag", async () => {
  await mount(); await click("Page 6");
  expect(fx.list).toHaveBeenLastCalledWith("business", expect.objectContaining({ page: 6, limit: 20, archived: false }));
  await click("Search"); expect(fx.list).toHaveBeenLastCalledWith("business", expect.objectContaining({ page: 1, q: "Beyond 100" }));
  await click("Page 6"); await click("VIP");
  expect(fx.list).toHaveBeenLastCalledWith("business", expect.objectContaining({ page: 1, tag: "VIP", q: "Beyond 100" }));
});
it("paginates archived Clients and wires address-less archived history", async () => {
  await act(async () => root.render(createElement(ArchivedClientsList, { businessId: "business", onBack: vi.fn() })));
  for (let page = 2; page <= 6; page++) await click("Next");
  expect(host.textContent).toContain("Showing 101–120 of 121");
  expect(fx.list).toHaveBeenLastCalledWith("business", expect.objectContaining({ page: 6, archived: true }));
  await input('[aria-label="Search archived clients"]', "At-location");
  expect(fx.list).toHaveBeenLastCalledWith("business", expect.objectContaining({ page: 1, q: "At-location" }));
  await click("View"); await click("History");
  expect(fx.history).toHaveBeenLastCalledWith("business", expect.objectContaining({ businessClientId: "client" }));
  expect(host.textContent).not.toContain("Loading"); expect(button("Edit")).toBeUndefined();
  await click("Next");
  expect(fx.history).toHaveBeenLastCalledWith("business", expect.objectContaining({ page: 2 }));
  await input('[aria-label="Search client booking history by reference"]', "BK-101");
  expect(fx.history).toHaveBeenLastCalledWith("business", expect.objectContaining({ page: 1, reference: "BK-101" }));
});
it("shows a retryable archived directory error", async () => {
  fx.error = true;
  await act(async () => root.render(createElement(ArchivedClientsList, { businessId: "business", onBack: vi.fn() })));
  expect(host.querySelector('[role="alert"]')).not.toBeNull(); await click("Retry"); expect(fx.refetch).toHaveBeenCalledOnce();
});
