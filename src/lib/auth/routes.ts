import type { AuthUser, UserRole } from "@/lib/api/auth";

export const authRoutes = {
  professionalAuth: "/professional/auth",
  customerAuth: "/select-role",
  customerHome: "/",
  businessDashboard: "/business-dashboard",
  supervisorDashboard: "/supervisor-dashboard",
  staffDashboard: "/staff-dashboard",
  superAdminDashboard: "/super-admin-dashboard",
  superAdminLogin: "/super-admin/login",
} as const;

export const getAuthenticatedHomePath = (role: UserRole): string => {
  switch (role) {
    case "BUSINESS_OWNER":
      return authRoutes.businessDashboard;
    case "SUPERVISOR":
      return authRoutes.supervisorDashboard;
    case "STAFF":
      return authRoutes.staffDashboard;
    case "SUPER_ADMIN":
      return authRoutes.superAdminDashboard;
    case "CUSTOMER":
    default:
      return authRoutes.customerHome;
  }
};

export const getAuthenticatedUserHomePath = (user: AuthUser): string =>
  getAuthenticatedHomePath(user.role);

const dashboardLabels: Record<UserRole, string> = {
  CUSTOMER: "Customer Dashboard",
  BUSINESS_OWNER: "Business Dashboard",
  SUPERVISOR: "Supervisor Dashboard",
  STAFF: "Staff Dashboard",
  SUPER_ADMIN: "Super Admin Dashboard",
};

export const getAccountNavigation = (role: UserRole): { label: string; href: string }[] => {
  const dashboard = { label: dashboardLabels[role], href: getAuthenticatedHomePath(role) };
  if (role !== "CUSTOMER") return [dashboard];
  return [dashboard,
    { label: "Profile", href: "/customer/profile" },
    { label: "My Bookings", href: "/customer/bookings" },
    { label: "My Packages", href: "/customer/bookings?view=packages" },
    { label: "Favorites", href: "/customer/favorites" },
    { label: "Payment card", href: "/customer/payment-card" },
    { label: "Book again", href: "/customer/book-again" },
    { label: "Setting", href: "/customer/settings" },
    { label: "My Tickets", href: "/customer/tickets" },
  ];
};
