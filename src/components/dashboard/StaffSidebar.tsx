"use client";

import Image from "next/image";
import React, { useState, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  Calendar03Icon,
  UserGroup03Icon,
  Orbit01Icon,
  CancelSquareIcon,
  TieIcon,
  StarSquareIcon,
  Settings01Icon,
  ArrowDown01Icon,
  HeadsetIcon,
  Logout01Icon
} from "@hugeicons/core-free-icons";

interface StaffSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  activeTab: string;
  setActiveTab: (val: string) => void;
  showFooterMenu: boolean;
  setShowFooterMenu: (val: boolean) => void;
  footerMenuRef: React.RefObject<HTMLDivElement | null>;
}

export default function StaffSidebar({
  isCollapsed,
  setIsCollapsed,
  activeTab,
  setActiveTab,
  showFooterMenu,
  setShowFooterMenu,
  footerMenuRef
}: StaffSidebarProps) {
  const [profileImage, setProfileImage] = useState("/businessDashboard/downLogo.png");

  useEffect(() => {
    const loadProfileImage = () => {
      const saved = localStorage.getItem("settingsProfileImage");
      if (saved) {
        setProfileImage(saved);
      } else {
        setProfileImage("/businessDashboard/downLogo.png");
      }
    };
    loadProfileImage();
    window.addEventListener("settingsProfileUpdate", loadProfileImage);
    return () => {
      window.removeEventListener("settingsProfileUpdate", loadProfileImage);
    };
  }, []);

  const renderMenuItem = (
    tabName: string,
    icon: any,
    labelText: string,
    badgeCount?: number
  ) => {
    const isActive = activeTab === tabName;
    return (
      <button
        onClick={() => setActiveTab(tabName)}
        className={`w-full flex items-center rounded-lg text-sm transition-all duration-150 relative group ${isCollapsed ? "justify-center p-2.5" : "justify-between px-3 py-2.5"} ${isActive ? "bg-[#111111] text-white" : "text-[#111111] hover:bg-[#B0C5C8]/40"}`}
      >
        <div className="flex items-center gap-2.5">
          <HugeiconsIcon icon={icon} className="w-5 h-5 shrink-0" />
          {!isCollapsed && (
            <span className={isActive ? "font-normal" : "font-light"}>{labelText}</span>
          )}
        </div>

        {badgeCount !== undefined && (
          <>
            {isCollapsed ? (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#E24B4A] rounded-full border border-[#C0D5D8]" />
            ) : (
              <span className="bg-[#E24B4A] text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                {badgeCount}
              </span>
            )}
          </>
        )}

        {isCollapsed && (
          <div className="absolute left-[70px] top-1/2 -translate-y-1/2 bg-[#111111] text-white text-xs px-2.5 py-1.5 rounded-md shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-[9999] font-poppins">
            {labelText}
          </div>
        )}
      </button>
    );
  };

  return (
    <aside className={`bg-[#C0D5D8] flex flex-col justify-between shrink-0 border-r border-[#B0C5C8] h-full transition-all duration-300 ${isCollapsed ? "w-[78px]" : "w-[280px]"}`}>
      
      {/* Sidebar Header with Staff badge */}
      <div className={`h-16 flex items-center justify-between px-6 border-b border-[#B0C5C8] bg-[#C0D5D8] shrink-0 ${isCollapsed ? "justify-center !px-3" : ""}`}>
        {isCollapsed ? (
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-8 h-8 rounded-lg hover:bg-[#B0C5C8]/50 flex items-center justify-center text-[#1C1B1C] transition-all cursor-pointer"
          >
            <Image src="/businessDashboard/Sidebar Icon.svg" alt="Toggle Sidebar" className="w-6 h-6 object-contain" width={24} height={24} />
          </button>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                <Image src="/img/smallBlacklogo.svg" alt="Bookly" className="w-full h-full object-contain" fill />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-[#111111] text-[15px] tracking-wide font-poppins">Bookly.cy</span>
                <span className="text-[10px] text-[#111111]/60 font-poppins mt-1">Staff</span>
              </div>
            </div>
            <button
              onClick={() => setIsCollapsed(true)}
              className="w-8 h-8 rounded-lg hover:bg-[#B0C5C8]/50 flex items-center justify-center text-[#1C1B1C] transition-all cursor-pointer"
            >
              <Image src="/businessDashboard/Sidebar Icon.svg" alt="Toggle Sidebar" className="w-5 h-5 object-contain" width={20} height={20} />
            </button>
          </>
        )}
      </div>

      {/* Sidebar Navigation - removed All Bookings */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-6 select-none ${isCollapsed ? "px-2" : ""} scrollbar-hide`}>
        
        {/* CORE SECTION */}
        <div className="space-y-1">
          {!isCollapsed && (
            <span className="text-[10px] font-medium tracking-[2px] uppercase text-[#111111]/60 px-3 block mb-2">Core</span>
          )}
          {renderMenuItem("Dashboard", DashboardSquare01Icon, "Dashboard")}
          {renderMenuItem("Calendar", Calendar03Icon, "Calendar")}
          {renderMenuItem("Clients", UserGroup03Icon, "Clients")}
        </div>

        {/* BOOKINGS SECTION */}
        <div className="space-y-1">
          {!isCollapsed && (
            <span className="text-[10px] font-medium tracking-[2px] uppercase text-[#111111]/60 px-3 block mb-2">Bookings</span>
          )}
          {renderMenuItem("Upcoming", Orbit01Icon, "Upcoming")}
          {renderMenuItem("Canceled", CancelSquareIcon, "Canceled")}
        </div>

        {/* BUSINESS SECTION */}
        <div className="space-y-1">
          {!isCollapsed && (
            <span className="text-[10px] font-medium tracking-[2px] uppercase text-[#111111]/60 px-3 block mb-2">Business</span>
          )}
          {renderMenuItem("Staff", TieIcon, "Staff")}
          {renderMenuItem("Reviews", StarSquareIcon, "Reviews")}
        </div>

        {/* ACCOUNT SECTION */}
        <div className="space-y-1">
          {!isCollapsed && (
            <span className="text-[10px] font-medium tracking-[2px] uppercase text-[#111111]/60 px-3 block mb-2">Account</span>
          )}
          {renderMenuItem("Settings", Settings01Icon, "Settings")}
        </div>

      </div>

      {/* User Footer Profile */}
      <div className="border-t border-[#757575]/30 bg-[#C0D5D8] flex flex-col shrink-0 relative">
        <div className={`p-4 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => setShowFooterMenu(!showFooterMenu)}>
            <Image src={profileImage} alt="User Profile" className="w-10 h-10 rounded-full object-cover border border-[#4E5F78]" width={40} height={40} />
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="font-semibold text-sm text-[#111111]">MasterPlan LLC</span>
                <span className="text-[11px] text-[#4E5F78] max-w-[140px] truncate">basel@msplan.com</span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={`w-4 h-4 text-[#1C1C1A] cursor-pointer transition-transform duration-200 ${showFooterMenu ? "rotate-180" : ""}`}
              onClick={() => setShowFooterMenu(!showFooterMenu)}
            />
          )}
        </div>

        {showFooterMenu && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-transparent cursor-default" 
              onClick={() => setShowFooterMenu(false)}
            />
            <div
              className={`absolute ${isCollapsed ? "bottom-[56px] left-[84px] w-48 shadow-2xl" : "bottom-[84px] left-3 right-3"} z-50 bg-[#B8CED1] border border-[#757575]/25 rounded-xl shadow-2xl flex flex-col py-2 px-3 gap-1 animate-fadeIn`}
            >
              <button 
                onClick={() => {
                  setActiveTab("Contact Support");
                  setShowFooterMenu(false);
                }}
                className="flex items-center gap-3 py-2 px-2.5 hover:bg-[#A8BEC1] rounded-lg text-left transition-all cursor-pointer w-full"
              >
                <HugeiconsIcon icon={HeadsetIcon} className="w-5 h-5 text-[#111111] shrink-0" />
                <span className="font-manrope font-medium text-xs text-[#111111]">Contact Support</span>
              </button>
              <button 
                onClick={() => setShowFooterMenu(false)}
                className="flex items-center gap-3 py-2 px-2.5 hover:bg-[#A8BEC1] rounded-lg text-left transition-all cursor-pointer w-full"
              >
                <HugeiconsIcon icon={Logout01Icon} className="w-5 h-5 text-[#111111] shrink-0" />
                <span className="font-manrope font-medium text-xs text-[#111111]">Logout</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
