"use client";

import React, { useRef, useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Idea01Icon, SecurityCheckIcon, UserGroup03Icon, StarIcon } from "@hugeicons/core-free-icons";

export default function AboutCoreValues() {
  const coreValuesRef = useRef<HTMLDivElement | null>(null);
  const [coreValuesVisible, setCoreValuesVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setCoreValuesVisible(entry.isIntersecting);
    }, { threshold: 0.1 });

    if (coreValuesRef.current) observer.observe(coreValuesRef.current);
    return () => {
      if (coreValuesRef.current) observer.unobserve(coreValuesRef.current);
    };
  }, []);

  return (
    <section ref={coreValuesRef} className="w-full py-24 px-4 md:px-8 xl:px-[68px] bg-transparent flex flex-col items-center">
      {/* Section Header */}
      <div className={`flex flex-col items-center text-center gap-4 max-w-[672px] mb-16 transition-all duration-700 ease-out ${coreValuesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <h2 className="font-manrope font-bold text-4xl text-[#020305]">
          Core Values
        </h2>
        <p className="font-manrope font-normal text-lg text-[#45474B] leading-[28px]">
          The principles that guide our platform, our team, and our commitment to the Cyprus community.
        </p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-[1280px]">
        {/* Value 1: Innovation */}
        <div 
          style={{ transitionDelay: coreValuesVisible ? "0ms" : "0ms" }}
          className={`flex flex-col items-start p-8 gap-5 bg-white border border-[#E5E2E1] rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1.5 hover:border-[#2E9DA7]/30 hover:duration-300 transition-all duration-1000 ease-out ${coreValuesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
        >
          <div className="w-[68px] h-[68px] bg-[#2E9DA7] rounded-xl flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={Idea01Icon} className="w-9 h-9 text-[#111111]" />
          </div>
          <h3 className="font-manrope font-bold text-2xl text-[#020305] mt-1">
            Innovation
          </h3>
          <p className="font-manrope font-normal text-[16px] leading-[26px] text-[#45474B]">
            We constantly refine our technology to provide the most intuitive, frictionless booking experience possible. We don&apos;t settle for the status quo.
          </p>
        </div>

        {/* Value 2: Trust */}
        <div 
          style={{ transitionDelay: coreValuesVisible ? "150ms" : "0ms" }}
          className={`flex flex-col items-start p-8 gap-5 bg-white border border-[#E5E2E1] rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1.5 hover:border-[#2E9DA7]/30 hover:duration-300 transition-all duration-1000 ease-out ${coreValuesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
        >
          <div className="w-[68px] h-[68px] bg-[#2E9DA7] rounded-xl flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={SecurityCheckIcon} className="w-9 h-9 text-[#111111]" />
          </div>
          <h3 className="font-manrope font-bold text-2xl text-[#020305] mt-1">
            Trust
          </h3>
          <p className="font-manrope font-normal text-[16px] leading-[26px] text-[#45474B]">
            Security and reliability are non-negotiable. We build robust systems so businesses can trust us with their livelihood, and consumers can trust us with their time.
          </p>
        </div>

        {/* Value 3: Community */}
        <div 
          style={{ transitionDelay: coreValuesVisible ? "300ms" : "0ms" }}
          className={`flex flex-col items-start p-8 gap-5 bg-white border border-[#E5E2E1] rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1.5 hover:border-[#2E9DA7]/30 hover:duration-300 transition-all duration-1000 ease-out ${coreValuesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
        >
          <div className="w-[68px] h-[68px] bg-[#2E9DA7] rounded-xl flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={UserGroup03Icon} className="w-9 h-9 text-[#111111]" />
          </div>
          <h3 className="font-manrope font-bold text-2xl text-[#020305] mt-1">
            Community
          </h3>
          <p className="font-manrope font-normal text-[16px] leading-[26px] text-[#45474B]">
            We are built in Cyprus, for Cyprus. Our success is directly tied to the growth and prosperity of the local businesses and neighborhoods we serve.
          </p>
        </div>

        {/* Value 4: Excellence */}
        <div 
          style={{ transitionDelay: coreValuesVisible ? "450ms" : "0ms" }}
          className={`flex flex-col items-start p-8 gap-5 bg-white border border-[#E5E2E1] rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1.5 hover:border-[#2E9DA7]/30 hover:duration-300 transition-all duration-1000 ease-out ${coreValuesVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
        >
          <div className="w-[68px] h-[68px] bg-[#2E9DA7] rounded-xl flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={StarIcon} className="w-9 h-9 text-[#111111]" />
          </div>
          <h3 className="font-manrope font-bold text-2xl text-[#020305] mt-1">
            Excellence
          </h3>
          <p className="font-manrope font-normal text-[16px] leading-[26px] text-[#45474B]">
            We aim for high-end execution in every pixel of our interface and every line of our code. Professionalism is woven into the fabric of our platform.
          </p>
        </div>
      </div>
    </section>
  );
}
