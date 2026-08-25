"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { contactApi } from "@/lib/api/contact";
import { toUserMessage } from "@/lib/auth/messages";

export default function ContactSupportPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    setErrorMsg("");
    setIsSubmitting(true);
    try {
      await contactApi.submit({ name, email, subject, message });
      setIsSubmitted(true);
    } catch (error) {
      setErrorMsg(toUserMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFAF9] flex flex-col font-manrope text-[#1C1B1C]">
      <Navbar
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <main className="flex-1 w-full flex items-center justify-center py-16 px-4">
        
        {isSubmitted ? (
          /* SUCCESS SUBMISSION CARD */
          <div className="w-full max-w-[661px] bg-white rounded-xl p-10 flex flex-col items-center justify-center text-center shadow-md border border-neutral-100 gap-10 animate-in fade-in duration-300">
            
            <div className="flex flex-col items-center gap-6 w-full max-w-[581px]">
              {/* Teal Checkmark Circle */}
              <div className="w-[76px] h-[76px] flex items-center justify-center bg-[#9BCAD6] border-2 border-[#3586B8] rounded-full shrink-0">
                <svg className="w-12 h-12 text-[#1A5A60]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="font-poppins font-medium text-[28px] leading-[36px] text-[#262626]">
                Submitted
              </h2>
              
              <p className="font-poppins font-normal text-[18px] leading-[30px] text-[#000000]">
                Thank you for message. We will contact you within 48 hours!
              </p>
            </div>

            <button
              onClick={() => {
                setIsSubmitted(false);
                setName("");
                setEmail("");
                setSubject("");
                setMessage("");
              }}
              className="w-full max-w-[176px] h-12 flex items-center justify-center bg-[#9BCAD6] text-[#111111] font-poppins font-medium text-base rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              Go Back
            </button>

          </div>
        ) : (
          /* SUPPORT FORM CARD */
          <form 
            onSubmit={handleSubmit}
            className="w-full max-w-[816px] bg-[#F8FAFC] border border-[#F1F5F9] rounded-2xl flex flex-col shadow-sm overflow-hidden"
          >
            
            {/* Header */}
            <div className="w-full px-6 py-5 border-b border-[#F1F5F9] bg-[#F8FAFC] flex items-center">
              <h1 className="font-semibold text-2xl text-[#16123E] tracking-tight">
                Contact Support
              </h1>
            </div>

            {/* Inner White Form Container */}
            <div className="flex-1 w-full bg-white p-6 md:p-8 flex flex-col gap-6">

              {errorMsg && (
                <div className="w-full p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {errorMsg}
                </div>
              )}

              {/* Row: Name and Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                
                {/* Name Input */}
                <div className="flex flex-col gap-2 w-full">
                  <label className="font-semibold text-[11px] tracking-wider uppercase text-[#16123E]">
                    Name
                  </label>
                  <div className="w-full h-[60px] border border-[#B3B3B3] rounded-xl px-4 flex items-center focus-within:border-black transition-colors">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-transparent border-none outline-none text-base text-[#1C1B1C] placeholder-[#767676] font-medium"
                      required
                    />
                  </div>
                </div>

                {/* Email Input */}
                <div className="flex flex-col gap-2 w-full">
                  <label className="font-semibold text-[11px] tracking-wider uppercase text-[#16123E]">
                    Email
                  </label>
                  <div className="w-full h-[60px] border border-[#B3B3B3] rounded-xl px-4 flex items-center focus-within:border-black transition-colors">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full bg-transparent border-none outline-none text-base text-[#1C1B1C] placeholder-[#767676] font-medium"
                      required
                    />
                  </div>
                </div>

              </div>

              {/* Subject Input */}
              <div className="flex flex-col gap-2 w-full">
                <label className="font-semibold text-[11px] tracking-wider uppercase text-[#16123E]">
                  Subject
                </label>
                <div className="w-full h-[60px] border border-[#B3B3B3] rounded-xl px-4 flex items-center focus-within:border-black transition-colors">
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What is this regarding"
                    className="w-full bg-transparent border-none outline-none text-base text-[#1C1B1C] placeholder-[#767676] font-medium"
                    required
                  />
                </div>
              </div>

              {/* Description Input (Textarea) */}
              <div className="flex flex-col gap-2 w-full">
                <label className="font-semibold text-[11px] tracking-wider uppercase text-[#16123E]">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please describe your inquiry to assist you best"
                  rows={6}
                  className="w-full border border-[#B3B3B3] rounded-xl p-4 text-base text-[#1C1B1C] placeholder-[#767676] font-medium outline-none focus:border-black transition-colors resize-none"
                  required
                />
              </div>

            </div>

            {/* Actions Footer */}
            <div className="w-full px-6 py-5 bg-[#F8FAFC] border-t border-[#F1F5F9] flex flex-row justify-end items-center gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={isSubmitting}
                className="box-border flex items-center justify-center py-3 px-6 h-12 border border-[#5A576B] rounded-xl text-sm font-semibold text-[#5A576B] hover:bg-neutral-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center justify-center py-3 px-6 h-12 bg-[#0D0D0D] hover:bg-black text-white text-sm font-semibold rounded-xl shadow active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending…" : "Submit"}
              </button>
            </div>

          </form>
        )}

      </main>

      <Footer />
    </div>
  );
}
