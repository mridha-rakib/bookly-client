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
import { initialBookingsData } from "@/utils/dashboardMockData";
import { CompleteModal, NoShowModal } from "@/components/dashboard/CalendarActionModals";
import WaiveChargeModal from "@/components/dashboard/WaiveChargeModal";
import ClientBookingHistoryCard from "@/components/clients/ClientBookingHistoryCard";
import { useCurrentUserQuery } from "@/lib/auth/hooks";

// Supervisor Customized Sub-components
import SupervisorSidebar from "./SupervisorSidebar";
import SupervisorOverview from "./SupervisorOverview";
import SupervisorSettings from "./SupervisorSettings";
import SupervisorStaffList from "./SupervisorStaffList";

// Modular Dashboard sub-components
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";
import DashboardBookingsList from "@/components/dashboard/DashboardBookingsList";
import DashboardBookingForm from "@/components/dashboard/DashboardBookingForm";
import ClientsPage from "@/components/clients/ClientsPage";
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

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState("Calendar");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFooterMenu, setShowFooterMenu] = useState(true);
  const footerMenuRef = useRef<HTMLDivElement>(null);

  // Bookings Data & Filters
  const [bookingsData, setBookingsData] = useState<Booking[]>(initialBookingsData as Booking[]);
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("All");
  const [bookingStaffFilter, setBookingStaffFilter] = useState("All Staff");
  const [openBookingActionIdx, setOpenBookingActionIdx] = useState<number | null>(null);

  // Manual Booking states
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [isEditingBooking, setIsEditingBooking] = useState(false);
  const [editingBookingIndex, setEditingBookingIndex] = useState<number | null>(null);

  const [newBookingName, setNewBookingName] = useState("John Doe");
  const [newBookingDob, setNewBookingDob] = useState("1/6/2026");
  const [newBookingGender, setNewBookingGender] = useState("Male");
  const [newBookingEmail, setNewBookingEmail] = useState("example@email.com");
  const [newBookingPhoneCode, setNewBookingPhoneCode] = useState("+357");
  const [newBookingPhone, setNewBookingPhone] = useState("1111111111");
  const [newBookingCity, setNewBookingCity] = useState("Limasol");
  const [newBookingPropertyType, setNewBookingPropertyType] = useState("");
  const [newBookingArea, setNewBookingArea] = useState("");
  const [newBookingStreetName, setNewBookingStreetName] = useState("");
  const [newBookingStreetNumber, setNewBookingStreetNumber] = useState("");
  const [newBookingFloor, setNewBookingFloor] = useState("");
  const [newBookingApt, setNewBookingApt] = useState("");
  const [newBookingDirections, setNewBookingDirections] = useState("");
  const [newBookingServices, setNewBookingServices] = useState<Array<{ name: string, duration: string, price: number }>>([
    { name: "Haircut", duration: "30 min", price: 90 }
  ]);
  const [newBookingAddons, setNewBookingAddons] = useState<Array<{ name: string, duration: string, price: number }>>([
    { name: "Haircut", duration: "30 min", price: 90 }
  ]);
  const [newBookingStaff, setNewBookingStaff] = useState("Basel");
  const [newBookingDate, setNewBookingDate] = useState("Apr 3, 2026");
  const [newBookingTime, setNewBookingTime] = useState("10:00 AM");
  const [newBookingServiceCity, setNewBookingServiceCity] = useState("Larnaca");
  const [newBookingTags, setNewBookingTags] = useState<string[]>(["VIP"]);
  const [newBookingNotes, setNewBookingNotes] = useState("");

  // Viewing booking details states
  const [viewingBookingIndex, setViewingBookingIndex] = useState<number | null>(null);
  const [isViewingBookingDetails, setIsViewingBookingDetails] = useState(false);
  const [showCompleteModalForBooking, setShowCompleteModalForBooking] = useState(false);
  const [showWaiveFeeModal, setShowWaiveFeeModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);

  // Clients — real Client Management data/hooks live in ClientsPage; this page only resolves
  // the Supervisor's businessId via their active Staff membership (see /auth/me).
  const currentUserQuery = useCurrentUserQuery();
  const clientsBusinessId = currentUserQuery.data?.business?.id;

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

  const handleEditBooking = (idx: number) => {
    const b = bookingsData[idx];
    setEditingBookingIndex(idx);
    setNewBookingName(b.clientName);
    setNewBookingPhone(b.clientPhone);
    setNewBookingDate(b.date);
    setNewBookingTime(b.time);
    setNewBookingStaff(b.staff);
    setIsEditingBooking(true);
  };

  const handleSaveBookingChanges = () => {
    if (editingBookingIndex !== null) {
      const updated = [...bookingsData];
      updated[editingBookingIndex] = {
        ...updated[editingBookingIndex],
        clientName: newBookingName,
        clientPhone: newBookingPhone,
        date: newBookingDate,
        time: newBookingTime,
        staff: newBookingStaff
      };
      setBookingsData(updated);
      setIsEditingBooking(false);
      setEditingBookingIndex(null);
    }
  };

  const handleAddNewBooking = () => {
    const newB: Booking = {
      clientInitials: newBookingName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "JD",
      clientName: newBookingName,
      clientPhone: newBookingPhone,
      bookingId: `CY-${Math.floor(100000 + Math.random() * 900000)}`,
      date: newBookingDate,
      time: newBookingTime,
      staff: newBookingStaff,
      status: "Pending",
      amount: `€${newBookingServices.reduce((sum, s) => sum + s.price, 0)}`,
      paymentType: "Pay at venue"
    };
    setBookingsData([newB, ...bookingsData]);
    setIsCreatingBooking(false);
  };

  // Render components mapped to Tab selections
  const renderMainContent = () => {
    if (isCreatingBooking) {
      return (
        <DashboardBookingForm
          isEditingBooking={isEditingBooking}
          editingBookingIndex={editingBookingIndex}
          bookingsData={bookingsData}
          setBookingsData={setBookingsData}
          setIsCreatingBooking={setIsCreatingBooking}
          setIsEditingBooking={setIsEditingBooking}
          setEditingBookingIndex={setEditingBookingIndex}
          newBookingName={newBookingName}
          setNewBookingName={setNewBookingName}
          newBookingDob={newBookingDob}
          setNewBookingDob={setNewBookingDob}
          newBookingGender={newBookingGender}
          setNewBookingGender={setNewBookingGender}
          newBookingEmail={newBookingEmail}
          setNewBookingEmail={setNewBookingEmail}
          newBookingPhoneCode={newBookingPhoneCode}
          setNewBookingPhoneCode={setNewBookingPhoneCode}
          newBookingPhone={newBookingPhone}
          setNewBookingPhone={setNewBookingPhone}
          newBookingCity={newBookingCity}
          setNewBookingCity={setNewBookingCity}
          newBookingPropertyType={newBookingPropertyType}
          setNewBookingPropertyType={setNewBookingPropertyType}
          newBookingArea={newBookingArea}
          setNewBookingArea={setNewBookingArea}
          newBookingStreetName={newBookingStreetName}
          setNewBookingStreetName={setNewBookingStreetName}
          newBookingStreetNumber={newBookingStreetNumber}
          setNewBookingStreetNumber={setNewBookingStreetNumber}
          newBookingFloor={newBookingFloor}
          setNewBookingFloor={setNewBookingFloor}
          newBookingApt={newBookingApt}
          setNewBookingApt={setNewBookingApt}
          newBookingDirections={newBookingDirections}
          setNewBookingDirections={setNewBookingDirections}
          newBookingServices={newBookingServices}
          setNewBookingServices={setNewBookingServices}
          newBookingAddons={newBookingAddons}
          setNewBookingAddons={setNewBookingAddons}
          newBookingStaff={newBookingStaff}
          setNewBookingStaff={setNewBookingStaff}
          newBookingDate={newBookingDate}
          setNewBookingDate={setNewBookingDate}
          newBookingTime={newBookingTime}
          setNewBookingTime={setNewBookingTime}
          newBookingServiceCity={newBookingServiceCity}
          setNewBookingServiceCity={setNewBookingServiceCity}
          newBookingTags={newBookingTags}
          setNewBookingTags={setNewBookingTags}
          newBookingNotes={newBookingNotes}
          setNewBookingNotes={setNewBookingNotes}
        />
      );
    }

    if (isEditingBooking) {
      return (
        <DashboardBookingForm
          isEditingBooking={isEditingBooking}
          editingBookingIndex={editingBookingIndex}
          bookingsData={bookingsData}
          setBookingsData={setBookingsData}
          setIsCreatingBooking={setIsCreatingBooking}
          setIsEditingBooking={setIsEditingBooking}
          setEditingBookingIndex={setEditingBookingIndex}
          newBookingName={newBookingName}
          setNewBookingName={setNewBookingName}
          newBookingDob={newBookingDob}
          setNewBookingDob={setNewBookingDob}
          newBookingGender={newBookingGender}
          setNewBookingGender={setNewBookingGender}
          newBookingEmail={newBookingEmail}
          setNewBookingEmail={setNewBookingEmail}
          newBookingPhoneCode={newBookingPhoneCode}
          setNewBookingPhoneCode={setNewBookingPhoneCode}
          newBookingPhone={newBookingPhone}
          setNewBookingPhone={setNewBookingPhone}
          newBookingCity={newBookingCity}
          setNewBookingCity={setNewBookingCity}
          newBookingPropertyType={newBookingPropertyType}
          setNewBookingPropertyType={setNewBookingPropertyType}
          newBookingArea={newBookingArea}
          setNewBookingArea={setNewBookingArea}
          newBookingStreetName={newBookingStreetName}
          setNewBookingStreetName={setNewBookingStreetName}
          newBookingStreetNumber={newBookingStreetNumber}
          setNewBookingStreetNumber={setNewBookingStreetNumber}
          newBookingFloor={newBookingFloor}
          setNewBookingFloor={setNewBookingFloor}
          newBookingApt={newBookingApt}
          setNewBookingApt={setNewBookingApt}
          newBookingDirections={newBookingDirections}
          setNewBookingDirections={setNewBookingDirections}
          newBookingServices={newBookingServices}
          setNewBookingServices={setNewBookingServices}
          newBookingAddons={newBookingAddons}
          setNewBookingAddons={setNewBookingAddons}
          newBookingStaff={newBookingStaff}
          setNewBookingStaff={setNewBookingStaff}
          newBookingDate={newBookingDate}
          setNewBookingDate={setNewBookingDate}
          newBookingTime={newBookingTime}
          setNewBookingTime={setNewBookingTime}
          newBookingServiceCity={newBookingServiceCity}
          setNewBookingServiceCity={setNewBookingServiceCity}
          newBookingTags={newBookingTags}
          setNewBookingTags={setNewBookingTags}
          newBookingNotes={newBookingNotes}
          setNewBookingNotes={setNewBookingNotes}
        />
      );
    }

    if (activeTab === "Dashboard") {
      return <SupervisorOverview />;
    }

    if (activeTab === "Calendar") {
      return (
        <DashboardCalendar
          onNewBookingClick={() => {
            setIsCreatingBooking(true);
            setActiveTab("All Bookings");
          }}
          onViewBookingClick={(clientName) => {
            let index = bookingsData.findIndex(b => b.clientName.toLowerCase().includes(clientName.toLowerCase()));
            if (index === -1) {
              const newBookingObj: Booking = {
                clientName: clientName,
                clientPhone: "+357 99 999 999",
                clientInitials: clientName.split(' ').map(n => n[0]).join(''),
                isNew: true,
                bookingId: `#BK-${Math.floor(1000 + Math.random() * 9000)}`,
                date: "Wed, 21 Jun",
                time: "10:00",
                staff: "John",
                status: "Upcoming",
                amount: "€54",
                paymentType: "Pay at venue"
              };
              setBookingsData(prev => [newBookingObj, ...prev]);
              index = 0;
            }
            setViewingBookingIndex(index);
            setIsViewingBookingDetails(true);
            setActiveTab("All Bookings");
          }}
        />
      );
    }

    if (activeTab === "Clients") {
      return <ClientsPage businessId={clientsBusinessId} />;
    }

    if (activeTab === "All Bookings" || activeTab === "Upcoming" || activeTab === "Canceled") {
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
            {/* Breadcrumbs */}
            <div
              onClick={() => {
                setIsViewingBookingDetails(false);
                setViewingBookingIndex(null);
              }}
              className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider mb-6 cursor-pointer hover:text-neutral-900 font-poppins select-none"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4 text-neutral-600" />
              <span>All Bookings</span>
              <span className="text-neutral-300 font-normal">&gt;</span>
              <span className="text-[#0F1E35] font-semibold">View Booking</span>
            </div>

            {/* Title section */}
            <div className="mb-6 select-none">
              <h1 className="text-2xl font-semibold text-[#0F1E35] font-poppins">View booking</h1>
              <p className="text-xs text-neutral-500 font-poppins mt-0.5">See full details of the booking</p>
            </div>

            {/* Details Card */}
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
          setIsCreatingBooking={setIsCreatingBooking}
          setIsEditingBooking={setIsEditingBooking}
          setEditingBookingIndex={setEditingBookingIndex}
          setNewBookingName={setNewBookingName}
          setNewBookingPhone={setNewBookingPhone}
          setNewBookingPhoneCode={setNewBookingPhoneCode}
          setNewBookingDate={setNewBookingDate}
          setNewBookingTime={setNewBookingTime}
          setNewBookingStaff={setNewBookingStaff}
          onViewBookingDetails={(idx) => {
            setViewingBookingIndex(idx);
            setIsViewingBookingDetails(true);
          }}
        />
      );
    }

    if (activeTab === "Staff") {
      return <SupervisorStaffList />;
    }

    if (activeTab === "Reviews") {
      return <DashboardReviewsList />;
    }

    if (activeTab === "Settings") {
      return <SupervisorSettings />;
    }

    if (activeTab === "Contact Support") {
      return <ContactSupport setActiveTab={setActiveTab} />;
    }

    return <SupervisorOverview />;
  };

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-[#FCF8F8]">
      {/* Sidebar Navigation */}
      <SupervisorSidebar
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
