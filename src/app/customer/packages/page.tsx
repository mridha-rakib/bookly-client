"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SearchBar from "@/components/landing-page/SearchBar";

import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import CustomerPackagesList from "./CustomerPackagesList";

export default function PackagesPage() {
  return (
    <RequireCustomer>
      <PackagesPageContent />
    </RequireCustomer>
  );
}

function PackagesPageContent() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden font-manrope">
      <Navbar
        isLoggedIn
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] flex flex-col z-10 relative items-center">
        {/* Global Search Bar */}
        <div className="w-full flex justify-center mb-8 sm:mb-12">
          <SearchBar />
        </div>

        <div className="max-w-[1005px] w-full flex flex-col items-start gap-8 pb-20">
          {/* 1. Prominent My Packages heading & description */}
          <div className="w-full flex flex-col items-start gap-2">
            <h1 className="font-manrope font-bold text-3xl sm:text-4xl leading-tight tracking-tight text-[#020305]">
              My Packages
            </h1>
            <p className="text-sm sm:text-base text-[#6B7280]">
              Manage your packages, sessions and payments.
            </p>
          </div>

          {/* 2. Segmented control: Appointments vs Packages */}
          <div
            className="flex items-center gap-2 bg-[#F1EFEC] p-1 rounded-2xl w-fit"
            role="tablist"
            aria-label="Booking view switcher"
          >
            <button
              type="button"
              role="tab"
              aria-selected={false}
              onClick={() => router.push("/customer/bookings")}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all text-[#5F5E5A] hover:text-[#020305] cursor-pointer"
            >
              Appointments
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={true}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all bg-white text-[#020305] shadow-sm cursor-default"
            >
              Packages
            </button>
          </div>

          {/* 3. Unified Packages List with Filters & 2-Column Responsive Grid */}
          <CustomerPackagesList />
        </div>
      </main>

      <Footer />
    </div>
  );
}
