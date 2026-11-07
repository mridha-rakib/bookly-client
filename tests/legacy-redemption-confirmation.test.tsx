import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LegacyRedemptionConfirmation } from "@/components/packages/LegacyRedemptionConfirmation";
import { bookingsApi, type BookingDetail } from "@/lib/api/bookings";

vi.mock("@/lib/api/bookings", async (original) => ({ ...await original<object>(), bookingsApi: { getDetailForCustomer: vi.fn() } }));
vi.mock("@/lib/auth/store", () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ user: { id: "customer" }, cacheEpoch: 1 }) }));
vi.mock("@/app/venue/components/ConfirmedStep", () => ({
  default: ({ booking, businessName }: { booking: BookingDetail; businessName?: string }) => <p>Booking Confirmed {booking.reference} at {businessName}</p>,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement, root: Root, client: QueryClient;
beforeEach(() => { vi.clearAllMocks(); host = document.createElement("div"); document.body.append(host); root = createRoot(host); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); });
afterEach(async () => { await act(async () => root.unmount()); client.clear(); host.remove(); });
const booking = (packageProgressId: string, businessId = "business") =>
  ({ id: "booking", reference: "BK-123", businessId, serviceLines: [{ packageProgressId }] }) as unknown as BookingDetail;
async function render(onClose = vi.fn()) {
  await act(async () => root.render(<QueryClientProvider client={client}>
    <LegacyRedemptionConfirmation bookingId="booking" businessId="business" packageProgressId="progress" businessName="Venue" onClose={onClose} />
  </QueryClientProvider>));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  return onClose;
}

it("P0.8 shows the shared Booking Confirmed screen from the persisted redeemed Booking", async () => {
  vi.mocked(bookingsApi.getDetailForCustomer).mockResolvedValue(booking("progress"));
  const onClose = await render();
  expect(host.textContent).toContain("Booking Confirmed BK-123 at Venue");
  expect(bookingsApi.getDetailForCustomer).toHaveBeenCalledWith("booking");
  await act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Back to package"))!.click());
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("P0.8 never confirms a Booking that belongs to another Package or Business", async () => {
  for (const wrong of [booking("other-progress"), booking("progress", "other-business")]) {
    client.clear();
    vi.mocked(bookingsApi.getDetailForCustomer).mockResolvedValue(wrong);
    await render();
    expect(host.textContent).not.toContain("Booking Confirmed");
    expect(host.textContent).toContain("do not book it again");
  }
});
