"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, CheckListIcon as ListChecksIcon } from "@hugeicons/core-free-icons";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import type { DayOfWeek } from "@/lib/api/staff";
import type {
  Service,
  ServiceInput,
  ServicePricingMode,
  ServiceScheduleMode
} from "@/lib/api/services";
import { useBusinessQuery, useBusinessTravelSettingsQuery } from "@/lib/business/hooks";
import {
  dayOrder,
  formatTime12Hour,
  parseTime12HourToCanonical,
  parseTimeInputText,
  sanitizeTimeDraftInput
} from "@/lib/staff/format";
import { useStaffListQuery } from "@/lib/staff/hooks";
import { useAddonsForServiceQuery } from "@/lib/addons/hooks";
import { formatEuro } from "@/lib/addons/format";
import { centsToEuroText, euroTextToCents } from "@/lib/services/format";
import {
  useCreateServiceMutation,
  useServiceCategoriesQuery,
  useServiceQuery,
  useUpdateServiceMutation
} from "@/lib/services/hooks";
import { validateServiceInput, type ServiceFormErrors } from "@/lib/services/schema";

interface ServiceFormProps {
  businessId: string;
  mode: "create" | "edit" | "view";
  serviceId?: string;
  onDone: () => void;
}

type ManualDayState = {
  isOpen: boolean;
  slots: string[]; // canonical "HH:mm"
  newTimeText: string;
  amPm: "AM" | "PM";
};

const emptyDay = (): ManualDayState => ({ isOpen: false, slots: [], newTimeText: "", amPm: "AM" });

const buildEmptyManualSchedule = (): Record<DayOfWeek, ManualDayState> =>
  Object.fromEntries(dayOrder.map((day) => [day, emptyDay()])) as Record<DayOfWeek, ManualDayState>;

interface FormState {
  /** Drives the "Service active" toggle — only meaningful for a non-draft Save. */
  active: boolean;
  isFeatured: boolean;
  isPackageDeal: boolean;
  serviceCategoryId: string;
  subcategory: string;
  name: string;
  packageServicesName: string;
  description: string;
  pricingMode: ServicePricingMode;
  fixedPrice: string;
  fixedDuration: string;
  fixedBookingInterval: string;
  fixedBuffer: string;
  fixedProcessing: string;
  fixedDiscount: string;
  hourlyRate: string;
  hourlyMin: string;
  hourlyMax: string;
  hourlyBuffer: string;
  perPersonRate: string;
  perPersonMin: string;
  perPersonMax: string;
  perPersonDuration: string;
  perPersonBookingInterval: string;
  perPersonBuffer: string;
  packageDuration: string;
  packageBookingInterval: string;
  packageBuffer: string;
  packageProcessing: string;
  packageSessions: string;
  packageBundlePrice: string;
  packageDiscount: string;
  sessionExpiryEnabled: boolean;
  sessionExpiryMinutes: string;
  scheduleMode: ServiceScheduleMode;
  manualSchedule: Record<DayOfWeek, ManualDayState>;
  servedCities: string[];
  assignedStaffMembershipIds: string[];
}

const initialFormState = (): FormState => ({
  active: true,
  isFeatured: false,
  isPackageDeal: false,
  serviceCategoryId: "",
  subcategory: "",
  name: "",
  packageServicesName: "",
  description: "",
  pricingMode: "FIXED",
  fixedPrice: "",
  fixedDuration: "",
  fixedBookingInterval: "",
  fixedBuffer: "",
  fixedProcessing: "",
  fixedDiscount: "",
  hourlyRate: "",
  hourlyMin: "",
  hourlyMax: "",
  hourlyBuffer: "",
  perPersonRate: "",
  perPersonMin: "",
  perPersonMax: "",
  perPersonDuration: "",
  perPersonBookingInterval: "",
  perPersonBuffer: "",
  packageDuration: "",
  packageBookingInterval: "",
  packageBuffer: "",
  packageProcessing: "",
  packageSessions: "",
  packageBundlePrice: "",
  packageDiscount: "",
  sessionExpiryEnabled: false,
  sessionExpiryMinutes: "",
  scheduleMode: "AUTO",
  manualSchedule: buildEmptyManualSchedule(),
  servedCities: [],
  assignedStaffMembershipIds: []
});

