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

// Reused component
import { initialBookingsData, initialClientsData } from "@/utils/dashboardMockData";
import RequireBusinessOwner from "@/components/auth/RequireBusinessOwner";

// Modular Dashboard sub-components
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";
import DashboardBookingsList from "@/components/dashboard/DashboardBookingsList";
import DashboardBookingForm from "@/components/dashboard/DashboardBookingForm";
import ClientsList from "@/components/clients/ClientsList";
import ClientDetails from "@/components/clients/ClientDetails";
import ClientForm from "@/components/clients/ClientForm";
import ClientBookingHistoryCard from "@/components/clients/ClientBookingHistoryCard";
import DashboardBusinessProfile from "@/components/dashboard/DashboardBusinessProfile";
import DashboardCreateBusiness from "@/components/dashboard/DashboardCreateBusiness";
import DashboardServicesList from "@/components/dashboard/DashboardServicesList";
import DashboardAddonsList from "@/components/dashboard/DashboardAddonsList";
import DashboardStaffList from "@/components/dashboard/DashboardStaffList";
import DashboardReviewsList from "@/components/dashboard/DashboardReviewsList";
import DashboardPayoutsList from "@/components/dashboard/DashboardPayoutsList";
import DashboardAnalytics from "@/components/dashboard/DashboardAnalytics";
import DashboardSettings from "@/components/dashboard/DashboardSettings";
import ContactSupport from "@/components/support/ContactSupport";
import { CompleteModal, NoShowModal } from "@/components/dashboard/CalendarActionModals";
import WaiveChargeModal from "@/components/dashboard/WaiveChargeModal";

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
  name: string;
  joined: string;
  phone: string;
  visitText: string;
  visitSub: string;
  isNext?: boolean;
  visits: number;
  spent: string;
  tag: string | null;
  tagBg: string;
  tagColor: string;
  avatarBg: string;
  avatarText: string;
  avatar?: string;
}

