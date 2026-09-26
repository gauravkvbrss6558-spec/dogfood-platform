import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { toCsv } from "@/lib/csv";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can export data" }, { status: 403 });
  }

  const teams = await prisma.team.findMany({
    where: { eventId: params.id },
    include: { members: { include: { user: true } }, submission: true }
  });

  const rows = teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    inviteCode: t.inviteCode,
    memberCount: t.members.length,
    memberNames: t.members.map((m) => m.user.name).join("; "),
    memberEmails: t.members.map((m) => m.user.email).join("; "),
    submissionStatus: t.submission?.status ?? "NONE"
  }));

  const csv = toCsv(rows, [
    "teamId",
    "teamName",
    "inviteCode",
    "memberCount",
    "memberNames",
    "memberEmails",
    "submissionStatus"
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="teams.csv"`
    }
  });
}
