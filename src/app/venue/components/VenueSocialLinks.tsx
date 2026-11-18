"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Facebook02Icon, InstagramIcon } from "@hugeicons/core-free-icons";

/** Same rules as the Business Profile save (api business.schema.ts). */
const INSTAGRAM_HANDLE = /^@?[A-Za-z0-9._]+$/;
const INSTAGRAM_HANDLE_MAX_LENGTH = 60;
const FACEBOOK_HOSTS = new Set(["facebook.com", "www.facebook.com"]);

/** The public Instagram profile URL for a saved handle, or null when the handle is invalid. */
export function instagramProfileUrl(handle: string | undefined): string | null {
  const value = handle?.trim();
  if (!value || value.length > INSTAGRAM_HANDLE_MAX_LENGTH || !INSTAGRAM_HANDLE.test(value)) return null;
  const bare = value.replace(/^@/, "");
  return bare ? `https://www.instagram.com/${bare}/` : null;
}

/** The saved Facebook Page URL when it is a valid https facebook.com URL, otherwise null. */
export function facebookPageHref(url: string | undefined): string | null {
  const value = url?.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    if (!FACEBOOK_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    if (parsed.pathname === "/" || parsed.pathname === "") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** The Business's saved social accounts in the venue summary card. Renders nothing when neither
 * account is saved or valid; an invalid value is never rendered as a link. */
export default function VenueSocialLinks({
  businessName,
  instagramHandle,
  facebookPageUrl,
}: {
  businessName: string | undefined;
  instagramHandle: string | undefined;
  facebookPageUrl: string | undefined;
}) {
  const instagram = instagramProfileUrl(instagramHandle);
  const facebook = facebookPageHref(facebookPageUrl);
  if (!instagram && !facebook) return null;
  const name = businessName?.trim() || "This business";
  const linkClass =
    "flex items-center gap-2 font-inter font-normal text-[15.8px] text-[#2366C5] hover:underline whitespace-nowrap";
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 w-full" aria-label="Social media">
      {instagram && (
        <a href={instagram} target="_blank" rel="noopener noreferrer" aria-label={`${name} on Instagram`} className={linkClass}>
          <HugeiconsIcon icon={InstagramIcon} className="w-6 h-6 shrink-0 opacity-60 text-[#0D0D0D]" />
          <span>Instagram</span>
        </a>
      )}
      {facebook && (
        <a href={facebook} target="_blank" rel="noopener noreferrer" aria-label={`${name} on Facebook`} className={linkClass}>
          <HugeiconsIcon icon={Facebook02Icon} className="w-6 h-6 shrink-0 opacity-60 text-[#0D0D0D]" />
          <span>Facebook</span>
        </a>
      )}
    </div>
  );
}
