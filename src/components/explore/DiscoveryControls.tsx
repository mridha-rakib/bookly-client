"use client";

import React, { useState } from "react";

import type { DiscoveryAvailabilityWindow } from "@/lib/api/discovery";
import type { VisitorLocationStatus } from "@/lib/discovery/location";
import { platformToday } from "@/lib/superAdminDashboard/period";

/** P2.2.3 — Explore's Quick actions, Distance and Availability controls, shared by the desktop
 * sidebar and the mobile drawer. Every control drives a server-side discovery parameter. */

export type ExploreQuickAction = "RECOMMENDED" | "NEAR_YOU" | "TRENDING";
export type ExploreAvailability = { date: string; window: DiscoveryAvailabilityWindow; service?: string };

const QUICK_ACTIONS: Array<{ key: ExploreQuickAction; label: string }> = [
  { key: "RECOMMENDED", label: "Recommended" },
  { key: "NEAR_YOU", label: "Services near you" },
  { key: "TRENDING", label: "Trending services" },
];

const WINDOW_LABELS: Record<DiscoveryAvailabilityWindow, string> = {
  ANY: "Any time",
  MORNING: "Morning (06:00–12:00)",
  AFTERNOON: "Afternoon (12:00–17:00)",
  EVENING: "Evening (17:00–24:00)",
};

export const RADIUS_OPTIONS_KM = [2, 5, 10, 20, 50] as const;

const checkboxClass = "w-4 h-4 border border-neutral-300 rounded cursor-pointer accent-black";
const smallButton =
  "px-2.5 py-1 border border-neutral-300 rounded-lg text-xs font-medium text-[#1C1B1C] hover:border-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

const pad = (n: number) => String(n).padStart(2, "0");
const dateAfter = (days: number) => {
  const today = platformToday();
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

export function QuickActionsControl({
  active,
  onSelect,
}: {
  active: ExploreQuickAction | null;
  onSelect: (action: ExploreQuickAction | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="font-semibold text-xs text-black uppercase tracking-wider">Quick actions</span>
      <div className="flex flex-col gap-2.5">
        {QUICK_ACTIONS.map((action) => (
          <label key={action.key} className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={active === action.key}
              onChange={() => onSelect(active === action.key ? null : action.key)}
              aria-label={action.label}
              className={checkboxClass}
            />
            <span className="text-[#4E5F78]">{action.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function DistanceControl({
  locationStatus,
  hasOrigin,
  onRequestLocation,
  onClearLocation,
  radiusKm,
  setRadiusKm,
}: {
  locationStatus: VisitorLocationStatus;
  hasOrigin: boolean;
  onRequestLocation: () => void;
  onClearLocation: () => void;
  radiusKm: number | null;
  setRadiusKm: (value: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="font-semibold text-xs text-black uppercase tracking-wider">Distance</span>
      {hasOrigin ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-[#137333]" data-testid="location-status">Using your current location</span>
          <button type="button" onClick={onClearLocation} className={smallButton}>
            Stop using
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-[#757575]">
            {locationStatus === "denied"
              ? "Location permission was denied. Allow it in your browser to filter by distance."
              : locationStatus === "unavailable"
                ? "Your location could not be determined."
                : "Share your location to see distances. It is not saved."}
          </p>
          <button
            type="button"
            onClick={onRequestLocation}
            disabled={locationStatus === "requesting"}
            className={smallButton}
          >
            {locationStatus === "requesting" ? "Locating…" : "Use my location"}
          </button>
        </div>
      )}
      <label className="flex flex-col gap-1 text-xs text-[#4E5F78]">
        Within
        <select
          aria-label="Distance radius"
          value={radiusKm === null ? "" : String(radiusKm)}
          disabled={!hasOrigin}
          onChange={(event) => setRadiusKm(event.target.value ? Number(event.target.value) : null)}
          className="border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Any distance</option>
          {RADIUS_OPTIONS_KM.map((km) => (
            <option key={km} value={km}>
              {km} km
            </option>
          ))}
        </select>
      </label>
      <p className="text-[10px] text-[#757575]">Straight-line distance to each Business&apos;s listed address.</p>
    </div>
  );
}

export function AvailabilityControl({
  value,
  onChange,
}: {
  value: ExploreAvailability | null;
  onChange: (value: ExploreAvailability | null) => void;
}) {
  const [serviceDraft, setServiceDraft] = useState(value?.service ?? "");
  const today = dateAfter(0);
  const tomorrow = dateAfter(1);
  const apply = (patch: Partial<ExploreAvailability>) => {
    const date = patch.date ?? value?.date;
    if (!date) return;
    const service = (patch.service ?? value?.service ?? "").trim();
    onChange({ date, window: patch.window ?? value?.window ?? "ANY", ...(service ? { service } : {}) });
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <span className="font-semibold text-xs text-black uppercase tracking-wider">Availability</span>
      <div className="flex gap-2">
        <button type="button" aria-pressed={value?.date === today} onClick={() => apply({ date: today })} className={smallButton}>
          Today
        </button>
        <button type="button" aria-pressed={value?.date === tomorrow} onClick={() => apply({ date: tomorrow })} className={smallButton}>
          Tomorrow
        </button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-[#4E5F78]">
        Date
        <input
          type="date"
          aria-label="Availability date"
          value={value?.date ?? ""}
          min={today}
          onChange={(event) => (event.target.value ? apply({ date: event.target.value }) : onChange(null))}
          className="border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-xs bg-white"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[#4E5F78]">
        Time
        <select
          aria-label="Availability time window"
          value={value?.window ?? "ANY"}
          disabled={!value}
          onChange={(event) => apply({ window: event.target.value as DiscoveryAvailabilityWindow })}
          className="border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(Object.keys(WINDOW_LABELS) as DiscoveryAvailabilityWindow[]).map((key) => (
            <option key={key} value={key}>
              {WINDOW_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-[#4E5F78]">
        Service (optional)
        <input
          type="text"
          aria-label="Availability service"
          value={serviceDraft}
          disabled={!value}
          placeholder="e.g. Haircut"
          maxLength={100}
          onChange={(event) => setServiceDraft(event.target.value)}
          onBlur={() => apply({ service: serviceDraft })}
          onKeyDown={(event) => {
            if (event.key === "Enter") apply({ service: serviceDraft });
          }}
          className="border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-xs bg-white disabled:opacity-50"
        />
      </label>
      {value && (
        <button
          type="button"
          onClick={() => {
            setServiceDraft("");
            onChange(null);
          }}
          className={smallButton}
        >
          Clear availability
        </button>
      )}
      <p className="text-[10px] text-[#757575]">
        Shows Businesses with a bookable slot on that date. Booking re-checks the slot.
      </p>
    </div>
  );
}
