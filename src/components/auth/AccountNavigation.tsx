"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { User02Icon, File01Icon, GiftCardIcon, FavouriteIcon, CreditCardPosIcon,
  Clock01Icon, Setting07Icon, Ticket01Icon, Home01Icon } from "@hugeicons/core-free-icons";
import { getAccountNavigation } from "@/lib/auth/routes";
import type { UserRole } from "@/lib/api/auth";

const icons: Record<string, React.ComponentProps<typeof HugeiconsIcon>["icon"]> = {
  Profile: User02Icon,
  "My Bookings": File01Icon,
  "My Packages": GiftCardIcon,
  Favorites: FavouriteIcon,
  "Payment card": CreditCardPosIcon,
  "Book again": Clock01Icon,
  Setting: Setting07Icon,
  "My Tickets": Ticket01Icon,
};

/** Shared by the desktop dropdown and mobile account sheet. */
export default function AccountNavigation({ role, onNavigate }: {
  role: UserRole;
  onNavigate: () => void;
}) {
  return getAccountNavigation(role).map(({ label, href }) => (
    <Link key={href} href={href} onClick={onNavigate}
      className="flex items-center gap-3 text-left w-full hover:opacity-85 font-medium text-base text-[#1C1B1C]">
      <HugeiconsIcon icon={icons[label] ?? Home01Icon} className="w-5 h-5 text-[#141B34]" />
      {label}
    </Link>
  ));
}
