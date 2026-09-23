import { apiRequest } from "@/lib/api/client";
import type { PayoutDestinationView } from "@/lib/api/payoutDestination";

/**
 * Super Admin's view of a Business's payout destination. SUPER_ADMIN-only on the backend (see
 * api/src/modules/super-admin/super-admin.route.ts) — same auth mechanism as
 * lib/api/superAdminFinance.ts. Kept in its own module rather than folded into
 * superAdminFinance.ts because it is a different backend module with its own rate limits and
 * its own audited reveal semantics.
 *
 * The GET is the SAME masked view the owner sees. The reveal POST is the only endpoint anywhere
 * in this app that returns a decrypted IBAN: it is rate-limited and audited server-side, so it
 * must only ever fire from an explicit operator click — never on mount, never on refetch.
 */

export interface RevealedPayoutDestination {
  iban: string;
  accountHolderName: string;
  bankName?: string;
  revealedAt: string;
}

export const superAdminPayoutDestinationApi = {
  get: (businessId: string) =>
    apiRequest<PayoutDestinationView>({
      method: "GET",
      url: `/super-admin/businesses/${businessId}/payout-destination`,
    }),

  reveal: (businessId: string) =>
    apiRequest<RevealedPayoutDestination>({
      method: "POST",
      url: `/super-admin/businesses/${businessId}/payout-destination/reveal`,
      data: {},
    }),
};
