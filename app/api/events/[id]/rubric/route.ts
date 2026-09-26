import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";

const RubricSchema = z.object({
  criteria: z
    .array(
      z.object({
        name: z.string().min(1),
        weight: z.number().min(0).max(1),
        maxScore: z.number().int().min(1).default(10)
      })
    )
    .min(1),
  // Re-saving a rubric deletes its criteria and, via cascade, any scores
  // already entered against them. Require an explicit opt-in once scoring
  // has started, the same pattern used by the assign endpoint's `force`
  // flag, so an organizer can't lose judge work by accident.
  force: z.boolean().optional().default(false)
});

async function assertOwnsEvent(eventId: string, userId: string, role: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false as const, status: 404, error: "Event not found" };
  if (event.organizerId !== userId && role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Only this event's organizer can do that" };
  }
  return { ok: true as const, event };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const rubric = await prisma.rubric.findUnique({
    where: { eventId: params.id },
    include: { criteria: true }
  });
  return NextResponse.json(rubric);
}

// Replaces the event's rubric wholesale. Simpler and less error-prone than
// patching individual criteria, and rubrics are expected to be finalized
// before judging opens rather than edited incrementally.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can set a rubric" }, { status: 403 });
  }

  const ownership = await assertOwnsEvent(params.id, session!.user.id, session!.user.role);
  if (!ownership.ok) {
    return NextResponse.json({ error: ownership.error }, { status: ownership.status });
  }

  const body = await req.json();
  const parsed = RubricSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const totalWeight = parsed.data.criteria.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(totalWeight - 1) > 0.01) {
    return NextResponse.json(
      { error: `Criteria weights must sum to 1.0 (got ${totalWeight.toFixed(2)})` },
      { status: 400 }
    );
  }

  const existingScoreCount = await prisma.score.count({
    where: { criterion: { rubric: { eventId: params.id } } }
  });
  if (existingScoreCount > 0 && !parsed.data.force) {
    return NextResponse.json(
      {
        error: `${existingScoreCount} score(s) already exist against the current rubric. Replacing it will permanently delete them. Pass force: true to proceed anyway.`
      },
      { status: 409 }
    );
  }

  // Wipe and recreate — a rubric is small (a handful of criteria), so this
  // is simpler and safer than diffing individual rows, and it's wrapped in
  // a transaction so a failed create can't leave the rubric half-deleted.
  const rubric = await prisma.$transaction(async (tx) => {
    await tx.rubric.deleteMany({ where: { eventId: params.id } });
    return tx.rubric.create({
      data: {
        eventId: params.id,
        criteria: { create: parsed.data.criteria }
      },
      include: { criteria: true }
    });
  });

  return NextResponse.json(rubric, { status: 201 });
}
