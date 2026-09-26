import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can view judge progress" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only this event's organizer can do that" }, { status: 403 });
  }

  const rubric = await prisma.rubric.findUnique({
    where: { eventId: params.id },
    include: { criteria: true }
  });
  const criterionCount = rubric?.criteria.length ?? 0;

  const judges = await prisma.eventJudge.findMany({
    where: { eventId: params.id },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });

  const progress = await Promise.all(
    judges.map(async (j) => {
      const assignments = await prisma.judgeAssignment.findMany({
        where: { eventId: params.id, judgeId: j.userId },
        include: { scores: true }
      });
      const completed = assignments.filter(
        (a) => criterionCount > 0 && a.scores.length >= criterionCount
      ).length;

      return {
        judge: j.user,
        totalAssigned: assignments.length,
        completed,
        remaining: assignments.length - completed
      };
    })
  );

  return NextResponse.json(progress);
}
