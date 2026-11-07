/**
 * P1.9 — Super Admin Overview period selection → the existing Super Admin analytics period
 * contract (`fromDate`/`toDate` ISO instants, `[from, to)`), interpreted as platform UTC calendar
 * boundaries — the same UTC date convention the Analytics tab already uses. No selection
 * ("All time") sends no dates, which the API treats as all time.
 */
export type OverviewPeriodUnit = "WEEK" | "MONTH" | "QUARTER";
export type OverviewPeriodSelection =
  | { kind: "ALL_TIME" }
  | { kind: "YEAR"; year: number }
  | { kind: "CURRENT"; unit: OverviewPeriodUnit };

export type OverviewPeriodParams = { fromDate: string; toDate: string };

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));

export const resolveOverviewPeriod = (
  selection: OverviewPeriodSelection,
  now: Date = new Date(),
): OverviewPeriodParams | undefined => {
  if (selection.kind === "ALL_TIME") return undefined;
  if (selection.kind === "YEAR") {
    return { fromDate: utc(selection.year, 0, 1).toISOString(), toDate: utc(selection.year + 1, 0, 1).toISOString() };
  }
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (selection.unit === "MONTH") {
    return { fromDate: utc(year, month, 1).toISOString(), toDate: utc(year, month + 1, 1).toISOString() };
  }
  if (selection.unit === "QUARTER") {
    const start = month - (month % 3);
    return { fromDate: utc(year, start, 1).toISOString(), toDate: utc(year, start + 3, 1).toISOString() };
  }
  // ISO week: Monday 00:00 UTC to the next Monday.
  const mondayOffset = (now.getUTCDay() + 6) % 7;
  const monday = utc(year, month, now.getUTCDate() - mondayOffset);
  return { fromDate: monday.toISOString(), toDate: utc(year, month, now.getUTCDate() - mondayOffset + 7).toISOString() };
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Inclusive human label of an exclusive `[from, to)` window, e.g. "1 Nov 2026 – 30 Nov 2026 (UTC)". */
export const describeOverviewPeriod = (period: OverviewPeriodParams | undefined): string => {
  if (!period) return "All time";
  const lastDay = new Date(Date.parse(period.toDate) - 1).toISOString();
  return `${dayLabel(period.fromDate)} – ${dayLabel(lastDay)} (UTC)`;
};
