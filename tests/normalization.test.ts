import { describe, it, expect } from "vitest";
import { normalizeScores } from "../lib/normalization";

describe("normalizeScores", () => {
  it("ranks a harsh judge's high relative score above a generous judge's merely-average one", () => {
    // Judge A is harsh: scores range 2-6, mean 4.
    // Judge B is generous: scores range 8-10, mean 9.
    // Submission X got A's best score (6) — 2 stddev-ish above A's mean.
    // Submission Y got B's average score (9) — right at B's mean, z ~ 0.
    const raw = [
      { judgeId: "A", submissionId: "s-other-1", weightedTotal: 2 },
      { judgeId: "A", submissionId: "s-other-2", weightedTotal: 4 },
      { judgeId: "A", submissionId: "x", weightedTotal: 6 },
      { judgeId: "B", submissionId: "s-other-3", weightedTotal: 8 },
      { judgeId: "B", submissionId: "s-other-4", weightedTotal: 10 },
      { judgeId: "B", submissionId: "y", weightedTotal: 9 }
    ];

    const results = normalizeScores(raw);
    const x = results.find((r) => r.submissionId === "x")!;
    const y = results.find((r) => r.submissionId === "y")!;

    expect(x.normalizedScore).toBeGreaterThan(y.normalizedScore);
  });

  it("averages z-scores across multiple judges for the same submission", () => {
    const raw = [
      { judgeId: "A", submissionId: "s1", weightedTotal: 5 },
      { judgeId: "A", submissionId: "s2", weightedTotal: 10 },
      { judgeId: "B", submissionId: "s1", weightedTotal: 5 },
      { judgeId: "B", submissionId: "s2", weightedTotal: 10 }
    ];

    const results = normalizeScores(raw);
    const s1 = results.find((r) => r.submissionId === "s1")!;
    const s2 = results.find((r) => r.submissionId === "s2")!;

    expect(s1.judgeCount).toBe(2);
    expect(s2.normalizedScore).toBeGreaterThan(s1.normalizedScore);
  });

  it("treats a zero-variance judge as neutral instead of crashing", () => {
    const raw = [
      { judgeId: "flat", submissionId: "s1", weightedTotal: 7 },
      { judgeId: "flat", submissionId: "s2", weightedTotal: 7 },
      { judgeId: "flat", submissionId: "s3", weightedTotal: 7 }
    ];

    const results = normalizeScores(raw);
    for (const r of results) {
      expect(r.normalizedScore).toBe(0);
      expect(Number.isFinite(r.normalizedScore)).toBe(true);
    }
  });

  it("sorts results by normalized score descending", () => {
    const raw = [
      { judgeId: "A", submissionId: "low", weightedTotal: 1 },
      { judgeId: "A", submissionId: "mid", weightedTotal: 5 },
      { judgeId: "A", submissionId: "high", weightedTotal: 9 }
    ];
    const results = normalizeScores(raw);
    expect(results.map((r) => r.submissionId)).toEqual(["high", "mid", "low"]);
  });
});
