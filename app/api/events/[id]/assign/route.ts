import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { assignJudges } from "@/lib/assignment";
import { dispatchWebhook } from "@/lib/webhookDispatch";

const AssignSchema = z.object({
  judgesPerSubmission: z.number().int().min(1).max(10).default(3),
  // Re-running assignment deletes existing assignments (and their scores,
  // via cascade). Require an explicit opt-in so an organizer can't nuke
  // in-progress judging by accident.
  force: z.boolean().optional().default(false)
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can run assignment" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only this event's organizer can do that" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = AssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { judgesPerSubmission, force } = parsed.data;

  const existingCount = await prisma.judgeAssignment.count({ where: { eventId: params.id } });
  if (existingCount > 0 && !force) {
    return NextResponse.json(
      { error: `${existingCount} assignments already exist. Pass force: true to reset and re-run.` },
      { status: 409 }
    );
  }

  const rubric = await prisma.rubric.findUnique({ where: { eventId: params.id } });
  if (!rubric) {
    return NextResponse.json(
      { error: "Set a rubric before running assignment" },
      { status: 400 }
    );
  }

  const [judges, submissions] = await Promise.all([
    prisma.eventJudge.findMany({ where: { eventId: params.id }, select: { userId: true } }),
    prisma.submission.findMany({
      where: { status: "SUBMITTED", team: { eventId: params.id } },
      select: { id: true, team: { select: { members: { select: { userId: true } } } } }
    })
  ]);

  if (judges.length === 0) {
    return NextResponse.json({ error: "Invite at least one judge first" }, { status: 400 });
  }
  if (submissions.length === 0) {
    return NextResponse.json({ error: "No submitted projects to assign yet" }, { status: 400 });
  }

  const conflictsBySubmission: Record<string, Set<string>> = {};
  for (const s of submissions) {
    conflictsBySubmission[s.id] = new Set(s.team.members.map((m) => m.userId));
  }

  const assignments = assignJudges({
    judgeIds: judges.map((j) => j.userId),
    submissionIds: submissions.map((s) => s.id),
    conflictsBySubmission,
    judgesPerSubmission
  });

  await prisma.$transaction(async (tx) => {
    if (force) {
      await tx.judgeAssignment.deleteMany({ where: { eventId: params.id } });
    }
    await tx.judgeAssignment.createMany({
      data: assignments.map((a) => ({
        eventId: params.id,
        judgeId: a.judgeId,
        submissionId: a.submissionId
      }))
    });
  });

  const underAssigned = submissions.filter(
    (s) => assignments.filter((a) => a.submissionId === s.id).length < judgesPerSubmission
  );

  await dispatchWebhook(params.id, "JUDGES_ASSIGNED", {
    assignmentsCreated: assignments.length,
    submissionsCovered: submissions.length,
    judgesUsed: judges.length
  });

  return NextResponse.json({
    created: assignments.length,
    submissionsCovered: submissions.length,
    judgesUsed: judges.length,
    warning:
      underAssigned.length > 0
        ? `${underAssigned.length} submission(s) got fewer than ${judgesPerSubmission} judges due to conflicts of interest (e.g. all eligible judges are on that team).`
        : null
  });
}
