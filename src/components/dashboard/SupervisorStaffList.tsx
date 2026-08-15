"use client";

import Image from "next/image";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import React, { useState, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Plus as PlusIcon,
  InformationCircleIcon,
  Camera01Icon
} from "@hugeicons/core-free-icons";
import { Staff, initialStaffMembers } from "@/data/staffMockData";
import StaffCard from "../staff/StaffCard";
import StaffAvailabilityTable from "../staff/StaffAvailabilityTable";

interface WorkingShift {
  open: boolean;
  start: string;
  end: string;
}

export default function SupervisorStaffList() {
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Form states for adding new staff
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<"Supervisor" | "Staff">("Staff");
  const [staffPhone, setStaffPhone] = useState("");

  // Working shifts state
  const [workingShifts, setWorkingShifts] = useState<{ [key: string]: WorkingShift }>({
    Mon: { open: true, start: "09:00", end: "18:00" },
    Tue: { open: true, start: "09:00", end: "18:00" },
    Wed: { open: true, start: "09:00", end: "18:00" },
    Thu: { open: true, start: "09:00", end: "18:00" },
    Fri: { open: true, start: "09:00", end: "18:00" },
    Sat: { open: false, start: "10:00", end: "16:00" },
    Sun: { open: false, start: "10:00", end: "16:00" }
  });

  // Leave records state
  const [leaves, setLeaves] = useState<Array<{ type: string; date: string }>>([
    { type: "Annual Holiday", date: "2026-06-02" }
  ]);
  const [newLeaveType, setNewLeaveType] = useState("Annual Holiday");
  const [newLeaveDate, setNewLeaveDate] = useState("2026-06-02");

  // Show all staff members including Owner
  const [staffMembers, setStaffMembers] = useState<Staff[]>(initialStaffMembers);
  const [editingStaffId, setEditingStaffId] = useState<number | string | null>(null);

  const toggleStaffStatus = (id: number | string) => {
    const target = staffMembers.find(s => s.id === id);
    if (target?.role === "Owner") return;
    setStaffMembers(staffMembers.map(s => s.id === id ? { ...s, status: s.status === "Active" ? "Inactive" : "Active" } : s));
  };

  const handleEditStaff = (id: number | string) => {
    const member = staffMembers.find(s => s.id === id);
    if (member) {
      if (member.role === "Owner") return;

      setStaffName(member.name);
      setStaffEmail(member.email || "");
      setStaffRole(member.role as any);
      setStaffPhone(member.phone || "");
      setEditingStaffId(id);
      setIsAdding(true);
    }
  };

  const handleDeleteStaff = () => {
    if (editingStaffId !== null) {
      setStaffMembers(staffMembers.filter(s => s.id !== editingStaffId));
      setStaffName("");
      setStaffEmail("");
      setStaffPhone("");
      setEditingStaffId(null);
      setPhotoPreview(null);
      setIsAdding(false);
    }
  };

  const handleAddStaff = () => {
    if (!staffName || !staffEmail) return;
    if (editingStaffId !== null) {
      // Edit Mode
      setStaffMembers(staffMembers.map(s => s.id === editingStaffId ? {
        ...s,
        name: staffName,
        email: staffEmail,
        role: staffRole,
        phone: staffPhone,
        subRole: staffRole === "Supervisor" ? "Supervisor" : "Staff"
      } : s));
    } else {
      // Create Mode
      const newStaff: Staff = {
        id: Date.now(),
        name: staffName,
        role: staffRole,
        subRole: staffRole === "Supervisor" ? "Supervisor" : "Staff",
        avatarText: staffName.split(" ").map(n => n[0] || "").join("").toUpperCase(),
        avatarBg: "bg-[#7C3AED]",
        servicesAssigned: "All 6 services assigned",
        schedule: "Mon-Fri 09:00-20:00 • Sat 10:00-16:00",
        status: "Active",
        phone: staffPhone,
        email: staffEmail
      };
      setStaffMembers([...staffMembers, newStaff]);
    }

    // Reset Form
    setStaffName("");
    setStaffEmail("");
    setStaffPhone("");
    setEditingStaffId(null);
    setPhotoPreview(null);
    setIsAdding(false);
  };

  if (isAdding) {
    return (
      <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
        <DashboardHeader title="Staff" subtitle={editingStaffId !== null ? "Edit staff details" : "Add team member"} />
        <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-8 select-none w-full">
            <button onClick={() => setIsAdding(false)} className="hover:text-black flex items-center gap-1">
              <span>Staff</span>
            </button>
            <span className="text-neutral-300">/</span>
            <span className="text-black font-semibold">{editingStaffId !== null ? "Edit Staff details" : "Add Staff member"}</span>
          </div>

          {/* Form Container */}
          <div className="ml-0 md:ml-[100px] flex flex-col gap-[20px] w-full max-w-full md:max-w-[958.4px]">
            
            {/* Photo Section */}
            <div className="flex flex-col gap-[12px] w-full">
              <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                photo
              </span>
              <div className="relative w-[80px] h-[80px]">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setPhotoPreview(URL.createObjectURL(file));
                    }
                  }}
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-[80px] h-[80px] rounded-full bg-[#E1E0E6] flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <Image src={photoPreview || "/img/dumyUser.jpeg"} alt="Avatar Preview" className="w-full h-full object-cover" fill />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute right-0 bottom-0 w-[32px] h-[32px] bg-white border border-[#C6C6CB] rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-neutral-50 transition-colors"
                >
                  <HugeiconsIcon icon={Camera01Icon} className="w-4 h-4 text-[#141B34]" />
                </button>
              </div>
            </div>

            {/* Name Field */}
            <div className="flex flex-col gap-[12px] w-full">
              <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                name
              </span>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Hohb doe"
                className="h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] placeholder:text-[#5F5E5A] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
              />
            </div>

            {/* Email and Role Row */}
            <div className="flex flex-col md:flex-row gap-[20px] w-full">
              {/* Email */}
              <div className="flex-1 flex flex-col gap-[12px]">
                <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                  email
                </span>
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="Eslsj@gam.com"
                  className="h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] placeholder:text-[#5F5E5A] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
                />
              </div>

              {/* Role */}
              <div className="flex-1 flex flex-col gap-[12px]">
                <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                  role
                </span>
                <div className="relative w-full">
                  <select
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value as any)}
                    className="appearance-none h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] pr-10 cursor-pointer"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23141B34' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 16px center',
                      backgroundSize: '16px'
                    }}
                  >
                    <option value="Supervisor">Supervisor</option>
                    <option value="Staff">Staff</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Phone Field */}
            <div className="flex flex-col gap-[12px] w-full">
              <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                phone
              </span>
              <input
                type="text"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                placeholder="+357 99 111222"
                className="h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] placeholder:text-[#5F5E5A] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)]"
              />
            </div>

            {/* Business Field */}
            <div className="flex flex-col gap-[12px] w-full">
              <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                business
              </span>
              <div className="relative w-full">
                <select
                  className="appearance-none h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] pr-10 cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23141B34' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                    backgroundSize: '16px'
                  }}
                >
                  <option value="business_name">Business name</option>
                </select>
              </div>
            </div>

            {/* Services Field */}
            <div className="flex flex-col gap-[12px] w-full">
              <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                services
              </span>
              <div className="relative w-full">
                <select
                  className="appearance-none h-[44px] w-full bg-white border border-[#C6C6CB] rounded-[8px] px-4 font-poppins text-sm text-[#1C1B1C] focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] pr-10 cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23141B34' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                    backgroundSize: '16px'
                  }}
                >
                  <option value="assigned_services">Assigned services</option>
                </select>
              </div>
            </div>

            {/* Working Hours & Leave Section Grid */}
            <div className="flex flex-col md:flex-row gap-[48px] w-full items-start mt-4">
              
              {/* Business Working Hours Column */}
              <div className="flex-1 flex flex-col gap-[12px] w-full max-w-full md:max-w-[455.2px]">
                <span className="font-poppins font-medium text-sm leading-[22px] text-[#101828]">
                  Edit Business Working Hours
                </span>
                <div className="box-sizing-border-box flex flex-col items-start p-6 bg-white border border-[#E5E7EB] rounded-[4px] w-full h-auto min-h-[272px] justify-between gap-4">
                  <div className="flex flex-row justify-between w-full px-2 gap-1 overflow-x-auto scrollbar-hide">
                    {Object.keys(workingShifts).map((day) => {
                      const shift = workingShifts[day];
                      return (
                        <div key={day} className="flex flex-col items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setWorkingShifts({
                              ...workingShifts,
                              [day]: { ...shift, open: !shift.open }
                            })}
                            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer text-xs ${
                              shift.open
                                ? "bg-[#E1F5EE] border-[#0F6E56]/40 text-[#0F6E56]"
                                : "bg-white border-[#D1D5DC] text-neutral-500"
                            }`}
                          >
                            {day[0]}
                          </button>
                          <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#101828]">
                            {day}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="w-full border-t border-[#F3F4F6] my-2" />

                  <div className="flex flex-row justify-between gap-4 w-full">
                    <div className="flex-1 flex flex-col gap-2">
                      <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                        start shift
                      </span>
                      <input
                        type="text"
                        placeholder="0:00"
                        className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-base text-[#364153]/50 focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] w-full"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                        end shift
                      </span>
                      <input
                        type="text"
                        placeholder="0:00"
                        className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-base text-[#364153]/50 focus:outline-none shadow-[0px_1px_2px_rgba(0,0,0,0.05)] w-full"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-[#2E9DA7] hover:opacity-80 transition-opacity cursor-pointer mt-2"
                  >
                    <span className="text-[17px] leading-[17px] font-bold">+</span>
                    <span className="font-poppins font-medium text-sm leading-[20px]">Add Hours</span>
                  </button>
                </div>
              </div>

              {/* Leave Reason & Date Column */}
              <div className="flex-1 flex flex-col gap-[12px] w-full max-w-full md:max-w-[455.2px]">
                <span className="font-poppins font-medium text-sm leading-[22px] text-[#101828]">
                  Leave reason & date
                </span>
                
                <div className="flex flex-col sm:flex-row justify-between gap-4 w-full">
                  <div className="flex-1 w-full flex flex-col gap-2">
                    <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                      name
                    </span>
                    <div className="relative w-full">
                      <select
                        value={newLeaveType}
                        onChange={(e) => setNewLeaveType(e.target.value)}
                        className="appearance-none h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] focus:outline-none pr-10 cursor-pointer w-full"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23141B34' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          backgroundSize: '16px'
                        }}
                      >
                        <option value="Annual Holiday">Annual Holiday</option>
                        <option value="Sick leave">Sick leave</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex-1 w-full flex flex-col gap-2">
                    <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                      date
                    </span>
                    <input
                      type="date"
                      value={newLeaveDate}
                      onChange={(e) => setNewLeaveDate(e.target.value)}
                      className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] focus:outline-none w-full"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setLeaves([...leaves, { type: newLeaveType, date: newLeaveDate }]);
                  }}
                  className="flex items-center gap-1.5 text-[#2E9DA7] hover:opacity-80 transition-opacity cursor-pointer mt-2 w-fit"
                >
                  <span className="text-[17px] leading-[17px] font-bold">+</span>
                  <span className="font-poppins font-medium text-sm leading-[20px]">Add Holidays</span>
                </button>

                {leaves.length > 0 && (
                  <div className="flex flex-col gap-3 mt-4 w-full">
                    {leaves.map((leave, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row justify-between gap-4 w-full items-start sm:items-end border border-neutral-100 p-3 rounded-lg sm:border-0 sm:p-0">
                        <div className="flex-1 w-full flex flex-col gap-2">
                          <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                            name
                          </span>
                          <div className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] flex items-center w-full">
                            {leave.type}
                          </div>
                        </div>
                        <div className="flex-1 w-full flex flex-col gap-2">
                          <span className="font-poppins font-medium text-[12px] leading-[20px] tracking-[1.5px] uppercase text-[#111111]">
                            date
                          </span>
                          <div className="h-[41.6px] bg-white border border-[#C6C6CB] rounded-[8px] px-3 font-poppins text-sm text-[#111111] flex items-center w-full">
                            {leave.date}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLeaves(leaves.filter((_, i) => i !== idx))}
                          className="w-full sm:w-auto h-[41.6px] sm:h-[32px] px-4 bg-gradient-to-b from-[rgba(12,192,223,0.2)] to-[rgba(12,192,223,0.2)] bg-[#8EBAC5] rounded hover:opacity-90 transition-opacity text-sm font-medium text-[#111111] cursor-pointer flex items-center justify-center font-poppins shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-row justify-end items-center gap-[12px] w-full h-[34px] mt-6">
              {editingStaffId !== null && (
                <button
                  type="button"
                  onClick={handleDeleteStaff}
                  className="h-[34px] px-4 bg-[#FCDDEC] text-[#DE350B] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#FBCFE8] transition-colors cursor-pointer flex items-center justify-center"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setStaffName("");
                  setStaffEmail("");
                  setStaffPhone("");
                  setEditingStaffId(null);
                  setPhotoPreview(null);
                  setIsAdding(false);
                }}
                className="h-[34px] px-4 bg-[#EBEBEB] text-[#757575] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#E2E2E2] transition-colors cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddStaff}
                className="h-[34px] px-4 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer flex items-center justify-center"
              >
                Save changes
              </button>
            </div>

          </div>
        
        </div></main>
    );
  }

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-[#FCF8F8] md: select-none font-poppins relative">
      <DashboardHeader title="Staff" subtitle="Team members, hours, and service assignments" />
      <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6">

        {/* Control row: Stats pill & Create Service button */}
        <div className="flex justify-between items-center w-full mb-5 gap-4">
          <div className="bg-white border border-[#F5F5F4] rounded-full py-2 px-4 shadow-sm flex items-center gap-2.5 text-sm font-medium">
            <span className="w-1.5 h-1.5 bg-[#1D9E75] rounded-full" />
            <span className="text-[#1F8900]">{staffMembers.length} staff members</span>
            <span className="text-neutral-300">•</span>
            <span className="text-[#79716B]">each with their own calendar</span>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="bg-[#111111] hover:bg-black text-white text-[13px] font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all cursor-pointer"
          >
            <HugeiconsIcon icon={PlusIcon} className="w-3.5 h-3.5" />
            <span>Add Staff member</span>
          </button>
        </div>

        {/* Staff Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full mb-8">
          {staffMembers.map((staff) => (
            <StaffCard
              key={staff.id}
              staff={staff}
              onToggleStatus={toggleStaffStatus}
              onEdit={handleEditStaff}
              canEdit={staff.role !== "Owner"}
            />
          ))}
        </div>

        {/* Info Alert Box */}
        <div className="bg-[#FAFAF9] border border-[#E8E8E4]/60 rounded-xl p-4 flex items-center gap-3 w-full mb-6">
          <HugeiconsIcon icon={InformationCircleIcon} className="w-5 h-5 text-[#888780] shrink-0" />
          <span className="text-xs text-[#757575] font-poppins">Default password of the supervisor, and staff is 123456, they can change it after you have added them to the system.</span>
        </div>

        {/* Staff Availability Table */}
        <StaffAvailabilityTable />
      </div>
    </main>
  );
}
