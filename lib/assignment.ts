// Pure function, no DB access — this makes the assignment logic itself
// unit-testable and auditable independent of Prisma. The API route that
// calls this is responsible for loading judges/submissions and persisting
// the result.

export type AssignmentInput = {
  judgeIds: string[];
  submissionIds: string[];
  // Maps a submission to the set of user ids who should never judge it
  // (its own team members), even if they hold the JUDGE role for other
  // submissions.
  conflictsBySubmission: Record<string, Set<string>>;
  // How many distinct judges each submission should receive.
  judgesPerSubmission: number;
};

export type Assignment = { judgeId: string; submissionId: string };

/**
 * Assigns judges to submissions with two goals, in priority order:
 *   1. No judge is ever assigned to a submission they have a conflict with
 *      (e.g. their own team's project).
 *   2. Load is spread as evenly as possible across judges — no judge should
 *      end up with substantially more submissions than another when a more
 *      balanced assignment was possible.
 *
 * Approach: for each submission (in order), pick the `judgesPerSubmission`
 * eligible judges who currently have the fewest assignments so far
 * (ties broken by judge order). This greedy least-loaded strategy is easy
 * to explain and reproduce by hand, which matters more for a judging
 * system than a marginally more optimal but opaque algorithm.
 */
export function assignJudges({
  judgeIds,
  submissionIds,
  conflictsBySubmission,
  judgesPerSubmission
}: AssignmentInput): Assignment[] {
  const assignments: Assignment[] = [];
  const loadByJudge = new Map<string, number>(judgeIds.map((id) => [id, 0]));

  for (const submissionId of submissionIds) {
    const conflicts = conflictsBySubmission[submissionId] ?? new Set<string>();
    const eligible = judgeIds.filter((id) => !conflicts.has(id));

    // Sort eligible judges by current load (ascending), stable on original order.
    const sorted = [...eligible].sort(
      (a, b) => (loadByJudge.get(a) ?? 0) - (loadByJudge.get(b) ?? 0)
    );

    const chosen = sorted.slice(0, judgesPerSubmission);

    for (const judgeId of chosen) {
      assignments.push({ judgeId, submissionId });
      loadByJudge.set(judgeId, (loadByJudge.get(judgeId) ?? 0) + 1);
    }
  }

  return assignments;
}
