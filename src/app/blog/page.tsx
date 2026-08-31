"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { BlogCategory } from "@/lib/api/content";
import { usePublicBlogListQuery } from "@/lib/content/hooks";
import {
  BLOG_CATEGORIES,
  blogCategoryBadgeClass,
  blogCategoryLabel,
  formatBlogDate,
} from "@/lib/content/blog";

const PAGE_SIZE = 12;

export default function BlogPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<BlogCategory | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  const listQuery = usePublicBlogListQuery({
    category: selectedCategory ?? undefined,
    page: currentPage,
  });

  const posts = listQuery.data?.posts ?? [];
  const total = listQuery.data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const featuredPost = currentPage === 1 ? posts[0] : undefined;
  const gridPosts = currentPage === 1 ? posts.slice(1) : posts;

  const selectCategory = (category: BlogCategory | null) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-[#FCFAF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      {/* Hero Header */}
      <header className="w-full max-w-[1310px] mx-auto px-4 md:px-16 mt-[8px] mb-8 flex flex-col items-center gap-[8px]">
        <span className="w-full h-[24px] font-poppins font-normal text-[14px] leading-[24px] text-center tracking-[0.075em] uppercase text-[#000000]">
          Resources &amp; Stories
        </span>
        <div className="w-full flex flex-col items-center gap-[12px]">
          <h1 className="w-full h-[36px] font-poppins font-medium text-[40px] leading-[36px] text-center tracking-[0.01em] text-[#000000]">
            The Bookly Blog
          </h1>
          <p className="w-full h-[24px] font-poppins font-normal text-[16px] leading-[24px] text-center tracking-[0.01em] text-[rgba(17,17,17,0.6)]">
            Tips for local business , partner stories, and updates from the team
          </p>
        </div>
      </header>

      {/* Category Pills */}
      <nav className="w-full flex justify-center px-4 mb-12">
        <div className="flex flex-wrap items-center justify-center gap-3 max-w-4xl">
          {[null, ...BLOG_CATEGORIES].map((category) => {
            const isActive = selectedCategory === category;
            const label = category ? blogCategoryLabel(category) : "All Topics";
            return (
              <button
                key={label}
                type="button"
                onClick={() => selectCategory(category)}
                className={`py-2 px-6 rounded-full text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#0C0C0C] text-[#FFFFFF]"
                    : "bg-[#FFFFFF] border border-[#C6C6CB] text-[#0c0c0c] hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 w-full max-w-[1310px] mx-auto px-4 sm:px-6 lg:px-8 pb-24 flex flex-col gap-8">
        {listQuery.isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col bg-white border border-[#C6C6CB]/60 rounded-xl overflow-hidden animate-pulse"
              >
                <div className="w-full h-[240px] bg-neutral-100" />
                <div className="p-5 flex flex-col gap-3">
                  <div className="h-4 w-3/4 bg-neutral-100 rounded" />
                  <div className="h-3 w-1/2 bg-neutral-100 rounded" />
                  <div className="h-3 w-2/3 bg-neutral-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!listQuery.isLoading && listQuery.isError && (
          <div className="w-full text-center py-24 bg-white border border-[#C6C6CB]/60 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="text-gray-500 text-lg">
              We couldn&apos;t load the blog right now. Please try again later.
            </p>
          </div>
        )}

        {!listQuery.isLoading && !listQuery.isError && posts.length === 0 && (
          <div className="w-full text-center py-24 bg-white border border-[#C6C6CB]/60 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            <p className="text-gray-500 text-lg">
              {selectedCategory
                ? "No blog posts in this category yet."
                : "No blog posts published yet. Check back soon."}
            </p>
          </div>
        )}

        {!listQuery.isLoading && !listQuery.isError && posts.length > 0 && (
          <div className="w-full flex flex-col gap-10">
            {featuredPost && (
              <article
                onClick={() => router.push(`/blog/${featuredPost.slug}`)}
                className="w-full bg-[#FFFFFF] border border-[#C6C6CB]/60 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex flex-col md:flex-row p-0 md:h-[150px] transition-transform duration-200 hover:scale-[1.005] cursor-pointer"
              >
                <div className="w-full md:w-[300px] h-[150px] relative flex-shrink-0 bg-neutral-100">
                  {featuredPost.coverImageUrl && (
                    <Image
                      src={featuredPost.coverImageUrl}
                      alt={featuredPost.title}
                      fill
                      className="object-cover"
                      unoptimized
                      priority
                    />
                  )}
                </div>
                <div className="flex-grow p-4 md:px-6 md:py-3 flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-2">
                    <h2 className="font-poppins font-semibold text-lg sm:text-xl text-[#0C0C0C] leading-snug">
                      {featuredPost.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
                      <span className="font-poppins text-[#4E5F78]">
                        {formatBlogDate(featuredPost.publishedAt)}
                      </span>
                      <span
                        className={`py-0.5 px-4 rounded-full text-xs font-semibold uppercase tracking-wider ${blogCategoryBadgeClass(featuredPost.category)}`}
                      >
                        {blogCategoryLabel(featuredPost.category)}
                      </span>
                    </div>
                  </div>
                  <p className="font-poppins text-xs sm:text-sm text-[#4E5F78] line-clamp-2 md:line-clamp-1 leading-relaxed">
                    {featuredPost.excerpt}
                  </p>
                </div>
              </article>
            )}

            {gridPosts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {gridPosts.map((post) => (
                  <article
                    key={post.id}
                    onClick={() => router.push(`/blog/${post.slug}`)}
                    className="flex flex-col bg-[#FFFFFF] border border-[#C6C6CB]/60 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-transform duration-200 hover:scale-[1.015] cursor-pointer"
                  >
                    <div className="w-full h-[240px] sm:h-[300px] relative bg-neutral-100">
                      {post.coverImageUrl && (
                        <Image
                          src={post.coverImageUrl}
                          alt={post.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="p-4 sm:p-5 flex flex-col gap-4 flex-1 justify-between">
                      <div className="flex flex-col gap-3">
                        <h3 className="font-poppins font-semibold text-lg text-[#0C0C0C] leading-snug line-clamp-2">
                          {post.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-poppins text-[#4E5F78]">
                            {formatBlogDate(post.publishedAt)}
                          </span>
                          <span
                            className={`py-0.5 px-3 rounded-full text-[10px] font-semibold uppercase tracking-wider ${blogCategoryBadgeClass(post.category)}`}
                          >
                            {blogCategoryLabel(post.category)}
                          </span>
                        </div>
                      </div>
                      <p className="font-poppins text-sm text-[#4E5F78] line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <footer className="w-full flex justify-end gap-2 mt-6">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className={`w-10 h-10 rounded-full border border-[#C6C6CB] flex items-center justify-center font-bold text-lg transition-all ${
                    currentPage === 1
                      ? "text-gray-300 border-gray-200 cursor-not-allowed"
                      : "text-black hover:bg-neutral-50 cursor-pointer"
                  }`}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? "bg-black border-black text-white"
                          : "border-[#C6C6CB] text-black hover:bg-neutral-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  className={`w-10 h-10 rounded-full border border-[#C6C6CB] flex items-center justify-center font-bold text-lg transition-all ${
                    currentPage === totalPages
                      ? "text-gray-300 border-gray-200 cursor-not-allowed"
                      : "text-black hover:bg-neutral-50 cursor-pointer"
                  }`}
                >
                  ›
                </button>
              </footer>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
