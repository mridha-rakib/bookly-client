import type { QueryClient } from "@tanstack/react-query";
import { invalidateHomeNoDepositForBusiness } from "@/lib/discovery/no-deposit-keys";

/** Business-scoped shared read models affected by committed Booking/Package changes. */
export function invalidateBusinessBookingViews(client: QueryClient, businessId: string) {
  return Promise.all([
    invalidateHomeNoDepositForBusiness(client, businessId),
    client.invalidateQueries({ queryKey: ["availability", "composite"], predicate: query => query.queryKey[3] === businessId }),
    ...[
    ["dashboardOverview", businessId], ["dashboardAnalytics", businessId],
    ["finance", "summary", businessId], ["finance", "transactions", businessId], ["finance", "payouts", businessId],
    ["bookings", "list", businessId], ["bookings", "calendar", businessId], ["bookings", "detail", businessId],
    ["staff", "my-appointments", businessId],
    ["superAdminBookings"],
    ["availability", businessId], ["catalog", "availability", businessId], ["clients", "list", businessId],
    ["bookingRescheduleAvailability"],
    ].map(queryKey => client.invalidateQueries({ queryKey })),
  ]);
}
export function invalidateStaffSchedulingViews(client: QueryClient, businessId: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ["availability", "composite"], predicate: query => query.queryKey[3] === businessId }),
    client.invalidateQueries({
      queryKey: ["bookingRescheduleAvailability"],
      predicate: query => query.queryKey[2] === businessId,
    }),
    ...[
    ["staff", "list", businessId], ["staff", "my-schedule", businessId], ["staff", "my-services", businessId],
    ["services", "list", businessId], ["services", "detail", businessId],
    ["availability", businessId], ["catalog", "availability", businessId], ["catalog", "business", businessId],
    ["bookings", "calendar", businessId], ["dashboardOverview", businessId],
    ].map(queryKey => client.invalidateQueries({ queryKey })),
  ]);
}
