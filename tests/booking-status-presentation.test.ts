/** 2026-11-20 Booking completion audit: a reversed no-show is never presented as a no-show. */
import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUS_LABELS,
  BUSINESS_BOOKING_STATUS_LABELS,
  CUSTOMER_BOOKING_TAB_STATUSES,
} from "@/lib/bookings/format";

describe("reversed no-show presentation", () => {
  it("labels NO_SHOW_CANCELLED as reversed for both Customer and Business views", () => {
    expect(BOOKING_STATUS_LABELS.NO_SHOW_CANCELLED).toBe("No-show reversed");
    expect(BUSINESS_BOOKING_STATUS_LABELS.NO_SHOW_CANCELLED).toBe("No-show reversed");
  });

  it("keeps it out of the Customer No-show tab and lists it with ended bookings", () => {
    expect(CUSTOMER_BOOKING_TAB_STATUSES.noshow).not.toContain("NO_SHOW_CANCELLED");
    expect(CUSTOMER_BOOKING_TAB_STATUSES.canceled).toContain("NO_SHOW_CANCELLED");
  });

  it("still maps every status to exactly one Customer tab", () => {
    const all = Object.values(CUSTOMER_BOOKING_TAB_STATUSES).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const status of Object.keys(BOOKING_STATUS_LABELS)) expect(all).toContain(status);
  });
});
