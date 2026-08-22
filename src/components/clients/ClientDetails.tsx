"use client";
import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";


import React, { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft02Icon,
  PencilEdit02Icon,
  UserIcon,
  Mail01Icon,
  IdentityCardIcon,
  Home03Icon,
  ArrowDown01Icon,
  Search01Icon,
  UserCheck02Icon,
  Calendar03Icon
} from "@hugeicons/core-free-icons";

import { useBusinessBookingsQuery } from "@/lib/bookings/hooks";
import type { BookingStatus } from "@/lib/api/bookings";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_TONE, formatBookingDate, formatBookingMoney, formatBookingTime } from "@/lib/bookings/format";

interface ClientDetailsProps {
  /** Real backend ids (Batch 6) — power the History tab's real booking list via
   * bookingsApi.listForBusiness(businessId, { businessClientId: clientId }). Undefined only
   * while the parent is still resolving them, in which case History renders its loading state. */
  businessId?: string;
  clientId?: string;
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientGender: string;
  clientDob: string;
  clientPhone: string;
  clientCity: string;
  clientPropertyType: string;
  clientArea: string;
  clientStreetName: string;
  clientStreetNumber: string;
  clientFloor: string;
  clientAptNo: string;
  clientAvatar?: string;
  setIsViewingClient: (val: boolean) => void;
  setEditingClientIndex: (idx: number | null) => void;
  /** True only for a Client backed by a real, linked Bookly Customer account. */
  isLinked?: boolean;
}

