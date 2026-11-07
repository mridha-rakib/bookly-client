"use client";
import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon, ScissorIcon, User02Icon, Calendar03Icon, Location01Icon, MapsIcon, Appointment02Icon, Clock04Icon } from "@hugeicons/core-free-icons";
import type { BookingDetail } from "@/lib/api/bookings";
import { presentOnlineSnapshot, presentVenuePayment } from "@/lib/bookings/customer-financial";
import { formatBookingDate, formatBookingMoney, formatBookingTimeRange } from "@/lib/bookings/format";
import { BookingStatusBadge, BookingVisitBadge } from "@/components/bookings/BookingBadges";
import CustomerFinancialRows from "@/components/bookings/CustomerFinancialRows";

export interface ConfirmationPackage {
  id: string; name: string; bundlePriceCents: number; totalSessions: number;
  kind: "PURCHASE" | "REDEMPTION"; classification?: "FIRST" | "RETURNING";
}
interface ConfirmedStepProps {
  booking: BookingDetail; additionalBookings?: BookingDetail[];
  setBookingStep?: (step: null) => void; isPackagePurchase?: boolean;
  packageSessionsTotal?: number; businessName?: string; purchasedPackage?: ConfirmationPackage;
}
const actionClass = "min-h-[54px] flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#C6C6CB] bg-white px-5 py-3 text-base font-semibold text-[#020305] hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7]";

/** The existing Venue success presentation, shared by normal, legacy and verified First-Class
 * outcomes. Navigation occurs exclusively in Customer click handlers. */
