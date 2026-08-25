"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight02Icon, ArrowLeft02Icon } from "@hugeicons/core-free-icons";

// Components
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import EdgeSoftOrbsTop from "@/components/EdgeSoftOrbsTop";
import ServiceCard, { Recommendation } from "@/components/ServiceCard";
import SearchBar from "@/components/landing-page/SearchBar";

import RequireCustomer from "@/components/auth/RequireCustomer";
import { useAuthStore } from "@/lib/auth/store";
import { useFavoritesListQuery, useRemoveFavoriteMutation } from "@/lib/favorite/hooks";
import type { DiscoveryBusinessCard } from "@/lib/api/discovery";

const PAGE_SIZE = 12;

const cardToRecommendation = (card: DiscoveryBusinessCard): Recommendation => ({
  id: card.id,
  title: card.name,
  rating: card.averageRating,
  reviews: card.reviewCount,
  categories: [card.category, ...card.subcategories],
  location: card.city,
  startingPrice: card.startingPriceCents !== null ? Math.round(card.startingPriceCents / 100) : null,
  startingPriceSuffix:
    card.startingPricingMode === "HOURLY" ? "/hr" : card.startingPricingMode === "PER_PERSON" ? "/person" : "",
  image: card.imageUrl ?? null,
  travelsToYou: card.visitType === "TRAVEL_TO_CUSTOMER",
  isAvailable: card.isAvailable,
});

export default function FavoritesPage() {
  return (
    <RequireCustomer>
      <FavoritesPageContent />
    </RequireCustomer>
  );
}

function FavoritesPageContent() {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = true;
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const [currentPage, setCurrentPage] = useState(1);

  const favoritesQuery = useFavoritesListQuery({ page: currentPage, limit: PAGE_SIZE });
  const removeFavoriteMutation = useRemoveFavoriteMutation();

  const favorites = favoritesQuery.data?.favorites ?? [];
  const total = favoritesQuery.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = favorites.map(cardToRecommendation);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleToggleFavorite = (id: string) => {
    // Every card on this page is already favorited — the only real action here is removing.
    removeFavoriteMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF9] flex flex-col relative overflow-x-hidden font-poppins">
      {/* Background Soft Orbs */}
      <EdgeSoftOrbsTop size={380} duration={56} intensity={0.85} blend="screen" zIndex={-5} />

      {/* Navbar */}
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={(val) => {
          if (!val) void logout();
        }}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full px-4 md:px-8 xl:px-[65px] mt-[8px] flex flex-col z-10 relative">

        {/* Reusable Search Bar with same dropdown behavior and styling */}
        <div className="w-full flex justify-center mb-[72px]">
          <SearchBar onSearch={() => router.push("/explore")} />
        </div>

        {/* Title and Subtitle */}
        <div className="flex flex-col gap-1">
          <h1 className="font-manrope font-bold text-2xl sm:text-[32px] sm:leading-[40px] text-[#1C1B1C]">
            My favorites
          </h1>
          <p className="font-poppins font-normal text-sm text-[#757575]">
            My saved businesses and service provider
          </p>
        </div>

        {!isLoggedIn ? (
          <div className="w-full text-center py-20">
            <p className="text-[#757575] text-lg font-medium mb-4">Log in to see your saved favorites.</p>
            <button
              onClick={() => router.push("/customer")}
              className="py-3 px-6 bg-[#131313] hover:bg-black text-white rounded-full text-sm font-semibold transition-colors cursor-pointer"
            >
              Log in
            </button>
          </div>
        ) : favoritesQuery.isLoading ? (
          <div className="w-full text-center py-20">
            <p className="text-[#757575] text-lg font-medium">Loading your favorites…</p>
          </div>
        ) : favoritesQuery.isError ? (
          <div className="w-full text-center py-20">
            <p className="text-[#757575] text-lg font-medium">Your favorites could not be loaded right now.</p>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-[20px] justify-items-start w-full mt-8">
            {items.map((item) => (
              <ServiceCard
                key={item.id}
                rec={item}
                isFavorite={true}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="w-full text-center py-20">
            <p className="text-[#757575] text-lg font-medium">You don&apos;t have any favorites saved yet.</p>
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
