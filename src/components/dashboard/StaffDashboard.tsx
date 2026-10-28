"use client";

import React, { useEffect, useRef, useState } from "react";

// Staff Customized Sub-components
import StaffSidebar from "./StaffSidebar";
import StaffOverview from "./StaffOverview";
import StaffSettings from "./StaffSettings";

// Modular Dashboard sub-components
import StaffMyAppointments from "@/components/dashboard/StaffMyAppointments";
import NotAvailableForRole from "@/components/dashboard/NotAvailableForRole";
import ContactSupport from "@/components/support/ContactSupport";
import DashboardReviewsList from "@/components/dashboard/DashboardReviewsList";
import StaffMySchedule from "@/components/dashboard/StaffMySchedule";

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFooterMenu, setShowFooterMenu] = useState(true);
  const footerMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (footerMenuRef.current && !footerMenuRef.current.contains(e.target as Node)) {
        setShowFooterMenu(false);
      }
    };
    window.addEventListener("click", handleOutsideClick);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, []);

  // Render components mapped to Tab selections
  const renderMainContent = () => {
    if (activeTab === "Dashboard") {
      return <StaffOverview />;
    }

    if (activeTab === "Calendar") {
      // D-S1/D-S2 reads only: never use the Owner/Supervisor management calendar API.
      return <StaffMyAppointments key="Calendar" view="Calendar" />;
    }

    if (activeTab === "Clients") {
      // No product rule grants STAFF client read/write access (client.route.ts requires
      // BUSINESS_OWNER/SUPERVISOR) — same honest-unavailable treatment as Bookings above, rather
      // than a mock client list that could never be backed by a real save/delete.
      return (
        <NotAvailableForRole
          title="Clients"
          subtitle="View your business's client list"
          message="Client management isn't available for your account"
          detail="Only the Business Owner and an active Supervisor can view and manage clients."
        />
      );
    }

    if (activeTab === "Upcoming" || activeTab === "Canceled") {
      // P4C-1 (Owner decision D-S1) — the Staff member's OWN assigned appointments, read-only,
      // from the Staff-scoped API. Booking management (list of all bookings, cancel, reschedule,
      // complete, no-show, payments, Packages) stays Owner/Supervisor-only (rule W).
      return <StaffMyAppointments key={activeTab} view={activeTab} />;
    }

    if (activeTab === "Staff") {
      // Phase 4A — Staff still has no team-management access (staff.route.ts core-identity
      // endpoints stay BUSINESS_OWNER-only), but now gets read-only self-service: their own
      // schedule and their own assigned services, via the new /staff/me/* endpoints.
      return <StaffMySchedule />;
    }

    if (activeTab === "Reviews") {
      return <DashboardReviewsList />;
    }

    if (activeTab === "Settings") {
      return <StaffSettings />;
    }

    if (activeTab === "Contact Support") {
      return <ContactSupport setActiveTab={setActiveTab} />;
    }

    return <StaffOverview />;
  };

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-[#FCF8F8]">
      <StaffSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showFooterMenu={showFooterMenu}
        setShowFooterMenu={setShowFooterMenu}
        footerMenuRef={footerMenuRef}
      />

      {/* Main Layout Area */}
      {renderMainContent()}
    </div>
  );
}
