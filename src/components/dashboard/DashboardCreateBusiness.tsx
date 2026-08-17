"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";


import React, { useEffect, useState } from "react";
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
import LocationSection from "../create-business/LocationSection";
import ServiceCategorySection, { serviceCategoryOptions } from "../create-business/ServiceCategorySection";
import PhotosSection from "../create-business/PhotosSection";
import OpeningHoursSection from "../create-business/OpeningHoursSection";
import BookingTimeControlSection from "../create-business/BookingTimeControlSection";
import ClosedPeriodsSection from "../create-business/ClosedPeriodsSection";
import LeadTimeSettingsSection from "../create-business/LeadTimeSettingsSection";
import AdditionalInfoSection from "../create-business/AdditionalInfoSection";
import TravelFeesSection, { type TravelFeeRow } from "../create-business/TravelFeesSection";
import { buildGoogleMapsEmbedUrl } from "@/lib/maps/google-maps";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import type { BusinessCity, BusinessMedia, UpdateBusinessInput } from "@/lib/api/business";
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
import { toUserMessage } from "@/lib/auth/messages";
import { BUSINESS_CITIES } from "@/lib/constants/cities";
import {
  useCreateServiceCategoryMutation,
  useServiceCategoriesQuery,
  useUpdateServiceCategoryMutation
} from "@/lib/services/hooks";

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

  // Country Dropdown
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countries = [
    { name: "Cyprus", code: "+357", flag: "cy" },
    { name: "Greece", code: "+30", flag: "gr" },
    { name: "United Kingdom", code: "+44", flag: "gb" },
    { name: "United States", code: "+1", flag: "us" }
  ];

  // Category selection (select one)
  const [selectedCategory, setSelectedCategory] = useState("BEAUTY & WELLNESS");
  const categories = [
    "BEAUTY & WELLNESS",
    "HEALTH & FITNESS",
    "SPORTS & ACTIVITIES",
    "EXPERIENCE & TOURS",
    "ENTERTAINMENT & EVENTS",
    "PETS & HOME",
    "AUTOMOTIVE"
  ];

  // Subcategories selection (max 5)
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(["BEAUTY & WELLNESS"]);

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
  const customCategoriesQuery = useServiceCategoriesQuery(mode !== "create" ? businessId : undefined);
  const customCategories = (customCategoriesQuery.data ?? []).map((category) => category.name);
  const createServiceCategoryMutation = useCreateServiceCategoryMutation();
  const updateServiceCategoryMutation = useUpdateServiceCategoryMutation();
  const [newCatInput, setNewCatInput] = useState("");

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

  // Map Coordinates (Larnaca Cyprus default: 34.9172, 33.6232)
  const [searchLocation, setSearchLocation] = useState("Larnaca, Cyprus");
  const [mapUrl, setMapUrl] = useState(buildGoogleMapsEmbedUrl("34.9172,33.6232"));

  const handleLocationSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchLocation.trim()) {
      setMapUrl(buildGoogleMapsEmbedUrl(searchLocation));
    }
  };

  // Real Business Profile data (edit/view only — "create" stays local/mocked; see report).
  const {
    data: business,
    isLoading: isLoadingBusiness,
    isError: isBusinessError,
    error: businessError,
  } = useBusinessQuery(mode !== "create" ? businessId : undefined);
  const updateBusinessMutation = useUpdateBusinessMutation();
  const {
    data: businessMedia = [],
    isError: isBusinessMediaError,
    error: businessMediaError,
  } = useBusinessMediaQuery(mode !== "create" ? businessId : undefined);
  const {
    data: travelSettings,
    isError: isTravelSettingsError,
    error: travelSettingsError,
  } = useBusinessTravelSettingsQuery(mode !== "create" ? businessId : undefined);
  const uploadBusinessMediaMutation = useUploadBusinessMediaMutation();
  const deleteBusinessMediaMutation = useDeleteBusinessMediaMutation();
  const setBusinessProfileMediaMutation = useSetBusinessProfileMediaMutation();
  const updateBusinessTravelSettingsMutation = useUpdateBusinessTravelSettingsMutation();
  const canMutateMedia = mode === "edit" && Boolean(businessId);
  const displayMedia = [...businessMedia].sort((left, right) => {
    if (left.role !== right.role) {
      return left.role === "PROFILE" ? -1 : 1;
    }

    return left.sortOrder - right.sortOrder;
  });

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

  const matchCategoryOption = (value: string): string =>
    serviceCategoryOptions.find((option) => option.toUpperCase() === value.toUpperCase()) ?? value;

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
    setSelectedCategory(matchCategoryOption(business.category));
    setSelectedSubcategories(business.subcategories.map(matchCategoryOption));
    // Registration persists the owner-selected shop location as Business.location
    // {lat, lng, searchQuery}. The map must reflect that exact spot, so lat/lng (the
    // precise pin) takes priority over the human-readable searchQuery text, which is
    // only used to fill the search box display and as a fallback when coordinates are
    // unavailable. The structured address is a last resort for businesses with no
    // persisted location at all — it must never override real registration coordinates.
    if (business.location) {
      const { lat, lng, searchQuery } = business.location;
      setMapUrl(buildGoogleMapsEmbedUrl(`${lat},${lng}`));
      setSearchLocation(searchQuery ?? `${lat}, ${lng}`);
    } else {
      const structuredAddress = [
        business.address.streetNumber,
        business.address.streetName,
        business.address.area,
        business.address.city,
      ]
        .filter(Boolean)
        .join(", ");

      if (structuredAddress) {
        setSearchLocation(structuredAddress);
        setMapUrl(buildGoogleMapsEmbedUrl(structuredAddress));
      }
    }
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

  const handleSaveChanges = async () => {
    if (
      mode !== "edit" ||
      !businessId ||
      updateBusinessMutation.isPending ||
      updateBusinessTravelSettingsMutation.isPending
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
    };

    if (floorUnit) input.floorUnit = floorUnit;
    if (roomNo) input.aptRoom = roomNo;
    if (phoneNumber) {
      input.countryCode = phoneCode;
      input.nationalNumber = phoneNumber;
    }
    if (searchLocation) input.searchQuery = searchLocation;

    const travelSettingsInput = [];

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

    try {
      await updateBusinessMutation.mutateAsync({ businessId, input });
    } catch (error) {
      toast.error(toUserMessage(error));
      return;
    }

    try {
      await updateBusinessTravelSettingsMutation.mutateAsync({
        businessId,
        cities: travelSettingsInput,
      });
      toast.success("Business updated");
      onBack();
    } catch (error) {
      toast.error(`Business details saved, but travel fees could not be saved. ${toUserMessage(error)}`);
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
        />

        {/* 4. Location & Real Map Section */}
        <LocationSection
          searchLocation={searchLocation}
          setSearchLocation={setSearchLocation}
          mapUrl={mapUrl}
          handleLocationSearch={handleLocationSearch}
        />

        {/* 5, 6, 7. Service Categories Section */}
        <ServiceCategorySection
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedSubcategories={selectedSubcategories}
          toggleSubcategory={toggleSubcategory}
          customCategories={customCategories}
          newCatInput={newCatInput}
          setNewCatInput={setNewCatInput}
          addCustomCategory={addCustomCategory}
          removeCustomCategory={removeCustomCategory}
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

        {/* 14. Travel Fees Section */}
        <TravelFeesSection
          cityFees={cityFees}
          toggleCityActive={toggleCityActive}
          updateCityFee={updateCityFee}
        />

        {/* 15. How Travel Fees Work Section */}
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
    
      </div></main>
  );
}
