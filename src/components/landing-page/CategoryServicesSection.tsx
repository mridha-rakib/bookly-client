"use client";

import React, { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Car04Icon,
  DashboardSquare02Icon,
  FootballIcon,
  HealtcareIcon,
  PartyIcon,
  SailboatOffshoreIcon,
  WellnessIcon,
} from "@hugeicons/core-free-icons";
import ServiceCard, { Recommendation } from "@/components/ServiceCard";
import Carousel from "@/components/landing-page/Carousel";
import BookAgainSection from "@/components/landing-page/BookAgainSection";

export default function CategoryServicesSection() {
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

  // Mock Book Again services data
  const bookAgainServices: Recommendation[] = [
    {
      id: "101",
      title: "Soho Vintage Barbers | Sheikh Zayed Road",
      rating: 4.9,
      reviews: 120,
      categories: ["Barber", "Salon"],
      lastVisited: "Last visited 1 week ago",
      startingPrice: 15,
      image: "/img/service_demo.jpg",
      travelsToYou: true,
      travelLocations: ["Larnaca"],
      hasDiamond: true,
    },
    {
      id: "102",
      title: "Zara Hair & Beauty | Limassol Marina",
      rating: 4.8,
      reviews: 85,
      categories: ["Hair", "Salon"],
      lastVisited: "Last visited 3 weeks ago",
      startingPrice: 25,
      image: "/img/service_demo.jpg",
      noDeposit: true,
    },
    {
      id: "103",
      title: "Gold Gym Spa & Massage | Nicosia",
      rating: 4.7,
      reviews: 310,
      categories: ["Massage", "Wellness"],
      lastVisited: "Last visited 1 month ago",
      startingPrice: 40,
      image: "/img/service_demo.jpg",
      hasDiamond: true,
    },
    {
      id: "104",
      title: "Elite Car Detailing | Paphos",
      rating: 4.9,
      reviews: 145,
      categories: ["Automotive"],
      lastVisited: "Last visited 2 months ago",
      startingPrice: 50,
      image: "/img/service_demo.jpg",
      noDeposit: true,
    },
    {
      id: "105",
      title: "Precision Men's Grooming | Larnaca",
      rating: 4.6,
      reviews: 92,
      categories: ["Barber"],
      lastVisited: "Last visited 2 weeks ago",
      startingPrice: 18,
      image: "/img/service_demo.jpg",
      travelsToYou: true,
      travelLocations: ["Larnaca", "Nicosia"],
    },
    {
      id: "106",
      title: "Serenity Yoga Studio | Limassol",
      rating: 5.0,
      reviews: 74,
      categories: ["Wellness"],
      lastVisited: "Last visited 3 days ago",
      startingPrice: 30,
      image: "/img/service_demo.jpg",
      noDeposit: true,
    }
  ];

  // Mock recommendations data
  const recommendations: Recommendation[] = [
    {
      id: "1",
      title: "Soho Vintage Barbers | Sheikh Zayed Road",
      rating: 4.9,
      reviews: 299,
      categories: ["Barber", "Salon"],
      lastVisited: "Last visited 2 months ago",
      startingPrice: 12,
      image: "/img/service_demo.jpg",
      travelsToYou: true,
      travelLocations: ["Larnaca", "Limasol", "+4 more"],
      hasDiamond: true,
    },
    {
      id: "2",
      title: "Soho Vintage Barbers | Sheikh Zayed Road",
      rating: 4.9,
      reviews: 299,
      categories: ["Barber", "Salon"],
      location: "Sheikh Zayed Road, Dubai",
      distance: "3km away",
      lastVisited: "Last visited 2 months ago",
      startingPrice: 12,
      image: "/img/service_demo.jpg",
      noDeposit: true,
    },
    {
      id: "3",
      title: "Soho Vintage Barbers | Sheikh Zayed Road",
      rating: 4.9,
      reviews: 299,
      categories: ["Barber", "Salon"],
      lastVisited: "Last visited 2 months ago",
      startingPrice: 12,
      image: "/img/service_demo.jpg",
      travelsToYou: true,
      travelLocations: ["Larnaca", "Limasol", "+4 more"],
      noDeposit: true,
    },
    {
      id: "4",
      title: "Soho Vintage Barbers | Sheikh Zayed Road",
      rating: 4.9,
      reviews: 299,
      categories: ["Barber", "Salon"],
      location: "Sheikh Zayed Road, Dubai",
      distance: "3km away",
      lastVisited: "Last visited 2 months ago",
      startingPrice: 12,
      image: "/img/service_demo.jpg",
      hasDiamond: true,
      noDeposit: true,
    },
    {
      id: "5",
      title: "Soho Vintage Barbers | Sheikh Zayed Road",
      rating: 4.9,
      reviews: 299,
      categories: ["Barber", "Salon"],
      location: "Sheikh Zayed Road, Dubai",
      distance: "3km away",
      lastVisited: "Last visited 2 months ago",
      startingPrice: 12,
      image: "/img/service_demo.jpg",
    },
    {
      id: "6",
      title: "Soho Vintage Barbers | Sheikh Zayed Road",
      rating: 4.9,
      reviews: 299,
      categories: ["Barber", "Salon"],
      location: "Sheikh Zayed Road, Dubai",
      distance: "3km away",
      lastVisited: "Last visited 2 months ago",
      startingPrice: 12,
      image: "/img/service_demo.jpg",
      hasDiamond: true,
      noDeposit: true,
    },
  ];

  // Mock services near you data
  const servicesNearYou: Recommendation[] = [
    {
      id: "11",
      title: "Zara Hair & Beauty Salon | Nicosia Center",
      rating: 4.7,
      reviews: 142,
      categories: ["Salon", "Beauty"],
      location: "Ledra Street, Nicosia",
      distance: "0.8km away",
      lastVisited: "Last visited 2 months ago",
      startingPrice: 25,
      image: "/img/service_demo.jpg",
      hasDiamond: true,
    },
    {
      id: "12",
      title: "Zen Spa & Massage | Limassol Marina",
      rating: 4.9,
      reviews: 88,
      categories: ["Spa", "Wellness"],
      location: "Marina Road, Limassol",
      distance: "1.5km away",
      lastVisited: "Last visited 3 months ago",
      startingPrice: 60,
      image: "/img/service_demo.jpg",
      noDeposit: true,
    },
    {
      id: "13",
      title: "Elite Barber Studio | Larnaca Bay",
      rating: 4.8,
      reviews: 210,
      categories: ["Barber"],
      travelsToYou: true,
      travelLocations: ["Larnaca", "Dekhelia"],
      lastVisited: "Last visited 2 months ago",
      startingPrice: 18,
      image: "/img/service_demo.jpg",
    },
    {
      id: "14",
      title: "Dynamic Fitness Coach | Paphos District",
      rating: 5.0,
      reviews: 45,
      categories: ["Sports", "Fitness"],
      travelsToYou: true,
      travelLocations: ["Paphos", "Peyia"],
      lastVisited: "Last visited 3 months ago",
      startingPrice: 30,
      image: "/img/service_demo.jpg",
      noDeposit: true,
    },
    {
      id: "15",
      title: "Luxury Nails & Lashes | Limassol",
      rating: 4.6,
      reviews: 95,
      categories: ["Beauty", "Salon"],
      location: "Anexartisias, Limassol",
      distance: "2.1km away",
      lastVisited: "Last visited 2 months ago",
      startingPrice: 20,
      image: "/img/service_demo.jpg",
    },
    {
      id: "16",
      title: "Pet Care & Grooming | Nicosia",
      rating: 4.9,
      reviews: 120,
      categories: ["Pets"],
      location: "Strovolos, Nicosia",
      distance: "3.5km away",
      lastVisited: "Last visited 2 months ago",
      startingPrice: 40,
      image: "/img/service_demo.jpg",
      hasDiamond: true,
      noDeposit: true,
    },
  ];

  // Mock popular businesses data (Service cards format)
  const popularBusinesses: Recommendation[] = [
    {
      id: "31",
      title: "Soho Vintage Barbers | Sheikh Zayed Road",
      rating: 4.9,
      reviews: 299,
      categories: ["Barber", "Salon"],
      location: "Limassol Marina",
      distance: "1.1km away",
      lastVisited: "Popular business",
      startingPrice: 12,
      image: "/img/service_demo.jpg",
      hasDiamond: true,
      noDeposit: true,
    },
    {
      id: "32",
      title: "Zara Hair & Beauty Salon | Nicosia Center",
      rating: 4.7,
      reviews: 142,
      categories: ["Salon", "Beauty"],
      location: "Ledra Street, Nicosia",
      distance: "0.8km away",
      lastVisited: "Popular business",
      startingPrice: 25,
      image: "/img/service_demo.jpg",
      hasDiamond: true,
    },
    {
      id: "33",
      title: "Zen Spa & Massage | Limassol Marina",
      rating: 4.9,
      reviews: 88,
      categories: ["Spa", "Wellness"],
      location: "Marina Road, Limassol",
      distance: "1.5km away",
      lastVisited: "Popular business",
      startingPrice: 60,
      image: "/img/service_demo.jpg",
      noDeposit: true,
    },
    {
      id: "34",
      title: "Luxury Nails & Lashes | Limassol",
      rating: 4.6,
      reviews: 95,
      categories: ["Beauty", "Salon"],
      location: "Anexartisias, Limassol",
      distance: "2.1km away",
      lastVisited: "Popular business",
      startingPrice: 20,
      image: "/img/service_demo.jpg",
    },
    {
      id: "35",
      title: "Absolute Tattoo Studio | Ayia Napa",
      rating: 4.8,
      reviews: 320,
      categories: ["Beauty", "Experience"],
      location: "Nissi Avenue, Ayia Napa",
      distance: "0.7km away",
      lastVisited: "Popular business",
      startingPrice: 80,
      image: "/img/service_demo.jpg",
      hasDiamond: true,
    },
    {
      id: "36",
      title: "Precision Men's Grooming | Larnaca",
      rating: 4.6,
      reviews: 92,
      categories: ["Barber"],
      location: "Phinikoudes, Larnaca",
      distance: "1.2km away",
      lastVisited: "Popular business",
      startingPrice: 18,
      image: "/img/service_demo.jpg",
      noDeposit: true,
    }
  ];

  return (
    <>
      {/* 5. Category Section */}
      <section className="w-full max-w-[1440px] mx-auto px-4 md:px-[64px] mt-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4 justify-items-center pb-4 w-full">
          {/* ALL Category Card */}
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

          {/* BEAUTY & WELLNESS */}
          <button
            onClick={() => setSelectedCategory("wellness")}
            className={`flex w-[150px] h-[108px] flex-col items-center justify-center gap-[24px] rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              selectedCategory === "wellness"
                ? "bg-[#111111] text-[#817469] shadow-md scale-105"
                : "bg-white text-[#817469] border border-neutral-100 hover:shadow-sm"
            }`}
          >
            <div className="p-1 rounded bg-[#EDE3DE]">
              <HugeiconsIcon icon={WellnessIcon} size={24} strokeWidth={1.5} color="#111111" />
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-center">Beauty & Wellness</span>
          </button>

          {/* HEALTH & FITNESS */}
          <button
            onClick={() => setSelectedCategory("health")}
            className={`flex w-[150px] h-[108px] flex-col items-center justify-center gap-[24px] rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              selectedCategory === "health"
                ? "bg-[#111111] text-[#817469] shadow-md scale-105"
                : "bg-white text-[#817469] border border-neutral-100 hover:shadow-sm"
            }`}
          >
            <div className="p-1 rounded bg-[#EDE3DE]">
              <HugeiconsIcon icon={HealtcareIcon} size={24} strokeWidth={1.5} color="#111111" />
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-center">Health & Fitness</span>
          </button>

          {/* SPORTS & ACTIVITIES */}
          <button
            onClick={() => setSelectedCategory("sports")}
            className={`flex w-[150px] h-[108px] flex-col items-center justify-center gap-[24px] rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              selectedCategory === "sports"
                ? "bg-[#111111] text-[#817469] shadow-md scale-105"
                : "bg-white text-[#817469] border border-neutral-100 hover:shadow-sm"
            }`}
          >
            <div className="p-1 rounded bg-[#EDE3DE]">
              <HugeiconsIcon icon={FootballIcon} size={24} strokeWidth={1.5} color="#111111" />
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-center">Sports & Activities</span>
          </button>

          {/* EXPERIENCES & TOURS */}
          <button
            onClick={() => setSelectedCategory("experiences")}
            className={`flex w-[150px] h-[108px] flex-col items-center justify-center gap-[24px] rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              selectedCategory === "experiences"
                ? "bg-[#111111] text-[#817469] shadow-md scale-105"
                : "bg-white text-[#817469] border border-neutral-100 hover:shadow-sm"
            }`}
          >
            <div className="p-1 rounded bg-[#EDE3DE]">
              <HugeiconsIcon icon={SailboatOffshoreIcon} size={24} strokeWidth={1.5} color="#111111" />
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-center">Experiences & Tours</span>
          </button>

          {/* ENTERTAINMENT & EVENTS */}
          <button
            onClick={() => setSelectedCategory("entertainment")}
            className={`flex w-[150px] h-[108px] flex-col items-center justify-center gap-[24px] rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              selectedCategory === "entertainment"
                ? "bg-[#111111] text-[#817469] shadow-md scale-105"
                : "bg-white text-[#817469] border border-neutral-100 hover:shadow-sm"
            }`}
          >
            <div className="p-1 rounded bg-[#EDE3DE]">
              <HugeiconsIcon icon={PartyIcon} size={24} strokeWidth={1.5} color="#111111" />
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-center">Events & Shows</span>
          </button>

          {/* AUTOMOTIVE */}
          <button
            onClick={() => setSelectedCategory("automotive")}
            className={`flex w-[150px] h-[108px] flex-col items-center justify-center gap-[24px] rounded-xl transition-all duration-200 cursor-pointer shrink-0 ${
              selectedCategory === "automotive"
                ? "bg-[#111111] text-[#817469] shadow-md scale-105"
                : "bg-white text-[#817469] border border-neutral-100 hover:shadow-sm"
            }`}
          >
            <div className="p-1 rounded bg-[#EDE3DE]">
              <HugeiconsIcon icon={Car04Icon} size={24} strokeWidth={1.5} color="#111111" />
            </div>
            <span className="text-xs font-semibold tracking-wider uppercase text-center">Automotive</span>
          </button>
        </div>
      </section>

      {/* Book Again Section (Logged In Only) */}
      {isLoggedIn && (
        <BookAgainSection
          services={bookAgainServices}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
        />
      )}

      {/* 6. Recommended Section */}
      <section className="w-full px-4 md:px-8 xl:px-[68px] mt-16 relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl md:text-[28px] font-medium tracking-tight text-[#1C1B1C]">Recommended</h2>
          <a href="/explore" className="text-sm md:text-base font-medium text-[#1C1B1C] hover:underline transition-all">
            See all
          </a>
        </div>
        {recommendations.length > 5 ? (
          <Carousel>
            {recommendations.map((rec) => (
              <div key={rec.id} className="w-[calc(50%-7.5px)] sm:w-[360px] md:w-[406px] shrink-0 snap-start">
                <ServiceCard
                  rec={rec}
                  isFavorite={favorites.includes(rec.id)}
                  onToggleFavorite={toggleFavorite}
                  onBookNow={(id) => console.log("Booking item", id)}
                />
              </div>
            ))}
          </Carousel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
            {recommendations.map((rec) => (
              <ServiceCard
                key={rec.id}
                rec={rec}
                isFavorite={favorites.includes(rec.id)}
                onToggleFavorite={toggleFavorite}
                onBookNow={(id) => console.log("Booking item", id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 7. Services Near You Section */}
      <section className="w-full px-4 md:px-8 xl:px-[68px] mt-16 relative z-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl md:text-[28px] font-medium tracking-tight text-[#1C1B1C]">Services near you</h2>
          <a href="/explore" className="text-sm md:text-base font-medium text-[#1C1B1C] hover:underline transition-all">
            See all
          </a>
        </div>
        {servicesNearYou.length > 5 ? (
          <Carousel>
            {servicesNearYou.map((rec) => (
              <div key={rec.id} className="w-[calc(50%-7.5px)] sm:w-[360px] md:w-[406px] shrink-0 snap-start">
                <ServiceCard
                  rec={rec}
                  isFavorite={favorites.includes(rec.id)}
                  onToggleFavorite={toggleFavorite}
                  onBookNow={(id) => console.log("Booking item", id)}
                />
              </div>
            ))}
          </Carousel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
            {servicesNearYou.map((rec) => (
              <ServiceCard
                key={rec.id}
                rec={rec}
                isFavorite={favorites.includes(rec.id)}
                onToggleFavorite={toggleFavorite}
                onBookNow={(id) => console.log("Booking item", id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 8. Popular Section */}
      <section className="w-full px-4 md:px-8 xl:px-[68px] mt-16 relative z-10 mb-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl md:text-[28px] font-medium tracking-tight text-[#1C1B1C]">Popular</h2>
          <a href="/explore" className="text-sm md:text-base font-medium text-[#1C1B1C] hover:underline transition-all">
            See all
          </a>
        </div>
        {popularBusinesses.length > 5 ? (
          <Carousel>
            {popularBusinesses.map((rec) => (
              <div key={rec.id} className="w-[calc(50%-7.5px)] sm:w-[360px] md:w-[406px] shrink-0 snap-start">
                <ServiceCard
                  rec={rec}
                  isFavorite={favorites.includes(rec.id)}
                  onToggleFavorite={toggleFavorite}
                  onBookNow={(id) => console.log("Booking item", id)}
                />
              </div>
            ))}
          </Carousel>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
            {popularBusinesses.map((rec) => (
              <ServiceCard
                key={rec.id}
                rec={rec}
                isFavorite={favorites.includes(rec.id)}
                onToggleFavorite={toggleFavorite}
                onBookNow={(id) => console.log("Booking item", id)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
