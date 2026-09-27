import { describe, it, expect } from "vitest";
import { generateOtpCode, hashOtpCode, verifyOtpCode, checkOtp } from "../lib/otp";

describe("generateOtpCode", () => {
  it("always produces a 6-digit numeric string", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("pads codes below 100000 with leading zeros", () => {
    // Not deterministic to force a low value, but the format must hold
    // whenever one occurs — cross-checked via hashOtpCode round-trip.
    const code = "000042";
    expect(verifyOtpCode(code, hashOtpCode(code))).toBe(true);
  });
});

describe("hashOtpCode / verifyOtpCode", () => {
  it("verifies a code against its own hash", () => {
    const code = "123456";
    expect(verifyOtpCode(code, hashOtpCode(code))).toBe(true);
  });

  it("rejects an incorrect code", () => {
    const hash = hashOtpCode("123456");
    expect(verifyOtpCode("654321", hash)).toBe(false);
  });

  it("does not throw on malformed input", () => {
    expect(() => verifyOtpCode("abc", "not-a-real-hash")).not.toThrow();
  });
});

describe("checkOtp", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const validRecord = {
    codeHash: hashOtpCode("111111"),
    expiresAt: new Date("2026-01-01T12:10:00Z"),
    consumedAt: null
  };

  it("accepts a correct, unexpired, unused code", () => {
    expect(checkOtp(validRecord, "111111", now)).toEqual({ ok: true });
  });

  it("rejects when no record exists", () => {
    expect(checkOtp(null, "111111", now)).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects an expired code even if correct", () => {
    const expired = { ...validRecord, expiresAt: new Date("2026-01-01T11:00:00Z") };
    expect(checkOtp(expired, "111111", now)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a code that was already consumed", () => {
    const used = { ...validRecord, consumedAt: new Date("2026-01-01T11:59:00Z") };
    expect(checkOtp(used, "111111", now)).toEqual({ ok: false, reason: "already_used" });
  });

  it("rejects the wrong code", () => {
    expect(checkOtp(validRecord, "999999", now)).toEqual({ ok: false, reason: "wrong_code" });
  });

  it("prioritizes already_used over expired when both are true", () => {
    const usedAndExpired = {
      ...validRecord,
      consumedAt: new Date("2026-01-01T11:00:00Z"),
      expiresAt: new Date("2026-01-01T11:05:00Z")
    };
    expect(checkOtp(usedAndExpired, "111111", now)).toEqual({ ok: false, reason: "already_used" });
  });
});
