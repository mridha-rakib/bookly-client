"use client";

import Image from "next/image";
import React, { useRef, useState, useEffect } from "react";

export default function AboutStory() {
  const bentoRef = useRef<HTMLDivElement | null>(null);
  const [bentoVisible, setBentoVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setBentoVisible(entry.isIntersecting);
    }, { threshold: 0.1 });

    if (bentoRef.current) observer.observe(bentoRef.current);
    return () => {
      if (bentoRef.current) observer.unobserve(bentoRef.current);
    };
  }, []);

  return (
    <section ref={bentoRef} className="w-full py-24 px-4 md:px-8 xl:px-[68px] bg-transparent flex justify-center">
      <div className="w-full max-w-[1280px] grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        
        {/* Block 1: Empowering Local Businesses (Row 1, Col 1-2) */}
        <div className={`lg:col-span-2 p-10 lg:p-14 bg-[#F1EDED] border border-[#E5E2E1] rounded-3xl shadow-sm relative overflow-hidden flex flex-col gap-4 justify-center items-start transition-all duration-1000 ease-out ${bentoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="absolute w-[256px] h-[256px] -right-[84px] -top-[127px] bg-[rgba(207,225,254,0.3)] blur-[32px] rounded-full pointer-events-none" />
          <div className="w-[68px] h-[68px] bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
            <Image src="/designImg/empoweringIcon.png" alt="Empowering Icon" className="w-9 h-9 object-contain" width={36} height={36} />
          </div>
          <h2 className="font-manrope font-bold text-3xl md:text-4xl text-[#020305] mt-2">
            Empowering Local Businesses
          </h2>
          <p className="font-manrope font-normal text-[18px] leading-[29px] text-[#45474B] max-w-[576px]">
            We believe that local entrepreneurs deserve enterprise-grade tools. Bookly.cy simplifies operations, automates scheduling, and brings your business online 24/7, allowing you to focus on what you do best — delivering exceptional service.
          </p>
        </div>

        {/* Block 2: Stat Block (Row 1, Col 3) */}
        <div className={`lg:col-span-1 p-10 lg:p-12 bg-[#020305] rounded-3xl shadow-lg flex flex-col justify-center items-center text-center relative overflow-hidden transition-all duration-1000 ease-out delay-150 ${bentoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <div className="absolute inset-0 bg-white/5 opacity-10 pointer-events-none" />
          <h3 className="font-manrope font-black text-6xl md:text-7xl text-white tracking-tight leading-none mb-2">
            24/7
          </h3>
          <p className="font-manrope font-medium text-lg text-[#84858A] max-w-[216px] leading-7">
            Seamless booking access for everyone, everywhere.
          </p>
        </div>

        {/* Block 3: Story Block (Image) (Row 2, Col 1) */}
        <div className={`lg:col-span-1 h-[400px] bg-[#F1EDED] border border-[#E5E2E1] rounded-3xl shadow-sm flex items-center justify-center p-8 relative transition-all duration-1000 ease-out delay-150 ${bentoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <Image src="/designImg/aboutPageOurStory.png" alt="Our Story Illustration" className="max-w-full max-h-full object-contain drop-shadow-sm hover:scale-105 transition-transform duration-700 select-none" fill />
        </div>

        {/* Block 4: Our Story Block (Text) (Row 2, Col 2-3) */}
        <div className={`lg:col-span-2 p-10 lg:p-12 bg-white border border-[#C6C6CB] rounded-3xl shadow-sm flex flex-col justify-center items-start transition-all duration-1000 ease-out delay-300 ${bentoVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="font-manrope font-bold text-3xl md:text-[30px] leading-[36px] text-[#020305] mb-6">
            Our Story
          </h2>
          <div className="flex flex-col gap-6 text-[#45474B] font-manrope text-[18px] leading-[28px] font-normal">
            <p>
              It started with a simple frustration: playing phone tag to book a haircut, a padel court, or a consultation. In a world where everything is instant, scheduling local services in Cyprus felt stuck in the past.
            </p>
            <p>
              Bookly.cy was born to bridge this gap. We set out to build a platform that respects the time of both the customer and the provider. By centralizing availability and simplifying the transaction, we&apos;re not just booking appointments; we&apos;re streamlining daily life.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}
