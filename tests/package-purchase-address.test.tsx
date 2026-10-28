import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { PackagePurchaseAppointmentPicker } from "@/components/packages/PackagePurchaseAppointmentPicker";
import type { ConsentIntent } from "@/lib/api/package-consent";

it("P4E Package purchase captures structured apartment destination fields and invalidates the selected time", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  let latest: ConsentIntent["selections"][number] | undefined;
  function Form() {
    const [row, setRow] = useState<ConsentIntent["selections"][number]>({ selectionId: "selection", definitionItemId: "item",
      serviceId: "service", staffMembershipId: "staff", startAt: "2030-08-21T10:00:00Z", addonIds: [],
      travelAddress: { city: "Larnaca", area: "Center", streetName: "Main", streetNumber: "4", propertyType: "Apartment" } });
    latest = row;
    return <PackagePurchaseAppointmentPicker businessId="business" row={row}
      item={{ definitionItemId: "item", serviceId: "service", name: "Massage", quantity: 2, providers: [{ id: "staff", name: "Alex" }], travelCities: ["Larnaca"] }}
      travel disabled={false} onChange={setRow} />;
  }
  try {
    await act(async () => root.render(<Form />));
    for (const [field, value] of Object.entries({ floorUnit: "3", aptRoom: "12", additionalDirections: "Main entrance" })) {
      await act(async () => {
        const input = host.querySelector<HTMLInputElement>(`[aria-label="Package travel ${field}"]`)!;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    expect(latest?.travelAddress).toMatchObject({ floorUnit: "3", aptRoom: "12", additionalDirections: "Main entrance" });
    expect(latest?.startAt).toBe("");
    expect(latest?.staffMembershipId).toBe("staff");
  } finally {
    await act(async () => root.unmount()); host.remove();
  }
});
