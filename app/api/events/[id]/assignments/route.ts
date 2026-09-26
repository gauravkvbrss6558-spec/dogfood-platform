import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";

// This is the judge's own worklist — deliberately scoped to only what
// they've been assigned. Judges never see the full submission list for an
// event through this route, only their slice, which is what "backend
// role isolation" means for judging: even a well-meaning judge can't
// accidentally (or a malicious one, deliberately) browse projects they
// weren't assigned to influence their scoring.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const isJudgeForEvent = await prisma.eventJudge.findUnique({
    where: { eventId_userId: { eventId: params.id, userId: session.user.id } }
  });
  if (!isJudgeForEvent && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "You are not a judge for this event" },
      { status: 403 }
    );
  }

  const rubric = await prisma.rubric.findUnique({
    where: { eventId: params.id },
    include: { criteria: true }
  });

  const assignments = await prisma.judgeAssignment.findMany({
    where: { eventId: params.id, judgeId: session.user.id },
    include: {
      submission: { include: { track: true } },
      scores: true
    }
  });

  return NextResponse.json({ rubric, assignments });
}
