"use client";

import React from "react";

interface SuperAdminBusinessesFilterProps {
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  categoryOptions: string[];
}

export default function SuperAdminBusinessesFilter({
  selectedCity,
  setSelectedCity,
  selectedType,
  setSelectedType,
  selectedCategory,
  setSelectedCategory,
  categoryOptions,
}: SuperAdminBusinessesFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={selectedCity}
        onChange={(e) => setSelectedCity(e.target.value)}
        className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7]"
      >
        <option value="All">City</option>
        <option value="Nicosia">Nicosia</option>
        <option value="Limassol">Limassol</option>
        <option value="Paphos">Paphos</option>
        <option value="Larnaca">Larnaca</option>
        <option value="Ayia Napa">Ayia Napa</option>
        <option value="Protaras">Protaras</option>
      </select>

      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
        className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7]"
      >
        <option value="All">Business Type</option>
        <option value="AT_BUSINESS_LOCATION">Premises</option>
        <option value="TRAVEL_TO_CUSTOMER">Mobile</option>
      </select>

      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        className="bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#314158] focus:outline-none focus:ring-1 focus:ring-[#2E9DA7]"
      >
        <option value="All">Category</option>
        {categoryOptions.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </div>
  );
}
