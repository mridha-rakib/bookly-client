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
