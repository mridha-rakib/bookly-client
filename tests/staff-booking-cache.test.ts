import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { invalidateBusinessBookingViews } from "@/lib/bookings/dashboard-cache";

it("invalidates assigned appointment lists for the changed business only", async () => {
  const client = new QueryClient();
  const mine = ["staff", "my-appointments", "business", "list", { page: 1 }];
  const other = ["staff", "my-appointments", "other", "list", { page: 1 }];
  const adminDetail = ["superAdminBookings", "detail", "booking"];
  client.setQueryData(mine, { appointments: [] });
  client.setQueryData(other, { appointments: [] });
  client.setQueryData(adminDetail, { status: "UPCOMING" });
  await invalidateBusinessBookingViews(client, "business");
  expect(client.getQueryState(mine)?.isInvalidated).toBe(true);
  expect(client.getQueryState(other)?.isInvalidated).toBe(false);
  expect(client.getQueryState(adminDetail)?.isInvalidated).toBe(true);
  client.clear();
});

it("refetches an active assigned appointment list after a booking change", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ["staff", "my-appointments", "business", "list", { page: 1 }];
  let status = "UPCOMING";
  const observer = new QueryObserver(client, { queryKey: key, queryFn: async () => ({ status }) });
  const unsubscribe = observer.subscribe(() => {});
  try {
    await observer.refetch();
    status = "CANCELLED_BY_BUSINESS";
    await invalidateBusinessBookingViews(client, "business");
    expect(observer.getCurrentResult().data).toEqual({ status: "CANCELLED_BY_BUSINESS" });
  } finally {
    unsubscribe();
    client.clear();
  }
});
