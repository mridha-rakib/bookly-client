"use client";

import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import type { Addon, AddonInput } from "@/lib/api/addons";
import { centsToEuroText, euroTextToCents } from "@/lib/addons/format";
import { useAddonQuery, useCreateAddonMutation, useUpdateAddonMutation } from "@/lib/addons/hooks";
import { validateAddonInput, type AddonFormErrors } from "@/lib/addons/schema";
import { useServiceCategoriesQuery, useServicesQuery } from "@/lib/services/hooks";
import { formatEuro } from "@/lib/services/format";

interface AddonFormProps {
  businessId: string;
  mode: "create" | "edit" | "view";
  addonId?: string;
  onDone: () => void;
}

interface FormState {
  /** Drives the "Add-on active" toggle — only meaningful for a non-draft Save. */
  active: boolean;
  name: string;
  description: string;
  price: string;
  customServiceCategoryId: string;
  assignedServiceIds: string[];
}

const initialFormState = (): FormState => ({
  active: true,
  name: "",
  description: "",
  price: "",
  customServiceCategoryId: "",
  assignedServiceIds: []
});

const hydrateFromAddon = (addon: Addon): FormState => ({
  active: addon.status !== "INACTIVE",
  name: addon.name,
  description: addon.description ?? "",
  price: addon.priceCents !== undefined ? centsToEuroText(addon.priceCents) : "",
  customServiceCategoryId: addon.customServiceCategoryId ?? "",
  assignedServiceIds: addon.assignedServices.map((service) => service.serviceId)
});

const buildAddonInput = (form: FormState, status: AddonInput["status"]): AddonInput => ({
  status,
  name: form.name.trim(),
  ...(form.description.trim() ? { description: form.description.trim() } : {}),
  ...(euroTextToCents(form.price) !== null ? { priceCents: euroTextToCents(form.price) as number } : {}),
  ...(form.customServiceCategoryId ? { customServiceCategoryId: form.customServiceCategoryId } : {}),
  assignedServiceIds: form.assignedServiceIds
});

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

const inputClass =
  "h-[41px] border border-[#111111]/20 rounded-[12px] px-3 font-poppins text-sm text-[#111111] placeholder:text-[#757575] focus:outline-none w-full";
const disabledInputClass = "bg-neutral-100 cursor-not-allowed";
const enabledInputClass = "bg-white";

