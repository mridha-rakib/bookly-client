"use client";

export default function ClientPagination({ pagination, onChange, label, busy = false }: {
  pagination: { page: number; limit: number; total: number };
  onChange: (page: number) => void; label: string; busy?: boolean;
}) {
  const { page, limit, total } = pagination;
  return <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4 text-xs text-neutral-500">
    <span>{total ? `Showing ${Math.min((page - 1) * limit + 1, total)}–${Math.min(page * limit, total)} of ${total}` : "No results"}</span>
    <div className="flex gap-2"><button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <button type="button" className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={busy || page * limit >= total} onClick={() => onChange(page + 1)}>Next</button></div>
  </nav>;
}
