import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { detectSuspiciousIpClusters } from "@/lib/duplicateDetection";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can view the vote audit" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only this event's organizer can do that" }, { status: 403 });
  }

  const votes = await prisma.vote.findMany({
    where: { submission: { team: { eventId: params.id } } },
    select: { submissionId: true, voterId: true, ipHash: true }
  });

  const totalVotes = votes.length;
  const clusters = detectSuspiciousIpClusters(votes);

  return NextResponse.json({ totalVotes, suspiciousClusters: clusters });
}
