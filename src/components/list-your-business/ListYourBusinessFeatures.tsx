"use client";

import Image from "next/image";
import React, { useRef, useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon, Analytics01Icon, Calendar03Icon, UserGroup03Icon, ZapIcon } from "@hugeicons/core-free-icons";

function BusinessFeatureCard({
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

  useEffect(() => {
    if (!isMobile) {
      return;
    }
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
  }, [isMobile]);

  const delay = isMobile ? 0 : index * 100;

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`group flex flex-col items-start p-6 gap-6 bg-white border border-[#E8E6FF] rounded-2xl hover:shadow-lg hover:-translate-y-2 hover:scale-[1.01] hover:border-[#2E9DA7]/30 transition-all duration-[1400ms] ease-in-out ${
        (isMobile ? inView : globalVisible) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="w-12 h-12 bg-[#2E9DA7] text-[#111111] rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
        {icon}
      </div>
      <div className="flex flex-col gap-2 w-full">
        <h4 className="text-[18px] font-semibold text-[#212121]">{title}</h4>
        <p className="text-[14px] leading-relaxed text-[#757575]">{description}</p>
      </div>
    </div>
  );
}

interface ListYourBusinessFeaturesProps {
  featuresVisible: boolean;
  featuresContainerRef: React.RefObject<HTMLDivElement | null>;
}

export default function ListYourBusinessFeatures({
  featuresVisible,
  featuresContainerRef
}: ListYourBusinessFeaturesProps) {
  return (
    <section ref={featuresContainerRef} className="w-full max-w-[1312px] mx-auto px-4 md:px-8 mt-24">
      <div className="flex flex-col items-center text-center gap-4 mb-12">
        <h2 className="text-3xl md:text-[40px] font-medium tracking-tight text-[#16123E] leading-tight font-poppins">
          Everything you need to run your business
        </h2>
        <p className="text-base md:text-[20px] font-normal leading-relaxed text-[#757575] max-w-[850px] font-poppins">
          Bookly offers innovative features that bring convenience, efficiency, and an improved experience for both your team members and clients.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full items-stretch">
        <BusinessFeatureCard
          index={0}
          icon={<HugeiconsIcon icon={Clock01Icon} className="w-6 h-6" />}
          title="24/7 Online Booking"
          description="Never miss a booking because you were busy or asleep. Customers book anytime, from anywhere."
          globalVisible={featuresVisible}
        />
        <BusinessFeatureCard
          index={1}
          icon={<Image src="/Icons/businessIcon/Chield_check.svg" alt="" className="w-6 h-6 object-contain" width={24} height={24} />}
          title="No-Show Protection"
          description="Customers save a card at booking. If they don't show, you charge the fee instantly — one tap. You set the amount, you decide every time."
          globalVisible={featuresVisible}
        />
        <BusinessFeatureCard
          index={2}
          icon={<Image src="/Icons/businessIcon/Bell_pin.svg" alt="" className="w-6 h-6 object-contain" width={24} height={24} />}
          title="Automatic Reminders"
          description="SMS and email reminders sent automatically before every appointment. Fewer no-shows, less chasing."
          globalVisible={featuresVisible}
        />
        <BusinessFeatureCard
          index={3}
          icon={<HugeiconsIcon icon={Analytics01Icon} className="w-6 h-6" />}
          title="Analytics Dashboard"
          description="See your busiest slots, top services, and revenue — all in one place. Make smarter decisions with real data."
          globalVisible={featuresVisible}
        />
        <BusinessFeatureCard
          index={4}
          icon={<HugeiconsIcon icon={Calendar03Icon} className="w-6 h-6" />}
          title="Google Calendar Sync"
          description="Keep your Google Calendar updated with appointments from Bookly."
          globalVisible={featuresVisible}
        />
        <BusinessFeatureCard
          index={5}
          icon={<HugeiconsIcon icon={UserGroup03Icon} className="w-6 h-6" />}
          title="Multi-Staff Calendars"
          description="Separate calendar columns per staff member. Log in on multiple devices. Owner, supervisor and staff permission levels built in."
          globalVisible={featuresVisible}
        />
        <BusinessFeatureCard
          index={6}
          icon={<Image src="/Icons/businessIcon/star-light.svg" alt="" className="w-6 h-6 object-contain" width={24} height={24} />}
          title="Verified Reviews"
          description="Only real customers who booked through Bookly can leave reviews. Genuine ratings that build your reputation."
          globalVisible={featuresVisible}
        />
        <BusinessFeatureCard
          index={7}
          icon={<HugeiconsIcon icon={ZapIcon} className="w-6 h-6" />}
          title="Instant Notifications"
          description="Get an SMS the moment a new booking lands. Know immediately so you can prepare — no delays, no surprises."
          globalVisible={featuresVisible}
        />
        <BusinessFeatureCard
          index={8}
          icon={<Image src="/Icons/businessIcon/security-check.svg" alt="" className="w-6 h-6 object-contain" width={24} height={24} />}
          title="Secure Payments"
          description="Deposits processed via Stripe — the same technology used by millions of businesses worldwide. Safe, fast and reliable."
          globalVisible={featuresVisible}
        />
      </div>
    </section>
  );
}
