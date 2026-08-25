"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FilterHorizontalIcon,
  Search01Icon,
  StarIcon,
  MapsIcon,
} from "@hugeicons/core-free-icons";
import { BUSINESS_CITIES } from "@/lib/constants/cities";

export interface FilterSidebarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  travelsToYou: boolean;
  setTravelsToYou: (val: boolean) => void;
  /** Batch 16 — real, derived from the DISTINCT category strings actually present on visible
   * Businesses (no invented taxonomy — see lib/discovery/hooks.ts's useDiscoveryCategoriesQuery). */
  categories: string[];
  selectedCategories: string[];
  toggleCategory: (cat: string) => void;
  selectedLocations: string[];
  toggleLocation: (loc: string) => void;
  selectedRatings: number[];
  toggleRating: (rating: number) => void;
  selectedQuickActions: string[];
  toggleQuickAction: (action: string) => void;
  distanceLimit: number;
  setDistanceLimit: (val: number) => void;
  selectedAvailability: string[];
  toggleAvailability: (avail: string) => void;
  handleClearAll: () => void;
  showMap: boolean;
  setShowMap: (val: boolean) => void;
}

export default function FilterSidebar({
  searchQuery,
  setSearchQuery,
  travelsToYou,
  setTravelsToYou,
  categories,
  selectedCategories,
  toggleCategory,
  selectedLocations,
  toggleLocation,
  selectedRatings,
  toggleRating,
  selectedQuickActions,
  toggleQuickAction,
  distanceLimit,
  setDistanceLimit,
  selectedAvailability,
  toggleAvailability,
  handleClearAll,
  showMap,
  setShowMap,
}: FilterSidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col items-start px-3 gap-6 w-[284px] bg-white border border-[#E5E5E5]/50 rounded-2xl py-6 shrink-0 shadow-sm sticky top-24 h-fit">
      
      {/* Filter & View Map Row */}
      <div className="flex flex-row items-center gap-3 w-full self-stretch">
        <button 
          onClick={() => {}}
          className="flex flex-row items-center justify-center py-2 px-4 gap-2 h-10 bg-[#000000] text-white rounded-xl text-sm font-semibold cursor-pointer shrink-0 transition-colors hover:bg-neutral-800 whitespace-nowrap"
        >
          <HugeiconsIcon icon={FilterHorizontalIcon} size={18} className="text-white" />
          <span>Filter</span>
        </button>
        <button 
          onClick={() => setShowMap(!showMap)}
          className={`box-border flex flex-row items-center justify-center py-2 px-4 gap-2 h-10 border rounded-xl text-sm font-semibold cursor-pointer shrink-0 transition-colors whitespace-nowrap ${showMap ? "bg-black text-white border-black" : "border-[#000000] text-[#111111] bg-white hover:bg-neutral-50"}`}
        >
          <HugeiconsIcon icon={MapsIcon} />
          <span>View Map</span>
        </button>
      </div>

      {/* Search Input Box */}
      <div className="flex items-center border border-[#ACAAB4] rounded-full h-[52px] w-full pl-4 pr-[2px] bg-white justify-between shadow-sm">
        <HugeiconsIcon icon={Search01Icon} size={24} className="text-[#4E5F78] mr-3 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="flex-1 w-0 bg-transparent border-none outline-none text-base placeholder-[#ACAAB4] text-[#1C1B1C]"
        />
        <button 
          onClick={() => {}} // Search submit
          className="w-12 h-12 rounded-full bg-[#111111] hover:bg-black flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors"
          aria-label="Submit search"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* Travels to You Toggle */}
      <div className="flex items-center justify-between w-full py-1">
        <div className="flex flex-col">
          <span className="font-semibold text-xs text-[#1C1B1C]">We Came to you</span>
          <span className="text-[9px] text-[#757575]">Show businesses that come to you</span>
        </div>
        <button 
          onClick={() => setTravelsToYou(!travelsToYou)}
          className={`w-[46px] h-[24px] rounded-full p-0.5 flex items-center transition-colors cursor-pointer ${travelsToYou ? "bg-[#2BB54F] justify-end" : "bg-[#EDEDED] justify-start"}`}
        >
          <div className="w-[20px] h-[20px] rounded-full bg-white shadow-sm" />
        </button>
      </div>

      <hr className="w-full border-t border-neutral-100" />

      {/* Category Section */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-semibold text-xs text-black uppercase tracking-wider">Category</span>
        <div className="flex flex-col gap-2.5">
          {categories.length === 0 ? (
            <span className="text-xs text-[#ACAAB4]">No categories yet</span>
          ) : (
            categories.map((cat) => (
              <div key={cat} className="flex flex-col gap-2">
                <div className="flex items-center justify-between w-full">
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="w-4 h-4 border border-neutral-300 rounded cursor-pointer accent-black"
                    />
                    <span className="text-[#4E5F78]">{cat}</span>
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <hr className="w-full border-t border-neutral-100" />

      {/* Quick Actions Section */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-semibold text-xs text-black uppercase tracking-wider">Quick actions</span>
        <div className="flex flex-col gap-2.5">
          {["Recommended", "Services near you", "Trending services"].map((action, idx) => (
            <label key={idx} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedQuickActions.includes(action)}
                onChange={() => toggleQuickAction(action)}
                className="w-4 h-4 border border-neutral-300 rounded cursor-pointer accent-black"
              />
              <span className="text-[#4E5F78]">{action}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="w-full border-t border-neutral-100" />

      {/* Business Location Section */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-semibold text-xs text-black uppercase tracking-wider">Business Location</span>
        <div className="flex flex-col gap-2.5">
          {BUSINESS_CITIES.map((loc, idx) => (
            <label key={idx} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedLocations.includes(loc)}
                onChange={() => toggleLocation(loc)}
                className="w-4 h-4 border border-neutral-300 rounded accent-black"
              />
              <span className="text-[#4E5F78]">{loc}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="w-full border-t border-neutral-100" />

      {/* Rating Section */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-semibold text-xs text-black uppercase tracking-wider">Rating</span>
        <div className="flex flex-col gap-2.5">
          {[4.9, 4.8, 4.5, 4.0].map((rating, idx) => (
            <label key={idx} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRatings.includes(rating)}
                onChange={() => toggleRating(rating)}
                className="w-4 h-4 border border-neutral-300 rounded cursor-pointer accent-black"
              />
              <div className="flex items-center gap-1">
                <HugeiconsIcon icon={StarIcon} size={14} className="text-[#FBBC05] fill-[#FBBC05]" />
                <span className="text-[#4E5F78]">{rating} & up</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      <hr className="w-full border-t border-neutral-100" />

      {/* Distance Section */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-semibold text-xs text-black uppercase tracking-wider">Distance</span>
        <div className="flex flex-col gap-2 w-full px-1">
          <input
            type="range"
            min="1"
            max="30"
            value={distanceLimit}
            onChange={(e) => setDistanceLimit(Number(e.target.value))}
            className="w-full h-1 bg-[#EDEDED] rounded-lg appearance-none cursor-pointer accent-black"
          />
          <div className="flex justify-between text-[10px] text-[#757575] font-medium mt-1">
            <span>5 km</span>
            <span>10 km</span>
            <span>20 km</span>
          </div>
        </div>
      </div>

      <hr className="w-full border-t border-neutral-100" />

      {/* Availability Section */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-semibold text-xs text-black uppercase tracking-wider">Availability</span>
        <div className="flex flex-col gap-2.5">
          {["Today", "This week", "This weekend", "Weekends", "Evenings"].map((avail, idx) => (
            <label key={idx} className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAvailability.includes(avail)}
                onChange={() => toggleAvailability(avail)}
                className="w-4 h-4 border border-neutral-300 rounded cursor-pointer accent-black"
              />
              <span className="text-[#4E5F78]">{avail}</span>
            </label>
          ))}
        </div>
      </div>

      <hr className="w-full border-t border-neutral-100" />

      {/* Clear All button */}
      <button
        onClick={handleClearAll}
        className="w-full py-2.5 border border-neutral-200 hover:border-black text-[#1C1B1C] font-semibold text-xs rounded-xl shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center bg-white"
      >
        Clear all
      </button>

    </aside>
  );
}
