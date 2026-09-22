"use client";

import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import ServiceScheduleEditor, {
  buildEmptyManualSchedule,
  type ManualDayState
} from "@/components/dashboard/services/ServiceScheduleEditor";
import { toast } from "@/components/ui/sonner";
import { getFieldErrors, toUserMessage } from "@/lib/auth/messages";
import type { DayOfWeek } from "@/lib/api/staff";
import type { Service, ServiceScheduleMode } from "@/lib/api/services";
import { useServicesQuery, useServiceQuery, useUpdateServiceMutation } from "@/lib/services/hooks";
import { getActiveBookingIntervalConfig, serviceToInput } from "@/lib/services/serviceInput";
import { dayOrder } from "@/lib/staff/format";

interface BookingTimeControlSectionProps {
  businessId: string;
}

const hydrateManualSchedule = (service: Service): Record<DayOfWeek, ManualDayState> => {
  const next = buildEmptyManualSchedule();
  for (const day of service.manualSchedule) {
    next[day.dayOfWeek] = { isOpen: day.isOpen, slots: [...day.times], newTimeText: "", amPm: "AM" };
  }
  return next;
};

const findFieldError = (fieldErrors: Record<string, string>, prefix: string): string | undefined => {
  const entry = Object.entries(fieldErrors).find(([path]) => path === prefix || path.startsWith(`${prefix}.`));
  return entry?.[1];
};

/**
 * Editor for a Service's REAL, persisted `scheduleMode`/`manualSchedule`/booking-interval
 * fields (the same ones ServiceForm edits on the Services page) — not a second source of
 * truth. There is no Business-level booking mode: mode is per-Service, so this section must
 * always show which Service it is currently configuring (see the selector below), never a
 * single business-wide toggle.
 */
