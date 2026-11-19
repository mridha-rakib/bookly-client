"use client";

import React, { useRef, useState, useEffect } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ZapIcon, HeartIcon, StarIcon, Wallet03Icon } from "@hugeicons/core-free-icons";

function FeatureCard({
  step,
  index,
  globalVisible,
}: {
  step: { icon: IconSvgElement; title: string; description: string };
  index: number;
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
      className={`flex flex-col items-start p-5 gap-10 bg-white border border-[#E8E6FF] rounded-xl hover:shadow-md hover:-translate-y-1.5 hover:border-[#2E9DA7]/30 hover:duration-300 transition-all duration-[1400ms] ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
    >
      {/* Icon Container */}
      <div className="w-[68px] h-[68px] bg-[#2E9DA7] rounded-xl flex items-center justify-center shrink-0">
        <HugeiconsIcon icon={step.icon} className="w-9 h-9 text-[#111111]" />
      </div>

      {/* Text Area */}
      <div className="flex flex-col gap-5 flex-1 w-full">
        <h3 className="text-[24px] font-medium leading-[32px] text-[#212121] tracking-tight">
          {step.title}
        </h3>
        <p className="text-[14px] font-normal leading-[22px] text-[#757575]">
          {step.description}
        </p>
      </div>
    </div>
  );
}

export default function WhyChooseUs() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  const steps = [
    {
      icon: ZapIcon,
      title: "Instant Confirmation",
      description: "No phone calls, no waiting. Your slot is secured the moment you book.",
    },
    {
      icon: HeartIcon,
      title: "Welcome Back Perks",
      description: "Returning to a business you love? No deposit needed. Your loyalty is rewarded from your very second visit.",
    },
    {
      icon: StarIcon,
      title: "Real Businesses, Real Reviews",
      description: "Only customers who actually booked through Bookly can leave a review. Every rating is earned, not given.",
    },
    {
      icon: Wallet03Icon,
      title: "Always Free to Use",
      description: "No subscription, no hidden fees. The small deposit you pay on your first booking at each business? It comes straight off your final bill. You never pay more than the service price.",
    },
  ];

  return (
    <section ref={containerRef} className="w-full px-4 md:px-8 xl:px-[68px] mt-[128px] mb-0">
      <div className="w-full flex flex-col items-center gap-10 md:gap-[40px]">
        {/* Header Container */}
        <div className={`flex flex-col items-center gap-5 text-center max-w-[553px] transition-all duration-700 ease-out ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <h2 className="text-3xl md:text-[36px] font-medium leading-tight md:leading-[48px] text-[#16123E] tracking-tight">
            Why customers choose Bookly
          </h2>
          <p className="text-lg md:text-[24px] font-normal leading-[32px] text-[#757575]">
            Built around your experience
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full items-stretch">
          {steps.map((step, index) => (
            <FeatureCard
              key={index}
              step={step}
              index={index}
              globalVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
