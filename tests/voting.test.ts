import { describe, it, expect } from "vitest";
import { isVotingOpen, shouldHideResults } from "../lib/voting";

const now = new Date("2026-06-15T12:00:00Z");

describe("isVotingOpen", () => {
  it("is false when voting is not enabled at all", () => {
    expect(isVotingOpen({ votingEnabled: false, votingOpensAt: null, votingClosesAt: null }, now)).toBe(false);
  });

  it("is true when enabled with no date bounds", () => {
    expect(isVotingOpen({ votingEnabled: true, votingOpensAt: null, votingClosesAt: null }, now)).toBe(true);
  });

  it("is false before the opening date", () => {
    const config = {
      votingEnabled: true,
      votingOpensAt: new Date("2026-06-20T00:00:00Z"),
      votingClosesAt: null
    };
    expect(isVotingOpen(config, now)).toBe(false);
  });

  it("is false after the closing date", () => {
    const config = {
      votingEnabled: true,
      votingOpensAt: null,
      votingClosesAt: new Date("2026-06-10T00:00:00Z")
    };
    expect(isVotingOpen(config, now)).toBe(false);
  });

  it("is true strictly between open and close dates", () => {
    const config = {
      votingEnabled: true,
      votingOpensAt: new Date("2026-06-01T00:00:00Z"),
      votingClosesAt: new Date("2026-06-30T00:00:00Z")
    };
    expect(isVotingOpen(config, now)).toBe(true);
  });
});

describe("shouldHideResults", () => {
  it("hides results exactly when voting is open", () => {
    const openConfig = { votingEnabled: true, votingOpensAt: null, votingClosesAt: null };
    const closedConfig = { votingEnabled: false, votingOpensAt: null, votingClosesAt: null };
    expect(shouldHideResults(openConfig, now)).toBe(true);
    expect(shouldHideResults(closedConfig, now)).toBe(false);
  });
});
