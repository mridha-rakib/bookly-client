"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export interface LegalLayoutProps {
  pageTitle: string;
  /** Human-readable "Last updated …" string (already formatted). Empty string hides it. */
  lastUpdated: string;
  /** Sanitized HTML (server-side, on every write). */
  bodyHtml: string;
}

/**
 * Chrome for a CMS-managed legal page: navbar + footer + the white card. The article body is the
 * persisted, server-sanitized `bodyHtml` — rendered with `dangerouslySetInnerHTML`. Loading /
 * error / not-yet-published states are handled by the route page, not here.
 */
export default function LegalLayout({ pageTitle, lastUpdated, bodyHtml }: LegalLayoutProps) {
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

      <style>{`
        .legal-body { color: #475569; font-size: 15px; line-height: 1.7; }
        .legal-body h1 { font-size: 26px; font-weight: 700; color: #111827; margin: 1.75rem 0 1rem; }
        .legal-body h2 { font-size: 22px; font-weight: 700; color: #111827; margin: 1.5rem 0 0.9rem; }
        .legal-body h3 { font-size: 18px; font-weight: 700; color: #111827; margin: 1.25rem 0 0.7rem; }
        .legal-body p { margin: 0 0 1rem; }
        .legal-body ul { list-style: disc; margin: 0 0 1rem 1.5rem; }
        .legal-body ol { list-style: decimal; margin: 0 0 1rem 1.5rem; }
        .legal-body li { margin: 0.35rem 0; }
        .legal-body a { color: #602E7A; text-decoration: underline; }
        .legal-body blockquote { border-left: 3px solid #E2E8F0; padding-left: 1rem; color: #64748B; margin: 0 0 1rem; }
        .legal-body hr { border: none; border-top: 1px solid #E2E8F0; margin: 1.5rem 0; }
      `}</style>

      <main className="flex-1 w-full px-4 md:px-16 flex flex-col lg:flex-row gap-6 items-start relative">
        <aside className="hidden lg:flex flex-col w-[256px] bg-white rounded-2xl p-6 gap-2 shrink-0 border border-neutral-100 shadow-sm sticky top-24">
          <div className="px-3 pb-2 flex flex-col gap-1 border-b border-neutral-100">
            <span className="font-semibold text-xs tracking-[0.6px] uppercase text-[#64748B]">
              Legal Documentation
            </span>
            {lastUpdated && <span className="text-[10px] text-[#94A3B8]">{lastUpdated}</span>}
          </div>
        </aside>

        <article className="flex-1 w-full bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-6 md:p-12 flex flex-col gap-8">
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6">
            <h1 className="font-bold text-3xl md:text-[44px] md:leading-[52px] text-[#111827] tracking-tight">
              {pageTitle}
            </h1>
            {lastUpdated && (
              <p className="text-sm text-[#475569]">{lastUpdated}</p>
            )}
          </div>

          <div className="legal-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>
      </main>

      <Footer />
    </div>
  );
}
