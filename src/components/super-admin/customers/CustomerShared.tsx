"use client";

import Image from "next/image";
import { useState } from "react";
import type { SuperAdminCustomerListItem } from "@/lib/api/superAdminCustomers";

export function CustomerAvatar({ customer }: { customer: SuperAdminCustomerListItem }) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email;
  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EEF2FF] font-semibold text-[#4338CA]">
      {customer.avatarUrl ? (
        <Image
          src={customer.avatarUrl}
          alt={name}
          fill
          sizes="48px"
          unoptimized
          className="object-cover"
        />
      ) : (
        name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      )}
    </div>
  );
}

export function CustomerPagination({
  pagination,
  onChange,
  label,
}: {
  pagination: { page: number; limit: number; total: number };
  onChange: (page: number) => void;
  label: string;
}) {
  const { page, limit, total } = pagination;
  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 py-4 text-xs text-gray-500"
    >
      <span>
        {total
          ? `Showing ${Math.min((page - 1) * limit + 1, total)}–${Math.min(page * limit, total)} of ${total}`
          : "No results"}
      </span>
      <div className="flex gap-2">
        <button
          className="rounded-lg border px-3 py-2 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="rounded-lg border px-3 py-2 disabled:opacity-40"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export function CustomerExport({
  load,
  scope,
}: {
  load: () => Promise<{ csv: string; filename: string }>;
  scope: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const { csv, filename } = await load();
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        title={scope}
        aria-label={`Export CSV: ${scope}`}
        disabled={busy}
        onClick={() => void download()}
        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium disabled:opacity-40"
      >
        {busy ? "Exporting…" : "Export CSV"}
      </button>
      <span className="text-[11px] text-gray-500">{scope}</span>
      {error && (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
