"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import {
  WellnessIcon,
  HealtcareIcon,
  FootballIcon,
  SailboatOffshoreIcon,
  PartyIcon,
  Car04Icon,
} from "@hugeicons/core-free-icons";
import BusinessFormStep1 from "@/components/business-form/BusinessFormStep1";
import CategorySelectorStep2 from "@/components/business-form/CategorySelectorStep2";
import SuccessPendingApprovalStep3 from "@/components/business-form/SuccessPendingApprovalStep3";
import type { BusinessDetailsInput } from "@/lib/api/auth";
import {
  useCompleteBusinessOwnerMutation,
  useSaveBusinessDetailsMutation,
  useSaveCategoriesMutation,
} from "@/lib/auth/hooks";
import { toUserMessage } from "@/lib/auth/messages";
import {
  clearRegistrationSession,
  getRegistrationSession,
  saveRegistrationSession,
} from "@/lib/auth/registration-session";
import { getAuthenticatedUserHomePath } from "@/lib/auth/routes";
import { toast } from "@/components/ui/sonner";

function BusinessFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "sfsd@gmail.com";
  const sessionIdParam = searchParams.get("sessionId") || "";

  // Form Steps State (1: Info Form, 2: Category Selector, 3: Success Screen)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [businessName, setBusinessName] = useState("Moakhali");
  const [ownerName, setOwnerName] = useState("John Doe");
  const [city, setCity] = useState("Larnaca");
  const [countryCode, setCountryCode] = useState("+357");
  const [mobileNumber, setMobileNumber] = useState("1234556666");
  const [area, setArea] = useState("Mackenzie, finikoudes");
  const [streetName, setStreetName] = useState("Emrou");
  const [streetNumber, setStreetNumber] = useState("14");
  const [floorUnit, setFloorUnit] = useState("3rd floor");
  const [aptRoom, setAptRoom] = useState("5");
  const [briefDesc, setBriefDesc] = useState("write about your business");

  // Map Coordinates
  const [coordinates, setCoordinates] = useState({ lat: 34.9003, lng: 33.6232 }); // Default to Larnaca/Cyprus area
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2 Selection State
  const [selectedCategory, setSelectedCategory] = useState<string>("Beauty & Wellness");
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(["Beauty & Wellness", "Sports & Activities", "Experience & Tours"]);
  const saveBusinessDetails = useSaveBusinessDetailsMutation();
  const saveCategories = useSaveCategoriesMutation();
  const completeBusinessOwner = useCompleteBusinessOwnerMutation();
  const [completionRedirectPath, setCompletionRedirectPath] = useState("/business-dashboard");

  const getSessionId = () =>
    sessionIdParam || getRegistrationSession("professional", emailParam)?.sessionId || "";

  // Category Configuration
  const categories = [
    { name: "Beauty & Wellness", label: "beauty & Wellness", icon: WellnessIcon, containerWidth: "w-[186px]", textWidth: "w-[150px]" },
    { name: "Health & Fitness", label: "Health & Fitness", icon: HealtcareIcon, containerWidth: "w-[169px]", textWidth: "w-[133px]" },
    { name: "Sports & Activities", label: "Sports & Activities", icon: FootballIcon, containerWidth: "w-[193px]", textWidth: "w-[157px]" },
    { name: "Experience & Tours", label: "Experience & Tours", icon: SailboatOffshoreIcon, containerWidth: "w-[193px]", textWidth: "w-[157px]" },
    { name: "Entertainment & Events", label: "Entertainment & Events", icon: PartyIcon, containerWidth: "w-[231px]", textWidth: "w-[195px]" },
    { name: "Pets & Home", label: "pets & home", icon: null, containerWidth: "w-[134px]", textWidth: "w-[98px]" },
    { name: "Automotive", label: "automotive", icon: Car04Icon, containerWidth: "w-[133px]", textWidth: "w-[97px]" },
  ];

  const handleSubcategoryToggle = (sub: string) => {
    if (selectedSubcategories.includes(sub)) {
      setSelectedSubcategories(selectedSubcategories.filter((s) => s !== sub));
    } else {
      if (selectedSubcategories.length >= 5) {
        alert("You can select up to 5 sub-categories.");
        return;
      }
      setSelectedSubcategories([...selectedSubcategories, sub]);
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const sessionId = getSessionId();

    if (!sessionId) {
      toast.error("Registration session could not be found. Please start again.");
      return;
    }

    try {
      await saveBusinessDetails.mutateAsync({
        sessionId,
        businessName,
        ownerName,
        city: city as BusinessDetailsInput["city"],
        countryCode,
        mobileNumber,
        area,
        streetName,
        streetNumber,
        floorUnit,
        aptRoom,
        briefDesc,
        coordinates,
        searchQuery,
      });
      const registration = getRegistrationSession("professional", emailParam);
      saveRegistrationSession({
        portal: "professional",
        email: emailParam,
        sessionId,
        currentStep: "BUSINESS_DETAILS_SUBMITTED",
        visitType: registration?.visitType,
      });
      setStep(2);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  const handleDone = async () => {
    const sessionId = getSessionId();

    if (!sessionId) {
      toast.error("Registration session could not be found. Please start again.");
      return;
    }

    try {
      await saveCategories.mutateAsync({
        sessionId,
        selectedCategory,
        selectedSubcategories,
      });
      const auth = await completeBusinessOwner.mutateAsync(sessionId);
      setCompletionRedirectPath(getAuthenticatedUserHomePath(auth.user));
      clearRegistrationSession();
      setStep(3);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  const handleGoToDashboard = () => {
    router.push(completionRedirectPath);
  };

  return (
    <div className="min-h-screen bg-[#FCFAF9] font-poppins relative flex items-center justify-center py-10 px-4 md:px-0">
      {/* Back Button (Top Left) on Screen 2 */}
      {step === 2 && (
        <button
          onClick={() => setStep(1)}
          className="absolute top-4 left-4 md:top-[68px] md:left-[24px] w-[50px] h-[50px] md:w-[68px] md:h-[68px] bg-white rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 z-30"
        >
          <HugeiconsIcon
            icon={ArrowLeft02Icon}
            className="text-[#111111] w-6 h-6 md:w-8 md:h-8"
          />
        </button>
      )}

      {step === 1 && (
        <BusinessFormStep1
          emailParam={emailParam}
          businessName={businessName}
          setBusinessName={setBusinessName}
          ownerName={ownerName}
          setOwnerName={setOwnerName}
          city={city}
          setCity={setCity}
          countryCode={countryCode}
          setCountryCode={setCountryCode}
          mobileNumber={mobileNumber}
          setMobileNumber={setMobileNumber}
          area={area}
          setArea={setArea}
          streetName={streetName}
          setStreetName={setStreetName}
          streetNumber={streetNumber}
          setStreetNumber={setStreetNumber}
          floorUnit={floorUnit}
          setFloorUnit={setFloorUnit}
          aptRoom={aptRoom}
          setAptRoom={setAptRoom}
          briefDesc={briefDesc}
          setBriefDesc={setBriefDesc}
          coordinates={coordinates}
          setCoordinates={setCoordinates}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSubmit={handleNext}
        />
      )}

      {step === 2 && (
        <CategorySelectorStep2
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedSubcategories={selectedSubcategories}
          handleSubcategoryToggle={handleSubcategoryToggle}
          onDone={handleDone}
        />
      )}

      {step === 3 && (
        <SuccessPendingApprovalStep3
          onGoToDashboard={handleGoToDashboard}
        />
      )}
    </div>
  );
}

export default function BusinessFormPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#8EBAC5] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-[#4D4D4D] font-medium">Loading form...</p>
        </div>
      </div>
    }>
      <BusinessFormContent />
    </Suspense>
  );
}
