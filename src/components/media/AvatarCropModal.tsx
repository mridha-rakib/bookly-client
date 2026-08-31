"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { HugeiconsIcon } from "@hugeicons/react";
import { MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";

import { Spinner } from "@/components/ui/spinner";
import { getCroppedAvatarFile } from "@/lib/media/avatarCrop";

interface AvatarCropModalProps {
  /** When false the modal renders nothing. */
  open: boolean;
  /** Object URL of the just-picked file. */
  imageSrc: string | null;
  /** Original file name, used only to name the cropped output. */
  baseName?: string;
  title?: string;
  description?: string;
  /** Label for the confirm button (idle state). */
  confirmLabel?: string;
  /** Dismiss without producing a photo — the caller changes no other state. */
  onCancel: () => void;
  /** Receives the square, cropped JPEG `File`. The caller uploads/stages it. */
  onConfirm: (file: File) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

const clampZoom = (value: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

/**
 * Fixed 1:1 crop / reposition / zoom step shown between choosing an image and committing it.
 * Shared by the Customer avatar flow and (via @/lib/staff/cropImage) the same crop maths the
 * Staff photo flow already uses. The parent should remount this via `key={imageSrc}` so each
 * new pick starts centred at 1x.
 */
export default function AvatarCropModal({
  open,
  imageSrc,
  baseName,
  title = "Adjust photo",
  description = "Drag to reposition and use the slider to zoom. The circle shows what will be kept.",
  confirmLabel = "Use photo",
  onCancel,
  onConfirm,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(MIN_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // Guards against a second confirm activation (double click / Enter-repeat) starting a second
  // encode before React has re-rendered the disabled button.
  const processingRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  useEffect(() => {
    if (open) {
      cancelButtonRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !processingRef.current) {
        event.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onCancel]);

  if (!open || !imageSrc) return null;

  const handleConfirm = async () => {
    if (processingRef.current || !croppedAreaPixels) return;
    processingRef.current = true;
    setProcessing(true);
    setError("");
    try {
      const file = await getCroppedAvatarFile(imageSrc, croppedAreaPixels, baseName);
      onConfirm(file);
    } catch (err) {
      // Keep the modal open with the crop position preserved so the user can retry.
      setError(
        err instanceof Error
          ? err.message
          : "Could not process the image. Please try a different photo.",
      );
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const handleBackdrop = () => {
    if (!processingRef.current) onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 select-none font-poppins"
      onClick={handleBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        onClick={(e) => e.stopPropagation()}
        className="w-[420px] max-w-full bg-white rounded-xl shadow-2xl flex flex-col p-5 gap-4 relative animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex flex-col gap-1">
          <h3
            id="avatar-crop-title"
            className="font-poppins font-medium text-[18px] leading-[26px] text-[#09090B]"
          >
            {title}
          </h3>
          <p className="font-poppins font-normal text-[13px] leading-[20px] text-[#525252]">
            {description}
          </p>
        </div>

        <div className="relative w-full h-[280px] rounded-lg overflow-hidden bg-[#1C1B1C]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            restrictPosition
            onCropChange={setCrop}
            onZoomChange={(z) => setZoom(clampZoom(z))}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={processing || zoom <= MIN_ZOOM}
            onClick={() => setZoom((z) => clampZoom(z - ZOOM_STEP))}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-[#DADADA] text-[#111111] hover:bg-[#F5F5F5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <HugeiconsIcon icon={MinusSignIcon} className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            aria-label="Zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={processing}
            onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
            className="flex-1 accent-[#1C1B1C] cursor-pointer disabled:cursor-not-allowed"
          />
          <button
            type="button"
            aria-label="Zoom in"
            disabled={processing || zoom >= MAX_ZOOM}
            onClick={() => setZoom((z) => clampZoom(z + ZOOM_STEP))}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-[#DADADA] text-[#111111] hover:bg-[#F5F5F5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="w-3.5 h-3.5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-[#FFF5F5] border border-[#FCDDEC] px-3 py-2 text-[12px] font-medium text-[#DE350B]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="h-[34px] px-4 bg-[#EBEBEB] text-[#757575] font-poppins font-medium text-xs rounded-[8px] hover:bg-[#E2E2E2] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={processing || !croppedAreaPixels}
            className="h-[34px] px-4 bg-[#1C1B1C] hover:bg-black text-white font-poppins font-medium text-xs rounded-[8px] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {processing && <Spinner className="size-3.5" />}
            {processing ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
