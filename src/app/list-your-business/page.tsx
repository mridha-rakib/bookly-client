"use client";

import Image from "next/image";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Reused components
import FaqSection from "@/components/FaqSection";
import Footer from "@/components/Footer";
import EdgeSoftOrbsTop from "@/components/EdgeSoftOrbsTop";
import { TrustedBusiness } from "@/components/TrustedBusinessCard";

// Sub-page split components
import ListYourBusinessNavbar from "@/components/list-your-business/ListYourBusinessNavbar";
import ListYourBusinessHero from "@/components/list-your-business/ListYourBusinessHero";
import ListYourBusinessOneFee from "@/components/list-your-business/ListYourBusinessOneFee";
import ListYourBusinessFeatures from "@/components/list-your-business/ListYourBusinessFeatures";
import ListYourBusinessBuiltForCyprus from "@/components/list-your-business/ListYourBusinessBuiltForCyprus";
import ListYourBusinessTrusted from "@/components/list-your-business/ListYourBusinessTrusted";
import ListYourBusinessAddHome from "@/components/list-your-business/ListYourBusinessAddHome";

export default function ListYourBusinessPage() {
  const router = useRouter();

  // Banner & Language states
  const [showBanner, setShowBanner] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("isLoggedIn");
      if (saved === "true") {
        setIsLoggedIn(true);
      }
    }
  }, []);

  // Intersection observers for section trigger animations
  const cardsContainerRef = useRef<HTMLDivElement | null>(null);
  const [cardsVisible, setCardsVisible] = useState(false);

  const featuresContainerRef = useRef<HTMLDivElement | null>(null);
  const [featuresVisible, setFeaturesVisible] = useState(false);

  const categoriesContainerRef = useRef<HTMLDivElement | null>(null);
  const [categoriesVisible, setCategoriesVisible] = useState(false);

  useEffect(() => {
    const observerOptions = { threshold: 0.1 };

    const cardsObserver = new IntersectionObserver(([entry]) => {
      setCardsVisible(entry.isIntersecting);
    }, observerOptions);

    const featuresObserver = new IntersectionObserver(([entry]) => {
      setFeaturesVisible(entry.isIntersecting);
    }, observerOptions);

    const categoriesObserver = new IntersectionObserver(([entry]) => {
      setCategoriesVisible(entry.isIntersecting);
    }, observerOptions);

    if (cardsContainerRef.current) cardsObserver.observe(cardsContainerRef.current);
    if (featuresContainerRef.current) featuresObserver.observe(featuresContainerRef.current);
    if (categoriesContainerRef.current) categoriesObserver.observe(categoriesContainerRef.current);

    return () => {
      cardsObserver.disconnect();
      featuresObserver.disconnect();
      categoriesObserver.disconnect();
    };
  }, []);

  // Mock trusted businesses data
  const trustedBusinesses: TrustedBusiness[] = [
    { id: 1, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedOne.svg" },
    { id: 2, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedOne.svg" },
    { id: 3, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedOne.svg" },
    { id: 4, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedTwo.svg" },
    { id: 5, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedTwo.svg" },
    { id: 6, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedTwo.svg" },
    { id: 7, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedTwo.svg" },
    { id: 8, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedOne.svg" },
    { id: 9, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedOne.svg" },
    { id: 10, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedTwo.svg" },
    { id: 11, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedTwo.svg" },
    { id: 12, name: "PhysioPlus", location: "Larnaca", role: "Founding Partners", image: "/Icons/trustedOne.svg" },
  ];

  // Business Category Grid list
  const businessCategories = [
    {
      title: "Beauty & Wellness",
      desc: "Hair salons, barbers, nails, spa, massage, aesthetics, makeup and more.",
      image: "/img/beauty_wellness.png"
    },
    {
      title: "Health & Fitness",
      desc: "Physiotherapy, personal trainers, yoga, pilates, swimming coaches.",
      image: "/img/health_fitness.png"
    },
    {
      title: "Sports & Activities",
      desc: "Tennis, padel, squash, go-karting, escape rooms, archery, paintball.",
      image: "/img/sports_activities.png"
    },
    {
      title: "Entertainment & Events",
      desc: "DJs, magicians, children's entertainers, face painters, balloon artists.",
      image: "/img/entertainment_events.png"
    },
    {
      title: "Experiences & Tours",
      desc: "Jeep safaris, boat trips, wine tasting, cooking classes, scuba diving.",
      image: "/img/experiences_tours.png"
    },
    {
      title: "Creative & Education",
      desc: "Photographers, videographers, music lessons, dance classes, language tutors.",
      image: "/img/creative_education.png"
    },
    {
      title: "Pets & Home",
      desc: "Pet grooming, dog trainers, pet sitters, mobile groomers, pet walkers.",
      image: "/img/pets_home.png"
    },
    {
      title: "Automotive",
      desc: "Car detailing, window tinting, vehicle wrapping, mobile mechanics.",
      image: "/img/automotive.png"
    },
    {
      title: "Consulting & Coaching",
      desc: "Life coaches, business consultants, career advisors, tutors.",
      image: "/img/consulting_coaching.png"
    }
  ];

  return (
    <div className="min-h-screen font-poppins relative overflow-x-hidden text-[#1C1B1C]">
      {/* Root Solid Background Layer */}
      <div className="absolute inset-0 -z-20 bg-[#FCFAF9] pointer-events-none" />

      {/* Background Soft Orbs */}
      <EdgeSoftOrbsTop
        size={380}
        duration={56}
        intensity={0.85}
        blend="screen"
        zIndex={-5}
      />

      {/* Decorative Ellipse Blobs */}
      <div className="absolute top-0 left-0 -z-10 w-full pointer-events-none opacity-40">
        <Image src="/designImg/topEllipes.svg" alt="" className="absolute top-0 left-0 w-[500px] h-[500px]" width={24} height={24} />
        <Image src="/designImg/middleEllipes.svg" alt="" className="absolute top-[20%] right-0 w-[600px] h-[600px]" width={24} height={24} />
      </div>

      {/* 1. Navbar & App Banner */}
      <ListYourBusinessNavbar
        showBanner={showBanner}
        setShowBanner={setShowBanner}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        onListBusinessClick={() => router.push("/")}
      />

      {/* 2. Hero Section */}
      <ListYourBusinessHero
        onListBusinessClick={() => router.push("/professional")}
      />

      {/* 3. One Fee Section */}
      <ListYourBusinessOneFee
        cardsVisible={cardsVisible}
        cardsContainerRef={cardsContainerRef}
      />

      {/* 4. Features Section */}
      <ListYourBusinessFeatures
        featuresVisible={featuresVisible}
        featuresContainerRef={featuresContainerRef}
      />

      {/* 5. Built for Cyprus Section */}
      <ListYourBusinessBuiltForCyprus
        categoriesContainerRef={categoriesContainerRef}
        categoriesVisible={categoriesVisible}
        onGetStartedClick={() => router.push("/professional")}
        businessCategories={businessCategories}
      />

      {/* 6. Trusted Businesses Section */}
      <ListYourBusinessTrusted
        trustedBusinesses={trustedBusinesses}
      />

      {/* 7. Add to Home Screen Section */}
      <ListYourBusinessAddHome />

      {/* 8. FAQ Section */}
      <FaqSection audience="BUSINESS" />

      {/* 9. Footer */}
      <Footer />
    </div>
  );
}
