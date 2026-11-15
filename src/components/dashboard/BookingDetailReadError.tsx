"use client";

export default function BookingDetailReadError({ retry, pending }: { retry: () => void; pending: boolean }) {
  return <div role="alert" className="flex items-center gap-3 text-sm text-[#BA1A1A]">Couldn&apos;t load this booking. <button type="button" onClick={retry} disabled={pending} className="underline disabled:opacity-50">{pending ? "Retrying…" : "Retry"}</button></div>;
}
