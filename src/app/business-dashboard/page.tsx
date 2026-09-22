"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
import RequireBusinessOwner from "@/components/auth/RequireBusinessOwner";
import BusinessDashboardApprovalGate from "@/components/dashboard/BusinessDashboardApprovalGate";
import { Spinner } from "@/components/ui/spinner";
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
import {
  DEFAULT_DASHBOARD_SECTION,
  dashboardSectionToSlug,
  slugToDashboardSection,
} from "@/lib/dashboard/sections";

// Business Profile's nested edit/view screen — like the top-level `section` above, this is
// URL-backed (?view=edit|view&businessId=<id>) rather than local state, so it survives a
// refresh. "create" is deliberately not a valid URL value here — this dashboard page never
// enters DashboardCreateBusiness's create mode (see BusinessDashboardContent's own report).
type BusinessProfileView = "edit" | "view";

const parseBusinessProfileView = (value: string | null): BusinessProfileView | null =>
  value === "edit" || value === "view" ? value : null;

function BusinessDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the source of truth for the active dashboard section (?section=<slug>), so it
  // survives a refresh. An absent param means the default section; an unrecognized one is
  // normalized back to the default below rather than rendering blank content.
  const sectionParam = searchParams.get("section");
  const activeTab = slugToDashboardSection(sectionParam) ?? DEFAULT_DASHBOARD_SECTION;

  const setActiveTab = useCallback(
    (tab: string) => {
      const nextSlug = dashboardSectionToSlug(tab);
      const isAlreadyActive = sectionParam
        ? sectionParam === nextSlug
        : tab === DEFAULT_DASHBOARD_SECTION;
      // Business Profile's nested `view`/`businessId` are meaningless once we leave (or
      // re-enter via the sidebar rather than Back/Forward) — a tab switch always drops them,
      // even when the target tab is already active (switching Business Profile's edit form
      // back to its list via the sidebar), so the guard below can't skip that case.
      const hasNestedBusinessProfileParams = searchParams.has("view") || searchParams.has("businessId");
      if (isAlreadyActive && !hasNestedBusinessProfileParams) return;

      const params = new URLSearchParams(searchParams.toString());
      params.set("section", nextSlug);
      params.delete("view");
      params.delete("businessId");
      router.push(`${pathname}?${params.toString()}`);
    },
    [sectionParam, router, pathname, searchParams]
  );

  useEffect(() => {
    if (sectionParam && !slugToDashboardSection(sectionParam)) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("section");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
  }, [sectionParam, searchParams, router, pathname]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showFooterMenu, setShowFooterMenu] = useState(false);
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

  // Returning here from the Google Calendar OAuth redirect (see integration.controller.ts's
  // frontendSettingsUrl) — land back on Settings so DashboardSettings itself can read the rest
  // of the query string (settingsTab/googleCalendar) and show the right Integration sub-tab.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("settingsTab") === "Integration") {
      setActiveTab("Settings");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount to consume the OAuth redirect's query string only
  }, []);

  // Clients — real Client Management data/hooks live in ClientsPage; this page only resolves
  // the Owner's businessId (same idiom DashboardStaffList already uses).
  const businessProfileQuery = useMyBusinessProfileQuery();
  const clientsBusinessId = businessProfileQuery.data?.primary?.id;

  // Business Profile nested edit/view — URL-derived (see BusinessProfileView above), the same
  // idiom as `activeTab`/`sectionParam`. `businessProfileQuery` (already fetched above for
  // Clients) is the same primary/secondary list DashboardBusinessProfile itself renders, so a
  // `businessId` is only ever trusted once it's confirmed to match a card the current Owner can
  // actually access — never rendered from an unverified URL value. Editing is primary-only and
  // viewing is secondary-only, mirroring DashboardBusinessProfile's own Edit/View button split
  // (only the primary card gets an Edit button; only secondary cards get a View button) — this
  // does not grant any access the existing cards don't already offer.
  const viewParam = parseBusinessProfileView(searchParams.get("view"));
  const businessIdParam = searchParams.get("businessId");
  const businessProfilePrimary = businessProfileQuery.data?.primary ?? null;
  const businessProfileSecondary = businessProfileQuery.data?.secondary ?? [];
  const isValidBusinessProfileNestedView =
    viewParam !== null &&
    businessIdParam !== null &&
    ((viewParam === "edit" && businessIdParam === businessProfilePrimary?.id) ||
      (viewParam === "view" &&
        businessProfileSecondary.some((business) => business.id === businessIdParam)));

  const navigateToBusinessProfileView = useCallback(
    (next: { view: BusinessProfileView; businessId: string } | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("section", dashboardSectionToSlug("Business Profile"));
      if (next) {
        params.set("view", next.view);
        params.set("businessId", next.businessId);
      } else {
        params.delete("view");
        params.delete("businessId");
      }
      const nextQuery = params.toString();
      if (nextQuery === searchParams.toString()) return; // already exactly this URL
      router.push(`${pathname}?${nextQuery}`);
    },
    [searchParams, pathname, router]
  );

  // Mirrors the section-normalization effect above: an invalid nested Business Profile deep
  // link (wrong section, unknown/inaccessible businessId, a view/businessId mismatch, or a
  // stray param with no counterpart) is corrected via replace rather than left to render
  // something wrong or blank. Crucially, this must NOT fire while `businessProfileQuery` is
  // still loading — that would erase a perfectly valid deep link before it can be checked — and
  // must NOT fire on a query error either, since an error is likely transient/retryable and the
  // render below already falls back to the list view on its own without touching the URL.
  useEffect(() => {
    const hasNestedParams = searchParams.has("view") || searchParams.has("businessId");
    if (!hasNestedParams) return;

    if (activeTab !== "Business Profile") {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("view");
      params.delete("businessId");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
      return;
    }

    if (businessProfileQuery.isLoading || businessProfileQuery.isError) return;

    if (!isValidBusinessProfileNestedView) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("view");
      params.delete("businessId");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }
  }, [
    activeTab,
    searchParams,
    pathname,
    router,
    businessProfileQuery.isLoading,
    businessProfileQuery.isError,
    isValidBusinessProfileNestedView,
  ]);

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
            businessId={bookingsBusinessId ?? ""}
            visitType={businessProfileQuery.data?.primary?.visitType}
            onClose={() => setIsCreatingBooking(false)}
            onCreated={(bookingId) => {
              setIsCreatingBooking(false);
              setViewingBookingId(bookingId);
              setIsViewingBookingDetails(true);
            }}
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
      const hasNestedBusinessProfileParams = viewParam !== null || businessIdParam !== null;

      if (hasNestedBusinessProfileParams) {
        // Still resolving whether this deep link is valid — don't flash the list view (that's
        // the exact bug this fix corrects) and don't render the edit/view form with an
        // unverified businessId either; wait for the same query DashboardBusinessProfile itself
        // depends on.
        if (businessProfileQuery.isLoading) {
          return (
            <main className="flex-1 min-w-0 flex flex-col h-full items-center justify-center bg-[#FCF8F8]">
              <Spinner className="text-[#111111] size-6" />
            </main>
          );
        }

        if (businessProfileQuery.isSuccess && isValidBusinessProfileNestedView && businessIdParam) {
          return (
            <DashboardCreateBusiness
              onBack={() => navigateToBusinessProfileView(null)}
              mode={viewParam === "edit" ? "edit" : "view"}
              businessId={businessIdParam}
            />
          );
        }
        // Invalid combination (or a query error) falls through to the list view below — the
        // normalization effect above takes care of cleaning up the URL when it's genuinely
        // invalid (never on a plain query error, which may just be transient).
      }

      return (
        <DashboardBusinessProfile
          onEditBusiness={(businessId) => navigateToBusinessProfileView({ view: "edit", businessId })}
          onViewBusiness={(businessId) => navigateToBusinessProfileView({ view: "view", businessId })}
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
      <BusinessDashboardApprovalGate>
        <Suspense fallback={null}>
          <BusinessDashboardContent />
        </Suspense>
      </BusinessDashboardApprovalGate>
    </RequireBusinessOwner>
  );
}
