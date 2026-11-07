import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { catalogApi } from "@/lib/api/catalog";
import type { ConsentIntent } from "@/lib/api/package-consent";
import { PackagePurchaseAppointmentPicker } from "@/components/packages/PackagePurchaseAppointmentPicker";
vi.mock("@/lib/api/catalog", () => ({ catalogApi: { getServiceAvailability: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.clearAllMocks());
const instant = "2030-08-21T10:00:00Z";
it.each(["failed", "other professional"])("%s availability cannot preserve an old appointment selection", async (outcome) => {
  let latest: ConsentIntent["selections"][number];
  const host = document.createElement("div"), root = createRoot(host);
  function Form() {
    const [row, setRow] = useState<ConsentIntent["selections"][number]>({ selectionId: "selection", definitionItemId: "item", serviceId: "service", staffMembershipId: "staff", startAt: "", addonIds: [] });
    latest = row;
    return <PackagePurchaseAppointmentPicker businessId="business" row={row} item={{ definitionItemId: "item", serviceId: "service", name: "Massage", quantity: 2, providers: [{ id: "staff", name: "Alex" }] }} travel={false} disabled={false} onChange={setRow} />;
  }
  async function change(label: string, value: string) {
    await act(async () => {
      const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${label}"]`)!;
      Object.getOwnPropertyDescriptor(input.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("change", { bubbles: true })); input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  const response = (staff: string) => ({ timezone: "Europe/Nicosia", days: [{ date: "2030-08-21", slots: [{ startAt: instant, endAt: "2030-08-21T11:00:00Z", eligibleStaffMembershipIds: [staff] }] }] });
  try {
    vi.mocked(catalogApi.getServiceAvailability).mockResolvedValueOnce(response("staff") as never);
    await act(async () => root.render(<Form />));
    await change("Package appointment date", "2030-08-21");
    const find = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Find available times")!;
    await act(async () => find().click());
    await change("Package appointment time", instant);
    expect(latest!.startAt).toBe(instant);
    expect(host.textContent).toContain("Selected: Massage · Alex");
    if (outcome === "failed") vi.mocked(catalogApi.getServiceAvailability).mockRejectedValueOnce(new Error("offline"));
    else vi.mocked(catalogApi.getServiceAvailability).mockResolvedValueOnce(response("different-staff") as never);
    await act(async () => find().click());
    expect(latest!.startAt).toBe("");
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Package appointment time"]')!.options.length).toBe(1);
    expect(host.textContent).toContain(outcome === "failed" ? "could not be loaded" : "No available times");
  } finally { await act(async () => root.unmount()); }
});
