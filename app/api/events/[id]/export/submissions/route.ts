import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { toCsv } from "@/lib/csv";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can export data" }, { status: 403 });
  }

  const submissions = await prisma.submission.findMany({
    where: { team: { eventId: params.id } },
    include: { team: true, track: true }
  });

  const rows = submissions.map((s) => ({
    submissionId: s.id,
    teamName: s.team.name,
    title: s.title,
    status: s.status,
    track: s.track?.name ?? "",
    repoUrl: s.repoUrl ?? "",
    demoUrl: s.demoUrl ?? "",
    submittedAt: s.submittedAt?.toISOString() ?? ""
  }));

  const csv = toCsv(rows, [
    "submissionId",
    "teamName",
    "title",
    "status",
    "track",
    "repoUrl",
    "demoUrl",
    "submittedAt"
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="submissions.csv"`
    }
  });
}
