"use client";

import { use } from "react";
import { ProfileSettingsView } from "@/components/ProfileSettingsView";

export default function TenantProfilePage({
  params,
}: {
  params: Promise<{ tenantUuid: string }>;
}) {
  const { tenantUuid } = use(params);
  return <ProfileSettingsView tenantUuid={tenantUuid} />;
}
