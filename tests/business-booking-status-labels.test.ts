import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUS_LABELS,
  BUSINESS_BOOKING_STATUS_LABELS,
} from "@/lib/bookings/format";

describe("Booking status labels actor mapping", () => {
  it("maps CANCELLED_BY_CUSTOMER to customer perspective in customer views", () => {
    expect(BOOKING_STATUS_LABELS.CANCELLED_BY_CUSTOMER).toBe("Cancelled by you");
  });

  it("maps CANCELLED_BY_CUSTOMER to management perspective in business views", () => {
    expect(BUSINESS_BOOKING_STATUS_LABELS.CANCELLED_BY_CUSTOMER).toBe("Cancelled by customer");
  });

  it("maps CANCELLED_BY_BUSINESS consistently", () => {
    expect(BOOKING_STATUS_LABELS.CANCELLED_BY_BUSINESS).toBe("Cancelled by business");
    expect(BUSINESS_BOOKING_STATUS_LABELS.CANCELLED_BY_BUSINESS).toBe("Cancelled by business");
  });

  it("preserves identical labels for non-actor-dependent statuses", () => {
    expect(BUSINESS_BOOKING_STATUS_LABELS.UPCOMING).toBe("Upcoming");
    expect(BUSINESS_BOOKING_STATUS_LABELS.COMPLETED).toBe("Completed");
    expect(BUSINESS_BOOKING_STATUS_LABELS.LATE_CANCELLATION).toBe("Late cancellation");
    expect(BUSINESS_BOOKING_STATUS_LABELS.NO_SHOW_CHARGED).toBe("No-show (charged)");
  });
});

