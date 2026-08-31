// Moved to @/lib/media/avatarCrop so the Customer avatar flow can share the exact same
// crop-rasterisation code as Staff (same 1:1 output, EXIF handling, size cap). This re-export
// keeps StaffPhotoCropModal's import path unchanged — Staff behaviour is byte-identical.
export { getCroppedAvatarFile } from "@/lib/media/avatarCrop";
