import TenantAssignmentsPage from "@/app/[tenantUuid]/assignments/page";

export default function PlatformUserManagementPage() {
  const mockParams = Promise.resolve({ tenantUuid: "platform" });
  return <TenantAssignmentsPage params={mockParams} />;
}
