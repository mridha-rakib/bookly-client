"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

import {
  useBusinessCatalogQuery,
  useServiceAddonsQuery,
  useServiceAvailabilityQuery,
} from "@/lib/catalog/hooks";
import { ANY_STAFF, type AvailabilitySlot } from "@/lib/api/catalog";
import { useRedeemPackageSessionMutation } from "@/lib/packages/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { getStripe } from "@/lib/payments/stripe-client";
import AddonsStep from "@/app/venue/components/AddonsStep";
import ProfessionalsStep from "@/app/venue/components/ProfessionalsStep";
import TimeStep from "@/app/venue/components/TimeStep";

interface RedeemSessionModalProps {
  businessId: string;
  packageProgressId: string;
  serviceId: string;
  onClose: () => void;
  onBooked: () => void;
}

/**
 * Book one remaining Package session — reuses the exact same AddonsStep/ProfessionalsStep/
 * TimeStep presentational components and useServiceAvailabilityQuery the venue booking wizard
 * already uses. The base session is always $0 (its price was already collected at purchase),
 * but a selected Add-on remains real, separately payable money — so this may require the same
 * 3DS confirmation step the venue wizard's own payment step already handles (see
 * BookingCreationService.redeemPackageSession's own doc comment).
 */
export default function RedeemSessionModal({
  businessId,
  packageProgressId,
  serviceId,
  onClose,
  onBooked,
}: RedeemSessionModalProps) {
  const [subStep, setSubStep] = useState<"addons" | "professional" | "time">("addons");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateIso, setSelectedDateIso] = useState<string | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | undefined>(undefined);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [confirming3ds, setConfirming3ds] = useState(false);

  const catalogQuery = useBusinessCatalogQuery(businessId);
  const service = catalogQuery.data?.services.find((s) => s.id === serviceId);
  const eligibleStaff = (catalogQuery.data?.staff ?? []).filter((member) =>
    service?.assignedStaffMembershipIds.includes(member.id),
  );
  const addonsQuery = useServiceAddonsQuery(businessId, serviceId);

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
        }
      : undefined,
  );

  const redeemMutation = useRedeemPackageSessionMutation();

  const handleConfirm = async () => {
    if (!selectedSlot) return;
    const staffMembershipId =
      selectedProfessional === ANY_STAFF
        ? selectedSlot.eligibleStaffMembershipIds[0]
        : selectedProfessional;
    if (!staffMembershipId) return;
    setSubmitError(undefined);

    const idempotencyKey = crypto.randomUUID();
    const submit = () =>
      redeemMutation.mutateAsync({
        businessId,
        packageProgressId,
        input: {
          staffMembershipId,
          startAt: selectedSlot.startAt,
          addonIds: selectedAddonIds,
          idempotencyKey,
        },
      });

    try {
      const result = await submit();
      if (result.status === "requires_action") {
        // A selected Add-on made this redemption a real charge — same 3DS/SCA confirmation
        // saga the venue booking wizard's own payment step already uses, retried with the SAME
        // idempotencyKey (never a second charge).
        setConfirming3ds(true);
        try {
          const stripe = await getStripe();
          if (!stripe) {
            setSubmitError("Payment could not be initialized. Please try again.");
            return;
          }
          const confirmResult = await stripe.confirmCardPayment(result.clientSecret);
          if (confirmResult.error) {
            setSubmitError(confirmResult.error.message ?? "Payment authentication failed.");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 font-poppins">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 md:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xl text-[#1C1B1C]">Book a session</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-black cursor-pointer">
            <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
          </button>
        </div>

        {catalogQuery.isLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : !service ? (
          <p className="text-sm text-red-600">This service is no longer available for booking.</p>
        ) : (
          <>
            {subStep === "addons" && (
              <AddonsStep
                addons={addonsQuery.data?.addons ?? []}
                isLoading={addonsQuery.isLoading}
                selectedAddonIds={selectedAddonIds}
                setSelectedAddonIds={setSelectedAddonIds}
              />
            )}
            {subStep === "professional" && (
              <ProfessionalsStep
                staff={eligibleStaff}
                selectedProfessional={selectedProfessional}
                setSelectedProfessional={setSelectedProfessional}
              />
            )}
            {subStep === "time" && (
              <TimeStep
                timezone={catalogQuery.data?.business.timezone ?? "UTC"}
                visibleMonth={visibleMonth}
                onPrevMonth={() =>
                  setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                onNextMonth={() =>
                  setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                availability={availabilityQuery.data}
                isLoading={availabilityQuery.isLoading}
                selectedDateIso={selectedDateIso}
                onSelectDate={setSelectedDateIso}
                selectedSlot={selectedSlot}
                onSelectSlot={setSelectedSlot}
              />
            )}

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <div className="flex justify-end gap-3 border-t border-neutral-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-[#EBEBEB] text-[#757575] text-sm font-medium hover:bg-[#E2E2E2] cursor-pointer"
              >
                Cancel
              </button>
              {subStep === "addons" ? (
                <button
                  type="button"
                  onClick={() => setSubStep("professional")}
                  className="px-5 py-2.5 rounded-lg bg-[#1C1B1C] hover:bg-black text-white text-sm font-medium cursor-pointer"
                >
                  Continue
                </button>
              ) : subStep === "professional" ? (
                <button
                  type="button"
                  disabled={!selectedProfessional}
                  onClick={() => setSubStep("time")}
                  className="px-5 py-2.5 rounded-lg bg-[#1C1B1C] hover:bg-black text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!selectedSlot || redeemMutation.isPending || confirming3ds}
                  onClick={() => void handleConfirm()}
                  className="px-5 py-2.5 rounded-lg bg-[#1C1B1C] hover:bg-black text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirming3ds
                    ? "Confirming payment…"
                    : redeemMutation.isPending
                      ? "Booking…"
                      : "Confirm session"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
