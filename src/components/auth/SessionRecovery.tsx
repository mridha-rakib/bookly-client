"use client";

import { useAuthStore } from "@/lib/auth/store";

/** Temporary verification failures must neither expose protected content nor force login. */
export default function SessionRecovery() {
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FCFAF9] font-poppins">
      <div className="space-y-4 text-center" role="status">
        <p>We couldn&apos;t verify your session. Please wait a moment and try again.</p>
        <button
          type="button"
          className="rounded-lg bg-[#240183] px-4 py-2 text-white disabled:opacity-50"
          disabled={isInitializing}
          onClick={() => void restoreSession()}
        >
          {isInitializing ? "Checking session…" : "Try again"}
        </button>
      </div>
    </div>
  );
}