const hydrateFromService = (service: Service): FormState => {
  const manualSchedule = buildEmptyManualSchedule();
  for (const day of service.manualSchedule) {
    manualSchedule[day.dayOfWeek] = { isOpen: day.isOpen, slots: [...day.times], newTimeText: "", amPm: "AM" };
  }

  return {
    // DRAFT has no meaningful active/inactive state yet — default the toggle to "on" so a
    // plain Save (not Save as Draft) publishes as ACTIVE unless the owner turns it off.
    active: service.status !== "INACTIVE",
    isFeatured: service.isFeatured,
    isPackageDeal: service.isPackageDeal,
    serviceCategoryId: service.serviceCategoryId ?? "",
    subcategory: service.subcategory ?? "",
    name: service.name,
    packageServicesName: service.packageServicesName ?? "",
    description: service.description ?? "",
    pricingMode: service.pricingMode ?? "FIXED",
    fixedPrice: service.fixedPricing ? centsToEuroText(service.fixedPricing.priceCents) : "",
    fixedDuration: service.fixedPricing ? String(service.fixedPricing.durationMin) : "",
    fixedBookingInterval: service.fixedPricing?.bookingIntervalMin?.toString() ?? "",
    fixedBuffer: service.fixedPricing?.bufferAfterMin?.toString() ?? "",
    fixedProcessing: service.fixedPricing?.processingTimeMin?.toString() ?? "",
    fixedDiscount: service.fixedPricing?.discountPercent?.toString() ?? "",
    hourlyRate: service.hourlyPricing ? centsToEuroText(service.hourlyPricing.ratePerHourCents) : "",
    hourlyMin: service.hourlyPricing ? String(service.hourlyPricing.minHours) : "",
    hourlyMax: service.hourlyPricing ? String(service.hourlyPricing.maxHours) : "",
    hourlyBuffer: service.hourlyPricing?.bufferAfterMin?.toString() ?? "",
    perPersonRate: service.perPersonPricing ? centsToEuroText(service.perPersonPricing.ratePerPersonCents) : "",
    perPersonMin: service.perPersonPricing ? String(service.perPersonPricing.minPersons) : "",
    perPersonMax: service.perPersonPricing ? String(service.perPersonPricing.maxPersons) : "",
    perPersonDuration: service.perPersonPricing ? String(service.perPersonPricing.durationMin) : "",
    perPersonBookingInterval: service.perPersonPricing?.bookingIntervalMin?.toString() ?? "",
    perPersonBuffer: service.perPersonPricing?.bufferAfterMin?.toString() ?? "",
    packageDuration: service.packagePricing ? String(service.packagePricing.durationMin) : "",
    packageBookingInterval: service.packagePricing?.bookingIntervalMin?.toString() ?? "",
    packageBuffer: service.packagePricing?.bufferAfterMin?.toString() ?? "",
    packageProcessing: service.packagePricing?.processingTimeMin?.toString() ?? "",
    packageSessions: service.packagePricing ? String(service.packagePricing.sessionsInPackage) : "",
    packageBundlePrice: service.packagePricing ? centsToEuroText(service.packagePricing.bundlePriceCents) : "",
    packageDiscount: service.packagePricing?.discountPercent?.toString() ?? "",
    sessionExpiryEnabled: service.sessionExpiryAlert.enabled,
    sessionExpiryMinutes: service.sessionExpiryAlert.minutesBeforeSessionEnds?.toString() ?? "",
    scheduleMode: service.scheduleMode,
    manualSchedule,
    servedCities: [...service.servedCities],
    assignedStaffMembershipIds: service.assignedStaff.map((staff) => staff.membershipId)
  };
};

const toIntOrUndefined = (text: string): number | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) ? Math.trunc(value) : undefined;
};

const buildServiceInput = (form: FormState, status: ServiceInput["status"]): ServiceInput => {
  const manualScheduleArray = dayOrder.map((day) => ({
    dayOfWeek: day,
    isOpen: form.manualSchedule[day].isOpen,
    times: form.manualSchedule[day].slots
  }));

  const base: ServiceInput = {
    status,
    isFeatured: form.isFeatured,
    isPackageDeal: form.isPackageDeal,
    ...(form.serviceCategoryId ? { serviceCategoryId: form.serviceCategoryId } : {}),
    ...(form.subcategory ? { subcategory: form.subcategory } : {}),
    name: form.name.trim(),
    sessionExpiryAlert: {
      enabled: form.sessionExpiryEnabled,
      ...(form.sessionExpiryEnabled
        ? { minutesBeforeSessionEnds: toIntOrUndefined(form.sessionExpiryMinutes) }
        : {})
    },
    scheduleMode: form.scheduleMode,
    ...(form.scheduleMode === "MANUAL" ? { manualSchedule: manualScheduleArray } : {}),
    servedCities: form.servedCities as ServiceInput["servedCities"],
    assignedStaffMembershipIds: form.assignedStaffMembershipIds
  };

  if (form.description.trim()) {
    base.description = form.description.trim();
  }

  if (form.isPackageDeal) {
    base.packageServicesName = form.packageServicesName.trim();
    base.packagePricing = {
      durationMin: toIntOrUndefined(form.packageDuration) ?? 0,
      ...(toIntOrUndefined(form.packageBookingInterval) !== undefined
        ? { bookingIntervalMin: toIntOrUndefined(form.packageBookingInterval) }
        : {}),
      ...(toIntOrUndefined(form.packageBuffer) !== undefined
        ? { bufferAfterMin: toIntOrUndefined(form.packageBuffer) }
        : {}),
      ...(toIntOrUndefined(form.packageProcessing) !== undefined
        ? { processingTimeMin: toIntOrUndefined(form.packageProcessing) }
        : {}),
      sessionsInPackage: toIntOrUndefined(form.packageSessions) ?? 0,
      bundlePriceCents: euroTextToCents(form.packageBundlePrice) ?? -1,
      ...(toIntOrUndefined(form.packageDiscount) !== undefined
        ? { discountPercent: toIntOrUndefined(form.packageDiscount) }
        : {})
    };
  } else {
    base.pricingMode = form.pricingMode;
    if (form.pricingMode === "FIXED") {
      base.fixedPricing = {
        priceCents: euroTextToCents(form.fixedPrice) ?? -1,
        durationMin: toIntOrUndefined(form.fixedDuration) ?? 0,
        ...(toIntOrUndefined(form.fixedBookingInterval) !== undefined
          ? { bookingIntervalMin: toIntOrUndefined(form.fixedBookingInterval) }
          : {}),
        ...(toIntOrUndefined(form.fixedBuffer) !== undefined
          ? { bufferAfterMin: toIntOrUndefined(form.fixedBuffer) }
          : {}),
        ...(toIntOrUndefined(form.fixedProcessing) !== undefined
          ? { processingTimeMin: toIntOrUndefined(form.fixedProcessing) }
          : {}),
        ...(toIntOrUndefined(form.fixedDiscount) !== undefined
          ? { discountPercent: toIntOrUndefined(form.fixedDiscount) }
          : {})
      };
    } else if (form.pricingMode === "HOURLY") {
      base.hourlyPricing = {
        ratePerHourCents: euroTextToCents(form.hourlyRate) ?? -1,
        minHours: toIntOrUndefined(form.hourlyMin) ?? 0,
        maxHours: toIntOrUndefined(form.hourlyMax) ?? 0,
        ...(toIntOrUndefined(form.hourlyBuffer) !== undefined
          ? { bufferAfterMin: toIntOrUndefined(form.hourlyBuffer) }
          : {})
      };
    } else {
      base.perPersonPricing = {
        ratePerPersonCents: euroTextToCents(form.perPersonRate) ?? -1,
        minPersons: toIntOrUndefined(form.perPersonMin) ?? 0,
        maxPersons: toIntOrUndefined(form.perPersonMax) ?? 0,
        durationMin: toIntOrUndefined(form.perPersonDuration) ?? 0,
        ...(toIntOrUndefined(form.perPersonBookingInterval) !== undefined
          ? { bookingIntervalMin: toIntOrUndefined(form.perPersonBookingInterval) }
          : {}),
        ...(toIntOrUndefined(form.perPersonBuffer) !== undefined
          ? { bufferAfterMin: toIntOrUndefined(form.perPersonBuffer) }
          : {})
      };
    }
  }

  return base;
};

