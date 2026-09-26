import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";

const MAX_TEAM_SIZE = 4;

const JoinTeamSchema = z.object({
  inviteCode: z.string().min(4)
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = JoinTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const team = await prisma.team.findUnique({
    where: { inviteCode: parsed.data.inviteCode.trim().toUpperCase() },
    include: { members: true }
  });

  if (!team) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  if (team.members.length >= MAX_TEAM_SIZE) {
    return NextResponse.json({ error: "This team is already full" }, { status: 409 });
  }

  const alreadyOnTeam = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, team: { eventId: team.eventId } }
  });
  if (alreadyOnTeam) {
    return NextResponse.json(
      { error: "You're already on a team for this event" },
      { status: 409 }
    );
  }

  await prisma.teamMember.create({
    data: { teamId: team.id, userId: session.user.id, role: "MEMBER" }
  });

  return NextResponse.json({ teamId: team.id }, { status: 200 });
}
