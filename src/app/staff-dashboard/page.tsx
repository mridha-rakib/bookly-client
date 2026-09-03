import RequireStaff from "@/components/auth/RequireStaff";
import StaffDashboard from "@/components/dashboard/StaffDashboard";

export default function Page() {
  return (
    <RequireStaff>
      <StaffDashboard />
    </RequireStaff>
  );
}
