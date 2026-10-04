"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import AddonsStep from "@/app/venue/components/AddonsStep";
import ProfessionalsStep from "@/app/venue/components/ProfessionalsStep";
import TimeStep from "@/app/venue/components/TimeStep";
import TravelAddressStep, {
  emptyTravelAddress,
  type TravelAddressFields,
} from "@/app/venue/components/TravelAddressStep";
import { ANY_STAFF, type AvailabilitySlot } from "@/lib/api/catalog";
import type {
  PackageProgress,
  PackageRedemptionPreview,
  PackageRedemptionPreviewInput,
} from "@/lib/api/packages";
import { toUserMessage } from "@/lib/auth/messages";
import { formatBookingDate, formatBookingMoney, formatBookingTimeRange } from "@/lib/bookings/format";
import {
  useBusinessCatalogQuery,
  useServiceAddonsQuery,
  useServiceAvailabilityQuery,
} from "@/lib/catalog/hooks";
import type { BusinessCity } from "@/lib/constants/cities";
import {
  usePreviewPackageRedemptionMutation,
  useRedeemPackageSessionMutation,
} from "@/lib/packages/hooks";
import { getStripe } from "@/lib/payments/stripe-client";

type Entitlement = NonNullable<PackageProgress["fulfilmentEntitlement"]>;
type Step = "addons" | "travel" | "professional" | "time" | "review";

interface RedeemSessionModalProps {
  businessId: string;
  packageProgressId: string;
  serviceId: string;
  fulfilmentEntitlement: Entitlement;
  packageName: string;
  nextSessionIndex: number;
  totalSessions: number;
  onClose: () => void;
  onBooked: () => void;
}

const isCompleteTravelAddress = (
  city: BusinessCity | undefined,
  address: TravelAddressFields,
): boolean =>
  Boolean(
    city &&
      address.propertyType &&
      address.area.trim() &&
      address.streetName.trim() &&
      address.streetNumber.trim(),
  );

