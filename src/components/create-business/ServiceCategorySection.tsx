"use client";

import React from "react";

// Shared with DashboardCreateBusiness prefill mapping so real backend
// category/subcategory values can be matched to these exact option labels.
export const serviceCategoryOptions = [
  "BEAUTY & WELLNESS",
  "HEALTH & FITNESS",
  "SPORTS & ACTIVITIES",
  "EXPERIENCE & TOURS",
  "ENTERTAINMENT & EVENTS",
  "PETS & HOME",
  "AUTOMOTIVE"
];

interface ServiceCategorySectionProps {
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  selectedSubcategories: string[];
  toggleSubcategory: (sub: string) => void;
  customCategories: string[];
  newCatInput: string;
  setNewCatInput: (v: string) => void;
  addCustomCategory: () => void;
  removeCustomCategory: (cat: string) => void;
}

export default function ServiceCategorySection({
  selectedCategory,
  setSelectedCategory,
  selectedSubcategories,
  toggleSubcategory,
  customCategories,
  newCatInput,
  setNewCatInput,
  addCustomCategory,
  removeCustomCategory
}: ServiceCategorySectionProps) {
  const mainCategories = serviceCategoryOptions;
  const subCategories = serviceCategoryOptions;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 5. Main Category Selection */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-wide">
          Category <span className="text-[#E24B4A]">*</span>
        </span>
        <div className="flex flex-wrap gap-3 select-none">
          {mainCategories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-full text-xs font-medium uppercase tracking-[0.05em] transition-all border ${
                  isSelected
                    ? "bg-[#1C1B1C] text-white border-transparent"
                    : "bg-white text-[#1C1B1C] border-[#1C1B1C] hover:bg-neutral-50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Sub Category Selection */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-poppins text-xs font-semibold text-[#111111]">
          Sub Category <span className="text-[#E24B4A]">*</span> <span className="font-normal text-neutral-400">(select max 5 sub-categories)</span>
        </span>
        <div className="flex flex-wrap gap-3 select-none">
          {subCategories.map((cat) => {
            const isSelected = selectedSubcategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleSubcategory(cat)}
                className={`px-4 py-2.5 rounded-full text-xs font-medium uppercase tracking-[0.05em] transition-all border ${
                  isSelected
                    ? "bg-[#1C1B1C] text-white border-transparent"
                    : "bg-white text-[#1C1B1C] border-[#1C1B1C] hover:bg-neutral-50"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Service Category (Custom Tabs) */}
      <div className="flex flex-col gap-3 w-full">
        <span className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-wide">
          Service Category <span className="font-normal text-neutral-400 lowercase">(add custom tabs for your business e.g. Hair Treatment, Nail Treatment etc.)</span>
        </span>
        <div className="flex flex-col gap-4 w-full">
          {/* Tabs List */}
          <div className="flex flex-wrap gap-2">
            {customCategories.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8E8E4] text-[#111111] rounded-lg text-xs font-medium">
                <span>{cat}</span>
                <button type="button" onClick={() => removeCustomCategory(cat)} className="hover:text-red-500 font-bold ml-1">×</button>
              </div>
            ))}
          </div>

          {/* Input to Add Tab */}
          <div className="flex items-center gap-3 w-full max-w-[450px]">
            <input
              type="text"
              placeholder="Add category..."
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              className="flex-grow h-9 bg-white border border-[#D3D1C7] rounded-lg px-3 text-xs font-poppins focus:outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={addCustomCategory}
              className="h-9 px-4 bg-[#111111] text-white rounded-lg text-xs font-semibold hover:bg-black transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
