import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { computeEventResults } from "@/lib/results";

// Results are organizer-only for now. T3 introduces "hidden results during
// voting" as a public-facing concept — that's out of scope here, not
// silently skipped.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can view results" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only this event's organizer can do that" }, { status: 403 });
  }

  const results = await computeEventResults(params.id);
  if (results === null) {
    return NextResponse.json({ error: "No rubric set for this event yet" }, { status: 400 });
  }

  return NextResponse.json(results);
}
