"use client";

import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, MinusSignIcon as MinusIcon } from "@hugeicons/core-free-icons";

import type { FaqAudience } from "@/lib/api/content";
import { usePublicFaqsQuery } from "@/lib/content/hooks";

/** How many FAQs are visible before "Show more" is used (matches the section's prior behavior). */
const INITIAL_VISIBLE = 3;

interface FaqSectionProps {
  /** Which published FAQ set to show: customer-facing (homepage) or business-facing
   * (List Your Business). Passed explicitly by the parent page — never inferred from the URL. */
  audience: FaqAudience;
}

export default function FaqSection({ audience }: FaqSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const faqsQuery = usePublicFaqsQuery(audience);
  const faqs = faqsQuery.data?.faqs ?? [];

  const visibleFaqs = showAll ? faqs : faqs.slice(0, INITIAL_VISIBLE);
  const canShowMore = faqs.length > INITIAL_VISIBLE;

  const toggleFaq = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section className="mx-4 md:mx-[64px] flex flex-col items-center pt-[40px] px-4 md:px-[48px] pb-0 gap-[40px] bg-transparent font-poppins">
      {/* Container */}
      <div className="flex flex-col items-start p-0 gap-[48px] w-full max-w-[1280px] shrink-0 grow-0">
        {/* Header Container */}
        <div className="flex flex-col items-center p-0 gap-[24px] w-full max-w-[1280px] self-stretch shrink-0 grow-0">
          {/* Frame 2147228638 */}
          <div className="flex flex-col items-start p-0 gap-[16px] w-full max-w-[1280px] self-stretch shrink-0 grow-0">
            {/* FAQ Title */}
            <h2 className="w-full font-poppins font-medium text-[36px] sm:text-[52px] leading-[44px] sm:leading-[60px] flex items-center justify-center text-center tracking-[-0.05em] text-[#111111] self-stretch shrink-0 grow-0">
              FAQ
            </h2>
          </div>
          {/* Everything you need to know about Bookly */}
          <p className="max-w-[574px] font-poppins font-medium text-[16px] sm:text-[18px] leading-[22px] sm:leading-[26px] flex items-center justify-center text-center text-[#5E598B] shrink-0 grow-0">
            Everything you need to know about Bookly
          </p>
        </div>

        {/* FAQ Items List Container */}
        <div className="flex flex-col justify-center items-center p-0 gap-[16px] w-full max-w-[1280px] self-stretch shrink-0 grow-0">
          {faqsQuery.isLoading &&
            Array.from({ length: INITIAL_VISIBLE }).map((_, i) => (
              <div
                key={i}
                className="box-border flex flex-col items-start w-full max-w-[1280px] border-b border-[#DEDDE3] self-stretch shrink-0 grow-0"
              >
                <div className="flex flex-row justify-between items-center py-5 px-4 sm:p-[24px] w-full min-h-[80px] gap-4 animate-pulse">
                  <div className="h-5 sm:h-6 w-2/3 bg-neutral-100 rounded" />
                  <div className="w-6 h-6 bg-neutral-100 rounded shrink-0" />
                </div>
              </div>
            ))}

          {!faqsQuery.isLoading && faqsQuery.isError && (
            <p className="font-poppins font-normal text-[15px] sm:text-[17px] leading-[24px] text-[#555555] text-center py-6">
              We couldn&apos;t load FAQs right now. Please try again later.
            </p>
          )}

          {!faqsQuery.isLoading && !faqsQuery.isError && faqs.length === 0 && (
            <p className="font-poppins font-normal text-[15px] sm:text-[17px] leading-[24px] text-[#555555] text-center py-6">
              No FAQs available yet.
            </p>
          )}

          {!faqsQuery.isLoading &&
            !faqsQuery.isError &&
            visibleFaqs.map((faq) => {
              const isOpen = openId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="box-border flex flex-col items-start p-0 w-full max-w-[1280px] border-b border-[#DEDDE3] rounded-lg self-stretch shrink-0 grow-0 transition-all duration-300"
                >
                  {/* Slot -> Summary */}
                  <div
                    onClick={() => toggleFaq(faq.id)}
                    className="flex flex-row justify-between items-center py-5 px-4 sm:p-[24px] w-full min-h-[80px] self-stretch shrink-0 grow-0 cursor-pointer select-none gap-4"
                  >
                    <span className="font-poppins font-normal text-[18px] sm:text-[24px] leading-[26px] sm:leading-[32px] flex items-center text-[#0D0D0D] shrink grow-0 text-left">
                      {faq.question}
                    </span>
                    <div className="w-6 h-6 shrink-0 grow-0 flex items-center justify-center text-[#454070]">
                      {isOpen ? (
                        <HugeiconsIcon icon={MinusIcon} className="w-6 h-6" />
                      ) : (
                        <HugeiconsIcon icon={Add01Icon} className="w-6 h-6" />
                      )}
                    </div>
                  </div>

                  {/* FAQ Answer Container */}
                  <div
                    className={`w-full overflow-hidden transition-all duration-300 ease-in-out ${
                      isOpen
                        ? "max-h-[500px] opacity-100 pb-[24px] px-4 sm:px-[24px]"
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    <p className="font-poppins font-normal text-[15px] sm:text-[17px] leading-[24px] sm:leading-[28px] text-[#555555] text-left">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Show more button */}
      {!faqsQuery.isLoading && !faqsQuery.isError && canShowMore && (
        <button
          onClick={() => {
            setShowAll(!showAll);
            setOpenId(null);
          }}
          className="box-border flex flex-row justify-center items-center py-[12px] px-[40px] gap-[10px] w-[216px] h-[56px] border border-[#1C1B1C] rounded-[12px] shrink-0 grow-0 cursor-pointer hover:bg-neutral-50 active:scale-[0.98] transition-all"
        >
          <span className="font-poppins font-medium text-[20px] sm:text-[24px] leading-[32px] flex items-center justify-center text-[#111111] shrink-0 grow-0">
            {showAll ? "Show less" : "Show more"}
          </span>
        </button>
      )}
    </section>
  );
}
