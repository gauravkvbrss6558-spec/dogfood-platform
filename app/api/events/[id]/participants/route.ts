import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can view this" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only this event's organizer can do that" }, { status: 403 });
  }

  const teams = await prisma.team.findMany({
    where: { eventId: params.id, submission: { status: "SUBMITTED" } },
    include: { members: { include: { user: true } } }
  });

  const participants = teams.flatMap((t) =>
    t.members.map((m) => ({ userId: m.user.id, name: m.user.name, teamName: t.name }))
  );

  return NextResponse.json(participants);
}
