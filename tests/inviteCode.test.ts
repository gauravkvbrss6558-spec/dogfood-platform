import { describe, it, expect } from "vitest";
import { generateInviteCode } from "../lib/inviteCode";

describe("generateInviteCode", () => {
  it("produces codes in the XXXX-XXXX shape", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("never includes ambiguous characters (0/O, 1/I)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it("generates different codes across calls (collision resistance sanity check)", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInviteCode()));
    // With an 8-character alphabet of 32 symbols, 500 draws should not collide.
    expect(codes.size).toBe(500);
  });
});
