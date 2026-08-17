import RequireSupervisor from "@/components/auth/RequireSupervisor";
import SupervisorDashboard from "@/components/dashboard/SupervisorDashboard";

export default function Page() {
  return (
    <RequireSupervisor>
      <SupervisorDashboard />
    </RequireSupervisor>
  );
}
