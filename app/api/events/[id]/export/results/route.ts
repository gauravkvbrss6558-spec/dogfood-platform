import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeEventResults } from "@/lib/results";
import { toCsv } from "@/lib/csv";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can export data" }, { status: 403 });
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

  const rows = results.map((r, i) => ({ rank: i + 1, ...r }));
  const csv = toCsv(rows, [
    "rank",
    "title",
    "teamName",
    "trackName",
    "normalizedScore",
    "judgeCount"
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="results.csv"`
    }
  });
}
