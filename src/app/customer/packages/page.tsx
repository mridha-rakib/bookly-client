"use client";

import { useState } from "react";
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
  const logout = useAuthStore((state) => state.logout);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] flex flex-col z-10 relative items-center">
        <div className="w-full flex justify-center mb-[72px]">
          <SearchBar onSearch={() => {}} />
        </div>

        <div className="max-w-[1005px] w-full flex flex-col items-start gap-8 pb-20">
          <h1 className="font-manrope font-bold text-[30px] leading-[36px] tracking-[-0.75px] text-[#020305]">
            My Packages
          </h1>

          <CustomerPackagesList />
        </div>
      </main>

      <Footer />
    </div>
  );
}
