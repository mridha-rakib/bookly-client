"use client";

import React, { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { SettingsInput } from "./SettingsInput";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { BooklyApiError, normalizeApiError } from "@/lib/api/client";
import { useCurrentUserQuery } from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import type { PayoutDestinationStepUpInput } from "@/lib/api/payoutDestination";
import {
  usePayoutDestinationQuery,
  useRequestPayoutStepUpOtpMutation,
  useUpdatePayoutDestinationMutation,
  useVerifyPayoutStepUpOtpMutation,
} from "@/lib/payoutDestination/hooks";

/**
 * Business Payout Destination — the Settings "Bank & Payouts" tab, extracted out of the
 * monolithic DashboardSettings.tsx now that a real backend exists
 * (api/src/modules/payout-destination). Replaces the old decorative, permanently-disabled
 * "Payout Bank Account Details (SEPA)" card and its VAT field (the backend has no VAT field of
 * any kind — see updatePayoutDestinationBodySchema, which is `.strict()`).
 *
 * SENSITIVE-STATE CONTRACT (deliberate, do not relax):
 *  - The raw IBAN, the current password and the OTP code/authorization token live ONLY in this
 *    component's local useState. They are never written to localStorage/sessionStorage, never
 *    put in a URL or query param, never placed in a global store or the React Query cache, and
 *    never logged or sent to analytics.
 *  - They are cleared on successful save, on cancel, on leaving a step, and on unmount.
 *  - The IBAN field ALWAYS starts empty, even when a destination is already configured: the
 *    masked value from the backend is a display string and is never parsed back into the form.
 *  - After a save the masked summary is re-read from the backend (the mutation invalidates the
 *    query) rather than being reconstructed from what the owner typed.
 */

type Step = "SUMMARY" | "FORM" | "CONFIRM_PASSWORD" | "CONFIRM_OTP";

interface PayoutDestinationSettingsProps {
  businessId: string | undefined;
}

const MIN_IBAN_LENGTH = 15;
const MAX_IBAN_LENGTH = 34;
const MIN_OTP_LENGTH = 4;
const MAX_OTP_LENGTH = 10;

/** Display-only tidy-up. The backend is authoritative: it re-normalizes and mod-97 validates
 * whatever we send, and its PAYOUT_DESTINATION_IBAN_INVALID response wins over this hint. */
const normalizeIbanInput = (value: string): string =>
  value.replace(/[\s-]/g, "").toUpperCase().slice(0, MAX_IBAN_LENGTH);

const looksLikeIban = (compactIban: string): boolean =>
  compactIban.length >= MIN_IBAN_LENGTH &&
  compactIban.length <= MAX_IBAN_LENGTH &&
  /^[A-Z]{2}\d{2}[A-Z\d]+$/.test(compactIban);

const formatUpdatedAt = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const toStepUpErrorMessage = (error: unknown): string => {
  const apiError = error instanceof BooklyApiError ? error : normalizeApiError(error);
  if (apiError.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  return toUserMessage(apiError);
};

const isStepUpInvalid = (error: unknown): boolean => {
  const apiError = error instanceof BooklyApiError ? error : normalizeApiError(error);
  return apiError.code === "PAYOUT_DESTINATION_STEP_UP_INVALID";
};

export const PayoutDestinationSettings: React.FC<PayoutDestinationSettingsProps> = ({
  businessId,
}) => {
  const meQuery = useCurrentUserQuery();
  const hasPassword = meQuery.data?.user.hasPassword ?? false;

  const destinationQuery = usePayoutDestinationQuery(businessId);
  const updateMutation = useUpdatePayoutDestinationMutation();
  const requestOtpMutation = useRequestPayoutStepUpOtpMutation();
  const verifyOtpMutation = useVerifyPayoutStepUpOtpMutation();

  const destination = destinationQuery.data;
  const isConfigured = destination?.configured === true;

  const [step, setStep] = useState<Step>("SUMMARY");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [formError, setFormError] = useState<string | undefined>(undefined);

  // Sensitive values must not outlive this component tree. React drops state on unmount anyway;
  // this cleanup makes that guarantee explicit and survives any future refactor that memoizes
  // or hoists this subtree.
  useEffect(
    () => () => {
      setIban("");
      setCurrentPassword("");
      setOtpCode("");
    },
    [],
  );

  const isBusy =
    updateMutation.isPending || requestOtpMutation.isPending || verifyOtpMutation.isPending;

  const clearSensitiveFields = () => {
    setIban("");
    setCurrentPassword("");
    setOtpCode("");
  };

  const resetForm = () => {
    setAccountHolderName("");
    setBankName("");
    setFormError(undefined);
    clearSensitiveFields();
  };

  const openForm = () => {
    // Prefill only the non-sensitive fields. The IBAN field always starts empty — the masked
    // value is never parsed back into an editable field.
    setAccountHolderName(destination?.configured ? destination.accountHolderName : "");
    setBankName(destination?.configured ? (destination.bankName ?? "") : "");
    setFormError(undefined);
    clearSensitiveFields();
    setStep("FORM");
  };

  const cancelToSummary = () => {
    resetForm();
    setStep("SUMMARY");
  };

  const persist = (stepUp: PayoutDestinationStepUpInput) => {
    if (!businessId) return;

    updateMutation.mutate(
      {
        businessId,
        input: {
          accountHolderName: accountHolderName.trim(),
          iban: normalizeIbanInput(iban),
          ...(bankName.trim() ? { bankName: bankName.trim() } : {}),
          stepUp,
        },
      },
      {
        onSuccess: () => {
          resetForm();
          setStep("SUMMARY");
          toast.success("Bank details saved.");
        },
        onError: (error) => {
          // A consumed/expired step-up proof can never be retried — send the owner back to the
          // start of the step-up flow instead of silently re-submitting.
          if (isStepUpInvalid(error)) {
            setCurrentPassword("");
            setOtpCode("");
            setStep(hasPassword ? "CONFIRM_PASSWORD" : "FORM");
          }
          setFormError(toStepUpErrorMessage(error));
        },
      },
    );
  };

  const validateDetails = (): boolean => {
    if (!accountHolderName.trim()) {
      setFormError("Account holder name is required.");
      return false;
    }
    if (!looksLikeIban(normalizeIbanInput(iban))) {
      setFormError("Please enter a valid IBAN.");
      return false;
    }
    setFormError(undefined);
    return true;
  };

  const handleDetailsSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy || !businessId || !validateDetails()) return;

    if (hasPassword) {
      setCurrentPassword("");
      setStep("CONFIRM_PASSWORD");
      return;
    }

    // OAuth-only owner: the code must be requested before anything is persisted.
    requestOtpMutation.mutate(
      { businessId },
      {
        onSuccess: () => {
          setOtpCode("");
          setFormError(undefined);
          setStep("CONFIRM_OTP");
        },
        onError: (error) => setFormError(toStepUpErrorMessage(error)),
      },
    );
  };

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;
    if (!currentPassword) {
      setFormError("Your current password is required.");
      return;
    }
    setFormError(undefined);
    persist({ currentPassword });
  };

  const handleOtpSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy || !businessId) return;

    const code = otpCode.trim();
    if (code.length < MIN_OTP_LENGTH) {
      setFormError("Enter the code we emailed you.");
      return;
    }
    setFormError(undefined);

    verifyOtpMutation.mutate(
      { businessId, code },
      {
        onSuccess: (result) => {
          setOtpCode("");
          // The token is single-use and consumed by this very call — it is passed straight
          // through and never stored.
          persist({ otpAuthorizationToken: result.otpAuthorizationToken });
        },
        onError: (error) => {
          setOtpCode("");
          setFormError(toStepUpErrorMessage(error));
        },
      },
    );
  };

  const handleResendOtp = () => {
    if (isBusy || !businessId) return;
    requestOtpMutation.mutate(
      { businessId },
      {
        onSuccess: () => {
          setOtpCode("");
          setFormError(undefined);
          toast.success("A new confirmation code was sent to your email.");
        },
        onError: (error) => setFormError(toStepUpErrorMessage(error)),
      },
    );
  };

  const header = (
    <div>
      <h2 className="font-poppins font-medium text-base text-[#1A1A1A]">Bank &amp; Payouts</h2>
      <p className="font-poppins font-normal text-xs text-[#888780] mt-0.5">
        The bank account Bookly sends your SEPA payouts to
      </p>
    </div>
  );

  const card = (children: React.ReactNode) => (
    <div className="bg-white border border-[#E2E8F0] rounded-[16px] p-6 flex flex-col gap-5">
      <span className="font-poppins font-semibold text-[13px] text-[#1A1A1A]">
        Payout Bank Account Details (SEPA)
      </span>
      {children}
    </div>
  );

  if (!businessId) {
    return (
      <div className="flex flex-col gap-[14px] w-full">
        {header}
        {card(
          <div className="bg-[#F7F5F1] border border-[#E2E8F0] rounded-lg p-3 flex gap-2">
            <HugeiconsIcon
              icon={InformationCircleIcon}
              className="w-5 h-5 text-[#6B7280] shrink-0 mt-0.5"
            />
            <span className="text-xs text-[#5B5D58] font-medium leading-[18px]">
              We couldn&apos;t determine your business. Please reload the page.
            </span>
          </div>,
        )}
      </div>
    );
  }

  if (destinationQuery.isLoading || meQuery.isLoading) {
    return (
      <div className="flex flex-col gap-[14px] w-full">
        {header}
        {card(
          <div className="flex items-center gap-2 py-6 text-sm text-[#666666]">
            <Spinner />
            <span>Loading bank details…</span>
          </div>,
        )}
      </div>
    );
  }

  if (destinationQuery.isError) {
    return (
      <div className="flex flex-col gap-[14px] w-full">
        {header}
        {card(
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-rose-600">
              Couldn&apos;t load your bank details
            </span>
            <button
              type="button"
              onClick={() => void destinationQuery.refetch()}
              className="self-start px-3.5 py-1.5 border border-[#DEDDE3] rounded-lg text-xs font-semibold text-[#111111] cursor-pointer"
            >
              Try again
            </button>
          </div>,
        )}
      </div>
    );
  }

  const summaryRow = (label: string, value: string) => (
    <div className="flex justify-between items-center gap-4 py-2.5 border-b border-[#F1F5F9] text-sm last:border-b-0">
      <span className="text-[#666666]">{label}</span>
      <span className="font-medium text-[#1A1A1A] text-right break-all">{value}</span>
    </div>
  );

  const errorLine = formError ? <p className="text-xs text-rose-600">{formError}</p> : null;

  return (
    <div className="flex flex-col gap-[14px] w-full">
      {header}

      {card(
        step === "SUMMARY" && destination?.configured ? (
          <>
            <div className="flex flex-col">
              {summaryRow("Account holder", destination.accountHolderName)}
              {summaryRow("IBAN", destination.ibanMasked)}
              {summaryRow("Bank name", destination.bankName ?? "—")}
              {summaryRow("Last updated", formatUpdatedAt(destination.updatedAt))}
            </div>
            <button
              type="button"
              onClick={openForm}
              className="w-full bg-[#111111] hover:bg-black text-white py-2.5 rounded-[12px] font-semibold text-sm mt-2 cursor-pointer transition-colors"
            >
              Update bank details
            </button>
          </>
        ) : step === "CONFIRM_PASSWORD" ? (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div className="bg-[#F7F5F1] border border-[#E2E8F0] rounded-lg p-3 flex gap-2">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                className="w-5 h-5 text-[#6B7280] shrink-0 mt-0.5"
              />
              <span className="text-xs text-[#5B5D58] font-medium leading-[18px]">
                Confirm your password to change where your payouts are sent.
              </span>
            </div>

            <SettingsInput
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Current password"
              disabled={isBusy}
            />

            {errorLine}

            <div className="flex flex-col gap-2 mt-2">
              <button
                type="submit"
                disabled={isBusy}
                className="w-full flex items-center justify-center bg-[#111111] hover:bg-black text-white py-2.5 rounded-[12px] font-semibold text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {updateMutation.isPending ? <Spinner className="text-white" /> : "Confirm & save"}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setCurrentPassword("");
                  setFormError(undefined);
                  setStep("FORM");
                }}
                className="w-full py-2.5 border border-[#DEDDE3] rounded-[12px] font-semibold text-sm text-[#111111] cursor-pointer disabled:opacity-60"
              >
                Back
              </button>
            </div>
          </form>
        ) : step === "CONFIRM_OTP" ? (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
            <div className="bg-[#F7F5F1] border border-[#E2E8F0] rounded-lg p-3 flex gap-2">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                className="w-5 h-5 text-[#6B7280] shrink-0 mt-0.5"
              />
              <span className="text-xs text-[#5B5D58] font-medium leading-[18px]">
                We sent a code to your email — enter it to confirm this change.
              </span>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <span className="font-poppins font-semibold text-[10px] tracking-[0.8px] uppercase text-[#6B7280]">
                Confirmation code
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={MAX_OTP_LENGTH}
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\s/g, ""))}
                disabled={isBusy}
                className="h-10 border border-[#D3D1C7] rounded-[8px] px-3.5 text-[14px] tracking-[4px] text-[#1A1A1A] font-poppins focus:outline-none disabled:bg-neutral-50 disabled:cursor-not-allowed"
              />
            </div>

            {errorLine}

            <div className="flex flex-col gap-2 mt-2">
              <button
                type="submit"
                disabled={isBusy || otpCode.trim().length < MIN_OTP_LENGTH}
                className="w-full flex items-center justify-center bg-[#111111] hover:bg-black text-white py-2.5 rounded-[12px] font-semibold text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isBusy ? <Spinner className="text-white" /> : "Confirm & save"}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleResendOtp}
                className="w-full py-2.5 border border-[#DEDDE3] rounded-[12px] font-semibold text-sm text-[#111111] cursor-pointer disabled:opacity-60"
              >
                Send a new code
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setOtpCode("");
                  setFormError(undefined);
                  setStep("FORM");
                }}
                className="w-full text-xs font-semibold text-[#666666] hover:underline cursor-pointer disabled:opacity-60"
              >
                Back
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleDetailsSubmit} className="flex flex-col gap-4">
            {isConfigured ? (
              <div className="bg-[#F7F5F1] border border-[#E2E8F0] rounded-lg p-3 flex gap-2">
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  className="w-5 h-5 text-[#6B7280] shrink-0 mt-0.5"
                />
                <span className="text-xs text-[#5B5D58] font-medium leading-[18px]">
                  For your security we never show your saved IBAN — enter the full IBAN again to
                  replace it.
                </span>
              </div>
            ) : null}

            <SettingsInput
              label="Account holder name/Business name"
              value={accountHolderName}
              onChange={setAccountHolderName}
              disabled={isBusy}
            />

            <SettingsInput
              label="IBAN"
              value={iban}
              onChange={(value) => setIban(normalizeIbanInput(value))}
              placeholder="CY00 0000 0000 0000 0000 0000 0000"
              disabled={isBusy}
            />

            <SettingsInput
              label="Bank name (optional)"
              value={bankName}
              onChange={setBankName}
              disabled={isBusy}
            />

            {errorLine}

            <div className="flex flex-col gap-2 mt-2">
              <button
                type="submit"
                disabled={isBusy}
                className="w-full flex items-center justify-center bg-[#111111] hover:bg-black text-white py-2.5 rounded-[12px] font-semibold text-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {requestOtpMutation.isPending ? (
                  <Spinner className="text-white" />
                ) : (
                  "Save bank details"
                )}
              </button>
              {isConfigured ? (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={cancelToSummary}
                  className="w-full py-2.5 border border-[#DEDDE3] rounded-[12px] font-semibold text-sm text-[#111111] cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ),
      )}
    </div>
  );
};
