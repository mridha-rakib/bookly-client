"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import FilterSidebar from "@/components/explore/FilterSidebar";
import MobileFilterDrawer from "@/components/explore/MobileFilterDrawer";
import ResultsList from "@/components/explore/ResultsList";

import { useAuthStore } from "@/lib/auth/store";
import { useDiscoveryCategoriesQuery, useDiscoverySearchQuery } from "@/lib/discovery/hooks";
import { discoveryCardToRecommendation } from "@/lib/discovery/card";
import {
  useAddFavoriteMutation,
  useFavoriteIdsQuery,
  useRemoveFavoriteMutation,
} from "@/lib/favorite/hooks";
import type { DiscoverySortOption } from "@/lib/api/discovery";
import type { BusinessCity } from "@/lib/constants/cities";

const ExploreMap = dynamic(() => import("@/components/explore/ExploreMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-neutral-100 rounded-2xl flex items-center justify-center border border-[#E5E5E5]/50">
      <span className="text-sm text-gray-500 animate-pulse font-medium">Loading Map Engine...</span>
    </div>
  ),
});

const SORT_LABEL_TO_OPTION: Record<string, DiscoverySortOption> = {
  "Most relevant": "mostRelevant",
  "Rating (High to Low)": "ratingHighToLow",
  "Price (Low to High)": "priceLowToHigh",
  "Price (High to Low)": "priceHighToLow",
};

const PAGE_SIZE = 12;

// Shared with the homepage discovery rows — see lib/discovery/card.ts.
const cardToRecommendation = discoveryCardToRecommendation;

