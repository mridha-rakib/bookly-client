import type { BusinessCatalog, CatalogService } from "../../src/lib/api/catalog";
import type { PackageOffer } from "../../src/lib/api/package-views";
import { offer } from "./package-view-fixtures";

export const venueFixtureId = "aaaaaaaaaaaaaaaaaaaaaaaa";
export const venueServices: CatalogService[] = [
  { id: offer.id, name: "Featured treatment", description: "Original ordinary Service card and booking action.", category: "Wellbeing", subcategory: "Massage", isFeatured: true, isPackageDeal: false, pricingMode: "FIXED", fixedPricing: { priceCents: 4500, durationMin: 60 }, servedCities: [], assignedStaffMembershipIds: [] },
  { id: "legacy", name: "Legacy package", description: "Historical package deal.", category: "Wellbeing", subcategory: "Massage", isFeatured: true, isPackageDeal: true, packagePricing: { bundlePriceCents: 12000, sessionsInPackage: 3, durationMin: 45, discountPercent: 20 }, servedCities: [], assignedStaffMembershipIds: [] },
  { id: "movement", name: "Movement appointment", category: "Wellbeing", subcategory: "Movement", isFeatured: false, isPackageDeal: false, pricingMode: "FIXED", fixedPricing: { priceCents: 3000, durationMin: 45 }, servedCities: [], assignedStaffMembershipIds: [] },
];
export const venuePackages: PackageOffer[] = [
  { ...offer, businessId: venueFixtureId },
  { ...offer, businessId: venueFixtureId, id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Forever wellbeing package", validity: { mode: "FOREVER" } },
];
export const venueCatalog: BusinessCatalog = {
  business: { id: venueFixtureId, name: "Isolated Venue Services", category: "Wellbeing", subcategories: ["Massage", "Movement"], briefDescription: "VISUAL FIXTURE — NOT LIVE PURCHASE DATA", visitType: "AT_BUSINESS_LOCATION", timezone: "Asia/Nicosia", address: { city: "Larnaca", area: "Centre", streetName: "Fixture Street", streetNumber: "1" }, openStatus: { configured: true, isOpen: true, label: "Open now" }, hours: [], media: [] },
  services: venueServices, staff: [],
};
