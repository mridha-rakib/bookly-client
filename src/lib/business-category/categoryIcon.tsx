import type { IconSvgElement } from "@hugeicons/react";
import { Tag01Icon } from "@hugeicons/core-free-icons";

/**
 * The single source of truth mapping a known `Business.category` to its approved
 * design SVG. Consumed by every frontend surface that renders a Business Category
 * WITH an icon — currently the homepage category bar
 * (`components/landing-page/categoryIcons.tsx`) and the professional
 * business-creation category selector (`components/business-form/CategorySelectorStep2.tsx`).
 * Text-only category displays do not use this.
 *
 * Keys are the EXACT `Business.category` strings the backend stores/returns — never
 * uppercased, slugified, or resolved through `categoryKey`. Uppercase display stays
 * CSS-only at the call site.
 *
 * Assets live in `client/public/Icons/categories/` and are used verbatim; each SVG
 * already carries its own `#EDE3DE` rounded 32×32 container, so callers render it at
 * 32×32 with no extra background wrapper.
 */
export const BUSINESS_CATEGORY_ICON_SRC: Record<string, string> = {
  "Beauty & Wellness": "/Icons/categories/beauty_wellness.svg",
  "Health & Fitness": "/Icons/categories/health_fitnes.svg",
  "Sports & Activities": "/Icons/categories/sports_activities.svg",
  "Experience & Tours": "/Icons/categories/experience_tours.svg",
  "Entertainment & Events": "/Icons/categories/entertainment_events.svg",
  "Pets & Home": "/Icons/categories/pets_home.svg",
  Automotive: "/Icons/categories/automative.svg",
};

/** Approved SVG `src` for a known Business Category, or `null` for an unknown one. */
export const getBusinessCategoryIconSrc = (category: string): string | null =>
  BUSINESS_CATEGORY_ICON_SRC[category] ?? null;

/** True when `category` is one of the known Business Categories with an approved icon. */
export const isKnownBusinessCategory = (category: string): boolean =>
  category in BUSINESS_CATEGORY_ICON_SRC;

/**
 * The ONLY permitted glyph for an unknown, dynamically-discovered `Business.category`
 * (e.g. a future value from `/discovery/categories` not yet in the map above). Known
 * categories must always resolve to their approved SVG, never to this.
 */
export const UNKNOWN_BUSINESS_CATEGORY_ICON: IconSvgElement = Tag01Icon as IconSvgElement;
