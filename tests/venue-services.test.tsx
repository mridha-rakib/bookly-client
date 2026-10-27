import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VenueServices from "@/app/venue/components/VenueServices";
import { venuePackages, venueServices } from "./visual/venue-services-fixtures";
import type { PackageOffer } from "@/lib/api/package-views";
import type { CatalogService } from "@/lib/api/catalog";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const book = vi.fn();
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host); book.mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
function Fixture({ packages = venuePackages, loading = false, error, customer = true, services = venueServices }: { packages?: PackageOffer[]; loading?: boolean; error?: unknown; customer?: boolean; services?: CatalogService[] }) {
  const [filter, setFilter] = useState("Featured");
  return <section id="services"><VenueServices services={services} subcategories={["Massage", "Movement"]} selectedFilter={filter} onSelectFilter={setFilter} serviceLoading={false} serviceError={false} packages={packages} packageLoading={loading} packageError={error} isCustomer={customer}
    renderService={(service) => <article><h4>{service.name}</h4><button onClick={() => book(service.id)}>Book {service.name}</button></article>} /></section>;
}
async function render(props: React.ComponentProps<typeof Fixture> = {}) { await act(async () => root.render(<Fixture {...props} />)); }
async function click(label: string) { await act(async () => { const button = [...host.querySelectorAll("button")].find((b) => b.textContent === label); if (!button) throw Error(`Missing ${label}`); button.click(); }); }
const names = () => [...host.querySelectorAll("h4")].map((n) => n.textContent);
describe("Venue Services unified discovery", () => {
  it("V1-01/02: original filters come first, with no independent package heading", async () => {
    await render(); expect(host.querySelector("#services")?.firstElementChild?.getAttribute("aria-label")).toBe("Service filters");
    expect(host.querySelector("h2,h3")).toBeNull();
    expect(host.querySelector('[data-offering-kind="first-class"]')).toBeNull();
  });
  it("V1-03/04: Packages contains both families and no ordinary services", async () => {
    await render(); await click("Packages"); expect(names()).toEqual(["Legacy package", ...venuePackages.map((p) => p.name)]);
    expect(host.querySelectorAll('[data-offering-kind="first-class"]')).toHaveLength(2);
  });
  it("V1-05/06: Business-created category chips have exact service membership", async () => {
    await render(); expect([...host.querySelectorAll('[aria-label="Service filters"] button')].map((b) => b.textContent)).toEqual(["All", "Featured", "Packages", "Massage", "Movement"]);
    await click("Movement"); expect(names()).toEqual(["Movement appointment"]);
    await click("Massage"); expect(names()).toEqual(["Featured treatment", "Legacy package"]);
  });
  it("V1-07: All preserves service order, then server package order; colliding IDs stay distinct", async () => {
    await render(); await click("All"); expect(names()).toEqual([...venueServices.map((s) => s.name), ...venuePackages.map((p) => p.name)]);
    expect(host.querySelectorAll(`[data-offering-id="${venuePackages[0].id}"]`)).toHaveLength(2);
  });
  it("V1-08/09: Featured retains service eligibility, never guesses a package flag", async () => {
    await render({ packages: [{ ...venuePackages[0], isFeatured: true } as PackageOffer] }); expect(names()).toEqual(["Featured treatment", "Legacy package"]);
  });
  it("V1-10: repeated switching has stable, duplicate-free results", async () => {
    await render(); for (let i = 0; i < 4; i++) { await click("Packages"); expect(names()).toHaveLength(3); await click("Featured"); expect(names()).toHaveLength(2); }
    await click("Packages"); expect(new Set(names()).size).toBe(3);
  });
  it("V1-11: See all resets the selected filter; it does not invent pagination", async () => {
    await render(); await click("Movement"); await click("See all"); expect(names()).toHaveLength(5); expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toBe("All");
  });
  it("V1-12/13/14/17: compact package uses bundle price, exact rows, Group rule and detail-only action", async () => {
    await render(); await click("Packages"); const card = host.querySelector('[data-offering-kind="first-class"]')!;
    for (const text of ["€240.00", "Package bundle total", "6 sessions", "4 sessions", "10 total sessions", "Fixed", "one credit = one participant / seat", "FINITE6", "Checkout unavailable"]) expect(card.textContent).toContain(text);
    expect(card.querySelector("a")?.getAttribute("href")).toBe(`/customer/package-consent/${venuePackages[0].businessId}/${venuePackages[0].id}`);
    expect(card.querySelector("button")).toBeNull(); expect(card.querySelector(".line-through")).toBeNull();
  });
  it("V1-15/16: each existing service retains its own booking ID and callback", async () => {
    await render(); await click("Book Legacy package"); await click("Book Featured treatment"); expect(book.mock.calls).toEqual([["legacy"], [venueServices[0].id]]);
  });
  it("V1-18: loading stays below filters, scoped away from Featured", async () => {
    await render({ packages: [], loading: true }); expect(host.querySelector('[role="status"]')).toBeNull(); await click("Packages");
    const filters = host.querySelector('[aria-label="Service filters"]')!; const status = host.querySelector('[role="status"]')!;
    expect(filters.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); expect(names()).toEqual(["Legacy package"]);
  });
  it.each([429, 503])("V1-19/22: package error %i preserves ordinary/legacy cards and is scoped", async (status) => {
    await render({ packages: [], error: { status } }); expect(host.querySelector('[role="alert"]')).toBeNull(); await click("All"); expect(names()).toEqual(venueServices.map((s) => s.name)); expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await click("Movement"); expect(host.querySelector('[role="alert"]')).toBeNull();
  });
  it("V1-20: no first-class results leave the legacy package and no empty upper section", async () => {
    await render({ packages: [] }); await click("Packages"); expect(names()).toEqual(["Legacy package"]); expect(host.querySelectorAll('[data-offering-kind="first-class"]')).toHaveLength(0);
  });
  it("anonymous browsing retains public cards and a scoped existing sign-in link", async () => {
    await render({ packages: [], customer: false }); expect(names()).toEqual(["Featured treatment", "Legacy package"]); await click("Packages"); expect(host.querySelector('a[href="/customer"]')).not.toBeNull();
  });
  it("V1-20: no products in a filter shows a compact honest empty state", async () => {
    await render({ packages: [], services: venueServices.filter((s) => !s.isPackageDeal) }); await click("Packages");
    expect(names()).toEqual([]); expect(host.textContent).toContain("No offerings match this filter.");
    expect(host.querySelector('button[aria-pressed="true"]')?.textContent).toBe("Packages");
  });
});
