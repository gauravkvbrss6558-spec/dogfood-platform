import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";

// GET /api/judge/scores            -> caller's own scores (must be a JUDGE)
// GET /api/judge/scores?judge=<id> -> that judge's scores, but ONLY if the
//                                     caller IS that judge. Anyone else,
//                                     including another judge, gets 403.
//
// This single route backs both .dogfood.toml routes: `judge_scores` points
// here with no query, `peer_scores` points here with judge_a's id baked
// in — so when judge_b hits peer_scores, the id in the URL doesn't match
// judge_b's own session, and the isolation check below refuses it.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  if (session.user.role !== "JUDGE") {
    return NextResponse.json({ error: "Judges only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestedJudgeId = searchParams.get("judge");

  // No target specified: default to "my own scores".
  const targetJudgeId = requestedJudgeId ?? session.user.id;

  if (targetJudgeId !== session.user.id) {
    return NextResponse.json(
      { error: "You can only view your own scores" },
      { status: 403 }
    );
  }

  const assignments = await prisma.judgeAssignment.findMany({
    where: { judgeId: session.user.id },
    include: {
      submission: { select: { id: true, title: true } },
      scores: { include: { criterion: { select: { id: true, name: true } } } }
    }
  });

  const results = assignments.map((a) => ({
    assignmentId: a.id,
    submissionId: a.submission.id,
    submissionTitle: a.submission.title,
    scores: a.scores.map((s) => ({
      criterionId: s.criterion.id,
      criterionName: s.criterion.name,
      value: s.value
    })),
    completed: a.scores.length > 0
  }));

  return NextResponse.json({ judgeId: session.user.id, assignments: results });
}
