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
    return NextResponse.json({ error: "You can only generate your own certificate" }, { status: 403 });
  }

  const membership = await prisma.teamMember.findFirst({
    where: { userId: params.userId, team: { eventId: params.id } },
    include: { team: { include: { submission: true } }, user: true }
  });

  if (!membership || membership.team.submission?.status !== "SUBMITTED") {
    return NextResponse.json(
      { error: "This person has no submitted project for this event, so no certificate can be issued" },
      { status: 400 }
    );
  }

  const payload = {
    type: "PARTICIPATION" as const,
    recipientName: membership.user.name,
    eventName: event.name,
    eventId: event.id,
    teamName: membership.team.name,
    projectTitle: membership.team.submission.title,
    issuedAt: new Date().toISOString()
  };

  const { privateKey } = await getServerKeypair();
  const record = signRecord(payload, privateKey);
  const token = encodeRecordToken(record);

  return NextResponse.json({ token, payload });
}
