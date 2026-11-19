"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function AboutCTA() {
  const router = useRouter();

  return (
    <section className="w-full py-24 px-4 md:px-8 xl:px-[68px] relative flex flex-col items-center justify-center overflow-hidden">
      {/* Faded Background Blob */}
      <div className="absolute w-[800px] h-[800px] bg-[#020305] opacity-5 blur-[182px] rounded-full -z-10 pointer-events-none" />

      {/* CTA Box Container */}
      <div className="w-full max-w-[896px] bg-[rgba(252,248,248,0.8)] border border-[#C6C6CB] backdrop-blur-md rounded-[40px] px-8 py-16 md:p-16 flex flex-col items-center gap-6 shadow-xl relative z-10 text-center">
        <h2 className="font-manrope font-extrabold text-4xl md:text-5xl text-[#020305] tracking-tight md:tracking-[-1.2px] leading-tight">
          Join the Community
        </h2>
        <p className="font-manrope font-normal text-lg md:text-xl text-[#45474B] leading-7 max-w-[456px]">
          Whether you&apos;re looking to streamline your life or scale your business, Bookly.cy is your destination.
        </p>

        {/* Buttons Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center mt-4 w-full">
          <button 
            onClick={() => router.push("/explore")}
            className="w-full sm:w-[181px] h-[60px] bg-[#020305] text-white hover:bg-neutral-800 font-manrope font-semibold text-lg rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center"
          >
            Find a Service
          </button>
          <button 
            onClick={() => router.push("/professional/signup")}
            className="w-full sm:w-[222px] h-[64px] bg-[#FCF8F8] border-2 border-[#C6C6CB] hover:bg-[#F3EFEF] text-[#020305] font-manrope font-semibold text-lg rounded-xl transition-colors cursor-pointer flex items-center justify-center"
          >
            List Your Business
          </button>
        </div>
      </div>
    </section>
  );
}
