"use client";
import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon, ScissorIcon, User02Icon, Calendar03Icon, Location01Icon, Appointment02Icon, Clock04Icon } from "@hugeicons/core-free-icons";
import type { BookingDetail } from "@/lib/api/bookings";
import { presentOnlineSnapshot, presentVenuePayment } from "@/lib/bookings/customer-financial";
import { formatBookingDate, formatBookingMoney, formatBookingTimeRange } from "@/lib/bookings/format";
import { BookingStatusBadge, BookingVisitBadge } from "@/components/bookings/BookingBadges";
import CustomerFinancialRows from "@/components/bookings/CustomerFinancialRows";
import styles from "./ConfirmedStep.module.css";

export interface ConfirmationPackage {
  id: string; name: string; bundlePriceCents: number; totalSessions: number;
  kind: "PURCHASE" | "REDEMPTION"; classification?: "FIRST" | "RETURNING";
}
interface ConfirmedStepProps {
  booking: BookingDetail; additionalBookings?: BookingDetail[];
  setBookingStep?: (step: null) => void; isPackagePurchase?: boolean;
  packageSessionsTotal?: number; businessName?: string; purchasedPackage?: ConfirmationPackage;
}
const actionClass = `${styles.action} min-h-11 flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[#C6C6CB] bg-white px-5 py-2.5 text-sm font-semibold text-[#020305] hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E9DA7]`;

/** The existing Venue success presentation, shared by normal, legacy and verified First-Class
 * outcomes. Navigation occurs exclusively in Customer click handlers. */
