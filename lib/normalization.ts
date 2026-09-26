// Pure function, no DB access — same reasoning as lib/assignment.ts.
// Implements the z-score normalization method documented in JUDGING.md.

export type RawScore = {
  judgeId: string;
  submissionId: string;
  // The judge's weighted total for this submission (already combines all
  // rubric criteria for one judge-submission pair).
  weightedTotal: number;
};

export type NormalizedResult = {
  submissionId: string;
  normalizedScore: number;
  judgeCount: number;
};

/**
 * Normalizes raw weighted scores across judges so that a harsh judge and a
 * generous judge contribute fairly to the same ranking.
 *
 * For each judge: compute their mean and population standard deviation
 * across all submissions they scored, then convert each of their scores
 * to a z-score: (raw - mean) / stddev.
 *
 * A submission's normalized score is the average z-score it received
 * across all judges who scored it.
 *
 * Edge case: a judge with zero variance (scored everything identically)
 * has an undefined z-score. Per JUDGING.md, that judge's contribution is
 * treated as neutral (0) for every score they gave, rather than dividing
 * by zero or crashing.
 */
export function normalizeScores(rawScores: RawScore[]): NormalizedResult[] {
  const scoresByJudge = new Map<string, RawScore[]>();
  for (const score of rawScores) {
    const list = scoresByJudge.get(score.judgeId) ?? [];
    list.push(score);
    scoresByJudge.set(score.judgeId, list);
  }

  const zScoreByJudgeAndSubmission = new Map<string, number>();

  for (const [, scores] of scoresByJudge) {
    const mean = average(scores.map((s) => s.weightedTotal));
    const stddev = populationStdDev(scores.map((s) => s.weightedTotal), mean);

    for (const score of scores) {
      const key = `${score.judgeId}::${score.submissionId}`;
      const z = stddev === 0 ? 0 : (score.weightedTotal - mean) / stddev;
      zScoreByJudgeAndSubmission.set(key, z);
    }
  }

  const zScoresBySubmission = new Map<string, number[]>();
  for (const score of rawScores) {
    const key = `${score.judgeId}::${score.submissionId}`;
    const z = zScoreByJudgeAndSubmission.get(key)!;
    const list = zScoresBySubmission.get(score.submissionId) ?? [];
    list.push(z);
    zScoresBySubmission.set(score.submissionId, list);
  }

  const results: NormalizedResult[] = [];
  for (const [submissionId, zScores] of zScoresBySubmission) {
    results.push({
      submissionId,
      normalizedScore: average(zScores),
      judgeCount: zScores.length
    });
  }

  return results.sort((a, b) => b.normalizedScore - a.normalizedScore);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function populationStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}
