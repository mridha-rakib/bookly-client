"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { useAuthStore } from "@/lib/auth/store";

export default function NavbarWrapper() {
  const [selectedLanguage, setSelectedLanguage] = useState("ENG");
  const status = useAuthStore((state) => state.status);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("isLoggedIn");
    }
  }, []);

  const handleSetIsLoggedIn = (val: boolean) => {
    if (!val) {
      void logout();
    }
  };

  return (
    <Navbar
      isLoggedIn={status === "authenticated"}
      setIsLoggedIn={handleSetIsLoggedIn}
      selectedLanguage={selectedLanguage}
      setSelectedLanguage={setSelectedLanguage}
    />
  );
}
