"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building03Icon, Car01Icon } from "@hugeicons/core-free-icons";

// Components
import AuthLayout from "@/components/auth/AuthLayout";
import RoleCard from "@/components/select-role/RoleCard";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import type { VisitType } from "@/lib/api/auth";
import { useProfessionalRegistrationProgressQuery, useSaveProfessionalVisitTypeMutation } from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { professionalResumeRoute } from "@/lib/auth/resume-routing";
import { getRegistrationSession, saveRegistrationSession } from "@/lib/auth/registration-session";

type LocalVisitType = "location" | "travel";

const toBackendVisitType = (visitType: LocalVisitType): VisitType =>
  visitType === "location" ? "AT_BUSINESS_LOCATION" : "TRAVEL_TO_CUSTOMER";

// The session can carry either the canonical backend value or the short alias (legacy sessions,
// or a value round-tripped through sessionStorage) — normalize either to the local card selection.
const toLocalVisitType = (value: string | undefined): LocalVisitType | null => {
  if (value === "AT_BUSINESS_LOCATION" || value === "location") return "location";
  if (value === "TRAVEL_TO_CUSTOMER" || value === "travel") return "travel";
  return null;
};

function ProfessionalVisitTypeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const sessionIdParam = searchParams.get("sessionId") || "";

  const sessionId =
    sessionIdParam || getRegistrationSession("professional", emailParam)?.sessionId || "";

  const registrationProgress = useProfessionalRegistrationProgressQuery(sessionId);
  const saveVisitType = useSaveProfessionalVisitTypeMutation();

  const [selectedType, setSelectedType] = useState<LocalVisitType | null>(null);
  const [hasAppliedExisting, setHasAppliedExisting] = useState(false);

  // Preserve an already-saved visit type on resume (legacy in-flight session, or the user
  // re-entering after confirming this step already) — pre-select it, never silently overwrite.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const progress = registrationProgress.data;
    if (!progress || hasAppliedExisting) return;
    const existing = toLocalVisitType(progress.businessVisitType);
    if (existing) {
      setSelectedType(existing);
    }
    setHasAppliedExisting(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationProgress.data?.sessionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // This step is only valid once phone verification is complete (or already confirmed once,
  // for an idempotent resubmit/resume). Any other currentStep means the session belongs
  // somewhere earlier or later in onboarding — send it to the right page instead of asking
  // for a visit type it isn't ready for (or has already moved past).
  useEffect(() => {
    const progress = registrationProgress.data;
    if (!progress) return;
    if (progress.currentStep === "PHONE_VERIFIED" || progress.currentStep === "VISIT_TYPE_SELECTED") {
      return;
    }
    router.replace(
      professionalResumeRoute(progress.currentStep, { email: emailParam, sessionId }),
    );
  }, [registrationProgress.data, router, emailParam, sessionId]);

  useEffect(() => {
    if (registrationProgress.isError) {
      toast.error("We couldn't load your registration details. Please restart signup.");
    }
  }, [registrationProgress.isError]);

  const handleContinue = async () => {
    if (!selectedType) return;

    if (!sessionId) {
      toast.error("Registration session could not be found. Please start again.");
      return;
    }

    try {
      await saveVisitType.mutateAsync({
        sessionId,
        visitType: toBackendVisitType(selectedType),
      });
      saveRegistrationSession({
        portal: "professional",
        email: emailParam,
        sessionId,
        currentStep: "VISIT_TYPE_SELECTED",
        visitType: toBackendVisitType(selectedType),
      });
      router.push(
        `/professional/business-form?email=${encodeURIComponent(emailParam)}&sessionId=${encodeURIComponent(sessionId)}`,
      );
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  return (
    <AuthLayout
      onBack={() =>
        router.push(
          `/professional/signup?email=${encodeURIComponent(emailParam)}&sessionId=${encodeURIComponent(sessionId)}`,
        )
      }
      imageSrc="/img/authImg3.png"
    >
      <div className="w-full max-w-[818px] flex flex-col items-center">
        {/* Header info */}
        <div className="w-full text-left mb-8 px-4 md:px-0">
          <h1 className="text-[28px] md:text-[32px] font-bold text-[#1A1A1A] mt-1 mb-2">
            How do customer visit you?
          </h1>
          <p className="text-sm text-[#707070]">
            This helps us set up your booking flow correctly
          </p>
        </div>

        {/* Visit Options */}
        <div className="flex flex-col gap-4 w-full px-4 md:px-0">
          <RoleCard
            title="I welcome customer at my location"
            description="Salon, barber, studio, spa, etc."
            icon={<HugeiconsIcon icon={Building03Icon} size={28} />}
            selected={selectedType === "location"}
            onClick={() => setSelectedType("location")}
          />
          <RoleCard
            title="I travel to my customers"
            description="Mobile groomer, photographer, DJ, home visits, etc."
            icon={<HugeiconsIcon icon={Car01Icon} size={28} />}
            selected={selectedType === "travel"}
            onClick={() => setSelectedType("travel")}
          />
        </div>

        {/* Continue button */}
        <div className="w-full max-w-[818px] mt-8 px-4 md:px-0">
          <button
            onClick={handleContinue}
            disabled={!selectedType || saveVisitType.isPending}
            className="w-full h-12 bg-[#1A1A1A] hover:bg-black text-white font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.05)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveVisitType.isPending ? <Spinner className="text-white" /> : "Continue"}
          </button>
        </div>

        {/* Footer trouble support */}
        <div className="text-center mt-8">
          <p className="text-sm text-[#707070]">
            Having trouble?{" "}
            <a
              href="#"
              className="font-semibold text-[#240183] hover:underline"
              onClick={(e) => {
                e.preventDefault();
                router.push("/contact-support");
              }}
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function ProfessionalVisitTypePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#240183] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-[#707070] font-medium">Loading...</p>
          </div>
        </div>
      }
    >
      <ProfessionalVisitTypeContent />
    </Suspense>
  );
}
