import { describe, it, expect } from "vitest";
import { assignJudges } from "../lib/assignment";

describe("assignJudges", () => {
  it("assigns the requested number of judges to each submission", () => {
    const result = assignJudges({
      judgeIds: ["j1", "j2", "j3"],
      submissionIds: ["s1", "s2", "s3", "s4"],
      conflictsBySubmission: {},
      judgesPerSubmission: 2
    });

    const bySubmission = new Map<string, number>();
    for (const a of result) {
      bySubmission.set(a.submissionId, (bySubmission.get(a.submissionId) ?? 0) + 1);
    }
    for (const s of ["s1", "s2", "s3", "s4"]) {
      expect(bySubmission.get(s)).toBe(2);
    }
  });

  it("never assigns a judge to a submission they conflict with", () => {
    const result = assignJudges({
      judgeIds: ["j1", "j2"],
      submissionIds: ["s1"],
      conflictsBySubmission: { s1: new Set(["j1"]) },
      judgesPerSubmission: 2
    });

    // Only j2 is eligible, so s1 should get exactly one assignment, not two.
    expect(result).toEqual([{ judgeId: "j2", submissionId: "s1" }]);
  });

  it("balances load roughly evenly across judges", () => {
    const judgeIds = ["j1", "j2", "j3", "j4"];
    const submissionIds = Array.from({ length: 20 }, (_, i) => `s${i}`);

    const result = assignJudges({
      judgeIds,
      submissionIds,
      conflictsBySubmission: {},
      judgesPerSubmission: 2
    });

    const loadByJudge = new Map<string, number>();
    for (const a of result) {
      loadByJudge.set(a.judgeId, (loadByJudge.get(a.judgeId) ?? 0) + 1);
    }

    const loads = judgeIds.map((j) => loadByJudge.get(j) ?? 0);
    // 20 submissions * 2 judges each = 40 assignment slots / 4 judges = 10 each exactly.
    for (const load of loads) {
      expect(load).toBe(10);
    }
  });

  it("returns no assignments for a submission with no eligible judges", () => {
    const result = assignJudges({
      judgeIds: ["j1"],
      submissionIds: ["s1"],
      conflictsBySubmission: { s1: new Set(["j1"]) },
      judgesPerSubmission: 1
    });
    expect(result).toEqual([]);
  });
});
