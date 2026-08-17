import type { AddonAssignedService } from "@/lib/api/addons";
import { centsToEuroText, euroTextToCents, formatEuro } from "@/lib/services/format";

export { centsToEuroText, euroTextToCents, formatEuro };

/** "Attached to" summary shown on the Add-on card, e.g. "Bridal Make-up +3". */
export const formatAttachedServicesSummary = (
  services: AddonAssignedService[],
): { primary: string; suffix?: string } => {
  if (services.length === 0) {
    return { primary: "Not attached to any service" };
  }
  const [first, ...rest] = services;
  return rest.length > 0 ? { primary: first!.name, suffix: `+${rest.length}` } : { primary: first!.name };
};
