"use client";

import React from "react";
import { useRouter } from "next/navigation";
import BookAgainCard from "./BookAgainCard";
import Carousel from "./Carousel";
import { useAuthStore } from "@/lib/auth/store";
import { useBookAgainCandidatesQuery } from "@/lib/bookings/hooks";
import { bookAgainHref } from "@/lib/bookings/book-again";
import { useFavoriteIdsQuery, useAddFavoriteMutation, useRemoveFavoriteMutation } from "@/lib/favorite/hooks";

export default function BookAgainSection() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const isCustomer = status === "authenticated" && !isInitializing && user?.role === "CUSTOMER";
  const query = useBookAgainCandidatesQuery({ page: 1, limit: 6 });
  const favorites = useFavoriteIdsQuery(isCustomer);
  const addFavorite = useAddFavoriteMutation();
  const removeFavorite = useRemoveFavoriteMutation();
  if (!isCustomer) return null;
  const candidates = query.data?.candidates ?? [];
  const favoriteIds = favorites.data?.businessIds ?? [];
  const toggleFavorite = (businessId: string) => {
    if (favoriteIds.includes(businessId)) removeFavorite.mutate(businessId);
    else addFavorite.mutate(businessId);
  };
  const cards = candidates.map((item) => (
    <div key={item.originalBookingId} className={candidates.length > 5
      ? "w-[calc(50%-7.5px)] sm:w-[360px] md:w-[406px] shrink-0 snap-start"
      : "w-full sm:w-[360px] md:w-[406px]"}>
      <BookAgainCard item={item} isFav={favoriteIds.includes(item.businessId)}
        onToggleFavorite={toggleFavorite}
        onRebook={(businessId, serviceId) => router.push(bookAgainHref(businessId, serviceId))} />
    </div>
  ));
  return (
    <section className="w-full px-4 md:px-8 xl:px-[68px] mt-[40x]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl md:text-[28px] font-medium tracking-tight text-[#1C1B1C]">Book Again</h2>
        <a href="/customer/book-again" className="text-sm md:text-base font-medium text-[#1C1B1C] hover:underline transition-all">See all</a>
      </div>
      {query.isLoading ? (
        <p role="status" className="text-sm text-[#757575] py-8">Loading your booking history…</p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-[#757575] py-8">Your booking history could not be loaded right now.</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-[#757575] py-8">You don&apos;t have any completed bookings to repeat yet.</p>
      ) : candidates.length > 5 ? (
        <Carousel>{cards}</Carousel>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center">{cards}</div>
      )}
    </section>
  );
}
