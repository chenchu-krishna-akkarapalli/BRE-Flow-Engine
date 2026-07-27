/** PII redaction, mirroring app/core/logging.py exactly.
 *
 * Applied before anything reaches a logging hook or the review card's default
 * view. The masks must match the backend byte for byte, so a support ticket
 * quoting a masked PAN matches what the audit trail stored. */

/** ABCDE1234F -> AB******4F */
export function redactPan(pan: string): string {
  if (!pan || pan.length < 10) return "****";
  return `${pan.slice(0, 2)}******${pan.slice(-2)}`;
}

/** 1990-05-15 -> ****-**-15 */
export function redactDob(dob: string): string {
  if (!dob || dob.length < 10) return "****-**-**";
  return `****-**-${dob.slice(-2)}`;
}

/** 123412341234 -> ****-****-1234 */
export function redactAadhaar(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `****-****-${digits.slice(-4)}` : "****";
}

const PAN_KEY = /pan/i;
const DOB_KEY = /dob|dateofbirth|joining|formationdate|establishmentdate/i;
const AADHAAR_KEY = /aadhaar/i;

/** Deep-clone a payload with every PII field masked by key name. */
export function redactPii<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === "string" && PAN_KEY.test(key)) out[key] = redactPan(val);
      else if (typeof val === "string" && DOB_KEY.test(key)) out[key] = redactDob(val);
      else if (typeof val === "string" && AADHAAR_KEY.test(key)) out[key] = redactAadhaar(val);
      else if (val !== null && typeof val === "object") out[key] = redactPii(val);
      else out[key] = val;
    }
    return out as T;
  }
  return value;
}
