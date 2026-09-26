import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { parseTeamsCsv } from "@/lib/csvImport";
import { generateInviteCode } from "@/lib/inviteCode";

const ImportSchema = z.object({ csv: z.string().min(1) });

type RowResult = { lineNumber: number; teamName: string; status: "created" | "skipped"; reason?: string };

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can bulk-import teams" }, { status: 403 });
  }

  const event = await prisma.event.findUnique({ where: { id: params.id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only this event's organizer can do that" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { rows, errors: parseErrors } = parseTeamsCsv(parsed.data.csv);

  // Every row is handled independently, in its own try/catch — one bad
  // row (a duplicate team name, an email with no account, a user already
  // on another team) should not sink the rest of the batch. This mirrors
  // the same "partial success with a per-row report" approach the seed
  // script uses, since organizers importing a real, messy participant
  // list from an external registration form are the exact use case this
  // exists for.
  const results: RowResult[] = [];

  for (const row of rows) {
    try {
      const users = await prisma.user.findMany({ where: { email: { in: row.memberEmails } } });
      const foundEmails = new Set(users.map((u) => u.email));
      const missing = row.memberEmails.filter((e) => !foundEmails.has(e));
      if (missing.length > 0) {
        results.push({
          lineNumber: row.lineNumber,
          teamName: row.teamName,
          status: "skipped",
          reason: `No account found for: ${missing.join(", ")}`
        });
        continue;
      }

      const alreadyOnATeam = await prisma.teamMember.findFirst({
        where: { userId: { in: users.map((u) => u.id) }, team: { eventId: params.id } }
      });
      if (alreadyOnATeam) {
        results.push({
          lineNumber: row.lineNumber,
          teamName: row.teamName,
          status: "skipped",
          reason: "One or more members are already on a team for this event"
        });
        continue;
      }

      await prisma.team.create({
        data: {
          name: row.teamName,
          eventId: params.id,
          inviteCode: generateInviteCode(),
          members: {
            create: users.map((u, i) => ({ userId: u.id, role: i === 0 ? "LEADER" : "MEMBER" }))
          }
        }
      });

      results.push({ lineNumber: row.lineNumber, teamName: row.teamName, status: "created" });
    } catch (err) {
      // Most likely a unique constraint hit (duplicate team name for this
      // event) — reported per-row rather than aborting the whole import.
      results.push({
        lineNumber: row.lineNumber,
        teamName: row.teamName,
        status: "skipped",
        reason: err instanceof Error ? err.message : "Unknown error"
      });
    }
  }

  return NextResponse.json({
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    results,
    parseErrors
  });
}
