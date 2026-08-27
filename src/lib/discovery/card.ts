import type { DiscoveryBusinessCard } from "@/lib/api/discovery";
import type { Recommendation } from "@/components/ServiceCard";

/**
 * Batch 16/17 — the single mapping from a real `DiscoveryBusinessCard` (Explore search AND the
 * homepage discovery rows) to the shared `ServiceCard` view model. Every field is passed
 * straight through from the API response:
 *   - `rating`/`reviews` are the real PUBLISHED-review aggregate (null rating => "New" state).
 *   - `startingPrice` is the real cheapest ACTIVE non-package Service price, or null =>
 *     "Price on request". Cents -> whole units, matching the card's `$` prefix.
 *   - `image` is the signed cover-photo URL, or null => the card's own initials placeholder.
 *   - `travelsToYou` is the real `visitType`.
 * Deliberately NOT set: `distance` (no visitor coordinates exist anywhere in the product, so a
 * distance string would be fabricated) and `hasDiamond`/`noDeposit` (no real per-business
 * backing — they were invented in the old homepage mock).
 */
export const discoveryCardToRecommendation = (card: DiscoveryBusinessCard): Recommendation => ({
  id: card.id,
  title: card.name,
  rating: card.averageRating,
  reviews: card.reviewCount,
  categories: [card.category, ...card.subcategories],
  location: card.city,
  startingPrice:
    card.startingPriceCents !== null ? Math.round(card.startingPriceCents / 100) : null,
  startingPriceSuffix:
    card.startingPricingMode === "HOURLY"
      ? "/hr"
      : card.startingPricingMode === "PER_PERSON"
        ? "/person"
        : "",
  image: card.imageUrl ?? null,
  travelsToYou: card.visitType === "TRAVEL_TO_CUSTOMER",
  isAvailable: card.isAvailable,
});
