"use client";

import React from "react";
import Image from "next/image";

import type { BlogCategory } from "@/lib/api/content";
import { blogCategoryLabel, formatBlogDate } from "@/lib/content/blog";

/** Normalized shape both the public detail DTO and the admin post DTO can map into. */
export interface BlogDetailPost {
  title: string;
  category: BlogCategory;
  publishedAt: string | null;
  bodyHtml: string;
  coverImageUrl?: string | null;
  galleryImageUrls?: string[];
  facebookUrl?: string;
  instagramUrl?: string;
}

interface BlogDetailBodyProps {
  post: BlogDetailPost;
  onBack?: () => void;
  showBackButton?: boolean;
  /** Shown as a small pill above the title when previewing a non-published post in the admin. */
  draftNotice?: boolean;
}

export default function BlogDetailBody({
  post,
  onBack,
  showBackButton = true,
  draftNotice = false,
}: BlogDetailBodyProps) {
  return (
    <div className="w-full flex flex-col gap-8 font-poppins">
      <style>{`
        .blog-body { font-size: 15.3px; line-height: 1.7; color: #000; }
        .blog-body p { margin: 0 0 1rem; }
        .blog-body h1 { font-size: 28px; font-weight: 600; margin: 1.75rem 0 1rem; }
        .blog-body h2 { font-size: 23px; font-weight: 600; margin: 1.5rem 0 0.9rem; }
        .blog-body h3 { font-size: 19px; font-weight: 600; margin: 1.25rem 0 0.75rem; }
        .blog-body ul { list-style: disc; margin: 0 0 1rem 1.5rem; }
        .blog-body ol { list-style: decimal; margin: 0 0 1rem 1.5rem; }
        .blog-body li { margin: 0.25rem 0; }
        .blog-body a { color: #0CC0DF; text-decoration: underline; }
        .blog-body blockquote { border-left: 3px solid #E5E7EB; padding-left: 1rem; color: #555; margin: 0 0 1rem; }
        .blog-body hr { border: none; border-top: 1px solid #E5E7EB; margin: 1.5rem 0; }
      `}</style>

      {showBackButton && onBack && (
        <button
          onClick={onBack}
          className="self-start flex items-center justify-center gap-2 h-[48px] px-6 bg-[#FFFFFF] border border-[#D3D3D3] rounded-full shadow-sm hover:bg-neutral-50 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4 text-[#141414]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-inter font-semibold text-[16.2px] text-[#141414]">Back</span>
        </button>
      )}

      {draftNotice && (
        <span className="self-start px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
          Draft preview — not visible publicly
        </span>
      )}

      <div className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#0CC0DF]">
          {blogCategoryLabel(post.category)}
        </span>
        <h1 className="w-full text-[#141414] font-medium text-[32px] sm:text-[44.6px] leading-[42px] sm:leading-[58px]">
          {post.title}
        </h1>
      </div>

      {/* Byline + share */}
      <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 border-y border-neutral-100 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-[64px] h-[64px] rounded-full bg-gradient-to-tr from-[#985FF9] to-[#0CC0DF] flex-shrink-0" />
          <div className="flex flex-col gap-[1px]">
            <span className="font-inter font-normal text-[14.8px] leading-[24px] text-[#0CC0DF]">
              Bookly
            </span>
            <span className="font-inter font-normal text-[13.9px] leading-[20px] text-[#878C93]">
              Published {formatBlogDate(post.publishedAt)}
            </span>
          </div>
        </div>

        {(post.facebookUrl || post.instagramUrl) && (
          <div className="flex items-center gap-3">
            {post.facebookUrl && (
              <a
                href={post.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-[58px] h-[58px] bg-[#8EBAC5]/20 border border-[#D5D7DA] shadow-md rounded-[16px] flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Image src="/Icons/Facebook.svg" alt="Facebook" className="w-6 h-6 object-contain" width={24} height={24} />
              </a>
            )}
            {post.instagramUrl && (
              <a
                href={post.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-[58px] h-[58px] bg-[#8EBAC5]/20 border border-[#D5D7DA] shadow-md rounded-[16px] flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Image src="/Icons/instagram1.svg" alt="Instagram" className="w-6 h-6 object-contain" width={24} height={24} />
              </a>
            )}
          </div>
        )}
      </div>

      {post.coverImageUrl && (
        <div className="w-full h-[300px] sm:h-[420px] relative rounded-xl overflow-hidden border border-neutral-100 shadow-sm">
          <Image src={post.coverImageUrl} alt={post.title} fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Article HTML — sanitized server-side on every write (api/src/modules/content/blog.sanitize.ts). */}
      <div
        className="blog-body w-full font-inter"
        dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
      />

      {post.galleryImageUrls && post.galleryImageUrls.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {post.galleryImageUrls.map((url) => (
            <div key={url} className="w-full h-[240px] relative rounded-xl overflow-hidden border border-neutral-100">
              <Image src={url} alt="" fill className="object-cover" unoptimized />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
