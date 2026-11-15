"use client";

import React, { useState, useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";

// Reused components
import { CancelBookingModal, NoShowModal } from "@/components/dashboard/CalendarActionModals";
import CalendarBookingCompletion from "@/components/dashboard/CalendarBookingCompletion";
import WaiveChargeModal from "@/components/dashboard/WaiveChargeModal";
import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import ClientBookingHistoryCard from "@/components/clients/ClientBookingHistoryCard";
import BookingDetailReadError from "@/components/dashboard/BookingDetailReadError";
import { useCurrentUserQuery } from "@/lib/auth/hooks";
import { useManagedBusinessContext } from "@/lib/business/hooks";
import {
  useBookingDetailQuery,
  useCancelByBusinessMutation,
  useCancelNoShowMutation,
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
import SupervisorStaffSchedule from "@/components/dashboard/SupervisorStaffSchedule";

export default function SupervisorDashboard() {
  const [activeTab, setActiveTab] = useState("Calendar");
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showFooterMenu, setShowFooterMenu] = useState(false);
  const footerMenuRef = useRef<HTMLDivElement>(null);
  const lifecycleActionInFlight = useRef(false);

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
      return <SupervisorOverview onNavigate={setActiveTab} />;
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
      if (currentUserQuery.isLoading) return <main className="flex-1 p-6" role="status">Loading business details…</main>;
      if (currentUserQuery.isError) return <main className="flex-1 p-6" role="alert">Business details could not be loaded. <button type="button" onClick={() => void currentUserQuery.refetch()} disabled={currentUserQuery.isFetching}>Retry business details</button></main>;
      if (!clientsBusinessId) return <main className="flex-1 p-6" role="status">No active business membership is available.</main>;
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
                <BookingDetailReadError pending={bookingDetailQuery.isFetching} retry={() => void bookingDetailQuery.refetch()} />
              ) : (
                <ClientBookingHistoryCard
                  booking={bookingDetailQuery.data}
                  businessId={bookingsBusinessId ?? ""}
                  showFooterActions={true}
                  showOperationalContext={true}
                  hidePackageFinancials={true}
                  onViewRelatedBooking={(bookingId) => {
                    setViewingBookingId(bookingId);
                    setIsViewingBookingDetails(true);
                  }}
                  onCompleteBooking={() => setShowCompleteModalForBooking(true)}
                  onWaiveFeeClick={() => setShowWaiveFeeModal(true)}
                  onCancelNoShowClick={() => setShowNoShowModal(true)}
                  onCancelBooking={() => setShowCancelBookingModal(true)}
                  isReschedulePending={rescheduleByOwnerMutation.isPending}
                  onReschedule={(startAtIso) => {
                    if (!bookingsBusinessId || !viewingBookingId) return;
                    return rescheduleByOwnerMutation.mutateAsync({
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
      // Phase 4A — Supervisor now gets read access to the team list plus schedule management
      // (staff.route.ts's requireOwnedOrSupervisedStaffBusiness). Core staff-identity actions
      // (add/edit/remove/invite) remain BUSINESS_OWNER-only and are not exposed by this screen.
      return <SupervisorStaffSchedule />;
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

    return <SupervisorOverview onNavigate={setActiveTab} />;
  };

  return (
    <div className="w-screen h-screen flex overflow-hidden bg-[#FCF8F8]">
      {/* Sidebar Navigation */}
      <SupervisorSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        activeTab={activeTab}
        setActiveTab={(tab) => { setIsCreatingBooking(false); setIsViewingBookingDetails(false); setViewingBookingId(null); setActiveTab(tab); }}
        showFooterMenu={showFooterMenu}
        setShowFooterMenu={setShowFooterMenu}
        footerMenuRef={footerMenuRef}
      />

      {/* Main Layout Area */}
      {renderMainContent()}

      {/* Floating Action Modals */}
      {showCompleteModalForBooking && bookingsBusinessId && viewingBookingId && <CalendarBookingCompletion
        key={`${bookingsBusinessId}:${viewingBookingId}`} businessId={bookingsBusinessId}
        bookingId={viewingBookingId} onClose={() => setShowCompleteModalForBooking(false)} />}

      {/* Cancel No-show */}
      <NoShowModal
        isOpen={showNoShowModal}
        isPending={cancelNoShowMutation.isPending}
        mode="cancel"
        onClose={() => setShowNoShowModal(false)}
        onConfirm={() => {
          if (!bookingsBusinessId || !viewingBookingId || lifecycleActionInFlight.current) return;
          lifecycleActionInFlight.current = true;
          cancelNoShowMutation.mutate({ businessId: bookingsBusinessId, bookingId: viewingBookingId }, {
            onSuccess: () => { setShowNoShowModal(false); toast.success("No-show cancelled."); },
            onError: (error) => { setShowNoShowModal(false); void bookingDetailQuery.refetch(); toast.error(`${toUserMessage(error)} Check the refreshed booking before retrying.`); },
            onSettled: () => { lifecycleActionInFlight.current = false; },
          });
        }}
      />

      <WaiveChargeModal
        isOpen={showWaiveFeeModal}
        isPending={waiveFeeMutation.isPending}
        onClose={() => setShowWaiveFeeModal(false)}
        onConfirm={(reason, internalNote) => {
          if (!bookingsBusinessId || !viewingBookingId || lifecycleActionInFlight.current) return;
          lifecycleActionInFlight.current = true;
          waiveFeeMutation.mutate({ businessId: bookingsBusinessId, bookingId: viewingBookingId, reason, internalNote }, {
            onSuccess: () => { setShowWaiveFeeModal(false); toast.success("No-show charge waived."); },
            onError: (error) => { setShowWaiveFeeModal(false); void bookingDetailQuery.refetch(); toast.error(`${toUserMessage(error)} Check the refreshed booking before retrying.`); },
            onSettled: () => { lifecycleActionInFlight.current = false; },
          });
        }}
      />

      <CancelBookingModal
        isOpen={showCancelBookingModal}
        isPending={cancelByBusinessMutation.isPending}
        onClose={() => setShowCancelBookingModal(false)}
        packageSessionLabel={(() => {
          const line = bookingDetailQuery.data?.serviceLines.find(
            (candidate) => candidate.packageProgressId,
          );
          return line?.sessionIndex && line.sessionsInPackage
            ? `Session ${line.sessionIndex} of ${line.sessionsInPackage}`
            : line
              ? "Package session"
              : undefined;
        })()}
        onConfirm={(reason) => {
          if (!bookingsBusinessId || !viewingBookingId || lifecycleActionInFlight.current) return;
          lifecycleActionInFlight.current = true;
          cancelByBusinessMutation.mutate({ businessId: bookingsBusinessId, bookingId: viewingBookingId, reason }, {
            onSuccess: () => { setShowCancelBookingModal(false); toast.success("Booking cancelled."); },
            onError: (error) => { setShowCancelBookingModal(false); void bookingDetailQuery.refetch(); toast.error(`${toUserMessage(error)} Check the refreshed booking before retrying.`); },
            onSettled: () => { lifecycleActionInFlight.current = false; },
          });
        }}
      />
    </div>
  );
}