export default function ConfirmedStep({ booking, additionalBookings = [], setBookingStep, isPackagePurchase, packageSessionsTotal, businessName, purchasedPackage }: ConfirmedStepProps) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const bookings = [booking, ...additionalBookings];
  function navigate(url: string) { setBookingStep?.(null); router.push(url); }
  const legacyProgress = booking.serviceLines.find((line) => line.packageProgressId)?.packageProgressId;
  return <section aria-label="Booking confirmation" className={`${styles.confirmation} min-w-0 w-full mx-auto flex flex-col items-center font-manrope break-words`}>
    <div className={styles.hero} role="status">
      <svg aria-hidden="true" className={styles.heroWave} viewBox="0 0 760 120" preserveAspectRatio="none"><path d="M0 20C120 0 155 110 380 75S620 0 760 20V120H0Z" fill="currentColor" /></svg>
      <div aria-hidden="true" className={styles.success}><HugeiconsIcon icon={Tick01Icon} size={34} /></div>
      <h1 ref={heading} tabIndex={-1} className="font-extrabold text-3xl sm:text-[34px] leading-tight text-[#020305] tracking-[-0.9px] focus:outline-none">Booking Confirmed!</h1>
      <p className="text-sm sm:text-base leading-6 text-[#45474B]">{bookings.some((appointment) => appointment.status !== "UPCOMING") ? "Your confirmed booking records are shown below with their current status." : bookings.length > 1 ? `Your ${bookings.length} initial appointments have been successfully scheduled.` : "Your appointment has been successfully scheduled."}</p>
      <p className="text-sm font-semibold text-[#020305]">{businessName ?? "Business name unavailable"}</p>
    </div>
    {purchasedPackage && <section aria-label="Verified Package summary" className={styles.packageCard}>
      <div aria-hidden="true" className={styles.packageIcon}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z" /><path d="m3 8 9 5 9-5M12 13v9M7.5 5.5l9 5v5" /></svg></div>
      <div className={styles.packageDetails}>
      <h2 className="text-xl font-bold">{purchasedPackage.name}</h2>
      <p>{purchasedPackage.kind === "PURCHASE" ? "Package purchase verified" : "Remaining session booked"} · {purchasedPackage.totalSessions} included sessions{purchasedPackage.classification ? ` · ${purchasedPackage.classification}` : ""}</p>
      {purchasedPackage.kind === "PURCHASE" ? <><p>Purchased bundle: {formatBookingMoney(purchasedPackage.bundlePriceCents)}. {bookings.length} initial appointments scheduled.</p><p>Purchase total including initial appointment extras: {formatBookingMoney(bookings.reduce((sum, appointment) => sum + appointment.financials.totalCents, 0))}</p><p className="text-sm">Appointment amounts below are the recorded allocations, not additional bundle charges. Remaining credits are in My Packages.</p></> : <p className="text-sm">Included service base: {formatBookingMoney(0)}. The bundle is not charged again; only this session’s independent add-ons and travel are shown below.</p>}
      </div>
      <button type="button" className={styles.packageAction} onClick={() => navigate(`/customer/packages/${encodeURIComponent(purchasedPackage.id)}?kind=first-class`)}>View Package<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></svg></button>
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
  return <div className={styles.info}><div aria-hidden="true" className={styles.infoIcon}><HugeiconsIcon icon={icon} size={21} /></div><div className="min-w-0"><p className="text-xs leading-5 text-[#45474B]">{label}</p><div className={styles.infoValue}>{children}</div></div></div>;
}
function ConfirmationAppointment({ booking, index, firstClass, onView }: { booking: BookingDetail; index?: number; firstClass: boolean; onView: () => void }) {
  const mode = booking.fulfilment.mode, travel = mode === "TRAVEL_TO_CUSTOMER";
  const location = travel ? booking.fulfilment.travelAddress : mode === "AT_BUSINESS_LOCATION" ? booking.fulfilment.businessLocation : undefined;
  const completeAddress = location && [location.streetName, location.streetNumber, location.area, location.city].every((value) => typeof value === "string" && value.trim());
  const online = firstClass ? { label: "Recorded online amount", amountCents: booking.paymentSummary?.actualOnlinePaidCents } : presentOnlineSnapshot(booking);
  return <article aria-label={`Confirmed appointment${index ? ` ${index}` : ""}`} className={styles.appointment}>
    <header className={styles.appointmentHeader}><h2 className="flex min-w-0 items-start gap-2 font-bold text-sm text-[#2E9DA7]"><HugeiconsIcon icon={Calendar03Icon} size={23} className="shrink-0" aria-hidden="true" /><span>{index ? `Appointment ${index} · ` : ""}Booking Ref: {booking.reference}</span></h2><BookingStatusBadge status={booking.status} /></header>
    <div className={styles.appointmentBody}><div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
      <div className="space-y-4">{booking.serviceLines.map((line, lineIndex) => <div key={`${line.serviceId}:${lineIndex}`} className="space-y-3">
        <Info icon={ScissorIcon} label="Service">{line.name}{line.packageName && <p className="text-sm text-[#3760B7]">{line.packageName}</p>}</Info>
        <Info icon={Clock04Icon} label="Duration">{line.hours !== undefined ? `${line.hours} hours` : `${line.durationMin} min`}{line.personCount !== undefined && <p className="text-sm">{line.personCount} participants</p>}</Info>
        <Info icon={User02Icon} label="Professional">{line.staffName ?? "Assigned professional information unavailable"}</Info>
        {line.addons.length > 0 && <Info icon={ScissorIcon} label="Add-ons"><ul>{line.addons.map((addon) => <li key={addon.addonId}>{addon.name} · {formatBookingMoney(addon.priceCents)}</li>)}</ul></Info>}
      </div>)}</div>
      <div className="space-y-3"><Info icon={Calendar03Icon} label="Date & Time"><p>{formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)}</p><p>{formatBookingTimeRange(booking.schedule)}</p><p className="text-sm text-[#45474B]">{booking.schedule.timezone}</p></Info>
        <Info icon={Location01Icon} label={travel ? "Professional visits your location" : mode === "AT_BUSINESS_LOCATION" ? "Visit the business" : "Appointment location"}>
          {(travel || mode === "AT_BUSINESS_LOCATION") && <><BookingVisitBadge mode={mode} /><p className="text-sm font-normal text-[#45474B]">{travel ? "Your appointment will take place at your selected address." : "Your appointment will take place at the business location."}</p></>}
          {completeAddress && location ? <><p>{location.streetName} {location.streetNumber}</p><p>{location.area}, {location.city}</p>{location.floorUnit && <p className="text-sm">Floor / unit: {location.floorUnit}</p>}{location.aptRoom && <p className="text-sm">Apartment / room: {location.aptRoom}</p>}{travel && booking.fulfilment.travelAddress?.propertyType && <p className="text-sm">Property type: {booking.fulfilment.travelAddress.propertyType}</p>}{travel && booking.fulfilment.travelAddress?.additionalDirections && <p className="text-sm">{booking.fulfilment.travelAddress.additionalDirections}</p>}</> : <p className="text-sm">Booked address unavailable. Contact the business to confirm the appointment location.</p>}
        </Info>
      </div></div>
      <section aria-label="Appointment payment summary" className={styles.payment}><CustomerFinancialRows rowClassName="flex justify-between items-start gap-4 text-xs sm:text-sm leading-5" rows={[
        { label: firstClass && booking.serviceLines.some((line) => line.packageRole === "REDEMPTION") ? "Included service base" : "Service allocation", amountCents: booking.financials.servicesSubtotalCents },
        { label: "Add-ons", amountCents: booking.financials.addonsSubtotalCents }, { label: "Travel fee", amountCents: booking.financials.travelFeeCents }, online, ...presentVenuePayment(booking), { label: firstClass ? "Recorded appointment total" : "Total", amountCents: booking.financials.totalCents },
      ]} />{firstClass && <p className="text-xs text-[#45474B]">Online amount and venue settlement are separate recorded facts. Confirmation does not attest cash receipt or a current net provider balance.</p>}</section>
      <button type="button" className={`${actionClass} w-full`} onClick={onView}><HugeiconsIcon icon={Calendar03Icon} size={18} />View Booking</button>
    </div>
  </article>;
}
