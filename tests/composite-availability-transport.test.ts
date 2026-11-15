import { describe, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ request: vi.fn().mockResolvedValue({ days: [] }) }));
vi.mock("@/lib/api/client", () => ({ apiRequest: api.request }));
import { availabilityApi } from "@/lib/api/availability";
describe("composite availability transport", () => {
  it.each([ ["customer", "/catalog/businesses/business/bookings/composite-availability"], ["business", "/businesses/business/bookings/composite-availability"] ] as const)("sends all lines for %s", async (scope, url) => {
    const input = { fromDate: "2030-05-01", toDate: "2030-05-10", lines: [
      { serviceId: "one", staffMembershipId: "a", hours: 2 },
      { serviceId: "two", staffMembershipId: "b", partySize: 3 },
    ] };
    await availabilityApi.getComposite(scope, "business", input);
    expect(api.request).toHaveBeenLastCalledWith({ method: "POST", url, data: input });
  });
});
