import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { dispatchWebhook } from "@/lib/webhookDispatch";

const SaveSubmissionSchema = z.object({
  teamId: z.string(),
  title: z.string().min(3),
  description: z.string().min(1),
  repoUrl: z.string().url().optional().or(z.literal("")),
  demoUrl: z.string().url().optional().or(z.literal("")),
  trackId: z.string().optional().nullable(),
  action: z.enum(["draft", "submit"])
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = SaveSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { teamId, action, ...fields } = parsed.data;

  // Confirm the caller is actually on this team — not just any logged-in user.
  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: session.user.id } }
  });
  if (!membership) {
    return NextResponse.json(
      { error: "You're not a member of this team" },
      { status: 403 }
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { event: true }
  });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Deadline enforcement happens here, on the server — never trust the
  // client to only send requests before the deadline.
  const now = new Date();
  if (now > team.event.submissionDeadline) {
    return NextResponse.json(
      { error: "The submission deadline for this event has passed" },
      { status: 403 }
    );
  }

  const submission = await prisma.submission.upsert({
    where: { teamId },
    create: {
      teamId,
      title: fields.title,
      description: fields.description,
      repoUrl: fields.repoUrl || null,
      demoUrl: fields.demoUrl || null,
      trackId: fields.trackId || null,
      status: action === "submit" ? "SUBMITTED" : "DRAFT",
      submittedAt: action === "submit" ? now : null
    },
    update: {
      title: fields.title,
      description: fields.description,
      repoUrl: fields.repoUrl || null,
      demoUrl: fields.demoUrl || null,
      trackId: fields.trackId || null,
      status: action === "submit" ? "SUBMITTED" : "DRAFT",
      submittedAt: action === "submit" ? now : undefined
    }
  });

  if (action === "submit") {
    await dispatchWebhook(team.event.id, "SUBMISSION_SUBMITTED", {
      submissionId: submission.id,
      teamId,
      title: submission.title
    });
  }

  return NextResponse.json(submission, { status: 200 });
}
