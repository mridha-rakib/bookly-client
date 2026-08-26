import {
  StarIcon,
  ReceiptTextIcon,
  Cancel01Icon,
  Alert02Icon,
  Money02Icon,
  Discount01Icon,
} from "@hugeicons/core-free-icons";
import type { DashboardOverviewActivityEntry } from "@/lib/api/dashboardOverview";
import { formatEuro } from "@/lib/services/format";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function describeActivity(entry: DashboardOverviewActivityEntry) {
  const amount = formatEuro(entry.amountCents);
  const who = entry.customerName || "A customer";
  const isFailed = entry.status === "FAILED";
  const isWaived = entry.status === "WAIVED";

  let text: string;
  let icon = ReceiptTextIcon;
  let bg = "bg-neutral-100";
  let color = "text-neutral-600";

  switch (entry.type) {
    case "DEPOSIT":
      text = `${who} booked${entry.serviceName ? ` — ${entry.serviceName}` : ""}. Deposit ${amount} collected.`;
      icon = StarIcon;
      bg = "bg-[#E1F5EE]";
      color = "text-[#085041]";
      break;
    case "NO_SHOW_FEE":
      text = isWaived
        ? `No-show fee for ${who} (${amount}) was waived.`
        : `${who} marked as no-show. ${amount} charged.`;
      icon = Alert02Icon;
      bg = "bg-red-50";
      color = "text-red-600";
      break;
    case "CANCELLATION_FEE":
      text = isWaived
        ? `Late-cancellation fee for ${who} (${amount}) was waived.`
        : `${who} cancelled late. ${amount} charged.`;
      icon = Cancel01Icon;
      bg = "bg-amber-50";
      color = "text-amber-600";
      break;
    case "REFUND":
      text = `${who} was refunded ${amount}.`;
      icon = Cancel01Icon;
      bg = "bg-red-50";
      color = "text-red-600";
      break;
    case "PROMO_SUBSIDY":
      text = `Promo discount of ${amount} applied for ${who}.`;
      icon = Discount01Icon;
      bg = "bg-blue-50";
      color = "text-blue-600";
      break;
    case "PLATFORM_FEE":
      text = `Platform fee of ${amount} recorded for ${who}'s booking.`;
      icon = ReceiptTextIcon;
      bg = "bg-neutral-100";
      color = "text-neutral-600";
      break;
    case "PROCESSING_FEE":
      text = `Payment processing fee of ${amount} recorded for ${who}'s booking.`;
      icon = Money02Icon;
      bg = "bg-neutral-100";
      color = "text-neutral-600";
      break;
    default:
      text = `${amount} ${String(entry.type).replace(/_/g, " ").toLowerCase()} recorded for ${who}.`;
  }

  if (isFailed) {
    text = `Failed: ${text}`;
  }

  return {
    text,
    time: timeAgo(entry.createdAt),
    icon,
    bg,
    color,
  };
}
