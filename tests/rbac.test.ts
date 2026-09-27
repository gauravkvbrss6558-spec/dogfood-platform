import { describe, it, expect } from "vitest";
import { hasRole } from "../lib/roles";

describe("hasRole", () => {
  it("returns true when the role is in the allowed list", () => {
    expect(hasRole("ORGANIZER", ["ORGANIZER", "ADMIN"])).toBe(true);
  });

  it("returns false when the role is not in the allowed list", () => {
    expect(hasRole("PARTICIPANT", ["ORGANIZER", "ADMIN"])).toBe(false);
  });

  it("returns false when there is no role (logged-out user)", () => {
    expect(hasRole(undefined, ["ORGANIZER", "ADMIN"])).toBe(false);
  });
});
