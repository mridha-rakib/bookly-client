"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterHorizontalIcon,
  MapsIcon,
  DashboardSquare01Icon,
  ListChevronsDownUpIcon,
  Search01Icon,
  ArrowLeft01Icon,
  ArrowRight02Icon,
} from "@hugeicons/core-free-icons";
import ServiceCard, { Recommendation } from "@/components/ServiceCard";

const ExploreMap = dynamic(() => import("./ExploreMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-neutral-100 rounded-2xl flex items-center justify-center border border-neutral-200">
      <span className="text-sm text-gray-500 animate-pulse font-medium">Loading Map Engine...</span>
    </div>
  ),
});

export interface ResultsListProps {
  filteredServices: Recommendation[];
  isLoading: boolean;
  isError: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  favorites: string[];
  handleToggleFavorite: (id: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  sortBy: string;
  setSortBy: (val: string) => void;
  showMap: boolean;
  setShowMap: (val: boolean) => void;
  setShowMobileFilters: (val: boolean) => void;
  onResetFilters: () => void;
}

export default function ResultsList({
  filteredServices,
  isLoading,
  isError,
  total,
  page,
  pageSize,
  onPageChange,
  favorites,
  handleToggleFavorite,
  viewMode,
  setViewMode,
  sortBy,
  setSortBy,
  showMap,
  setShowMap,
  setShowMobileFilters,
  onResetFilters,
}: ResultsListProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={`flex-grow w-full flex ${showMap ? "lg:flex-row gap-[22px] items-start" : "flex-col gap-6"} bg-white p-6 rounded-2xl border border-[#E5E5E5]/50 shadow-sm`}>

      {/* Results list area */}
      <div className={`flex flex-col gap-6 ${showMap ? "w-full lg:w-[644px] shrink-0" : "w-full"}`}>

        {/* Filter & View Map buttons */}
        <div className={`flex flex-row items-center gap-3 w-full mb-2 ${showMap ? "" : "lg:hidden"}`}>
          <button
            onClick={() => {
              if (showMap) {
                setShowMap(false);
                if (window.innerWidth < 1024) {
                  setShowMobileFilters(true);
                }
              } else {
                setShowMobileFilters(true);
              }
            }}
            className={`box-border flex flex-row items-center justify-center py-2 px-4 gap-2 h-10 border rounded-xl text-sm font-semibold cursor-pointer shrink-0 transition-colors whitespace-nowrap ${showMap ? "border-[#000000] text-[#111111] bg-white hover:bg-neutral-50" : "bg-[#000000] text-white border-black hover:bg-neutral-800"}`}
          >
            <HugeiconsIcon icon={FilterHorizontalIcon} size={18} className={showMap ? "text-black" : "text-white"} />
            <span>Filter</span>
          </button>
          <button
            onClick={() => setShowMap(!showMap)}
            className={`box-border flex flex-row items-center justify-center py-2 px-4 gap-2 h-10 border rounded-xl text-sm font-semibold cursor-pointer shrink-0 transition-colors whitespace-nowrap ${showMap ? "bg-[#000000] text-white border-black" : "border-[#000000] text-[#111111] bg-white hover:bg-neutral-50"}`}
          >
            <HugeiconsIcon icon={MapsIcon} />
            <span>View Map</span>
          </button>
        </div>

        {/* Top Toolbar: Results count & sorting & view switchers */}
        <div className="flex flex-col gap-3 w-full mb-2">
          <div className="flex flex-row items-center justify-between w-full">
            <span className="text-xs sm:text-sm font-medium text-[#757575] font-poppins">
              {isLoading ? (
                "Loading businesses…"
              ) : (
                <>
                  Show results of <strong className="text-black font-semibold">{total} businesses</strong>
                </>
              )}
            </span>

            {/* View switcher buttons (Grid / List) */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${viewMode === "grid" ? "bg-[#E2F0F9] text-black" : "text-gray-400 hover:text-black"}`}
                aria-label="Grid View"
              >
                <HugeiconsIcon icon={DashboardSquare01Icon} size={20} className="stroke-2" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${viewMode === "list" ? "bg-[#E2F0F9] text-black" : "text-gray-400 hover:text-black"}`}
                aria-label="List View"
              >
                <HugeiconsIcon icon={ListChevronsDownUpIcon} size={20} className="stroke-2" />
              </button>
            </div>
          </div>

          {/* Sort selector row */}
          <div className="flex justify-start">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-[#111111]/15 rounded-xl px-3.5 h-[38px] bg-white text-xs font-semibold outline-none cursor-pointer hover:border-black transition-colors"
            >
              <option>Most relevant</option>
              <option>Rating (High to Low)</option>
              <option>Price (Low to High)</option>
              <option>Price (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Grid/List of Results */}
        {isLoading ? (
          <div className="w-full flex flex-col items-center justify-center py-20 bg-white border border-neutral-100 rounded-2xl shadow-sm text-center px-4">
            <span className="text-sm text-gray-500 animate-pulse font-medium">Loading businesses…</span>
          </div>
        ) : isError ? (
          <div className="w-full flex flex-col items-center justify-center py-20 bg-white border border-neutral-100 rounded-2xl shadow-sm text-center px-4">
            <h3 className="font-semibold text-lg text-black mb-1">Something went wrong</h3>
            <p className="text-sm text-gray-500 max-w-sm">We couldn&apos;t load businesses right now. Please try again shortly.</p>
          </div>
        ) : filteredServices.length > 0 ? (
          <div className={viewMode === "grid"
            ? (showMap
                ? "grid grid-cols-1 sm:grid-cols-2 gap-5 w-full justify-items-center"
                : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 w-full justify-items-center")
            : "flex flex-col gap-5 w-full"
          }>
            {filteredServices.map((service) => (
              <div key={service.id} className={viewMode === "list" ? "w-full max-w-[860px]" : "w-full"}>
                <ServiceCard
                  rec={service}
                  isFavorite={favorites.includes(service.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onBookNow={(id) => router.push(`/venue?id=${id}`)}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center py-20 bg-white border border-neutral-100 rounded-2xl shadow-sm text-center px-4">
            <HugeiconsIcon icon={Search01Icon} size={48} className="text-gray-300 mb-4" />
            <h3 className="font-semibold text-lg text-black mb-1">No businesses found</h3>
            <p className="text-sm text-gray-500 max-w-sm">We couldn&apos;t find any results matching your filter criteria. Try expanding your search queries or resetting filters.</p>
            <button
              onClick={onResetFilters}
              className="mt-5 px-6 py-2.5 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !isError && total > 0 && (
          <div className="flex items-center justify-center gap-2 mt-8 py-4">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-gray-400 hover:text-black hover:border-black transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:border-neutral-200"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
            </button>
            <span className="px-3 h-8 rounded-full bg-black text-white flex items-center justify-center font-semibold text-xs">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-gray-400 hover:text-black hover:border-black transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-gray-400 disabled:hover:border-neutral-200"
            >
              <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
            </button>
          </div>
        )}

      </div>

      {/* Desktop Map (right side) */}
      {showMap && (
        <div className="hidden lg:block w-full lg:flex-1 h-[988px] sticky top-24 shrink-0 rounded-2xl overflow-hidden border border-[#E5E5E5]/50 shadow-sm">
          <ExploreMap services={filteredServices} />
        </div>
      )}

    </div>
  );
}
