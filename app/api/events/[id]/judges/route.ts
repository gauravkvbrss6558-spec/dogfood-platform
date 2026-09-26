import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";

const InviteJudgeSchema = z.object({
  email: z.string().email()
});

async function assertOwnsEvent(eventId: string, userId: string, role: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false as const, status: 404, error: "Event not found" };
  if (event.organizerId !== userId && role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Only this event's organizer can do that" };
  }
  return { ok: true as const };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can view judges" }, { status: 403 });
  }
  const ownership = await assertOwnsEvent(params.id, session!.user.id, session!.user.role);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const judges = await prisma.eventJudge.findMany({
    where: { eventId: params.id },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  return NextResponse.json(judges);
}

// Invites an *existing* account to judge this event. We deliberately don't
// auto-create accounts here — a judge should go through the same
// registration flow as everyone else, so their password is their own and
// never passes through the organizer.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can invite judges" }, { status: 403 });
  }
  const ownership = await assertOwnsEvent(params.id, session!.user.id, session!.user.role);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const body = await req.json();
  const parsed = InviteJudgeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json(
      { error: "No account with that email. They need to register first." },
      { status: 404 }
    );
  }

  const existing = await prisma.eventJudge.findUnique({
    where: { eventId_userId: { eventId: params.id, userId: user.id } }
  });
  if (existing) {
    return NextResponse.json({ error: "This person is already judging this event" }, { status: 409 });
  }

  const eventJudge = await prisma.eventJudge.create({
    data: { eventId: params.id, userId: user.id },
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  // Cosmetic role bump: gives them the JUDGE badge in the nav bar. Access
  // control for judging routes always checks EventJudge membership
  // directly (see app/api/events/[id]/assignments/route.ts), never just
  // this global role, so a user can safely judge one event and participate
  // in another without a conflict.
  if (user.role === "PARTICIPANT") {
    await prisma.user.update({ where: { id: user.id }, data: { role: "JUDGE" } });
  }

  return NextResponse.json(eventJudge, { status: 201 });
}
