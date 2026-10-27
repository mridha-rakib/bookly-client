type PaymentSessionState = {
  status: string;
  user: { id: string; role: string } | null;
  cacheEpoch: number;
  isInitializing?: boolean;
};

/** Local continuation/cache fence only. Server ownership and payment authority are unchanged. */
export const customerPaymentSession = (state: PaymentSessionState): string | undefined => {
  if (state.status !== "authenticated" || state.isInitializing || state.user?.role !== "CUSTOMER") {
    return undefined;
  }
  return JSON.stringify([state.user.id, state.cacheEpoch]);
};
