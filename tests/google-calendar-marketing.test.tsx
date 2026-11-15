import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ListYourBusinessFeatures from "@/components/list-your-business/ListYourBusinessFeatures";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

describe("Google Calendar marketing", () => {
  it("describes Bookly-to-Google updates without promising two-way availability", () => {
    const html = renderToStaticMarkup(<ListYourBusinessFeatures featuresVisible featuresContainerRef={{ current: null }} />);
    expect(html).toContain("Keep your Google Calendar updated with appointments from Bookly.");
    expect(html).not.toMatch(/two.way sync/i);
    expect(html).not.toMatch(/calendar blocks prevent double bookings/i);
  });
});
