import { expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/api/client";
import { bookingsApi } from "@/lib/api/bookings";

vi.mock("@/lib/api/client", async (original) => ({ ...await original<object>(), apiRequest: vi.fn() }));

it("Calendar sends the exact outstanding precondition without turning it into the FULL payment amount", async () => {
  vi.mocked(apiRequest).mockResolvedValue({});
  await bookingsApi.completeBooking("business", "booking", { settlement: "FULL" }, undefined, 6000);
  expect(apiRequest).toHaveBeenLastCalledWith({ method: "POST", url: "/businesses/business/bookings/booking/complete",
    data: { venuePayment: { settlement: "FULL" }, expectedOutstandingVenueBalanceCents: 6000 } });
  await bookingsApi.completeBooking("business", "booking", { settlement: "FULL" }, undefined, 0);
  expect(apiRequest).toHaveBeenLastCalledWith(expect.objectContaining({ data: {
    venuePayment: { settlement: "FULL" }, expectedOutstandingVenueBalanceCents: 0,
  } }));
});

it("existing completion callers retain the old optional-body contract", async () => {
  vi.mocked(apiRequest).mockResolvedValue({});
  await bookingsApi.completeBooking("business", "booking");
  expect(apiRequest).toHaveBeenLastCalledWith({ method: "POST", url: "/businesses/business/bookings/booking/complete", data: {} });
  await bookingsApi.completeBooking("business", "booking", { settlement: "FULL" }, 8000);
  expect(apiRequest).toHaveBeenLastCalledWith(expect.objectContaining({ data: {
    venuePayment: { settlement: "FULL" }, expectedBalanceDueCents: 8000,
  } }));
});
