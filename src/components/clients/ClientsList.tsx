"use client";

import Image from "next/image";
import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import NotificationBell from "@/components/notifications/NotificationBell";

interface Client {
  /** Real Client id — absent only for legacy mock rows that predate the backend integration. */
  id?: string;
  name: string;
  joined: string;
  phone: string;
  /** undefined => "—" (booking-derived, not available until the Booking domain exists). */
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
  /** "LINKED" clients are backed by a real Bookly Customer account (read-only identity). */
  linkState?: "UNLINKED" | "LINKED" | "IDENTITY_CONFLICT";
}

export interface ClientsListMetrics {
  totalClients: number;
  newThisMonth: number;
  /** undefined => rendered as "—": depends on the Booking/Payment domains, not built yet. */
  activeThisMonth?: number;
  atRisk?: number;
  avgLifetimeValue?: string;
}

interface ClientsListProps {
  clientsData: Client[];
  setClientsData: React.Dispatch<React.SetStateAction<Client[]>>;
  setIsAddingClient: (val: boolean) => void;
  setIsViewingClient: (val: boolean) => void;
  setEditingClientIndex: (idx: number | null) => void;
  openActionIdx: number | null;
  setOpenActionIdx: (idx: number | null) => void;

  setClientFirstName?: (val: string) => void;
  setClientLastName?: (val: string) => void;
  setClientPhone?: (val: string) => void;
  setClientTagState?: (val: string) => void;
  setClientPhoneCode?: (val: string) => void;
  setClientPhoneFlag?: (val: string) => void;
  setClientAvatar?: (val: string) => void;
  isStaffDashboard?: boolean;
  /** When provided, real metrics replace the header cards' hardcoded numbers. */
  metrics?: ClientsListMetrics;
  /** Real Staff names for the filter dropdown; falls back to the demo list when absent. */
  staffOptions?: string[];
  /** No Client<->Staff relationship exists yet — selecting a Staff filter has no effect. */
  disableStaffFilter?: boolean;
  /** Real navigation — bypasses the legacy name/phone-string-parsing fallback below. */
  onViewClient?: (client: Client) => void;
  onEditClient?: (client: Client) => void;
  onDeleteClient?: (client: Client) => void;
  onArchivedClientsClick?: () => void;
}