export default function ConfirmedStep({ booking, additionalBookings = [], setBookingStep, isPackagePurchase, packageSessionsTotal, businessName, purchasedPackage }: ConfirmedStepProps) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const bookings = [booking, ...additionalBookings];
  function navigate(url: string) { setBookingStep?.(null); router.push(url); }
  const legacyProgress = booking.serviceLines.find((line) => line.packageProgressId)?.packageProgressId;
  return <section aria-label="Booking confirmation" className="min-w-0 w-full max-w-[760px] mx-auto flex flex-col items-center gap-8 py-8 sm:py-12 font-manrope break-words">
    <div className="flex flex-col items-center gap-3 text-center w-full" role="status">
      <div className="w-[76px] h-[76px] flex items-center justify-center rounded-full border-2 border-[#3586B8] shrink-0" style={{ background: "linear-gradient(0deg, rgba(12, 192, 223, 0.2), rgba(12, 192, 223, 0.2)), #2E9DA7" }}><HugeiconsIcon icon={Tick01Icon} size={48} className="text-[#1A5A60] shrink-0" /></div>
      <h1 ref={heading} tabIndex={-1} className="pt-3 font-extrabold text-3xl sm:text-[36px] leading-tight text-[#020305] tracking-[-0.9px] focus:outline-none">Booking Confirmed!</h1>
      <p className="text-lg leading-7 text-[#45474B]">{bookings.some((appointment) => appointment.status !== "UPCOMING") ? "Your confirmed booking records are shown below with their current status." : bookings.length > 1 ? `Your ${bookings.length} initial appointments have been successfully scheduled.` : "Your appointment has been successfully scheduled."}</p>
      <p className="text-base font-semibold text-[#020305]">{businessName ?? "Business name unavailable"}</p>
    </div>
    {purchasedPackage && <section aria-label="Verified Package summary" className="w-full space-y-3 rounded-2xl border border-[#C6C6CB] bg-[#F5F4EE] p-5 sm:p-7">
      <h2 className="text-xl font-bold">{purchasedPackage.name}</h2>
      <p>{purchasedPackage.kind === "PURCHASE" ? "Package purchase verified" : "Remaining session booked"} · {purchasedPackage.totalSessions} included sessions{purchasedPackage.classification ? ` · ${purchasedPackage.classification}` : ""}</p>
      {purchasedPackage.kind === "PURCHASE" ? <><p>Purchased bundle: {formatBookingMoney(purchasedPackage.bundlePriceCents)}. {bookings.length} initial appointments scheduled.</p><p>Purchase total including initial appointment extras: {formatBookingMoney(bookings.reduce((sum, appointment) => sum + appointment.financials.totalCents, 0))}</p><p className="text-sm">Appointment amounts below are the recorded allocations, not additional bundle charges. Remaining credits are in My Packages.</p></> : <p className="text-sm">Included service base: {formatBookingMoney(0)}. The bundle is not charged again; only this session’s independent add-ons and travel are shown below.</p>}
      <button type="button" className="min-h-11 text-[#2E9DA7] font-semibold underline" onClick={() => navigate(`/customer/packages/${encodeURIComponent(purchasedPackage.id)}?kind=first-class`)}>View Package</button>
    </section>}
    {bookings.map((appointment, index) => <ConfirmationAppointment key={appointment.id} booking={appointment} index={bookings.length > 1 ? index + 1 : undefined} firstClass={Boolean(purchasedPackage)} onView={() => navigate(`/customer/bookings/view?id=${encodeURIComponent(appointment.id)}`)} />)}
    {isPackagePurchase && !purchasedPackage && <div className="w-full space-y-2 rounded-xl bg-[#F1EDED]/60 p-4 text-sm">
      <p>{booking.serviceLines[0]?.sessionsInPackage ?? packageSessionsTotal ? `Includes ${booking.serviceLines[0]?.sessionsInPackage ?? packageSessionsTotal} sessions — this booking schedules your first session.` : "This booking schedules your first session."}</p>
      <p>Book your remaining sessions any time from My Packages.</p>
      <button type="button" className="min-h-11 text-[#2E9DA7] font-semibold underline" onClick={() => navigate(legacyProgress ? `/customer/packages/${encodeURIComponent(legacyProgress)}` : "/customer/packages")}>{legacyProgress ? "View package →" : "View My Packages →"}</button>
    </div>}
    <nav aria-label="Confirmation navigation" className="flex w-full flex-col sm:flex-row gap-3">
      <button type="button" className={actionClass} onClick={() => navigate("/customer/bookings")}><HugeiconsIcon icon={Appointment02Icon} size={18} />My Booking</button>
      {purchasedPackage && <button type="button" className={actionClass} onClick={() => navigate("/customer/packages")}>My Packages</button>}
    </nav>
    {setBookingStep && <button type="button" className="min-h-11 text-[#4E5F78] hover:underline" onClick={() => setBookingStep(null)}>← Back to Explore</button>}
  </section>;
}
function Info({ icon, label, children }: { icon: typeof ScissorIcon; label: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 items-start gap-3"><div className="w-8 h-8 bg-[#F1EDED] rounded-lg flex items-center justify-center shrink-0"><HugeiconsIcon icon={icon} size={16} className="text-[#4E5F78]" /></div><div className="min-w-0 space-y-1"><p className="text-sm text-[#45474B]">{label}</p><div className="font-semibold text-base text-[#020305] leading-6">{children}</div></div></div>;
}
function ConfirmationAppointment({ booking, index, firstClass, onView }: { booking: BookingDetail; index?: number; firstClass: boolean; onView: () => void }) {
  const mode = booking.fulfilment.mode, travel = mode === "TRAVEL_TO_CUSTOMER";
  const location = travel ? booking.fulfilment.travelAddress : mode === "AT_BUSINESS_LOCATION" ? booking.fulfilment.businessLocation : undefined;
  const completeAddress = location && [location.streetName, location.streetNumber, location.area, location.city].every((value) => typeof value === "string" && value.trim());
  const online = firstClass ? { label: "Recorded online amount", amountCents: booking.paymentSummary?.actualOnlinePaidCents } : presentOnlineSnapshot(booking);
  return <article aria-label={`Confirmed appointment${index ? ` ${index}` : ""}`} className="min-w-0 w-full bg-white border border-[#C6C6CB] rounded-2xl shadow-[0px_2px_4px_rgba(0,0,0,0.05)]">
    <header className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6 border-b border-[#F0F0EE]"><h2 className="font-semibold text-sm text-[#2E9DA7] tracking-wider">{index ? `Appointment ${index} · ` : ""}Booking Ref: {booking.reference}</h2><BookingStatusBadge status={booking.status} /></header>
    <div className="p-5 sm:p-8 space-y-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div className="space-y-5">{booking.serviceLines.map((line, lineIndex) => <div key={`${line.serviceId}:${lineIndex}`} className="space-y-4">
        <Info icon={ScissorIcon} label="Service">{line.name}{line.packageName && <p className="text-sm text-[#3760B7]">{line.packageName}</p>}</Info>
        <Info icon={Clock04Icon} label="Duration">{line.hours !== undefined ? `${line.hours} hours` : `${line.durationMin} min`}{line.personCount !== undefined && <p className="text-sm">{line.personCount} participants</p>}</Info>
        <Info icon={User02Icon} label="Professional">{line.staffName ?? "Assigned professional information unavailable"}</Info>
        {line.addons.length > 0 && <Info icon={ScissorIcon} label="Add-ons"><ul>{line.addons.map((addon) => <li key={addon.addonId}>{addon.name} · {formatBookingMoney(addon.priceCents)}</li>)}</ul></Info>}
      </div>)}</div>
      <div className="space-y-5"><Info icon={Calendar03Icon} label="Date & Time"><p>{formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}</p><p>{formatBookingTimeRange(booking.schedule)}</p><p className="text-sm text-[#45474B]">{booking.schedule.timezone}</p></Info>
        <Info icon={Location01Icon} label={travel ? "Professional visits your location" : mode === "AT_BUSINESS_LOCATION" ? "Visit the business" : "Appointment location"}>
          {(travel || mode === "AT_BUSINESS_LOCATION") && <><BookingVisitBadge mode={mode} /><p className="text-sm font-normal text-[#45474B]">{travel ? "Your appointment will take place at your selected address." : "Your appointment will take place at the business location."}</p></>}
          {completeAddress && location ? <><p>{location.streetName} {location.streetNumber}</p><p>{location.area}, {location.city}</p>{location.floorUnit && <p className="text-sm">Floor / unit: {location.floorUnit}</p>}{location.aptRoom && <p className="text-sm">Apartment / room: {location.aptRoom}</p>}{travel && booking.fulfilment.travelAddress?.propertyType && <p className="text-sm">Property type: {booking.fulfilment.travelAddress.propertyType}</p>}{travel && booking.fulfilment.travelAddress?.additionalDirections && <p className="text-sm">{booking.fulfilment.travelAddress.additionalDirections}</p>}</> : <p className="text-sm">Booked address unavailable. Contact the business to confirm the appointment location.</p>}
        </Info>
      </div></div>
      <section aria-label="Appointment payment summary" className="space-y-3 border-t border-[#C6C6CB]/50 pt-5"><CustomerFinancialRows rows={[
        { label: firstClass && booking.serviceLines.some((line) => line.packageRole === "REDEMPTION") ? "Included service base" : "Service allocation", amountCents: booking.financials.servicesSubtotalCents },
        { label: "Add-ons", amountCents: booking.financials.addonsSubtotalCents }, { label: "Travel fee", amountCents: booking.financials.travelFeeCents }, online, ...presentVenuePayment(booking), { label: firstClass ? "Recorded appointment total" : "Total", amountCents: booking.financials.totalCents },
      ]} />{firstClass && <p className="text-xs text-[#45474B]">Online amount and venue settlement are separate recorded facts. Confirmation does not attest cash receipt or a current net provider balance.</p>}</section>
      <button type="button" className={`${actionClass} w-full`} onClick={onView}><HugeiconsIcon icon={MapsIcon} size={18} />View Booking</button>
    </div>
  </article>;
}
