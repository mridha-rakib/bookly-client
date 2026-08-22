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
import { initialBookingsData } from "@/utils/dashboardMockData";
import RequireBusinessOwner from "@/components/auth/RequireBusinessOwner";
import { useManagedBusinessContext, useMyBusinessProfileQuery } from "@/lib/business/hooks";
import {
  useBookingDetailQuery,
  useCancelByBusinessMutation,
  useCancelNoShowMutation,
  useCompleteBookingMutation,
  useRescheduleByOwnerMutation,
  useWaiveFeeMutation,
} from "@/lib/bookings/hooks";

// Modular Dashboard sub-components
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";
import DashboardBookingsList from "@/components/dashboard/DashboardBookingsList";
import DashboardBookingForm from "@/components/dashboard/DashboardBookingForm";
import ClientsPage from "@/components/clients/ClientsPage";
import ClientBookingHistoryCard from "@/components/clients/ClientBookingHistoryCard";
import DashboardBusinessProfile from "@/components/dashboard/DashboardBusinessProfile";
import DashboardCreateBusiness from "@/components/dashboard/DashboardCreateBusiness";
import ServicesListPage from "@/components/dashboard/services/ServicesListPage";
import ArchivedServicesList from "@/components/dashboard/services/ArchivedServicesList";
import AddonsListPage from "@/components/dashboard/addons/AddonsListPage";
import ArchivedAddonsList from "@/components/dashboard/addons/ArchivedAddonsList";
import DashboardStaffList from "@/components/dashboard/DashboardStaffList";
import DashboardReviewsList from "@/components/dashboard/DashboardReviewsList";
import DashboardPayoutsList from "@/components/dashboard/DashboardPayoutsList";
import DashboardAnalytics from "@/components/dashboard/DashboardAnalytics";
import DashboardSettings from "@/components/dashboard/DashboardSettings";
import ContactSupport from "@/components/support/ContactSupport";
import { CancelBookingModal, CompleteModal, NoShowModal } from "@/components/dashboard/CalendarActionModals";
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

