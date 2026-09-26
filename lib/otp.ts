import crypto from "crypto";

// A 6-digit numeric code — the standard, familiar shape for an email/SMS
// OTP. Generated with crypto.randomInt (cryptographically secure), not
// Math.random(), since this is a security control, not just a display id.
export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// Hashed with SHA-256 (not bcrypt) deliberately: bcrypt's slow-by-design
// cost is there to resist offline brute-forcing of a *reused, long-lived*
// secret like a password. A 6-digit OTP has only 1,000,000 possibilities
// and expires in minutes — the real defense is the expiry and the
// rate limit on verification attempts (see the route), not hash cost.
// SHA-256 keeps verification fast, which matters more here.
export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function verifyOtpCode(code: string, hash: string): boolean {
  const candidate = Buffer.from(hashOtpCode(code));
  const expected = Buffer.from(hash);
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export type OtpRecord = {
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type OtpCheckResult = { ok: true } | { ok: false; reason: "not_found" | "expired" | "already_used" | "wrong_code" };

/**
 * Pure decision logic for "is this OTP attempt valid right now?" — given
 * the stored record (or null if none exists) and the submitted code.
 * Kept separate from the DB-fetching route so the actual rules (expiry,
 * single-use, wrong code) are unit-testable without a database.
 */
export function checkOtp(record: OtpRecord | null, submittedCode: string, now: Date): OtpCheckResult {
  if (!record) return { ok: false, reason: "not_found" };
  if (record.consumedAt) return { ok: false, reason: "already_used" };
  if (now > record.expiresAt) return { ok: false, reason: "expired" };
  if (!verifyOtpCode(submittedCode, record.codeHash)) return { ok: false, reason: "wrong_code" };
  return { ok: true };
}
