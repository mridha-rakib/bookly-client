"use client";

import Image from "next/image";
import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  UNKNOWN_BUSINESS_CATEGORY_ICON,
  getBusinessCategoryIconSrc,
} from "@/lib/business-category/categoryIcon";

export interface TaxonomyOption {
  key: string;
  label: string;
}

export interface CategorySelectorStep2Props {
  /** All canonical parent categories (fetched from the taxonomy — never hardcoded here). */
  categories: TaxonomyOption[];
  selectedCategoryKey: string;
  setSelectedCategoryKey: (key: string) => void;
  /** ONLY the selected parent's subcategories — never the full cross-category list. Empty
   * until a category is selected. */
  subcategories: TaxonomyOption[];
  selectedSubcategoryKeys: string[];
  handleSubcategoryToggle: (key: string) => void;
  onDone: () => void;
  error?: string;
}

export default function CategorySelectorStep2({
  categories,
  selectedCategoryKey,
  setSelectedCategoryKey,
  subcategories,
  selectedSubcategoryKeys,
  handleSubcategoryToggle,
  onDone,
  error,
}: CategorySelectorStep2Props) {
  return (
    <div className="w-full max-w-[1443px] flex flex-col items-center gap-[72px] mt-10 px-4 md:px-8 xl:px-0">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <h1 className="text-[24px] md:text-[28px] font-medium text-[#262626] leading-9">
          Select category that best describe your business
        </h1>
      </div>

      {/* Category Cards */}
      {/* min-h (not the plain fixed height every card used before) is sized for the longest
          canonical label ("Professional Services/ Consulting & Coaching", 4 wrapped lines at this
          card width) so every card — long label or short — shares the same box; a short label
          just centers with more surrounding space instead of the grid growing one isolated card
          taller than its row neighbors. */}
      <div className="w-full flex flex-wrap items-center justify-center gap-4 md:gap-6 min-h-[152px] py-4 md:py-0">
        {categories.map((cat) => {
          const isSelected = selectedCategoryKey === cat.key;
          // Approved Business Category SVG — the shared map, identical to the homepage bar.
          // Categories with no approved icon yet (e.g. newly-added ones) fall back to the
          // generic glyph below rather than a broken image.
          const iconSrc = getBusinessCategoryIconSrc(cat.label);
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setSelectedCategoryKey(cat.key)}
              className={`w-[185.6px] min-h-[152px] rounded-xl flex flex-col items-center justify-center p-[12px_20px] gap-2 cursor-pointer transition-all duration-200 border ${isSelected
                ? "bg-[#111111] text-white border-transparent shadow-lg"
                : "bg-white text-[#817469] border-[#E8E8E4] hover:bg-[#FAF9F7]"
                }`}
            >
              {/* Icon — the approved SVG already carries its own #EDE3DE rounded 32×32
                  container, so it replaces the former icon chip (no doubled background). */}
              {iconSrc ? (
                <Image
                  src={iconSrc}
                  alt=""
                  aria-hidden
                  width={32}
                  height={32}
                  className="w-8 h-8 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 bg-[#EDE3DE] rounded flex items-center justify-center text-[#111111] p-1">
                  <HugeiconsIcon icon={UNKNOWN_BUSINESS_CATEGORY_ICON} size={24} />
                </div>
              )}
              {/* Text — break-words is a safety net (not a design change for the current 9
                  labels): none of them contain an unbreakable run this long, but it guarantees a
                  future long label wraps instead of overflowing the card. */}
              <span className="text-sm font-medium tracking-[0.7px] uppercase text-center leading-5 w-[145.6px] break-words">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub Categories Selector — ONLY the selected parent's children */}
      <div className="w-full flex flex-col gap-3">
        <label className="text-xs font-normal text-[#111111] flex items-center justify-center md:justify-start gap-1">
          Sub Category <span className="text-[#E24B4A]">*</span> (select max 5 sub-category)
        </label>
        {!selectedCategoryKey ? (
          <p className="text-xs text-[#817469] text-center md:text-left">
            Select a category above to see its sub-categories.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-center md:justify-start w-full gap-3">
            {subcategories.map((sub) => {
              const isActive = selectedSubcategoryKeys.includes(sub.key);
              return (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => handleSubcategoryToggle(sub.key)}
                  className={`flex flex-row justify-center items-center py-3 px-[18px] gap-2.5 h-11 rounded-[999px] border transition-all duration-150 cursor-pointer whitespace-nowrap ${isActive
                    ? "bg-[#1C1B1C] border-[#1C1B1C]"
                    : "bg-transparent border-[#1C1B1C]"
                    }`}
                >
                  <span
                    className={`font-poppins font-medium text-[14px] leading-[20px] flex items-center justify-center tracking-[0.7px] uppercase h-5 whitespace-nowrap ${isActive ? "text-white" : "text-[#1C1B1C]"
                      }`}
                  >
                    {sub.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {error && (
          <span className="text-xs text-red-500 text-center md:text-left">{error}</span>
        )}
      </div>

      {/* Done Button Row */}
      <div className="w-full flex justify-end mt-4">
        <button
          type="button"
          onClick={onDone}
          className="w-[86.13px] h-[48px] bg-gradient-to-r from-[#8EBAC5] to-[#8EBAC5]/80 hover:scale-105 transition-all duration-150 rounded-xl flex items-center justify-center text-lg font-medium text-[#111111] shadow-md border border-[#8EBAC5]/25 cursor-pointer active:scale-95"
        >
          Done
        </button>
      </div>
    </div>
  );
}
