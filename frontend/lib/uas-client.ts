/**
 * Universal Authentication Server (UAS) Client
 * Cryptographic challenge-response zero-password proof generator with auto-generated role navigation.
 */

export interface NavItemNode {
  name: string;
  href: string;
  icon: string;
  badge?: string;
  badgeType?: "brand" | "emerald" | "amber" | "rose" | "warning" | "success" | "neutral" | "danger";
}

export interface NavGroupNode {
  title: string;
  items: NavItemNode[];
}

export interface ChallengePayload {
  nonce_id: string;
  nonce: string;
  salt: string;
  challenge_type: string;
  tenant_uuid?: string;
  tenant_name?: string;
  role?: string;
  email?: string;
  expires_in_seconds: number;
}

export interface AuthSessionResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in_minutes: number;
  tenant_uuid?: string;
  user_id: string;
  username: string;
  role: string;
  permissions: string[];
  role_nodes?: NavGroupNode[];
}

export interface UserProfile {
  user_id: string;
  username: string;
  email?: string;
  tenant_id?: string;
  role: string;
  permissions: string[];
  role_nodes?: NavGroupNode[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

/** Computes SHA-256 hex string using native Web Crypto API */
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Computes HMAC-SHA256 signature using native Web Crypto API */
async function hmacSha256(keyHex: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(keyHex);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Computes client challenge proof without sending raw password over network */
export async function computeChallengeProof(password: string, salt: string, nonce: string): Promise<string> {
  const passwordHash = await sha256Hex(`${password}:${salt}`);
  return await hmacSha256(passwordHash, nonce);
}

/** Requests dynamic cryptographic nonce challenge and resolves tenant scope context */
export async function requestAuthChallenge(username: string, tenantId?: string): Promise<ChallengePayload> {
  const response = await fetch(`${API_BASE}/api/v1/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, tenant_id: tenantId }),
  });
  if (!response.ok) {
    throw new Error("Failed to obtain authentication challenge from UAS.");
  }
  return (await response.json()) as ChallengePayload;
}

/** Verifies challenge proof signature and obtains scoped session JWT with role_nodes */
export async function verifyAuthChallenge(
  username: string,
  nonceId: string,
  proofSignature: string,
  tenantId?: string,
  mfaCode?: string
): Promise<AuthSessionResponse> {
  const response = await fetch(`${API_BASE}/api/v1/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      nonce_id: nonceId,
      proof_signature: proofSignature,
      tenant_id: tenantId,
      mfa_code: mfaCode,
    }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message ?? "Authentication failed: invalid credentials or expired challenge.");
  }
  return (await response.json()) as AuthSessionResponse;
}

/** Fetches active authenticated user profile and authorized role navigation tree */
export async function fetchAuthenticatedProfile(token: string): Promise<UserProfile> {
  const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch user session profile.");
  }
  return (await response.json()) as UserProfile;
}
