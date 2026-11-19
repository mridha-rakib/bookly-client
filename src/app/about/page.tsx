"use client";

import React, { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AboutHero from "@/components/about/AboutHero";
import AboutStory from "@/components/about/AboutStory";
import AboutCoreValues from "@/components/about/AboutCoreValues";
import AboutPromise from "@/components/about/AboutPromise";
import AboutCTA from "@/components/about/AboutCTA";

export default function AboutPage() {
  // Legacy Navbar props only: Navbar derives identity from the session store and ignores these,
  // so the old localStorage "isLoggedIn" mirror was dead state and has been removed.
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  return (
    <div className="min-h-screen bg-[#FCFAF9] flex flex-col relative text-[#1C1B1C] font-poppins overflow-x-hidden">
      {/* Navbar */}
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      {/* Main Content Area - Full Width */}
      <main className="w-full flex flex-col items-center p-0">
        <AboutHero />
        <AboutStory />
        <AboutCoreValues />
        <AboutPromise />
        <AboutCTA />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
