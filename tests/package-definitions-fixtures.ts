import type { PackageDefinition } from "@/lib/api/package-definitions";
export const businessId = "111111111111111111111111";
export const categoryId = "222222222222222222222222";
export const serviceId = "333333333333333333333333";
export const secondServiceId = "444444444444444444444444";
export function definition(overrides: Partial<PackageDefinition> = {}): PackageDefinition {
  return {
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    businessId,
    category: "Beauty",
    name: "Hair & Facial",
    description: "Six appointments",
    serviceCategoryId: categoryId,
    subcategory: "Hair",
    status: "ACTIVE",
    isFeatured: true,
    revision: 3,
    bundlePriceCents: 19999,
    contractTerms: {
      version: 2,
      validity: { mode: "FOREVER" },
      penaltyPolicyVersion: 1,
    },
    items: [
      {
        itemId: "bbbbbbbbbbbbbbbbbbbbbbbb",
        serviceId,
        includedSessions: 3,
        referenceUnitPriceCents: 5000,
        penaltyBasisCents: 0,
      },
      {
        itemId: "cccccccccccccccccccccccc",
        serviceId: secondServiceId,
        includedSessions: 2,
        referenceUnitPriceCents: 6000,
        penaltyBasisCents: 5000,
      },
    ],
    totalSessions: 5,
    referenceTotalCents: 27000,
    savingsCents: 7001,
    discountPercent: 25.93,
    sellable: true,
    newContractReady: true,
    dependencyIssues: [],
    createdAt: "2026-10-20T00:00:00Z",
    updatedAt: "2026-10-20T00:00:00Z",
    ...overrides,
  };
}