export default function ExplorePage() {
  const router = useRouter();
  const authUser = useAuthStore((state) => state.user);
  const authStatus = useAuthStore((state) => state.status);
  const isLoggedIn = authStatus === "authenticated" && authUser?.role === "CUSTOMER";
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  // Filter states — all real (search/travelsToYou/categories/locations/rating/sort) except the
  // ones explicitly confirmed to have no real backing (quick actions/distance/availability),
  // which stay exactly as inert as they already were rather than being faked or removed.
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [travelsToYou, setTravelsToYou] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<BusinessCity[]>([]);
  const [selectedRatings, setSelectedRatings] = useState<number[]>([]);
  const [selectedQuickActions, setSelectedQuickActions] = useState<string[]>([]);
  const [distanceLimit, setDistanceLimit] = useState(15);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("Most relevant");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Filtering is already live via the searchParams dependency array below; this just lets the
  // Filter/submit buttons skip the debounce delay instead of being no-ops.
  const applyFiltersNow = () => setDebouncedQuery(searchQuery.trim());

  // Any filter change resets to page 1 — a stale page number past the new result count would
  // otherwise show an empty page silently. Applied during render (the "adjusting state" pattern)
  // by comparing against the previous filter signature, rather than inside a useEffect.
  const filterSignature = JSON.stringify([
    debouncedQuery,
    travelsToYou,
    selectedCategories,
    selectedLocations,
    selectedRatings,
    sortBy,
  ]);
  const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
  if (filterSignature !== prevFilterSignature) {
    setPrevFilterSignature(filterSignature);
    setPage(1);
  }

  const searchParams = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      city: selectedLocations.length > 0 ? selectedLocations : undefined,
      visitType: travelsToYou ? ("TRAVEL_TO_CUSTOMER" as const) : undefined,
      category: selectedCategories.length > 0 ? selectedCategories : undefined,
      minRating: selectedRatings.length > 0 ? Math.min(...selectedRatings) : undefined,
      sort: SORT_LABEL_TO_OPTION[sortBy] ?? "mostRelevant",
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedQuery, selectedLocations, travelsToYou, selectedCategories, selectedRatings, sortBy, page],
  );

  const searchQueryResult = useDiscoverySearchQuery(searchParams);
  const categoriesQuery = useDiscoveryCategoriesQuery();
  const favoriteIdsQuery = useFavoriteIdsQuery(isLoggedIn);
  const addFavoriteMutation = useAddFavoriteMutation();
  const removeFavoriteMutation = useRemoveFavoriteMutation();

  const total = searchQueryResult.data?.pagination.total ?? 0;
  const recommendations = useMemo(
    () => (searchQueryResult.data?.businesses ?? []).map(cardToRecommendation),
    [searchQueryResult.data],
  );
  const favoriteIds = favoriteIdsQuery.data?.businessIds ?? [];

  const handleToggleFavorite = (id: string) => {
    if (!isLoggedIn) {
      router.push("/customer");
      return;
    }
    if (favoriteIds.includes(id)) {
      removeFavoriteMutation.mutate(id);
    } else {
      addFavoriteMutation.mutate(id);
    }
  };

  const handleClearAll = () => {
    setSearchQuery("");
    setTravelsToYou(false);
    setSelectedCategories([]);
    setSelectedLocations([]);
    setSelectedRatings([]);
    setSelectedQuickActions([]);
    setDistanceLimit(15);
    setSelectedAvailability([]);
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const toggleLocation = (loc: string) => {
    setSelectedLocations((prev) =>
      prev.includes(loc as BusinessCity)
        ? prev.filter((l) => l !== loc)
        : [...prev, loc as BusinessCity],
    );
  };

  const toggleRating = (rating: number) => {
    setSelectedRatings((prev) => (prev.includes(rating) ? prev.filter((r) => r !== rating) : [...prev, rating]));
  };

  const toggleQuickAction = (action: string) => {
    setSelectedQuickActions((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));
  };

  const toggleAvailability = (avail: string) => {
    setSelectedAvailability((prev) => (prev.includes(avail) ? prev.filter((a) => a !== avail) : [...prev, avail]));
  };

  return (
    <div className="min-h-screen bg-[#FCFAF9] flex flex-col relative text-[#1C1B1C] font-poppins ">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={() => {}}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      {/* Main Container */}
      <main className="flex-1 w-full px-4 md:px-16 flex flex-col gap-6 mb-[149px]">

        {/* Explore Columns layout */}
        <div className="w-full flex flex-col lg:flex-row gap-10 items-start relative mt-4 min-h-[950px]">

          {/* LEFT SIDEBAR FILTERS (Desktop/Lg devices) */}
          {!showMap && (
            <FilterSidebar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              travelsToYou={travelsToYou}
              setTravelsToYou={setTravelsToYou}
              categories={categoriesQuery.data?.categories ?? []}
              selectedCategories={selectedCategories}
              toggleCategory={toggleCategory}
              selectedLocations={selectedLocations}
              toggleLocation={toggleLocation}
              selectedRatings={selectedRatings}
              toggleRating={toggleRating}
              selectedQuickActions={selectedQuickActions}
              toggleQuickAction={toggleQuickAction}
              distanceLimit={distanceLimit}
              setDistanceLimit={setDistanceLimit}
              selectedAvailability={selectedAvailability}
              toggleAvailability={toggleAvailability}
              handleClearAll={handleClearAll}
              showMap={showMap}
              setShowMap={setShowMap}
              onApplyFilters={applyFiltersNow}
            />
          )}
    <div className="flex-1 w-full">

  {/* RIGHT SIDE CONTENT CONTAINER (Contains list & map split container) */}
          <ResultsList
            filteredServices={recommendations}
            isLoading={searchQueryResult.isLoading}
            isError={searchQueryResult.isError}
            total={total}
            page={page}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            favorites={favoriteIds}
            handleToggleFavorite={handleToggleFavorite}
            viewMode={viewMode}
            setViewMode={setViewMode}
            sortBy={sortBy}
            setSortBy={setSortBy}
            showMap={showMap}
            setShowMap={setShowMap}
            setShowMobileFilters={setShowMobileFilters}
            onResetFilters={handleClearAll}
          />

 {/* Footer Business Banner Section */}
        <section className="w-full max-w-[704px] mx-auto mt-[72px]  p-8 sm:p-12 bg-white border border-neutral-100 rounded-[20px] flex flex-col items-center text-center gap-6 shadow-[0px_4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex flex-col gap-3 items-center">
            <h3 className="font-bold text-xl sm:text-2xl text-[#1C1B1C]">Is your business not listed?</h3>
            <p className="text-sm sm:text-base text-[#4E5F78] leading-relaxed max-w-md">
              Join Bookly and start receiving online bookings. Zero monthly fees. No-show protection from day one.
            </p>
          </div>
          <button
            onClick={() => router.push("/professional/signup")}
            className="bg-[#2E9DA7] hover:bg-[#238189] text-white font-semibold text-sm px-8 py-3 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            List your business - it&apos;s free
          </button>
        </section>
</div>


        </div>


      </main>

      {/* MOBILE DRAWERS OVERLAY FILTER (Collapsible on mobile) */}
      <MobileFilterDrawer
        showMobileFilters={showMobileFilters}
        setShowMobileFilters={setShowMobileFilters}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        travelsToYou={travelsToYou}
        setTravelsToYou={setTravelsToYou}
        categories={categoriesQuery.data?.categories ?? []}
        selectedCategories={selectedCategories}
        toggleCategory={toggleCategory}
        selectedLocations={selectedLocations}
        toggleLocation={toggleLocation}
        selectedRatings={selectedRatings}
        toggleRating={toggleRating}
        selectedQuickActions={selectedQuickActions}
        toggleQuickAction={toggleQuickAction}
        distanceLimit={distanceLimit}
        setDistanceLimit={setDistanceLimit}
        selectedAvailability={selectedAvailability}
        toggleAvailability={toggleAvailability}
        handleClearAll={handleClearAll}
      />

      {/* MOBILE MAP OVERLAY MODAL (Full screen on mobile) */}
      {showMap && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col lg:hidden animate-in slide-in-from-bottom duration-500 ease-out">

          {/* Header */}
          <div className="flex items-center justify-between w-full px-6 py-4 border-b border-neutral-100 bg-white">
            <span className="font-bold text-lg text-black">Business Locations Map</span>
            <button
              onClick={() => setShowMap(false)}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-gray-600 cursor-pointer transition-colors"
              aria-label="Close Map"
            >
              ✕
            </button>
          </div>

          {/* Map Container */}
          <div className="flex-1 w-full bg-neutral-50 relative">
            <ExploreMap services={recommendations} />
          </div>

        </div>
      )}

    </div>
  );
}