export default function ClientDetails({
  businessId,
  clientId,
  clientFirstName,
  clientLastName,
  clientEmail,
  clientGender,
  clientDob,
  clientPhone,
  clientCity,
  clientPropertyType,
  clientArea,
  clientStreetName,
  clientStreetNumber,
  clientFloor,
  clientAptNo,
  clientAvatar,
  setIsViewingClient,
  setEditingClientIndex,
  isLinked = false
}: ClientDetailsProps) {
  const [viewClientTab, setViewClientTab] = useState("PROFILE");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<BookingStatus | "All">("All");

  const historyQuery = useBusinessBookingsQuery(businessId, {
    ...(clientId ? { businessClientId: clientId } : {}),
    ...(historyStatusFilter !== "All" ? { status: [historyStatusFilter] } : {}),
    limit: 50,
  });
  const historyBookings = (historyQuery.data?.bookings ?? []).filter((b) => {
    if (!historySearch) return true;
    return b.reference.toLowerCase().includes(historySearch.toLowerCase());
  });

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] relative">
      {/* Client Info Header */}
      <DashboardHeader title="Client Info" subtitle="View client information in details" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

      {/* Scrollable Container */}
      <div className="flex-1 p-6 md:p-8 xl:p-10 flex flex-col gap-6 w-full max-w-[1095px] mx-auto">
        {/* Back / Breadcrumbs */}
        <div
          onClick={() => {
            setIsViewingClient(false);
            setEditingClientIndex(null);
          }}
          className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-900 font-poppins select-none"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="w-4 h-4 text-neutral-600" />
          <span>Clients</span>
          <span className="text-neutral-300 font-normal">&gt;</span>
          <span className="text-[#0F1E35] font-semibold">View</span>
        </div>

        {/* Tabs Header bar */}
        <div className="flex flex-row items-center border-b border-[#666666] w-full h-[54px] select-none">
          <button
            onClick={() => setViewClientTab("PROFILE")}
            className={`flex flex-row justify-center items-center px-5 h-[54px] gap-2.5 transition-all ${
              viewClientTab === "PROFILE" ? "border-b-4 border-black text-[#111111]" : "text-[#111111]/60"
            }`}
          >
            <span className="font-poppins font-normal text-sm tracking-[0.09em] uppercase">Profile</span>
          </button>
          <button
            onClick={() => setViewClientTab("HISTORY")}
            className={`flex flex-row justify-center items-center px-5 h-[54px] gap-2.5 transition-all ${
              viewClientTab === "HISTORY" ? "border-b-4 border-black text-[#111111]" : "text-[#111111]/60"
            }`}
          >
            <span className="font-poppins font-normal text-sm tracking-[0.09em] uppercase">History</span>
          </button>
        </div>

        {/* Profile Card / Tab Content */}
        {viewClientTab === "PROFILE" ? (
          <div className="flex flex-col w-full bg-[#FFFFFF] border border-[#ECEBEF] rounded-2xl p-6 md:p-8 gap-6 shadow-sm">
            {/* Edit button */}
            <div className="flex justify-between items-center w-full flex-wrap gap-2">
              {isLinked ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#E6F1FB] text-[#0C447C]">
                  <HugeiconsIcon icon={UserCheck02Icon} className="w-3.5 h-3.5" />
                  Linked Bookly account
                </span>
              ) : <span />}
              <button
                onClick={() => setIsViewingClient(false)}
                className="bg-[#0D0D0D] hover:bg-neutral-800 text-white rounded-lg px-4 py-2 text-xs font-semibold font-poppins flex items-center justify-center gap-1.5 transition-all shadow-sm"
              >
                <HugeiconsIcon icon={PencilEdit02Icon} className="w-4 h-4 text-white" />
                <span>Edit</span>
              </button>
            </div>

            {/* Profile Avatar section */}
            <div className="flex items-center gap-6">
              <div className="relative w-[120px] h-[120px] rounded-full border border-neutral-200 overflow-hidden shadow-sm shrink-0 bg-neutral-100 flex items-center justify-center">
                <Image src={clientAvatar || "/businessDashboard/downLogo.png"} alt="Client Avatar" className="w-full h-full object-cover" fill />
              </div>
            </div>

            {/* Form fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mt-4">
              {/* NAME */}
              <div className="md:col-span-3 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Name</label>
                <div className="flex items-center gap-3 border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <HugeiconsIcon icon={UserIcon} className="w-5 h-5 text-[#111111]" />
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {`${clientFirstName} ${clientLastName}`.trim() || "—"}
                  </span>
                </div>
              </div>

              {/* EMAIL */}
              <div className="md:col-span-3 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Email</label>
                <div className="flex items-center gap-3 border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <HugeiconsIcon icon={Mail01Icon} className="w-5 h-5 text-[#111111]" />
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientEmail || "—"}
                  </span>
                </div>
              </div>

              {/* GENDER */}
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Gender</label>
                <div className="flex items-center border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientGender || "—"}
                  </span>
                </div>
              </div>

              {/* DATE OF BIRTH */}
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Date of Birth</label>
                <div className="flex items-center gap-3 border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <HugeiconsIcon icon={IdentityCardIcon} className="w-5 h-5 text-[#111111]" />
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientDob || "—"}
                  </span>
                </div>
              </div>

              {/* CONTACT */}
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Contact</label>
                <div className="flex items-center gap-3 border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <Image src="/Icons/phone.svg" alt="Phone" className="w-5 h-5 object-contain" width={20} height={20} />
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientPhone || "—"}
                  </span>
                </div>
              </div>

              {/* CITY */}
              <div className="md:col-span-3 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">City</label>
                <div className="flex items-center gap-3 border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <HugeiconsIcon icon={Home03Icon} className="w-5 h-5 text-[#111111]" />
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientCity || "—"}
                  </span>
                </div>
              </div>

              {/* PROPERTY TYPE */}
              <div className="md:col-span-3 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Property Type</label>
                <div className="flex items-center border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientPropertyType || "—"}
                  </span>
                </div>
              </div>

              {/* AREA/NEIGHBOURHOOD */}
              <div className="md:col-span-3 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Area/Neighbourhood</label>
                <div className="flex items-center border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientArea || "—"}
                  </span>
                </div>
              </div>

              {/* STREET NAME */}
              <div className="md:col-span-3 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Street Name</label>
                <div className="flex items-center border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientStreetName || "—"}
                  </span>
                </div>
              </div>

              {/* STREET NUMBER */}
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Street Number</label>
                <div className="flex items-center border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientStreetNumber || "—"}
                  </span>
                </div>
              </div>

              {/* FLOOR / UNIT */}
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Floor / Unit</label>
                <div className="flex items-center border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientFloor || "—"}
                  </span>
                </div>
              </div>

              {/* APT/ROOM NO. */}
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="font-poppins text-xs font-semibold text-[#111111] uppercase tracking-[0.09em]">Apt/Room No.</label>
                <div className="flex items-center border border-[#ECEBEF] rounded-xl px-4 bg-[#FFFFFF] h-[60px] w-full select-none">
                  <span className="font-poppins text-sm font-semibold text-[#111111]">
                    {clientAptNo || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col w-full bg-[#FFFFFF] border border-[#ECEBEF] rounded-2xl p-6 md:p-8 gap-6 shadow-sm">
            {/* History Control bar */}
            <div className="flex flex-row justify-between items-center w-full select-none shrink-0 flex-wrap gap-4">
              <div className="relative w-[214px]">
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value as BookingStatus | "All")}
                  className="w-full h-10 border border-[#ECEBEF] rounded-xl px-4 text-xs font-semibold text-[#111111] appearance-none focus:outline-none focus:border-neutral-800 font-poppins"
                >
                  <option value="All">All bookings</option>
                  {(Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[]).map((status) => (
                    <option key={status} value={status}>{BOOKING_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <HugeiconsIcon icon={ArrowDown01Icon} className="w-3.5 h-3.5 absolute right-3 top-3.5 text-neutral-500 pointer-events-none" />
              </div>
              {/* Search bar */}
              <div className="flex items-center gap-2 bg-[#EBEBEB] rounded-xl px-3.5 py-2 h-10 w-[207px] shrink-0">
                <HugeiconsIcon icon={Search01Icon} className="w-5 h-5 text-[#666666]" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by reference..."
                  className="bg-transparent text-xs placeholder-[#666666] text-[#111111] focus:outline-none w-full font-poppins"
                />
              </div>
            </div>

            {!businessId || !clientId || historyQuery.isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 w-full py-16 text-center">
                <span className="font-poppins text-sm text-neutral-400">Loading booking history…</span>
              </div>
            ) : historyQuery.isError ? (
              <div className="flex flex-col items-center justify-center gap-3 w-full py-16 text-center">
                <span className="font-poppins text-sm font-semibold text-[#BA1A1A]">Couldn&apos;t load booking history</span>
              </div>
            ) : historyBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 w-full py-16 text-center">
                <HugeiconsIcon icon={Calendar03Icon} className="w-8 h-8 text-[#D3D1C7]" />
                <div className="flex flex-col gap-1">
                  <span className="font-poppins text-sm font-semibold text-[#5F5E5A]">No booking history yet</span>
                  <span className="font-poppins text-xs text-[#ABAAA6]">
                    This client&apos;s bookings will appear here once they have one.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                {historyBookings.map((booking) => {
                  const tone = BOOKING_STATUS_TONE[booking.status];
                  const toneClass = tone === "danger" ? "bg-[#FFF0F0] text-[#E42424]"
                    : tone === "success" ? "bg-[#E1F5EE] text-[#2F8068]"
                    : tone === "warning" ? "bg-[#FCF4E0] text-[#D97706]"
                    : tone === "info" ? "bg-[#E6F1FB] text-[#3760B7]"
                    : "bg-[#F0F0EE] text-[#5F5E5A]";
                  return (
                    <div key={booking.id} className="flex items-center justify-between border border-[#ECEBEF] rounded-xl px-4 py-3 gap-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-poppins text-xs font-semibold text-[#111111]">{booking.reference}</span>
                        <span className="font-poppins text-[11px] text-[#666666]">
                          {formatBookingDate(booking.schedule.startAt, booking.schedule.timezone)} · {formatBookingTime(booking.schedule.startAt, booking.schedule.timezone)} · {booking.primaryServiceName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-poppins text-xs font-semibold text-[#111111]">{formatBookingMoney(booking.totalCents)}</span>
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-full uppercase tracking-wider ${toneClass}`}>
                          {BOOKING_STATUS_LABELS[booking.status]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    
      </div></main>
  );
}
