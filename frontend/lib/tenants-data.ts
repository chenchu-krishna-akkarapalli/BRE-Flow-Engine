export type TenantLifecycleStatus = "pending" | "under_review" | "active" | "suspended" | "rejected";

export interface TenantRecord {
  id: string;
  name: string;
  code: string;
  tenant_uuid: string;
  channel_type: string;
  status: TenantLifecycleStatus;
  cibil_overlay: number;
  contact_email: string;
  contact_phone: string;
  evaluation_count_24h: number;
  mean_latency_ms: number;
  created_at: string;
}

export interface StatusAuditEntry {
  id: string;
  tenant_name: string;
  tenant_uuid: string;
  previous_status: string;
  new_status: string;
  changed_by: string;
  reason: string;
  timestamp: string;
}

export const INITIAL_TENANTS: TenantRecord[] = [
  {
    id: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f",
    name: "Bank of India Channel",
    code: "boi-channel-north",
    tenant_uuid: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f",
    channel_type: "DSA",
    status: "active",
    cibil_overlay: 10,
    contact_email: "super.admin@flowbre.com",
    contact_phone: "+91 98765 43210",
    evaluation_count_24h: 1482,
    mean_latency_ms: 18.4,
    created_at: "2026-08-10T10:00:00Z",
  },
  {
    id: "681cc219-8f42-4c7c-bc29-377a40c750b8",
    name: "Apex FinTech Punjab",
    code: "apex-fintech-punjab",
    tenant_uuid: "681cc219-8f42-4c7c-bc29-377a40c750b8",
    channel_type: "FINTECH_PARTNER",
    status: "active",
    cibil_overlay: 15,
    contact_email: "partner@apex-punjab.in",
    contact_phone: "+91 98222 11100",
    evaluation_count_24h: 3290,
    mean_latency_ms: 14.1,
    created_at: "2026-08-12T14:30:00Z",
  },
];

export const INITIAL_AUDIT_LOGS: StatusAuditEntry[] = [
  {
    id: "aud-01",
    tenant_name: "Apex FinTech Punjab",
    tenant_uuid: "681cc219-8f42-4c7c-bc29-377a40c750b8",
    previous_status: "pending",
    new_status: "active",
    changed_by: "super.admin@flowbre.com",
    reason: "Legal verification completed. Approved with +15 CIBIL overlay margin.",
    timestamp: "2026-08-18 19:40:12",
  },
  {
    id: "aud-02",
    tenant_name: "Bank of India Channel",
    tenant_uuid: "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f",
    previous_status: "under_review",
    new_status: "active",
    changed_by: "ops.head@flowbre.com",
    reason: "Approved and provisioned navigation nodes.",
    timestamp: "2026-08-12 15:00:00",
  },
];

export function getTenantByUuidOrCode(identifier: string): TenantRecord | undefined {
  if (!identifier) return undefined;
  const lower = identifier.toLowerCase();
  const stripped = lower.startsWith("tenant-") ? lower.replace("tenant-", "") : lower;
  return INITIAL_TENANTS.find(
    (t) =>
      t.tenant_uuid.toLowerCase() === lower ||
      t.code.toLowerCase() === lower ||
      t.id.toLowerCase() === lower ||
      t.name.toLowerCase() === lower ||
      t.code.toLowerCase() === stripped ||
      t.code.toLowerCase() === `tenant-${stripped}` ||
      t.name.toLowerCase() === stripped
  );
}
