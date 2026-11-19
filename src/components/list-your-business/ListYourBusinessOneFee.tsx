"use client";

import React, { useRef, useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Tick01Icon, SaveMoneyDollarIcon } from "@hugeicons/core-free-icons";

function BusinessStepCard({
  index,
  icon,
  title,
  description,
  globalVisible,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  globalVisible: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Desktop follows the section-level trigger directly; mobile observes each card itself.
  const visible = isMobile ? inView : globalVisible;

  useEffect(() => {
    if (!isMobile) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "0px 0px -10px 0px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isMobile, globalVisible]);

  const delay = isMobile ? 0 : index * 150;

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`group flex flex-col items-start p-6 gap-8 bg-white border border-[#E8E6FF] rounded-2xl hover:shadow-xl hover:-translate-y-3 hover:scale-[1.02] hover:border-[#2E9DA7]/40 transition-all duration-[1400ms] ease-in-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
    >
      <div className="w-[60px] h-[60px] bg-[#2E9DA7] text-[#111111] rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
        {icon}
      </div>
      <div className="flex flex-col gap-3 w-full">
        <h3 className="text-[20px] font-medium text-[#212121]">
          {title}
        </h3>
        <p className="text-[15px] font-normal leading-relaxed text-[#757575]">
          {description}
        </p>
      </div>
    </div>
  );
}

interface ListYourBusinessOneFeeProps {
  cardsVisible: boolean;
  cardsContainerRef: React.RefObject<HTMLDivElement | null>;
}

export default function ListYourBusinessOneFee({
  cardsVisible,
  cardsContainerRef
}: ListYourBusinessOneFeeProps) {
  return (
    <section ref={cardsContainerRef} className="w-full max-w-[1312px] mx-auto px-4 md:px-8 mt-24">
      <div className="flex flex-col items-center text-center gap-4 mb-12">
        <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#16123E] leading-tight font-poppins">
          One fee. One time. Then yours forever.
        </h2>
        <p className="text-base md:text-[20px] font-normal leading-relaxed text-[#757575] max-w-[850px] font-poppins">
          We only make money when we bring you a brand new customer — and only once. Every return visit after that costs you nothing. No surprises, no monthly bills.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-stretch">
        <BusinessStepCard
          index={0}
          icon={<HugeiconsIcon icon={Search01Icon} className="w-7 h-7" />}
          title="Get Discovered"
          description="New customers in Cyprus search Bookly and find your business. No advertising needed on your end. We do the discovery work for you."
          globalVisible={cardsVisible}
        />
        <BusinessStepCard
          index={1}
          icon={<HugeiconsIcon icon={Tick01Icon} className="w-7 h-7" />}
          title="Get Booked"
          description="Customers book and pay a small deposit online. You get an instant SMS notification. Your calendar updates automatically. No phone tag."
          globalVisible={cardsVisible}
        />
        <BusinessStepCard
          index={2}
          icon={<HugeiconsIcon icon={SaveMoneyDollarIcon} className="w-7 h-7" />}
          title="Get Paid"
          description="Collect the remaining balance at your venue. No-show? The customer's card is already saved — charge the fee with one tap. You keep 100%."
          globalVisible={cardsVisible}
        />
      </div>
    </section>
  );
}
