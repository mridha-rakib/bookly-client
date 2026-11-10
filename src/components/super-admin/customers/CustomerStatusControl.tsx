"use client";

import React, { useState } from "react";
import { BooklyApiError } from "@/lib/api/client";
import { toUserMessage } from "@/lib/auth/messages";
import type { CustomerStatus, CustomerStatusAction } from "@/lib/api/superAdminCustomers";
import { useChangeCustomerStatusMutation } from "@/lib/superAdminCustomers/hooks";

/** P2.2.6 — the server's outcome, never a raw error. */
export const customerStatusErrorMessage = (error: unknown): string => {
  if (error instanceof BooklyApiError) {
    if (error.code === "SUPER_ADMIN_CUSTOMER_STATUS_UNCONFIRMED" || error.errors[0]?.code === "SUPER_ADMIN_CUSTOMER_STATUS_UNCONFIRMED")
      return "Account status and session termination could not be confirmed. Retry this action safely.";
    if (error.status === 404) return "This customer no longer exists.";
    if (error.code === "SUPER_ADMIN_CUSTOMER_DELETED" || error.errors[0]?.code === "SUPER_ADMIN_CUSTOMER_DELETED")
      return "This customer account is closed and its status can't be changed.";
    if (error.status === 409)
      return "This customer's status was changed by another admin. The latest status is shown — review it and try again if needed.";
    if (error.status === 403) return "Only a Super Admin can change a customer's account status.";
  }
  return toUserMessage(error);
};

const copy: Record<CustomerStatusAction, { trigger: string; confirm: string; pending: string; done: string; body: string }> = {
  SUSPEND: {
    trigger: "Suspend account",
    confirm: "Suspend account",
    pending: "Suspending…",
    done: "Customer suspended.",
    body: "All active sessions will be terminated, and the customer must sign in again after reactivation. They can't sign in, book or manage their account until reactivated. Existing bookings, payments, refunds and records stay as they are — nothing is cancelled or refunded automatically.",
  },
  REACTIVATE: {
    trigger: "Reactivate account",
    confirm: "Reactivate account",
    pending: "Reactivating…",
    done: "Customer reactivated.",
    body: "They must sign in again to use Bookly. Previous sessions stay terminated. Their bookings and payment records are unchanged.",
  },
};

export default function CustomerStatusControl({
  customerId,
  customerName,
  status,
  onResult,
}: {
  customerId: string;
  customerName: string;
  status: CustomerStatus;
  /** Optional outcome message for the parent (e.g. a toast). */
  onResult?: (message: string) => void;
}) {
  const mutation = useChangeCustomerStatusMutation();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (status === "DELETED") return null;
  const action: CustomerStatusAction = status === "SUSPENDED" ? "REACTIVATE" : "SUSPEND";
  const text = copy[action];

  const submit = async () => {
    if (mutation.isPending) return;
    setError(null);
    try {
      const result = await mutation.mutateAsync({ userId: customerId, action, reason });
      const message = result.changed
        ? text.done
        : action === "SUSPEND"
          ? "This customer was already suspended."
          : "This customer was already active.";
      setConfirming(false);
      setReason("");
      setNotice(message);
      onResult?.(message);
    } catch (caught) {
      setError(customerStatusErrorMessage(caught));
      if (caught instanceof BooklyApiError && (caught.status === 409 || caught.status === 404)) setConfirming(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {!confirming && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setNotice(null);
            setConfirming(true);
          }}
          className={`whitespace-nowrap rounded-lg border px-3 py-2 text-xs font-semibold ${action === "SUSPEND" ? "border-rose-300 text-rose-700 hover:bg-rose-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}
        >
          {text.trigger}
        </button>
      )}
      {confirming && (
        <div
          role="alertdialog"
          aria-label={`${text.trigger}: ${customerName}`}
          className="flex min-w-64 max-w-md flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm"
        >
          <p className="font-semibold text-gray-900">
            {action === "SUSPEND" ? "Suspend" : "Reactivate"} {customerName}?
          </p>
          <p className="text-gray-600">{text.body}</p>
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            Internal note (optional)
            <textarea
              value={reason}
              maxLength={500}
              rows={2}
              disabled={mutation.isPending}
              onChange={(event) => setReason(event.target.value)}
              className="rounded-lg border border-gray-200 p-2 text-sm text-gray-900"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => {
                setConfirming(false);
                setError(null);
              }}
              className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => void submit()}
              className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${action === "SUSPEND" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
            >
              {mutation.isPending ? text.pending : text.confirm}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" data-testid="customer-status-error" className="max-w-md text-xs text-rose-600">
          {error}
        </p>
      )}
      {notice && !confirming && (
        <p role="status" data-testid="customer-status-notice" className="text-xs text-emerald-700">
          {notice}
        </p>
      )}
    </div>
  );
}
