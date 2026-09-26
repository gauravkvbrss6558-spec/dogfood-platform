import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { getServerKeypair } from "@/lib/keys";
import { signRecord, encodeRecordToken } from "@/lib/certRecord";

export async function GET(_req: Request, { params }: { params: { id: string; userId: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be logged in" }, { status: 401 });

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const isSelf = session.user.id === params.userId;
  const isOrganizer = event.organizerId === session.user.id;
  if (!isSelf && !isOrganizer && !hasRole(session.user.role, ["ADMIN"])) {
    return NextResponse.json({ error: "You can only generate your own record" }, { status: 403 });
  }

  const eventJudge = await prisma.eventJudge.findUnique({
    where: { eventId_userId: { eventId: params.id, userId: params.userId } },
    include: { user: true }
  });
  if (!eventJudge) {
    return NextResponse.json({ error: "This person did not judge this event" }, { status: 400 });
  }

  const assignments = await prisma.judgeAssignment.findMany({
    where: { eventId: params.id, judgeId: params.userId },
    include: { scores: true }
  });
  const rubric = await prisma.rubric.findUnique({
    where: { eventId: params.id },
    include: { criteria: true }
  });
  const criterionCount = rubric?.criteria.length ?? 0;
  const completedCount = assignments.filter(
    (a) => criterionCount > 0 && a.scores.length >= criterionCount
  ).length;

  // The record only claims what's actually verifiable from the database
  // at issuance time — "completed N of M assigned reviews" rather than a
  // vaguer "participated as a judge," so the certificate itself carries
  // real information, not just a badge.
  const payload = {
    type: "JUDGE" as const,
    recipientName: eventJudge.user.name,
    eventName: event.name,
    eventId: event.id,
    assignmentsCompleted: completedCount,
    assignmentsTotal: assignments.length,
    invitedAt: eventJudge.invitedAt.toISOString(),
    issuedAt: new Date().toISOString()
  };

  const { privateKey } = await getServerKeypair();
  const record = signRecord(payload, privateKey);
  const token = encodeRecordToken(record);

  return NextResponse.json({ token, payload });
}
