"use client";

import Image from "next/image";
import React from "react";
import Link from "next/link";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export default function Footer() {
  const { installPWA } = usePWAInstall();
  return (
    <footer className="w-full bg-transparent mt-[120px] md:mt-[200px] lg:mt-[300px] xl:mt-[400px] pb-14 font-poppins">
      {/* Centered Content Wrapper */}
      <div className="max-w-[1440px] mx-auto w-full px-4 md:px-[32px] flex flex-col items-start gap-[40px]">
        
        {/* Main Content Row */}
        <div className="flex flex-col xl:flex-row items-start w-full gap-10 xl:gap-0 justify-between">
          
          {/* Brand Column */}
          <div className="flex flex-col items-start p-0 md:pb-[32px] md:pl-[34px] gap-[24px] w-full xl:max-w-[477px] shrink-0">
            {/* Logo */}
            <Image
              src="/img/logo.png"
              alt="Bookly Logo"
              className="w-[120px] h-[32.22px] object-cover"
              width={120}
              height={32}
            />

            {/* Description Container */}
            <div className="flex flex-col items-start p-0 w-full max-w-[443px] mt-2">
              <p className="font-manrope font-normal text-[14px] leading-[20px] text-[#4E5F78]">
                Your trusted platform for discovering and booking local services across Cyprus.
              </p>
            </div>

            {/* Add to Home screen Widget */}
            <div 
              onClick={installPWA}
              className="box-border flex flex-row items-center justify-between py-[12px] px-[24px] gap-[20px] h-[48px] border border-[#4E5F78] rounded-[999px] cursor-pointer hover:bg-neutral-50 transition-colors mt-2"
            >
              <span className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[24px] text-[#1C1B1C]">
                Add to Home screen
              </span>
              {/* Icons wrapper */}
              <div className="flex flex-row items-center p-0 gap-[12px] w-[60px] h-[24px]">
                <Image
                  src="/Icons/apple.svg"
                  alt="Apple Icon"
                  className="w-6 h-6 object-contain"
                  width={24}
                  height={24}
                />
                <Image
                  src="/Icons/android.svg"
                  alt="Android Icon"
                  className="w-6 h-6 object-contain"
                  width={24}
                  height={24}
                />
              </div>
            </div>
          </div>

          {/* Links Columns Wrapper */}
          <div className="flex flex-row flex-wrap sm:flex-nowrap items-start p-0 gap-y-8 gap-x-4 xl:gap-[22px] w-full xl:w-[874px] justify-between">
            
            {/* About Bookly */}
            <div className="flex flex-col items-start p-0 gap-[20px] w-[calc(50%-16px)] sm:w-[202px] shrink-0">
              <h4 className="font-poppins font-semibold text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78]">
                About Bookly
              </h4>
              <div className="flex flex-col items-start p-0 w-full">
                <Link href="/contact-support" className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[40px] text-[#4E5F78] hover:text-black transition-colors">
                  Support
                </Link>
                <Link href="/blog" className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[40px] text-[#4E5F78] hover:text-black transition-colors">
                  Blog
                </Link>
                <Link href="/about" className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[40px] text-[#4E5F78] hover:text-black transition-colors">
                  About us
                </Link>
              </div>
            </div>

            {/* For Business */}
            <div className="flex flex-col items-start p-0 gap-[20px] w-[calc(50%-16px)] sm:w-[202px] shrink-0">
              <h4 className="font-poppins font-semibold text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78]">
                For Business
              </h4>
              <div className="flex flex-col items-start p-0 w-full">
                <a href="#" className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[40px] text-[#4E5F78] hover:text-black transition-colors">
                  List your business
                </a>
              </div>
            </div>

            {/* Legal */}
            <div className="flex flex-col items-start p-0 gap-[20px] w-[calc(50%-16px)] sm:w-[202px] shrink-0">
              <h4 className="font-poppins font-semibold text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78]">
                Legal
              </h4>
              <div className="flex flex-col items-start p-0 w-full gap-[20px]">
                <Link href="/privacy" className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78] hover:text-black transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms-of-service" className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78] hover:text-black transition-colors">
                  Terms of service
                </Link>
                <Link href="/cookies" className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78] hover:text-black transition-colors">
                  Cookies policy
                </Link>
                <Link href="/terms-of-use" className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78] hover:text-black transition-colors">
                  Terms of use
                </Link>
              </div>
            </div>

            {/* Find us on social */}
            <div className="flex flex-col items-start p-0 gap-[20px] w-[calc(50%-16px)] sm:w-[202px] shrink-0">
              <h4 className="font-poppins font-semibold text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78]">
                Find us on social
              </h4>
              <div className="flex flex-col items-start p-0 w-full gap-[20px] mt-1">
                
                {/* Facebook Link */}
                <a href="#" className="flex flex-row items-center gap-[12px] w-full cursor-pointer hover:opacity-80 transition-opacity">
                  <img
                    src="/Icons/FacebookGray.svg"
                    alt="Facebook"
                    className="w-6 h-6 object-contain shrink-0"
                  />
                  <span className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78]">
                    Facebook
                  </span>
                </a>

                {/* Instagram Link */}
                <a href="#" className="flex flex-row items-center gap-[12px] w-full cursor-pointer hover:opacity-80 transition-opacity">
                  <img
                    src="/Icons/instagram.svg"
                    alt="Instagram"
                    className="w-6 h-6 object-contain shrink-0"
                  />
                  <span className="font-poppins font-normal text-[18px] sm:text-[20px] leading-[20px] text-[#4E5F78]">
                    Instagram
                  </span>
                </a>

              </div>
            </div>

          </div>

        </div>

        {/* Bottom Bar */}
        <div className="border-t border-[#DEDDE3] pt-[32px] pb-0 flex justify-start items-center w-full mt-[40px]">
          <p className="font-poppins font-normal text-[14px] leading-[20px] text-[#757575] md:pl-[34px] text-left">
            © 2026 Bookly.cy. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}
