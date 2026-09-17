"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TenantConfiguratorPage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${tenantUuid}/platformoverview`);
  }, [tenantUuid, router]);

  return null;
}
