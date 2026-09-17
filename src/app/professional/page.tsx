"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * `/professional` used to own the visit-type picker (shown before authentication). That step
 * moved to `/professional/visit-type`, reached only after profile/phone verification during
 * onboarding — visit type is no longer chosen up front. This route stays in place (list-your-
 * business and select-role both link here as the public "become a professional" entry point) but
 * now just forwards straight to email/password + social auth.
 */
export default function ProfessionalEntryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/professional/auth");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white font-poppins">
      <div className="w-12 h-12 border-4 border-[#240183] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
