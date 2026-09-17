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
    contact_email: "channel.admin@boi.com",
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
  {
    id: "393dca9c-1d29-4976-8a40-6d08c481559b",
    name: "sagar",
    code: "tenant-sagar",
    tenant_uuid: "393dca9c-1d29-4976-8a40-6d08c481559b",
    channel_type: "DSA",
    status: "active",
    cibil_overlay: 10,
    contact_email: "sagaranbu16@gmail.com",
    contact_phone: "+91 97654 32190",
    evaluation_count_24h: 210,
    mean_latency_ms: 15.6,
    created_at: "2026-08-18T18:20:00Z",
  },
  {
    id: "f262420e-bdbc-45c5-bd07-83353c1795fb",
    name: "vidhya",
    code: "tenant-vidhya",
    tenant_uuid: "f262420e-bdbc-45c5-bd07-83353c1795fb",
    channel_type: "BANK_BRANCH",
    status: "active",
    cibil_overlay: 20,
    contact_email: "vidhyaasagaranbarasan@gmail.com",
    contact_phone: "+91 99112 33445",
    evaluation_count_24h: 340,
    mean_latency_ms: 16.2,
    created_at: "2026-08-17T11:15:00Z",
  },
  {
    id: "686172e9-51db-47c2-ba4f-0448923465f0",
    name: "TCS",
    code: "tenant-tcs",
    tenant_uuid: "686172e9-51db-47c2-ba4f-0448923465f0",
    channel_type: "DEALER_PARTNER",
    status: "active",
    cibil_overlay: 10,
    contact_email: "tcs@gmail.com",
    contact_phone: "+91 98111 22334",
    evaluation_count_24h: 120,
    mean_latency_ms: 19.1,
    created_at: "2026-08-15T09:00:00Z",
  },
  {
    id: "8b04f54c-d45a-4bd3-bac4-f9f33391c2b4",
    name: "HCL",
    code: "tenant-hcl",
    tenant_uuid: "8b04f54c-d45a-4bd3-bac4-f9f33391c2b4",
    channel_type: "FINTECH_PARTNER",
    status: "active",
    cibil_overlay: 15,
    contact_email: "hcl@gmail.com",
    contact_phone: "+91 98111 55667",
    evaluation_count_24h: 450,
    mean_latency_ms: 13.8,
    created_at: "2026-08-16T12:00:00Z",
  },
  {
    id: "125047c2-25d9-49a5-990f-6db76fa0c18e",
    name: "zoho",
    code: "tenant-zoho",
    tenant_uuid: "125047c2-25d9-49a5-990f-6db76fa0c18e",
    channel_type: "FINTECH_PARTNER",
    status: "active",
    cibil_overlay: 10,
    contact_email: "demo@gmail.com",
    contact_phone: "+91 98111 88990",
    evaluation_count_24h: 670,
    mean_latency_ms: 14.5,
    created_at: "2026-08-17T15:30:00Z",
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
  return INITIAL_TENANTS.find(
    (t) =>
      t.tenant_uuid.toLowerCase() === lower ||
      t.code.toLowerCase() === lower ||
      t.id.toLowerCase() === lower ||
      t.name.toLowerCase() === lower
  );
}
