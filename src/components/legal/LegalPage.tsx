"use client";

import React, { useState } from "react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { StaticPageKey } from "@/lib/api/content";
import { usePublicStaticPageQuery } from "@/lib/content/hooks";
import { formatStaticPageDate } from "@/lib/content/static-pages";
import LegalLayout from "./LegalLayout";

interface LegalPageProps {
  pageKey: StaticPageKey;
  /** Shown in the header while loading / if the page has not been published yet. */
  fallbackTitle: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  return (
    <div className="min-h-screen bg-[#FCFAF9] flex flex-col font-manrope text-[#1C1B1C]">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />
      <main className="flex-1 w-full px-4 md:px-16 py-10 flex justify-center">
        <div className="w-full max-w-3xl bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-8 md:p-12">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/**
 * Renders a CMS-managed legal page from the public Static Page API. There is NO hardcoded legal
 * body anywhere — if the page has not been published in the Content Manager yet, an honest
 * "not available" state is shown (never placeholder legal copy).
 */
export default function LegalPage({ pageKey, fallbackTitle }: LegalPageProps) {
  const pageQuery = usePublicStaticPageQuery(pageKey);

  if (pageQuery.isLoading) {
    return (
      <Shell>
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-10 w-2/3 bg-neutral-100 rounded" />
          <div className="h-3 w-1/3 bg-neutral-100 rounded" />
          <div className="h-3 w-full bg-neutral-100 rounded mt-4" />
          <div className="h-3 w-5/6 bg-neutral-100 rounded" />
          <div className="h-3 w-4/6 bg-neutral-100 rounded" />
        </div>
      </Shell>
    );
  }

  if (pageQuery.isError || !pageQuery.data) {
    return (
      <Shell>
        <div className="flex flex-col gap-3">
          <h1 className="font-bold text-3xl text-[#111827] tracking-tight">{fallbackTitle}</h1>
          <p className="text-[#475569] text-sm">
            This page hasn&apos;t been published yet. Please check back soon.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <LegalLayout
      pageTitle={pageQuery.data.title}
      lastUpdated={`Last updated ${formatStaticPageDate(pageQuery.data.updatedAt)}`}
      bodyHtml={pageQuery.data.bodyHtml}
    />
  );
}
