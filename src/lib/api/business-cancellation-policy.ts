import { apiRequest } from "@/lib/api/client";

/**
 * Batch 19 — the real backend for the existing "Cancellation & No-show" Settings tab (its own
 * backend doc comment confirms it was built specifically for this five-fixed-row UI, but the
 * frontend never called it — see api/.../business-cancellation-policy.model.ts). Owner-only,
 * persistence/validation only — no charge is executed by this module.
 */

export const cancellationTiers = [
  "MORE_THAN_72_HOURS",
  "BETWEEN_24_AND_72_HOURS",
  "BETWEEN_12_AND_24_HOURS",
  "BETWEEN_2_AND_12_HOURS",
  "UNDER_2_HOURS",
] as const;
export type CancellationTier = (typeof cancellationTiers)[number];

export type CancellationFeeMode = "FREE" | "PERCENTAGE";

export interface CancellationTierRule {
  tier: CancellationTier;
  mode: CancellationFeeMode;
  percentage?: number;
}

export interface BusinessCancellationPolicy {
  businessId: string;
  configured: boolean;
  tiers: CancellationTierRule[];
  noShowPercentage?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PutCancellationPolicyInput {
  tiers: CancellationTierRule[];
  noShowPercentage: number;
}

export const businessCancellationPolicyApi = {
  get: (businessId: string) =>
    apiRequest<BusinessCancellationPolicy>({
      method: "GET",
      url: `/businesses/${businessId}/cancellation-policy`,
    }),

  put: (businessId: string, input: PutCancellationPolicyInput) =>
    apiRequest<BusinessCancellationPolicy>({
      method: "PUT",
      url: `/businesses/${businessId}/cancellation-policy`,
      data: input,
    }),
};
