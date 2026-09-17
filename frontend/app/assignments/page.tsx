import TenantAssignmentsPage from "@/app/[tenantUuid]/assignments/page";

export default function AssignmentsDefaultPage() {
  const mockParams = Promise.resolve({ tenantUuid: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f" });
  return <TenantAssignmentsPage params={mockParams} />;
}
