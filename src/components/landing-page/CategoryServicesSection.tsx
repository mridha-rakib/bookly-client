"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSquare02Icon } from "@hugeicons/core-free-icons";
import ServiceCard, { type Recommendation } from "@/components/ServiceCard";
import Carousel from "@/components/landing-page/Carousel";
import BookAgainSection from "@/components/landing-page/BookAgainSection";
import { CategoryTileIcon } from "@/components/landing-page/categoryIcons";
import { useDiscoveryCategoriesQuery, useHomeSectionsQuery } from "@/lib/discovery/hooks";
import { discoveryCardToRecommendation } from "@/lib/discovery/card";
import { useLocationStore } from "@/lib/location/store";
import { useAuthStore } from "@/lib/auth/store";

const CARD_WRAP = "w-[calc(50%-7.5px)] sm:w-[360px] md:w-[406px] shrink-0 snap-start";

/**
 * Batch 17 — the homepage's three discovery rows, now backed entirely by real persisted data
 * from `GET /discovery/home-sections`:
 *   - Recommended: quality ranking, personalized by the logged-in Customer's real booking
 *     history (category/city affinity) when there is any.
 *   - Services near you: the city picked in the hero search bar (`useLocationStore`); with no
 *     city it falls back server-side to "travels to you" businesses first. No distance is ever
 *     shown — the product stores no visitor coordinates.
 *   - Popular: real platform activity (completed bookings + favorites + published reviews).
 * The three are de-duplicated server-side. No mock businesses, ratings, prices or badges.
 */

interface DiscoveryRowProps {
  title: string;
  cards: Recommendation[];
  isLoading: boolean;
  isError: boolean;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onBookNow: (id: string) => void;
  className?: string;
}

