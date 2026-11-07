import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import TimeStep from "@/app/venue/components/TimeStep";

afterEach(() => vi.useRealTimers());

it.each([
  { now: "2030-08-21T01:00:00Z", timezone: "America/Los_Angeles", date: "2030-08-20", day: "20" },
  { now: "2030-08-20T23:00:00Z", timezone: "Europe/Nicosia", date: "2030-08-21", day: "21" },
])("uses the venue's current day in $timezone at $now", async ({ now, timezone, date, day: dayNumber }) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<TimeStep
      timezone={timezone} visibleMonth={new Date(2030, 7, 1)}
      onPrevMonth={() => {}} onNextMonth={() => {}} onSelectDate={() => {}} onSelectSlot={() => {}}
      availability={{ days: [{ date, isOpen: true, slots: [{
        startAt: "2030-08-21T02:00:00Z", endAt: "2030-08-21T03:00:00Z",
        eligibleStaffMembershipIds: ["staff"], source: "AUTO",
      }] }] } as React.ComponentProps<typeof TimeStep>["availability"]}
    />));
    const day = [...host.querySelectorAll("button")].find(button => button.querySelector("span")?.textContent === dayNumber);
    expect(day).toBeDefined();
    expect(day?.disabled).toBe(false);
    expect(day?.textContent).toContain("TODAY");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