function BusinessDashboardContent() {
  const [activeTab, setActiveTab] = useState("Calendar");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFooterMenu, setShowFooterMenu] = useState(false);
  const footerMenuRef = useRef<HTMLDivElement>(null);

  // Legacy mock scratch state — kept ONLY because DashboardBookingForm (Manual Booking
  // creation, out of this batch's scope — see the final report) still requires this exact
  // shape as props. No longer the source of truth for List/Calendar/Detail, which now read
  // real data via useManagedBusinessContext()/lib/bookings/hooks.ts (Batch 6).
  const [bookingsData, setBookingsData] = useState<Booking[]>(initialBookingsData as Booking[]);

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

  // Viewing booking details states — real Booking id, never a mock array index (Batch 6).
  const [viewingBookingId, setViewingBookingId] = useState<string | null>(null);
  const [isViewingBookingDetails, setIsViewingBookingDetails] = useState(false);
  const [showCompleteModalForBooking, setShowCompleteModalForBooking] = useState(false);
  const [showWaiveFeeModal, setShowWaiveFeeModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [showCancelBookingModal, setShowCancelBookingModal] = useState(false);
  const [isCreatingBusiness, setIsCreatingBusiness] = useState(false);
  const [businessProfileMode, setBusinessProfileMode] = useState<"create" | "edit" | "view">("create");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);

  // Clients — real Client Management data/hooks live in ClientsPage; this page only resolves
  // the Owner's businessId (same idiom DashboardStaffList already uses).
  const businessProfileQuery = useMyBusinessProfileQuery();
  const clientsBusinessId = businessProfileQuery.data?.primary?.id;

  // Bookings — the SAME resolved businessId every Booking screen on this page uses (Batch 6).
  const { businessId: bookingsBusinessId } = useManagedBusinessContext();
  const bookingDetailQuery = useBookingDetailQuery(bookingsBusinessId, viewingBookingId ?? undefined);
  const completeBookingMutation = useCompleteBookingMutation();
  const cancelByBusinessMutation = useCancelByBusinessMutation();
  const rescheduleByOwnerMutation = useRescheduleByOwnerMutation();
  const waiveFeeMutation = useWaiveFeeMutation();
  const cancelNoShowMutation = useCancelNoShowMutation();

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
          businessId={bookingsBusinessId}
          onNewBookingClick={() => {
            setIsCreatingBooking(true);
            setActiveTab("All Bookings");
          }}
          onViewBookingClick={(bookingId) => {
            setViewingBookingId(bookingId);
            setIsViewingBookingDetails(true);
            setActiveTab("All Bookings");
          }}
        />
      );
    }

    if (activeTab === "Clients") {
      return <ClientsPage businessId={clientsBusinessId} />;
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

      if (isViewingBookingDetails && viewingBookingId !== null) {
        return (
          <main className="flex-1 min-w-0 flex flex-col h-full overflow-y-auto bg-[#FCF8F8] p-6 md:p-8 select-none">
            {/* Breadcrumbs */}
            <div
              onClick={() => {
                setIsViewingBookingDetails(false);
                setViewingBookingId(null);
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
              {bookingDetailQuery.isLoading ? (
                <span className="font-poppins text-sm text-neutral-400">Loading booking…</span>
              ) : bookingDetailQuery.isError || !bookingDetailQuery.data ? (
                <span className="font-poppins text-sm text-[#BA1A1A]">Couldn&apos;t load this booking.</span>
              ) : (
                <ClientBookingHistoryCard
                  booking={bookingDetailQuery.data}
                  businessId={bookingsBusinessId ?? ""}
                  showFooterActions={true}
                  onCompleteBooking={() => setShowCompleteModalForBooking(true)}
                  onWaiveFeeClick={() => setShowWaiveFeeModal(true)}
                  onCancelNoShowClick={() => setShowNoShowModal(true)}
                  onCancelBooking={() => setShowCancelBookingModal(true)}
                  isReschedulePending={rescheduleByOwnerMutation.isPending}
                  onReschedule={(startAtIso) => {
                    if (!bookingsBusinessId || !viewingBookingId) return;
                    rescheduleByOwnerMutation.mutate({
                      businessId: bookingsBusinessId,
                      bookingId: viewingBookingId,
                      startAt: startAtIso,
                    });
                  }}
                />
              )}
            </div>
          </main>
        );
      }

      return (
        <DashboardBookingsList
          activeTab={activeTab}
          businessId={bookingsBusinessId}
          onCreateManualBooking={() => setIsCreatingBooking(true)}
          onViewBookingDetails={(bookingId) => {
            setViewingBookingId(bookingId);
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
      return <ServicesListPage />;
    }

    if (activeTab === "Archived Services") {
      return <ArchivedServicesList />;
    }

    if (activeTab === "Add-ons") {
      return <AddonsListPage />;
    }

    if (activeTab === "Archived Add-ons") {
      return <ArchivedAddonsList />;
    }

    if (activeTab === "Staff") {
      return <DashboardStaffList />;
    }

    if (activeTab === "Reviews") {
      return <DashboardReviewsList />;
    }

    if (activeTab === "Payouts & Finance") {
      return <DashboardPayoutsList businessId={bookingsBusinessId} />;
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
        defaultBalanceDueCents={bookingDetailQuery.data?.financials.balanceDueCents}
        onConfirm={(venuePayment) => {
          if (bookingsBusinessId && viewingBookingId) {
            completeBookingMutation.mutate({ businessId: bookingsBusinessId, bookingId: viewingBookingId, venuePayment });
          }
          setShowCompleteModalForBooking(false);
        }}
      />

      {/* Waive Fee Modal Overlay */}
      <WaiveChargeModal
        isOpen={showWaiveFeeModal}
        onClose={() => setShowWaiveFeeModal(false)}
        onConfirm={(reason, internalNote) => {
          if (bookingsBusinessId && viewingBookingId) {
            waiveFeeMutation.mutate({ businessId: bookingsBusinessId, bookingId: viewingBookingId, reason, internalNote });
          }
          setShowWaiveFeeModal(false);
        }}
      />

      {/* Cancel No-show Confirm Modal Overlay */}
      <NoShowModal
        isOpen={showNoShowModal}
        onClose={() => setShowNoShowModal(false)}
        onConfirm={() => {
          if (bookingsBusinessId && viewingBookingId) {
            cancelNoShowMutation.mutate({ businessId: bookingsBusinessId, bookingId: viewingBookingId });
          }
          setShowNoShowModal(false);
        }}
      />

      {/* Cancel Booking Modal Overlay */}
      <CancelBookingModal
        isOpen={showCancelBookingModal}
        onClose={() => setShowCancelBookingModal(false)}
        onConfirm={(reason) => {
          if (bookingsBusinessId && viewingBookingId) {
            cancelByBusinessMutation.mutate({ businessId: bookingsBusinessId, bookingId: viewingBookingId, reason });
          }
          setShowCancelBookingModal(false);
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
