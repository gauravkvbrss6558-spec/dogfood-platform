import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
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

  const logs = await prisma.auditLog.findMany({
    where: { hackathonEventId: params.id },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true, email: true } } }
  });

  const rows = logs.map((l) => ({
    timestamp: l.createdAt.toISOString(),
    eventType: l.eventType,
    actorName: l.actor?.name ?? "(deleted user)",
    actorEmail: l.actor?.email ?? "",
    ipHash: l.ipHash ?? "",
    metadata: l.metadata ?? ""
  }));

  const csv = toCsv(rows, ["timestamp", "eventType", "actorName", "actorEmail", "ipHash", "metadata"]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="audit-log.csv"`
    }
  });
}
