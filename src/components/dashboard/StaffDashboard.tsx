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
import { initialBookingsData, initialClientsData } from "@/utils/dashboardMockData";
import { CompleteModal, NoShowModal } from "@/components/dashboard/CalendarActionModals";
import WaiveChargeModal from "@/components/dashboard/WaiveChargeModal";
import ClientBookingHistoryCard from "@/components/clients/ClientBookingHistoryCard";

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

interface Booking {
  clientInitials: string;
  clientName: string;
  clientPhone: string;
  isManual?: boolean;
  isNew?: boolean;
  bookingId: string;
  date: string;
  time: string;
  staff: string;
  status: string;
  amount: string;
  paymentType: string;
}

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

  // Logged-in staff name for filtering
  const loggedInStaffName = "Basel";

  // Filter bookings to display only those assigned to the logged-in staff member
  const filterStaffBookings = (list: Booking[]) => {
    return list.filter(b => b.staff === loggedInStaffName);
  };

  // Bookings Data & Filters
  const [bookingsData, setBookingsData] = useState<Booking[]>(() =>
    filterStaffBookings(initialBookingsData as Booking[])
  );
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("All");
  const [bookingStaffFilter, setBookingStaffFilter] = useState(loggedInStaffName);
  const [openBookingActionIdx, setOpenBookingActionIdx] = useState<number | null>(null);

  // Viewing booking details states
  const [viewingBookingIndex, setViewingBookingIndex] = useState<number | null>(null);
  const [isViewingBookingDetails, setIsViewingBookingDetails] = useState(false);
  const [showCompleteModalForBooking, setShowCompleteModalForBooking] = useState(false);
  const [showWaiveFeeModal, setShowWaiveFeeModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);

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

      if (isViewingClient && viewingBookingIndex !== null) {
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
      if (isViewingBookingDetails && viewingBookingIndex !== null) {
        const b = bookingsData[viewingBookingIndex];

        let statusType: "upcoming" | "noshow" | "completed" | "cancelled" | "late" | "pending" = "upcoming";
        if (b.status === "Pending") {
          statusType = "pending";
        } else if (b.status === "No-show · Charged" || b.status.toLowerCase().includes("no-show") || b.status.toLowerCase().includes("noshow")) {
          statusType = "noshow";
        } else if (b.status === "Completed") {
          statusType = "completed";
        } else if (b.status === "Canceled" || b.status === "Cancelled") {
          statusType = "cancelled";
        } else if (b.status.toLowerCase().includes("late cancellation")) {
          statusType = "late";
        }

        return (
          <main className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto bg-[#FCF8F8] p-6 md:p-8 select-none">
            <div
              onClick={() => {
                setIsViewingBookingDetails(false);
                setViewingBookingIndex(null);
              }}
              className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider mb-6 cursor-pointer hover:text-neutral-900 font-poppins select-none"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4 text-neutral-600" />
              <span>Bookings</span>
              <span className="text-neutral-300 font-normal">&gt;</span>
              <span className="text-[#0F1E35] font-semibold">View Booking</span>
            </div>

            <div className="mb-6 select-none">
              <h1 className="text-2xl font-semibold text-[#0F1E35] font-poppins">View booking</h1>
              <p className="text-xs text-neutral-500 font-poppins mt-0.5">See full details of the booking</p>
            </div>

            <div className="w-full flex justify-start">
              <ClientBookingHistoryCard
                bookingId={b.bookingId}
                status={b.status}
                statusType={statusType}
                clientName={b.clientName}
                clientPhone={b.clientPhone}
                dateText={b.date}
                timeText={b.time}
                staffName={b.staff}
                servicePrice={b.amount}
                onCompleteBooking={() => setShowCompleteModalForBooking(true)}
                onCancelNoShowClick={() => setShowNoShowModal(true)}
              />
            </div>
          </main>
        );
      }

      return (
        <DashboardBookingsList
          activeTab={activeTab}
          bookingsData={bookingsData}
          setBookingsData={setBookingsData}
          bookingSearch={bookingSearch}
          setBookingSearch={setBookingSearch}
          bookingStatusFilter={bookingStatusFilter}
          setBookingStatusFilter={setBookingStatusFilter}
          bookingStaffFilter={bookingStaffFilter}
          setBookingStaffFilter={setBookingStaffFilter}
          openBookingActionIdx={openBookingActionIdx}
          setOpenBookingActionIdx={setOpenBookingActionIdx}
          setIsCreatingBooking={() => {}}
          setIsEditingBooking={() => {}}
          setEditingBookingIndex={() => {}}
          setNewBookingName={() => {}}
          setNewBookingPhone={() => {}}
          setNewBookingPhoneCode={() => {}}
          setNewBookingDate={() => {}}
          setNewBookingTime={() => {}}
          setNewBookingStaff={() => {}}
          onViewBookingDetails={(idx) => {
            setViewingBookingIndex(idx);
            setIsViewingBookingDetails(true);
          }}
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

      {/* Floating Action Modals */}
      <CompleteModal
        isOpen={showCompleteModalForBooking}
        onClose={() => setShowCompleteModalForBooking(false)}
        onConfirm={() => {
          if (viewingBookingIndex !== null) {
            const updated = [...bookingsData];
            updated[viewingBookingIndex].status = "Completed";
            setBookingsData(updated);
          }
          setShowCompleteModalForBooking(false);
        }}
      />

      <NoShowModal
        isOpen={showNoShowModal}
        onClose={() => setShowNoShowModal(false)}
        onConfirm={() => {
          if (viewingBookingIndex !== null) {
            const updated = [...bookingsData];
            updated[viewingBookingIndex].status = "No-show · Charged";
            setBookingsData(updated);
          }
          setShowNoShowModal(false);
        }}
      />

      <WaiveChargeModal
        isOpen={showWaiveFeeModal}
        onClose={() => setShowWaiveFeeModal(false)}
        onConfirm={() => {
          if (viewingBookingIndex !== null) {
            const updated = [...bookingsData];
            updated[viewingBookingIndex].status = "No-show · Waived";
            setBookingsData(updated);
          }
          setShowWaiveFeeModal(false);
        }}
      />
    </div>
  );
}
