"use client";

import Image from "next/image";
import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";

export interface Category {
  name: string;
  label: string;
  icon: any;
  containerWidth: string;
  textWidth: string;
}

export interface CategorySelectorStep2Props {
  categories: Category[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedSubcategories: string[];
  handleSubcategoryToggle: (sub: string) => void;
  onDone: () => void;
  error?: string;
}

export default function CategorySelectorStep2({
  categories,
  selectedCategory,
  setSelectedCategory,
  selectedSubcategories,
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
      <div className="w-full flex flex-wrap md:flex-row md:flex-nowrap items-center justify-center md:justify-between gap-4 md:gap-6 min-h-[108px] py-4 md:py-0">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`w-[185.6px] h-[108px] rounded-xl flex flex-col items-center justify-center p-[12px_20px] gap-2 cursor-pointer transition-all duration-200 border ${isSelected
                ? "bg-[#111111] text-white border-transparent shadow-lg"
                : "bg-white text-[#817469] border-[#E8E8E4] hover:bg-[#FAF9F7]"
                }`}
            >
              {/* Icon wrapper */}
              <div className="w-8 h-8 bg-[#EDE3DE] rounded flex items-center justify-center text-[#111111] p-1 gap-2.5">
                {cat.icon ? (
                  <HugeiconsIcon icon={cat.icon} size={24} />
                ) : (
                  <Image src="/Icons/famicon.svg" alt="pets & home" className="w-6 h-6 object-contain" width={24} height={24} />
                )}
              </div>
              {/* Text */}
              <span className="text-sm font-medium tracking-[0.7px] uppercase text-center leading-5 w-[145.6px]">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub Categories Selector */}
      <div className="w-full flex flex-col gap-3">
        <label className="text-xs font-normal text-[#111111] flex items-center justify-center md:justify-start gap-1">
          Sub Category <span className="text-[#E24B4A]">*</span> (select max 5 sub-category)
        </label>
        <div className="flex flex-wrap md:flex-row items-center justify-center md:justify-between w-full gap-4 md:gap-0">
          {categories.map((cat) => {
            const isActive = selectedSubcategories.includes(cat.name);
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => handleSubcategoryToggle(cat.name)}
                className={`flex flex-row justify-center items-center py-3 px-[18px] gap-2.5 ${cat.containerWidth} h-11 rounded-[999px] border transition-all duration-150 cursor-pointer ${isActive
                  ? "bg-[#1C1B1C] border-[#1C1B1C]"
                  : "bg-transparent border-[#1C1B1C]"
                  }`}
              >
                <span
                  className={`font-poppins font-medium text-[14px] leading-[20px] flex items-center justify-center tracking-[0.7px] uppercase ${cat.textWidth} h-5 whitespace-nowrap ${isActive ? "text-white" : "text-[#1C1B1C]"
                    }`}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
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
