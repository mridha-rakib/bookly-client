"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";

export type VenueGalleryImage = { id: string; url: string };

const SWIPE_THRESHOLD_PX = 50;

/**
 * Full-screen gallery of the Business's saved media (the same catalog `business.media` records the
 * page already shows; nothing is fetched or uploaded here). Only the current photo is loaded.
 * Keyboard: ←/→ navigate, Escape closes, Tab stays inside the dialog. Pointer: buttons and swipe.
 */
export default function VenueGalleryDialog({
  images,
  businessName,
  startIndex,
  onClose,
}: {
  images: VenueGalleryImage[];
  businessName: string | undefined;
  startIndex: number;
  onClose: () => void;
}) {
  const count = images.length;
  const [index, setIndex] = useState(() => (count ? Math.min(Math.max(startIndex, 0), count - 1) : 0));
  const [failed, setFailed] = useState<Record<string, true>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<number | null>(null);
  const name = businessName?.trim() || "Business";

  const go = useCallback((delta: number) => {
    if (count > 1) setIndex((current) => (current + delta + count) % count);
  }, [count]);

  // Focus the dialog on open, restore focus to the opener on close, and lock page scroll.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); go(1); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); return; }
    if (event.key === "Tab") {
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [])];
      if (!focusable.length) return;
      const first = focusable[0]!, last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  const current = images[index];
  const navButton = "absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white border border-[#D3D3D3] shadow-md flex items-center justify-center cursor-pointer text-[#0D0D0D]";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} photos`}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[60] bg-black/90 flex flex-col font-inter"
    >
      <div className="flex items-center justify-between px-4 sm:px-8 py-4 text-white">
        <p className="text-sm sm:text-base font-medium" aria-live="polite">
          {count ? `Photo ${index + 1} of ${count}` : "No photos"}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close gallery"
          className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={22} />
        </button>
      </div>

      <div
        className="relative flex-1 min-h-0 mx-4 sm:mx-16 mb-6 touch-pan-y select-none"
        onPointerDown={(event) => { swipeStart.current = event.clientX; }}
        onPointerUp={(event) => {
          if (swipeStart.current === null) return;
          const dx = event.clientX - swipeStart.current;
          swipeStart.current = null;
          if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => { swipeStart.current = null; }}
      >
        {!current ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-300">
            <HugeiconsIcon icon={InformationCircleIcon} size={28} />
            <span className="text-sm font-medium">This business hasn&apos;t added any photos yet.</span>
          </div>
        ) : failed[current.id] ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-neutral-300" role="img" aria-label={`${name} photo ${index + 1} unavailable`}>
            <HugeiconsIcon icon={InformationCircleIcon} size={28} />
            <span className="text-sm font-medium">This photo could not be loaded.</span>
          </div>
        ) : (
          <Image
            key={current.id}
            src={current.url}
            alt={`${name} photo ${index + 1} of ${count}`}
            fill
            sizes="100vw"
            className="object-contain pointer-events-none"
            onError={() => setFailed((value) => ({ ...value, [current.id]: true }))}
          />
        )}

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${navButton} left-0 sm:-left-12`}>
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${navButton} right-0 sm:-right-12`}>
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
