import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { getRequestIp, hashIp, enforceRateLimit, logAudit } from "@/lib/audit";
import { dispatchWebhook } from "@/lib/webhookDispatch";

const CommentSchema = z.object({
  body: z.string().min(1).max(2000)
});

const COMMENT_RATE_LIMIT = { maxActions: 5, windowMs: 60 * 1000 };

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const comments = await prisma.comment.findMany({
    where: { submissionId: params.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true } } }
  });
  return NextResponse.json(comments);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to comment" }, { status: 401 });
  }

  const submission = await prisma.submission.findUnique({
    where: { id: params.id },
    include: { team: { include: { event: true } } }
  });
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const rate = await enforceRateLimit(session.user.id, "COMMENT_POSTED", COMMENT_RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `You're commenting too quickly. Try again in ${Math.ceil((rate.retryAfterMs ?? 0) / 1000)}s.` },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { submissionId: params.id, authorId: session.user.id, body: parsed.data.body },
    include: { author: { select: { id: true, name: true } } }
  });

  await logAudit({
    eventType: "COMMENT_POSTED",
    actorId: session.user.id,
    hackathonEventId: submission.team.event.id,
    ipHash: hashIp(getRequestIp(req)),
    metadata: { submissionId: params.id, commentId: comment.id }
  });

  await dispatchWebhook(submission.team.event.id, "COMMENT_POSTED", {
    submissionId: params.id,
    commentId: comment.id,
    authorName: comment.author.name
  });

  return NextResponse.json(comment, { status: 201 });
}
