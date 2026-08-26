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
import { CancelBookingModal, CompleteModal, NoShowModal } from "@/components/dashboard/CalendarActionModals";
import WaiveChargeModal from "@/components/dashboard/WaiveChargeModal";
import ClientBookingHistoryCard from "@/components/clients/ClientBookingHistoryCard";
import { useCurrentUserQuery } from "@/lib/auth/hooks";
import { useManagedBusinessContext } from "@/lib/business/hooks";
import {
  useBookingDetailQuery,
  useCancelByBusinessMutation,
  useCancelNoShowMutation,
  useCompleteBookingMutation,
  useRescheduleByOwnerMutation,
  useWaiveFeeMutation,
} from "@/lib/bookings/hooks";

// Supervisor Customized Sub-components
import SupervisorSidebar from "./SupervisorSidebar";
import SupervisorOverview from "./SupervisorOverview";
import SupervisorSettings from "./SupervisorSettings";

// Modular Dashboard sub-components
import DashboardCalendar from "@/components/dashboard/DashboardCalendar";
import DashboardBookingsList from "@/components/dashboard/DashboardBookingsList";
import DashboardBookingForm from "@/components/dashboard/DashboardBookingForm";
import ClientsPage from "@/components/clients/ClientsPage";
import ContactSupport from "@/components/support/ContactSupport";
import DashboardReviewsList from "@/components/dashboard/DashboardReviewsList";
import NotAvailableForRole from "@/components/dashboard/NotAvailableForRole";

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState("Calendar");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFooterMenu, setShowFooterMenu] = useState(true);
  const footerMenuRef = useRef<HTMLDivElement>(null);

  // Manual Booking creation state (Batch 10) — real, backend-driven, no mock scratch state.
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  // Viewing booking details states — real Booking id, never a mock array index (Batch 6).
  const [viewingBookingId, setViewingBookingId] = useState<string | null>(null);
  const [isViewingBookingDetails, setIsViewingBookingDetails] = useState(false);
  const [showCompleteModalForBooking, setShowCompleteModalForBooking] = useState(false);
  const [showWaiveFeeModal, setShowWaiveFeeModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [showCancelBookingModal, setShowCancelBookingModal] = useState(false);

  // Clients — real Client Management data/hooks live in ClientsPage; this page only resolves
  // the Supervisor's businessId via their active Staff membership (see /auth/me).
  const currentUserQuery = useCurrentUserQuery();
  const clientsBusinessId = currentUserQuery.data?.business?.id;

  // Bookings — the SAME resolved businessId every Booking screen on this page uses (Batch 6).
  const { businessId: bookingsBusinessId } = useManagedBusinessContext();
  const bookingDetailQuery = useBookingDetailQuery(bookingsBusinessId, viewingBookingId ?? undefined);
  const completeBookingMutation = useCompleteBookingMutation();
  const cancelByBusinessMutation = useCancelByBusinessMutation();
  const rescheduleByOwnerMutation = useRescheduleByOwnerMutation();
  const waiveFeeMutation = useWaiveFeeMutation();
  const cancelNoShowMutation = useCancelNoShowMutation();

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
    if (isCreatingBooking) {
      return (
        <DashboardBookingForm
          businessId={bookingsBusinessId ?? ""}
          visitType={currentUserQuery.data?.business?.visitType}
          onClose={() => setIsCreatingBooking(false)}
          onCreated={(bookingId) => {
            setIsCreatingBooking(false);
            setViewingBookingId(bookingId);
            setIsViewingBookingDetails(true);
          }}
        />
      );
    }

    if (activeTab === "Dashboard") {
      return <SupervisorOverview />;
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

    if (activeTab === "All Bookings" || activeTab === "Upcoming" || activeTab === "Canceled") {
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

    if (activeTab === "Staff") {
      // No product rule grants SUPERVISOR team-management access (staff.route.ts is BUSINESS_OWNER-
      // only — see its own doc comment on this being a deliberate later-phase permission, not yet
      // granted) — honest-unavailable rather than a mock add/edit/delete-teammate UI.
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
        defaultBalanceDueCents={bookingDetailQuery.data?.financials.balanceDueCents}
        onConfirm={(venuePayment) => {
          if (bookingsBusinessId && viewingBookingId) {
            completeBookingMutation.mutate({ businessId: bookingsBusinessId, bookingId: viewingBookingId, venuePayment });
          }
          setShowCompleteModalForBooking(false);
        }}
      />

      {/* Cancel No-show */}
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