const ToggleSwitch = ({
  checked,
  onChange,
  disabled
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onChange}
    className={`w-[38px] h-[21px] rounded-full p-[3px] transition-colors duration-200 focus:outline-none flex items-center shrink-0 ${
      checked ? "bg-[#0F6E56]" : "bg-neutral-300"
    } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
  >
    <div
      className={`w-[15px] h-[15px] bg-white rounded-full transition-transform duration-200 ${
        checked ? "translate-x-[17px]" : "translate-x-0"
      }`}
    />
  </button>
);

const fieldLabelClass = "font-poppins font-normal text-[12px] leading-[18px] text-[#111111]";
const inputClass =
  "h-[41px] bg-white border border-[#D3D1C7] rounded-[12px] px-3 font-poppins text-sm text-[#111111] placeholder:text-[#757575] focus:outline-none w-full disabled:opacity-60 disabled:cursor-not-allowed";
const selectClass =
  "appearance-none h-[40.8px] w-full bg-white border border-[#D3D1C7] rounded-[12px] px-3 font-poppins text-sm text-[#111111] focus:outline-none pr-10 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";
const selectArrowStyle = {
  backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  backgroundSize: "16px"
};

export default function ServiceForm({ businessId, mode, serviceId, onDone }: ServiceFormProps) {
  const isReadOnly = mode === "view";
  const title = mode === "create" ? "Create Service" : mode === "edit" ? "Edit Service" : "View Service";

  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<ServiceFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const businessQuery = useBusinessQuery(businessId || undefined);
  const travelSettingsQuery = useBusinessTravelSettingsQuery(
    businessQuery.data?.visitType === "TRAVEL_TO_CUSTOMER" ? businessId || undefined : undefined
  );
  const categoriesQuery = useServiceCategoriesQuery(businessId || undefined);
  const staffListQuery = useStaffListQuery(businessId || undefined);
  const serviceQuery = useServiceQuery(businessId || undefined, serviceId);
  const assignedAddonsQuery = useAddonsForServiceQuery(
    businessId || undefined,
    mode !== "create" ? serviceId : undefined
  );
  const createMutation = useCreateServiceMutation();
  const updateMutation = useUpdateServiceMutation();

  const business = businessQuery.data;
  const activeCategories = categoriesQuery.data ?? [];
  const activeTravelCities = useMemo(
    () => (travelSettingsQuery.data?.cities ?? []).filter((city) => city.active).map((city) => city.city),
    [travelSettingsQuery.data]
  );
  const assignableStaff = useMemo(
    () => (staffListQuery.data?.members ?? []).filter((member) => !member.isOwner && member.membershipId),
    [staffListQuery.data]
  );
  const showCitiesSection = business?.visitType === "TRAVEL_TO_CUSTOMER";

  // Hydrates the form from the fetched Service exactly once per loaded record — every
  // persisted field, matching "Edit must fully populate every persisted field" (see plan).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "create" && serviceQuery.data) {
      setForm(hydrateFromService(serviceQuery.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, serviceQuery.data?.id, serviceQuery.data?.updatedAt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setManualDay = (day: DayOfWeek, patch: Partial<ManualDayState>) => {
    setForm((prev) => ({
      ...prev,
      manualSchedule: { ...prev.manualSchedule, [day]: { ...prev.manualSchedule[day], ...patch } }
    }));
  };

  const addManualTime = (day: DayOfWeek) => {
    const dayState = form.manualSchedule[day];
    const parsed = parseTimeInputText(dayState.newTimeText);
    if (!parsed) {
      toast.error("Enter a valid time as H:MM");
      return;
    }
    const canonical = parseTime12HourToCanonical(parsed.hour, parsed.minute, dayState.amPm);
    if (dayState.slots.includes(canonical)) {
      setManualDay(day, { newTimeText: "" });
      return;
    }
    setManualDay(day, { slots: [...dayState.slots, canonical].sort(), newTimeText: "" });
  };

  const removeManualTime = (day: DayOfWeek, time: string) => {
    setManualDay(day, { slots: form.manualSchedule[day].slots.filter((slot) => slot !== time) });
  };

  const toggleCity = (city: string) => {
    setField(
      "servedCities",
      form.servedCities.includes(city)
        ? form.servedCities.filter((c) => c !== city)
        : [...form.servedCities, city]
    );
  };

  const toggleStaff = (membershipId: string) => {
    setField(
      "assignedStaffMembershipIds",
      form.assignedStaffMembershipIds.includes(membershipId)
        ? form.assignedStaffMembershipIds.filter((id) => id !== membershipId)
        : [...form.assignedStaffMembershipIds, membershipId]
    );
  };

  // DRAFT tolerates incomplete data — serviceInputSchema's superRefine short-circuits its
  // cross-field "required for publish" rules for status "DRAFT" (see lib/services/schema.ts),
  // so this single validator naturally enforces full requiredness only for ACTIVE/INACTIVE.
  const handleSave = async (status: ServiceInput["status"]) => {
    const input = buildServiceInput(form, status);
    const validation = validateServiceInput(input);
    if (!validation.success) {
      setErrors(validation.errors);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      if (mode === "create") {
        await createMutation.mutateAsync({ businessId, input: validation.data });
        toast.success(status === "DRAFT" ? "Saved as draft" : "Service created");
      } else if (mode === "edit" && serviceId) {
        await updateMutation.mutateAsync({ businessId, serviceId, input: validation.data });
        toast.success(status === "DRAFT" ? "Saved as draft" : "Service updated");
      }
      onDone();
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const noCategoriesAvailable = !categoriesQuery.isLoading && activeCategories.length === 0;

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      <DashboardHeader title="Services" subtitle="Manage your service catalogue" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
        {/* Breadcrumbs */}
        <div className="flex flex-row items-center gap-3 mb-[40px] select-none w-full">
          <button
            type="button"
            onClick={onDone}
            className="w-4 h-4 flex items-center justify-center text-[#888780] hover:text-black cursor-pointer"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4" />
          </button>
          <div className="flex flex-row items-center gap-2 text-[13px] font-medium text-[#888780]">
            <button type="button" onClick={onDone} className="hover:text-black cursor-pointer">
              <span>Services</span>
            </button>
            <span>&gt;</span>
            <span className="text-[#1C1C1A] font-semibold">{title}</span>
            {mode !== "create" && serviceQuery.data?.status === "DRAFT" && (
              <span className="px-2 py-0.5 rounded-full bg-[#F5F4EE] border border-[#C6C19F] text-[10px] font-poppins font-medium uppercase tracking-[0.5px] text-[#111111]">
                Draft
              </span>
            )}
          </div>
        </div>

        <div className="pl-0 md:pl-[110px] w-full max-w-full flex flex-col gap-[40px]">
          {/* Section 1: Visibility & Type */}
          <div className="flex flex-col gap-[16px] w-full">
            <span className="font-poppins font-medium text-[12px] leading-[18px] tracking-[0.55px] uppercase text-[#111111]">
              VISIBILITY & TYPE
            </span>

            <div className="box-sizing-border-box flex flex-row justify-between items-center p-[20px] bg-[#F5F4EE] border border-[#C6C19F] rounded-[12px] w-full">
              <div className="flex flex-col gap-[2px]">
                <span className="font-poppins font-medium text-sm text-[#111111]">Service active</span>
                <span className="font-poppins font-normal text-xs text-[#111111]/60">
                  Show on your public profile. Turn off to hide without deleting.
                </span>
              </div>
              <ToggleSwitch checked={form.active} onChange={() => setField("active", !form.active)} disabled={isReadOnly} />
            </div>

            <div className="box-sizing-border-box flex flex-row justify-between items-center p-[20px] bg-[#F5F4EE] border border-[#C6C19F] rounded-[12px] w-full">
              <div className="flex flex-col gap-[2px]">
                <span className="font-poppins font-medium text-sm text-[#111111]">Featured service</span>
                <span className="font-poppins font-normal text-xs text-[#111111]/60">
                  Pin to the top of your profile page under a &quot;Featured&quot; section. Customers see it first.
                </span>
              </div>
              <ToggleSwitch
                checked={form.isFeatured}
                onChange={() => setField("isFeatured", !form.isFeatured)}
                disabled={isReadOnly}
              />
            </div>

            <div className="box-sizing-border-box flex flex-row justify-between items-center p-[20px] bg-[#F5F4EE] border border-[#C6C19F] rounded-[12px] w-full">
              <div className="flex flex-col gap-[2px]">
                <span className="font-poppins font-medium text-sm text-[#111111]">Package deal</span>
                <span className="font-poppins font-normal text-xs text-[#111111]/60">
                  Sell multiple sessions at a bundled price (e.g. 5 sessions for €150).
                </span>
              </div>
              <ToggleSwitch
                checked={form.isPackageDeal}
                onChange={() => setField("isPackageDeal", !form.isPackageDeal)}
                disabled={isReadOnly}
              />
            </div>

            {form.isPackageDeal && (
              <div className="box-sizing-border-box flex flex-col items-start p-3 pl-6 gap-[16px] w-full border-l-2 border-[#2E9DA7] mt-2">
                <span className="font-poppins font-normal text-sm leading-[21px] text-[#111111]">
                  A package is its own service listing. Set the session count and bundle price. Customers book it like any other service.
                </span>

                <div className="flex flex-col sm:flex-row gap-5 w-full">
                  <div className="flex-1 flex flex-col gap-2 opacity-50">
                    <span className={fieldLabelClass}>Bookly category</span>
                    <input type="text" disabled value={business?.category ?? ""} className={inputClass} />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <span className={fieldLabelClass}>
                      Sub category <span className="text-[#D85A30]">*</span>
                    </span>
                    <div className="relative w-full">
                      <select
                        disabled={isReadOnly}
                        value={form.subcategory}
                        onChange={(e) => setField("subcategory", e.target.value)}
                        className={selectClass}
                        style={selectArrowStyle}
                      >
                        <option value="">— Select —</option>
                        {(business?.subcategories ?? []).map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <span className={fieldLabelClass}>
                    Package name <span className="text-[#D85A30]">*</span>
                  </span>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder="e.g. 5-session starter pack, Monthly unlimited…"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <span className={fieldLabelClass}>
                    Services name <span className="text-[#D85A30]">*</span>
                  </span>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={form.packageServicesName}
                    onChange={(e) => setField("packageServicesName", e.target.value)}
                    placeholder="e.g. Haircut, Hairstyle"
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <span className={fieldLabelClass}>Description (optional)</span>
                  <textarea
                    disabled={isReadOnly}
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="What's included, what to expect, anything the customer should prepare…"
                    className="h-[71px] bg-white border border-[#D3D1C7] rounded-[12px] p-3 font-poppins text-sm text-[#111111] placeholder:text-[#757575] focus:outline-none w-full resize-none disabled:opacity-60"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Service Details (when Package deal is OFF) */}
          {!form.isPackageDeal && (
            <div className="flex flex-col gap-[12px] w-full">
              <span className="font-poppins font-medium text-[12px] leading-[18px] tracking-[0.55px] uppercase text-[#111111]">
                SERVICE DETAILS
              </span>

              <div className="flex flex-col sm:flex-row gap-5 w-full">
                <div className="flex-1 flex flex-col gap-2 opacity-50">
                  <span className={fieldLabelClass}>Bookly category</span>
                  <input type="text" disabled value={business?.category ?? ""} className={inputClass} />
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  <span className={fieldLabelClass}>
                    Sub category <span className="text-[#D85A30]">*</span>
                  </span>
                  <div className="relative w-full">
                    <select
                      disabled={isReadOnly}
                      value={form.subcategory}
                      onChange={(e) => setField("subcategory", e.target.value)}
                      className={selectClass}
                      style={selectArrowStyle}
                    >
                      <option value="">— Select —</option>
                      {(business?.subcategories ?? []).map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.subcategory && <span className="text-xs text-[#D85A30]">{errors.subcategory}</span>}
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  <span className={fieldLabelClass}>
                    Service category (you created) <span className="text-[#D85A30]">*</span>
                  </span>
                  <div className="relative w-full">
                    <select
                      disabled={isReadOnly}
                      value={form.serviceCategoryId}
                      onChange={(e) => setField("serviceCategoryId", e.target.value)}
                      className={selectClass}
                      style={selectArrowStyle}
                    >
                      <option value="">— Select —</option>
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {noCategoriesAvailable && (
                    <span className="text-xs text-[#D85A30]">
                      No service categories yet — add one in Business Profile → Edit.
                    </span>
                  )}
                  {errors.serviceCategoryId && (
                    <span className="text-xs text-[#D85A30]">{errors.serviceCategoryId}</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 w-full mt-2">
                <span className={fieldLabelClass}>
                  Service name <span className="text-[#D85A30]">*</span>
                </span>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Gel manicure, Deep tissue massage, Tennis lesson…"
                  className={inputClass}
                />
                {errors.name && <span className="text-xs text-[#D85A30]">{errors.name}</span>}
              </div>

              <div className="flex flex-col gap-2 w-full mt-2">
                <span className={fieldLabelClass}>Description (optional)</span>
                <textarea
                  disabled={isReadOnly}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="What's included, what to expect, anything the customer should prepare…"
                  className="h-[71px] bg-white border border-[#D3D1C7] rounded-[12px] p-3 font-poppins text-sm text-[#111111] placeholder:text-[#757575] focus:outline-none w-full resize-none disabled:opacity-60"
                />
              </div>
            </div>
          )}

          {/* Section 3: Session Expiry Email Alerts */}
          <div className="flex flex-col gap-[14px] w-full">
            <span className="font-inter font-semibold text-[11px] leading-[16px] tracking-[0.66px] uppercase text-[#888780]">
              SESSION END REMINDER
            </span>

            <div className="box-sizing-border-box flex flex-row justify-between items-center p-[20px] bg-[#F5F4EE] border border-[#C6C19F] rounded-[12px] w-full">
              <div className="flex flex-col gap-[4px] w-full max-w-[640px]">
                <span className="font-poppins font-medium text-sm text-[#111111]">Session Expiry Email Alerts</span>
                <span className="font-poppins font-normal text-xs text-[#111111]/60 leading-[18px]">
                  Turn on end-of-session email notifications and choose when they should be sent before the session ends.
                </span>
              </div>
              <ToggleSwitch
                checked={form.sessionExpiryEnabled}
                onChange={() => setField("sessionExpiryEnabled", !form.sessionExpiryEnabled)}
                disabled={isReadOnly}
              />
            </div>

            {form.sessionExpiryEnabled && (
              <div className="flex flex-col gap-2 w-full">
                <span className={fieldLabelClass}>
                  Minutes before session ends <span className="text-[#D85A30]">*</span>
                </span>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={form.sessionExpiryMinutes}
                  onChange={(e) => setField("sessionExpiryMinutes", e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="e.g. 15"
                  className={inputClass}
                />
                {errors["sessionExpiryAlert.minutesBeforeSessionEnds"] && (
                  <span className="text-xs text-[#D85A30]">
                    {errors["sessionExpiryAlert.minutesBeforeSessionEnds"]}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Custom Schedule */}
          <div className="flex flex-col gap-[20px] w-full">
            <div className="box-sizing-border-box flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-[#F5F4EE] border border-[#C6C19F] rounded-[12px] w-full gap-4">
              <div className="flex flex-col gap-[2px] w-full max-w-[640px]">
                <span className="font-poppins font-medium text-sm text-[#111111]">Custom schedule for this service</span>
                <span className="font-poppins font-normal text-xs text-[#111111]/60 leading-[18px]">
                  This service runs on specific days and times only. Set the days and opening windows below. Only these slots will appear to customers - your general business hours are ignored for this service.
                </span>
              </div>
              <ToggleSwitch
                checked={form.scheduleMode === "MANUAL"}
                onChange={() => setField("scheduleMode", form.scheduleMode === "MANUAL" ? "AUTO" : "MANUAL")}
                disabled={isReadOnly}
              />
            </div>

            {form.scheduleMode === "MANUAL" && (
              <div className="box-sizing-border-box flex flex-col items-start p-[24px] bg-white border border-[#10745B]/10 rounded-[18px] w-full shadow-[0px_0px_0px_3px_rgba(16,116,91,0.08)]">
                <div className="flex flex-row items-start gap-[16px] w-full">
                  <div className="w-[44px] h-[44px] bg-[#D1F3FA] rounded-full flex items-center justify-center shrink-0">
                    <HugeiconsIcon icon={ListChecksIcon} className="w-5 h-5 text-[#106374]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-poppins font-medium text-[17px] leading-[26px] tracking-[-0.34px] text-[#1F201D]">
                      Fixed time slots
                    </span>
                    <span className="font-poppins font-normal text-[14px] leading-[20px] text-[#6D6D68]">
                      Define the exact times customers can book this service. Only these times will appear.
                    </span>
                  </div>
                </div>

                <div className="w-full border-b border-neutral-100 my-4" />
                <span className="font-poppins font-medium text-[13px] leading-[20px] text-[#3D3E39] mb-4">
                  Available times
                </span>
                {errors.manualSchedule && (
                  <span className="text-xs text-[#D85A30] mb-2">{errors.manualSchedule}</span>
                )}

                <div className="flex flex-col gap-6 w-full">
                  {dayOrder.map((day) => {
                    const dayState = form.manualSchedule[day];
                    const dayLabel = day.charAt(0) + day.slice(1).toLowerCase();
                    return (
                      <div key={day} className="flex flex-col sm:flex-row gap-5 w-full items-start border-b border-neutral-100/50 pb-4">
                        <div className="flex flex-row items-center gap-3 w-[196px] pt-2 shrink-0">
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => setManualDay(day, { isOpen: !dayState.isOpen })}
                            className={`w-[27px] h-[27px] rounded-[5px] flex items-center justify-center transition-colors ${
                              dayState.isOpen ? "bg-[#2E9DA7]" : "border border-[#C6C19F] bg-white"
                            } ${isReadOnly ? "cursor-not-allowed" : "cursor-pointer"}`}
                          >
                            {dayState.isOpen && <span className="text-white text-xs font-bold">✓</span>}
                          </button>
                          <div className="flex flex-col">
                            <span className="font-inter font-normal text-[17px] leading-[20px] tracking-[-0.255px] text-[#232326]">
                              {dayLabel}
                            </span>
                            {dayState.isOpen && (
                              <span className="font-inter font-normal text-[17px] leading-[18px] tracking-[-0.17px] text-[#478F2F]">
                                Open
                              </span>
                            )}
                          </div>
                        </div>

                        <div
                          className={`flex-1 flex flex-col gap-3 w-full transition-opacity duration-200 ${
                            !dayState.isOpen ? "opacity-25 pointer-events-none" : ""
                          }`}
                        >
                          <div className="flex flex-row flex-wrap gap-2.5 items-center w-full">
                            <div className="box-sizing-border-box flex flex-row justify-between items-center p-[6px] bg-[#FBFAF8] border border-[#DEDBD3] rounded-[16px] flex-1 max-w-[300px] h-[38px] sm:h-[46px] shrink-0">
                              <input
                                type="text"
                                disabled={!dayState.isOpen || isReadOnly}
                                value={dayState.newTimeText}
                                onChange={(e) => setManualDay(day, { newTimeText: sanitizeTimeDraftInput(e.target.value) })}
                                placeholder="9:00"
                                className="font-poppins font-medium text-sm sm:text-[17px] leading-[20px] sm:leading-[26px] tracking-[-0.34px] text-black bg-transparent w-16 sm:w-20 text-center focus:outline-none"
                              />
                              <div className="flex flex-row gap-0.5 sm:gap-1">
                                <button
                                  type="button"
                                  disabled={!dayState.isOpen || isReadOnly}
                                  onClick={() => setManualDay(day, { amPm: "AM" })}
                                  className={`px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm font-medium ${
                                    dayState.amPm === "AM" ? "bg-[#8EBAC5] text-[#111111]" : "text-neutral-500"
                                  }`}
                                >
                                  AM
                                </button>
                                <button
                                  type="button"
                                  disabled={!dayState.isOpen || isReadOnly}
                                  onClick={() => setManualDay(day, { amPm: "PM" })}
                                  className={`px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm font-medium ${
                                    dayState.amPm === "PM" ? "bg-[#8EBAC5] text-[#111111]" : "text-neutral-500"
                                  }`}
                                >
                                  PM
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={!dayState.isOpen || isReadOnly}
                              onClick={() => addManualTime(day)}
                              className="w-9 h-9 border border-[#C6C6CB] bg-white rounded-full flex items-center justify-center hover:bg-neutral-50 cursor-pointer shadow-sm disabled:cursor-not-allowed"
                            >
                              <span className="text-xl font-medium text-[#141B34]">+</span>
                            </button>
                          </div>

                          {dayState.isOpen && dayState.slots.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {dayState.slots.map((slot) => (
                                <div
                                  key={slot}
                                  className="flex items-center gap-2 px-3 py-1 bg-[#D1F3FA] rounded-full text-xs font-poppins font-medium text-[#106374]"
                                  title={formatTime12Hour(slot)}
                                >
                                  <span>{slot}</span>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => removeManualTime(day, slot)}
                                      className="text-[#106374] font-bold hover:text-red-500"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Pricing & Duration */}
          <div className="flex flex-col gap-[20px] w-full">
            <span className="font-poppins font-semibold text-xs leading-[18px] tracking-[0.5px] uppercase text-[#111111]">
              PRICING & DURATION
            </span>

            {!form.isPackageDeal && (
              <div className="flex flex-col gap-3 w-full">
                <span className="font-poppins font-normal text-sm text-[#111111]">How is this service priced?</span>
                <div className="flex flex-row gap-2">
                  {(["FIXED", "HOURLY", "PER_PERSON"] as const).map((mode2) => (
                    <button
                      key={mode2}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setField("pricingMode", mode2)}
                      className={`h-[38px] px-4 rounded-lg text-xs font-poppins font-medium transition-colors cursor-pointer disabled:cursor-not-allowed ${
                        form.pricingMode === mode2 ? "bg-[#1C1B1C] text-white" : "bg-white text-[#111111] border border-neutral-200"
                      }`}
                    >
                      {mode2 === "FIXED" ? "Fixed price" : mode2 === "HOURLY" ? "Hourly rate" : "Per person"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {form.isPackageDeal ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                <NumField label="Duration (min)" required disabled={isReadOnly} value={form.packageDuration} onChange={(v) => setField("packageDuration", v)} placeholder="Duration of each session (min)" error={errors["packagePricing.durationMin"]} />
                <NumField label="Booking interval (min)" disabled={isReadOnly} value={form.packageBookingInterval} onChange={(v) => setField("packageBookingInterval", v)} placeholder="How often a new slot appears" />
                <NumField label="Buffer time after service (min)" disabled={isReadOnly} value={form.packageBuffer} onChange={(v) => setField("packageBuffer", v)} placeholder="Hidden break after each appointment" />
                <NumField label="Processing time (min)" disabled={isReadOnly} value={form.packageProcessing} onChange={(v) => setField("packageProcessing", v)} placeholder="Free time mid-appointment" />
                <NumField label="Sessions in package" required disabled={isReadOnly} value={form.packageSessions} onChange={(v) => setField("packageSessions", v)} placeholder="e.g. 5" error={errors["packagePricing.sessionsInPackage"]} />
                <MoneyField label="Bundle price (€)" required disabled={isReadOnly} value={form.packageBundlePrice} onChange={(v) => setField("packageBundlePrice", v)} placeholder="e.g. 150.00" error={errors["packagePricing.bundlePriceCents"]} />
                <NumField label="Discount (%)" disabled={isReadOnly} value={form.packageDiscount} onChange={(v) => setField("packageDiscount", v)} placeholder="e.g. 10" error={errors["packagePricing.discountPercent"]} />
              </div>
            ) : form.pricingMode === "FIXED" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                <MoneyField label="Service Price (€)" required disabled={isReadOnly} value={form.fixedPrice} onChange={(v) => setField("fixedPrice", v)} placeholder="e.g. 150.00" error={errors["fixedPricing.priceCents"]} />
                <NumField label="Duration (min)" required disabled={isReadOnly} value={form.fixedDuration} onChange={(v) => setField("fixedDuration", v)} placeholder="Duration of whole service" error={errors["fixedPricing.durationMin"]} />
                <NumField label="Booking interval (min)" disabled={isReadOnly} value={form.fixedBookingInterval} onChange={(v) => setField("fixedBookingInterval", v)} placeholder="How often a new slot appears" />
                <NumField label="Buffer time after service (min)" disabled={isReadOnly} value={form.fixedBuffer} onChange={(v) => setField("fixedBuffer", v)} placeholder="Hidden break after each appointment" />
                <NumField label="Processing time (min)" disabled={isReadOnly} value={form.fixedProcessing} onChange={(v) => setField("fixedProcessing", v)} placeholder="Free time mid-appointment" />
                <NumField label="Discount (%)" disabled={isReadOnly} value={form.fixedDiscount} onChange={(v) => setField("fixedDiscount", v)} placeholder="e.g. 10" error={errors["fixedPricing.discountPercent"]} />
                <span className="text-xs text-neutral-500 sm:col-span-2">Travel fee is added automatically at checkout.</span>
              </div>
            ) : form.pricingMode === "HOURLY" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                <MoneyField label="Rate per hour (€)" required disabled={isReadOnly} value={form.hourlyRate} onChange={(v) => setField("hourlyRate", v)} placeholder="0.00" error={errors["hourlyPricing.ratePerHourCents"]} />
                <div />
                <NumField label="Min hours" required disabled={isReadOnly} value={form.hourlyMin} onChange={(v) => setField("hourlyMin", v)} placeholder="1" error={errors["hourlyPricing.minHours"]} />
                <NumField label="Max hours" required disabled={isReadOnly} value={form.hourlyMax} onChange={(v) => setField("hourlyMax", v)} placeholder="8" error={errors["hourlyPricing.maxHours"]} />
                <NumField label="Buffer time after service (min)" disabled={isReadOnly} value={form.hourlyBuffer} onChange={(v) => setField("hourlyBuffer", v)} placeholder="Hidden break after each appointment" />
              </div>
            ) : (
              <div className="flex flex-col gap-5 w-full">
                <div className="flex flex-row items-start gap-2 p-3 bg-[#F5F4EE] rounded-lg text-xs text-[#111111]">
                  <span>
                    Group capacity mode. The slot stays open and bookable until maximum capacity is reached. Multiple customers can book the same slot independently — each booking subtracts from available seats. Example: Boat tour: 20 seats → 2 booked → 18 seats still available.
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                  <MoneyField label="Rate per person (€)" required disabled={isReadOnly} value={form.perPersonRate} onChange={(v) => setField("perPersonRate", v)} placeholder="0.00" error={errors["perPersonPricing.ratePerPersonCents"]} />
                  <div />
                  <NumField label="Min person" required disabled={isReadOnly} value={form.perPersonMin} onChange={(v) => setField("perPersonMin", v)} placeholder="2" error={errors["perPersonPricing.minPersons"]} />
                  <NumField label="Max person" required disabled={isReadOnly} value={form.perPersonMax} onChange={(v) => setField("perPersonMax", v)} placeholder="8" error={errors["perPersonPricing.maxPersons"]} />
                  <NumField label="Duration (min)" required disabled={isReadOnly} value={form.perPersonDuration} onChange={(v) => setField("perPersonDuration", v)} placeholder="Duration of whole service" error={errors["perPersonPricing.durationMin"]} />
                  <NumField label="Booking interval (min)" disabled={isReadOnly} value={form.perPersonBookingInterval} onChange={(v) => setField("perPersonBookingInterval", v)} placeholder="When a booking will be available" />
                  <NumField label="Buffer time after service (min)" disabled={isReadOnly} value={form.perPersonBuffer} onChange={(v) => setField("perPersonBuffer", v)} placeholder="Hidden break after each appointment" />
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Cities Served (only when the business travels to customers) */}
          {showCitiesSection && (
            <div className="flex flex-col gap-[12px] w-full">
              <span className="font-poppins font-semibold text-xs leading-[18px] tracking-[0.5px] uppercase text-[#111111]">
                CITIES SERVED FOR THIS SERVICE
              </span>
              <span className="font-poppins font-normal text-sm leading-[21px] text-[#111111]">
                Select which cities you offer this service in. Travel fees per city are set in Settings → Travel fees and added automatically at checkout.
              </span>
              <div className="flex flex-wrap gap-2.5 mt-2">
                {activeTravelCities.map((city) => {
                  const isSelected = form.servedCities.includes(city);
                  return (
                    <button
                      key={city}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => toggleCity(city)}
                      className={`h-[36px] px-4 rounded-full text-xs font-poppins font-medium transition-colors flex items-center justify-center disabled:cursor-not-allowed ${
                        isSelected ? "bg-[#2E9DA7] text-white" : "bg-neutral-100 text-[#111111] border border-neutral-200"
                      }`}
                    >
                      {city}
                    </button>
                  );
                })}
                {activeTravelCities.length === 0 && (
                  <span className="text-xs text-neutral-500">
                    No cities enabled yet — enable them in Settings → Travel fees.
                  </span>
                )}
              </div>
              <span className="text-xs text-neutral-500 font-normal mt-1">
                The customer enters their full address at booking. Only enabled cities will be selectable.
              </span>
            </div>
          )}

          {/* Section 7: Assign Staff */}
          <div className="flex flex-col gap-[12px] w-full">
            <span className="font-poppins font-semibold text-xs leading-[18px] tracking-[0.5px] uppercase text-[#111111]">
              ASSIGN STAFF
            </span>
            <span className="font-poppins font-normal text-sm leading-[21px] text-[#111111]">
              Which staff members can perform this service?
            </span>
            <div className="flex flex-wrap gap-4 mt-2">
              {assignableStaff.map((member) => {
                const isSelected = form.assignedStaffMembershipIds.includes(member.membershipId as string);
                return (
                  <button
                    key={member.membershipId}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => toggleStaff(member.membershipId as string)}
                    className={`h-[38px] pl-2 pr-4 rounded-full text-xs font-poppins font-medium transition-colors flex items-center gap-2 border disabled:cursor-not-allowed ${
                      isSelected ? "bg-[#2E9DA7] text-white border-[#2E9DA7]" : "bg-white text-[#111111] border-neutral-200"
                    }`}
                  >
                    <Image
                      src={member.avatarUrl || "/img/dumyUser.jpeg"}
                      alt={member.name}
                      className="w-6 h-6 rounded-full object-cover"
                      width={24}
                      height={24}
                    />
                    <span>{member.name}</span>
                  </button>
                );
              })}
              {assignableStaff.length === 0 && (
                <span className="text-xs text-neutral-500">No active staff yet.</span>
              )}
            </div>
            <span className="text-xs text-neutral-500 font-normal mt-1">
              Manage your team under Staff → Add / edit staff members.
            </span>
          </div>

          {/* Section 8: Assigned Add-ons (read-only — managed from the Add-on's own
              "Assign to services" field) */}
          {mode !== "create" && (
            <div className="flex flex-col gap-[12px] w-full">
              <span className="font-poppins font-semibold text-xs leading-[18px] tracking-[0.5px] uppercase text-[#111111]">
                ASSIGNED ADD-ONS
              </span>
              <span className="font-poppins font-normal text-sm leading-[21px] text-[#111111]">
                Add-ons a customer can add when booking this service. Manage this list from the Add-on itself.
              </span>
              <div className="flex flex-wrap gap-2.5 mt-2">
                {(assignedAddonsQuery.data ?? []).map((addon) => (
                  <div
                    key={addon.addonId}
                    className={`h-[36px] px-4 rounded-full text-xs font-poppins font-medium flex items-center gap-2 border ${
                      addon.status === "ARCHIVED" || addon.status === "INACTIVE"
                        ? "bg-neutral-100 text-neutral-500 border-neutral-200"
                        : "bg-white text-[#111111] border-neutral-200"
                    }`}
                  >
                    <span>{addon.name}</span>
                    {addon.priceCents !== undefined && (
                      <span className="text-neutral-500">{formatEuro(addon.priceCents)}</span>
                    )}
                    {addon.status !== "ACTIVE" && (
                      <span className="text-[10px] uppercase text-neutral-400">
                        {addon.status === "ARCHIVED" ? "archived" : addon.status.toLowerCase()}
                      </span>
                    )}
                  </div>
                ))}
                {!assignedAddonsQuery.isLoading && (assignedAddonsQuery.data ?? []).length === 0 && (
                  <span className="text-xs text-neutral-500">No add-ons attached yet.</span>
                )}
              </div>
              <span className="text-xs text-neutral-500 font-normal mt-1">
                Attach add-ons under Add-ons → Create/Edit Add-on → Assign to services.
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-row justify-end items-center gap-[12px] w-full h-[34px] mt-6">
            {isReadOnly ? (
              <button
                type="button"
                onClick={onDone}
                className="h-[34px] px-6 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer flex items-center justify-center"
              >
                Close
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onDone}
                  className="h-[34px] px-6 bg-[#EBEBEB] text-[#757575] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#E2E2E2] transition-colors cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSave("DRAFT")}
                  className="h-[34px] px-6 bg-white border border-[#D3D1C7] text-[#111111] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#F5F4EE] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Saving…" : "Save as Draft"}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSave(form.active ? "ACTIVE" : "INACTIVE")}
                  className="h-[34px] px-6 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const NumField = ({
  label,
  required,
  disabled,
  value,
  onChange,
  placeholder,
  error
}: {
  label: string;
  required?: boolean;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}) => (
  <div className="flex flex-col gap-2 w-full">
    <span className={fieldLabelClass}>
      {label} {required && <span className="text-[#D85A30]">*</span>}
    </span>
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
      placeholder={placeholder}
      className={inputClass}
    />
    {error && <span className="text-xs text-[#D85A30]">{error}</span>}
  </div>
);

const MoneyField = ({
  label,
  required,
  disabled,
  value,
  onChange,
  placeholder,
  error
}: {
  label: string;
  required?: boolean;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}) => (
  <div className="flex flex-col gap-2 w-full">
    <span className={fieldLabelClass}>
      {label} {required && <span className="text-[#D85A30]">*</span>}
    </span>
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
      placeholder={placeholder}
      className={inputClass}
    />
    {error && <span className="text-xs text-[#D85A30]">{error}</span>}
  </div>
);
