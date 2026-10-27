/** Navigation hints only. Historical bookings, prices, staff and payment data are never
 * replayed; the Venue validates this service against its current catalog. */
export const bookAgainHref = (businessId: string, serviceId: string): string =>
  `/venue?id=${encodeURIComponent(businessId)}&serviceId=${encodeURIComponent(serviceId)}`;
