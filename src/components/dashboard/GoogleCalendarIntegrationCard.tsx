"use client";

import Image from "next/image";
import React, { useState } from "react";

import type { GoogleCalendarStatus } from "@/lib/api/business";
import {
  useConnectGoogleCalendarMutation,
  useDisconnectGoogleCalendarMutation,
  useGoogleCalendarStatusQuery,
} from "@/lib/business/hooks";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/Nicosia",
    dateStyle: "medium",
    timeStyle: "short",
  });

/** P2.2.9 — only what the server reports; never a locally assumed "synced". */
function DeliverySummary({ delivery }: { delivery: GoogleCalendarStatus["delivery"] }) {
  if (!delivery) return null;
  if (delivery.mode === "BEST_EFFORT")
    return (
      <p className="text-[11px] text-[#666666]" data-testid="calendar-delivery">
        Sync mode: each booking change is sent to Google once. If a send fails it is shown here, but
        it is not retried automatically.
      </p>
    );
  if (!delivery.available)
    return (
      <p className="text-[11px] text-[#666666]" data-testid="calendar-delivery">
        Booking sync details are temporarily unavailable.
      </p>
    );
  const parts = [
    delivery.pending && `${delivery.pending} waiting to sync`,
    delivery.retrying && `${delivery.retrying} retrying`,
    delivery.recoveryRequired && `${delivery.recoveryRequired} need attention`,
    delivery.notConnected && `${delivery.notConnected} waiting for a connection`,
  ].filter(Boolean);
  const causes = [
    delivery.retryLimitReached && `${delivery.retryLimitReached} stopped after repeated failures`,
    delivery.permanentFailure && `${delivery.permanentFailure} rejected by Google`,
  ].filter(Boolean);
  return (
    <>
      <p className="text-[11px] text-[#666666]" data-testid="calendar-delivery">
        {parts.length
          ? `Bookings: ${parts.join(" · ")}${delivery.truncated ? " (and more)" : ""}.`
          : "All bookings are in sync."}
      </p>
      {delivery.recoveryRequired > 0 && (
        <p className="text-[11px] text-[#BA1A1A]" data-testid="calendar-attention">
          {causes.length ? `Of these: ${causes.join(" · ")}. ` : ""}
          Open each affected booking to review its Google Calendar status and resume syncing.
        </p>
      )}
    </>
  );
}

/**
 * Business Settings → Connected apps → Google Calendar. One-way Bookly → Google sync, Owner-only.
 * Shows the authoritative connection and sync state from
 * GET /businesses/:id/integrations/google-calendar/status, including "reconnection required"
 * when Google revoked access (P2.2.9).
 */
