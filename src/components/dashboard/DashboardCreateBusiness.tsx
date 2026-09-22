"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";


import React, { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  Search01Icon,
  PlusSignIcon,
  Delete02Icon,
  InformationCircleIcon,
  Location05Icon,
  Calendar02Icon,
  Clock01Icon,
  MoreVerticalIcon,
  ViewIcon
} from "@hugeicons/core-free-icons";

import BusinessInfoSection from "../create-business/BusinessInfoSection";
import AddressSection from "../create-business/AddressSection";
import ServiceLocationTypeSection from "../create-business/ServiceLocationTypeSection";
import LocationSection from "../create-business/LocationSection";
import type { ProfileMarkerMediaState } from "../create-business/BusinessProfileMap";
import ServiceCategorySection from "../create-business/ServiceCategorySection";
import { subcategoriesFor, useBusinessTaxonomyQuery } from "@/lib/business-taxonomy/hooks";
import PhotosSection from "../create-business/PhotosSection";
import OpeningHoursSection from "../create-business/OpeningHoursSection";
import BookingTimeControlSection from "../create-business/BookingTimeControlSection";
import ClosedPeriodsSection from "../create-business/ClosedPeriodsSection";
import LeadTimeSettingsSection from "../create-business/LeadTimeSettingsSection";
import AdditionalInfoSection from "../create-business/AdditionalInfoSection";
import TravelFeesSection, { type TravelFeeRow } from "../create-business/TravelFeesSection";
import { geocodeAddress, reverseGeocodeCoordinates } from "@/lib/maps/googleGeocoding";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import type { BusinessCity, BusinessMedia, UpdateBusinessInput } from "@/lib/api/business";
import { daysOfWeek as businessHoursDaysOfWeek, type BusinessHoursDay } from "@/lib/api/business-hours";
import {
  useBusinessMediaQuery,
  useBusinessQuery,
  useBusinessTravelSettingsQuery,
  useDeleteBusinessMediaMutation,
  useSetBusinessProfileMediaMutation,
  useUpdateBusinessMutation,
  useUpdateBusinessTravelSettingsMutation,
  useUploadBusinessMediaMutation,
} from "@/lib/business/hooks";
import { useBusinessHoursQuery, useUpdateBusinessHoursMutation } from "@/lib/business/hours-hooks";
import { toUserMessage } from "@/lib/auth/messages";
import { BUSINESS_CITIES } from "@/lib/constants/cities";
import {
  useCreateServiceCategoryMutation,
  useServiceCategoriesQuery,
  useUpdateServiceCategoryMutation
} from "@/lib/services/hooks";
import type { ServiceCategory } from "@/lib/api/services";

interface DashboardCreateBusinessProps {
  onBack: () => void;
  mode?: "create" | "edit" | "view";
  businessId?: string;
}

const timeOptions = [
  "00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00", "03:30", "04:00", "04:30", "05:00", "05:30",
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"
];

// Monday-first, index-aligned with businessHoursDaysOfWeek ("MONDAY".."SUNDAY") — the Opening
// Hours section's `days` state keys off the display name, so this is the single place that
// order is defined for the frontend<->backend day mapping.
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const buildDefaultTravelFeeRows = (): TravelFeeRow[] =>
  BUSINESS_CITIES.map((city) => ({ name: city, active: false, fee: "0.00" }));

const centsToFeeText = (feeCents: number): string => (feeCents / 100).toFixed(2);

const feeTextToCents = (fee: string): number | null => {
  const normalized = fee.trim();

  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }

  return Math.round(Number(normalized) * 100);
};

