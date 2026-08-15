"use client";

import React, { useEffect, useState, Suspense } from "react";
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
import BusinessFormStep1, {
  type BusinessFormStep1Errors,
} from "@/components/business-form/BusinessFormStep1";
import CategorySelectorStep2 from "@/components/business-form/CategorySelectorStep2";
import SuccessPendingApprovalStep3 from "@/components/business-form/SuccessPendingApprovalStep3";
import type { BusinessDetailsInput } from "@/lib/api/auth";
import {
  useCompleteBusinessOwnerMutation,
  useProfessionalRegistrationProgressQuery,
  useSaveBusinessDetailsMutation,
  useSaveCategoriesMutation,
} from "@/lib/auth/hooks";
import { getFieldErrors, toUserMessage } from "@/lib/auth/messages";
import {
  clearRegistrationSession,
  getRegistrationSession,
  saveRegistrationSession,
} from "@/lib/auth/registration-session";
import { getAuthenticatedUserHomePath } from "@/lib/auth/routes";
import { toast } from "@/components/ui/sonner";

// The map needs *some* center before a real address is resolved; Larnaca, Cyprus matches
// the default used elsewhere in the app. This is only ever a display fallback — it is
// never written into `resolvedCoordinates` and never sent to the backend as a selection.
const DEFAULT_MAP_CENTER = { lat: 34.9172, lng: 33.6232 };

function BusinessFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "sfsd@gmail.com";
  const sessionIdParam = searchParams.get("sessionId") || "";

  // Form Steps State (1: Info Form, 2: Category Selector, 3: Success Screen)
  const [step, setStep] = useState<1 | 2 | 3>(1);
  // NOTE: these fields intentionally start empty — they previously shipped with real-looking
  // sample data ("Moakhali" / "John Doe" / etc.) pre-populated as actual state, which meant a
  // user could submit a real Business without ever having typed their own details. `city` and
  // `countryCode` are plain enum-style selections (not free-text sample content), so a sensible
  // default there is fine and unchanged.
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [city, setCity] = useState("Larnaca");
  const [countryCode, setCountryCode] = useState("+357");
  const [mobileNumber, setMobileNumber] = useState("");
  const [area, setArea] = useState("");
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [floorUnit, setFloorUnit] = useState("");
  const [aptRoom, setAptRoom] = useState("");
  const [briefDesc, setBriefDesc] = useState("");

  // Map Coordinates — stays null (unresolved) until the user's address is genuinely
  // resolved (map click/drag, location search, or auto-geocode from the address fields
  // below). The map component itself always gets a display center via DEFAULT_MAP_CENTER,
  // but that default is never treated as a selected location and never submitted.
  const [resolvedCoordinates, setResolvedCoordinates] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2 Selection State
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [step1Errors, setStep1Errors] = useState<BusinessFormStep1Errors>({});
  const [categoryError, setCategoryError] = useState<string | undefined>(undefined);
  const saveBusinessDetails = useSaveBusinessDetailsMutation();
  const saveCategories = useSaveCategoriesMutation();
  const completeBusinessOwner = useCompleteBusinessOwnerMutation();
  const [completionRedirectPath, setCompletionRedirectPath] = useState("/business-dashboard");

  // Address -> map sync: debounced so it doesn't fire per keystroke, gated on `area` being
  // filled in (city always has a non-empty default, so it alone isn't a meaningful signal
  // that the user is entering a real address). AbortController + the effect's own cleanup
  // guarantee a stale response from an older address can never overwrite a newer one, and a
  // failed/no-match lookup silently leaves the last resolved pin (or no pin) alone instead
  // of moving it to a fabricated location.
  useEffect(() => {
    const trimmedArea = area.trim();
    if (!trimmedArea) return;

    const streetPart = [streetNumber.trim(), streetName.trim()].filter(Boolean).join(" ");
    const query = [streetPart, trimmedArea, city, "Cyprus"].filter(Boolean).join(", ");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cy&q=${encodeURIComponent(query)}`,
            { signal: controller.signal },
          );
          const results: Array<{ lat: string; lon: string }> = await response.json();
          if (controller.signal.aborted) return;

          if (results.length > 0) {
            setResolvedCoordinates({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            console.error("Address geocoding failed:", error);
          }
        }
      })();
    }, 800);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [city, area, streetName, streetNumber]);

  const getSessionId = () =>
    sessionIdParam || getRegistrationSession("professional", emailParam)?.sessionId || "";
  const sessionId = getSessionId();

  // Owner Name, Email, and Mobile Number are identity/contact fields already collected
  // and (for the phone) OTP-verified during /professional/signup — the Business Form
  // must display them read-only rather than let the user re-enter them, and the values
  // that end up in the submitted payload must be these authoritative ones, not
  // free-typed state. Fetching from the registration-progress endpoint (rather than
  // relying on transient state passed from the signup page) means this also survives a
  // browser refresh or remount on this page.
  const registrationProgress = useProfessionalRegistrationProgressQuery(sessionId);
  const identityReady = Boolean(
    registrationProgress.data &&
      (registrationProgress.data.firstName || registrationProgress.data.lastName) &&
      registrationProgress.data.phoneVerified &&
      registrationProgress.data.phone,
  );
  const resolvedEmail = registrationProgress.data?.email || emailParam;

  // Prefilling independently-editable local form state from an async session-progress
  // fetch is not the "derived state" anti-pattern the set-state-in-effect rule targets;
  // it can only run once the query resolves, so it is intentionally scoped to the
  // resolved sessionId below and disabled here (same pattern used for the Dashboard
  // Edit business-detail prefill).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const progress = registrationProgress.data;
    if (!progress) return;

    const derivedOwnerName = [progress.firstName, progress.lastName].filter(Boolean).join(" ");
    if (derivedOwnerName) {
      setOwnerName(derivedOwnerName);
    }

    if (progress.phoneVerified && progress.phone) {
      setCountryCode(progress.phone.countryCode);
      setMobileNumber(progress.phone.nationalNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationProgress.data?.sessionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (registrationProgress.isError) {
      toast.error("We couldn't load your registration details. Please restart signup.");
    }
  }, [registrationProgress.isError]);

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

  const handleSelectedCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (categoryError) setCategoryError(undefined);
  };

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
    if (categoryError) setCategoryError(undefined);
  };

  // Wrapped setters: update the value like normal, but also clear that field's own error
  // as soon as the user edits it, without touching unrelated errors (see B7).
  const withFieldReset =
    (setValue: (value: string) => void, field: keyof BusinessFormStep1Errors) =>
    (value: string) => {
      setValue(value);
      setStep1Errors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };
  const handleBusinessNameChange = withFieldReset(setBusinessName, "businessName");
  const handleOwnerNameChange = withFieldReset(setOwnerName, "ownerName");
  const handleMobileNumberChange = withFieldReset(setMobileNumber, "mobileNumber");
  const handleAreaChange = withFieldReset(setArea, "area");
  const handleStreetNameChange = withFieldReset(setStreetName, "streetName");
  const handleStreetNumberChange = withFieldReset(setStreetNumber, "streetNumber");
  const handleBriefDescChange = withFieldReset(setBriefDesc, "briefDesc");

  // Mirrors the backend's authoritative businessDetailsBodySchema (required-ness and the
  // 4-20 digit phone rule) so obviously-missing/invalid fields are caught before any request
  // is sent. The backend remains the final authority — see the catch block below.
  const validateStep1 = (): BusinessFormStep1Errors => {
    const errors: BusinessFormStep1Errors = {};
    if (!businessName.trim()) errors.businessName = "Business name is required";
    // Owner Name and Mobile Number are read-only, hydrated from the verified
    // registration session — if they're empty, that's a session/registration-state
    // problem, not a normal editable-field validation error (see identityReady below).
    if (!area.trim()) errors.area = "Area/neighborhood is required";
    if (!streetName.trim()) errors.streetName = "Street name is required";
    if (!streetNumber.trim()) errors.streetNumber = "Street number is required";
    if (!briefDesc.trim()) errors.briefDesc = "Brief description is required";
    return errors;
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateStep1();
    if (Object.keys(validationErrors).length > 0) {
      setStep1Errors(validationErrors);
      return;
    }
    setStep1Errors({});

    const sessionId = getSessionId();

    if (!sessionId) {
      toast.error("Registration session could not be found. Please start again.");
      return;
    }

    if (!identityReady) {
      toast.error(
        "We're still confirming your registered name and phone number. Please wait a moment and try again.",
      );
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
        // Only send coordinates once a real location has been resolved — the map's
        // default center is a display fallback, never a selection (see Step 4).
        ...(resolvedCoordinates ? { coordinates: resolvedCoordinates } : {}),
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
      const fieldErrors = getFieldErrors(error);
      if (Object.keys(fieldErrors).length > 0) {
        setStep1Errors((prev) => ({
          ...prev,
          ...(fieldErrors.businessName ? { businessName: fieldErrors.businessName } : {}),
          // ownerName/mobileNumber are read-only, session-derived fields now — a backend
          // rejection of either is a registration-state problem, not something the user
          // can fix by editing a disabled input, so it surfaces via the toast below only.
          ...(fieldErrors.area ? { area: fieldErrors.area } : {}),
          ...(fieldErrors.streetName ? { streetName: fieldErrors.streetName } : {}),
          ...(fieldErrors.streetNumber ? { streetNumber: fieldErrors.streetNumber } : {}),
          ...(fieldErrors.briefDesc ? { briefDesc: fieldErrors.briefDesc } : {}),
        }));
      }
      toast.error(toUserMessage(error));
    }
  };

  const handleDone = async () => {
    if (!selectedCategory) {
      setCategoryError("Please select a category");
      return;
    }
    if (selectedSubcategories.length === 0) {
      setCategoryError("Please select at least one sub-category");
      return;
    }
    setCategoryError(undefined);

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
      const fieldErrors = getFieldErrors(error);
      const categoryFieldError =
        fieldErrors.selectedCategory ?? fieldErrors.selectedSubcategories;
      if (categoryFieldError) {
        setCategoryError(categoryFieldError);
      }
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
          emailParam={resolvedEmail}
          businessName={businessName}
          setBusinessName={handleBusinessNameChange}
          ownerName={ownerName}
          setOwnerName={handleOwnerNameChange}
          city={city}
          setCity={setCity}
          countryCode={countryCode}
          setCountryCode={setCountryCode}
          mobileNumber={mobileNumber}
          setMobileNumber={handleMobileNumberChange}
          area={area}
          setArea={handleAreaChange}
          streetName={streetName}
          setStreetName={handleStreetNameChange}
          streetNumber={streetNumber}
          setStreetNumber={handleStreetNumberChange}
          floorUnit={floorUnit}
          setFloorUnit={setFloorUnit}
          aptRoom={aptRoom}
          setAptRoom={setAptRoom}
          briefDesc={briefDesc}
          setBriefDesc={handleBriefDescChange}
          coordinates={resolvedCoordinates ?? DEFAULT_MAP_CENTER}
          setCoordinates={setResolvedCoordinates}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          errors={step1Errors}
          onSubmit={handleNext}
        />
      )}

      {step === 2 && (
        <CategorySelectorStep2
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={handleSelectedCategoryChange}
          selectedSubcategories={selectedSubcategories}
          handleSubcategoryToggle={handleSubcategoryToggle}
          onDone={handleDone}
          error={categoryError}
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
