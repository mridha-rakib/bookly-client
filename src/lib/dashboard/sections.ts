// URL <-> internal dashboard tab-label mapping. The internal labels below (e.g. "All Bookings",
// "Payouts & Finance") are the exact activeTab identifiers business-dashboard/page.tsx and
// DashboardSidebar already use — this module only adds a stable, readable URL slug for each one
// so the active section survives a refresh (?section=<slug>) without changing those identifiers.
export const DEFAULT_DASHBOARD_SECTION = "Calendar";

const SLUG_TO_LABEL: Record<string, string> = {
  "dashboard": "Dashboard",
  "calendar": "Calendar",
  "clients": "Clients",
  "all-bookings": "All Bookings",
  "upcoming": "Upcoming",
  "canceled": "Canceled",
  "business-profile": "Business Profile",
  "services": "Services",
  "archived-services": "Archived Services",
  "add-ons": "Add-ons",
  "archived-add-ons": "Archived Add-ons",
  "staff": "Staff",
  "reviews": "Reviews",
  "payouts-finance": "Payouts & Finance",
  "analytics": "Analytics",
  "settings": "Settings",
  "contact-support": "Contact Support",
};

const LABEL_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(SLUG_TO_LABEL).map(([slug, label]) => [label, slug])
);

export function slugToDashboardSection(slug: string | null): string | null {
  if (!slug) return null;
  return SLUG_TO_LABEL[slug] ?? null;
}

export function dashboardSectionToSlug(label: string): string {
  return LABEL_TO_SLUG[label] ?? LABEL_TO_SLUG[DEFAULT_DASHBOARD_SECTION];
}
