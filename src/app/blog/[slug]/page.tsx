"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BlogDetailBody from "@/components/blog/BlogDetailBody";
import { usePublicBlogPostQuery } from "@/lib/content/hooks";

export default function BlogArticlePage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : undefined;

  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  const postQuery = usePublicBlogPostQuery(slug);

  return (
    <div className="min-h-screen bg-[#FCFAF9] flex flex-col relative overflow-x-hidden">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full max-w-[730px] mx-auto px-4 pt-[17px] pb-24">
        {postQuery.isLoading && (
          <div className="w-full flex flex-col gap-6 animate-pulse">
            <div className="h-10 w-3/4 bg-neutral-100 rounded" />
            <div className="h-4 w-1/3 bg-neutral-100 rounded" />
            <div className="h-[320px] w-full bg-neutral-100 rounded-xl" />
            <div className="h-3 w-full bg-neutral-100 rounded" />
            <div className="h-3 w-5/6 bg-neutral-100 rounded" />
            <div className="h-3 w-4/6 bg-neutral-100 rounded" />
          </div>
        )}

        {!postQuery.isLoading && (postQuery.isError || !postQuery.data) && (
          <div className="w-full text-center py-24 flex flex-col items-center gap-4">
            <p className="text-gray-500 text-lg">This article doesn&apos;t exist or is no longer available.</p>
            <button
              onClick={() => router.push("/blog")}
              className="h-[44px] px-6 bg-white border border-[#D3D3D3] rounded-full shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer font-inter font-semibold text-[15px] text-[#141414]"
            >
              Back to the blog
            </button>
          </div>
        )}

        {!postQuery.isLoading && postQuery.data && (
          <BlogDetailBody
            post={{
              title: postQuery.data.title,
              category: postQuery.data.category,
              publishedAt: postQuery.data.publishedAt,
              bodyHtml: postQuery.data.bodyHtml,
              coverImageUrl: postQuery.data.coverImageUrl,
              galleryImageUrls: postQuery.data.galleryImageUrls,
              facebookUrl: postQuery.data.facebookUrl,
              instagramUrl: postQuery.data.instagramUrl,
            }}
            onBack={() => router.push("/blog")}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
