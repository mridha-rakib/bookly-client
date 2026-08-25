"use client";

import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  ArrowRight02Icon,
  StarIcon,
} from "@hugeicons/core-free-icons";
import { BUSINESS_CITIES } from "@/lib/constants/cities";

export interface MobileFilterDrawerProps {
  showMobileFilters: boolean;
  setShowMobileFilters: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  travelsToYou: boolean;
  setTravelsToYou: (val: boolean) => void;
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
}

export default function MobileFilterDrawer({
  showMobileFilters,
  setShowMobileFilters,
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
}: MobileFilterDrawerProps) {
  return (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-start transition-opacity duration-300 ease-out xl:hidden ${showMobileFilters ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
      <div className={`w-full sm:max-w-[400px] bg-[#FCFAF9] h-full flex flex-col transition-transform duration-300 ease-out shadow-2xl relative ${showMobileFilters ? "translate-x-0" : "-translate-x-full"}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between w-full px-6 py-5 border-b border-neutral-100 bg-white">
          <span className="font-bold text-xl text-black">Filters</span>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleClearAll} 
              className="text-sm text-[#6950F3] font-semibold hover:underline cursor-pointer"
            >
              Clear all
            </button>
            <button 
              onClick={() => setShowMobileFilters(false)} 
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-gray-600 cursor-pointer transition-colors"
              aria-label="Close filters"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Filters Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6 scrollbar-hide pb-28">
          
          {/* Mobile Search input */}
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
              onClick={() => setShowMobileFilters(false)}
              className="w-12 h-12 rounded-full bg-[#111111] hover:bg-black flex items-center justify-center text-white shrink-0 cursor-pointer transition-colors"
            >
              <HugeiconsIcon icon={ArrowRight02Icon} size={16} className="text-white" />
            </button>
          </div>

          {/* Travels to you mobile */}
          <div className="flex items-center justify-between w-full bg-white p-4 rounded-xl border border-neutral-100">
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-[#1C1B1C]">We Came to you</span>
              <span className="text-xs text-[#757575]">Show businesses that come to you</span>
            </div>
            <button 
              onClick={() => setTravelsToYou(!travelsToYou)}
              className={`w-[60px] h-[30px] rounded-full p-1 flex items-center transition-colors cursor-pointer ${travelsToYou ? "bg-[#2BB54F] justify-end" : "bg-[#EDEDED] justify-start"}`}
            >
              <div className="w-[22px] h-[22px] rounded-full bg-white shadow-sm" />
            </button>
          </div>

          {/* Categories filter mobile */}
          <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-neutral-100">
            <span className="font-semibold text-xs text-black uppercase tracking-wider">Category</span>
            <div className="flex flex-col gap-3.5">
              {categories.length === 0 ? (
                <span className="text-xs text-[#ACAAB4]">No categories yet</span>
              ) : (
                categories.map((cat) => (
                  <label key={cat} className="flex items-center gap-2.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="w-4 h-4 border border-neutral-300 rounded cursor-pointer accent-black"
                    />
                    <span className="text-[#4E5F78]">{cat}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions filter mobile */}
          <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-neutral-100">
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

          {/* Locations filter mobile */}
          <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-neutral-100">
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

          {/* Ratings Filter mobile */}
          <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-neutral-100">
            <span className="font-semibold text-xs text-black uppercase tracking-wider">Rating</span>
            <div className="flex flex-col gap-2.5">
              {[4.9, 4.8, 4.5, 4.0].map((rating, idx) => (
                <label key={idx} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedRatings.includes(rating)}
                    onChange={() => toggleRating(rating)}
                    className="w-4 h-4 border border-[#ACAAB4] rounded accent-black cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    <HugeiconsIcon icon={StarIcon} size={14} className="text-[#FBBC05] fill-[#FBBC05]" />
                    <span className="text-[#4E5F78]">{rating} & up</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Distance Filter mobile */}
          <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-neutral-100">
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

          {/* Availability filter mobile */}
          <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-neutral-100">
            <span className="font-semibold text-xs text-black uppercase tracking-wider">Availability</span>
            <div className="flex flex-col gap-2.5">
              {["Today", "This week", "This weekend", "Weekends", "Evenings"].map((avail, idx) => (
                <label key={idx} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAvailability.includes(avail)}
                    onChange={() => toggleAvailability(avail)}
                    className="w-4 h-4 border border-[#ACAAB4] rounded accent-black cursor-pointer"
                  />
                  <span className="text-[#4E5F78]">{avail}</span>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Sticky Action Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-white/90 border-t border-neutral-100 flex items-center justify-center z-10">
          <button 
            onClick={() => setShowMobileFilters(false)}
            className="w-full max-w-md py-3.5 bg-black hover:bg-neutral-800 text-white text-sm font-semibold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Apply Filters
          </button>
        </div>

      </div>
    </div>
  );
}
