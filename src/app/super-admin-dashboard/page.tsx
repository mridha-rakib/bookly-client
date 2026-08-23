import RequireSuperAdmin from "@/components/auth/RequireSuperAdmin";
import SuperAdminDashboard from "@/components/super-admin/SuperAdminDashboard";

export default function SuperAdminDashboardPage() {
  return (
    <RequireSuperAdmin>
      <SuperAdminDashboard />
    </RequireSuperAdmin>
  );
}
