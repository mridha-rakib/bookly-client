"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLocationStore, resolveBusinessCity } from "@/lib/location/store";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Location05Icon,
  Clock01Icon,
  ArrowRight02Icon,
  ArrowLeft02Icon,
} from "@hugeicons/core-free-icons";

interface SearchBarProps {
  onSearch?: (searchQuery: string, locationQuery: string, selectedTime: string) => void;
  className?: string;
}

export default function SearchBar({ onSearch, className = "" }: SearchBarProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");

  // Batch 17 — the picked city is the real signal behind the homepage "Services near you" row.
  const setSelectedCity = useLocationStore((state) => state.setSelectedCity);
  // Resolve whatever is currently in the location field to a real BusinessCity (or clear it).
  const syncSelectedCity = (value: string) => setSelectedCity(resolveBusinessCity(value));

  // Time selector states
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState("Any Time");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 7, 17)); // Default to Aug 17, 2026
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(7); // August (0-indexed)
  const [selectedTimeOption, setSelectedTimeOption] = useState<"Any time" | "Morning" | "Afternoon" | "Evening" | "Custom">("Any time");
  const [customStartTime, setCustomStartTime] = useState("04:00");
  const [customStartAmPm, setCustomStartAmPm] = useState<"AM" | "PM">("PM");
  const [customEndTime, setCustomEndTime] = useState("04:00");
  const [customEndAmPm, setCustomEndAmPm] = useState<"AM" | "PM">("PM");

  const [currentLocationActive, setCurrentLocationActive] = useState(false);

  // Search dropdown states
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState("All");
  const [activeSegment, setActiveSegment] = useState<"search" | "location" | "time" | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<"search" | "location" | "time" | null>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const timeSelectorRef = useRef<HTMLDivElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState<number | null>(null);

  useEffect(() => {
    let frameId: number;
    const updateWidth = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        if (searchBarRef.current && timeSelectorRef.current) {
          const searchRect = searchBarRef.current.getBoundingClientRect();
          const timeRect = timeSelectorRef.current.getBoundingClientRect();
          const width = (timeRect.left + timeRect.width / 2) - searchRect.left;
          setDropdownWidth(width);
        }
      });
    };

    updateWidth();
    window.addEventListener("resize", updateWidth, { passive: true });
    const timer = setTimeout(updateWidth, 100);

    return () => {
      window.removeEventListener("resize", updateWidth);
      clearTimeout(timer);
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [showSearchDropdown]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (searchBarRef.current && !searchBarRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
        setShowTimePicker(false);
        setActiveSegment(null);
      } else if (timeSelectorRef.current && !timeSelectorRef.current.contains(event.target as Node)) {
        setShowTimePicker(false);
        setActiveSegment((prev) => (prev === "time" ? null : prev));
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // Calendar helper functions
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getFormattedHeaderDate = (date: Date) => {
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${weekdays[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const updateSelectedTimeDisplay = (
    date: Date,
    option: "Any time" | "Morning" | "Afternoon" | "Evening" | "Custom",
    startTime?: string,
    startAmPm?: string,
    endTime?: string,
    endAmPm?: string
  ) => {
    const formattedDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const currentStart = startTime || customStartTime;
    const currentStartAmPm = startAmPm || customStartAmPm;
    const currentEnd = endTime || customEndTime;
    const currentEndAmPm = endAmPm || customEndAmPm;

    if (option === "Custom") {
      setSelectedTime(`${formattedDate}, ${currentStart} ${currentStartAmPm} - ${currentEnd} ${currentEndAmPm}`);
    } else {
      setSelectedTime(`${formattedDate}, ${option}`);
    }
  };

  return (
    <div className={`w-full max-w-[900px] flex flex-col items-center ${className}`}>
      {/* Search Bar container */}
      <div 
        ref={searchBarRef} 
        className={`w-full rounded-2xl md:rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.05)] border border-[#E8E6FF] p-2 md:p-3 flex flex-col md:flex-row items-center gap-2 md:gap-0 relative transition-colors duration-300 ${activeSegment !== null ? "bg-[#F2F2F2]" : "bg-white"
        } ${showSearchDropdown ? "z-[200]" : "z-30"}`}
      >
        {/* Search Input */}
        <div
          onMouseEnter={() => setHoveredSegment("search")}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`flex-1 w-full flex items-center gap-3 px-6 py-2.5 md:py-1.5 transition-all duration-300 ${activeSegment === "search"
              ? "bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] rounded-full z-10"
              : activeSegment !== null
                ? "hover:bg-black/5 rounded-full"
                : "hover:bg-[#F2F2F2] rounded-full"
            }`}
        >
          <HugeiconsIcon icon={Search01Icon} className="text-[#111111]" />
          <input
            type="text"
            placeholder="What are you looking for"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              setShowSearchDropdown(true);
              setActiveSegment("search");
              setShowTimePicker(false);
            }}
            className="w-full h-10 text-sm text-[#1C1B1C] placeholder-[#757575] bg-transparent outline-none font-medium"
          />
        </div>

        {/* Divider 1 */}
        {activeSegment !== "search" && activeSegment !== "location" && hoveredSegment !== "search" && hoveredSegment !== "location" && (
          <div className="hidden md:block w-[1px] h-8 bg-[#EBEBEB]" />
        )}

        {/* Location Selector */}
        <div
          onMouseEnter={() => setHoveredSegment("location")}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`relative flex-1 w-full flex items-center gap-3 px-6 py-2.5 md:py-1.5 transition-all duration-300 ${activeSegment === "location"
              ? "bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] rounded-full z-10"
              : activeSegment !== null
                ? "hover:bg-black/5 rounded-full"
                : "hover:bg-[#F2F2F2] rounded-full"
            }`}
        >
          <HugeiconsIcon icon={Location05Icon} className="text-[#111111]" />
          <input
            type="text"
            placeholder="Anywhere in Cyprus"
            value={locationQuery}
            onChange={(e) => { setLocationQuery(e.target.value); syncSelectedCity(e.target.value); }}
            onFocus={() => {
              setActiveSegment("location");
              setShowTimePicker(false);
              setShowSearchDropdown(false);
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                setShowSearchDropdown(true);
              }
            }}
            className="w-full h-10 text-sm text-[#1C1B1C] placeholder-[#757575] bg-transparent outline-none font-medium"
          />

          {/* Location Dropdown (Desktop) */}
          {activeSegment === "location" && (
            <div className="hidden md:flex absolute top-[110%] left-0 w-[350px] h-[590px] p-5 bg-white rounded-[12px] shadow-2xl z-50 border border-neutral-200/80 flex-col gap-[40px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 font-poppins text-left">
              <div className="flex flex-row justify-between items-center w-[310px] h-10 shrink-0 gap-[83px]">
                <span className="font-poppins font-medium text-[18px] leading-[26px] text-[#111111] select-none">Current Location</span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentLocationActive(!currentLocationActive);
                    if (!currentLocationActive) {
                      setLocationQuery("Current location");
                      setSelectedCity(null);
                    } else {
                      setLocationQuery("");
                    }
                  }}
                  className={`w-[78px] h-10 rounded-[20px] flex items-center transition-all duration-300 ${currentLocationActive ? "pl-[40px] pr-[6px] bg-[#3586B8]" : "pl-[6px] pr-[40px] bg-[#D3D3D3]"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[rgba(0,0,0,0.2)] transition-all duration-200" />
                </button>
              </div>

              <div className="flex flex-col items-start gap-[12px] w-[310px] shrink-0">
                {[
                  "Larnaca, Cyprus",
                  "Limassol, Cyprus",
                  "Pafos, Cyprus",
                  "Nicosia, Cyprus",
                  "Ayia Napa, Cyprus",
                  "Protaras, Cyprus"
                ].map((loc, index, arr) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      setLocationQuery(loc);
                      syncSelectedCity(loc);
                      setActiveSegment(null);
                    }}
                    className="w-[310px] flex flex-col items-start gap-[12px] group cursor-pointer border-0 bg-transparent text-left"
                  >
                    <div className="flex flex-row items-center gap-[16px] w-[310px] h-[30px]">
                      <HugeiconsIcon icon={Location05Icon} className="text-[#0C0C0C] w-6 h-6 shrink-0" />
                      <span className="font-poppins font-medium text-[18px] leading-[30px] text-[#111111] group-hover:text-neutral-600 transition-colors">
                        {loc}
                      </span>
                    </div>
                    {index < arr.length - 1 && (
                      <div className="w-[310px] h-0 border-t border-[#ACAAB4]" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-start gap-[16px] w-[310px] shrink-0">
                <span className="font-poppins font-medium text-[18px] leading-[30px] text-[#111111] select-none">Recent</span>
                <div className="flex flex-col items-start gap-[12px] w-[310px]">
                  {[
                    "Pafos, Cyprus",
                    "Limassol, Cyprus"
                  ].map((loc, index, arr) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setLocationQuery(loc);
                      syncSelectedCity(loc);
                        setActiveSegment(null);
                      }}
                      className="w-[310px] flex flex-col items-start gap-[12px] group cursor-pointer border-0 bg-transparent text-left"
                    >
                      <div className="flex flex-row items-center gap-[16px] w-[310px] h-[30px]">
                        <HugeiconsIcon icon={Location05Icon} className="text-[#0C0C0C] w-6 h-6 shrink-0" />
                        <span className="font-poppins font-medium text-[18px] leading-[30px] text-[#111111] group-hover:text-neutral-600 transition-colors">
                          {loc}
                        </span>
                      </div>
                      {index < arr.length - 1 && (
                        <div className="w-[310px] h-0 border-t border-[#ACAAB4]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider 2 */}
        {activeSegment !== "location" && activeSegment !== "time" && hoveredSegment !== "location" && hoveredSegment !== "time" && (
          <div className="hidden md:block w-[1px] h-8 bg-[#EBEBEB]" />
        )}

        {/* Time Selector */}
        <div
          ref={timeSelectorRef}
          onMouseEnter={() => setHoveredSegment("time")}
          onMouseLeave={() => setHoveredSegment(null)}
          className={`relative flex-1 w-full flex items-center justify-between px-6 py-2.5 md:py-1.5 md:mr-2 transition-all duration-300 ${activeSegment === "time"
              ? "bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] rounded-full z-10"
              : activeSegment !== null
                ? "hover:bg-black/5 rounded-full"
                : "hover:bg-[#F2F2F2] rounded-full"
            }`}
        >
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.innerWidth < 768) {
                setShowSearchDropdown(true);
                setActiveSegment("time");
                setShowTimePicker(false);
              } else {
                const nextVal = !showTimePicker;
                setShowTimePicker(nextVal);
                if (nextVal) {
                  setShowSearchDropdown(false);
                  setActiveSegment("time");
                } else {
                  setActiveSegment(null);
                }
              }
            }}
            className="w-full flex items-center gap-3 text-left py-2 text-sm text-[#757575] hover:text-[#1C1B1C] transition-colors cursor-pointer border-0 bg-transparent"
          >
            <HugeiconsIcon icon={Clock01Icon} className="text-[#111111]" />
            <span className="text-[#1C1B1C] font-medium truncate">{selectedTime === "Any Time" ? "Anytime" : selectedTime}</span>
          </button>

          {/* Time Picker Popup Dropdown */}
          {showTimePicker && (
            <div className="hidden md:flex absolute top-[110%] right-[-100px] md:right-[-250px] w-[95vw] max-w-[812px] md:w-[812px] md:h-[704px] p-5 bg-white rounded-[12px] shadow-2xl z-50 border border-neutral-200/80 animate-in fade-in slide-in-from-top-2 duration-200 flex-col gap-10 overflow-y-auto font-roboto">
              <div className="flex flex-col items-start gap-4 w-full">
                <div className="flex flex-row justify-between items-center w-full py-1">
                  <div className="flex items-center gap-1 cursor-pointer">
                    <span className="font-roboto font-medium text-sm text-[#111111]">{months[currentMonth]} {currentYear}</span>
                    <svg className="w-4 h-4 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-0">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
                    >
                      <svg className="w-6 h-6 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-neutral-100 transition-colors"
                    >
                      <svg className="w-6 h-6 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="w-full pt-0 pr-3 pb-3 pl-6 border-b border-[#CAC4D0]">
                  <h3 className="font-roboto font-normal text-[32px] leading-10 text-[#111111] text-left">
                    {getFormattedHeaderDate(selectedDate)}
                  </h3>
                </div>

                <div className="grid grid-cols-7 w-full text-center px-3">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, index) => (
                    <span key={index} className="font-roboto font-normal text-base leading-6 text-[#111111] py-2">{d}</span>
                  ))}
                </div>

                {(() => {
                  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
                  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
                  const cells = [];
                  for (let i = 0; i < firstDay; i++) {
                    cells.push(<div key={`empty-${i}`} className="w-10 h-10" />);
                  }
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateObj = new Date(currentYear, currentMonth, day);
                    const isSelected = selectedDate &&
                      selectedDate.getDate() === day &&
                      selectedDate.getMonth() === currentMonth &&
                      selectedDate.getFullYear() === currentYear;

                    cells.push(
                      <div key={`day-${day}`} className="h-10 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(dateObj);
                            updateSelectedTimeDisplay(dateObj, selectedTimeOption);
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-full font-roboto text-base transition-colors ${isSelected
                              ? "bg-[#666666] text-white font-medium"
                              : "text-[#111111] hover:bg-neutral-100"
                            }`}
                        >
                          {day}
                        </button>
                      </div>
                    );
                  }
                  return <div className="grid grid-cols-7 w-full text-center gap-y-1 px-3">{cells}</div>;
                })()}
              </div>

              <div className="flex flex-col items-start gap-4 w-full mt-auto pt-4 border-t border-neutral-100">
                <div className="flex flex-row items-center justify-between w-full">
                  <span className="font-roboto font-bold text-sm text-[#111111] shrink-0">Select time</span>
                  <div className="flex flex-row items-center justify-between flex-1 ml-10">
                    {[
                      { id: "Any time", label: "Any time", sub: "" },
                      { id: "Morning", label: "Morning", sub: "9am - 12pm" },
                      { id: "Afternoon", label: "Afternoon", sub: "12pm - 5pm" },
                      { id: "Evening", label: "Evening", sub: "5pm - 12am" }
                    ].map((opt) => {
                      const isActive = selectedTimeOption === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedTimeOption(opt.id as any);
                            updateSelectedTimeDisplay(selectedDate, opt.id as any);
                          }}
                          className={`flex flex-col items-center justify-center transition-all ${isActive
                              ? "border border-[#3A506B] rounded-xl px-5 py-2.5 bg-white text-[#111111] font-bold shadow-sm"
                              : "border border-transparent text-[#4A607A] hover:bg-neutral-50 p-2"
                            }`}
                        >
                          <span className="text-sm font-semibold">{opt.label}</span>
                          {opt.sub && <span className={`text-xs ${isActive ? 'text-[#111111] font-semibold' : 'text-[#7A8B9E]'}`}>{opt.sub}</span>}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTimeOption("Custom");
                        updateSelectedTimeDisplay(selectedDate, "Custom");
                      }}
                      className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${selectedTimeOption === "Custom"
                          ? "bg-[#666666] text-white"
                          : "bg-[#E8EAEF] text-[#111111] hover:bg-neutral-200"
                        }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {selectedTimeOption === "Custom" && (
                  <div className="w-full mt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <h4 className="font-roboto font-bold text-sm text-[#111111]">Custom Time</h4>
                    <div className="flex flex-row gap-6 w-full">
                      <div className="flex-grow flex flex-col gap-2">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Start Time</span>
                        <div className="flex items-center gap-3 px-4 py-2.5 border border-neutral-300 rounded-xl bg-white">
                          <HugeiconsIcon icon={Clock01Icon} className="text-neutral-500 w-5 h-5" />
                          <input
                            type="text"
                            value={customStartTime}
                            onChange={(e) => {
                              setCustomStartTime(e.target.value);
                              updateSelectedTimeDisplay(selectedDate, "Custom", e.target.value, customStartAmPm, customEndTime, customEndAmPm);
                            }}
                            className="w-16 text-sm text-[#1C1B1C] bg-transparent outline-none font-medium text-left"
                          />
                          <div className="flex bg-[#E8EAEF] rounded-full p-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomStartAmPm("AM");
                                updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, "AM", customEndTime, customEndAmPm);
                              }}
                              className={`w-9 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${customStartAmPm === "AM" ? "bg-[#666666] text-white shadow-sm" : "text-neutral-500"}`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomStartAmPm("PM");
                                updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, "PM", customEndTime, customEndAmPm);
                              }}
                              className={`w-9 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${customStartAmPm === "PM" ? "bg-[#666666] text-white shadow-sm" : "text-neutral-500"}`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex-grow flex flex-col gap-2">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">End Time</span>
                        <div className="flex items-center gap-3 px-4 py-2.5 border border-neutral-300 rounded-xl bg-white">
                          <HugeiconsIcon icon={Clock01Icon} className="text-neutral-500 w-5 h-5" />
                          <input
                            type="text"
                            value={customEndTime}
                            onChange={(e) => {
                              setCustomEndTime(e.target.value);
                              updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, customStartAmPm, e.target.value, customEndAmPm);
                            }}
                            className="w-16 text-sm text-[#1C1B1C] bg-transparent outline-none font-medium text-left"
                          />
                          <div className="flex bg-[#E8EAEF] rounded-full p-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomEndAmPm("AM");
                                updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, customStartAmPm, customEndTime, "AM");
                              }}
                              className={`w-9 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${customEndAmPm === "AM" ? "bg-[#666666] text-white shadow-sm" : "text-neutral-500"}`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomEndAmPm("PM");
                                updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, customStartAmPm, customEndTime, "PM");
                              }}
                              className={`w-9 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${customEndAmPm === "PM" ? "bg-[#666666] text-white shadow-sm" : "text-neutral-500"}`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Search Action Button */}
        <button
          type="button"
          className="w-full md:w-auto bg-[#1C1B1C] hover:bg-black text-white px-6 py-3 rounded-xl md:rounded-full flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 cursor-pointer shrink-0 active:scale-95"
          onClick={() => {
            if (onSearch) {
              onSearch(searchQuery, locationQuery, selectedTime);
            }
            setShowSearchDropdown(false);
            setShowTimePicker(false);
            setActiveSegment(null);
          }}
        >
          <span>Search</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>


      {/* Search Results Dropdown Overlay */}
      {showSearchDropdown && (
        <>
          {/* Desktop Dropdown */}
          <div
            style={dropdownWidth ? { width: `${dropdownWidth}px` } : undefined}
            className="hidden md:flex absolute top-[105%] left-0 w-full md:w-[761px] max-h-[40vh] md:max-h-[500px] overflow-y-auto bg-white rounded-xl shadow-2xl p-6 md:p-10 flex-col items-start gap-10 z-50 text-left border border-neutral-200/80 animate-in fade-in slide-in-from-top-4 duration-300 search-dropdown-scrollbar font-poppins"
          >
            <div className="flex flex-row flex-wrap items-center gap-2 w-full pb-2 border-b border-neutral-100">
              {[
                { id: "All", label: "All" },
                { id: "Nearby", label: "Nearby" },
                { id: "Trending", label: "Trending" },
                { id: "Recents", label: "Recents" },
                { id: "Services", label: "Services" },
                { id: "We come to you", label: "We come to you" }
              ].map((pill) => {
                const isActive = dropdownFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setDropdownFilter(pill.id)}
                    className={`flex flex-row justify-center items-center py-1.5 px-6 gap-2.5 h-8 rounded-full font-poppins font-medium text-xs tracking-[0.7px] transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${isActive
                        ? "bg-[#111111] text-white border-transparent"
                        : "border border-[#111111] text-[#111111] hover:bg-neutral-50"
                      }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {(dropdownFilter === "All" || dropdownFilter === "Trending") && (
              <div className="flex flex-col items-start p-0 gap-5 w-full">
                <h3 className="font-poppins font-medium text-lg leading-[22px] tracking-[0.01em] text-[#111111]">
                  Trending searches
                </h3>
                <div className="flex flex-row flex-wrap items-start content-start p-0 gap-2 w-full">
                  {[
                    "Hair Salon",
                    "Physiotherapy",
                    "Massage",
                    "Car dealing",
                    "Photography",
                    "Tennis Lesson"
                  ].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSearchQuery(item);
                        setShowSearchDropdown(false);
                        setActiveSegment(null);
                      }}
                      className="flex flex-row justify-center items-center py-1.5 px-6 gap-2.5 h-8 border border-[#111111] rounded-full text-[#111111] font-poppins font-medium text-xs tracking-[0.7px] whitespace-nowrap hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(dropdownFilter === "All" || dropdownFilter === "We come to you" || dropdownFilter === "Nearby") && (
              <div className="flex flex-col items-start p-0 gap-5 w-full">
                <div className="flex flex-col items-start p-0 gap-4 w-full">
                  {dropdownFilter !== "We come to you" && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("Hair & styling");
                        setShowSearchDropdown(false);
                        setActiveSegment(null);
                      }}
                      className="flex flex-row items-center p-0 gap-6 w-full text-left hover:bg-neutral-50/50 p-2 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                    >
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        <HugeiconsIcon icon={Search01Icon} className="text-[#111111] w-5 h-5" />
                      </div>
                      <div className="flex flex-col justify-center items-start p-0">
                        <span className="font-poppins font-normal text-sm leading-[22px] tracking-[0.01em] text-[#111111]">
                          Hair & styling
                        </span>
                        <span className="font-poppins font-normal text-[10px] leading-[10px] tracking-[0.01em] text-[#757575]">
                          Founding Partner
                        </span>
                      </div>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("Hair & styling");
                      setShowSearchDropdown(false);
                      setActiveSegment(null);
                    }}
                    className="flex flex-row items-center p-0 gap-6 w-full text-left hover:bg-neutral-50/50 p-2 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                  >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10H8V6c0-1.1-.9-2-2-2H2v13h2" />
                        <circle cx="7" cy="18" r="2" />
                        <circle cx="17" cy="18" r="2" />
                        <path d="M13 6h3l4 4v3h-7V6z" />
                      </svg>
                    </div>
                    <div className="flex flex-col justify-center items-start p-0">
                      <span className="font-poppins font-normal text-sm leading-[22px] tracking-[0.01em] text-[#111111]">
                        Hair & styling
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {(dropdownFilter === "All" || dropdownFilter === "Recents" || dropdownFilter === "Nearby") && (
              <div className="flex flex-col items-start p-0 gap-5 w-full">
                <h3 className="font-poppins font-medium text-lg leading-[22px] tracking-[0.01em] text-[#111111]">
                  Recents
                </h3>
                <div className="flex flex-col items-start p-0 gap-4 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("Hair & styling");
                      setLocationQuery("Larnaca");
                      syncSelectedCity("Larnaca");
                      setSelectedTime("Any Time");
                      setShowSearchDropdown(false);
                      setActiveSegment(null);
                    }}
                    className="flex flex-row items-center p-0 gap-6 w-full text-left hover:bg-neutral-50/50 p-2 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                  >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      <HugeiconsIcon icon={Search01Icon} className="text-[#111111] w-5 h-5" />
                    </div>
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-poppins font-normal text-sm leading-[22px] tracking-[0.01em] text-[#111111]">
                        Hair & styling
                      </span>
                      <div className="flex items-center gap-1 text-[#757575] text-xs">
                        <span>Larnaca</span>
                        <span className="w-1 h-1 rounded-full bg-[#757575]"></span>
                        <span>Any time</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Fullscreen Search Modal Overlay */}
          <div className="md:hidden fixed inset-0 bg-white z-[300] flex flex-col p-5 animate-in fade-in slide-in-from-bottom duration-300 font-poppins">
            <div className="flex items-center gap-4 mb-5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowSearchDropdown(false);
                  setActiveSegment(null);
                }}
                className="p-2 hover:bg-neutral-100 rounded-full transition-colors cursor-pointer border-0 bg-transparent text-left"
              >
                <svg className="w-6 h-6 text-neutral-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h2 className="text-2xl font-bold text-neutral-900 font-poppins">
                {activeSegment === "location" ? "Location" : activeSegment === "time" ? "Select Time" : "Search"}
              </h2>
            </div>

            {activeSegment === "location" ? (
              <div className="flex-1 flex flex-col gap-[40px] overflow-y-auto font-poppins text-left px-1">
                <div className="flex items-center gap-[16px] px-4 py-1 border border-neutral-300 rounded-xl mb-1 shrink-0 bg-white">
                  <HugeiconsIcon icon={Location05Icon} className="text-[#0C0C0C] w-6 h-6 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search location"
                    value={locationQuery}
                    onChange={(e) => { setLocationQuery(e.target.value); syncSelectedCity(e.target.value); }}
                    className="w-full h-10 text-sm text-[#1C1B1C] placeholder-[#757575] bg-transparent outline-none font-medium"
                  />
                </div>

                <div className="flex flex-row justify-between items-center w-full h-10 shrink-0 border-b border-neutral-100 pb-4">
                  <span className="font-poppins font-medium text-[18px] leading-[26px] text-[#111111] select-none">Current Location</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentLocationActive(!currentLocationActive);
                      if (!currentLocationActive) {
                        setLocationQuery("Current location");
                      setSelectedCity(null);
                      } else {
                        setLocationQuery("");
                      }
                    }}
                    className={`w-[78px] h-10 rounded-[20px] flex items-center transition-all duration-300 ${currentLocationActive ? "pl-[40px] pr-[6px] bg-[#3586B8]" : "pl-[6px] pr-[40px] bg-[#D3D3D3]"}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[rgba(0,0,0,0.2)] transition-all duration-200" />
                  </button>
                </div>

                <div className="flex flex-col items-start gap-[12px] w-full shrink-0">
                  {[
                    "Larnaca, Cyprus",
                    "Limassol, Cyprus",
                    "Pafos, Cyprus",
                    "Nicosia, Cyprus",
                    "Ayia Napa, Cyprus",
                    "Protaras, Cyprus"
                  ].map((loc, index, arr) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setLocationQuery(loc);
                      syncSelectedCity(loc);
                        setShowSearchDropdown(false);
                        setActiveSegment(null);
                      }}
                      className="w-full flex flex-col items-start gap-[12px] group cursor-pointer border-0 bg-transparent text-left"
                    >
                      <div className="flex flex-row items-center gap-[16px] w-full h-[30px]">
                        <HugeiconsIcon icon={Location05Icon} className="text-[#0C0C0C] w-6 h-6 shrink-0" />
                        <span className="font-poppins font-medium text-[18px] leading-[30px] text-[#111111] group-hover:text-neutral-600 transition-colors">
                          {loc}
                        </span>
                      </div>
                      {index < arr.length - 1 && (
                        <div className="w-full h-0 border-t border-[#ACAAB4]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ) : activeSegment === "time" ? (
              <div className="flex-1 flex flex-col gap-6 overflow-y-auto font-roboto text-left pb-10">
                <div className="flex flex-row justify-between items-center w-full py-1 shrink-0">
                  <div className="flex items-center gap-1 cursor-pointer">
                    <span className="font-roboto font-medium text-sm text-[#111111]">{months[currentMonth]} {currentYear}</span>
                    <svg className="w-4 h-4 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <div className="flex items-center gap-0">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100"
                    >
                      <svg className="w-5 h-5 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-100"
                    >
                      <svg className="w-5 h-5 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="w-full pt-0 pr-3 pb-3 pl-6 border-b border-[#CAC4D0] shrink-0">
                  <h3 className="font-roboto font-normal text-[32px] leading-10 text-[#111111] text-left">
                    {getFormattedHeaderDate(selectedDate)}
                  </h3>
                </div>

                <div className="grid grid-cols-7 w-full text-center px-3 shrink-0">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, index) => (
                    <span key={index} className="font-roboto font-normal text-base leading-6 text-[#111111] py-2">{d}</span>
                  ))}
                </div>

                {(() => {
                  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
                  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
                  const cells = [];
                  for (let i = 0; i < firstDay; i++) {
                    cells.push(<div key={`empty-${i}`} className="w-10 h-10" />);
                  }
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateObj = new Date(currentYear, currentMonth, day);
                    const isSelected = selectedDate &&
                      selectedDate.getDate() === day &&
                      selectedDate.getMonth() === currentMonth &&
                      selectedDate.getFullYear() === currentYear;

                    cells.push(
                      <div key={`day-${day}`} className="h-10 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(dateObj);
                            updateSelectedTimeDisplay(dateObj, selectedTimeOption);
                          }}
                          className={`w-10 h-10 flex items-center justify-center rounded-full font-roboto text-base transition-colors ${isSelected
                              ? "bg-[#666666] text-white font-medium"
                              : "text-[#111111]"
                            }`}
                        >
                          {day}
                        </button>
                      </div>
                    );
                  }
                  return <div className="grid grid-cols-7 w-full text-center gap-y-1 px-3 shrink-0">{cells}</div>;
                })()}

                <div className="flex flex-col items-start gap-4 w-full mt-6 pt-4 border-t border-neutral-100 shrink-0">
                  <span className="font-roboto font-bold text-sm text-[#111111]">Select time</span>
                  <div className="flex flex-col gap-3 w-full">
                    {[
                      { id: "Any time", label: "Any time", sub: "" },
                      { id: "Morning", label: "Morning", sub: "9am - 12pm" },
                      { id: "Afternoon", label: "Afternoon", sub: "12pm - 5pm" },
                      { id: "Evening", label: "Evening", sub: "5pm - 12am" }
                    ].map((opt) => {
                      const isActive = selectedTimeOption === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSelectedTimeOption(opt.id as any);
                            updateSelectedTimeDisplay(selectedDate, opt.id as any);
                          }}
                          className={`w-full flex flex-row items-center justify-between py-3 px-4 border rounded-xl text-left ${isActive
                              ? "border-[#3A506B] bg-[#E8EAEF]/30 text-[#111111] font-bold"
                              : "border-neutral-200 text-[#4A607A]"
                            }`}
                        >
                          <span className="text-sm font-semibold">{opt.label}</span>
                          {opt.sub && <span className="text-xs text-[#7A8B9E]">{opt.sub}</span>}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTimeOption("Custom");
                        updateSelectedTimeDisplay(selectedDate, "Custom");
                      }}
                      className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${selectedTimeOption === "Custom"
                          ? "bg-[#666666] text-white"
                          : "bg-[#E8EAEF] text-[#111111]"
                        }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {selectedTimeOption === "Custom" && (
                  <div className="w-full mt-4 flex flex-col gap-4 shrink-0">
                    <h4 className="font-roboto font-bold text-sm text-[#111111]">Custom Time</h4>
                    <div className="flex flex-col gap-4 w-full">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Start Time</span>
                        <div className="flex items-center gap-3 px-4 py-3 border border-neutral-300 rounded-xl bg-white">
                          <HugeiconsIcon icon={Clock01Icon} className="text-neutral-500 w-5 h-5" />
                          <input
                            type="text"
                            value={customStartTime}
                            onChange={(e) => {
                              setCustomStartTime(e.target.value);
                              updateSelectedTimeDisplay(selectedDate, "Custom", e.target.value, customStartAmPm, customEndTime, customEndAmPm);
                            }}
                            className="w-16 text-sm text-[#1C1B1C] bg-transparent outline-none font-medium"
                          />
                          <div className="flex bg-[#E8EAEF] rounded-full p-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomStartAmPm("AM");
                                updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, "AM", customEndTime, customEndAmPm);
                              }}
                              className={`w-9 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${customStartAmPm === "AM" ? "bg-[#666666] text-white" : "text-neutral-500"}`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomStartAmPm("PM");
                                updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, "PM", customEndTime, customEndAmPm);
                              }}
                              className={`w-9 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${customStartAmPm === "PM" ? "bg-[#666666] text-white" : "text-neutral-500"}`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">End Time</span>
                        <div className="flex items-center gap-3 px-4 py-3 border border-neutral-300 rounded-xl bg-white">
                          <HugeiconsIcon icon={Clock01Icon} className="text-neutral-500 w-5 h-5" />
                          <input
                            type="text"
                            value={customEndTime}
                            onChange={(e) => {
                              setCustomEndTime(e.target.value);
                              updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, customStartAmPm, e.target.value, customEndAmPm);
                            }}
                            className="w-16 text-sm text-[#1C1B1C] bg-transparent outline-none font-medium"
                          />
                          <div className="flex bg-[#E8EAEF] rounded-full p-1 ml-auto">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomEndAmPm("AM");
                                updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, customStartAmPm, customEndTime, "AM");
                              }}
                              className={`w-9 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${customEndAmPm === "AM" ? "bg-[#666666] text-white" : "text-neutral-500"}`}
                            >
                              AM
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomEndAmPm("PM");
                                updateSelectedTimeDisplay(selectedDate, "Custom", customStartTime, customStartAmPm, customEndTime, "PM");
                              }}
                              className={`w-9 h-7 flex items-center justify-center text-xs font-semibold rounded-full transition-all ${customEndAmPm === "PM" ? "bg-[#666666] text-white" : "text-neutral-500"}`}
                            >
                              PM
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-6 overflow-y-auto px-1 text-left font-poppins">
                <div className="flex flex-col gap-2 w-full pb-3 border-b border-neutral-100">
                  <span className="font-poppins font-medium text-xs tracking-wider text-neutral-400 uppercase">Filters</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["All", "Nearby", "Trending", "Recents", "Services", "We come to you"].map((pill) => (
                      <button
                        key={pill}
                        type="button"
                        onClick={() => setDropdownFilter(pill)}
                        className={`py-1 px-4 rounded-full text-xs font-semibold border ${dropdownFilter === pill ? "bg-black border-black text-white" : "bg-white border-neutral-200 text-neutral-800"}`}
                      >
                        {pill}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4 w-full">
                  <span className="font-poppins font-medium text-xs tracking-wider text-neutral-400 uppercase">Trending searches</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["Hair Salon", "Physiotherapy", "Massage", "Car dealing", "Photography", "Tennis Lesson"].map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setSearchQuery(item);
                          setShowSearchDropdown(false);
                          setActiveSegment(null);
                        }}
                        className="py-1 px-4 rounded-full text-xs font-semibold border border-neutral-200 bg-white text-neutral-800"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="w-full pt-4 mt-auto border-t border-neutral-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (onSearch) {
                    onSearch(searchQuery, locationQuery, selectedTime);
                  }
                  setShowSearchDropdown(false);
                  setShowTimePicker(false);
                  setActiveSegment(null);
                }}
                className="w-full py-3.5 bg-[#1C1B1C] hover:bg-black text-white rounded-full font-poppins font-semibold text-sm flex items-center justify-center gap-2"
              >
                <span>Search</span>
                <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
              </button>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
