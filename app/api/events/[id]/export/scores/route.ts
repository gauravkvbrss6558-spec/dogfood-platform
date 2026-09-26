import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { toCsv } from "@/lib/csv";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can export data" }, { status: 403 });
  }

  const assignments = await prisma.judgeAssignment.findMany({
    where: { eventId: params.id },
    include: {
      judge: true,
      submission: { include: { team: true } },
      scores: { include: { criterion: true } }
    }
  });

  const rows: Record<string, unknown>[] = [];
  for (const a of assignments) {
    for (const s of a.scores) {
      rows.push({
        judgeName: a.judge.name,
        judgeEmail: a.judge.email,
        teamName: a.submission.team.name,
        submissionTitle: a.submission.title,
        criterion: s.criterion.name,
        value: s.value,
        maxScore: s.criterion.maxScore,
        weight: s.criterion.weight
      });
    }
  }

  const csv = toCsv(rows, [
    "judgeName",
    "judgeEmail",
    "teamName",
    "submissionTitle",
    "criterion",
    "value",
    "maxScore",
    "weight"
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="scores-raw.csv"`
    }
  });
}
