import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookingReviewCard from "@/app/customer/bookings/BookingReviewCard";

const fx = vi.hoisted(() => ({ query: { isLoading: false, isError: false, isFetching: false, data: undefined as unknown, refetch: vi.fn() } }));
vi.mock("@/lib/review/hooks", () => ({ useReviewStateQuery: () => fx.query, useCreateReviewMutation: () => ({}), useUpdateReviewMutation: () => ({}) }));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));

describe("customer review read states", () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  const render = (status = "COMPLETED") => act(() => root.render(<BookingReviewCard bookingId="booking" bookingSource="BOOKLY_MANAGED" bookingStatus={status} />));
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    Object.assign(fx.query, { isLoading: true, isError: false, isFetching: false, data: undefined });
    fx.query.refetch.mockReset();
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  it("shows loading and supports a disabled pending retry before recovering", () => {
    render(); expect(host.textContent).toContain("Loading your review");
    Object.assign(fx.query, { isLoading: false, isError: true }); render();
    expect(host.getAttribute("role") ?? host.querySelector("[role=alert]")?.textContent).toContain("could not be loaded");
    act(() => host.querySelector("button")!.click()); expect(fx.query.refetch).toHaveBeenCalledOnce();
    fx.query.isFetching = true; render(); expect(host.querySelector("button")?.disabled).toBe(true);
    Object.assign(fx.query, { isError: false, isFetching: false, data: { eligible: true, review: null } }); render();
    expect(host.textContent).toContain("Leave a review");
  });
  it("shows a read-only rating without inert buttons", () => {
    Object.assign(fx.query, { isLoading: false, data: { eligible: true, review: { rating: 4, editableUntil: "2000-01-01", comment: "Good" } } });
    render(); expect(host.querySelector('[aria-label="4 out of 5 stars"]')).not.toBeNull();
    expect(host.querySelectorAll("button")).toHaveLength(0);
  });
  it("keeps reviews hidden for ineligible booking statuses", () => { render("UPCOMING"); expect(host.textContent).toBe(""); });
});
