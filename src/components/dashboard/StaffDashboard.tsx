"use client";

import React, { useEffect, useRef, useState } from "react";

// Staff Customized Sub-components
import StaffSidebar from "./StaffSidebar";
import StaffOverview from "./StaffOverview";
import StaffSettings from "./StaffSettings";

// Modular Dashboard sub-components
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";
import DashboardBookingsList from "@/components/dashboard/DashboardBookingsList";
import NotAvailableForRole from "@/components/dashboard/NotAvailableForRole";
import ContactSupport from "@/components/support/ContactSupport";
import DashboardReviewsList from "@/components/dashboard/DashboardReviewsList";
import { useManagedBusinessContext } from "@/lib/business/hooks";
import { useCurrentUserQuery } from "@/lib/auth/hooks";

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFooterMenu, setShowFooterMenu] = useState(true);
  const footerMenuRef = useRef<HTMLDivElement>(null);
  const loggedInStaffName = useCurrentUserQuery().data?.profile?.firstName;

  // Batch 6: no product rule grants STAFF booking-management rights (confirmed rule W — see
  // api/.../booking.service.ts requireBookingManagementAccess, which only ever authorizes
  // BUSINESS_OWNER/SUPERVISOR). `businessId` is therefore always undefined here — real Booking
  // data/actions are intentionally NOT wired for this dashboard; see the Batch 6 final report.
  const { businessId: bookingsBusinessId } = useManagedBusinessContext();

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
      return (
        <DashboardCalendar
          businessId={bookingsBusinessId}
          onNewBookingClick={() => {}}
          isStaffDashboard={true}
          staffName={loggedInStaffName}
        />
      );
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
      // No product rule grants STAFF booking-management rights (confirmed rule W) — the real
      // Booking list/detail/actions are Owner/Supervisor-only (see
      // requireBookingManagementAccess). DashboardBookingsList itself renders the correct
      // "not available for your account" state when businessId is undefined, exactly as it is
      // here, rather than this dashboard faking a working detail view.
      return (
        <DashboardBookingsList
          activeTab={activeTab}
          businessId={bookingsBusinessId}
          isStaffDashboard={true} // custom prop to hide headers filters and +New booking buttons
        />
      );
    }

    if (activeTab === "Staff") {
      // No product rule grants STAFF team-management access (staff.route.ts is BUSINESS_OWNER-only)
      // — same honest-unavailable treatment, rather than a mock add/edit/delete-teammate UI.
      return (
        <NotAvailableForRole
          title="Staff"
          subtitle="Team members, hours, and service assignments"
          message="Team management isn't available for your account"
          detail="Only the Business Owner can manage team members."
        />
      );
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