function DiscoveryRow({
  title,
  cards,
  isLoading,
  isError,
  favorites,
  onToggleFavorite,
  onBookNow,
  className = "",
}: DiscoveryRowProps) {
  return (
    <section className={`w-full px-4 md:px-8 xl:px-[68px] mt-16 relative z-10 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl md:text-[28px] font-medium tracking-tight text-[#1C1B1C]">{title}</h2>
        <a
          href="/explore"
          className="text-sm md:text-base font-medium text-[#1C1B1C] hover:underline transition-all"
        >
          See all
        </a>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="w-full sm:w-[360px] md:w-[406px] h-[420px] rounded-2xl border border-[#E8E6FF] bg-white overflow-hidden animate-pulse"
            >
              <div className="w-full h-[241px] bg-neutral-100" />
              <div className="p-5 flex flex-col gap-3">
                <div className="h-4 w-3/4 bg-neutral-100 rounded" />
                <div className="h-3 w-1/2 bg-neutral-100 rounded" />
                <div className="h-3 w-2/3 bg-neutral-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-[#757575] py-8">
          We couldn&apos;t load this section right now. Please try again shortly.
        </p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-[#757575] py-8">No businesses to show here yet.</p>
      ) : cards.length > 5 ? (
        <Carousel>
          {cards.map((rec) => (
            <div key={rec.id} className={CARD_WRAP}>
              <ServiceCard
                rec={rec}
                isFavorite={favorites.includes(rec.id)}
                onToggleFavorite={onToggleFavorite}
                onBookNow={onBookNow}
              />
            </div>
          ))}
        </Carousel>
      ) : (
        <div className="flex flex-wrap justify-center gap-6 mx-auto max-w-full sm:max-w-[744px] md:max-w-[836px] lg:max-w-[1266px]">
          {cards.map((rec) => (
            <div key={rec.id} className="w-full sm:w-[360px] md:w-[406px]">
              <ServiceCard
                rec={rec}
                isFavorite={favorites.includes(rec.id)}
                onToggleFavorite={onToggleFavorite}
                onBookNow={onBookNow}
                className="w-full h-full"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CategoryServicesSection() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // One-time read of a browser-only API (localStorage doesn't exist during SSR) — no external
  // subscription applies here, so this is the legitimate exception, same as elsewhere in this
  // codebase (see ClientsPage.tsx's own identical suppression).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("isLoggedIn");
      if (saved === "true") {
        setIsLoggedIn(true);
      }
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id]
    );
  };

  // NOTE (out of scope for this change): the "Book Again" row below still uses placeholder data.
  // It is logged-in-only and needs a real "this customer's recent bookings" endpoint; the three
  // discovery rows (Recommended / Services near you / Popular) are what this change makes real.
  const bookAgainServices: Recommendation[] = [];

  // Real discovery data. `selectedCity` (hero search bar) drives "Services near you"; the
  // logged-in Customer's session personalizes "Recommended" server-side.
  const selectedCity = useLocationStore((state) => state.selectedCity);
  const authStatus = useAuthStore((state) => state.status);
  const authUserId = useAuthStore((state) => state.user?.id);
  const authReady = authStatus !== "unknown";

  const homeSections = useHomeSectionsQuery(
    {
      city: selectedCity ?? undefined,
      // "All" applies no restriction; a specific tile hard-filters every row below by its
      // exact `Business.category` string (never "all", never a slug). `category` is part of
      // the query key (see discoveryKeys.homeSections), so switching tiles refetches.
      category: selectedCategory === "all" ? undefined : [selectedCategory],
    },
    { enabled: authReady, authScope: authUserId ?? "anon" },
  );

  const rowsLoading = !authReady || homeSections.isLoading;
  const rowsError = homeSections.isError;
  const recommended = (homeSections.data?.recommended ?? []).map(discoveryCardToRecommendation);
  const nearYou = (homeSections.data?.nearYou ?? []).map(discoveryCardToRecommendation);
  const popular = (homeSections.data?.popular ?? []).map(discoveryCardToRecommendation);

  const handleBookNow = (id: string) => router.push(`/venue?id=${id}`);

  // The homepage category tiles are the SAME real, distinct, publicly-visible category list
  // `/explore`'s own filter sidebar uses (`/discovery/categories` — see discovery.repository.ts's
  // `listDistinctCategories`, already alphabetically ordered server-side; no client re-sort). A
  // category with no currently-visible business simply isn't returned, so it isn't shown — that
  // is intentional. Known categories render an approved category-specific icon (see
  // categoryIcons.tsx); an unknown future category gets a safe generic fallback. Selecting a tile
  // now hard-filters all three rows below in place by its exact `Business.category` (via the
  // home-sections `category` param); "All" clears the restriction.
  const categoriesQuery = useDiscoveryCategoriesQuery();
  const realCategories = categoriesQuery.data?.categories ?? [];

  // If the selected tile's category no longer exists once the real list loads (renamed/removed
  // on the backend), fall back to "All" rather than leaving a dead selection highlighted —
  // adjusting state during render, same pattern already used in explore/page.tsx.
  if (
    categoriesQuery.data &&
    selectedCategory !== "all" &&
    !realCategories.includes(selectedCategory)
  ) {
    setSelectedCategory("all");
  }

  return (
    <>
      {/* 5. Category Section — real, distinct, publicly-visible Business.category values only;
          no invented taxonomy, no fixed tile count. */}
      <section className="w-full max-w-[1440px] mx-auto px-4 md:px-[64px] mt-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 justify-items-center pb-4 w-full">
          {/* ALL Category Card — a real UI control, never sent to the backend as a category. */}
          <button
            onClick={() => setSelectedCategory("all")}
            className={`flex w-[150px] h-[108px] flex-col items-center justify-center gap-[24px] rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              selectedCategory === "all"
                ? "bg-[#111111] text-[#FCFAF9] shadow-md scale-105"
                : "bg-white text-[#111111] border border-neutral-100 hover:shadow-sm"
            }`}
          >
            <HugeiconsIcon icon={DashboardSquare02Icon} size={24} strokeWidth={1.5} />
            <span className="text-xs font-semibold tracking-wider uppercase">All</span>
          </button>

          {categoriesQuery.isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="w-[150px] h-[108px] rounded-xl bg-neutral-100 animate-pulse shrink-0"
                />
              ))
            : realCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex w-[150px] h-[108px] flex-col items-center justify-center gap-[24px] rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
                    selectedCategory === category
                      ? "bg-[#111111] text-[#817469] shadow-md scale-105"
                      : "bg-white text-[#817469] border border-neutral-100 hover:shadow-sm"
                  }`}
                >
                  <CategoryTileIcon category={category} />
                  <span className="text-xs font-semibold tracking-wider uppercase text-center px-2">
                    {category}
                  </span>
                </button>
              ))}
        </div>
      </section>

      {/* Book Again Section (Logged In Only) — see note above; no placeholder businesses are
          shipped, it simply has no data source yet. */}
      {isLoggedIn && bookAgainServices.length > 0 && (
        <BookAgainSection
          services={bookAgainServices}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
        />
      )}

      {/* 6. Recommended */}
      <DiscoveryRow
        title="Recommended"
        cards={recommended}
        isLoading={rowsLoading}
        isError={rowsError}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBookNow={handleBookNow}
      />

      {/* 7. Services near you */}
      <DiscoveryRow
        title="Services near you"
        cards={nearYou}
        isLoading={rowsLoading}
        isError={rowsError}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBookNow={handleBookNow}
      />

      {/* 8. Popular */}
      <DiscoveryRow
        title="Popular"
        cards={popular}
        isLoading={rowsLoading}
        isError={rowsError}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onBookNow={handleBookNow}
        className="mb-12"
      />
    </>
  );
}
