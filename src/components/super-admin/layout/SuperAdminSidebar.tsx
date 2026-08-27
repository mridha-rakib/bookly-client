"use client";

import Image from "next/image";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  Store01Icon,
  UserGroup03Icon,
  Calendar01Icon,
  SaveMoneyDollarIcon,
  PencilEdit01Icon,
  Analytics01Icon,
  HeadsetIcon,
  Settings01Icon,
  ArrowDown01Icon,
  DiscountIcon,
  StarSquareIcon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";
import { authRoutes } from "@/lib/auth/routes";
import { useAuthStore } from "@/lib/auth/store";
import { useCurrentUserQuery } from "@/lib/auth/hooks";

interface SuperAdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function SuperAdminSidebar({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed
}: SuperAdminSidebarProps) {
  const router = useRouter();
  const [showFooterMenu, setShowFooterMenu] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  const meQuery = useCurrentUserQuery();
  const displayName = meQuery.data?.profile?.fullName || "Super Admin";
  const userEmail = meQuery.data?.user.email ?? "";

  const handleLogout = () => {
    setShowFooterMenu(false);
    void logout().then(() => {
      router.replace(authRoutes.superAdminLogin);
    });
  };

  const menuItems = [
    { name: "Dashboard", icon: DashboardSquare01Icon },
    { name: "Businesses", icon: Store01Icon },
    { name: "Customers", icon: UserGroup03Icon },
    { name: "Bookings", icon: Calendar01Icon },
    { name: "Finance", icon: SaveMoneyDollarIcon },
    { name: "Promo Code", icon: DiscountIcon },
    { name: "Reviews", icon: StarSquareIcon },
    { name: "Content", icon: PencilEdit01Icon },
    { name: "Analytics", icon: Analytics01Icon },
    { name: "Support", icon: HeadsetIcon },
    { name: "Settings", icon: Settings01Icon },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white flex flex-col justify-between z-30 transition-all duration-300 ${
        isCollapsed ? "w-[72px]" : "w-[240px]"
      }`}
    >
      <div className="flex flex-col w-full">
        {/* Header container */}
        <div
          className={`flex items-center justify-between py-4 h-[70px] border-b border-gray-200 transition-all duration-300 ${
            isCollapsed ? "px-3 justify-center" : "px-4"
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Logo */}
            {!isCollapsed && (
              <div
                className="w-[27px] h-[32px] bg-no-repeat bg-contain bg-center flex-shrink-0"
                style={{ backgroundImage: "url('/img/smallBlackLogo.svg')" }}
              />
            )}
            {/* Logo text */}
            {!isCollapsed && (
              <span className="font-sans font-medium text-base text-[#111111] tracking-tight whitespace-nowrap">
                Bookly.cy
              </span>
            )}
          </div>
          {/* Collapse icon */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-6 h-6 flex items-center justify-center cursor-pointer text-[#757575] hover:bg-gray-100 rounded transition-colors"
          >
            <Image src="/Icons/businessIcon/Sidebar.svg" alt="Collapse Sidebar" className="w-6 h-6 object-contain" width={24} height={24} />
          </button>
        </div>

        {/* Navigation list */}
        <nav className={`flex flex-col gap-1 py-3 w-full transition-all duration-300 ${isCollapsed ? "px-2" : "px-3"}`}>
          {menuItems.map((item) => {
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                title={isCollapsed ? item.name : undefined}
                className={`flex items-center rounded-lg w-full transition-all duration-150 ${
                  isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-5 py-2.5"
                } ${
                  isActive
                    ? "bg-[#2E9DA7]/20 text-[#195156] font-medium"
                    : "text-[#4E5F78] hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <HugeiconsIcon
                  icon={item.icon}
                  className={`w-5 h-5 shrink-0 ${isActive ? "text-[#195156]" : "text-[#4E5F78]"}`}
                />
                {!isCollapsed && (
                  <span className="font-sans text-[13px] leading-4 whitespace-nowrap">{item.name}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom user profile info */}
      <div
        className={`relative flex items-center h-[84px] border-t border-gray-200 transition-all duration-300 ${
          isCollapsed ? "px-2 justify-center" : "px-4 py-3 justify-between"
        }`}
      >
        <button
          type="button"
          onClick={() => setShowFooterMenu(!showFooterMenu)}
          className={`flex items-center gap-3 w-full cursor-pointer ${isCollapsed ? "justify-center" : ""}`}
        >
          {/* Avatar frame */}
          <div
            className="w-10 h-10 rounded-full bg-cover bg-center flex-shrink-0"
            style={{ backgroundImage: "url('/businessDashboard/downLogo.png')", backgroundColor: "#E5E7EB" }}
          />
          {!isCollapsed && (
            <>
              <div className="flex flex-col flex-grow min-w-0 text-left">
                <span className="font-sans font-semibold text-sm text-[#111111] leading-[26px] truncate">
                  {displayName}
                </span>
                <span className="font-sans font-normal text-[14px] leading-[22px] text-[#4E5F78] truncate">
                  {userEmail || "Super Admin"}
                </span>
              </div>
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className={`w-6 h-6 text-[#1C1B1C] shrink-0 transition-transform duration-200 ${showFooterMenu ? "rotate-180" : ""}`}
              />
            </>
          )}
        </button>

        {showFooterMenu && (
          <>
            <div
              className="fixed inset-0 z-40 bg-transparent cursor-default"
              onClick={() => setShowFooterMenu(false)}
            />
            <div
              className={`absolute z-50 bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col py-2 px-2 gap-1 ${
                isCollapsed ? "bottom-[12px] left-[76px] w-44" : "bottom-[88px] left-3 right-3"
              }`}
            >
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-3 py-2 px-2.5 hover:bg-gray-50 rounded-lg text-left transition-all cursor-pointer w-full"
              >
                <HugeiconsIcon icon={Logout01Icon} className="w-5 h-5 text-[#4E5F78] shrink-0" />
                <span className="font-sans text-[13px] text-[#111111]">Log out</span>
              </button>
            </div>
          </>
        )}
      </div>
      {/* Right border line starting below the header to merge sidebar and topbar headers seamlessly */}
      <div className="absolute right-0 top-[70px] bottom-0 w-[1px] bg-gray-200 pointer-events-none" />
    </aside>
  );
}