export default function RedeemSessionModal({
  businessId,
  packageProgressId,
  serviceId,
  fulfilmentEntitlement,
  packageName,
  nextSessionIndex,
  totalSessions,
  onClose,
  onBooked,
}: RedeemSessionModalProps) {
  const isTravel = fulfilmentEntitlement.mode === "TRAVEL_TO_CUSTOMER";
  const servedCities = useMemo(
    () => (fulfilmentEntitlement.travelCities ?? []).map((entry) => entry.city),
    [fulfilmentEntitlement.travelCities],
  );
  const [subStep, setSubStep] = useState<Step>("addons");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [customerCity, setCustomerCity] = useState<BusinessCity | undefined>();
  const [travelAddress, setTravelAddress] = useState<TravelAddressFields>(emptyTravelAddress);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateIso, setSelectedDateIso] = useState<string>();
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot>();
  const [preview, setPreview] = useState<PackageRedemptionPreview>();
  const [acceptedPreviewKey, setAcceptedPreviewKey] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [confirming3ds, setConfirming3ds] = useState(false);
  const previewRequestId = useRef(0);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      previewRequestId.current += 1;
    },
    [],
  );

  const catalogQuery = useBusinessCatalogQuery(businessId);
  const service = catalogQuery.data?.services.find((candidate) => candidate.id === serviceId);
  const eligibleStaff = (catalogQuery.data?.staff ?? []).filter((member) =>
    service?.assignedStaffMembershipIds.includes(member.id),
  );
  const addonsQuery = useServiceAddonsQuery(businessId, serviceId);
  const previewMutation = usePreviewPackageRedemptionMutation();
  const redeemMutation = useRedeemPackageSessionMutation();

  const buildPreviewInput = (): PackageRedemptionPreviewInput | undefined => {
    if (isTravel && !isCompleteTravelAddress(customerCity, travelAddress)) return undefined;
    return {
      addonIds: selectedAddonIds,
      ...(isTravel && customerCity
        ? {
            customerCity,
            travelAddress: {
              city: customerCity,
              propertyType: travelAddress.propertyType as NonNullable<
                PackageRedemptionPreviewInput["travelAddress"]
              >["propertyType"],
              area: travelAddress.area.trim(),
              streetName: travelAddress.streetName.trim(),
              streetNumber: travelAddress.streetNumber.trim(),
              floorUnit: travelAddress.floorUnit.trim() || undefined,
              aptRoom: travelAddress.aptRoom.trim() || undefined,
              additionalDirections: travelAddress.additionalDirections.trim() || undefined,
            },
          }
        : {}),
    };
  };

  const previewInput = buildPreviewInput();
  const previewKey = previewInput ? JSON.stringify(previewInput) : undefined;
  const selectedAddonKey = selectedAddonIds.join(",");

  useEffect(() => {
    const input = buildPreviewInput();
    const requestId = ++previewRequestId.current;
    if (!input) {
      void Promise.resolve().then(() => {
        if (mounted.current && requestId === previewRequestId.current) {
          setPreview(undefined);
          setAcceptedPreviewKey(undefined);
          setPreviewError(undefined);
          setIsPreviewPending(false);
        }
      });
      return;
    }

    const key = JSON.stringify(input);
    void Promise.resolve().then(() => {
      if (mounted.current && requestId === previewRequestId.current) {
        setPreview(undefined);
        setAcceptedPreviewKey(undefined);
        setPreviewError(undefined);
        setIsPreviewPending(true);
      }
      return previewMutation.mutateAsync({ businessId, packageProgressId, input });
    }).then(
      (result) => {
        if (mounted.current && requestId === previewRequestId.current) {
          setPreview(result);
          setAcceptedPreviewKey(key);
          setIsPreviewPending(false);
        }
      },
      (error: unknown) => {
        if (mounted.current && requestId === previewRequestId.current) {
          setPreview(undefined);
          setAcceptedPreviewKey(undefined);
          setPreviewError(toUserMessage(error));
          setIsPreviewPending(false);
        }
      },
    );
    // Primitive selection values are the request identity; excluding the mutation object avoids
    // referential request loops while the request-id guard makes Strict Mode latest-wins safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessId,
    packageProgressId,
    isTravel,
    selectedAddonKey,
    customerCity,
    travelAddress.propertyType,
    travelAddress.area,
    travelAddress.streetName,
    travelAddress.streetNumber,
    travelAddress.floorUnit,
    travelAddress.aptRoom,
    travelAddress.additionalDirections,
  ]);

  const availabilityFromDate = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const availabilityToDateObj = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const availabilityToDate = `${availabilityToDateObj.getFullYear()}-${String(availabilityToDateObj.getMonth() + 1).padStart(2, "0")}-${String(availabilityToDateObj.getDate()).padStart(2, "0")}`;
  const availabilityQuery = useServiceAvailabilityQuery(
    businessId,
    subStep === "time" ? serviceId : undefined,
    subStep === "time"
      ? {
          fromDate: availabilityFromDate,
          toDate: availabilityToDate,
          staffMembershipId: selectedProfessional ?? undefined,
          customerCity: isTravel ? customerCity : undefined,
          packageProgressId,
        }
      : undefined,
  );

  const selectedStaffMembershipId = selectedSlot
    ? selectedProfessional === ANY_STAFF
      ? selectedSlot.eligibleStaffMembershipIds[0]
      : selectedProfessional ?? undefined
    : undefined;
  const selectedStaff = eligibleStaff.find((member) => member.id === selectedStaffMembershipId);
  const currentPreviewIsValid = Boolean(preview && previewKey && acceptedPreviewKey === previewKey);
  const paymentMethodMissing = Boolean(
    preview?.requiresSavedCard && currentPreviewIsValid && !preview.hasSavedCard,
  );

  const handleConfirm = async () => {
    if (!selectedSlot || !selectedStaffMembershipId || !previewInput || !currentPreviewIsValid) return;
    setSubmitError(undefined);
    const idempotencyKey = crypto.randomUUID();
    const submit = () =>
      redeemMutation.mutateAsync({
        businessId,
        packageProgressId,
        input: {
          ...previewInput,
          staffMembershipId: selectedStaffMembershipId,
          startAt: selectedSlot.startAt,
          idempotencyKey,
        },
      });

    try {
      const result = await submit();
      if (result.status === "requires_action") {
        setConfirming3ds(true);
        try {
          const stripe = await getStripe();
          if (!stripe) {
            setSubmitError("Payment could not be initialized. Please try again.");
            return;
          }
          const confirmation = await stripe.confirmCardPayment(result.clientSecret);
          if (confirmation.error) {
            setSubmitError(confirmation.error.message ?? "Payment authentication failed.");
            return;
          }
          const retry = await submit();
          if (retry.status === "requires_action") {
            setSubmitError("Payment could not be confirmed. Please try again.");
            return;
          }
        } finally {
          setConfirming3ds(false);
        }
      }
      onBooked();
    } catch (error) {
      setSubmitError(toUserMessage(error));
    }
  };

  const goBack = () => {
    if (subStep === "travel") setSubStep("addons");
    if (subStep === "professional") setSubStep(isTravel ? "travel" : "addons");
    if (subStep === "time") setSubStep("professional");
    if (subStep === "review") setSubStep("time");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 font-poppins sm:p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="redeem-session-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col gap-6 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="redeem-session-title" className="text-xl font-semibold text-[#1C1B1C]">Book package session</h2>
            <p className="mt-1 text-xs text-neutral-500">Session {nextSessionIndex} of {totalSessions} · {packageName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close session scheduler" className="text-neutral-400 hover:text-black"><HugeiconsIcon icon={Cancel01Icon} className="h-5 w-5" /></button>
        </div>

        {catalogQuery.isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : !service ? <p className="text-sm text-red-600">This service is no longer available for booking.</p> : (
          <>
            {subStep === "addons" ? <AddonsStep addons={addonsQuery.data?.addons ?? []} isLoading={addonsQuery.isLoading} selectedAddonIds={selectedAddonIds} setSelectedAddonIds={setSelectedAddonIds} /> : null}
            {subStep === "travel" ? <TravelAddressStep servedCities={servedCities} customerCity={customerCity} setCustomerCity={setCustomerCity} address={travelAddress} setAddress={(patch) => setTravelAddress((current) => ({ ...current, ...patch }))} /> : null}
            {subStep === "professional" ? <ProfessionalsStep staff={eligibleStaff} selectedProfessional={selectedProfessional} setSelectedProfessional={(professional) => { setSelectedProfessional(professional); setSelectedSlot(undefined); setSelectedDateIso(undefined); }} /> : null}
            {subStep === "time" ? <TimeStep timezone={catalogQuery.data?.business.timezone ?? "UTC"} visibleMonth={visibleMonth} onPrevMonth={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} onNextMonth={() => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} availability={availabilityQuery.data} isLoading={availabilityQuery.isLoading} selectedDateIso={selectedDateIso} onSelectDate={(date) => { setSelectedDateIso(date); setSelectedSlot(undefined); }} selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} /> : null}
            {subStep === "review" && selectedSlot ? (
              <div className="flex flex-col gap-5">
                <div><h3 className="font-manrope text-2xl font-bold text-[#1C1B1C]">Review your session</h3><p className="mt-1 text-sm text-[#5F5E5A]">Confirm the appointment and current payment details.</p></div>
                <dl className="grid gap-4 rounded-xl bg-[#F7F6F2] p-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase text-[#888780]">Professional</dt><dd className="mt-1 font-medium">{selectedStaff ? `${selectedStaff.firstName} ${selectedStaff.lastName ?? ""}`.trim() : "Professional"}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-[#888780]">Date and time</dt><dd className="mt-1 font-medium">{formatBookingDate(selectedSlot.startAt, catalogQuery.data?.business.timezone ?? "UTC")} · {formatBookingTimeRange({ startAt: selectedSlot.startAt, endAt: selectedSlot.endAt, timezone: catalogQuery.data?.business.timezone ?? "UTC" })}</dd></div>
                  {isTravel && customerCity ? <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase text-[#888780]">Travel to customer</dt><dd className="mt-1 font-medium">{travelAddress.streetNumber} {travelAddress.streetName}, {travelAddress.area}, {customerCity}{travelAddress.floorUnit ? ` · ${travelAddress.floorUnit}` : ""}{travelAddress.aptRoom ? ` · Apt/room ${travelAddress.aptRoom}` : ""}</dd>{travelAddress.additionalDirections ? <dd className="mt-1 text-[#5F5E5A]">{travelAddress.additionalDirections}</dd> : null}</div> : null}
                </dl>
                {isPreviewPending ? <p className="rounded-xl bg-[#F5F4EE] p-4 text-sm text-[#5F5E5A]">Updating price…</p> : null}
                {previewError ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{previewError}</p> : null}
                {preview && currentPreviewIsValid ? <PriceSummary preview={preview} isTravel={isTravel} /> : null}
                {paymentMethodMissing ? <p className="rounded-xl bg-[#FFF8DF] p-4 text-sm text-[#725B00]">A saved payment card is required for this online charge. <Link href="/customer/payment-card" className="font-semibold underline">Manage payment card</Link></p> : null}
              </div>
            ) : null}

            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
            <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:justify-end">
              {subStep === "addons" ? <button type="button" onClick={onClose} className="rounded-lg bg-[#EBEBEB] px-5 py-2.5 text-sm font-medium text-[#757575]">Close</button> : <button type="button" onClick={goBack} className="rounded-lg bg-[#EBEBEB] px-5 py-2.5 text-sm font-medium text-[#757575]">Back</button>}
              {subStep === "addons" ? <button type="button" onClick={() => setSubStep(isTravel ? "travel" : "professional")} className="rounded-lg bg-[#1C1B1C] px-5 py-2.5 text-sm font-medium text-white">Continue</button> : subStep === "travel" ? <button type="button" disabled={!isCompleteTravelAddress(customerCity, travelAddress) || isPreviewPending || Boolean(previewError)} onClick={() => setSubStep("professional")} className="rounded-lg bg-[#1C1B1C] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Continue</button> : subStep === "professional" ? <button type="button" disabled={!selectedProfessional} onClick={() => setSubStep("time")} className="rounded-lg bg-[#1C1B1C] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Continue</button> : subStep === "time" ? <button type="button" disabled={!selectedSlot || !currentPreviewIsValid || isPreviewPending || Boolean(previewError)} onClick={() => setSubStep("review")} className="rounded-lg bg-[#1C1B1C] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">Review</button> : <button type="button" disabled={!selectedSlot || !currentPreviewIsValid || isPreviewPending || Boolean(previewError) || paymentMethodMissing || redeemMutation.isPending || confirming3ds} onClick={() => void handleConfirm()} className="rounded-lg bg-[#1C1B1C] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{confirming3ds ? "Confirming payment…" : redeemMutation.isPending ? "Booking…" : "Confirm session"}</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PriceSummary({ preview, isTravel }: { preview: PackageRedemptionPreview; isTravel: boolean }) {
  return (
    <div className="rounded-xl border border-[#E2E0DF] p-4">
      <div className="flex justify-between py-1.5 text-sm"><span>Package session</span><span className="font-medium">Included</span></div>
      <div className="flex justify-between py-1.5 text-sm"><span>Add-ons</span><span>{formatBookingMoney(preview.addonsSubtotalCents)}</span></div>
      {isTravel ? <div className="flex justify-between py-1.5 text-sm"><span>Travel fee</span><span>{formatBookingMoney(preview.travelFeeCents)}</span></div> : null}
      <div className="mt-2 flex justify-between border-t border-[#E2E0DF] pt-3 font-semibold"><span>Due online now</span><span>{formatBookingMoney(preview.customerChargeNowCents)}</span></div>
      <div className="flex justify-between pt-2 text-sm text-[#5F5E5A]"><span>Balance due at venue</span><span>{formatBookingMoney(preview.balanceDueCents)}</span></div>
      {preview.customerChargeNowCents === 0 ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800">No online payment due.</p> : null}
      <p className="mt-3 text-xs leading-5 text-[#77746F]">The amount above is the current online charge. VAT is not included or presented as payable in this pre-activation flow.</p>
    </div>
  );
}
