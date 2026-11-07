import type { QueryClient } from "@tanstack/react-query";
import { invalidateHomeNoDepositForBusiness } from "@/lib/discovery/no-deposit-keys";

/** Business-scoped shared read models affected by committed Booking/Package changes. */
export function invalidateBusinessBookingViews(client: QueryClient, businessId: string) {
  return Promise.all([
    invalidateHomeNoDepositForBusiness(client, businessId),
    ...[
    ["dashboardOverview", businessId], ["dashboardAnalytics", businessId],
    ["finance", "summary", businessId], ["finance", "transactions", businessId], ["finance", "payouts", businessId],
    ["bookings", "list", businessId], ["bookings", "calendar", businessId], ["bookings", "detail", businessId],
    ["availability", businessId], ["catalog", "availability", businessId], ["clients", "list", businessId],
    ["bookingRescheduleAvailability"],
    ].map(queryKey => client.invalidateQueries({ queryKey })),
  ]);
}
export function invalidateStaffSchedulingViews(client: QueryClient, businessId: string) {
  return Promise.all([
    client.invalidateQueries({
      queryKey: ["bookingRescheduleAvailability"],
      predicate: query => query.queryKey[2] === businessId,
    }),
    ...[
    ["staff", "list", businessId], ["staff", "my-schedule", businessId], ["staff", "my-services", businessId],
    ["availability", businessId], ["catalog", "availability", businessId], ["catalog", "business", businessId],
    ["bookings", "calendar", businessId], ["dashboardOverview", businessId],
    ].map(queryKey => client.invalidateQueries({ queryKey })),
  ]);
}