export default function GoogleCalendarIntegrationCard({
  businessId,
  redirectNotice,
}: {
  businessId: string | undefined;
  redirectNotice?: "connected" | "error" | null;
}) {
  const statusQuery = useGoogleCalendarStatusQuery(businessId);
  const connectMutation = useConnectGoogleCalendarMutation();
  const disconnectMutation = useDisconnectGoogleCalendarMutation();
  const [connectError, setConnectError] = useState<string | null>(null);
  const status = statusQuery.data;

  const connect = () => {
    if (!businessId || connectMutation.isPending) return;
    setConnectError(null);
    connectMutation.mutate(businessId, {
      onError: (error) =>
        setConnectError(
          error instanceof Error ? error.message : "Couldn't start the Google Calendar connection. Please try again.",
        ),
    });
  };

  const subtitle = statusQuery.isPending
    ? "Checking connection…"
    : !status
      ? "Status unavailable"
      : !status.connected
        ? "Not connected"
        : status.needsReconnection
          ? `Reconnection required · ${status.googleAccountEmail ?? ""}`
          : status.lastSyncProblem === "SYNC_FAILED"
            ? `Connected · last sync failed (${status.googleAccountEmail ?? ""})`
            : `Connected · ${status.googleAccountEmail ?? ""}`;

  return (
    <div
      className="border border-neutral-100 rounded-[12px] p-4 flex flex-col items-start gap-3 w-full"
      data-testid="google-calendar-card"
    >
      <div className="flex items-center gap-3">
        <Image src="/Icons/Google.svg" alt="Google" className="w-8 h-8 object-contain" width={32} height={32} />
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-[#111111]">Google Calendar</span>
          <span className="text-xs text-[#666666] mt-0.5" data-testid="calendar-subtitle">
            {subtitle}
          </span>
        </div>
      </div>

      {statusQuery.isError && !status && (
        <p role="alert" className="text-xs text-red-600">
          Couldn&apos;t load the Google Calendar status.{" "}
          <button
            type="button"
            onClick={() => void statusQuery.refetch()}
            disabled={statusQuery.isFetching}
            className="underline font-semibold disabled:opacity-60"
          >
            Retry
          </button>
        </p>
      )}

      {redirectNotice === "connected" && (
        <p className="text-xs text-green-600">Google Calendar connected. New bookings will now sync.</p>
      )}
      {redirectNotice === "error" && (
        <p className="text-xs text-red-600">Couldn&apos;t connect Google Calendar. Please try again.</p>
      )}
      {connectError && <p className="text-xs text-red-600">{connectError}</p>}

      {status?.connected && status.needsReconnection && (
        <p role="alert" className="text-xs text-red-600" data-testid="calendar-reconnect">
          Google access was revoked or has expired, so booking sync is paused. Reconnect Google Calendar
          to resume.
          {status.lastSyncFailedAt ? ` Since ${formatTime(status.lastSyncFailedAt)}.` : ""}
        </p>
      )}
      {status?.connected && !status.needsReconnection && status.lastSyncProblem === "SYNC_FAILED" && (
        <p className="text-xs text-amber-700" data-testid="calendar-sync-failed">
          The last booking sync to Google failed
          {status.lastSyncFailedAt ? ` (${formatTime(status.lastSyncFailedAt)})` : ""}.
        </p>
      )}
      {status && (
        <>
          {status.lastSuccessfulSyncAt && (
            <p className="text-[11px] text-[#666666]" data-testid="calendar-last-success">
              Last successful sync: {formatTime(status.lastSuccessfulSyncAt)}
            </p>
          )}
          <DeliverySummary delivery={status.delivery} />
        </>
      )}

      <div className="flex items-center gap-2">
        {status?.connected && status.needsReconnection && (
          <button
            type="button"
            disabled={!businessId || connectMutation.isPending}
            onClick={connect}
            className="px-4 py-1.5 border border-[#DEDDE3] rounded-lg text-xs font-semibold text-[#1A1A1A] hover:bg-neutral-50 cursor-pointer disabled:opacity-60"
          >
            {connectMutation.isPending ? "Redirecting..." : "Reconnect"}
          </button>
        )}
        {status?.connected ? (
          <button
            type="button"
            disabled={disconnectMutation.isPending}
            onClick={() => businessId && disconnectMutation.mutate(businessId)}
            className="px-4 py-1.5 border border-[#DEDDE3] rounded-lg text-xs font-semibold text-[#5B5D58] hover:bg-neutral-50 cursor-pointer disabled:opacity-60"
          >
            {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
          </button>
        ) : (
          status && (
            <button
              type="button"
              disabled={!businessId || connectMutation.isPending}
              onClick={connect}
              className="px-4 py-1.5 border border-[#DEDDE3] rounded-lg text-xs font-semibold text-[#1A1A1A] hover:bg-neutral-50 cursor-pointer disabled:opacity-60"
            >
              {connectMutation.isPending ? "Redirecting..." : "Connect"}
            </button>
          )
        )}
        {status && (
          <button
            type="button"
            onClick={() => void statusQuery.refetch()}
            disabled={statusQuery.isFetching}
            className="px-3 py-1.5 text-xs font-semibold text-[#5B5D58] underline disabled:opacity-60"
          >
            {statusQuery.isFetching ? "Refreshing…" : "Refresh status"}
          </button>
        )}
      </div>
    </div>
  );
}
