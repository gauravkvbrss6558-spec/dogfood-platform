import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { generateInviteCode } from "@/lib/inviteCode";

const CreateTeamSchema = z.object({
  eventId: z.string(),
  name: z.string().min(2)
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { eventId, name } = parsed.data;

  // A participant can only be on one team per event.
  const alreadyOnTeam = await prisma.teamMember.findFirst({
    where: { userId: session.user.id, team: { eventId } }
  });
  if (alreadyOnTeam) {
    return NextResponse.json(
      { error: "You're already on a team for this event" },
      { status: 409 }
    );
  }

  const team = await prisma.team.create({
    data: {
      name,
      eventId,
      inviteCode: generateInviteCode(),
      members: {
        create: { userId: session.user.id, role: "LEADER" }
      }
    },
    include: { members: { include: { user: true } } }
  });

  return NextResponse.json(team, { status: 201 });
}
