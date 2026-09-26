import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { dispatchWebhook } from "@/lib/webhookDispatch";

const ScoresSchema = z.object({
  scores: z
    .array(
      z.object({
        criterionId: z.string(),
        value: z.number().min(0)
      })
    )
    .min(1)
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const assignment = await prisma.judgeAssignment.findUnique({
    where: { id: params.id }
  });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  // The core role-isolation check: a judge can only ever write scores for
  // their own assignment, never someone else's — even if they know or
  // guess another assignment's id.
  if (assignment.judgeId !== session.user.id) {
    return NextResponse.json(
      { error: "This assignment doesn't belong to you" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = ScoresSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const criteria = await prisma.rubricCriterion.findMany({
    where: { id: { in: parsed.data.scores.map((s) => s.criterionId) } }
  });
  const criterionById = new Map(criteria.map((c) => [c.id, c]));

  for (const s of parsed.data.scores) {
    const criterion = criterionById.get(s.criterionId);
    if (!criterion) {
      return NextResponse.json({ error: `Unknown criterion ${s.criterionId}` }, { status: 400 });
    }
    if (s.value > criterion.maxScore) {
      return NextResponse.json(
        { error: `${criterion.name} score can't exceed ${criterion.maxScore}` },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction(
    parsed.data.scores.map((s) =>
      prisma.score.upsert({
        where: { assignmentId_criterionId: { assignmentId: assignment.id, criterionId: s.criterionId } },
        create: { assignmentId: assignment.id, criterionId: s.criterionId, value: s.value },
        update: { value: s.value }
      })
    )
  );

  await dispatchWebhook(assignment.eventId, "SCORE_SUBMITTED", {
    assignmentId: assignment.id,
    submissionId: assignment.submissionId,
    judgeId: assignment.judgeId
  });

  return NextResponse.json({ ok: true });
}
