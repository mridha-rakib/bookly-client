import type { Area } from "react-easy-crop";

// Shared avatar crop rasteriser for both the Staff photo flow (StaffPhotoCropModal, via the
// @/lib/staff/cropImage re-export) and the Customer avatar flow (AvatarCropModal).
//
// Largest square edge we ever emit. Avatars render at ~80–120px inside small round frames, so
// 512px is comfortably crisp on HiDPI while keeping the upload small. We never upscale a crop
// that is already smaller than this — see `outputSize` below.
const MAX_AVATAR_EDGE = 512;

// Both avatar backends (staff-avatar.service.ts, customer-avatar.service.ts) store the uploaded
// bytes as-is and accept JPEG/PNG/WebP. An avatar is always a photograph, so JPEG at high
// quality gives the most predictable, smallest result. Any transparency in the source (e.g. a
// PNG) is flattened onto white — acceptable for an opaque round avatar.
const OUTPUT_MIME = "image/jpeg";
const OUTPUT_QUALITY = 0.9;

const loadOrientedBitmap = async (imageSrc: string): Promise<ImageBitmap> => {
  const blob = await (await fetch(imageSrc)).blob();
  // `imageOrientation: "from-image"` bakes in any EXIF rotation (common on mobile / iPhone
  // camera photos) so the crop we draw matches what the user positioned in the modal.
  return createImageBitmap(blob, { imageOrientation: "from-image" });
};

/**
 * Rasterises the user's chosen crop rectangle (in natural source pixels, as reported by
 * react-easy-crop's `onCropComplete` -> `croppedAreaPixels`) into a square JPEG `File`
 * ready for a multipart avatar upload (staffApi.uploadStaffAvatar / authApi.updateMyAvatar).
 *
 * The result is always 1:1. It is at most `MAX_AVATAR_EDGE` per side and is never scaled
 * up beyond the pixels the user actually cropped.
 */
export const getCroppedAvatarFile = async (
  imageSrc: string,
  croppedAreaPixels: Area,
  baseName?: string,
): Promise<File> => {
  const bitmap = await loadOrientedBitmap(imageSrc);

  try {
    const sourceEdge = Math.max(1, Math.round(croppedAreaPixels.width));
    const outputSize = Math.min(sourceEdge, MAX_AVATAR_EDGE);

    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not process the image. Please try a different photo.");
    }

    // White matte behind the crop so a transparent source never becomes black in the JPEG.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, outputSize, outputSize);
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      bitmap,
      Math.round(croppedAreaPixels.x),
      Math.round(croppedAreaPixels.y),
      Math.round(croppedAreaPixels.width),
      Math.round(croppedAreaPixels.height),
      0,
      0,
      outputSize,
      outputSize,
    );

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, OUTPUT_MIME, OUTPUT_QUALITY);
    });

    if (!blob) {
      throw new Error("Could not process the image. Please try a different photo.");
    }

    const safeBase = (baseName ?? "avatar").replace(/\.[^./\\]+$/, "").trim() || "avatar";

    return new File([blob], `${safeBase}.jpg`, {
      type: OUTPUT_MIME,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
};
