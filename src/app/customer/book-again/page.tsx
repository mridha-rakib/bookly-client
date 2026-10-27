"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";

// Components
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookAgainCard from "@/components/landing-page/BookAgainCard";
import { bookAgainHref } from "@/lib/bookings/book-again";

import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import { useBookAgainCandidatesQuery } from "@/lib/bookings/hooks";
import {
  useAddFavoriteMutation,
  useFavoriteIdsQuery,
  useRemoveFavoriteMutation,
} from "@/lib/favorite/hooks";

const PAGE_SIZE = 12;

export default function BookAgainPage() {
  return (
    <RequireCustomer>
      <BookAgainPageContent />
    </RequireCustomer>
  );
}

function BookAgainPageContent() {
  const router = useRouter();

  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const [currentPage, setCurrentPage] = useState(1);

  const candidatesQuery = useBookAgainCandidatesQuery({ page: currentPage, limit: PAGE_SIZE });
  const favoriteIdsQuery = useFavoriteIdsQuery(isLoggedIn);
  const addFavoriteMutation = useAddFavoriteMutation();
  const removeFavoriteMutation = useRemoveFavoriteMutation();

  const candidates = candidatesQuery.data?.candidates ?? [];
  const total = candidatesQuery.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const favoriteIds = favoriteIdsQuery.data?.businessIds ?? [];

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleToggleFavorite = (businessId: string) => {
    if (!isLoggedIn) {
      router.push("/customer");
      return;
    }
    if (favoriteIds.includes(businessId)) {
      removeFavoriteMutation.mutate(businessId);
    } else {
      addFavoriteMutation.mutate(businessId);
    }
  };

  // Real re-navigation into the existing, real venue/booking wizard — never a second booking
  // engine. `serviceId` is an optional pre-selection hint only; the venue page re-validates it
  // against the CURRENT real catalog and silently ignores it if the Service is no longer offered
  // (confirmed rule: never resurrect a historical Service configuration).
  const handleRebook = (businessId: string, serviceId: string) => {
    router.push(bookAgainHref(businessId, serviceId));
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden font-poppins">

      {/* Navbar */}
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      {/* Breadcrumbs Section */}
      <div className="w-full px-4 md:px-8 xl:px-[65px] ">
        <nav className="flex flex-row items-center p-0 gap-3 h-6">
          <button
            onClick={() => router.push("/")}
            className="font-poppins font-normal text-xs sm:text-sm leading-5 tracking-[0.075em] uppercase text-[#757575] hover:text-black transition-colors cursor-pointer"
          >
            Home
          </button>
          <div className="w-6 h-6 flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9.5 7L14.5 12L9.5 17" stroke="#757575" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-poppins font-normal text-xs sm:text-sm leading-5 tracking-[0.075em] uppercase text-black font-semibold">
            Book Again
          </span>
        </nav>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] mt-[40px] flex flex-col gap-8 z-10 relative">
        {/* Title and Subtitle */}
        <div className="flex flex-col gap-1">
          <h1 className="font-manrope font-bold text-2xl sm:text-[32px] sm:leading-[40px] text-[#1C1B1C]">
            Book again
          </h1>
          <p className="font-poppins font-normal text-sm text-[#757575]">
            Businesses that you have already visited
          </p>
        </div>

        {!isLoggedIn ? (
          <div className="w-full text-center py-20">
            <p className="text-[#757575] text-lg font-medium mb-4">Log in to see your booking history.</p>
            <button
              onClick={() => router.push("/customer")}
              className="py-3 px-6 bg-[#131313] hover:bg-black text-white rounded-full text-sm font-semibold transition-colors cursor-pointer"
            >
              Log in
            </button>
          </div>
        ) : candidatesQuery.isLoading ? (
          <div className="w-full text-center py-20">
            <p className="text-[#757575] text-lg font-medium">Loading your booking history…</p>
          </div>
        ) : candidatesQuery.isError ? (
          <div className="w-full text-center py-20">
            <p className="text-[#757575] text-lg font-medium">Your booking history could not be loaded right now.</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="w-full text-center py-20">
            <p className="text-[#757575] text-lg font-medium">
              You don&apos;t have any completed bookings to repeat yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-[20px] justify-items-start w-full mt-4">
            {candidates.map((item) => {
              const isFav = favoriteIds.includes(item.businessId);
              return (
                <BookAgainCard key={item.originalBookingId} item={item} isFav={isFav}
                  onToggleFavorite={handleToggleFavorite} onRebook={handleRebook} />
              );
            })}
          </div>
        )}

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8 mb-12">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                currentPage === 1
                  ? "border-[#E8E6FF] text-neutral-300 cursor-not-allowed"
                  : "border-[#ACAAB4]/40 hover:bg-neutral-100 text-[#1C1B1C]"
              }`}
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} size={18} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-all cursor-pointer ${
                  currentPage === page
                    ? "bg-[#131313] border-[#131313] text-white"
                    : "border-[#ACAAB4]/40 hover:bg-neutral-100 text-[#1C1B1C]"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                currentPage === totalPages
                  ? "border-[#E8E6FF] text-neutral-300 cursor-not-allowed"
                  : "border-[#ACAAB4]/40 hover:bg-neutral-100 text-[#1C1B1C]"
              }`}
            >
              <HugeiconsIcon icon={ArrowRight02Icon} size={18} />
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
