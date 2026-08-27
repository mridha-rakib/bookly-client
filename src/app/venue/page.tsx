"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Clock04Icon, Location05Icon, SquareLock01Icon, InformationCircleIcon, Cancel01Icon, FavouriteIcon } from "@hugeicons/core-free-icons";
import ServiceCard, { Recommendation } from "@/components/ServiceCard";
import Carousel from "@/components/landing-page/Carousel";
import AddonsStep from "./components/AddonsStep";
import ProfessionalsStep from "./components/ProfessionalsStep";
import TimeStep from "./components/TimeStep";
import PaymentStep from "./components/PaymentStep";
import ConfirmedStep from "./components/ConfirmedStep";
import CheckoutSummaryAside from "./components/CheckoutSummaryAside";

import { Suspense } from "react";

import { useAuthStore } from "@/lib/auth/store";
import { useBusinessCatalogQuery, useServiceAddonsQuery, useServiceAvailabilityQuery } from "@/lib/catalog/hooks";
import { ANY_STAFF, type AvailabilitySlot, type CatalogService } from "@/lib/api/catalog";
import {
  useFinalizeCustomerBookingMutation,
  usePreviewCustomerBookingMutation,
} from "@/lib/bookings/hooks";
import type { BookingDetail, CreateBookingInput } from "@/lib/api/bookings";
import { getStripe } from "@/lib/payments/stripe-client";
import { formatBookingMoney } from "@/lib/bookings/format";
import { toUserMessage } from "@/lib/auth/messages";
import { useBusinessRatingSummaryQuery, useBusinessReviewsQuery } from "@/lib/review/hooks";
import { formatTime12Hour } from "@/lib/staff/format";
import {
  useAddFavoriteMutation,
  useFavoriteIdsQuery,
  useRemoveFavoriteMutation,
} from "@/lib/favorite/hooks";

function VenueDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const venueId = searchParams.get("id") || "1";

  // Real customer auth identity — no local demo toggle.
  const authUser = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const isLoggedIn = authStatus === "authenticated" && authUser?.role === "CUSTOMER";

  // Real Business + Service catalog (Batch 9) — replaces mockVenueDetails' hardcoded services.
  const catalogQuery = useBusinessCatalogQuery(venueId);

  // Batch 17 — real Business profile (name/phone/address/category/about/open-status/hours/
  // media) + real Staff team, replacing every remaining mockVenueDetails.* field on this page.
  // `business` is undefined while catalogQuery is loading/erroring — every read below falls
  // back to an empty/neutral value rather than fabricating a placeholder venue.
  const business = catalogQuery.data?.business;
  const venueLocationText = business ? `${business.address.area}, ${business.address.city}` : "";
  const venueMedia = business?.media ?? [];
  const heroImages = venueMedia.map((item) => item.url);
  const teamMembers = catalogQuery.data?.staff ?? [];

  // Batch 14 — real Business rating summary + public Reviews list, replacing
  // mockVenueDetails.rating/reviewsCount/reviews (see this file's own history).
  const [reviewsLimit, setReviewsLimit] = useState(5);
  const ratingSummaryQuery = useBusinessRatingSummaryQuery(venueId);
  const reviewsQuery = useBusinessReviewsQuery(venueId, { page: 1, limit: reviewsLimit });

  // Real Favorites — same wiring as /explore (useFavoriteIdsQuery/useAddFavoriteMutation/
  // useRemoveFavoriteMutation). Personalized state, so it only loads for a logged-in CUSTOMER;
  // a logged-out visitor tapping the heart is sent to the customer auth flow (never a
  // local-only toggle).
  const favoriteIdsQuery = useFavoriteIdsQuery(isLoggedIn);
  const addFavoriteMutation = useAddFavoriteMutation();
  const removeFavoriteMutation = useRemoveFavoriteMutation();
  const isFavorite = (favoriteIdsQuery.data?.businessIds ?? []).includes(venueId);

  // A logged-out visitor may browse the whole venue page, but any action that starts a booking
  // (or favouriting) requires a customer account. Stash where to come back to, then hand off to
  // the existing `/customer` login/register flow — the password page reads this back on success.
  const goToCustomerAuth = (returnTo: string) => {
    try {
      if (returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        sessionStorage.setItem("bookly:post_login_redirect", returnTo);
      }
    } catch {
      // sessionStorage unavailable (private mode / disabled) — the login flow simply lands the
      // user on the home page afterwards instead of returning here. Never block the hand-off.
    }
    router.push("/customer");
  };

  // Booking Wizard Steps States
  const [bookingStep, setBookingStep] = useState<"addons" | "professionals" | "time" | "payment" | "confirmed" | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const [pricingInputByService, setPricingInputByService] = useState<Record<string, { hours?: number; personCount?: number }>>({});
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateIso, setSelectedDateIso] = useState<string | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | undefined>(undefined);
  const [hasSavedCard, setHasSavedCard] = useState(false);
  const [isReplacingCard, setIsReplacingCard] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [bookingNotes, setBookingNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | undefined>(undefined);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingDetail | undefined>(undefined);
  const [confirming3ds, setConfirming3ds] = useState(false);
  const [walletError, setWalletError] = useState<string | undefined>(undefined);

  const selectedService = catalogQuery.data?.services.find((s) => s.id === selectedServiceId);
  const eligibleStaff = (catalogQuery.data?.staff ?? []).filter((member) =>
    selectedService?.assignedStaffMembershipIds.includes(member.id),
  );

  const serviceAddonsQuery = useServiceAddonsQuery(venueId, selectedServiceId);

  const availabilityFromDate = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}-01`;
  const availabilityToDateObj = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
  const availabilityToDate = `${availabilityToDateObj.getFullYear()}-${String(availabilityToDateObj.getMonth() + 1).padStart(2, "0")}-${String(availabilityToDateObj.getDate()).padStart(2, "0")}`;
  const availabilityQuery = useServiceAvailabilityQuery(
    venueId,
    selectedServiceId,
    bookingStep === "time" || bookingStep === "payment"
      ? {
          fromDate: availabilityFromDate,
          toDate: availabilityToDate,
          staffMembershipId: selectedProfessional ?? undefined,
        }
      : undefined,
  );

  const previewMutation = usePreviewCustomerBookingMutation();
  const finalizeMutation = useFinalizeCustomerBookingMutation();
  const preview = previewMutation.data && "financials" in previewMutation.data ? previewMutation.data : undefined;

  // Batch 13 — Promo Code. `appliedPromoCode` is the server-CONFIRMED code (only set after a
  // successful preview resolves it); `promoCodeInput` is the raw, uncommitted text field.
  // `promoCodeOverride: null` means "explicitly no promo" (used when removing); `undefined`
  // means "use whatever's currently applied" (the default, automatic-revalidation path).
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | undefined>(undefined);
  const [promoStatus, setPromoStatus] = useState<"idle" | "applying" | "applied" | "error">("idle");
  const [promoErrorMessage, setPromoErrorMessage] = useState<string | undefined>(undefined);

  const buildBookingInput = (promoCodeOverride?: string | null): CreateBookingInput | undefined => {
    if (!selectedService || !selectedProfessional || !selectedSlot || !idempotencyKey) return undefined;
    const staffMembershipId =
      selectedProfessional === ANY_STAFF ? selectedSlot.eligibleStaffMembershipIds[0] : selectedProfessional;
    if (!staffMembershipId) return undefined;
    const promoCode = promoCodeOverride === null ? undefined : (promoCodeOverride ?? appliedPromoCode);
    return {
      serviceLines: [
        {
          serviceId: selectedService.id,
          staffMembershipId,
          addonIds: selectedAddonIds,
          pricingInput: pricingInputByService[selectedService.id] ?? {},
        },
      ],
      startAt: selectedSlot.startAt,
      notes: bookingNotes || undefined,
      idempotencyKey,
      promoCode,
    };
  };

  // Recompute the real, server-trusted quote whenever the customer's selections (or the applied
  // Promo Code) change enough to affect price — never trust a client-computed total (rule #1/#14).
  // Section 26: this also re-validates the applied promo from scratch on every dependency change,
  // never trusting a stale preview snapshot.
  useEffect(() => {
    if (bookingStep !== "time" && bookingStep !== "payment") return;
    const input = buildBookingInput();
    if (!input) return;
    previewMutation.mutate(
      { businessId: venueId, input },
      {
        onError: () => {
          // Section 26 self-heal: if the applied promo became invalid mid-flow (e.g. usage
          // exhausted by another customer, or the code was deactivated), never leave the
          // customer stuck on a dead summary — drop it and re-quote without it.
          if (appliedPromoCode) {
            setAppliedPromoCode(undefined);
            setPromoCodeInput("");
            setPromoStatus("error");
            setPromoErrorMessage("Your promo code is no longer valid and was removed.");
            previewMutation.mutate({ businessId: venueId, input: { ...input, promoCode: undefined } });
          }
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingStep, selectedServiceId, selectedAddonIds.join(","), selectedProfessional, selectedSlot?.startAt, appliedPromoCode]);

  const handleApplyPromo = async () => {
    const code = promoCodeInput.trim();
    if (!code) return;
    const input = buildBookingInput(code);
    if (!input) return;
    setPromoStatus("applying");
    setPromoErrorMessage(undefined);
    try {
      const result = await previewMutation.mutateAsync({ businessId: venueId, input });
      if ("financials" in result && result.promo) {
        setAppliedPromoCode(code);
        setPromoStatus("applied");
      } else {
        setPromoStatus("error");
        setPromoErrorMessage("This code isn't valid for this booking.");
      }
    } catch (error) {
      setPromoStatus("error");
      setPromoErrorMessage(toUserMessage(error));
      // Restore the base (no-promo) summary so checkout stays usable after a failed attempt.
      const fallbackInput = buildBookingInput();
      if (fallbackInput) previewMutation.mutate({ businessId: venueId, input: fallbackInput });
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromoCode(undefined);
    setPromoCodeInput("");
    setPromoStatus("idle");
    setPromoErrorMessage(undefined);
    const input = buildBookingInput(null);
    if (input) previewMutation.mutate({ businessId: venueId, input });
  };

  const handleBookService = (serviceId: string) => {
    // Booking requires a customer account. Send a logged-out visitor to login/register first,
    // preserving the exact business + service they were about to book so the wizard re-opens
    // here on return (the page's own `?serviceId=` pre-select below handles that).
    if (!isLoggedIn) {
      goToCustomerAuth(`/venue?id=${venueId}&serviceId=${serviceId}`);
      return;
    }
    setSelectedServiceId(serviceId);
    setSelectedAddonIds([]);
    setSelectedProfessional(null);
    setSelectedDateIso(undefined);
    setSelectedSlot(undefined);
    setWalletError(undefined);
    setIdempotencyKey(crypto.randomUUID());
    setBookingStep("addons");
  };

  // Batch 16 — Book Again's optional `?serviceId=` pre-selection. Reuses the existing real wizard
  // entry point above unchanged; only pre-opens it if the id is genuinely present in this
  // Business's CURRENT real catalog — an archived/renamed Service simply never matches and the
  // wizard stays closed, degrading silently and truthfully rather than resurrecting stale data.
  // Fires at most once per page load (never re-fires if the customer picks a different Service).
  // Applied during render via a state flag (the "adjusting state" pattern — refs may not be read
  // during render in this codebase's lint config), not inside a useEffect.
  const [hasAppliedServicePreselect, setHasAppliedServicePreselect] = useState(false);
  if (!hasAppliedServicePreselect && catalogQuery.data) {
    setHasAppliedServicePreselect(true);
    const requestedServiceId = searchParams.get("serviceId");
    if (requestedServiceId && isLoggedIn) {
      const exists = catalogQuery.data.services.some((s) => s.id === requestedServiceId);
      if (exists) handleBookService(requestedServiceId);
    }
  }

  const canContinueWizard = (() => {
    if (bookingStep === "addons") return true;
    if (bookingStep === "professionals") return Boolean(selectedProfessional);
    if (bookingStep === "time") return Boolean(selectedSlot);
    if (bookingStep === "payment") return hasSavedCard && Boolean(preview);
    return false;
  })();

  const handleWizardContinue = async () => {
    if (bookingStep === "addons") {
      setBookingStep("professionals");
    } else if (bookingStep === "professionals") {
      setBookingStep("time");
    } else if (bookingStep === "time") {
      setBookingStep("payment");
    } else if (bookingStep === "payment") {
      const input = buildBookingInput();
      if (!input) return;
      setWalletError(undefined);

      // Batch 9 completion pass — a real gap found and fixed here: neither this call nor the
      // 3DS-retry call below had a catch, so a genuine decline, a stale-slot conflict, or any
      // network/API failure threw uncaught inside this handler — the Confirm button quietly
      // re-enabled (React Query resets `isPending` regardless of whether the rejection is
      // awaited) with NO error shown, leaving the customer staring at a dead button. Every
      // finalize call in this flow must always resolve to either a confirmed booking or a
      // visible, real error — never a silent no-op (see spec section 6's own requirement).
      let result: Awaited<ReturnType<typeof finalizeMutation.mutateAsync>>;
      try {
        result = await finalizeMutation.mutateAsync({ businessId: venueId, input });
      } catch (error) {
        setWalletError(toUserMessage(error));
        return;
      }

      if ("clientSecret" in result) {
        // 3DS/SCA required — confirm using the already-attached payment method, then retry the
        // SAME idempotencyKey (see BookingCreationService.finalizeCustomerBooking's own doc
        // comment: this is the confirmed, correct saga, never a second charge).
        setConfirming3ds(true);
        try {
          const stripe = await getStripe();
          if (!stripe) {
            setWalletError("Payment could not be initialized. Please try again.");
            return;
          }
          const confirmResult = await stripe.confirmCardPayment(result.clientSecret);
          if (confirmResult.error) {
            setWalletError(confirmResult.error.message ?? "Payment authentication failed.");
            return;
          }
          const retry = await finalizeMutation.mutateAsync({ businessId: venueId, input });
          if (!("clientSecret" in retry)) {
            setConfirmedBooking(retry);
            setBookingStep("confirmed");
          } else {
            setWalletError("Payment could not be confirmed. Please try again.");
          }
        } catch (error) {
          setWalletError(toUserMessage(error));
        } finally {
          setConfirming3ds(false);
        }
        return;
      }
      setConfirmedBooking(result);
      setBookingStep("confirmed");
    }
  };

  // Lock screen body scroll when bookingStep is active
  React.useEffect(() => {
    if (bookingStep) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [bookingStep]);

  // Tab State
  const [activeTab, setActiveTab] = useState<"services" | "about" | "reviews" | "team" | "gallery">("services");
  const [selectedCategory, setSelectedCategory] = useState("Featured");
  const [isMobile, setIsMobile] = useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint in Tailwind is 1024px
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scroll to section helper
  const scrollToSection = (sectionId: typeof activeTab) => {
    setActiveTab(sectionId);
    setTimeout(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        const offset = 100; // Offset for navbar
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = element.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    }, 100);
  };

  // Scroll listener scroll spy for active tab based on closest section to header threshold
  React.useEffect(() => {
    if (!isMobile) return;

    const handleScroll = () => {
      const sections = ["services", "about", "reviews", "team", "gallery"];
      const threshold = 180; // Offset below viewport top (accounts for navbar + tab navigation height)

      let closestSection = "services";
      let closestDistance = Infinity;

      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Distance from the top of the element to our threshold
          const distance = Math.abs(rect.top - threshold);

          // Section must have started entering the screen or been scrolled past (rect.top <= threshold + margin)
          if (rect.top <= threshold + 200) {
            if (distance < closestDistance) {
              closestDistance = distance;
              closestSection = id;
            }
          }
        }
      }

      setActiveTab(closestSection as typeof activeTab);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check on mount
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  const heroScrollRef = React.useRef<HTMLDivElement>(null);
  const [showLeftHeroArrow, setShowLeftHeroArrow] = useState(false);
  const [showRightHeroArrow, setShowRightHeroArrow] = useState(true);
  const [isMobileSummaryExpanded, setIsMobileSummaryExpanded] = useState(false);
  const [showStickyFooter, setShowStickyFooter] = useState(false);

  React.useEffect(() => {
    if (!isMobile) return;

    const handleScroll = () => {
      const asideEl = document.getElementById("booking-aside");
      if (asideEl) {
        const rect = asideEl.getBoundingClientRect();
        // Show sticky footer if the booking card is scrolled out of viewport
        setShowStickyFooter(rect.height > 0 && rect.bottom < 100);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      setShowStickyFooter(false);
    };
  }, [isMobile]);

  const [showCopiedToast, setShowCopiedToast] = useState(false);

  const handleToggleFavorite = () => {
    if (!isLoggedIn) {
      goToCustomerAuth(`/venue?id=${venueId}`);
      return;
    }
    if (isFavorite) {
      removeFavoriteMutation.mutate(venueId);
    } else {
      addFavoriteMutation.mutate(venueId);
    }
  };
  const [sortBy, setSortBy] = useState<"Latest" | "Highest Rated" | "Lowest Rated">("Latest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const sortedReviews = React.useMemo(() => {
    const list = [...(reviewsQuery.data?.reviews ?? [])];
    if (sortBy === "Highest Rated") {
      return list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "Lowest Rated") {
      return list.sort((a, b) => a.rating - b.rating);
    }
    return list;
  }, [sortBy, reviewsQuery.data]);

  // Mouse Drag States for touch emulation on desktop
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);

  const handleHeroMouseDown = (e: React.MouseEvent) => {
    if (!heroScrollRef.current) return;
    setIsDragActive(true);
    setDragStartX(e.pageX - heroScrollRef.current.offsetLeft);
    setDragScrollLeft(heroScrollRef.current.scrollLeft);
  };

  const handleHeroMouseMove = (e: React.MouseEvent) => {
    if (!isDragActive || !heroScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - heroScrollRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5; // adjust scroll speed
    heroScrollRef.current.scrollLeft = dragScrollLeft - walk;
  };

  const handleHeroMouseUpOrLeave = () => {
    setIsDragActive(false);
  };

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      if (navigator.share) {
        try {
          await navigator.share({
            title: business?.name ?? "Bookly",
            text: business ? `Check out ${business.name} on Bookly` : "Check out this business on Bookly",
            url: window.location.href,
          });
        } catch (err) {
          console.log("Sharing failed", err);
        }
      } else {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setShowCopiedToast(true);
          setTimeout(() => setShowCopiedToast(false), 2000);
        } catch (err) {
          console.error("Clipboard copy failed", err);
        }
      }
    }
  };

  const handleHeroScroll = () => {
    if (!heroScrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = heroScrollRef.current;
    setShowLeftHeroArrow(scrollLeft > 10);
    setShowRightHeroArrow(scrollLeft + clientWidth < scrollWidth - 10);
  };

  const scrollHeroLeft = () => {
    if (!heroScrollRef.current) return;
    const { clientWidth } = heroScrollRef.current;
    heroScrollRef.current.scrollBy({ left: -clientWidth, behavior: "smooth" });
  };

  const scrollHeroRight = () => {
    if (!heroScrollRef.current) return;
    const { clientWidth } = heroScrollRef.current;
    heroScrollRef.current.scrollBy({ left: clientWidth, behavior: "smooth" });
  };

  /** Batch 9 — a single selected Service (one at a time, matching the real booking wizard's own
   * one-service-per-booking flow shown in the Figma reference — never an accumulating
   * multi-service cart, which the backend's own `serviceLines` model supports structurally but
   * this UI never exercised beyond one line). This client-side estimate is DISPLAY ONLY — the
   * moment the wizard opens, the real, server-computed `preview` (via
   * usePreviewCustomerBookingMutation) is the only amount ever shown as authoritative or
   * charged (rule #1/#14: never trust a client-computed total). */
  const estimateServicePriceCents = (service: CatalogService, input: { hours?: number; personCount?: number }): number => {
    if (service.fixedPricing) return service.fixedPricing.priceCents;
    if (service.hourlyPricing) return (input.hours ?? service.hourlyPricing.minHours) * service.hourlyPricing.ratePerHourCents;
    if (service.perPersonPricing) return (input.personCount ?? service.perPersonPricing.minPersons) * service.perPersonPricing.ratePerPersonCents;
    if (service.packagePricing) return service.packagePricing.bundlePriceCents;
    return 0;
  };

  const selectedList = selectedService
    ? [
        {
          id: selectedService.id,
          name: selectedService.name,
          duration:
            selectedService.fixedPricing?.durationMin ?? selectedService.perPersonPricing?.durationMin ?? selectedService.packagePricing?.durationMin
              ? `${selectedService.fixedPricing?.durationMin ?? selectedService.perPersonPricing?.durationMin ?? selectedService.packagePricing?.durationMin} min`
              : "",
          priceVal: estimateServicePriceCents(selectedService, pricingInputByService[selectedService.id] ?? {}) / 100,
          priceText: formatBookingMoney(estimateServicePriceCents(selectedService, pricingInputByService[selectedService.id] ?? {})),
          onRemove: () => setSelectedServiceId(undefined),
        },
      ]
    : [];

  const totalDurationText = selectedList[0]?.duration ?? "";
  const totalPriceText = selectedList[0]?.priceText ?? "€0.00";

  return (
    <div className="min-h-screen bg-[#FCFAF9] flex flex-col relative overflow-x-clip text-[#1C1B1C]">
      {/* Navbar */}
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={() => {}}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-16  pb-24 flex flex-col gap-6 font-poppins">



        {/* Back Arrow button */}
        <button
          onClick={() => router.push("/")}
          className="self-start flex items-center justify-start w-8 h-8 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer text-neutral-800"
          aria-label="Go back"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
        </button>

        {/* 1. Breadcrumbs section */}
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-[#000000] -mt-2">
          <span>Home</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-gray-400" />
          <span>Barbers</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-gray-400" />
          <span>Dubai</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-gray-400" />
          <span>Nad Al Sheba 1</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-gray-400" />
          <span className="font-semibold">{business?.name ?? (catalogQuery.isLoading ? "Loading…" : "")}</span>
        </div>

        {/* 2. Hero Image Banner Section */}
        <div className="w-full relative group">
          {/* Inner Image Container (rounded and overflow-hidden) */}
          <div className="w-full h-[320px] sm:h-[450px] relative rounded-2xl overflow-hidden shadow-md border border-neutral-100">
            <div
              ref={heroScrollRef}
              onScroll={handleHeroScroll}
              onMouseDown={handleHeroMouseDown}
              onMouseMove={handleHeroMouseMove}
              onMouseUp={handleHeroMouseUpOrLeave}
              onMouseLeave={handleHeroMouseUpOrLeave}
              className={`w-full h-full flex flex-nowrap overflow-x-auto scrollbar-hide select-none ${isDragActive ? "cursor-grabbing" : "cursor-grab snap-x snap-mandatory scroll-smooth"
                }`}
            >
              {heroImages.length > 0 ? (
                heroImages.map((img, idx) => (
                  <div key={idx} className="w-full h-full shrink-0 snap-start relative">
                    <Image
                      src={img}
                      alt={`${business?.name ?? "Business"} ${idx + 1}`}
                      fill
                      className="object-cover pointer-events-none"
                      priority={idx === 0}
                    />
                  </div>
                ))
              ) : (
                <div className="w-full h-full shrink-0 snap-start flex flex-col items-center justify-center gap-2 bg-neutral-100 text-neutral-400">
                  <HugeiconsIcon icon={InformationCircleIcon} size={28} />
                  <span className="text-sm font-medium">No photos yet</span>
                </div>
              )}
            </div>
            {/* See all images button */}
            <button
              onClick={() => scrollToSection("gallery")}
              className="absolute right-4 bottom-4 bg-[#FFFFFF] border border-[#D3D3D3] rounded-xl px-4 py-2 flex items-center justify-center gap-1.5 shadow-md hover:bg-neutral-50 transition-colors cursor-pointer z-10 text-[14.2px] font-medium font-inter text-[#0D0D0D]"
            >
              <span>See all images</span>
            </button>
          </div>

          {/* Left Navigation Arrow (Outside) */}
          {showLeftHeroArrow && (
            <button
              onClick={scrollHeroLeft}
              className="absolute -left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-md hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-20 text-neutral-800 border border-neutral-100"
              aria-label="Previous image"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Right Navigation Arrow (Outside) */}
          {showRightHeroArrow && (
            <button
              onClick={scrollHeroRight}
              className="absolute -right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-md hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer opacity-100 sm:opacity-0 group-hover:opacity-100 z-20 text-neutral-800 border border-neutral-100"
              aria-label="Next image"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>

        {/* 3. Salon Header Info (Title, Rating, Category) */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 w-full mt-4">
          <div className="flex flex-col gap-3 max-w-[800px]">
            <h1 className="font-inter font-bold text-[36px] sm:text-[45px] leading-tight text-[#0D0D0D]">
              {business?.name ?? (catalogQuery.isLoading ? "Loading…" : "")}
            </h1>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:text-[15.9px] text-gray-500 font-inter">
              <div className="flex items-center gap-1.5 text-[#0D0D0D] font-semibold">
                {ratingSummaryQuery.data?.averageRating !== null &&
                ratingSummaryQuery.data?.averageRating !== undefined ? (
                  <>
                    <span>{ratingSummaryQuery.data.averageRating.toFixed(1)}</span>
                    <Image src="/Icons/rattingfull.svg" alt="star" className="w-4 h-4 object-contain" width={16} height={16} />
                    <span className="font-normal text-[#757575]">
                      ({ratingSummaryQuery.data.reviewCount} Review{ratingSummaryQuery.data.reviewCount === 1 ? "" : "s"})
                    </span>
                  </>
                ) : (
                  <span className="font-normal text-[#757575]">No reviews yet</span>
                )}
              </div>
              {venueLocationText && (
                <>
                  <span className="text-[#0D0D0D] font-bold">•</span>
                  <div className="flex items-center gap-1">
                    <HugeiconsIcon icon={Location05Icon} />
                    <span className="text-[#767676]">{venueLocationText}</span>
                  </div>
                </>
              )}
              {business?.openStatus.configured && (
                <>
                  <span className="text-[#0D0D0D] font-bold">•</span>
                  <div className="flex items-center gap-1">
                    <HugeiconsIcon icon={Clock04Icon} />
                    <span className="text-[#B7570B] font-medium">{business.openStatus.label}</span>
                  </div>
                </>
              )}
            </div>

            {/* Category tag */}
            {business?.category && (
              <span className="self-start bg-[#D1D1D1] text-[#111111] rounded-xl px-4 py-1.5 text-sm font-semibold tracking-wide">
                {business.category}
              </span>
            )}
          </div>

          {/* Share (Download) and Favorite buttons */}
          <div className="flex items-center gap-3 self-end sm:self-start">
            <button
              onClick={handleShare}
              className="w-12 h-12 rounded-full bg-white border border-[#D3D3D3] flex items-center justify-center shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer text-[#1C1B1C]"
              title="Share / Copy Link"
            >
              <Image src="/Icons/downloadIcon.svg" alt="Download/Share" className="w-5 h-5 object-contain" width={20} height={20} />
            </button>
            <button
              onClick={handleToggleFavorite}
              className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-sm transition-all cursor-pointer ${isFavorite
                ? "bg-[#FFEBEB] border-[#FFC1C1] text-[#DE350B]"
                : "bg-white border-[#D3D3D3] text-[#1C1B1C] hover:bg-neutral-50"
                }`}
              title="Add to Favorites"
            >
              <HugeiconsIcon
                icon={FavouriteIcon}
                className={`w-5 h-5 transition-colors ${isFavorite ? "text-[#DE350B] fill-[#DE350B]" : "text-neutral-800"}`}
              />
            </button>
          </div>
        </div>

        {/* 4. Content Area Layout */}
        <div className="w-full flex flex-col lg:flex-row gap-10 mt-6 relative items-start">

          {/* Left Column (Tabs and Details) */}
          <div className="flex-grow w-full lg:max-w-[868px] flex flex-col gap-8 order-2 lg:order-1">

            {/* Tabs Navigation */}
            <div className={`flex border-b border-[#ACAAB4] w-full justify-between ${isMobile ? "sticky top-0 bg-[#FCFAF9] z-20" : ""}`}>
              {(["services", "about", "reviews", "team", "gallery"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => isMobile ? scrollToSection(tab) : setActiveTab(tab)}
                  className={`py-3 px-1 sm:px-6 text-[11px] xs:text-xs sm:text-[14.8px] font-inter font-semibold transition-all border-b-[4px] capitalize cursor-pointer flex-1 text-center shrink-0 ${activeTab === tab
                    ? "border-[#1C1B1C] text-[#0D0D0D] font-bold"
                    : "border-transparent text-[#757575] hover:text-black"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content renderer */}
            <div className={`w-full ${isMobile ? "flex flex-col gap-12" : ""}`}>
              {(isMobile || activeTab === "services") && (
                <section id="services" className="scroll-mt-24 flex flex-col gap-6">
                  {/* Category Filter Badges */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {["All", "Featured", "Packages", "Hair", "Beard", "Color", "Hair Treatment", "NAILS", "Facial", "Waxing & Trimming"].map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase border transition-all cursor-pointer ${selectedCategory === cat
                          ? "bg-black border-black text-white"
                          : "bg-white border-neutral-200 text-[#4E5F78] hover:bg-neutral-50"
                          }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Services List Card Stack — real Business services (Batch 9), replacing the
                      previous 5 hardcoded "Wedding Pic" mock cards. */}
                  <div className="flex flex-col gap-4">
                    {catalogQuery.isLoading && (
                      <p className="text-sm text-neutral-500">Loading services…</p>
                    )}
                    {catalogQuery.isError && (
                      <p className="text-sm text-red-600">Services could not be loaded right now.</p>
                    )}
                    {!catalogQuery.isLoading && (catalogQuery.data?.services.length ?? 0) === 0 && (
                      <p className="text-sm text-neutral-500">This business has no bookable services yet.</p>
                    )}

                    {(catalogQuery.data?.services ?? [])
                      .filter(
                        (service) =>
                          selectedCategory === "All" ||
                          service.category === selectedCategory ||
                          service.subcategory === selectedCategory ||
                          (selectedCategory === "Featured" && service.isFeatured) ||
                          (selectedCategory === "Packages" && service.isPackageDeal),
                      )
                      .map((service) => {
                        const isActive = selectedServiceId === service.id && bookingStep !== null;
                        const input = pricingInputByService[service.id] ?? {};
                        const priceCents = estimateServicePriceCents(service, input);

                        const durationMin =
                          service.fixedPricing?.durationMin ??
                          service.perPersonPricing?.durationMin ??
                          service.packagePricing?.durationMin;
                        const durationText = durationMin
                          ? durationMin >= 60
                            ? `${Math.floor(durationMin / 60)} hr${durationMin % 60 > 0 ? ` ${durationMin % 60} min` : ""}`
                            : `${durationMin} min`
                          : undefined;

                        return (
                          <div
                            key={service.id}
                            className={`w-full bg-white border rounded-xl p-5 flex justify-between items-center gap-4 shadow-sm transition-all ${isActive ? "border-[#2BB54F]" : "border-[#E5E5E5]"}`}
                          >
                            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                              <h4 className="font-inter font-medium text-lg text-[#0D0D0D]">{service.name}</h4>

                              {service.pricingMode === "HOURLY" && service.hourlyPricing && (
                                <span className="text-sm text-[#767676]">
                                  max {service.hourlyPricing.maxHours} hours • {formatBookingMoney(service.hourlyPricing.ratePerHourCents)} per hour
                                </span>
                              )}
                              {service.pricingMode === "PER_PERSON" && service.perPersonPricing && (
                                <span className="text-sm text-[#767676]">
                                  {durationText ? `${durationText} • ` : ""}
                                  {formatBookingMoney(service.perPersonPricing.ratePerPersonCents)} per person • min {service.perPersonPricing.minPersons} person • max {service.perPersonPricing.maxPersons} person
                                </span>
                              )}
                              {(service.pricingMode === "FIXED" || service.pricingMode === "PACKAGE") && durationText && (
                                <span className="text-sm text-[#767676]">{durationText}</span>
                              )}

                              {service.pricingMode === "HOURLY" && service.hourlyPricing && (
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-sm font-semibold text-[#0d0d0d] font-poppins">Hours</span>
                                  <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden h-[36px] bg-[#FCFAF9]">
                                    <button
                                      onClick={() =>
                                        setPricingInputByService((prev) => ({
                                          ...prev,
                                          [service.id]: {
                                            hours: Math.max((prev[service.id]?.hours ?? service.hourlyPricing!.minHours) - 1, service.hourlyPricing!.minHours),
                                          },
                                        }))
                                      }
                                      className="px-3 hover:bg-neutral-100 font-bold border-r border-neutral-300 text-lg"
                                    >
                                      -
                                    </button>
                                    <span className="px-4 font-semibold font-poppins text-sm text-[#111111]">
                                      {input.hours ?? service.hourlyPricing.minHours}
                                    </span>
                                    <button
                                      onClick={() =>
                                        setPricingInputByService((prev) => ({
                                          ...prev,
                                          [service.id]: {
                                            hours: Math.min((prev[service.id]?.hours ?? service.hourlyPricing!.minHours) + 1, service.hourlyPricing!.maxHours),
                                          },
                                        }))
                                      }
                                      className="px-3 hover:bg-neutral-100 font-bold border-l border-neutral-300 text-lg"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              )}
                              {service.pricingMode === "PER_PERSON" && service.perPersonPricing && (
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-sm font-semibold text-[#0d0d0d] font-poppins">Person</span>
                                  <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden h-[36px] bg-[#FCFAF9]">
                                    <button
                                      onClick={() =>
                                        setPricingInputByService((prev) => ({
                                          ...prev,
                                          [service.id]: {
                                            personCount: Math.max((prev[service.id]?.personCount ?? service.perPersonPricing!.minPersons) - 1, service.perPersonPricing!.minPersons),
                                          },
                                        }))
                                      }
                                      className="px-3 hover:bg-neutral-100 font-bold border-r border-neutral-300 text-lg"
                                    >
                                      -
                                    </button>
                                    <span className="px-4 font-semibold font-poppins text-sm text-[#111111]">
                                      {input.personCount ?? service.perPersonPricing.minPersons}
                                    </span>
                                    <button
                                      onClick={() =>
                                        setPricingInputByService((prev) => ({
                                          ...prev,
                                          [service.id]: {
                                            personCount: Math.min((prev[service.id]?.personCount ?? service.perPersonPricing!.minPersons) + 1, service.perPersonPricing!.maxPersons),
                                          },
                                        }))
                                      }
                                      className="px-3 hover:bg-neutral-100 font-bold border-l border-neutral-300 text-lg"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2 mt-1">
                                <span className="font-semibold text-lg text-[#0D0D0D]">{formatBookingMoney(priceCents)}</span>
                                {(service.fixedPricing?.discountPercent || service.packagePricing?.discountPercent) && (
                                  <span className="line-through text-sm text-gray-400">
                                    {formatBookingMoney(
                                      Math.round(priceCents / (1 - (service.fixedPricing?.discountPercent ?? service.packagePricing?.discountPercent ?? 0) / 100)),
                                    )}
                                  </span>
                                )}
                              </div>
                              {service.description && (
                                <p className="text-xs text-gray-500 font-medium mt-1">{service.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleBookService(service.id)}
                              className={`text-sm font-semibold rounded-full border transition-all cursor-pointer shadow-sm shrink-0 ${isActive
                                ? "bg-[#2BB54F] border-[#2BB54F] text-white w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center p-0 rounded-full aspect-square"
                                : "bg-[#FCFAF9] border-[#B3B3B3] text-[#0D0D0D] hover:bg-neutral-50 px-5 py-2"
                                }`}
                            >
                              {isActive ? (
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : "Book"}
                            </button>
                          </div>
                        );
                      })}

                    {/* See all button */}
                    <button
                      onClick={() => setSelectedCategory("All")}
                      className="self-start bg-[#FFFFFF] border border-[#C6C6CB] rounded-full px-6 py-2.5 text-sm font-semibold hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      See all
                    </button>

                  </div>
                </section>
              )}

              {isMobile && (isMobile || activeTab === "services") && <hr className="border-t border-[#ACAAB4]/30" />}

              {(isMobile || activeTab === "about") && (
                <section id="about" className="scroll-mt-24">
                  <div className="flex flex-col gap-8 font-poppins">
                    <div className="flex flex-col gap-4">
                      <h3 className="font-bold text-2xl text-[#0D0D0D]">About</h3>
                      {catalogQuery.isLoading && (
                        <p className="text-sm text-neutral-500">Loading…</p>
                      )}
                      {!catalogQuery.isLoading && business?.briefDescription && (
                        <p className="text-[#4E5F78] leading-relaxed">
                          {business.briefDescription}
                        </p>
                      )}
                      {!catalogQuery.isLoading && !business?.briefDescription && !catalogQuery.isError && (
                        <p className="text-sm text-neutral-500">No description provided yet.</p>
                      )}
                    </div>

                    {/* Google Maps embed of the real Business address */}
                    {business && (
                      <div className="w-full h-[320px] bg-[#EAE8E4] rounded-xl relative overflow-hidden shadow-inner border border-neutral-200">
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          style={{ border: 0 }}
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(venueLocationText)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                          allowFullScreen
                        />
                        {/* Center Pin overlay */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 pointer-events-none">
                          <div className="bg-[#1C1B1C] text-white px-3 py-1.5 rounded-lg text-xs font-semibold font-poppins shadow-md whitespace-nowrap">
                            {business.name}
                          </div>
                          {/* Down arrow caret */}
                          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#1C1B1C]" />
                        </div>

                        <div className="absolute left-4 bottom-4 bg-[#FFFFFF] border border-[#ACAAB4] rounded-lg p-3 shadow-md">
                          <span className="font-bold text-sm block">{business.name}</span>
                          <span className="text-xs text-[#767676] block">{venueLocationText}</span>
                        </div>
                      </div>
                    )}

                    {/* Opening hours & Additional Info grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                      {/* Opening Times — real Business Hours (business-hours module), surfaced
                          publicly via the catalog read. */}
                      <div className="flex flex-col gap-4">
                        <h4 className="font-bold text-lg text-[#0D0D0D]">Opening times</h4>
                        {business?.hours && business.hours.length > 0 ? (
                          <div className="flex flex-col gap-2.5 text-sm text-[#4E5F78]">
                            {business.hours.map((day) => (
                              <div key={day.dayOfWeek} className="flex justify-between items-center py-1 border-b border-neutral-100">
                                <span className="font-semibold text-black capitalize">{day.dayOfWeek.charAt(0) + day.dayOfWeek.slice(1).toLowerCase()}</span>
                                <span>
                                  {day.isOpen && day.slots.length > 0
                                    ? day.slots.map((slot) => `${formatTime12Hour(slot.startTime)} - ${formatTime12Hour(slot.endTime)}`).join(", ")
                                    : "Closed"}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-neutral-500">Hours not available.</p>
                        )}
                      </div>

                      {/* Additional Information */}
                      <div className="flex flex-col gap-4">
                        <h4 className="font-bold text-lg text-[#0D0D0D]">Additional information</h4>
                        <ul className="flex flex-col gap-4 text-sm text-[#4E5F78]">
                          <li className="flex items-start gap-2.5">
                            <span className="text-[#2BB54F] font-bold">✓</span>
                            <span>Instant Confirmation</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="shrink-0 text-neutral-500 mt-0.5">
                              <HugeiconsIcon icon={InformationCircleIcon} size={18} />
                            </span>
                            <span>First visit? A small deposit (20% of your total, between €5–€35) secures your booking, charged now as a platform booking fee.</span>
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="shrink-0 text-neutral-500 mt-0.5">
                              <HugeiconsIcon icon={InformationCircleIcon} size={18} />
                            </span>
                            <span>Returning customer? The same deposit is charged now and counted toward your total — the rest is paid at the venue.</span>
                          </li>
                        </ul>
                      </div>

                    </div>

                  </div>
                </section>
              )}

              {isMobile && (isMobile || activeTab === "about") && <hr className="border-t border-[#ACAAB4]/30" />}

              {(isMobile || activeTab === "reviews") && (
                <section id="reviews" className="scroll-mt-24">
                  <div className="flex flex-col pt-6 w-full max-w-[862px] font-inter">

                    {/* Reviews Title Row */}
                    <div className="flex flex-wrap justify-between items-baseline w-full mb-3 gap-2">
                      <h3 className="font-semibold text-[25.2px] leading-[36px] text-[#0D0D0D]">
                        Reviews
                      </h3>

                      {/* Sort Selector */}
                      <div className="flex items-center gap-2 h-[28px] relative">
                        <div className="flex items-center justify-center px-2 py-0.5 w-[65px] h-6 rounded-full shrink-0">
                          <span className="font-poppins text-sm text-[#4E5F78]">Sort by</span>
                        </div>
                        <button
                          onClick={() => setShowSortDropdown(!showSortDropdown)}
                          className="flex items-center justify-center gap-1 px-3 py-0.5 min-w-[100px] h-7 border border-[#111111] rounded-full bg-white cursor-pointer hover:bg-neutral-50 transition-colors text-sm font-poppins text-[#111111] relative z-10 whitespace-nowrap"
                        >
                          <span>{sortBy}</span>
                          <svg className="w-4 h-4 text-[#141B34] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {showSortDropdown && (
                          <>
                            {/* Backdrop to close dropdown when clicking outside */}
                            <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                            <div className="absolute right-0 top-8 mt-1 w-[140px] bg-white border border-[#ACAAB4]/40 rounded-xl shadow-lg z-20 overflow-hidden py-1">
                              {(["Latest", "Highest Rated", "Lowest Rated"] as const).map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setSortBy(option);
                                    setShowSortDropdown(false);
                                  }}
                                  className="w-full text-left px-4 py-2 text-xs font-poppins hover:bg-neutral-100 transition-colors text-[#0d0d0d] whitespace-nowrap"
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Rating breakdown details stars row */}
                    {ratingSummaryQuery.data?.averageRating !== null &&
                    ratingSummaryQuery.data?.averageRating !== undefined ? (
                      <div className="flex items-end gap-5 w-[284px] h-[27px] mb-6">
                        <div className="flex items-center gap-3 w-[188px] h-[27px]">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Image
                              key={s}
                              src="/Icons/rattingfull.svg"
                              alt="star"
                              className={`w-[28px] h-[27px] object-contain ${s <= Math.round(ratingSummaryQuery.data?.averageRating ?? 0) ? "" : "opacity-25"}`}
                              width={24}
                              height={24}
                            />
                          ))}
                        </div>
                        <div className="flex items-start gap-1 w-[76px] h-6 font-semibold">
                          <span className="font-inter text-[17px] leading-6 text-[#0D0D0D]">
                            {ratingSummaryQuery.data.averageRating.toFixed(1)}
                          </span>
                          <span className="font-inter text-[17px] leading-6 text-[#6950F3]">
                            ({ratingSummaryQuery.data.reviewCount})
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="font-inter text-sm text-[#767676] mb-6">
                        No reviews yet — be the first to book and leave one.
                      </p>
                    )}

                    {/* Reviews stack */}
                    <div className="flex flex-col py-3 gap-6 w-full">
                      {reviewsQuery.isLoading && (
                        <p className="text-sm text-[#767676] font-inter">Loading reviews...</p>
                      )}
                      {!reviewsQuery.isLoading && sortedReviews.length === 0 && (
                        <p className="text-sm text-[#767676] font-inter">No reviews yet.</p>
                      )}
                      {sortedReviews.map((review) => (
                        <div key={review.id} className="flex flex-col items-start py-5 gap-2 w-full border-b border-neutral-100">

                          {/* Author info row */}
                          <div className="flex items-center gap-2 w-[236.65px] h-16">

                            {/* Avatar Circle Container */}
                            <div className="box-border flex flex-col justify-center items-center p-[0.0667px] w-16 h-16 bg-[#F0F0FF] border border-[#F0F0FF] rounded-full overflow-hidden shrink-0">
                              <span className="font-inter font-semibold text-lg text-[#6950F3]">
                                {review.reviewerDisplayName.charAt(0).toUpperCase()}
                              </span>
                            </div>

                            {/* Author Name and Date details */}
                            <div className="flex flex-col justify-center items-start gap-2 w-[164.65px] h-16">
                              <div className="w-[164.65px] h-10 relative">
                                <span className="absolute left-0 top-0 font-inter font-medium text-[16.5px] leading-6 text-[#0D0D0D] block">
                                  {review.reviewerDisplayName}
                                </span>
                                <span className="absolute left-0 top-6 font-inter font-normal text-xs leading-4 text-[#767676] block whitespace-nowrap">
                                  {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                              </div>

                              {/* Stars row */}
                              <div className="flex items-start gap-1 w-[108px] h-4">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Image
                                    key={s}
                                    src="/Icons/rattingfull.svg"
                                    alt="star"
                                    className={`w-4 h-4 object-contain ${s <= review.rating ? "" : "opacity-25"}`}
                                    width={16}
                                    height={16}
                                  />
                                ))}
                              </div>
                            </div>

                          </div>

                          {/* Review text comment */}
                          {review.comment && (
                            <div className="flex flex-col items-start w-full mt-1.5">
                              <p className="w-full font-inter font-normal text-[16.3px] leading-6 text-[#0D0D0D]">
                                {review.comment}
                              </p>
                            </div>
                          )}

                        </div>
                      ))}
                    </div>

                    {/* See all button */}
                    {(reviewsQuery.data?.pagination.total ?? 0) > sortedReviews.length && (
                      <div className="flex flex-col items-start w-full h-12 mt-6">
                        <button
                          onClick={() => setReviewsLimit((limit) => limit + 20)}
                          className="box-border flex items-center justify-center px-5 py-2.5 h-12 bg-white border border-[#D3D3D3] rounded-full hover:bg-neutral-50 transition-colors shadow-sm cursor-pointer"
                        >
                          <span className="font-inter font-semibold text-[16.3px] text-[#0D0D0D] whitespace-nowrap">
                            See all
                          </span>
                        </button>
                      </div>
                    )}

                  </div>
                </section>
              )}

              {isMobile && (isMobile || activeTab === "reviews") && <hr className="border-t border-[#ACAAB4]/30" />}

              {(isMobile || activeTab === "team") && (
                <section id="team" className="scroll-mt-24">
                  <div className="flex flex-col gap-6 w-full max-w-[862px] font-inter">
                    <h3 className="w-full font-semibold text-[25.8px] leading-[36px] text-[#0D0D0D]">
                      Team
                    </h3>

                    {/* Employees scroll/flex list wrapper — real Business Staff (Batch 9's
                        catalog.staff, extended with role + avatarUrl in Batch 17). */}
                    <div className="flex flex-wrap items-start gap-8 w-full">
                      {catalogQuery.isLoading && (
                        <p className="text-sm text-neutral-500">Loading team…</p>
                      )}
                      {catalogQuery.isError && (
                        <p className="text-sm text-red-600">Team could not be loaded right now.</p>
                      )}
                      {!catalogQuery.isLoading && !catalogQuery.isError && teamMembers.length === 0 && (
                        <p className="text-sm text-neutral-500">This business hasn&apos;t added any team members yet.</p>
                      )}

                      {teamMembers.map((member) => {
                        const fullName = member.lastName ? `${member.firstName} ${member.lastName}` : member.firstName;
                        const roleLabel = member.role.charAt(0) + member.role.slice(1).toLowerCase();
                        return (
                          <div
                            key={member.id}
                            className="flex flex-col items-center gap-4 w-[120px] h-[182px] relative cursor-pointer"
                          >
                            {/* Avatar Image circle with background border */}
                            <div className="relative w-[120px] h-[120px] shrink-0">
                              <div className="box-border flex flex-col justify-center items-start p-[0.0667px] w-[120px] h-[120px] bg-[#F0F0FF] border border-[#F0F0FF] rounded-full overflow-hidden">
                                <div className="w-[117.87px] h-[117.87px] rounded-full overflow-hidden relative">
                                  <Image src={member.avatarUrl ?? "/image/profile.jpg"} alt={fullName} fill className="object-cover" />
                                </div>
                              </div>
                            </div>

                            {/* Name and Description (Role) details */}
                            <div className="flex flex-col items-center gap-0.5 w-[120px] h-[46px] text-center mt-1">
                              <span className="font-inter font-medium text-[17px] leading-6 text-[#0D0D0D]">
                                {fullName}
                              </span>
                              <span className="font-inter font-normal text-[14.4px] leading-5 text-[#767676]">
                                {roleLabel}
                              </span>
                            </div>

                          </div>
                        );
                      })}
                    </div>

                  </div>
                </section>
              )}

              {isMobile && (isMobile || activeTab === "team") && <hr className="border-t border-[#ACAAB4]/30" />}

              {(isMobile || activeTab === "gallery") && (
                <section id="gallery" className="scroll-mt-24">
                  <div className="flex flex-col gap-6 w-full max-w-[862px] font-inter">

                    {/* Gallery Title Row */}
                    <div className="flex justify-between items-baseline w-full mb-2">
                      <h3 className="font-semibold text-[25.8px] leading-[36px] text-[#0D0D0D]">
                        Photos
                      </h3>
                      <button className="w-[46px] h-[36px] font-poppins text-sm leading-[36px] text-[#0D0D0D] hover:underline cursor-pointer">
                        See all
                      </button>
                    </div>

                    {/* Responsive grid of photo cards (2 in a row on mobile, 3 on desktop) — real
                        Business Media (business-media module), surfaced via the catalog read. */}
                    {catalogQuery.isLoading && (
                      <p className="text-sm text-neutral-500">Loading photos…</p>
                    )}
                    {!catalogQuery.isLoading && venueMedia.length === 0 && (
                      <p className="text-sm text-neutral-500">This business hasn&apos;t added any photos yet.</p>
                    )}
                    {venueMedia.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 w-full">
                        {venueMedia.map((item, idx) => (
                          <div key={item.id} className="aspect-square w-full bg-[#D9D9D9] rounded-xl overflow-hidden relative">
                            <Image src={item.url} alt={`Gallery ${idx + 1}`} fill className="object-cover" />
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                </section>
              )}
            </div>

          </div>

          {/* Right Column: Sticky Venue Summary Card */}
          <aside id="booking-aside" className="w-full lg:max-w-[422px] lg:mx-0 bg-[#FFFFFF] shadow-[0px_-1px_4px_rgba(0,0,0,0.25),0px_4px_12px_rgba(0,0,0,0.2)] rounded-[12px] p-6 sm:p-12 flex flex-col gap-10 lg:sticky lg:top-24 select-none order-1 lg:order-2">

            {isLoggedIn && selectedList.length > 0 ? (
              /* checkout / book a visit state */
              <div className="flex flex-col gap-6 w-full font-inter">

                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <h2 className="font-semibold text-2xl text-[#0D0D0D]">Book a visit</h2>
                  <span className="text-[11px] font-bold text-[#757575] uppercase tracking-wider">YOUR SERVICES</span>
                </div>

                {/* Selected Services Items List */}
                <div className="flex flex-col gap-4">
                  {selectedList.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-neutral-100">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-semibold text-sm text-[#0D0D0D] truncate">{item.name}</span>
                        <span className="text-xs text-[#757575]">{item.duration}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-sm text-[#0D0D0D]">{item.priceText}</span>
                        <button
                          onClick={() => item.onRemove()}
                          className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer font-bold text-xs"
                          aria-label="Remove service"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Divider and Total */}
                  <div className="border-t border-neutral-100 pt-4 flex justify-between items-center">
                    <span className="font-semibold text-sm text-[#757575]">Total ({totalDurationText})</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-[#0D0D0D]">{totalPriceText}</span>
                      <span className="w-5" /> {/* spacing to match close button */}
                    </div>
                  </div>
                </div>

                {/* Continue Button */}
                <button
                  onClick={() => setBookingStep("addons")}
                  className="w-full h-12 bg-[#2E9DA7] text-white font-poppins font-semibold text-base rounded-[12px] hover:opacity-95 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm mt-2"
                >
                  <span>Continue →</span>
                </button>

                {/* Business Details (re-rendered inside checkout layout at the bottom) */}
                <div className="border-t border-neutral-100 pt-6 flex flex-col gap-5 w-full mt-4">

                  {/* Clock status */}
                  {business?.openStatus.configured && (
                    <div className="flex items-center gap-3 w-full h-[24px]">
                      <div className="w-6 h-6 relative shrink-0">
                        <HugeiconsIcon icon={Clock04Icon} className="w-6 h-6 object-contain filter opacity-60" />
                      </div>
                      <span className="font-inter font-normal text-[15.9px] text-[#B7570B] whitespace-nowrap">
                        {business.openStatus.label}
                      </span>
                    </div>
                  )}

                  {/* Address and Get Directions */}
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-6 h-6 relative shrink-0">
                      <HugeiconsIcon icon={Location05Icon} className="w-6 h-6 object-contain filter opacity-60" />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-inter font-normal text-[15.8px] text-[#767676] truncate shrink">
                        {venueLocationText}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#808080] shrink-0" />
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); scrollToSection("about"); }}
                        className="font-inter font-normal text-[15.8px] text-[#2366C5] hover:underline whitespace-nowrap shrink-0"
                      >
                        Get Directions
                      </a>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              /* Default layout when no services are selected / logged out */
              <>
                {/* Salon Details Block */}
                <div className="flex flex-col gap-5 w-full max-w-[316.89px]">
                  <h2 className="font-inter font-semibold text-[37.2px] leading-[44px] text-[#0D0D0D]">
                    {business?.name ?? (catalogQuery.isLoading ? "Loading…" : "")}
                  </h2>

                  {/* Stars and rating block */}
                  {ratingSummaryQuery.data?.averageRating !== null &&
                  ratingSummaryQuery.data?.averageRating !== undefined ? (
                    <div className="flex items-center gap-2 w-full max-w-[253px] h-8">
                      <span className="font-inter font-semibold text-2xl leading-8 text-[#0D0D0D]">
                        {ratingSummaryQuery.data.averageRating.toFixed(1)}
                      </span>
                      <div className="flex items-center gap-1 w-[136px] h-6 justify-center">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Image
                            key={s}
                            src="/Icons/rattingfull.svg"
                            alt="star"
                            className={`w-6 h-6 object-contain ${s <= Math.round(ratingSummaryQuery.data?.averageRating ?? 0) ? "" : "opacity-25"}`}
                            width={24}
                            height={24}
                          />
                        ))}
                      </div>
                      <span className="font-inter font-medium text-[23.8px] leading-8 text-[#4E5F78]">
                        ({ratingSummaryQuery.data.reviewCount})
                      </span>
                    </div>
                  ) : (
                    <span className="font-inter font-medium text-base text-[#4E5F78]">No reviews yet</span>
                  )}
                </div>

                {/* Dynamic UI based on Authentication (isLoggedIn state) */}
                {isLoggedIn ? (
                  /* SS 1: User Logged In Card State */
                  <>
                    <button
                      onClick={() => {
                        if (selectedList.length === 0) {
                          scrollToSection("services");
                        } else {
                          setBookingStep("addons");
                        }
                      }}
                      className="w-full h-12 bg-[#2E9DA7] border border-[#D5D7DA] text-white font-poppins font-medium text-base rounded-[12px] hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center shadow-sm"
                    >
                      <span className="w-[78px] h-[24px] flex items-center justify-center">Book now</span>
                    </button>

                    {/* Info block */}
                    <div className="flex flex-col gap-5 w-full max-w-[338px]">

                      {/* Clock status */}
                      {business?.openStatus.configured && (
                        <div className="flex items-center gap-3 w-full h-[24px]">
                          <div className="w-6 h-6 relative shrink-0">
                            <HugeiconsIcon icon={Clock04Icon} className="w-6 h-6 object-contain filter opacity-60" />
                          </div>
                          <span className="font-inter font-normal text-[15.9px] text-[#B7570B] whitespace-nowrap">
                            {business.openStatus.label}
                          </span>
                        </div>
                      )}

                      {/* Address and Get Directions */}
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-6 h-6 relative shrink-0">
                          <HugeiconsIcon icon={Location05Icon} className="w-6 h-6 object-contain filter opacity-60" />
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-inter font-normal text-[15.8px] text-[#767676] truncate shrink">
                            {venueLocationText}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#808080] shrink-0" />
                          <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); scrollToSection("about"); }}
                            className="font-inter font-normal text-[15.8px] text-[#2366C5] hover:underline whitespace-nowrap shrink-0"
                          >
                            Get Directions
                          </a>
                        </div>
                      </div>

                    </div>
                  </>
                ) : (
                  /* SS 2: User Not Logged In Card State (With blurred footer & Lock icon overlay) */
                  <>
                    <button
                      onClick={() => goToCustomerAuth(`/venue?id=${venueId}`)}
                      className="w-full h-12 bg-[#0D0D0D] border border-[#0D0D0D] text-white font-poppins font-medium text-base rounded-[12px] hover:opacity-95 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Image src="/image/smallBlacklogo.svg" alt="Bookly" className="w-5 h-5 object-contain invert brightness-0" width={20} height={20} />
                      <span className="w-[78px] h-[24px] flex items-center justify-center">Book now</span>
                    </button>

                    {/* Clock & Address shown unblurred */}
                    <div className="flex flex-col gap-5 w-full max-w-[338px]">

                      {/* Clock status */}
                      {business?.openStatus.configured && (
                        <div className="flex items-center gap-3 w-full h-[24px]">
                          <div className="w-6 h-6 relative shrink-0">
                            <svg className="w-full h-full text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          </div>
                          <span className="font-inter font-normal text-[15.9px] text-[#B7570B] whitespace-nowrap">
                            {business.openStatus.label}
                          </span>
                        </div>
                      )}

                      {/* Address and Get Directions */}
                      <div className="flex items-center gap-2 w-full">
                        <div className="w-6 h-6 relative shrink-0">
                          <Image src="/Icons/phone.svg" className="w-6 h-6 object-contain filter opacity-60" alt="Phone" width={24} height={24} />
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-inter font-normal text-[15.8px] text-[#767676] truncate shrink">
                            {venueLocationText}
                          </span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#808080] shrink-0" />
                          <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); scrollToSection("about"); }}
                            className="font-inter font-normal text-[15.8px] text-[#2366C5] hover:underline whitespace-nowrap shrink-0"
                          >
                            Get Directions
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Blurred details and Lock overlay section */}
                    <div className="relative w-full max-w-[338px] h-[200px] mt-2 border border-neutral-100 rounded-xl bg-white overflow-hidden">

                      {/* Blurred elements under the lock */}
                      <div className="flex flex-col gap-5 w-full p-4 filter blur-[5px] select-none pointer-events-none opacity-50">
                        <div className="flex items-center ">
                          <Image src="/Icons/phone.svg" alt="Phone" className="w-5 h-5 object-contain" width={20} height={20} />
                        </div>
                      </div>

                      {/* Center lock and message overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-3 bg-white/70">
                        <div className="w-12 h-12 rounded-full border border-neutral-200 bg-white flex items-center justify-center shadow-md">
                          <HugeiconsIcon icon={SquareLock01Icon} />
                        </div>
                        <p className="text-sm text-[#0D0D0D] font-inter font-medium leading-snug max-w-[200px]">
                          Log in or create an account to contact this business
                        </p>
                      </div>

                    </div>
                  </>
                )}
              </>
            )}

          </aside>

        </div>

        {/* Full-width sections for Other locations and Services nearby */}
        {(() => {
          const mockLocations: Recommendation[] = [
            {
              id: "2001",
              title: "Soho Vintage Barbers | Sheikh Zayed Road",
              rating: 4.9,
              reviews: 120,
              categories: ["Barber", "Salon"],
              travelsToYou: true,
              travelLocations: ["Larnaca"],
              lastVisited: "Last visited 1 week ago",
              startingPrice: 15,
              image: "/image/imgOfService.png",
              hasDiamond: true
            },
            {
              id: "2002",
              title: "Zara Hair & Beauty | Limassol Marina",
              rating: 4.8,
              reviews: 85,
              categories: ["Hair", "Salon"],
              location: "Limassol Marina",
              distance: "2.5km away",
              lastVisited: "Last visited 3 weeks ago",
              startingPrice: 25,
              image: "/image/imgOfService.png",
              noDeposit: true
            },
            {
              id: "2003",
              title: "Gold Gym Spa & Massage | Nicosia",
              rating: 4.7,
              reviews: 310,
              categories: ["Massage", "Wellness"],
              location: "Nicosia",
              distance: "5km away",
              lastVisited: "Last visited 1 month ago",
              startingPrice: 40,
              image: "/image/imgOfService.png",
              hasDiamond: true
            },
            {
              id: "2004",
              title: "Elite Car Detailing | Paphos",
              rating: 4.9,
              reviews: 145,
              categories: ["Automotive"],
              location: "Paphos",
              distance: "8km away",
              lastVisited: "Last visited 2 months ago",
              startingPrice: 50,
              image: "/image/imgOfService.png",
              noDeposit: true
            }
          ];

          const renderFullWidthSection = (title: string) => (
            <div className="flex flex-col gap-6 mt-10 w-full font-poppins">
              <div className="flex justify-between items-baseline w-full">
                <h4 className="font-semibold text-2xl md:text-[28px] tracking-tight text-[#1C1B1C]">
                  {title}
                </h4>
                <span
                  onClick={() => router.push("/explore")}
                  className="text-sm md:text-base font-medium text-[#1C1B1C] cursor-pointer hover:underline"
                >
                  See all
                </span>
              </div>

              {/* Carousel container */}
              <Carousel>
                {mockLocations.map((loc) => (
                  <div key={loc.id} className="w-[calc(50%-7.5px)] sm:w-[360px] md:w-[406px] shrink-0 snap-start">
                    <ServiceCard
                      rec={loc}
                      isFavorite={false}
                      onToggleFavorite={() => { }}
                      onBookNow={(id) => router.push(`/venue?id=${id}`)}
                    />
                  </div>
                ))}
              </Carousel>
            </div>
          );

          return (
            <div className="w-full flex flex-col gap-6 mt-8">
              {renderFullWidthSection("Other locations")}
              {renderFullWidthSection("Services nearby")}
            </div>
          );
        })()}

      </main>

      {/* Footer */}
      <Footer />

      {bookingStep && (
        <div className="fixed inset-0 bg-[#FCFAF9] z-50 overflow-y-auto font-poppins flex flex-col">
          {/* Header Bar */}
          {bookingStep !== "confirmed" && (
            <header className="w-full bg-[#FCFAF9] border-b border-neutral-200 py-6 px-4 md:px-16 flex justify-between items-center sticky top-0 z-30">
              {/* Left Back Arrow and Breadcrumbs */}
              <div className="flex items-center gap-5 w-full max-w-[1440px] mx-auto relative">
                {/* Back Button */}
                <button
                  onClick={() => {
                    if (bookingStep === "addons") {
                      setBookingStep(null);
                    } else if (bookingStep === "professionals") {
                      setBookingStep("addons");
                    } else if (bookingStep === "time") {
                      setBookingStep("professionals");
                    } else if (bookingStep === "payment") {
                      setBookingStep("time");
                    }
                  }}
                  className="w-11 h-11 bg-[#E2E2E0] rounded-[4px] flex items-center justify-center cursor-pointer text-[#141B34] hover:bg-neutral-300 transition-colors shrink-0"
                  aria-label="Go back"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={24} />
                </button>

                {/* Breadcrumbs List */}
                <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-medium font-poppins overflow-x-auto scrollbar-hide whitespace-nowrap max-w-[calc(100%-100px)] sm:max-w-none pr-4">
                  <span className="text-[#ACAAB4] cursor-pointer" onClick={() => setBookingStep(null)}>Services</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} className="text-[#ACAAB4]" />

                  <span className={bookingStep === "addons" ? "text-black font-semibold" : "text-[#ACAAB4]"}>Add-ons</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} className={bookingStep === "addons" ? "text-black" : "text-[#ACAAB4]"} />

                  <span className={bookingStep === "professionals" ? "text-black font-semibold" : "text-[#ACAAB4]"}>Professionals</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} className={bookingStep === "professionals" ? "text-black" : "text-[#ACAAB4]"} />

                  <span className={bookingStep === "time" ? "text-black font-semibold" : "text-[#ACAAB4]"}>Time</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} className={bookingStep === "time" ? "text-black" : "text-[#ACAAB4]"} />

                  <span className={bookingStep === "payment" ? "text-black font-semibold" : "text-[#ACAAB4]"}>Payment</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={14} className={bookingStep === "payment" ? "text-black" : "text-[#ACAAB4]"} />

                  <span className="text-[#ACAAB4]">Confirm</span>
                </div>

                {/* Close button on the right */}
                <button
                  onClick={() => setBookingStep(null)}
                  className="absolute right-0 text-neutral-400 hover:text-black transition-colors cursor-pointer p-1"
                  aria-label="Close modal"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={24} />
                </button>
              </div>
            </header>
          )}

          {/* Modal Main Content Container */}
          <div className={`flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-16 py-10 flex flex-col ${bookingStep === "confirmed" ? "items-center justify-center" : "lg:flex-row gap-16 items-start"} relative`}>

            {/* Left Side: Step Content */}
            <div className="flex-grow w-full lg:max-w-[700px] flex flex-col gap-10 order-last lg:order-first">
              {bookingStep === "addons" && (
                <AddonsStep
                  addons={serviceAddonsQuery.data?.addons ?? []}
                  isLoading={serviceAddonsQuery.isLoading}
                  selectedAddonIds={selectedAddonIds}
                  setSelectedAddonIds={setSelectedAddonIds}
                />
              )}

              {bookingStep === "professionals" && (
                <ProfessionalsStep
                  staff={eligibleStaff}
                  isLoading={catalogQuery.isLoading}
                  selectedProfessional={selectedProfessional}
                  setSelectedProfessional={setSelectedProfessional}
                />
              )}

              {bookingStep === "time" && selectedService && (
                <TimeStep
                  timezone={catalogQuery.data?.business.timezone ?? "UTC"}
                  visibleMonth={visibleMonth}
                  onPrevMonth={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  onNextMonth={() => setVisibleMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  availability={availabilityQuery.data}
                  isLoading={availabilityQuery.isLoading}
                  selectedDateIso={selectedDateIso}
                  onSelectDate={(dateIso) => {
                    setSelectedDateIso(dateIso);
                    setSelectedSlot(undefined);
                  }}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                />
              )}

              {bookingStep === "payment" && (
                <PaymentStep
                  hasSavedCard={hasSavedCard}
                  setHasSavedCard={setHasSavedCard}
                  isReplacingCard={isReplacingCard}
                  setIsReplacingCard={setIsReplacingCard}
                  setBookingStep={setBookingStep}
                  notes={bookingNotes}
                  setNotes={setBookingNotes}
                />
              )}

              {bookingStep === "confirmed" && confirmedBooking && (
                <ConfirmedStep booking={confirmedBooking} setBookingStep={setBookingStep} />
              )}
            </div>

            {/* Right Side: Sticky Checkout Summary Card */}
            {bookingStep !== "confirmed" && (
              <CheckoutSummaryAside
                bookingStep={bookingStep}
                business={catalogQuery.data?.business}
                preview={preview}
                isPreviewLoading={previewMutation.isPending}
                previewError={previewMutation.isError || finalizeMutation.isError}
                showPolicy={showPolicy}
                setShowPolicy={setShowPolicy}
                onContinue={handleWizardContinue}
                canContinue={canContinueWizard}
                isSubmitting={finalizeMutation.isPending || confirming3ds}
                submitError={walletError}
                promoCodeInput={promoCodeInput}
                setPromoCodeInput={setPromoCodeInput}
                promoStatus={promoStatus}
                promoErrorMessage={promoErrorMessage}
                onApplyPromo={handleApplyPromo}
                onRemovePromo={handleRemovePromo}
              />
            )}

            {showCopiedToast && (
              <div className="fixed bottom-6 right-6 bg-[#1C1B1C] text-white px-4 py-2 rounded-xl shadow-lg z-50 font-inter text-sm flex items-center gap-2">
                <span>✓ Link copied to clipboard!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom Drawer for Mobile Summary */}
      {showStickyFooter && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-neutral-200 shadow-[0px_-4px_16px_rgba(0,0,0,0.15)] transition-all duration-300">
          {/* Expanded Summary Area */}
          {isMobileSummaryExpanded && (
            <div className="p-6 max-h-[75vh] overflow-y-auto border-b border-neutral-100 flex flex-col gap-6 bg-white font-inter">
              {/* Title & Close */}
              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <h2 className="font-semibold text-2xl text-[#0D0D0D]">
                    {selectedList.length > 0 ? "Book a visit" : (business?.name ?? "")}
                  </h2>
                  {selectedList.length > 0 && (
                    <span className="text-[11px] font-bold text-[#757575] uppercase tracking-wider">YOUR SERVICES</span>
                  )}
                  {selectedList.length === 0 && (
                    <div className="flex items-center gap-1.5 text-sm text-[#0d0d0d] font-semibold mt-1">
                      {ratingSummaryQuery.data?.averageRating !== null &&
                      ratingSummaryQuery.data?.averageRating !== undefined ? (
                        <>
                          <span>{ratingSummaryQuery.data.averageRating.toFixed(1)}</span>
                          <Image src="/Icons/rattingfull.svg" alt="star" className="w-4 h-4 object-contain" width={16} height={16} />
                          <span className="font-normal text-[#757575]">
                            ({ratingSummaryQuery.data.reviewCount} Review{ratingSummaryQuery.data.reviewCount === 1 ? "" : "s"})
                          </span>
                        </>
                      ) : (
                        <span className="font-normal text-[#757575]">No reviews yet</span>
                      )}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setIsMobileSummaryExpanded(false)}
                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-black font-bold text-xs"
                >
                  ✕
                </button>
              </div>

              {selectedList.length > 0 ? (
                /* Selected Services Items List */
                <div className="flex flex-col gap-4">
                  {selectedList.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-neutral-100">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-semibold text-sm text-[#0D0D0D] truncate">{item.name}</span>
                        <span className="text-xs text-[#757575]">{item.duration}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-semibold text-sm text-[#0D0D0D]">{item.priceText}</span>
                        <button
                          onClick={() => item.onRemove()}
                          className="text-neutral-400 hover:text-neutral-600 p-1 cursor-pointer font-bold text-xs"
                          aria-label="Remove service"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Divider and Total */}
                  <div className="border-t border-neutral-100 pt-4 flex justify-between items-center">
                    <span className="font-semibold text-sm text-[#757575]">Total ({totalDurationText})</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-[#0D0D0D]">{totalPriceText}</span>
                      <span className="w-5" />
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Business Details */}
              <div className="border-t border-neutral-100 pt-6 flex flex-col gap-5 w-full">
                {/* Clock status */}
                {business?.openStatus.configured && (
                  <div className="flex items-center gap-3 w-full h-[24px]">
                    <div className="w-6 h-6 relative shrink-0">
                      <HugeiconsIcon icon={Clock04Icon} className="w-6 h-6 object-contain filter opacity-60" />
                    </div>
                    <span className="font-inter font-normal text-[15.9px] text-[#B7570B] whitespace-nowrap">
                      {business.openStatus.label}
                    </span>
                  </div>
                )}

                {/* Address and Get Directions */}
                <div className="flex items-center gap-2 w-full">
                  <div className="w-6 h-6 relative shrink-0">
                    <HugeiconsIcon icon={Location05Icon} className="w-6 h-6 object-contain filter opacity-60" />
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-inter font-normal text-[15.8px] text-[#767676] truncate shrink">
                      {venueLocationText}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#808080] shrink-0" />
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); scrollToSection("about"); setIsMobileSummaryExpanded(false); }}
                      className="font-inter font-normal text-[15.8px] text-[#2366C5] hover:underline whitespace-nowrap shrink-0"
                    >
                      Get Directions
                    </a>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Bottom Bar */}
          <div className="p-4 flex items-center justify-between gap-4">
            <button
              onClick={() => setIsMobileSummaryExpanded(!isMobileSummaryExpanded)}
              className="flex flex-col items-start justify-center min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-[#0D0D0D]">
                  {selectedList.length > 0 ? totalPriceText : "Book a visit"}
                </span>
                <svg
                  className={`w-5 h-5 text-neutral-500 transition-transform duration-300 ${isMobileSummaryExpanded ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </div>
              <span className="text-xs text-[#757575] truncate">
                {selectedList.length > 0 
                  ? `${selectedList.length} ${selectedList.length === 1 ? "service" : "services"} • ${totalDurationText}`
                  : "Tap to view details"
                }
              </span>
            </button>

            <button
              onClick={() => {
                if (!isLoggedIn) {
                  goToCustomerAuth(`/venue?id=${venueId}`);
                  return;
                }
                if (selectedList.length === 0) {
                  scrollToSection("services");
                  setIsMobileSummaryExpanded(false);
                } else {
                  setBookingStep("addons");
                }
              }}
              className="flex-1 max-w-[200px] h-12 bg-[#2E9DA7] text-white font-poppins font-semibold text-base rounded-[12px] hover:opacity-95 transition-opacity cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{selectedList.length > 0 ? "Continue →" : "Book now"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VenueDetailsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VenueDetailsContent />
    </Suspense>
  );
}