function BusinessDashboardContent() {
  const [activeTab, setActiveTab] = useState("Calendar");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFooterMenu, setShowFooterMenu] = useState(false);
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
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const [businessProfileMode, setBusinessProfileMode] = useState<"create" | "edit" | "view">("create");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

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
  const [clientDirections, setClientDirections] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  const [clientTag, setClientTagState] = useState("VIP");

  // Avatar and Phone Country Code states
  const [clientAvatar, setClientAvatar] = useState("");
  const clientAvatarInputRef = useRef<HTMLInputElement>(null);
  const [clientPhoneCode, setClientPhoneCode] = useState("+357");
  const [clientPhoneFlag, setClientPhoneFlag] = useState("cy");
  const [isClientPhoneDropdownOpen, setIsClientPhoneDropdownOpen] = useState(false);

  const phoneCountries = [
    { name: "Cyprus", code: "+357", flag: "cy" },
    { name: "Bangladesh", code: "+880", flag: "bd" },
    { name: "Greece", code: "+30", flag: "gr" },
    { name: "United Kingdom", code: "+44", flag: "gb" },
    { name: "United States", code: "+1", flag: "us" }
  ];

  const handleClientAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setClientAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddClient = () => {
    if (!clientFirstName || !clientPhone) return;
    const newClient: Client = {
      name: `${clientFirstName} ${clientLastName}`.trim(),
      joined: `Since ${new Date().toLocaleString("en-US", { month: "short", year: "numeric" })}`,
      phone: `${clientPhoneCode} ${clientPhone}`.trim(),
      visitText: "—",
      visitSub: "No visits yet",
      isNext: false,
      visits: 0,
      spent: "€0",
      tag: clientTag || null,
      tagBg: clientTag === "VIP" ? "bg-[#FAEEDA]" : clientTag === "No-show" ? "bg-[#FCE4E4]" : clientTag === "New" ? "bg-[#E6F1FB]" : "bg-neutral-100",
      tagColor: clientTag === "VIP" ? "text-[#633806]" : clientTag === "No-show" ? "text-[#E42424]" : clientTag === "New" ? "text-[#0C447C]" : "text-neutral-600",
      avatarBg: "bg-[#E1F5EE]",
      avatarText: `${clientFirstName.charAt(0)}${clientLastName ? clientLastName.charAt(0) : ""}`.toUpperCase(),
      avatar: clientAvatar || undefined
    };
    setClientsData([newClient, ...clientsData]);
    // Reset Form
    setClientFirstName("");
    setClientLastName("");
    setClientPhone("");
    setClientEmail("");
    setClientDob("1/6/2026");
    setClientGender("Male");
    setClientCity("Limasol");
    setClientPropertyType("");
    setClientArea("");
    setClientStreetName("");
    setClientStreetNumber("");
    setClientFloor("");
    setClientAptNo("");
    setClientDirections("");
    setClientNotes("");
    setClientTagState("VIP");
    setClientAvatar("");
    setClientPhoneCode("+357");
    setClientPhoneFlag("cy");
    setIsAddingClient(false);
  };

  const handleSaveClient = () => {
    if (editingClientIndex === null || !clientFirstName || !clientPhone) return;
    const updated = [...clientsData];
    updated[editingClientIndex] = {
      ...updated[editingClientIndex],
      name: `${clientFirstName} ${clientLastName}`.trim(),
      phone: `${clientPhoneCode} ${clientPhone}`.trim(),
      tag: clientTag || null,
      tagBg: clientTag === "VIP" ? "bg-[#FAEEDA]" : clientTag === "No-show" ? "bg-[#FCE4E4]" : clientTag === "New" ? "bg-[#E6F1FB]" : "bg-neutral-100",
      tagColor: clientTag === "VIP" ? "text-[#633806]" : clientTag === "No-show" ? "text-[#E42424]" : clientTag === "New" ? "text-[#0C447C]" : "text-neutral-600",
      avatarText: `${clientFirstName.charAt(0)}${clientLastName ? clientLastName.charAt(0) : ""}`.toUpperCase(),
      avatar: clientAvatar || undefined
    };
    setClientsData(updated);
    // Reset Form
    setClientFirstName("");
    setClientLastName("");
    setClientPhone("");
    setClientEmail("");
    setClientDob("1/6/2026");
    setClientGender("Male");
    setClientCity("Limasol");
    setClientPropertyType("");
    setClientArea("");
    setClientStreetName("");
    setClientStreetNumber("");
    setClientFloor("");
    setClientAptNo("");
    setClientDirections("");
    setClientNotes("");
    setClientTagState("VIP");
    setClientAvatar("");
    setClientPhoneCode("+357");
    setClientPhoneFlag("cy");
    setEditingClientIndex(null);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  }, []);

  const handleSetActiveTab = (tab: string) => {
    if (tab === "Business Profile") {
      setIsCreatingBusiness(false);
    }
    setIsCreatingBooking(false);
    setActiveTab(tab);
  };

  // Commented out to prevent page shifting and cutting off the top header on mount
  // useEffect(() => {
  //   if (showFooterMenu && footerMenuRef.current) {
  //     footerMenuRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  //   }
  // }, [showFooterMenu]);

  // Main UI router switch helper
  const renderMainContent = () => {
    if (activeTab === "Dashboard") {
      return <DashboardOverview />;
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
            clientAvatar={clientAvatar}
            setIsViewingClient={setIsViewingClient}
            setEditingClientIndex={setEditingClientIndex}
          />
        );
      }

      if (isAddingClient || editingClientIndex !== null) {
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
            clientDirections={clientDirections}
            setClientDirections={setClientDirections}
            clientNotes={clientNotes}
            setClientNotes={setClientNotes}
            clientTag={clientTag}
            setClientTagState={setClientTagState}
            clientAvatar={clientAvatar}
            clientAvatarInputRef={clientAvatarInputRef}
            handleClientAvatarChange={handleClientAvatarChange}
            clientPhoneCode={clientPhoneCode}
            setClientPhoneCode={setClientPhoneCode}
            clientPhoneFlag={clientPhoneFlag}
            setClientPhoneFlag={setClientPhoneFlag}
            isClientPhoneDropdownOpen={isClientPhoneDropdownOpen}
            setIsClientPhoneDropdownOpen={setIsClientPhoneDropdownOpen}
            phoneCountries={phoneCountries}
            handleSaveClient={handleSaveClient}
            handleAddClient={handleAddClient}
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
          setClientTagState={setClientTagState}
          setClientPhoneCode={setClientPhoneCode}
          setClientPhoneFlag={setClientPhoneFlag}
          setClientAvatar={setClientAvatar}
        />
      );
    }

    if (["All Bookings", "Upcoming", "Canceled"].includes(activeTab)) {
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
                isNewClient={b.isNew}
                dateText={b.date}
                timeText={b.time}
                staffName={b.staff}
                servicePrice={(b.bookingId === "#BK-0036" || b.bookingId === "#BK-0035" || b.bookingId === "#BK-0034" || b.bookingId === "#BK-0033" || b.bookingId === "#BK-0032" || b.bookingId === "#BK-0031") ? "€20" : b.amount}
                depositedAmount={(b.bookingId === "#BK-0036" || b.bookingId === "#BK-0035" || b.bookingId === "#BK-0034") ? "€8" : "-"}
                remainingBalance={(b.bookingId === "#BK-0036" || b.bookingId === "#BK-0035" || b.bookingId === "#BK-0034" || b.bookingId === "#BK-0033" || b.bookingId === "#BK-0032" || b.bookingId === "#BK-0031") ? "€32" : (b.paymentType === "Pay at venue" ? b.amount : "€32")}
                showFooterActions={true}
                addressText={(b.bookingId === "#BK-0023") ? "Please use organic products only, allergic to strong fragrances" : undefined}
                clientNotesText={(b.bookingId === "#BK-0036" || b.bookingId === "#BK-0035" || b.bookingId === "#BK-0034" || b.bookingId === "#BK-0033" || b.bookingId === "#BK-0032" || b.bookingId === "#BK-0031") ? "Please use organic products only, allergic to strong fragrances" : undefined}
                isManual={b.bookingId === "#BK-0031"}
                businessNotesText={
                  b.status === "Completed"
                    ? `Yes - customer paid ${b.paymentType === "Pay at venue" ? b.amount.replace("€", "") : "32"}.00 at venue`
                    : b.status.toLowerCase().includes("by business")
                      ? "Service is not available"
                      : undefined
                }
                onCompleteBooking={() => {
                  setShowCompleteModalForBooking(true);
                }}
                onWaiveFeeClick={() => {
                  setShowWaiveFeeModal(true);
                }}
                onCancelNoShowClick={() => {
                  setShowNoShowModal(true);
                }}
                onReschedule={(newDate, newTime) => {
                  const updated = [...bookingsData];
                  updated[viewingBookingIndex] = {
                    ...updated[viewingBookingIndex],
                    date: newDate,
                    time: newTime
                  };
                  setBookingsData(updated);
                }}
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

    if (activeTab === "Business Profile") {
      if (isCreatingBusiness) {
        return (
          <DashboardCreateBusiness
            onBack={() => setIsCreatingBusiness(false)}
            mode={businessProfileMode}
            businessId={selectedBusinessId ?? undefined}
          />
        );
      }
      return (
        <DashboardBusinessProfile
          onEditBusiness={(businessId) => {
            setIsCreatingBusiness(true);
            setBusinessProfileMode("edit");
            setSelectedBusinessId(businessId);
          }}
          onViewBusiness={(businessId) => {
            setIsCreatingBusiness(true);
            setBusinessProfileMode("view");
            setSelectedBusinessId(businessId);
          }}
        />
      );
    }

    if (activeTab === "Services") {
      return <DashboardServicesList />;
    }

    if (activeTab === "Add-ons") {
      return <DashboardAddonsList />;
    }

    if (activeTab === "Staff") {
      return <DashboardStaffList />;
    }

    if (activeTab === "Reviews") {
      return <DashboardReviewsList />;
    }

    if (activeTab === "Payouts & Finance") {
      return <DashboardPayoutsList />;
    }

    if (activeTab === "Analytics") {
      return (
        <DashboardAnalytics 
          onBookingStatusClick={() => setActiveTab("All Bookings")} 
        />
      );
    }

    if (activeTab === "Settings") {
      return <DashboardSettings />;
    }

    if (activeTab === "Contact Support") {
      return <ContactSupport setActiveTab={setActiveTab} />;
    }

    // Default mock fallback container for other business profile tabs
    return (
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto bg-[#FCF8F8] p-8 items-center justify-center font-poppins select-none text-neutral-400">
        <span className="text-lg font-semibold">{activeTab} tab content coming soon</span>
      </main>
    );
  };

  return (
    <div className="flex bg-[#FCFAF9] h-screen overflow-hidden font-poppins text-[#111111]">
      <DashboardSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        activeTab={activeTab}
        setActiveTab={handleSetActiveTab}
        showFooterMenu={showFooterMenu}
        setShowFooterMenu={setShowFooterMenu}
        footerMenuRef={footerMenuRef}
      />
      {renderMainContent()}

      {/* Complete Booking Modal Overlay */}
      <CompleteModal
        isOpen={showCompleteModalForBooking}
        onClose={() => setShowCompleteModalForBooking(false)}
        onConfirm={() => {
          if (viewingBookingIndex !== null) {
            const updated = [...bookingsData];
            updated[viewingBookingIndex] = {
              ...updated[viewingBookingIndex],
              status: "Completed"
            };
            setBookingsData(updated);
          }
          setShowCompleteModalForBooking(false);
        }}
      />

      {/* Waive Fee Modal Overlay */}
      <WaiveChargeModal
        isOpen={showWaiveFeeModal}
        onClose={() => setShowWaiveFeeModal(false)}
        onConfirm={() => {
          if (viewingBookingIndex !== null) {
            const updated = [...bookingsData];
            updated[viewingBookingIndex] = {
              ...updated[viewingBookingIndex],
              status: "Canceled - Waived"
            };
            setBookingsData(updated);
          }
          setShowWaiveFeeModal(false);
        }}
      />

      {/* No-show Confirm Modal Overlay */}
      <NoShowModal
        isOpen={showNoShowModal}
        onClose={() => setShowNoShowModal(false)}
        onConfirm={() => {
          if (viewingBookingIndex !== null) {
            const updated = [...bookingsData];
            updated[viewingBookingIndex] = {
              ...updated[viewingBookingIndex],
              status: "No-show - cancelled"
            };
            setBookingsData(updated);
          }
          setShowNoShowModal(false);
        }}
      />
    </div>
  );
}

export default function BusinessDashboard() {
  return (
    <RequireBusinessOwner>
      <BusinessDashboardContent />
    </RequireBusinessOwner>
  );
}
