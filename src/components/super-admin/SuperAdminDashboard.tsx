"use client";

import React, { useState, useEffect } from "react";
import SuperAdminSidebar from "./layout/SuperAdminSidebar";
import SuperAdminHeader from "./layout/SuperAdminHeader";
import SuperAdminDashboardContent from "./overview/SuperAdminDashboardContent";
import SuperAdminBusinesses from "./businesses/SuperAdminBusinesses";
import SuperAdminCustomers from "./customers/SuperAdminCustomers";
import SuperAdminBookings from "./bookings/SuperAdminBookings";
import SuperAdminFinance from "./finance/SuperAdminFinance";
import SuperAdminAnalytics from "./analytics/SuperAdminAnalytics";
import SuperAdminSupport from "./support/SuperAdminSupport";
import SuperAdminSettings from "./settings/SuperAdminSettings";
import SuperAdminContent from "./content/SuperAdminContent";
import SuperAdminPromoCode from "./promo-code/SuperAdminPromoCode";
import SuperAdminReviews from "./reviews/SuperAdminReviews";

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sharedViewingBusinessId, setSharedViewingBusinessId] = useState<string | null>(null);
  const [sharedViewingBusinessTab, setSharedViewingBusinessTab] = useState<string>("Overview");
  const [sharedViewingCustomerId, setSharedViewingCustomerId] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else {
        setIsCollapsed(false);
      }
    };

    // Check width on client-side mount
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#F9FAFB] overflow-hidden flex flex-col">
      {/* Sidebar */}
      <SuperAdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
      />

      {/* Header */}
      <SuperAdminHeader isCollapsed={isCollapsed} />

      {/* Main Content Area */}
      <main
        className={`pr-2 pt-[78px] pb-6 flex-grow transition-all duration-300 overflow-y-auto min-w-0 ${
          isCollapsed ? "pl-[88px]" : "pl-[256px]"
        }`}
      >
        {activeTab === "Dashboard" ? (
          <SuperAdminDashboardContent setActiveTab={setActiveTab} />
        ) : activeTab === "Businesses" ? (
          <SuperAdminBusinesses
            viewingBusinessId={sharedViewingBusinessId}
            setViewingBusinessId={setSharedViewingBusinessId}
            initialDetailTab={sharedViewingBusinessTab}
            setInitialDetailTab={setSharedViewingBusinessTab}
          />
        ) : activeTab === "Customers" ? (
          <SuperAdminCustomers 
            viewingCustomerId={sharedViewingCustomerId}
            setViewingCustomerId={setSharedViewingCustomerId}
          />
        ) : activeTab === "Bookings" ? (
          <SuperAdminBookings />
        ) : activeTab === "Finance" ? (
          <SuperAdminFinance
            setActiveTab={setActiveTab}
            setSharedViewingBusinessId={setSharedViewingBusinessId}
            setSharedViewingBusinessTab={setSharedViewingBusinessTab}
          />
        ) : activeTab === "Promo Code" ? (
          <SuperAdminPromoCode
            onClientClick={(customerUserId) => {
              // Redirect to customers tab and load the details page for the clicked redemption's customer
              setSharedViewingCustomerId(customerUserId);
              setActiveTab("Customers");
            }}
          />
        ) : activeTab === "Reviews" ? (
          <SuperAdminReviews />
        ) : activeTab === "Analytics" ? (
          <SuperAdminAnalytics setActiveTab={setActiveTab} />
        ) : activeTab === "Support" ? (
          <SuperAdminSupport />
        ) : activeTab === "Settings" ? (
          <SuperAdminSettings />
        ) : activeTab === "Content" ? (
          <SuperAdminContent />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[600px] bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <h3 className="font-sans font-semibold text-xl text-gray-800">{activeTab} Page</h3>
            <p className="font-sans text-sm text-gray-500 mt-2">This section is currently under active development.</p>
          </div>
        )}
      </main>
    </div>
  );
}
