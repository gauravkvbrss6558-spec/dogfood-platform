import { describe, it, expect } from "vitest";
import { seededShuffle } from "../lib/shuffle";

describe("seededShuffle", () => {
  it("is deterministic for the same seed", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const first = seededShuffle(items, "user-123");
    const second = seededShuffle(items, "user-123");
    expect(first).toEqual(second);
  });

  it("produces a different order for different seeds (usually)", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = seededShuffle(items, "seed-a");
    const b = seededShuffle(items, "seed-b");
    expect(a).not.toEqual(b);
  });

  it("preserves all original elements exactly once", () => {
    const items = ["a", "b", "c", "d", "e"];
    const shuffled = seededShuffle(items, "any-seed");
    expect([...shuffled].sort()).toEqual([...items].sort());
    expect(shuffled).toHaveLength(items.length);
  });

  it("does not mutate the original array", () => {
    const items = ["a", "b", "c"];
    const original = [...items];
    seededShuffle(items, "seed");
    expect(items).toEqual(original);
  });

  it("handles empty and single-element arrays without error", () => {
    expect(seededShuffle([], "seed")).toEqual([]);
    expect(seededShuffle(["only"], "seed")).toEqual(["only"]);
  });
});
