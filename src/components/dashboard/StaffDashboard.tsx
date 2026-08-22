"use client";

import React, { useState, useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BellIcon,
  ArrowLeft02Icon,
  User02Icon,
  PencilEdit02Icon,
  Search01Icon,
  Mail01Icon,
  Calendar03Icon,
  ScissorIcon,
  Calendar02Icon,
  Location05Icon
} from "@hugeicons/core-free-icons";

// Reused components
import { initialClientsData } from "@/utils/dashboardMockData";

// Staff Customized Sub-components
import StaffSidebar from "./StaffSidebar";
import StaffOverview from "./StaffOverview";
import StaffSettings from "./StaffSettings";
import StaffStaffList from "./StaffStaffList";

// Modular Dashboard sub-components
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";
import DashboardBookingsList from "@/components/dashboard/DashboardBookingsList";
import ClientsList from "@/components/clients/ClientsList";
import ClientDetails from "@/components/clients/ClientDetails";
import ClientForm from "@/components/clients/ClientForm";
import ContactSupport from "@/components/support/ContactSupport";
import DashboardReviewsList from "@/components/dashboard/DashboardReviewsList";
import { useManagedBusinessContext } from "@/lib/business/hooks";

interface Client {
  id?: string;
  name: string;
  joined: string;
  phone: string;
  visitText?: string;
  visitSub?: string;
  isNext?: boolean;
  visits?: number;
  spent?: string;
  tag: string | null;
  tagBg: string;
  tagColor: string;
  avatarBg: string;
  avatarText: string;
  avatar?: string;
}

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFooterMenu, setShowFooterMenu] = useState(true);
  const footerMenuRef = useRef<HTMLDivElement>(null);

  // Logged-in staff name — display only now (Batch 6): real Booking data/filtering is not
  // wired for Staff at all, see the comment below.
  const loggedInStaffName = "Basel";

  // Batch 6: no product rule grants STAFF booking-management rights (confirmed rule W — see
  // api/.../booking.service.ts requireBookingManagementAccess, which only ever authorizes
  // BUSINESS_OWNER/SUPERVISOR). `businessId` is therefore always undefined here — real Booking
  // data/actions are intentionally NOT wired for this dashboard; see the Batch 6 final report.
  const { businessId: bookingsBusinessId } = useManagedBusinessContext();

  // Clients Data states
  const [clientsData, setClientsData] = useState<Client[]>(initialClientsData as Client[]);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [isViewingClient, setIsViewingClient] = useState(false);
  const [editingClientIndex, setEditingClientIndex] = useState<number | null>(null);
  const [openActionIdx, setOpenActionIdx] = useState<number | null>(null);

  // Add Client Form states
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientDob, setClientDob] = useState("1/6/2026");
  const [clientGender, setClientGender] = useState("Male");
  const [clientCity, setClientCity] = useState("Limasol");
  const [clientPropertyType, setClientPropertyType] = useState("");
  const [clientArea, setClientArea] = useState("");
  const [clientStreetName, setClientStreetName] = useState("");
  const [clientStreetNumber, setClientStreetNumber] = useState("");
  const [clientFloor, setClientFloor] = useState("");
  const [clientAptNo, setClientAptNo] = useState("");

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

  const handleEditClient = (idx: number) => {
    const c = clientsData[idx];
    const names = c.name.split(" ");
    setClientFirstName(names[0] || "");
    setClientLastName(names.slice(1).join(" ") || "");
    setClientPhone(c.phone);
    setEditingClientIndex(idx);
    setIsAddingClient(true);
  };

  const handleSaveClientChanges = () => {
    if (editingClientIndex !== null) {
      const updated = [...clientsData];
      updated[editingClientIndex] = {
        ...updated[editingClientIndex],
        name: `${clientFirstName} ${clientLastName}`,
        phone: clientPhone
      };
      setClientsData(updated);
      setIsAddingClient(false);
      setEditingClientIndex(null);
    }
  };

  const handleAddClient = () => {
    if (!clientFirstName) return;
    const newC: Client = {
      name: `${clientFirstName} ${clientLastName}`,
      joined: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      phone: clientPhone,
      visits: 0,
      spent: "€0",
      visitText: "No visits yet",
      visitSub: "add booking to get visit data",
      tag: "Active",
      tagBg: "bg-emerald-50",
      tagColor: "text-emerald-700",
      avatarBg: "bg-[#10745B]/10",
      avatarText: `${clientFirstName[0]}${clientLastName[0] || ""}`.toUpperCase()
    };
    setClientsData([newC, ...clientsData]);
    setIsAddingClient(false);
  };

  const handleDeleteClient = (idx: number) => {
    setClientsData(clientsData.filter((_, i) => i !== idx));
    setOpenActionIdx(null);
  };

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
      if (isAddingClient) {
        return (
          <ClientForm
            editingClientIndex={editingClientIndex}
            isViewingClient={isViewingClient}
            setIsAddingClient={setIsAddingClient}
            setEditingClientIndex={setEditingClientIndex}
            setIsViewingClient={setIsViewingClient}
            clientFirstName={clientFirstName}
            setClientFirstName={setClientFirstName}
            clientLastName={clientLastName}
            setClientLastName={setClientLastName}
            clientPhone={clientPhone}
            setClientPhone={setClientPhone}
            clientEmail={clientEmail}
            setClientEmail={setClientEmail}
            clientDob={clientDob}
            setClientDob={setClientDob}
            clientGender={clientGender}
            setClientGender={setClientGender}
            clientCity={clientCity}
            setClientCity={setClientCity}
            clientPropertyType={clientPropertyType}
            setClientPropertyType={setClientPropertyType}
            clientArea={clientArea}
            setClientArea={setClientArea}
            clientStreetName={clientStreetName}
            setClientStreetName={setClientStreetName}
            clientStreetNumber={clientStreetNumber}
            setClientStreetNumber={setClientStreetNumber}
            clientFloor={clientFloor}
            setClientFloor={setClientFloor}
            clientAptNo={clientAptNo}
            setClientAptNo={setClientAptNo}
            clientDirections=""
            setClientDirections={() => {}}
            clientNotes=""
            setClientNotes={() => {}}
            clientTag=""
            setClientTagState={() => {}}
            clientAvatar=""
            clientAvatarInputRef={{ current: null }}
            handleClientAvatarChange={() => {}}
            clientPhoneCode="+357"
            setClientPhoneCode={() => {}}
            clientPhoneFlag="cy"
            setClientPhoneFlag={() => {}}
            isClientPhoneDropdownOpen={false}
            setIsClientPhoneDropdownOpen={() => {}}
            phoneCountries={[]}
            handleSaveClient={handleSaveClientChanges}
            handleAddClient={handleAddClient}
          />
        );
      }

      if (isViewingClient) {
        return (
          <ClientDetails
            clientFirstName={clientFirstName}
            clientLastName={clientLastName}
            clientEmail={clientEmail}
            clientGender={clientGender}
            clientDob={clientDob}
            clientPhone={clientPhone}
            clientCity={clientCity}
            clientPropertyType={clientPropertyType}
            clientArea={clientArea}
            clientStreetName={clientStreetName}
            clientStreetNumber={clientStreetNumber}
            clientFloor={clientFloor}
            clientAptNo={clientAptNo}
            setIsViewingClient={setIsViewingClient}
            setEditingClientIndex={setEditingClientIndex}
          />
        );
      }

      return (
        <ClientsList
          clientsData={clientsData}
          setClientsData={setClientsData}
          setIsAddingClient={setIsAddingClient}
          setIsViewingClient={setIsViewingClient}
          setEditingClientIndex={setEditingClientIndex}
          openActionIdx={openActionIdx}
          setOpenActionIdx={setOpenActionIdx}
          setClientFirstName={setClientFirstName}
          setClientLastName={setClientLastName}
          setClientPhone={setClientPhone}
          setClientTagState={() => {}}
          isStaffDashboard={true}
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
      return <StaffStaffList />;
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