export default function DashboardCreateBusiness({ onBack, mode = "create", businessId }: DashboardCreateBusinessProps) {
  const modeTitle = mode === "edit" ? "Edit Business" : mode === "view" ? "View Business" : "Create Business";
  const modeSubtitle = mode === "edit" ? "Edit your business details" : mode === "view" ? "View your business details" : "Create your business at our platform";
  const isReadOnly = mode === "view";

  // Business Active Toggle
  const [isActive, setIsActive] = useState(true);

  // Form Fields
  const [businessName, setBusinessName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [phoneCode, setPhoneCode] = useState("+357");
  const [phoneFlag, setPhoneFlag] = useState("cy");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("Larnaca");
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [floorUnit, setFloorUnit] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [timezone, setTimezone] = useState("Europe/Nicosia");

  // Country Dropdown
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countries = [
    { name: "Cyprus", code: "+357", flag: "cy" },
    { name: "Greece", code: "+30", flag: "gr" },
    { name: "United Kingdom", code: "+44", flag: "gb" },
    { name: "United States", code: "+1", flag: "us" }
  ];

  // Category/subcategory options come from the canonical taxonomy (the same one used at
  // registration) — never a hardcoded array. This screen still sends plain display LABELS to
  // `PATCH /business/:businessId` (that endpoint has no canonical-key concept, unlike the
  // registration onboarding API), so `selectedCategory`/`selectedSubcategories` stay label
  // strings; only their SOURCE list changed.
  const businessTaxonomyQuery = useBusinessTaxonomyQuery();
  const categories = (businessTaxonomyQuery.data ?? []).map((category) => category.label);

  // Category selection (select one)
  const [selectedCategory, setSelectedCategory] = useState("");

  // Subcategories selection (max 5) — scoped to whichever parent category is currently
  // selected (fixes the previous bug where "subcategories" were really just the other parent
  // category names reused).
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const selectedTaxonomyCategory = businessTaxonomyQuery.data?.find(
    (category) => category.label.toUpperCase() === selectedCategory.toUpperCase(),
  );
  const subcategoryOptions = subcategoriesFor(
    businessTaxonomyQuery.data,
    selectedTaxonomyCategory?.key,
  ).map((sub) => sub.label);

  const handleSelectedCategoryChange = (category: string) => {
    setSelectedCategory(category);
    // Changing the parent invalidates any subcategories selected under the OLD parent.
    setSelectedSubcategories([]);
  };

  const toggleSubcategory = (sub: string) => {
    if (selectedSubcategories.includes(sub)) {
      setSelectedSubcategories(selectedSubcategories.filter((s) => s !== sub));
    } else {
      if (selectedSubcategories.length < 5) {
        setSelectedSubcategories([...selectedSubcategories, sub]);
      }
    }
  };

  // Custom Service Categories — real, Business-scoped persistence (Services feature). Only
  // available once the Business exists (edit/view), same rule as the other real sections
  // below — "create" mode has no businessId yet, so there is nowhere to persist a category.
  // `includeInactive: true` so archived categories are discoverable here for Reactivate —
  // ServiceForm's own category picker is a SEPARATE query that stays active-only (see
  // ServiceForm.tsx's own useServiceCategoriesQuery call, unchanged by this).
  const customCategoriesQuery = useServiceCategoriesQuery(
    mode !== "create" ? businessId : undefined,
    true,
  );
  const activeServiceCategories = (customCategoriesQuery.data ?? []).filter((c) => c.active);
  const archivedServiceCategories = (customCategoriesQuery.data ?? []).filter((c) => !c.active);
  const customCategories = activeServiceCategories.map((category) => category.name);
  const archivedCustomCategories = archivedServiceCategories.map((category) => category.name);
  const createServiceCategoryMutation = useCreateServiceCategoryMutation();
  const updateServiceCategoryMutation = useUpdateServiceCategoryMutation();
  const [newCatInput, setNewCatInput] = useState("");
  // Rename dialog — name-keyed the same way removeCustomCategory already is (the backend's
  // unique index on {businessId, nameKey} spans active AND archived rows, so a name uniquely
  // identifies at most one category for this business at any time).
  const [renamingCategory, setRenamingCategory] = useState<ServiceCategory | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [reactivatingCategoryName, setReactivatingCategoryName] = useState<string | null>(null);

  const addCustomCategory = () => {
    const name = newCatInput.trim();
    if (!businessId || !name) {
      return;
    }
    createServiceCategoryMutation.mutate(
      { businessId, name },
      {
        onSuccess: () => setNewCatInput(""),
        onError: (error) => toast.error(toUserMessage(error))
      }
    );
  };

  // "Remove" archives (active: false) rather than deleting — existing Services referencing
  // this category keep a valid reference (confirmed product rule, see service.service.ts).
  const removeCustomCategory = (name: string) => {
    if (!businessId) {
      return;
    }
    const category = customCategoriesQuery.data?.find((candidate) => candidate.name === name);
    if (!category) {
      return;
    }
    updateServiceCategoryMutation.mutate(
      { businessId, categoryId: category.id, input: { active: false } },
      { onError: (error) => toast.error(toUserMessage(error)) }
    );
  };

  const startRenameCategory = (name: string) => {
    const category = customCategoriesQuery.data?.find((candidate) => candidate.name === name);
    if (!category) {
      return;
    }
    setRenamingCategory(category);
    setRenameInput(category.name);
  };

  // Same persisted category/ID — a PATCH {name}, never a create+archive pair (no duplicate
  // category, no orphaned Service reference; see service.service.ts's updateCategory).
  const submitRenameCategory = () => {
    if (!businessId || !renamingCategory) {
      return;
    }
    const name = renameInput.trim();
    if (!name || name === renamingCategory.name) {
      setRenamingCategory(null);
      return;
    }
    updateServiceCategoryMutation.mutate(
      { businessId, categoryId: renamingCategory.id, input: { name } },
      {
        onSuccess: () => setRenamingCategory(null),
        // Dialog stays open on failure (e.g. SERVICE_CATEGORY_ALREADY_EXISTS for a name that
        // collides with another active OR archived category) so the Owner can correct it.
        onError: (error) => toast.error(toUserMessage(error))
      }
    );
  };

  // Same persisted category/ID — a PATCH {active:true}, never a new category (no duplicate,
  // no Service reassignment; see service.service.ts's updateCategory).
  const reactivateCustomCategory = (name: string) => {
    if (!businessId) {
      return;
    }
    const category = customCategoriesQuery.data?.find((candidate) => candidate.name === name);
    if (!category) {
      return;
    }
    setReactivatingCategoryName(name);
    updateServiceCategoryMutation.mutate(
      { businessId, categoryId: category.id, input: { active: true } },
      {
        onSuccess: () => toast.success(`"${category.name}" reactivated`),
        onError: (error) => toast.error(toUserMessage(error)),
        onSettled: () => setReactivatingCategoryName(null)
      }
    );
  };

  // See-All Images View states
  const [viewingAllImages, setViewingAllImages] = useState(false);
  const [activeMenuIdx, setActiveMenuIdx] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleOutsideClick = () => setActiveMenuIdx(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Opening Hours
  const [days, setDays] = useState([
    { name: "Monday", open: true, slots: [{ start: "10:00", end: "13:00" }, { start: "15:00", end: "22:00" }] },
    { name: "Tuesday", open: true, slots: [{ start: "09:00", end: "18:00" }] },
    { name: "Wednesday", open: false, slots: [{ start: "09:00", end: "18:00" }] },
    { name: "Thursday", open: true, slots: [{ start: "09:00", end: "18:00" }] },
    { name: "Friday", open: true, slots: [{ start: "09:00", end: "18:00" }] },
    { name: "Saturday", open: false, slots: [{ start: "09:00", end: "18:00" }] },
    { name: "Sunday", open: false, slots: [{ start: "09:00", end: "18:00" }] }
  ]);

  const toggleDay = (idx: number) => {
    const updated = [...days];
    updated[idx].open = !updated[idx].open;
    setDays(updated);
  };

  const addTimeSlot = (dayIdx: number) => {
    const updated = [...days];
    updated[dayIdx].slots.push({ start: "09:00", end: "18:00" });
    setDays(updated);
  };

  const removeTimeSlot = (dayIdx: number, slotIdx: number) => {
    const updated = [...days];
    updated[dayIdx].slots = updated[dayIdx].slots.filter((_, i) => i !== slotIdx);
    setDays(updated);
  };

  const updateSlotTime = (dayIdx: number, slotIdx: number, field: "start" | "end", val: string) => {
    const updated = [...days];
    updated[dayIdx].slots[slotIdx][field] = val;
    setDays(updated);
  };

  // Booking Time Control (Manual/Auto)
  const [bookingMode, setBookingMode] = useState<"Manual" | "Auto">("Manual");
  const [manualTimes, setManualTimes] = useState<string[]>(["10:00", "12:00"]);
  const [newManualTime, setNewManualTime] = useState("10:00");
  const [newManualAmpm, setNewManualAmpm] = useState("AM");
  const [durationIncrement, setDurationIncrement] = useState("30 minutes");

  const addManualTime = () => {
    const formatted = `${newManualTime} ${newManualAmpm}`;
    if (!manualTimes.includes(formatted)) {
      setManualTimes([...manualTimes, formatted]);
    }
  };

  const removeManualTime = (time: string) => {
    setManualTimes(manualTimes.filter((t) => t !== time));
  };

  // Closed Periods
  const [closedPeriods, setClosedPeriods] = useState([
    { id: 1, start: "", end: "", note: "e.g. Public holiday (internal note)" }
  ]);

  const addClosedPeriod = () => {
    setClosedPeriods([...closedPeriods, { id: Date.now(), start: "", end: "", note: "" }]);
  };

  const removeClosedPeriod = (id: number) => {
    setClosedPeriods(closedPeriods.filter((p) => p.id !== id));
  };

  const updateClosedPeriod = (idx: number, field: string, val: string) => {
    const updated = [...closedPeriods];
    if (field === "start") updated[idx].start = val;
    if (field === "end") updated[idx].end = val;
    if (field === "label" || field === "note") updated[idx].note = val;
    setClosedPeriods(updated);
  };

  // Online Availability Lead Times
  const [allowBookingLead, setAllowBookingLead] = useState("Up to 15 minutes before start time");
  const [maxAdvanceBooking, setMaxAdvanceBooking] = useState("12 months in the future");

  // Additional Information states
  const [additionalInfo, setAdditionalInfo] = useState<string[]>(["", ""]);
  const addInfoField = () => {
    if (additionalInfo.length < 3) {
      setAdditionalInfo([...additionalInfo, ""]);
    }
  };
  const removeInfoField = (idx: number) => {
    setAdditionalInfo(additionalInfo.filter((_, i) => i !== idx));
  };
  const updateInfoField = (idx: number, val: string) => {
    const updated = [...additionalInfo];
    updated[idx] = val;
    setAdditionalInfo(updated);
  };

  // Travel Fees states
  const [cityFees, setCityFees] = useState<TravelFeeRow[]>(buildDefaultTravelFeeRows);
  const toggleCityActive = (idx: number) => {
    const updated = [...cityFees];
    updated[idx].active = !updated[idx].active;
    setCityFees(updated);
  };
  const updateCityFee = (idx: number, fee: string) => {
    const updated = [...cityFees];
    updated[idx].fee = fee;
    setCityFees(updated);
  };

  // Map Coordinates (Larnaca Cyprus default: 34.9172, 33.6232). This is the *field's
  // visible text* — it doubles as the human-readable persisted-location label (set by
  // the effect below) and, transiently, as whatever the user is currently typing to
  // search. It never itself represents a persisted coordinate — see `previewCenter`.
  const [searchLocation, setSearchLocation] = useState("Larnaca, Cyprus");
  // A temporary, display-only recenter target produced by the Search button — kept
  // entirely separate from the business's real persisted `location.{lat,lng}` (read
  // directly from `business` below) so a cosmetic search preview can never be mistaken
  // for — or accidentally saved as — an actual location edit. This map/section has no
  // path that writes coordinates at all; Search only ever moves the camera.
  const [previewCenter, setPreviewCenter] = useState<{ lat: number; lng: number } | null>(null);
  // The same resolved label as `searchLocation`, but frozen against the user's live
  // typing — the marker hover popup must keep showing the real persisted address even
  // while the search field temporarily holds whatever the user is typing to search, so
  // a search-in-progress can never be mistaken for the actual saved business address.
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState("Larnaca, Cyprus");
  const searchRequestRef = useRef(0);

  const handleLocationSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchLocation.trim();
    if (!query) return;

    const requestId = ++searchRequestRef.current;
    void (async () => {
      const coordinates = await geocodeAddress(query);
      if (searchRequestRef.current !== requestId) return; // a newer search has since started
      if (coordinates) {
        setPreviewCenter(coordinates);
      } else {
        toast.error("Location not found. Please try a different search.");
      }
    })();
  };

  // Real Business Profile data (edit/view only — "create" stays local/mocked; see report).
  const {
    data: business,
    isLoading: isLoadingBusiness,
    isError: isBusinessError,
    error: businessError,
  } = useBusinessQuery(mode !== "create" ? businessId : undefined);
  // Business.visitType is the sole authority for whether Travel Fees is relevant (see
  // ServiceLocationTypeSection just above this in the form, which reads the same field) — an
  // AT_BUSINESS_LOCATION Business never travels, so its Travel Fees config has nothing to apply
  // to. `business` is only loaded outside "create" mode (see isLoadingBusiness gate below), so
  // this is `false` — never a stale `true` — until the real value is known.
  const showTravelFees = business?.visitType === "TRAVEL_TO_CUSTOMER";
  const updateBusinessMutation = useUpdateBusinessMutation();
  const {
    data: businessMedia = [],
    isLoading: isLoadingBusinessMedia,
    isError: isBusinessMediaError,
    error: businessMediaError,
  } = useBusinessMediaQuery(mode !== "create" ? businessId : undefined);
  const {
    data: travelSettings,
    isError: isTravelSettingsError,
    error: travelSettingsError,
  } = useBusinessTravelSettingsQuery(mode !== "create" ? businessId : undefined);
  const {
    data: businessHours,
    isError: isBusinessHoursError,
    error: businessHoursError,
  } = useBusinessHoursQuery(mode !== "create" ? businessId : undefined);
  const uploadBusinessMediaMutation = useUploadBusinessMediaMutation();
  const deleteBusinessMediaMutation = useDeleteBusinessMediaMutation();
  const setBusinessProfileMediaMutation = useSetBusinessProfileMediaMutation();
  const updateBusinessTravelSettingsMutation = useUpdateBusinessTravelSettingsMutation();
  const updateBusinessHoursMutation = useUpdateBusinessHoursMutation();
  const canMutateMedia = mode === "edit" && Boolean(businessId);
  const displayMedia = [...businessMedia].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "PROFILE" ? -1 : 1;
    }

    return left.sortOrder - right.sortOrder;
  });
  // The Business Profile map's circular marker reuses this exact already-loaded photo —
  // no extra request. Note: `BusinessDetail` (this screen's `business`) has no
  // `profileMedia` field of its own (that shape only exists on the `BusinessCard` used
  // by the dashboard's business list) — the profile photo here is identified the same
  // way the rest of this component already does, via `businessMedia`'s `role`.
  const profileImageUrl = businessMedia.find((media) => media.role === "PROFILE")?.url;
  // Explicit three-state derivation for the marker, using useBusinessMediaQuery's OWN
  // `isLoading` (true only until the first successful/errored fetch, never again on a
  // later background refetch) rather than inferring "no image" from `profileImageUrl`
  // being undefined — that inference couldn't tell "hasn't loaded yet" apart from
  // "loaded, and there's genuinely no PROFILE photo," which is exactly what let a
  // still-loading marker render (and on a bad race, stay rendered) as the fallback icon.
  // "create" mode never has a real businessId, so its query never runs — treated as
  // "empty" (matches the pre-existing behavior: no marker photo while creating).
  // Memoized so BusinessProfileMap's `[profileMedia, mapStatus]` effect only re-fires
  // when one of these actually changes, not on every unrelated parent re-render.
  const profileMediaState: ProfileMarkerMediaState = useMemo(() => {
    if (mode === "create") return { status: "empty" };
    if (isLoadingBusinessMedia) return { status: "loading" };
    return profileImageUrl ? { status: "ready", url: profileImageUrl } : { status: "empty" };
  }, [mode, isLoadingBusinessMedia, profileImageUrl]);
  // "create" mode has no real business/location yet (see the comment above `business`
  // below) — the map still shows a preview, centered the same way the previous Embed
  // helper's own default did, just with no marker photo since no business exists yet.
  const businessCoordinates =
    business?.location ?? (mode === "create" ? { lat: 34.9172, lng: 33.6232 } : null);

  useEffect(() => {
    if (isBusinessError) {
      toast.error(toUserMessage(businessError));
    }
  }, [isBusinessError, businessError]);

  useEffect(() => {
    if (isBusinessMediaError) {
      toast.error(toUserMessage(businessMediaError));
    }
  }, [isBusinessMediaError, businessMediaError]);

  useEffect(() => {
    if (isTravelSettingsError) {
      toast.error(toUserMessage(travelSettingsError));
    }
  }, [isTravelSettingsError, travelSettingsError]);

  useEffect(() => {
    if (isBusinessHoursError) {
      toast.error(toUserMessage(businessHoursError));
    }
  }, [isBusinessHoursError, businessHoursError]);

  // Best-effort match against the canonical taxonomy's labels; an existing Business whose
  // stored value doesn't match any canonical label (a legacy/pre-taxonomy value) falls back to
  // displaying the raw stored string rather than hiding it.
  const matchCategoryOption = (value: string): string =>
    categories.find((option) => option.toUpperCase() === value.toUpperCase()) ?? value;
  const matchSubcategoryOption = (value: string, options: string[]): string =>
    options.find((option) => option.toUpperCase() === value.toUpperCase()) ?? value;

  // Prefilling independently-editable local form state from an async detail fetch is not the
  // "derived state" anti-pattern the set-state-in-effect rule targets; it can only run once the
  // query resolves, so it is intentionally scoped to `business?.id` below and disabled here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!business) {
      return;
    }

    setBusinessName(business.name);
    setPhoneCode(business.phone.countryCode);
    setPhoneNumber(business.phone.nationalNumber);
    const matchedCountry = countries.find((country) => country.code === business.phone.countryCode);
    if (matchedCountry) {
      setPhoneFlag(matchedCountry.flag);
    }
    setCity(business.address.city);
    setStreetName(business.address.streetName);
    setStreetNumber(business.address.streetNumber);
    setNeighborhood(business.address.area);
    setFloorUnit(business.address.floorUnit ?? "");
    setRoomNo(business.address.aptRoom ?? "");
    setBusinessDescription(business.briefDescription);
    setTimezone(business.timezone);
    const matchedCategoryLabel = matchCategoryOption(business.category);
    setSelectedCategory(matchedCategoryLabel);
    const matchedTaxonomyCategory = businessTaxonomyQuery.data?.find(
      (category) => category.label.toUpperCase() === matchedCategoryLabel.toUpperCase(),
    );
    const scopedSubcategoryLabels = subcategoriesFor(
      businessTaxonomyQuery.data,
      matchedTaxonomyCategory?.key,
    ).map((sub) => sub.label);
    setSelectedSubcategories(
      business.subcategories.map((value) => matchSubcategoryOption(value, scopedSubcategoryLabels)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Human-readable persisted-location label. Structured `area, city` (already-loaded
  // business data, matching the exact format the customer-facing venue page already
  // shows) is painted immediately as a safe synchronous value — using any existing
  // meaningful (non-coordinate-shaped) `location.searchQuery` instead when one exists,
  // so a business someone already labeled nicely doesn't visibly flash — while a Google
  // reverse geocode of the exact stored coordinate resolves in the background and, on
  // success, becomes the final displayed label. On failure it settles back to the
  // structured address. Raw `lat, lng` is never shown at any point in this chain. This
  // label is purely for display: it's the field's *starting* text, but the field's live
  // value diverges from it the moment the user types a search query, and this effect is
  // the only place besides `handleLocationSearch` that ever calls `setSearchLocation`.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!business) return;

    // A previous version of this Dashboard's own Save handler could persist a raw
    // "35.0165922, 34.050283"-shaped string into `location.searchQuery`. Such a value
    // is exactly the bug this fix corrects, so it must never be treated as a valid
    // human-readable label — old stored data is not touched, only how it's displayed.
    const isCoordinatePairString = (value: string): boolean =>
      /^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(value.trim());

    const structuredFallback =
      [business.address.area, business.address.city].filter(Boolean).join(", ") ||
      "Location not set";

    if (!business.location) {
      setPreviewCenter(null);
      setSearchLocation(structuredFallback);
      setResolvedLocationLabel(structuredFallback);
      return;
    }

    const { lat, lng, searchQuery } = business.location;
    const existingLabel =
      searchQuery && searchQuery.trim() && !isCoordinatePairString(searchQuery)
        ? searchQuery.trim()
        : undefined;

    setPreviewCenter(null);
    setSearchLocation(existingLabel ?? structuredFallback);
    setResolvedLocationLabel(existingLabel ?? structuredFallback);

    let cancelled = false;
    void (async () => {
      const formattedAddress = await reverseGeocodeCoordinates(lat, lng);
      if (cancelled) return;
      const finalLabel = formattedAddress ?? structuredFallback;
      setSearchLocation(finalLabel);
      setResolvedLocationLabel(finalLabel);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!travelSettings) {
      return;
    }

    const byCity = new Map(travelSettings.cities.map((setting) => [setting.city, setting]));
    setCityFees(
      BUSINESS_CITIES.map((city) => {
        const setting = byCity.get(city);
        return {
          name: city,
          active: setting?.active ?? false,
          fee: centsToFeeText(setting?.feeCents ?? 0),
        };
      }),
    );
  }, [travelSettings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Opening Hours — only overwrite the local form once real data comes back and a document
  // actually exists (`configured`); an unconfigured Business keeps the interactive starter
  // template already in `days` state as its first-time-setup default rather than being
  // fabricated as "closed all week".
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!businessHours?.configured) {
      return;
    }

    const byDay = new Map(businessHours.days.map((day) => [day.dayOfWeek, day]));
    setDays(
      businessHoursDaysOfWeek.map((dayOfWeek, index) => {
        const found = byDay.get(dayOfWeek);
        return {
          name: DAY_LABELS[index] as string,
          open: found?.isOpen ?? false,
          slots:
            found && found.slots.length > 0
              ? found.slots.map((slot) => ({ start: slot.startTime, end: slot.endTime }))
              : [{ start: "09:00", end: "18:00" }],
        };
      }),
    );
  }, [businessHours]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSaveChanges = async () => {
    if (
      mode !== "edit" ||
      !businessId ||
      updateBusinessMutation.isPending ||
      updateBusinessTravelSettingsMutation.isPending ||
      updateBusinessHoursMutation.isPending
    ) {
      onBack();
      return;
    }

    const input: UpdateBusinessInput = {
      name: businessName,
      city: city as BusinessCity,
      area: neighborhood,
      streetName,
      streetNumber,
      category: selectedCategory,
      subcategories: selectedSubcategories,
      briefDescription: businessDescription,
      timezone,
    };

    if (floorUnit) input.floorUnit = floorUnit;
    if (roomNo) input.aptRoom = roomNo;
    if (phoneNumber) {
      input.countryCode = phoneCode;
      input.nationalNumber = phoneNumber;
    }
    // Deliberately NOT sending `searchQuery` here. `searchLocation` doubles as this
    // screen's location *search box* text — the moment the user types into it to
    // preview a place (LocationSection's "Search location to update map..." field),
    // it no longer reflects the business's actual persisted address, only unconfirmed
    // preview text. This map has no "confirm new location" action (see
    // BusinessProfileMap: read-only, `coordinates` is never sent from this screen
    // either), so there is no legitimate address text for this Save action to write —
    // the real label is always derived from the persisted coordinate via
    // reverse-geocoding (see the `business?.id`-keyed effect above). A previous
    // version of this handler did send it, which is exactly the stale/wrong
    // `location.searchQuery` class of bug flagged in that effect's own comment.

    // Travel fees are only meaningful for a TRAVEL_TO_CUSTOMER Business (see
    // `showTravelFees` above) — for AT_BUSINESS_LOCATION, skip both the fee-input
    // validation and the write entirely rather than persisting/re-persisting
    // irrelevant city/fee data the Owner can no longer even see or edit here.
    const travelSettingsInput = [];

    if (showTravelFees) {
      for (const row of cityFees) {
        const feeCents = feeTextToCents(row.fee);

        if (feeCents === null) {
          toast.error("Enter a valid travel fee.");
          return;
        }

        travelSettingsInput.push({
          city: row.name as BusinessCity,
          active: row.active,
          feeCents,
        });
      }
    }

    try {
      await updateBusinessMutation.mutateAsync({ businessId, input });
    } catch (error) {
      toast.error(toUserMessage(error));
      return;
    }

    if (showTravelFees) {
      try {
        await updateBusinessTravelSettingsMutation.mutateAsync({
          businessId,
          cities: travelSettingsInput,
        });
      } catch (error) {
        toast.error(`Business details saved, but travel fees could not be saved. ${toUserMessage(error)}`);
        return;
      }
    }

    const businessHoursDays: BusinessHoursDay[] = days.map((day, index) => ({
      dayOfWeek: businessHoursDaysOfWeek[index] as BusinessHoursDay["dayOfWeek"],
      isOpen: day.open,
      slots: day.open ? day.slots.map((slot) => ({ startTime: slot.start, endTime: slot.end })) : [],
    }));

    try {
      await updateBusinessHoursMutation.mutateAsync({ businessId, days: businessHoursDays });
      toast.success("Business updated");
      onBack();
    } catch (error) {
      toast.error(`Business details saved, but opening hours could not be saved. ${toUserMessage(error)}`);
    }
  };

  const handleUploadImages = async (files: FileList) => {
    if (!businessId || !canMutateMedia || uploadBusinessMediaMutation.isPending) {
      return;
    }

    const selectedFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));

    if (selectedFiles.length !== files.length) {
      toast.error("Only image files can be uploaded.");
    }

    if (selectedFiles.length === 0) {
      return;
    }

    try {
      for (const file of selectedFiles) {
        await uploadBusinessMediaMutation.mutateAsync({ businessId, file });
      }
      toast.success(selectedFiles.length === 1 ? "Image uploaded" : "Images uploaded");
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  };

  const handleDeleteImage = (media: BusinessMedia) => {
    if (!businessId || !canMutateMedia || deleteBusinessMediaMutation.isPending) {
      return;
    }

    deleteBusinessMediaMutation.mutate(
      { businessId, mediaId: media.id, role: media.role },
      {
        onSuccess: () => {
          toast.success("Image deleted");
        },
        onError: (error) => {
          toast.error(toUserMessage(error));
        },
      },
    );
  };

  const handleMakeProfilePic = (media: BusinessMedia) => {
    if (!businessId || !canMutateMedia || setBusinessProfileMediaMutation.isPending) {
      return;
    }

    setBusinessProfileMediaMutation.mutate(
      { businessId, mediaId: media.id },
      {
        onSuccess: () => {
          toast.success("Profile image updated");
        },
        onError: (error) => {
          toast.error(toUserMessage(error));
        },
      },
    );
  };

  if (mode !== "create" && isLoadingBusiness) {
    return (
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] select-none font-poppins">
        <DashboardHeader title="Business Profile" subtitle={modeSubtitle} />
        <div className="flex-1 flex items-center justify-center">
          <Spinner className="text-[#111111] size-6" />
        </div>
      </main>
    );
  }

  if (viewingAllImages) {
    return (
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
        {/* Header Row */}
        <DashboardHeader title="Images" subtitle="All the images that you have uploaded so far" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

        {/* Breadcrumbs (Frame 2147240055) */}
        <div className="flex flex-row items-center gap-3 mb-[40px] select-none w-full">
          <button 
            type="button"
            onClick={() => setViewingAllImages(false)}
            className="w-4 h-4 flex items-center justify-center text-neutral-600 hover:text-black cursor-pointer"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4" />
          </button>
          
          <div className="flex flex-row items-center gap-2">
            <button 
              type="button" 
              onClick={onBack} 
              className="text-[13px] font-medium text-[#888780] hover:text-black cursor-pointer leading-[20px]"
            >
              Business
            </button>
            <span className="text-[13px] text-[#888780] font-normal leading-[20px]">&gt;</span>
            <button 
              type="button" 
              onClick={() => setViewingAllImages(false)} 
              className="text-[13px] font-medium text-[#888780] hover:text-black cursor-pointer leading-[20px]"
            >
              {modeTitle}
            </button>
            <span className="text-[13px] text-[#888780] font-normal leading-[20px]">&gt;</span>
            <span className="text-[13px] font-semibold text-[#1C1C1A] leading-[20px]">Images</span>
          </div>
        </div>

        {/* Photos Grid (Frame 2147239298 & Frame 2147240056) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[20px] max-w-[1095px] w-full relative">
          {displayMedia.map((media, idx) => (
            <div key={media.id} className="relative w-full aspect-square rounded-[12px] bg-[#D9D9D9] border border-neutral-200">
              <Image src={media.url} className="w-full h-full object-cover rounded-[12px]" alt={`Business photo ${idx + 1}`} fill />

              {/* White circular 3-dot overlay button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuIdx(activeMenuIdx === idx ? null : idx);
                }}
                className="absolute right-3 top-3 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-neutral-50 transition-all cursor-pointer z-10"
              >
                <HugeiconsIcon icon={MoreVerticalIcon} className="w-3.5 h-3.5 text-[#0C0C0C]" />
              </button>

              {/* Action Dropdown Menu */}
              {activeMenuIdx === idx && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-3 top-10 bg-white border border-neutral-100 rounded-lg shadow-xl py-1 w-[140px] z-20"
                >
                  {canMutateMedia && media.role !== "PROFILE" && (
                    <button
                      type="button"
                      onClick={() => {
                        handleMakeProfilePic(media);
                        setActiveMenuIdx(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 border-b border-neutral-100/50 cursor-pointer block"
                    >
                      Make profile pic
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewImage(media.url);
                      setActiveMenuIdx(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 border-b border-neutral-100/50 flex items-center gap-2 cursor-pointer"
                  >
                    <HugeiconsIcon icon={ViewIcon} className="w-3.5 h-3.5 text-neutral-600" />
                    <span>View</span>
                  </button>
                  {canMutateMedia && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteImage(media);
                        setActiveMenuIdx(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                    >
                      <HugeiconsIcon icon={Delete02Icon} className="w-3.5 h-3.5 text-red-600" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Image Preview Lightbox */}
        {previewImage && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 cursor-pointer" 
            onClick={() => setPreviewImage(null)}
          >
            <div className="relative max-w-3xl max-h-[80vh] bg-white p-2 rounded-xl" onClick={(e) => e.stopPropagation()}>
              <Image src={previewImage} alt="Preview" className="max-w-full max-h-[75vh] rounded-lg object-contain" width={24} height={24} />
              <button 
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white hover:bg-neutral-100 rounded-full flex items-center justify-center shadow-lg font-bold text-sm text-neutral-800 cursor-pointer focus:outline-none"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      
      </div></main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins">

      <DashboardHeader 
        title="Business Profile" 
        subtitle={modeSubtitle} 
      />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-8 select-none w-full">
        <button onClick={onBack} className="hover:text-black flex items-center gap-1">
          <HugeiconsIcon icon={ArrowLeft02Icon} className="w-3.5 h-3.5" />
          <span>Business</span>
        </button>
        <span className="text-neutral-300">/</span>
        <span className="text-black font-semibold">{modeTitle}</span>
      </div>

      {/* Main Form container */}
      <div className="flex flex-col gap-10 w-full pb-24 pl-0 md:pl-[120px] box-border">

      {/* Linked (Secondary) businesses are View-only: disabling the fieldset makes every
          field/control inert without touching any child component's markup or styling. */}
      <fieldset disabled={isReadOnly} className="contents">

        {/* 1. Active Toggle block */}
        <div className="flex flex-row justify-between items-center w-full h-[41px] border-b border-[#E8E8E4]/60 pb-4">
          <div className="flex flex-col items-start gap-0.5">
            <span className="font-poppins font-medium text-sm text-[#111111] leading-[21px] flex items-center">
              Business active
            </span>
            <span className="font-poppins font-normal text-[11px] text-[#111111]/60 leading-[18px]">
              Show on your public profile. Turn off to hide without deleting.
            </span>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={() => setIsActive(!isActive)}
            className={`w-[38px] h-[21px] rounded-full p-[3px] transition-colors duration-200 focus:outline-none flex items-center ${isActive ? "bg-[#0F6E56]" : "bg-neutral-300"
              }`}
          >
            <div
              className={`w-[15px] h-[15px] bg-white rounded-full transition-transform duration-200 ${isActive ? "translate-x-[17px]" : "translate-x-0"
                }`}
            />
          </button>
        </div>

        {/* 2. Business Information Section */}
        <BusinessInfoSection
          businessName={businessName}
          setBusinessName={setBusinessName}
          regNumber={regNumber}
          setRegNumber={setRegNumber}
          phoneCode={phoneCode}
          setPhoneCode={setPhoneCode}
          phoneFlag={phoneFlag}
          setPhoneFlag={setPhoneFlag}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          description={businessDescription}
          setDescription={setBusinessDescription}
        />

        {/* 3. Address Section */}
        <AddressSection
          city={city}
          setCity={setCity}
          streetName={streetName}
          setStreetName={setStreetName}
          streetNumber={streetNumber}
          setStreetNumber={setStreetNumber}
          neighborhood={neighborhood}
          setNeighborhood={setNeighborhood}
          floorUnit={floorUnit}
          setFloorUnit={setFloorUnit}
          roomNo={roomNo}
          setRoomNo={setRoomNo}
          timezone={timezone}
          setTimezone={setTimezone}
        />

        {/* Service location type — read-only, set during onboarding (/professional/visit-type) */}
        {mode !== "create" && <ServiceLocationTypeSection visitType={business?.visitType} />}

        {/* 4. Location & Real Map Section */}
        <LocationSection
          searchLocation={searchLocation}
          setSearchLocation={setSearchLocation}
          handleLocationSearch={handleLocationSearch}
          lat={businessCoordinates?.lat}
          lng={businessCoordinates?.lng}
          profileMedia={profileMediaState}
          previewCenter={previewCenter}
          businessName={businessName}
          displayAddress={resolvedLocationLabel}
        />

        {/* 5, 6, 7. Service Categories Section */}
        <ServiceCategorySection
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={handleSelectedCategoryChange}
          subcategories={subcategoryOptions}
          selectedSubcategories={selectedSubcategories}
          toggleSubcategory={toggleSubcategory}
          customCategories={customCategories}
          newCatInput={newCatInput}
          setNewCatInput={setNewCatInput}
          addCustomCategory={addCustomCategory}
          removeCustomCategory={removeCustomCategory}
          archivedCategories={archivedCustomCategories}
          onRenameCategory={startRenameCategory}
          onReactivateCategory={reactivateCustomCategory}
          reactivatingCategory={reactivatingCategoryName}
        />

      </fieldset>

      {/* 8. Photos Section */}
      <PhotosSection
        photos={displayMedia}
        onSeeAll={() => setViewingAllImages(true)}
        onUploadImages={handleUploadImages}
        onDeleteImage={handleDeleteImage}
        onMakeProfilePic={handleMakeProfilePic}
        canMutate={canMutateMedia}
        isUploading={uploadBusinessMediaMutation.isPending}
      />

      <fieldset disabled={isReadOnly} className="contents">

        {/* 9. Opening Hours Section */}
        <OpeningHoursSection
          days={days}
          toggleDay={toggleDay}
          updateSlotTime={updateSlotTime}
          addTimeSlot={addTimeSlot}
          removeTimeSlot={removeTimeSlot}
          timeOptions={timeOptions}
        />

        {/* 10. Booking Time Control (Manual vs Auto) */}
        <BookingTimeControlSection
          bookingMode={bookingMode}
          setBookingMode={setBookingMode}
          durationIncrement={durationIncrement}
          setDurationIncrement={setDurationIncrement}
          manualTimes={manualTimes}
          newManualTime={newManualTime}
          setNewManualTime={setNewManualTime}
          newManualPeriod={newManualAmpm as "AM" | "PM"}
          setNewManualPeriod={setNewManualAmpm}
          addManualTime={addManualTime}
          removeManualTime={removeManualTime}
        />

        {/* 11. Add Closed Period Section */}
        <ClosedPeriodsSection
          closedPeriods={closedPeriods}
          updateClosedPeriod={updateClosedPeriod}
          addClosedPeriod={addClosedPeriod}
          removeClosedPeriod={removeClosedPeriod}
        />

        {/* 12. Lead Time Settings */}
        <LeadTimeSettingsSection
          allowBookingLead={allowBookingLead}
          setAllowBookingLead={setAllowBookingLead}
          maxAdvanceBooking={maxAdvanceBooking}
          setMaxAdvanceBooking={setMaxAdvanceBooking}
        />

        {/* 13. Additional Information Section */}
        <AdditionalInfoSection
          additionalInfo={additionalInfo}
          addInfoField={addInfoField}
          removeInfoField={removeInfoField}
          updateInfoField={updateInfoField}
        />

        {/* 14. Travel Fees Section + 15. How Travel Fees Work — both only relevant when this
            Business actually travels to the customer; see `showTravelFees` above. */}
        {showTravelFees && (
          <>
            <TravelFeesSection
              cityFees={cityFees}
              toggleCityActive={toggleCityActive}
              updateCityFee={updateCityFee}
            />

            <div className="flex flex-col gap-4 w-full select-none border-t border-neutral-200/55 pt-6">
              <span className="font-poppins text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                HOW TRAVEL FEES WORK
              </span>

              <div className="flex flex-col gap-3.5 w-full">
                {[
                  "Customer selects your service and enters their city and address.",
                  "Bookly automatically adds your city travel fee to the total. It is shown as a separate line: \"Travel fee — €20.00\".",
                  "Bookly's commission applies to the service price only — never to your travel fee. You keep 100% of the travel fee.",
                  "Customer pays the full balance including travel fee directly at the time of the visit."
                ].map((stepText, idx) => (
                  <div key={idx} className="flex items-start gap-3 w-full">
                    <div className="w-[22px] h-[22px] bg-[#E1F5EE] text-[#085041] rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-xs md:text-sm font-medium text-neutral-900 leading-relaxed pt-0.5">
                      {stepText}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

      </fieldset>

        {/* 13. Footer Actions (Save Changes / Cancel) */}
        <div className="flex flex-row justify-end items-center gap-3 w-full border-t border-neutral-200 pt-6 mt-4">
          <button
            onClick={onBack}
            className="h-9 px-6 bg-[#EBEBEB] hover:bg-neutral-200 text-[#757575] font-poppins font-semibold text-xs rounded-lg transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveChanges}
            disabled={
              isReadOnly ||
              updateBusinessMutation.isPending ||
              updateBusinessTravelSettingsMutation.isPending
            }
            className="h-9 px-6 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save changes
          </button>
        </div>

      </div>

      {/* Rename Service Category dialog */}
      {renamingCategory && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setRenamingCategory(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <span className="font-poppins font-semibold text-base text-[#111111]">
                Rename Service Category
              </span>
            </div>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              maxLength={60}
              autoFocus
              className="h-10 bg-white border border-[#D3D1C7] rounded-lg px-3 text-sm font-poppins focus:outline-none focus:border-black"
            />
            <div className="flex flex-row justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingCategory(null)}
                className="h-9 px-4 bg-[#EBEBEB] hover:bg-neutral-200 text-[#757575] font-poppins font-semibold text-xs rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateServiceCategoryMutation.isPending || !renameInput.trim()}
                onClick={submitRenameCategory}
                className="h-9 px-4 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      </div></main>
  );
}
