"use client";

import TenantAssignmentsPage from "@/app/[tenantUuid]/assignments/page";
import { useAuthStore } from "@/store/useAuthStore";
import { useMemo } from "react";

export default function AssignmentsDefaultPage() {
  const { role, user, tenantUuid } = useAuthStore();

  const targetTenantUuid = useMemo(() => {
    if (role === "CHANNEL_ADMIN" || role === "TRANSACTIONAL_USER") {
      return user?.tenant_id || tenantUuid || "platform";
    }
    return tenantUuid || "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f";
  }, [role, user, tenantUuid]);

  const mockParams = useMemo(
    () => Promise.resolve({ tenantUuid: targetTenantUuid }),
    [targetTenantUuid]
  );

  return <TenantAssignmentsPage params={mockParams} />;
}
