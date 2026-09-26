import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";

const CreateEventSchema = z.object({
  name: z.string().min(3),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and dashes"),
  description: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  submissionDeadline: z.string().datetime(),
  tracks: z.array(z.string()).optional().default([]),
  prizes: z
    .array(z.object({ title: z.string(), description: z.string() }))
    .optional()
    .default([])
});

// Anyone can see the list of events (needed for the public gallery).
export async function GET() {
  const events = await prisma.event.findMany({
    orderBy: { startAt: "desc" },
    include: { tracks: true, prizes: true, _count: { select: { teams: true } } }
  });
  return NextResponse.json(events);
}

// Only organizers and admins can create events. This check happens here,
// on the server — not just by hiding a button in the UI.
export async function POST(req: Request) {
  const session = await getSession();

  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json(
      { error: "Only organizers can create events" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { tracks, prizes, ...eventData } = parsed.data;

  const existingSlug = await prisma.event.findUnique({
    where: { slug: eventData.slug }
  });
  if (existingSlug) {
    return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
  }

  const event = await prisma.event.create({
    data: {
      ...eventData,
      organizerId: session!.user.id,
      tracks: { create: tracks.map((name) => ({ name })) },
      prizes: { create: prizes }
    },
    include: { tracks: true, prizes: true }
  });

  return NextResponse.json(event, { status: 201 });
}
