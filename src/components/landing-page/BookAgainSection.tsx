"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ServiceCard, { Recommendation } from "@/components/ServiceCard";
import Carousel from "./Carousel";

interface BookAgainSectionProps {
  services: Recommendation[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
}

export default function BookAgainSection({
  services,
  favorites,
  toggleFavorite
}: BookAgainSectionProps) {
  const router = useRouter();
  return (
    <section className="w-full px-4 md:px-8 xl:px-[68px] mt-[40x]">
      {/* Section Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl md:text-[28px] font-medium tracking-tight text-[#1C1B1C]">
          Book Again
        </h2>
        <a href="/explore" className="text-sm md:text-base font-medium text-[#1C1B1C] hover:underline transition-all">
          See all
        </a>
      </div>

      {/* Card Grid / Carousel */}
      {services.length > 5 ? (
        <Carousel>
          {services.map((rec) => (
            <div key={rec.id} className="w-[calc(50%-7.5px)] sm:w-[360px] md:w-[406px] shrink-0 snap-start">
              <ServiceCard
                rec={rec}
                isFavorite={favorites.includes(rec.id)}
                onToggleFavorite={toggleFavorite}
                onBookNow={(id) => router.push(`/venue?id=${id}`)}
              />
            </div>
          ))}
        </Carousel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">
          {services.map((rec) => (
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
  );
}
