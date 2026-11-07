"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { SettingsInput } from "./SettingsInput";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import type {
  BusinessFeeTaxBlocker,
  BusinessTaxSettings as BusinessTaxSettingsDto,
  BusinessTaxStatus,
} from "@/lib/api/bookingSettings";
import { useTaxSettingsQuery, useUpdateTaxSettingsMutation } from "@/lib/services/hooks";

type DeclaredStatus = Exclude<BusinessTaxStatus, "NOT_CONFIGURED">;

const STATUS_OPTIONS: { value: DeclaredStatus; label: string }[] = [
  { value: "VAT_REGISTERED", label: "VAT registered" },
  { value: "VAT_EXEMPT", label: "VAT exempt" },
  { value: "NOT_VAT_REGISTERED", label: "Not VAT registered" },
];

/** Display-only hint; the API validates and normalizes authoritatively. */
const CYPRUS_VAT_NUMBER = /^CY\d{8}[A-Z]$/;
const normalizeVatNumber = (value: string) => value.replace(/\s+/g, "").toUpperCase();

/** What Bookly does with VAT on this Business's fees today. Never implies €0 VAT. */
const FEE_VAT_MESSAGES: Record<BusinessFeeTaxBlocker, string> = {
  BUSINESS_TAX_SETTINGS_NOT_CONFIGURED:
    "Tell us your VAT position to complete tax setup. Until then, Bookly records that VAT on your cancellation and no-show fees was not calculated.",
  BUSINESS_TAX_ACCOUNT_UNAVAILABLE:
    "Your VAT registration is saved. Bookly can't calculate VAT under your own registration yet, because that needs a payment account linked to it. Fees are recorded as \"VAT not calculated\", not as zero VAT.",
  BUSINESS_DECLARED_NO_VAT_REGISTRATION:
    "Saved as your own declaration. Bookly does not calculate VAT on your cancellation and no-show fees.",
};

const notice = (text: string) => (
  <div className="bg-[#F7F5F1] border border-[#E2E8F0] rounded-lg p-3 flex gap-2">
    <HugeiconsIcon icon={InformationCircleIcon} className="w-5 h-5 text-[#6B7280] shrink-0 mt-0.5" />
    <span className="text-xs text-[#5B5D58] font-medium leading-[18px]">{text}</span>
  </div>
);

interface BusinessTaxSettingsProps {
  businessId: string | undefined;
}

/**
 * Business VAT position (P0.5) on the "Bank & Payouts" Settings tab. Owner-only on the API.
 * "Setup complete" (configuration) is shown separately from whether fee VAT is calculated.
 * Fee amounts are never changed by these settings.
 */
export function BusinessTaxSettings({ businessId }: BusinessTaxSettingsProps) {
  const query = useTaxSettingsQuery(businessId);

  const header = (
    <div>
      <h2 className="font-poppins font-medium text-base text-[#1A1A1A]">VAT &amp; Tax</h2>
      <p className="font-poppins font-normal text-xs text-[#888780] mt-0.5">
        Your business&apos;s VAT position for cancellation and no-show fees
      </p>
    </div>
  );

  const card = (children: React.ReactNode, data?: BusinessTaxSettingsDto) => (
    <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-poppins font-semibold text-[13px] text-[#1A1A1A]">Tax setup</span>
        {data && (
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              data.setupComplete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {data.setupComplete ? "Setup complete" : "Setup required"}
          </span>
        )}
      </div>
      {children}
    </div>
  );

  if (!businessId || query.isError) {
    return (
      <div className="flex flex-col gap-[14px] w-full">
        {header}
        {card(notice("We couldn't load your tax settings. Please reload the page."))}
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="flex flex-col gap-[14px] w-full">
        {header}
        {card(
          <div className="flex items-center gap-2 py-6 text-sm text-[#666666]">
            <Spinner /> Loading tax settings…
          </div>,
        )}
      </div>
    );
  }

  const data = query.data;
  return (
    <div className="flex flex-col gap-[14px] w-full">
      {header}
      {card(
        <TaxSettingsForm key={data.updatedAt ?? "new"} businessId={businessId} data={data} />,
        data,
      )}
    </div>
  );
}

function TaxSettingsForm({ businessId, data }: { businessId: string; data: BusinessTaxSettingsDto }) {
  const mutation = useUpdateTaxSettingsMutation();
  const [status, setStatus] = useState<DeclaredStatus | "">(
    data.status === "NOT_CONFIGURED" ? "" : data.status,
  );
  const [vatNumber, setVatNumber] = useState(data.vatNumber ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!status) {
      setFormError("Choose your VAT status.");
      return;
    }
    const compact = normalizeVatNumber(vatNumber);
    if (status === "VAT_REGISTERED" && !CYPRUS_VAT_NUMBER.test(compact)) {
      setFormError("Enter a Cyprus VAT number: CY followed by 8 digits and a letter.");
      return;
    }
    mutation.mutate(
      {
        businessId,
        input:
          status === "VAT_REGISTERED"
            ? { status, countryCode: "CY", vatNumber: compact }
            : { status, countryCode: "CY" },
      },
      {
        onSuccess: () => toast.success("Tax settings saved"),
        onError: (error) => setFormError(toUserMessage(error)),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {notice(
        data.feeVatCalculationEnabled
          ? "VAT on your cancellation and no-show fees is calculated."
          : FEE_VAT_MESSAGES[data.feeVatBlocker],
      )}
      <SettingsInput label="Tax country" value="Cyprus" onChange={() => undefined} disabled />
      <label className="flex flex-col gap-1 w-full">
        <span className="font-poppins font-semibold text-[10px] tracking-[0.8px] uppercase text-[#6B7280]">
          VAT status
        </span>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as DeclaredStatus | "")}
          disabled={mutation.isPending}
          className="h-10 border border-[#D3D1C7] rounded-[8px] px-3 text-[14px] text-[#1A1A1A] font-poppins bg-white focus:outline-none disabled:bg-neutral-50 disabled:cursor-not-allowed"
        >
          <option value="" disabled>
            Choose your VAT status
          </option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {status === "VAT_REGISTERED" && (
        <SettingsInput
          label="VAT number"
          value={vatNumber}
          onChange={setVatNumber}
          placeholder="CY________"
          disabled={mutation.isPending}
        />
      )}
      {formError && <p className="text-xs text-rose-600">{formError}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full flex items-center justify-center bg-[#111111] hover:bg-black text-white py-2.5 rounded-[12px] font-semibold text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {mutation.isPending ? <Spinner className="text-white" /> : "Save tax settings"}
      </button>
    </form>
  );
}