export default function ClientsList({
  clientsData,
  setClientsData,
  setIsAddingClient,
  setIsViewingClient,
  setEditingClientIndex,
  openActionIdx,
  setOpenActionIdx,
  setClientFirstName,
  setClientLastName,
  setClientPhone,
  setClientTagState,
  setClientPhoneCode,
  setClientPhoneFlag,
  setClientAvatar,
  isStaffDashboard = false,
  metrics,
  staffOptions,
  disableStaffFilter = false,
  onViewClient,
  onEditClient,
  onDeleteClient,
  onArchivedClientsClick
}: ClientsListProps) {
  const [dropdownCoords, setDropdownCoords] = React.useState<{ top: number; left: number } | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTag, setSelectedTag] = React.useState("All Tags");
  const [selectedStaff, setSelectedStaff] = React.useState("All Staff");
  const [isTagDropdownOpen, setIsTagDropdownOpen] = React.useState(false);
  const [isStaffDropdownOpen, setIsStaffDropdownOpen] = React.useState(false);

  const tagsList = ["All Tags", "VIP", "Regular", "New", "No-show"];
  const staffList = ["All Staff", ...(staffOptions ?? ["Elena G.", "Valeriia M.", "Rafael A.", "Nicolas K."])];

  // Demo-only fake Client<->Staff assignment — never used once disableStaffFilter is set (real
  // data has no such relationship yet; it depends on the Booking domain, see project report).
  const getClientStaff = (clientName: string) => {
    const staffListNames = ["Elena G.", "Valeriia M.", "Rafael A.", "Nicolas K."];
    const charCodeSum = clientName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return staffListNames[charCodeSum % staffListNames.length];
  };

  const filteredClients = clientsData.filter((client) => {
    const query = searchQuery.toLowerCase();
    const nameMatch = client.name.toLowerCase().includes(query);
    const phoneMatch = client.phone.toLowerCase().includes(query);
    const matchesSearch = nameMatch || phoneMatch;

    const matchesTag = selectedTag === "All Tags" || client.tag === selectedTag;

    const matchesStaff =
      disableStaffFilter ||
      selectedStaff === "All Staff" ||
      getClientStaff(client.name) === selectedStaff;

    return matchesSearch && matchesTag && matchesStaff;
  });

  const handleExportCSV = () => {
    const headers = ["Name", "Phone", "Joined", "Last Visit / Next", "Visits", "Spent", "Tags"];
    const rows = filteredClients.map(c => [
      c.name,
      c.phone,
      c.joined,
      c.visitText ?? "",
      (c.visits ?? "").toString(),
      c.spent ?? "",
      c.tag || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clients_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] relative">
      {/* Client management Header */}
      <div className="h-16 border-b border-[#C6C6CB] bg-[#FCF8F8] px-6 flex items-center justify-between shrink-0 select-none">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A1A] font-poppins">Client management</h1>
          <p className="text-[11px] text-neutral-500 font-poppins mt-0.5">See all the details of your client</p>
        </div>
        <NotificationBell />
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Metrics cards container */}
        <div className="grid grid-cols-2 md:grid-cols-5 bg-white border border-[#E8E8E6] rounded-xl shrink-0 overflow-hidden">
          <div className="p-4 flex flex-col justify-center border-b border-r border-[#E8E8E6] md:border-0">
            <span className="text-lg font-semibold text-[#1A1A1A]">{metrics ? metrics.totalClients : 18}</span>
            <span className="text-xs text-[#888780] font-light mt-0.5">Total clients</span>
          </div>
          <div className="p-4 flex flex-col justify-center border-b border-[#E8E8E6] md:border-l md:border-0">
            <span className="text-lg font-semibold text-[#1A1A1A]">
              {metrics ? (metrics.activeThisMonth ?? "—") : 12}
            </span>
            <span className="text-xs text-[#888780] font-light mt-0.5">Active this month</span>
          </div>
          <div className="p-4 flex flex-col justify-center border-b border-r border-[#E8E8E6] md:border-l md:border-0">
            <span className="text-lg font-semibold text-[#1D9E75]">{metrics ? metrics.newThisMonth : 3}</span>
            <span className="text-xs text-[#888780] font-light mt-0.5">New this month</span>
          </div>
          <div className="p-4 flex flex-col justify-center border-b border-[#E8E8E6] md:border-l md:border-0">
            <span className="text-lg font-semibold text-[#E24B4A]">{metrics ? (metrics.atRisk ?? "—") : 2}</span>
            <span className="text-xs text-[#888780] font-light mt-0.5">At-risk</span>
          </div>
          <div className="p-4 flex flex-col justify-center col-span-2 md:col-span-1 md:border-l border-[#E8E8E6]">
            <span className="text-lg font-semibold text-[#1A1A1A]">
              {metrics ? (metrics.avgLifetimeValue ?? "—") : "€504"}
            </span>
            <span className="text-xs text-[#888780] font-light mt-0.5">Avg. lifetime value</span>
          </div>
        </div>

        {/* Filter toolbar */}
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between shrink-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto">
            {/* Search box */}
            <div className="relative w-full sm:w-[230px] h-9">
              <span className="absolute left-3 top-2.5 text-neutral-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name or phone..."
                className="w-full h-full pl-9 pr-4 bg-white border border-[#D3D1C7] rounded-lg text-xs font-poppins placeholder-neutral-400 focus:outline-none focus:border-neutral-800"
              />
            </div>

            {/* Dropdown 1: Tags */}
            <div className="relative">
              <button 
                onClick={() => {
                  setIsTagDropdownOpen(!isTagDropdownOpen);
                  setIsStaffDropdownOpen(false);
                }}
                className="h-9 px-3 border border-[#111111] rounded-lg flex items-center justify-between bg-white text-xs font-semibold text-[#111111] gap-2 min-w-[90px] cursor-pointer"
              >
                <span>{selectedTag}</span>
                <HugeiconsIcon icon={ArrowDown01Icon} className={`w-3.5 h-3.5 transition-transform duration-200 ${isTagDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {isTagDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsTagDropdownOpen(false)} />
                  <div className="absolute top-10 left-0 bg-white border border-[#E8E8E6] rounded-lg shadow-lg z-50 w-[140px] py-1 flex flex-col text-xs font-medium font-poppins">
                    {tagsList.map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          setSelectedTag(t);
                          setIsTagDropdownOpen(false);
                        }}
                        className={`px-4 py-2 hover:bg-neutral-50 text-left w-full transition-colors ${selectedTag === t ? "font-bold text-black" : "text-[#5F5E5A]"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Dropdown 2: All staff */}
            <div className="relative">
              <button 
                onClick={() => {
                  setIsStaffDropdownOpen(!isStaffDropdownOpen);
                  setIsTagDropdownOpen(false);
                }}
                className="h-9 px-3 border border-[#111111] rounded-lg flex items-center justify-between bg-white text-xs font-semibold text-[#111111] gap-2 min-w-[100px] cursor-pointer"
              >
                <span>{selectedStaff}</span>
                <HugeiconsIcon icon={ArrowDown01Icon} className={`w-3.5 h-3.5 transition-transform duration-200 ${isStaffDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {isStaffDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsStaffDropdownOpen(false)} />
                  <div className="absolute top-10 left-0 bg-white border border-[#E8E8E6] rounded-lg shadow-lg z-50 w-[160px] py-1 flex flex-col text-xs font-medium font-poppins">
                    {staffList.map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          setSelectedStaff(s);
                          setIsStaffDropdownOpen(false);
                        }}
                        className={`px-4 py-2 hover:bg-neutral-50 text-left w-full transition-colors ${selectedStaff === s ? "font-bold text-black" : "text-[#5F5E5A]"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Dropdown 3: Export */}
            {!isStaffDashboard && (
              <button 
                onClick={handleExportCSV}
                className="h-9 px-3 border border-[#111111] rounded-lg flex items-center justify-between bg-white text-xs font-semibold text-[#111111] gap-2 cursor-pointer hover:bg-neutral-50"
              >
                <span>Export</span>
                <svg className="w-3.5 h-3.5 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            {onArchivedClientsClick && (
              <button
                onClick={onArchivedClientsClick}
                className="h-9 px-3 border border-[#111111] rounded-lg bg-white text-xs font-semibold text-[#111111] hover:bg-neutral-50 transition-colors whitespace-nowrap"
              >
                Archived clients
              </button>
            )}
            {/* Add Client Button */}
            <button onClick={() => setIsAddingClient(true)} className="h-9 px-4 bg-[#111111] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-neutral-800 transition-colors w-full lg:w-auto">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add client</span>
            </button>
          </div>
        </div>

        {/* Clients Table Container */}
        <div className="bg-white border border-[#E8E8E6] rounded-xl flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAFAF8] border-b border-[#E8E8E6] text-[11px] text-[#888780] font-normal font-poppins">
                  <th className="px-5 py-3.5 font-normal">Client</th>
                  <th className="px-5 py-3.5 font-normal">Phone</th>
                  <th className="px-5 py-3.5 font-normal">Last visit / Next</th>
                  <th className="px-5 py-3.5 font-normal">Visits</th>
                  <th className="px-5 py-3.5 font-normal">Spent</th>
                  <th className="px-5 py-3.5 font-normal">Tags</th>
                  <th className="px-5 py-3.5 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E6] font-poppins text-xs">
                {filteredClients.map((client, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                    {/* Client details */}
                    <td className="px-5 py-3.5 flex items-center gap-3">
                      {client.avatar ? (
                        <Image src={client.avatar} className="w-8 h-8 rounded-full object-cover shrink-0" alt="avatar" width={32} height={32} />
                      ) : (
                        <div className={`w-8 h-8 rounded-full ${client.avatarBg} flex items-center justify-center text-[10px] font-semibold text-[#5F5E5A] shrink-0`}>
                          {client.avatarText}
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#1A1A1A]">{client.name}</span>
                        <span className="text-[10px] text-[#888780] font-light mt-0.5">{client.joined}</span>
                      </div>
                    </td>
                    {/* Phone */}
                    <td className="px-5 py-3.5 text-[#5F5E5A]">
                      {client.phone}
                    </td>
                    {/* Last visit / Next Booking */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className={`font-medium ${client.isNext ? "text-[#1D9E75]" : "text-[#1A1A1A]"}`}>
                          {client.visitText ? (client.isNext ? `↑ ${client.visitText}` : client.visitText) : "—"}
                        </span>
                        {client.visitSub && (
                          <span className="text-[10px] text-[#B4B2A9] mt-0.5">{client.visitSub}</span>
                        )}
                      </div>
                    </td>
                    {/* Visits */}
                    <td className="px-5 py-3.5 text-[#1A1A1A] font-semibold">
                      {client.visits ?? "—"}
                    </td>
                    {/* Spent */}
                    <td className="px-5 py-3.5 text-[#1A1A1A] font-semibold">
                      {client.spent ?? "—"}
                    </td>
                    {/* Tags */}
                    <td className="px-5 py-3.5">
                      {client.tag && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold whitespace-nowrap ${client.tagBg} ${client.tagColor}`}>
                          {client.tag}
                        </span>
                      )}
                    </td>
                    {/* Action button */}
                    <td className="px-5 py-3.5 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const dropdownHeight = 130;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          setDropdownCoords({
                            top: spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
                            left: rect.right - 160
                          });
                          setOpenActionIdx(openActionIdx === idx ? null : idx);
                        }}
                        className="border border-[#111827] rounded-full px-3 py-1 text-xs font-semibold text-[#111827] hover:bg-neutral-50 transition-colors inline-flex items-center gap-1.5 h-[30px]"
                      >
                        <span>Action</span>
                        <HugeiconsIcon icon={ArrowDown01Icon} className={`w-3.5 h-3.5 transition-transform duration-200 ${openActionIdx === idx ? "rotate-180" : ""}`} />
                      </button>

                      {/* Dropdown Options */}
                      {openActionIdx === idx && (
                        <>
                          <div
                            className="fixed inset-0 z-40 bg-transparent"
                            onClick={() => setOpenActionIdx(null)}
                          />
                          <div 
                            style={{ 
                              position: "fixed", 
                              top: dropdownCoords?.top, 
                              left: dropdownCoords?.left 
                            }}
                            className="z-50 w-[160px] bg-white rounded-xl shadow-2xl border border-[#C6C6CB] flex flex-col py-1 text-left text-xs font-poppins font-medium select-none animate-fadeIn"
                          >
                            <button
                              className="px-4 py-2.5 hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 text-left transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionIdx(null);
                                const c = clientsData[idx];

                                if (onViewClient) {
                                  onViewClient(c);
                                  return;
                                }

                                const parts = c.name.split(" ");
                                setClientFirstName?.(parts[0] || "");
                                setClientLastName?.(parts.slice(1).join(" ") || "");

                                let phoneSuffix = c.phone || "";
                                if (c.phone && c.phone.startsWith("+")) {
                                  const pParts = c.phone.split(" ");
                                  const pCode = pParts[0];
                                  const pRest = pParts.slice(1).join(" ");
                                  if (setClientPhoneCode) setClientPhoneCode(pCode);
                                  if (setClientPhoneFlag) {
                                    const matched = [
                                      { code: "+357", flag: "cy" },
                                      { code: "+880", flag: "bd" },
                                      { code: "+30", flag: "gr" },
                                      { code: "+44", flag: "gb" },
                                      { code: "+1", flag: "us" }
                                    ].find(co => co.code === pCode);
                                    if (matched) setClientPhoneFlag(matched.flag);
                                  }
                                  phoneSuffix = pRest;
                                } else {
                                  if (setClientPhoneCode) setClientPhoneCode("+357");
                                  if (setClientPhoneFlag) setClientPhoneFlag("cy");
                                }
                                setClientPhone?.(phoneSuffix);
                                setClientTagState?.(c.tag || "VIP");
                                if (setClientAvatar) setClientAvatar(c.avatar || "");
                                setIsViewingClient(true);
                                setEditingClientIndex(idx);
                              }}
                            >
                              View client details
                            </button>
                            <button
                              className="px-4 py-2.5 hover:bg-neutral-50 text-neutral-700 hover:text-neutral-900 text-left transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionIdx(null);
                                const c = clientsData[idx];

                                if (onEditClient) {
                                  onEditClient(c);
                                  return;
                                }

                                const parts = c.name.split(" ");
                                setClientFirstName?.(parts[0] || "");
                                setClientLastName?.(parts.slice(1).join(" ") || "");

                                let phoneSuffix = c.phone || "";
                                if (c.phone && c.phone.startsWith("+")) {
                                  const pParts = c.phone.split(" ");
                                  const pCode = pParts[0];
                                  const pRest = pParts.slice(1).join(" ");
                                  if (setClientPhoneCode) setClientPhoneCode(pCode);
                                  if (setClientPhoneFlag) {
                                    const matched = [
                                      { code: "+357", flag: "cy" },
                                      { code: "+880", flag: "bd" },
                                      { code: "+30", flag: "gr" },
                                      { code: "+44", flag: "gb" },
                                      { code: "+1", flag: "us" }
                                    ].find(co => co.code === pCode);
                                    if (matched) setClientPhoneFlag(matched.flag);
                                  }
                                  phoneSuffix = pRest;
                                } else {
                                  if (setClientPhoneCode) setClientPhoneCode("+357");
                                  if (setClientPhoneFlag) setClientPhoneFlag("cy");
                                }
                                setClientPhone?.(phoneSuffix);
                                setClientTagState?.(c.tag || "VIP");
                                if (setClientAvatar) setClientAvatar(c.avatar || "");
                                setIsViewingClient(false);
                                setEditingClientIndex(idx);
                              }}
                            >
                              Edit client details
                            </button>
                            <button
                              className="px-4 py-2.5 hover:bg-neutral-50 text-[#BA1A1A] text-left transition-colors font-semibold"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionIdx(null);
                                const c = clientsData[idx];

                                if (onDeleteClient) {
                                  onDeleteClient(c);
                                  return;
                                }

                                setClientsData(clientsData.filter((_, i) => i !== idx));
                              }}
                            >
                              {onDeleteClient ? "Archive client" : "Delete client"}
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
