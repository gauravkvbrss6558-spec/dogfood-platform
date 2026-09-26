import { prisma } from "@/lib/prisma";
import { normalizeScores, type RawScore } from "@/lib/normalization";

export type RankedResult = {
  submissionId: string;
  title: string;
  teamName: string;
  trackName: string | null;
  normalizedScore: number;
  judgeCount: number;
};

export async function computeEventResults(eventId: string): Promise<RankedResult[] | null> {
  const rubric = await prisma.rubric.findUnique({
    where: { eventId },
    include: { criteria: true }
  });
  if (!rubric) return null;

  const criterionCount = rubric.criteria.length;
  const weightByCriterion = new Map(
    rubric.criteria.map((c) => [c.id, { weight: c.weight, maxScore: c.maxScore }])
  );

  const assignments = await prisma.judgeAssignment.findMany({
    where: { eventId },
    include: { scores: true, submission: { include: { team: true } } }
  });

  const rawScores: RawScore[] = [];
  for (const a of assignments) {
    if (a.scores.length < criterionCount) continue;

    let weightedTotal = 0;
    for (const s of a.scores) {
      const c = weightByCriterion.get(s.criterionId);
      if (!c) continue;
      weightedTotal += (s.value / c.maxScore) * c.weight;
    }
    rawScores.push({ judgeId: a.judgeId, submissionId: a.submissionId, weightedTotal: weightedTotal * 10 });
  }

  const normalized = normalizeScores(rawScores);

  const submissions = await prisma.submission.findMany({
    where: { id: { in: normalized.map((r) => r.submissionId) } },
    include: { team: true, track: true }
  });
  const submissionById = new Map(submissions.map((s) => [s.id, s]));

  return normalized.map((r) => {
    const submission = submissionById.get(r.submissionId);
    return {
      submissionId: r.submissionId,
      title: submission?.title ?? "(unknown)",
      teamName: submission?.team.name ?? "(unknown)",
      trackName: submission?.track?.name ?? null,
      normalizedScore: Number(r.normalizedScore.toFixed(3)),
      judgeCount: r.judgeCount
    };
  });
}
