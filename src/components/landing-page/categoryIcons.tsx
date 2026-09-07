import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  UNKNOWN_BUSINESS_CATEGORY_ICON,
  getBusinessCategoryIconSrc,
} from "@/lib/business-category/categoryIcon";

export { isKnownBusinessCategory } from "@/lib/business-category/categoryIcon";

/**
 * One category tile's icon on the homepage bar. Tiles come from `/discovery/categories`
 * (dynamic `Business.category` strings): a KNOWN category renders its approved SVG —
 * resolved through the shared map (`lib/business-category/categoryIcon`), so it is the
 * exact same asset the onboarding category selector uses. An unknown future category
 * renders the generic `Tag01Icon` fallback inside the bar's `bg-[#EDE3DE]` chip so it
 * still shows and stays clickable.
 *
 * The approved SVGs already include their own `#EDE3DE` rounded 32×32 container, so a
 * known tile renders the image directly with no wrapper.
 */
export function CategoryTileIcon({ category }: { category: string }) {
  const src = getBusinessCategoryIconSrc(category);
  if (src) {
    return (
      <Image src={src} alt="" aria-hidden width={32} height={32} className="w-8 h-8 shrink-0" />
    );
  }

  return (
    <div className="p-1 rounded bg-[#EDE3DE]">
      <HugeiconsIcon
        icon={UNKNOWN_BUSINESS_CATEGORY_ICON}
        size={24}
        strokeWidth={1.5}
        color="#111111"
      />
    </div>
  );
}
