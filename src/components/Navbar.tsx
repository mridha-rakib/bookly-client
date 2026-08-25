"use client";

import Image from "next/image";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Car04Icon,
  User02Icon,
  File01Icon,
  FavouriteIcon,
  CreditCardPosIcon,
  Clock01Icon,
  Home01Icon,
  HeadsetIcon,
  Ticket01Icon,
  ProfileIcon,
  Logout01Icon,
  ArrowDown01Icon,
  ArrowRight02Icon,
  Setting07Icon
} from "@hugeicons/core-free-icons";
import { usePWAInstall } from "@/hooks/usePWAInstall";

interface NavbarProps {
  isLoggedIn: boolean;
  setIsLoggedIn: (val: boolean) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  isBusinessPage?: boolean;
}

export default function Navbar({
  isLoggedIn,
  setIsLoggedIn,
  selectedLanguage,
  setSelectedLanguage,
  isBusinessPage = false
}: NavbarProps) {
  const router = useRouter();
  const { installPWA } = usePWAInstall();
  const handleHowItWorksClick = (e: React.MouseEvent) => {
    if (typeof window !== "undefined") {
      if (window.location.pathname === "/") {
        e.preventDefault();
        const element = document.getElementById("how-it-works");
        if (element) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      } else {
        sessionStorage.setItem("scrollToHowItWorks", "true");
      }
    }
  };
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [avatar, setAvatar] = useState("/img/authImg.png");
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const mobileModalRef = useRef<HTMLDivElement>(null);

  // Sync avatar with localStorage and custom profileUpdate events. This is a
  // browser-only preview (never sent to or read from the backend — no avatar
  // upload capability exists yet), so it intentionally lives outside the auth store.
  useEffect(() => {
    const loadAvatar = () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("customerAvatarUrl");
        if (saved) {
          setAvatar(saved);
        }
      }
    };

    loadAvatar();

    if (typeof window !== "undefined") {
      window.addEventListener("storage", loadAvatar);
      window.addEventListener("profileUpdate", loadAvatar);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", loadAvatar);
        window.removeEventListener("profileUpdate", loadAvatar);
      }
    };
  }, [isLoggedIn]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const clickedDesktop = userDropdownRef.current && userDropdownRef.current.contains(event.target as Node);
      const clickedMobile = mobileModalRef.current && mobileModalRef.current.contains(event.target as Node);

      if (!clickedDesktop && !clickedMobile) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  return (
    <header className={`w-full px-4 md:px-8  py-4 md:py-[40px] relative ${showMobileMenu || showUserDropdown ? "z-[250]" : "z-40"}`}>
      <div className="w-full bg-gradient-to-r from-white/90 via-[rgba(230,243,249,0.65)] to-white/90 backdrop-blur-md rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-white/60 px-4 sm:px-6 py-3 md:py-[16px] flex items-center justify-between gap-4">

        {/* Left Side: Logo */}
        <div className="flex items-center">
          <div className="cursor-pointer shrink-0" onClick={() => { sessionStorage.removeItem("scrollToHowItWorks"); router.push("/"); }}>
            {isLoggedIn ? (
              <Image src="/image/smallBlacklogo.svg" alt="Bookly" className="h-8 md:h-[44px] w-9 object-contain" width={36} height={32} />
            ) : (
              <Image src="/img/logoo.svg" alt="Bookly" className="h-8 md:h-[44px] w-[120px] object-contain" width={32} height={32} />
            )}
          </div>
        </div>

        {/* Nav links (Desktop) */}
        {!isBusinessPage && (
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/explore" className="text-xs font-semibold tracking-wider text-[#757575] hover:text-[#1C1B1C] transition-colors uppercase">
              Explore
            </Link>
            <Link 
              href="/#how-it-works" 
              onClick={handleHowItWorksClick}
              className="text-xs font-semibold tracking-wider text-[#757575] hover:text-[#1C1B1C] transition-colors uppercase"
            >
              How it Works
            </Link>
          </nav>
        )}

        {/* Right Side Options (Desktop) */}
        <div className="hidden md:flex items-center gap-3 sm:gap-4">
          {!isLoggedIn ? (
            <>
              {/* Login button */}
              <button
                onClick={() => {
                  sessionStorage.removeItem("scrollToHowItWorks");
                  router.push("/select-role");
                }}
                className="border-2 border-[#ACAAB4] hover:bg-neutral-50 text-[#1C1B1C] px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer active:scale-95"
              >
                Login
              </button>

              {/* List your business button */}
              <button
                onClick={() => router.push(isBusinessPage ? "/business-dashboard" : "/list-your-business")}
                className="bg-[#1C1B1C] hover:bg-black text-[#F9FAFB] px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer active:scale-95 whitespace-nowrap"
              >
                {isBusinessPage ? "Marketplace" : "List your business"}
              </button>

              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="flex items-center gap-1 text-xs font-medium text-[#111111] hover:opacity-75 transition-opacity px-2 py-1 rounded cursor-pointer"
                >
                  <span>{selectedLanguage}</span>
                  <svg className="w-3 h-3 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showLangDropdown && (
                  <div className="absolute right-0 mt-2 w-32 bg-white border border-[#E8E6FF] rounded-xl shadow-lg z-50 overflow-hidden py-1">
                    {["English", "Greek"].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setSelectedLanguage(lang === "English" ? "ENG" : "GRE");
                          setShowLangDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs text-[#1C1B1C] hover:bg-[#F5F3FF] transition-colors"
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* List your business button */}
              <button
                onClick={() => router.push(isBusinessPage ? "/business-dashboard" : "/list-your-business")}
                className="bg-[#1C1B1C] hover:bg-black text-[#F9FAFB] px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer active:scale-95 whitespace-nowrap"
              >
                {isBusinessPage ? "Marketplace" : "List your business"}
              </button>

              {/* Logged in user avatar and dropdown toggle */}
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 p-1 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <Image src={avatar} alt="User Avatar" className="w-9 h-9 rounded-full object-cover border border-[#ACAAB4]/40" width={36} height={36} />
                  <svg className="w-3.5 h-3.5 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu (Desktop absolute) */}
                {showUserDropdown && (
                  <div className="absolute right-0 mt-3 w-[247px] bg-white rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#ACAAB4]/30 p-5 flex flex-col gap-4 z-50 font-['Poppins']">

                    {/* 1. Language selector */}
                    <div className="relative">
                      <button
                        onClick={() => setShowLangDropdown(!showLangDropdown)}
                        className="flex items-center gap-2 cursor-pointer text-[#111111]"
                      >
                        <span className="font-medium text-xs leading-5">{selectedLanguage}</span>
                        <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4 text-[#111111]" />
                      </button>

                      {showLangDropdown && (
                        <div className="absolute left-0 mt-2 w-32 bg-white border border-[#E8E6FF] rounded-xl shadow-lg z-50 overflow-hidden py-1">
                          {["English", "Greek"].map((lang) => (
                            <button
                              key={lang}
                              onClick={() => {
                                setSelectedLanguage(lang === "English" ? "ENG" : "GRE");
                                setShowLangDropdown(false);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#1C1B1C] hover:bg-[#F5F3FF] transition-colors"
                            >
                              {lang}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 2. Profile */}
                    <Link
                      href="/customer/profile"
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push("/customer/profile");
                        setTimeout(() => {
                          setShowUserDropdown(false);
                        }, 100);
                      }}
                    >
                      <HugeiconsIcon icon={User02Icon} className="w-5 h-5 text-[#141B34]" />
                      <span className="font-medium text-base text-[#1C1B1C]">Profile</span>
                    </Link>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 3. My Bookings */}
                    <button
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
                      onClick={() => {
                        setShowUserDropdown(false);
                        router.push("/customer/bookings");
                      }}
                    >
                      <HugeiconsIcon icon={File01Icon} className="w-[18px] h-[18px] text-[#0C0C0C]" />
                      <span className="font-medium text-base text-[#1C1B1C]">My Bookings</span>
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 4. Favorites */}
                    <button
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
                      onClick={() => {
                        setShowUserDropdown(false);
                        router.push("/customer/favorites");
                      }}
                    >
                      <HugeiconsIcon icon={FavouriteIcon} className="w-5 h-5 text-[#141B34]" />
                      <span className="font-medium text-base text-[#1C1B1C]">Favorites</span>
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 5. Payment card */}
                    <button
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
                      onClick={() => {
                        setShowUserDropdown(false);
                        router.push("/customer/payment-card");
                      }}
                    >
                      <HugeiconsIcon icon={CreditCardPosIcon} className="w-[18px] h-[18px] text-[#111111]" />
                      <span className="font-medium text-base text-[#1C1B1C]">Payment card</span>
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 6. Book again */}
                    <button
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
                      onClick={() => {
                        setShowUserDropdown(false);
                        router.push("/customer/book-again");
                      }}
                    >
                      <HugeiconsIcon icon={Clock01Icon} className="w-[18px] h-[18px] text-[#111111]" />
                      <span className="font-medium text-base text-[#1C1B1C]">Book again</span>
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 7. Setting */}
                    <button
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
                      onClick={() => {
                        setShowUserDropdown(false);
                        router.push("/customer/settings");
                      }}
                    >

                      <HugeiconsIcon icon={Setting07Icon} className="w-[18px] h-[18px] text-[#111111]" />
                      <span className="font-medium text-base text-[#1C1B1C]">Setting</span>
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 8. Add to Home Screen */}
                    <button 
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85" 
                      onClick={() => {
                        setShowUserDropdown(false);
                        installPWA();
                      }}
                    >
                      <HugeiconsIcon icon={Home01Icon} className="w-5 h-5 text-[#141B34]" />
                      <span className="font-medium text-base text-[#1C1B1C]">Add to Home Screen</span>
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 9. My Tickets */}
                    <button
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
                      onClick={() => {
                        setShowUserDropdown(false);
                        router.push("/customer/tickets");
                      }}
                    >
                      <HugeiconsIcon icon={Ticket01Icon} className="w-5 h-5 text-[#141B34]" />
                      <span className="font-medium text-base text-[#1C1B1C]">My Tickets</span>
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 9b. Help & Support */}
                    <button
                      className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
                      onClick={() => {
                        setShowUserDropdown(false);
                        router.push("/contact-support");
                      }}
                    >
                      <HugeiconsIcon icon={HeadsetIcon} className="w-5 h-5 text-[#141B34]" />
                      <span className="font-medium text-base text-[#1C1B1C]">Help & Support</span>
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 10. List your Business */}
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        router.push(isBusinessPage ? "/business-dashboard" : "/list-your-business");
                      }}
                      className="flex items-between justify-between cursor-pointer w-full hover:opacity-85"
                    >
                      <div className="flex items-center gap-3">
                        <HugeiconsIcon icon={ProfileIcon} className="w-[18px] h-[18px] text-[#141B34]" />
                        <span className="font-medium text-base text-[#1C1B1C]">
                          {isBusinessPage ? "Marketplace" : "List your Business"}
                        </span>
                      </div>
                      <HugeiconsIcon icon={ArrowRight02Icon} className="w-6 h-6 text-[#111111]" />
                    </button>

                    <div className="border-t border-[#ACAAB4] w-full"></div>

                    {/* 11. Logout */}
                    <button
                      onClick={() => {
                        setIsLoggedIn(false);
                        setShowUserDropdown(false);
                      }}
                      className="flex items-center gap-3 cursor-pointer text-left w-full text-red-600 hover:text-red-700"
                    >
                      <HugeiconsIcon icon={Logout01Icon} className="w-5 h-5 text-[#141B34]" />
                      <span className="font-medium text-base">Logout</span>
                    </button>

                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Hamburger Menu Toggle (Mobile) */}
        <div className="flex md:hidden items-center gap-2">
          {/* Logged in avatar trigger with down arrow */}
          {isLoggedIn && (
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-1.5 p-1 rounded-full hover:bg-neutral-100 transition-colors cursor-pointer mr-1 relative z-40"
            >
              <Image src={avatar} alt="User Avatar" className="w-8 h-8 rounded-full object-cover border border-[#ACAAB4]/40" width={32} height={32} />
              <svg className="w-3.5 h-3.5 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {/* Language Selector (Mobile view, simplified) */}
          {!isLoggedIn && (
            <div className="relative mr-1">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex items-center gap-0.5 text-xs font-medium text-[#111111] hover:opacity-75 transition-opacity px-2 py-1 rounded cursor-pointer"
              >
                <span>{selectedLanguage}</span>
                <svg className="w-2.5 h-2.5 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showLangDropdown && (
                <div className="absolute right-0 mt-2 w-28 bg-white border border-[#E8E6FF] rounded-xl shadow-lg z-50 overflow-hidden py-1">
                  {["English", "Greek"].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setSelectedLanguage(lang === "English" ? "ENG" : "GRE");
                        setShowLangDropdown(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#1C1B1C] hover:bg-[#F5F3FF] transition-colors"
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="p-2 text-[#1C1B1C] focus:outline-none cursor-pointer"
            aria-label="Toggle Menu"
          >
            {showMobileMenu ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div className="absolute top-[85px] left-4 right-4 bg-[#FDFBF9] border border-[#E8E6FF] rounded-2xl shadow-xl z-50 p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200 md:hidden">
          {!isBusinessPage && (
            <>
              <Link
                href="/explore"
                onClick={() => setShowMobileMenu(false)}
                className="text-sm font-semibold tracking-wider text-[#757575] hover:text-[#1C1B1C] transition-colors uppercase py-2 border-b border-neutral-100"
              >
                Explore
              </Link>
              <Link
                href="/#how-it-works"
                onClick={(e) => {
                  setShowMobileMenu(false);
                  handleHowItWorksClick(e);
                }}
                className="text-sm font-semibold tracking-wider text-[#757575] hover:text-[#1C1B1C] transition-colors uppercase py-2 border-b border-neutral-100"
              >
                How it Works
              </Link>
            </>
          )}

          <div className="flex flex-col gap-3 pt-2">
            {!isLoggedIn ? (
              <>
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    sessionStorage.removeItem("scrollToHowItWorks");
                    router.push("/select-role");
                  }}
                  className="w-full text-center border-2 border-[#ACAAB4] hover:bg-neutral-50 text-[#1C1B1C] py-2.5 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    router.push(isBusinessPage ? "/business-dashboard" : "/list-your-business");
                  }}
                  className="w-full text-center bg-[#1C1B1C] hover:bg-black text-[#F9FAFB] py-2.5 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer"
                >
                  {isBusinessPage ? "Marketplace" : "List your business"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/customer/profile"
                  className="flex items-center gap-3 py-2 border-b border-neutral-100 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/customer/profile");
                    setTimeout(() => {
                      setShowMobileMenu(false);
                    }, 100);
                  }}
                >
                  <Image src={avatar} alt="User Avatar" className="w-10 h-10 rounded-full object-cover border border-[#ACAAB4]/40" width={40} height={40} />
                  <div>
                    <div className="font-semibold text-sm text-[#1C1B1C]">Logged In User (Profile)</div>
                    <div className="text-xs text-[#757575]">{selectedLanguage}</div>
                  </div>
                </Link>
                <button
                  onClick={() => {
                    setShowMobileMenu(false);
                    setIsLoggedIn(false);
                  }}
                  className="w-full text-center border-2 border-red-200 text-red-600 hover:bg-red-50 py-2.5 text-sm font-medium rounded-full transition-all duration-200 cursor-pointer"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile Full-Screen User Dropdown Modal */}
      {isLoggedIn && showUserDropdown && (
        <div
          ref={mobileModalRef}
          className="fixed inset-0 bg-white overflow-y-auto p-6 flex flex-col gap-4 z-[100] font-['Poppins'] animate-in fade-in zoom-in-95 duration-200 md:hidden"
        >

          {/* Mobile Modal Header */}
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <span className="font-semibold text-lg text-[#1C1B1C]">Account Menu</span>
            <button
              onClick={() => setShowUserDropdown(false)}
              className="p-1 text-[#1C1B1C] hover:opacity-70 cursor-pointer"
              aria-label="Close Account Menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 1. Language selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangDropdown(!showLangDropdown)}
              className="flex items-center gap-2 cursor-pointer text-[#111111]"
            >
              <span className="font-medium text-xs leading-5">{selectedLanguage}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} className="w-4 h-4 text-[#111111]" />
            </button>

            {showLangDropdown && (
              <div className="absolute left-0 mt-2 w-32 bg-white border border-[#E8E6FF] rounded-xl shadow-lg z-50 overflow-hidden py-1">
                {["English", "Greek"].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setSelectedLanguage(lang === "English" ? "ENG" : "GRE");
                      setShowLangDropdown(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[#1C1B1C] hover:bg-[#F5F3FF] transition-colors"
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 2. Profile */}
          <Link
            href="/customer/profile"
            onClick={(e) => {
              e.preventDefault();
              router.push("/customer/profile");
              setTimeout(() => {
                setShowUserDropdown(false);
              }, 100);
            }}
            className="flex items-center gap-3 w-full hover:opacity-85"
          >
            <HugeiconsIcon icon={User02Icon} className="w-5 h-5 text-[#141B34]" />
            <span className="font-medium text-base text-[#1C1B1C]">Profile</span>
          </Link>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 3. My Bookings */}
          <button
            className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
            onClick={() => {
              setShowUserDropdown(false);
              router.push("/customer/bookings");
            }}
          >
            <HugeiconsIcon icon={File01Icon} className="w-[18px] h-[18px] text-[#0C0C0C]" />
            <span className="font-medium text-base text-[#1C1B1C]">My Bookings</span>
          </button>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 4. Favorites */}
          <button
            className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
            onClick={() => {
              setShowUserDropdown(false);
              router.push("/customer/favorites");
            }}
          >
            <HugeiconsIcon icon={FavouriteIcon} className="w-5 h-5 text-[#141B34]" />
            <span className="font-medium text-base text-[#1C1B1C]">Favorites</span>
          </button>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 5. Payment card */}
          <button className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85" onClick={() => setShowUserDropdown(false)}>
            <HugeiconsIcon icon={CreditCardPosIcon} className="w-[18px] h-[18px] text-[#111111]" />
            <span className="font-medium text-base text-[#1C1B1C]">Payment card</span>
          </button>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 6. Book again */}
          <button
            className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
            onClick={() => {
              setShowUserDropdown(false);
              router.push("/customer/book-again");
            }}
          >
            <HugeiconsIcon icon={Clock01Icon} className="w-[18px] h-[18px] text-[#111111]" />
            <span className="font-medium text-base text-[#1C1B1C]">Book again</span>
          </button>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 7. Setting */}
          <button
            className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
            onClick={() => {
              setShowUserDropdown(false);
              router.push("/customer/settings");
            }}
          >
            <HugeiconsIcon icon={Clock01Icon} className="w-[18px] h-[18px] text-[#111111]" />
            <span className="font-medium text-base text-[#1C1B1C]">Setting</span>
          </button>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 8. Add to Home Screen */}
          <button 
            className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85" 
            onClick={() => {
              setShowUserDropdown(false);
              installPWA();
            }}
          >
            <HugeiconsIcon icon={Home01Icon} className="w-5 h-5 text-[#141B34]" />
            <span className="font-medium text-base text-[#1C1B1C]">Add to Home Screen</span>
          </button>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 9. Help & Support */}
          <button
            className="flex items-center gap-3 cursor-pointer text-left w-full hover:opacity-85"
            onClick={() => {
              setShowUserDropdown(false);
              router.push("/contact-support");
            }}
          >
            <HugeiconsIcon icon={HeadsetIcon} className="w-5 h-5 text-[#141B34]" />
            <span className="font-medium text-base text-[#1C1B1C]">Help & Support</span>
          </button>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 10. List your Business */}
          <button
            onClick={() => {
              setShowUserDropdown(false);
              router.push(isBusinessPage ? "/business-dashboard" : "/list-your-business");
            }}
            className="flex items-center justify-between cursor-pointer w-full hover:opacity-85"
          >
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={ProfileIcon} className="w-[18px] h-[18px] text-[#141B34]" />
              <span className="font-medium text-base text-[#1C1B1C]">
                {isBusinessPage ? "Marketplace" : "List your Business"}
              </span>
            </div>
            <HugeiconsIcon icon={ArrowRight02Icon} className="w-6 h-6 text-[#111111]" />
          </button>

          <div className="border-t border-[#ACAAB4] w-full"></div>

          {/* 11. Logout */}
          <button
            onClick={() => {
              setIsLoggedIn(false);
              setShowUserDropdown(false);
            }}
            className="flex items-center gap-3 cursor-pointer text-left w-full text-red-600 hover:text-red-700"
          >
            <HugeiconsIcon icon={Logout01Icon} className="w-5 h-5 text-[#141B34]" />
            <span className="font-medium text-base">Logout</span>
          </button>

        </div>
      )}
    </header>
  );
}
