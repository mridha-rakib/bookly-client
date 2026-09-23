"use client";

import React, { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Copy01Icon, ViewIcon } from "@hugeicons/core-free-icons";

import { toast } from "@/components/ui/sonner";
import { toUserMessage } from "@/lib/auth/messages";
import { BooklyApiError, normalizeApiError } from "@/lib/api/client";
import type { PayoutDestinationView } from "@/lib/api/payoutDestination";
import { useRevealSuperAdminPayoutDestinationMutation } from "@/lib/superAdminPayoutDestination/hooks";

/**
 * The Business's payout destination as shown to a Super Admin about to attest a manual SEPA
 * transfer. Shared by SuperAdminFinancePending's confirm modal and the Business Detail
 * PayoutBreakdownCard so both show exactly the same destination and the same warning.
 *
 * Reveal discipline (deliberate, do not relax): the plaintext IBAN comes from the only
 * decrypting, audited, rate-limited endpoint in this app. It is fetched ONLY on an explicit
 * click, never on mount and never on a refetch; it is held in this component's local state
 * only, never cached by React Query, never persisted anywhere, and never logged. It is cleared
 * on unmount and whenever `revealResetToken` changes (modal close, payout confirmed, business
 * switched).
 */

interface PayoutDestinationPanelProps {
  businessId: string;
  destination: PayoutDestinationView | undefined;
  isLoading?: boolean;
  isError?: boolean;
  /** Change this value to force the revealed IBAN out of local state. */
  revealResetToken?: string | number;
  className?: string;
}

const revealErrorMessage = (error: unknown): string => {
  const apiError = error instanceof BooklyApiError ? error : normalizeApiError(error);
  if (apiError.status === 429) {
    return "Too many reveal attempts. Please wait a moment and try again.";
  }
  return toUserMessage(apiError);
};

export default function PayoutDestinationPanel({
  businessId,
  destination,
  isLoading,
  isError,
  revealResetToken,
  className,
}: PayoutDestinationPanelProps) {
  const [revealedIban, setRevealedIban] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | undefined>(undefined);
  const revealMutation = useRevealSuperAdminPayoutDestinationMutation();

  // Reset-on-prop-change during render (React's documented "adjusting state when a prop
  // changes" pattern) rather than in an effect, so the plaintext IBAN is already gone from
  // state in the very render that follows a modal close / confirmed payout / business switch —
  // it is never painted for one frame against the wrong Business.
  const revealScope = `${businessId}:${revealResetToken ?? ""}`;
  const [lastRevealScope, setLastRevealScope] = useState(revealScope);

  if (lastRevealScope !== revealScope) {
    setLastRevealScope(revealScope);
    setRevealedIban(null);
    setRevealError(undefined);
  }

  useEffect(
    () => () => {
      setRevealedIban(null);
    },
    [],
  );

  const wrapper = `border border-gray-200 rounded-lg p-3 flex flex-col gap-2 bg-gray-50 font-sans ${className ?? ""}`;

  if (isLoading) {
    return (
      <div className={wrapper}>
        <span className="text-xs text-gray-500">Loading bank details…</span>
      </div>
    );
  }

  if (isError || !destination) {
    return (
      <div className={wrapper}>
        <span className="text-xs font-semibold text-rose-600">
          Couldn&apos;t load this Business&apos;s bank details
        </span>
      </div>
    );
  }

  if (!destination.configured) {
    return (
      <div className="border border-amber-200 rounded-lg p-3 flex items-start gap-2 bg-amber-50 font-sans">
        <HugeiconsIcon icon={Alert02Icon} className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-amber-800">
            Bank details not configured for this Business
          </span>
          <span className="text-[11px] text-amber-700">
            The Business Owner must add their payout bank account before this transfer can be
            recorded.
          </span>
        </div>
      </div>
    );
  }

  const handleReveal = () => {
    if (revealMutation.isPending) return;
    setRevealError(undefined);
    revealMutation.mutate(
      { businessId },
      {
        onSuccess: (result) => setRevealedIban(result.iban),
        onError: (error) => setRevealError(revealErrorMessage(error)),
      },
    );
  };

  const handleCopy = async () => {
    if (!revealedIban) return;
    try {
      await navigator.clipboard.writeText(revealedIban);
      toast.success("IBAN copied.");
    } catch {
      toast.error("Couldn't copy the IBAN.");
    }
  };

  const row = (label: string, value: string) => (
    <div className="flex justify-between items-center gap-3 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900 text-right break-all">{value}</span>
    </div>
  );

  return (
    <div className={wrapper}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Payout destination
      </span>

      {row("Account holder", destination.accountHolderName)}
      {row("Bank name", destination.bankName ?? "—")}
      {row("IBAN", revealedIban ?? destination.ibanMasked)}

      {revealedIban ? (
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="self-start flex items-center gap-1.5 text-[11px] font-semibold text-[#111827] hover:underline cursor-pointer"
        >
          <HugeiconsIcon icon={Copy01Icon} className="w-3.5 h-3.5" />
          Copy IBAN
        </button>
      ) : (
        <button
          type="button"
          onClick={handleReveal}
          disabled={revealMutation.isPending}
          className="self-start flex items-center gap-1.5 text-[11px] font-semibold text-[#111827] hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <HugeiconsIcon icon={ViewIcon} className="w-3.5 h-3.5" />
          {revealMutation.isPending ? "Revealing…" : "Reveal full IBAN"}
        </button>
      )}

      {revealError ? <span className="text-[11px] text-rose-600">{revealError}</span> : null}
    </div>
  );
}
