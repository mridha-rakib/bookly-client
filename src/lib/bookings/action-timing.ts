"use client";

import { useEffect, useState } from "react";

/**
 * Fix #5 — client-side hints for the server's appointment time boundaries. The API is always the
 * final authority (it re-checks with its own clock); these only decide whether an action is
 * OFFERED and how its unavailability is explained.
 *
 *  - Complete: available from the scheduled start (inclusive). No end-time wait.
 *  - No-show with a category window snapshot: `opensAt <= now < closesAt` (unchanged rule).
 *  - No-show without a snapshot (legacy): available from the scheduled start; no closing bound.
 */

export type ActionWindow =
  | { state: "open"; opensAt?: Date; closesAt?: Date }
  | { state: "before"; opensAt: Date; closesAt?: Date }
  | { state: "after"; opensAt?: Date; closesAt: Date };

export const completionWindow = (schedule: { startAt: string }, nowMs: number): ActionWindow => {
  const opensAt = new Date(schedule.startAt);
  return nowMs < opensAt.getTime() ? { state: "before", opensAt } : { state: "open", opensAt };
};

export const noShowWindow = (
  booking: {
    schedule: { startAt: string };
    noShowEligibilitySnapshot?: { opensAt: string; closesAt: string } | undefined;
  },
  nowMs: number,
): ActionWindow => {
  const snap = booking.noShowEligibilitySnapshot;
  if (!snap) {
    const opensAt = new Date(booking.schedule.startAt);
    return nowMs < opensAt.getTime() ? { state: "before", opensAt } : { state: "open", opensAt };
  }
  const opensAt = new Date(snap.opensAt);
  const closesAt = new Date(snap.closesAt);
  if (nowMs < opensAt.getTime()) return { state: "before", opensAt, closesAt };
  if (nowMs >= closesAt.getTime()) return { state: "after", opensAt, closesAt };
  return { state: "open", opensAt, closesAt };
};

/** Browsers clamp timers above 2^31-1 ms; a longer wait re-arms at the clamp. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * The current time, re-rendered exactly when the next of `boundaries` (epoch ms) is reached —
 * one timer, no polling and no API request. Past boundaries are ignored.
 */
export const useBoundaryNow = (boundaries: ReadonlyArray<number | undefined>): number => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const key = boundaries.join(",");
  useEffect(() => {
    const next = boundaries
      .filter((value): value is number => value !== undefined && Number.isFinite(value))
      .filter((value) => value > nowMs)
      .sort((a, b) => a - b)[0];
    if (next === undefined) return;
    // Fires at the boundary; if the clock still reads earlier, the effect simply re-arms.
    const timer = setTimeout(() => setNowMs(Date.now()), Math.min(MAX_TIMER_MS, next - nowMs));
    return () => clearTimeout(timer);
    // `key` captures the boundary values; re-arm whenever they or the current time change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nowMs]);
  return nowMs;
};

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
export const formatActionOpensAt = (date: Date, timeZone: string): string => {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone });
    timeFormatters.set(timeZone, formatter);
  }
  return formatter.format(date);
};
