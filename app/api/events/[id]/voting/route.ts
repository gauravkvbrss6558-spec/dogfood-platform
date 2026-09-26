import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";

const VotingConfigSchema = z.object({
  votingEnabled: z.boolean(),
  votingOpensAt: z.string().datetime().optional().nullable(),
  votingClosesAt: z.string().datetime().optional().nullable()
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const event = await prisma.event.findUnique({
    where: { id: params.id },
    select: { votingEnabled: true, votingOpensAt: true, votingClosesAt: true }
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can configure voting" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only this event's organizer can do that" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = VotingConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  if (
    parsed.data.votingOpensAt &&
    parsed.data.votingClosesAt &&
    new Date(parsed.data.votingOpensAt) >= new Date(parsed.data.votingClosesAt)
  ) {
    return NextResponse.json(
      { error: "Voting must open before it closes" },
      { status: 400 }
    );
  }

  const updated = await prisma.event.update({
    where: { id: params.id },
    data: {
      votingEnabled: parsed.data.votingEnabled,
      votingOpensAt: parsed.data.votingOpensAt ? new Date(parsed.data.votingOpensAt) : null,
      votingClosesAt: parsed.data.votingClosesAt ? new Date(parsed.data.votingClosesAt) : null
    },
    select: { votingEnabled: true, votingOpensAt: true, votingClosesAt: true }
  });

  return NextResponse.json(updated);
}