export default function AddonForm({ businessId, mode, addonId, onDone }: AddonFormProps) {
  const isReadOnly = mode === "view";
  const title = mode === "create" ? "Create Add-ons" : mode === "edit" ? "Edit Add-on" : "View Add-on";

  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<AddonFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addonQuery = useAddonQuery(businessId || undefined, addonId);
  const categoriesQuery = useServiceCategoriesQuery(businessId || undefined);
  const servicesQuery = useServicesQuery(businessId || undefined, {});
  const createMutation = useCreateAddonMutation();
  const updateMutation = useUpdateAddonMutation();

  const activeCategories = categoriesQuery.data ?? [];

  // Non-archived Services from the current catalogue, plus any already-assigned Service the
  // Addon detail response carries (which may now be archived) — historical assignments must
  // stay visible/removable even though they're no longer offered for a *new* assignment.
  const assignableServices = useMemo(() => {
    const fromCatalogue = (servicesQuery.data?.services ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      archived: false
    }));
    const catalogueIds = new Set(fromCatalogue.map((service) => service.id));
    const fromAddon = (addonQuery.data?.assignedServices ?? [])
      .filter((service) => !catalogueIds.has(service.serviceId))
      .map((service) => ({
        id: service.serviceId,
        name: service.name,
        archived: service.status === "ARCHIVED"
      }));
    return [...fromCatalogue, ...fromAddon];
  }, [servicesQuery.data, addonQuery.data]);

  const servicePriceById = useMemo(() => {
    const map = new Map<string, string>();
    for (const service of servicesQuery.data?.services ?? []) {
      if (service.fixedPricing) {
        map.set(service.id, formatEuro(service.fixedPricing.priceCents));
      }
    }
    return map;
  }, [servicesQuery.data]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (mode !== "create" && addonQuery.data) {
      setForm(hydrateFromAddon(addonQuery.data));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, addonQuery.data?.id, addonQuery.data?.updatedAt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleService = (serviceId: string) => {
    setField(
      "assignedServiceIds",
      form.assignedServiceIds.includes(serviceId)
        ? form.assignedServiceIds.filter((id) => id !== serviceId)
        : [...form.assignedServiceIds, serviceId]
    );
  };

  // DRAFT tolerates incomplete data — addonInputSchema's superRefine short-circuits its
  // cross-field "required for publish" rules for status "DRAFT" (see lib/addons/schema.ts).
  const handleSave = async (status: AddonInput["status"]) => {
    const input = buildAddonInput(form, status);
    const validation = validateAddonInput(input);
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
        toast.success(status === "DRAFT" ? "Saved as draft" : "Add-on created");
      } else if (mode === "edit" && addonId) {
        await updateMutation.mutateAsync({ businessId, addonId, input: validation.data });
        toast.success(status === "DRAFT" ? "Saved as draft" : "Add-on updated");
      }
      onDone();
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      <DashboardHeader
        title="Add-ons"
        subtitle={mode === "create" ? "Create add-ons" : mode === "edit" ? "Edit add-on details" : "View add-on details"}
      />
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
              <span>Add-ons</span>
            </button>
            <span>&gt;</span>
            <span className="text-[#1C1C1A] font-semibold">{title}</span>
            {mode !== "create" && addonQuery.data?.status === "DRAFT" && (
              <span className="px-2 py-0.5 rounded-full bg-[#F5F4EE] border border-[#C6C19F] text-[10px] font-poppins font-medium uppercase tracking-[0.5px] text-[#111111]">
                Draft
              </span>
            )}
          </div>
        </div>

        {/* Active Status Card */}
        <div className="pl-0 md:pl-[110px] w-full box-sizing-border-box">
          <div className="flex justify-between items-center bg-[#F5F4EE] border border-[#C6C19F] rounded-[12px] p-5 w-full gap-6 mb-8">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-sm text-[#111111] font-poppins leading-[21px]">Add-on active</span>
              <span className="text-xs text-[#111111]/60 font-poppins leading-[18px]">
                Show on your public profile. Turn off to hide without deleting.
              </span>
            </div>
            <ToggleSwitch
              checked={form.active}
              onChange={() => setField("active", !form.active)}
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Form Fields */}
        <div className="pl-0 md:pl-[110px] w-full box-sizing-border-box flex flex-col gap-[32px]">
          {/* Add-on Name */}
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-0.5">
              <span className="text-xs font-normal text-[#111111] font-poppins leading-[18px]">Add-on name</span>
              <span className="text-xs font-normal text-[#D85A30] font-poppins leading-[18px]">*</span>
            </div>
            <input
              type="text"
              disabled={isReadOnly}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. False lashes, Extra Bridesmaid, Nail art design"
              className={`${inputClass} ${isReadOnly ? disabledInputClass : enabledInputClass}`}
            />
            {errors.name && <span className="text-xs text-[#D85A30]">{errors.name}</span>}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2 w-full">
            <span className="text-xs font-normal text-[#111111] font-poppins leading-[18px]">Description (optional)</span>
            <input
              type="text"
              disabled={isReadOnly}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="e.g. Includes travel-size product, adds 15 minutes to your session"
              className={`${inputClass} ${isReadOnly ? disabledInputClass : enabledInputClass}`}
            />
          </div>

          {/* Price and Category Row */}
          <div className="flex flex-col md:flex-row gap-5 w-full">
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-normal text-[#111111] font-poppins leading-[18px]">Price (€)</span>
                <span className="text-xs font-normal text-[#D85A30] font-poppins leading-[18px]">*</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                disabled={isReadOnly}
                value={form.price}
                onChange={(e) => setField("price", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0.00"
                className={`${inputClass} ${isReadOnly ? disabledInputClass : enabledInputClass}`}
              />
              <span className="text-[11px] text-[#111111] font-poppins leading-[15px]">
                Flat fee only. Added to the service total at checkout
              </span>
              {errors.priceCents && <span className="text-xs text-[#D85A30]">{errors.priceCents}</span>}
            </div>

            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-0.5">
                <span className="text-xs font-normal text-[#111111] font-poppins leading-[18px]">
                  Service category (you created)
                </span>
                <span className="text-xs font-normal text-[#D85A30] font-poppins leading-[18px]">*</span>
              </div>
              <div className="relative w-full">
                <select
                  disabled={isReadOnly}
                  value={form.customServiceCategoryId}
                  onChange={(e) => setField("customServiceCategoryId", e.target.value)}
                  className={`appearance-none h-[41px] border border-[#111111]/20 rounded-[12px] px-3 font-poppins text-sm text-[#111111] focus:outline-none w-full pr-[40px] ${
                    isReadOnly ? `${disabledInputClass} cursor-not-allowed` : `${enabledInputClass} cursor-pointer`
                  }`}
                  style={{
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='19' height='19' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 12px center",
                    backgroundSize: "14px"
                  }}
                >
                  <option value="">Choose service category</option>
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              {!categoriesQuery.isLoading && activeCategories.length === 0 && (
                <span className="text-xs text-[#D85A30]">
                  No service categories yet — add one in Business Profile → Edit.
                </span>
              )}
              {errors.customServiceCategoryId && (
                <span className="text-xs text-[#D85A30]">{errors.customServiceCategoryId}</span>
              )}
            </div>
          </div>

          {/* Assign to services */}
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-0.5">
                <span className="text-sm font-semibold text-[#111111] font-poppins leading-[18px]">Assign to services</span>
                <span className="text-sm font-semibold text-[#D85A30] font-poppins leading-[18px]">*</span>
              </div>
              <span className="text-[11px] text-[#111111] font-poppins leading-[15px]">
                Select which services this add-on will be available for
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {assignableServices.map((service) => {
                const isSelected = form.assignedServiceIds.includes(service.id);
                return (
                  <div
                    key={service.id}
                    onClick={() => {
                      if (!isReadOnly) {
                        toggleService(service.id);
                      }
                    }}
                    className={`box-sizing-border-box flex items-center justify-between p-3 h-[45px] transition-all rounded-[12px] ${
                      isReadOnly ? "cursor-not-allowed" : "cursor-pointer"
                    } ${isSelected ? "bg-[#E5F5EF] border border-[#91D5BB]" : "bg-white border border-[#111111]/20"}`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <div className="w-5 h-5 bg-gradient-to-b from-[rgba(12,192,223,0.2)] to-[rgba(12,192,223,0.2)] bg-[#8EBAC5] rounded flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-[#141B34]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 border border-[#757575] rounded shrink-0" />
                      )}
                      <span className="text-sm font-normal text-[#111111] font-poppins leading-[21px]">
                        {service.name}
                        {service.archived ? " (archived)" : ""}
                      </span>
                    </div>
                    <span className="text-sm font-normal text-[#111111] font-poppins leading-[21px]">
                      {servicePriceById.get(service.id) ?? ""}
                    </span>
                  </div>
                );
              })}
              {assignableServices.length === 0 && (
                <span className="text-xs text-neutral-500">No services yet — create one under Services.</span>
              )}
            </div>
            {errors.assignedServiceIds && <span className="text-xs text-[#D85A30]">{errors.assignedServiceIds}</span>}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-row justify-end items-center gap-5 w-full h-[36px] pt-6 mt-4">
            <button
              type="button"
              onClick={onDone}
              className="h-[36px] px-4 bg-[#EBEBEB] text-[#757575] font-manrope font-semibold text-sm rounded-[8px] hover:bg-[#E2E2E2] transition-colors shadow-[0px_1px_2px_rgba(0,0,0,0.05)] cursor-pointer flex items-center justify-center"
            >
              {isReadOnly ? "Back" : "Cancel"}
            </button>
            {!isReadOnly && (
              <>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSave("DRAFT")}
                  className="h-[36px] px-4 bg-white border border-[#D3D1C7] text-[#111111] font-manrope font-semibold text-sm rounded-[8px] hover:bg-[#F5F4EE] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Saving…" : "Save as Draft"}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleSave(form.active ? "ACTIVE" : "INACTIVE")}
                  className="h-[36px] px-[16px] bg-[#111111] hover:bg-black text-white font-manrope font-semibold text-sm rounded-[8px] transition-colors shadow-[0px_1px_2px_rgba(0,0,0,0.05)] cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
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