export default function BookingTimeControlSection({ businessId }: BookingTimeControlSectionProps) {
  const servicesQuery = useServicesQuery(businessId);

  // Only Services eligible for normal configuration — matches the same lifecycle rule the
  // Services page itself enforces (DRAFT is incomplete/not yet publish-ready, ARCHIVED is
  // soft-deleted); this section must never offer either as if they were configurable here.
  const eligibleServices = useMemo(
    () => (servicesQuery.data?.services ?? []).filter((service) => service.status === "ACTIVE" || service.status === "INACTIVE"),
    [servicesQuery.data]
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (eligibleServices.length === 0) {
      if (selectedServiceId !== null) setSelectedServiceId(null);
      return;
    }
    if (!selectedServiceId || !eligibleServices.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(eligibleServices[0].id);
    }
  }, [eligibleServices, selectedServiceId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const serviceQuery = useServiceQuery(businessId, selectedServiceId ?? undefined);
  const service = serviceQuery.data;

  const [scheduleMode, setScheduleMode] = useState<ServiceScheduleMode>("AUTO");
  const [manualSchedule, setManualSchedule] = useState<Record<DayOfWeek, ManualDayState>>(buildEmptyManualSchedule());
  const [manualScheduleError, setManualScheduleError] = useState<string | undefined>();
  const [bookingIntervalText, setBookingIntervalText] = useState("");
  const [bookingIntervalError, setBookingIntervalError] = useState<string | undefined>();
  const [confirmClearManualTimes, setConfirmClearManualTimes] = useState(false);

  // Hydrates the local draft from the freshly fetched Service exactly once per loaded
  // record — mirrors ServiceForm's own hydrateFromService effect.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!service) return;
    setScheduleMode(service.scheduleMode);
    setManualSchedule(hydrateManualSchedule(service));
    setManualScheduleError(undefined);
    setBookingIntervalError(undefined);
    const config = getActiveBookingIntervalConfig(service);
    setBookingIntervalText(config?.bookingIntervalMin !== undefined ? String(config.bookingIntervalMin) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id, service?.updatedAt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateMutation = useUpdateServiceMutation();
  const intervalConfig = service ? getActiveBookingIntervalConfig(service) : null;

  // Whether the CURRENTLY PERSISTED Service already has real manual times saved — used only
  // to decide whether switching to AUTO is destructive. Never derived from the unsaved local
  // draft, since only a persisted manual schedule can actually be lost.
  const persistedHasManualTimes = Boolean(service?.manualSchedule.some((day) => day.isOpen && day.times.length > 0));

  const runSave = async () => {
    if (!service) return;

    if (scheduleMode === "MANUAL") {
      const hasAnyOpenDay = dayOrder.some((day) => manualSchedule[day].isOpen);
      const hasOpenDayMissingTimes = dayOrder.some(
        (day) => manualSchedule[day].isOpen && manualSchedule[day].slots.length === 0
      );
      if (!hasAnyOpenDay) {
        setManualScheduleError("Open at least one day and add a time.");
        return;
      }
      if (hasOpenDayMissingTimes) {
        setManualScheduleError("Add at least one time for each open day.");
        return;
      }
    }
    setManualScheduleError(undefined);
    setBookingIntervalError(undefined);

    // Full-replace safe: start from every field the Service already has (serviceToInput),
    // then override only scheduleMode/manualSchedule/the active pricing block's interval —
    // everything else (pricing, staff, cities, category, ...) is resent unchanged.
    const base = serviceToInput(service);
    const manualScheduleArray = dayOrder.map((day) => ({
      dayOfWeek: day,
      isOpen: manualSchedule[day].isOpen,
      times: manualSchedule[day].slots
    }));

    const input = {
      ...base,
      scheduleMode,
      manualSchedule: scheduleMode === "MANUAL" ? manualScheduleArray : [],
      ...(intervalConfig ? intervalConfig.apply(bookingIntervalText) : {})
    };

    try {
      await updateMutation.mutateAsync({ businessId, serviceId: service.id, input });
      toast.success(`Booking settings saved for ${service.name}`);
    } catch (error) {
      const fieldErrors = getFieldErrors(error);
      const manualError = findFieldError(fieldErrors, "manualSchedule");
      if (manualError) setManualScheduleError(manualError);
      const intervalError =
        findFieldError(fieldErrors, "fixedPricing.bookingIntervalMin") ??
        findFieldError(fieldErrors, "perPersonPricing.bookingIntervalMin") ??
        findFieldError(fieldErrors, "packagePricing.bookingIntervalMin");
      if (intervalError) setBookingIntervalError(intervalError);
      toast.error(toUserMessage(error));
    }
  };

  const handleSaveClick = () => {
    if (scheduleMode === "AUTO" && persistedHasManualTimes) {
      setConfirmClearManualTimes(true);
      return;
    }
    void runSave();
  };

  const confirmClearAndSave = () => {
    setConfirmClearManualTimes(false);
    void runSave();
  };

  const isBusy = updateMutation.isPending;
  const statusModeLabel = scheduleMode === "MANUAL" ? "Fixed time slots" : "Auto-generated slots";

  return (
    <div className="flex flex-col gap-6 w-full font-poppins">
      <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
        <h3 className="text-sm font-semibold text-[#111111]">Booking time control</h3>

        <div className="flex bg-neutral-100 rounded-lg p-0.5 select-none">
          <button
            type="button"
            disabled={!service || isBusy}
            onClick={() => setScheduleMode("MANUAL")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              scheduleMode === "MANUAL" ? "bg-[#8EBAC5] text-white shadow-sm" : "text-neutral-500 hover:text-black"
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            disabled={!service || isBusy}
            onClick={() => setScheduleMode("AUTO")}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              scheduleMode === "AUTO" ? "bg-[#8EBAC5] text-white shadow-sm" : "text-neutral-500 hover:text-black"
            }`}
          >
            Auto
          </button>
        </div>
      </div>

      <div className="text-xs text-neutral-500 flex flex-col gap-3 leading-relaxed">
        <p>
          <strong className="text-neutral-800">Auto</strong> — Slots are generated automatically based on your
          opening hours and a fixed increment you choose, such as every 15 or 30 minutes. This is the standard
          setup for services like haircuts, massages, and consultations.
        </p>
        <p>
          <strong className="text-neutral-800">Manual</strong> — You define the exact times customers can book,
          such as 10:00, 14:00, and 18:00 only. No other times will be shown. Use this for services that run at
          fixed times, such as tours, classes, or scheduled sessions.
        </p>
        <p className="italic text-[11px]">
          *You can only choose one mode per service. Selecting Manual overrides your business&apos;s general
          opening hours for this service — only the times you set here will be available.
        </p>
      </div>

      {/* Service selector — mode is per-Service, so this section must always say which one it
          is currently editing (never a single business-wide toggle). */}
      <div className="flex flex-col gap-2 pt-4 border-t border-neutral-100">
        <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.5px]">Service</label>
        {servicesQuery.isLoading ? (
          <span className="text-xs text-neutral-500">Loading services…</span>
        ) : servicesQuery.isError ? (
          <span className="text-xs text-[#D85A30]">Couldn&apos;t load your services. Try refreshing the page.</span>
        ) : eligibleServices.length === 0 ? (
          <span className="text-xs text-neutral-500">
            No services yet. Create a service to configure booking times.
          </span>
        ) : (
          <select
            value={selectedServiceId ?? ""}
            disabled={isBusy}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="h-9 w-full max-w-[320px] border border-[#D3D1C7] rounded-lg px-3 text-xs font-poppins focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {eligibleServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.status === "INACTIVE" ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedServiceId && serviceQuery.isLoading && (
        <span className="text-xs text-neutral-500">Loading this service&apos;s booking settings…</span>
      )}

      {selectedServiceId && serviceQuery.isError && (
        <span className="text-xs text-[#D85A30]">
          This service could not be loaded — it may have changed elsewhere. Try selecting it again.
        </span>
      )}

      {service && (
        <div className="flex flex-col gap-4">
          {scheduleMode === "AUTO" && !intervalConfig && (
            <p className="text-xs text-neutral-500">
              This service is priced hourly, so bookable start times always align to its minimum hours — there is
              no separate booking interval to set here.
            </p>
          )}

          <ServiceScheduleEditor
            scheduleMode={scheduleMode}
            manualSchedule={manualSchedule}
            onManualScheduleChange={setManualSchedule}
            manualScheduleError={manualScheduleError}
            disabled={isBusy}
            bookingInterval={
              intervalConfig
                ? {
                    value: bookingIntervalText,
                    onChange: setBookingIntervalText,
                    durationMin: intervalConfig.durationMin,
                    error: bookingIntervalError,
                    disabled: isBusy
                  }
                : undefined
            }
          />

          <div className="bg-[#F5F4EE] rounded-xl p-3 text-[11px] text-neutral-500 flex items-center gap-2">
            <HugeiconsIcon icon={InformationCircleIcon} className="w-4 h-4 text-neutral-600 shrink-0" />
            <span>
              Configuring <strong className="text-neutral-700">{service.name}</strong>: current mode is{" "}
              <strong className="text-neutral-700">{statusModeLabel}</strong>. Each service uses one booking-time
              mode at a time — other services on this business may use a different mode.
            </span>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isBusy}
              onClick={handleSaveClick}
              className="h-[38px] px-6 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBusy ? "Saving…" : "Save booking settings"}
            </button>
          </div>
        </div>
      )}

      {confirmClearManualTimes && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-poppins font-semibold text-base text-[#111111]">Switch to Auto?</span>
              <span className="font-poppins font-normal text-sm text-neutral-500">
                Switching this Service to Auto will remove its saved manual booking times. This can&apos;t be
                undone — you would need to re-enter them if you switch back to Manual later.
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={confirmClearAndSave}
                className="h-[40px] rounded-lg bg-[#D85A30] hover:bg-[#c04f2a] text-white font-poppins font-medium text-sm disabled:opacity-60 cursor-pointer"
              >
                {isBusy ? "Saving…" : "Switch to Auto"}
              </button>
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirmClearManualTimes(false)}
              className="text-xs text-neutral-500 hover:text-black self-center cursor-pointer disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
