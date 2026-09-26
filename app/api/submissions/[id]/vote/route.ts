import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import { getRequestIp, hashIp, enforceRateLimit, logAudit } from "@/lib/audit";
import { isVotingOpen, shouldHideResults } from "@/lib/voting";
import { dispatchWebhook } from "@/lib/webhookDispatch";

const VoteSchema = z.object({
  value: z.number().int().min(1).max(5)
});

// A generous cap — one-vote-per-submission is already enforced by a
// unique DB constraint, so this mainly guards against a script rapidly
// changing its vote on many different submissions in a short burst.
const VOTE_RATE_LIMIT = { maxActions: 20, windowMs: 10 * 60 * 1000 };

async function loadSubmissionWithEvent(submissionId: string) {
  return prisma.submission.findUnique({
    where: { id: submissionId },
    include: { team: { include: { event: true } } }
  });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const submission = await loadSubmissionWithEvent(params.id);
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const event = submission.team.event;
  const now = new Date();
  const hidden = shouldHideResults(event, now);
  const isOrganizerViewing =
    hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"]) && event.organizerId === session?.user.id;

  const myVote = session
    ? await prisma.vote.findUnique({
        where: { submissionId_voterId: { submissionId: params.id, voterId: session.user.id } }
      })
    : null;

  if (hidden && !isOrganizerViewing) {
    return NextResponse.json({
      votingEnabled: event.votingEnabled,
      votingOpen: isVotingOpen(event, now),
      resultsHidden: true,
      myVote: myVote?.value ?? null
    });
  }

  const agg = await prisma.vote.aggregate({
    where: { submissionId: params.id },
    _avg: { value: true },
    _count: { value: true }
  });

  return NextResponse.json({
    votingEnabled: event.votingEnabled,
    votingOpen: isVotingOpen(event, now),
    resultsHidden: false,
    myVote: myVote?.value ?? null,
    averageScore: agg._avg.value ? Number(agg._avg.value.toFixed(2)) : null,
    voteCount: agg._count.value
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in to vote" }, { status: 401 });
  }

  const submission = await loadSubmissionWithEvent(params.id);
  if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  const event = submission.team.event;
  if (!isVotingOpen(event, new Date())) {
    return NextResponse.json({ error: "Voting is not currently open for this event" }, { status: 403 });
  }

  // A team can't vote for its own project.
  const isOwnTeam = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: submission.teamId, userId: session.user.id } }
  });
  if (isOwnTeam) {
    return NextResponse.json({ error: "You can't vote for your own team's project" }, { status: 403 });
  }

  const rate = await enforceRateLimit(session.user.id, "VOTE_CAST", VOTE_RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many votes too quickly. Try again in ${Math.ceil((rate.retryAfterMs ?? 0) / 1000)}s.` },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const ipHash = hashIp(getRequestIp(req));

  const vote = await prisma.vote.upsert({
    where: { submissionId_voterId: { submissionId: params.id, voterId: session.user.id } },
    create: { submissionId: params.id, voterId: session.user.id, value: parsed.data.value, ipHash },
    update: { value: parsed.data.value, ipHash }
  });

  await logAudit({
    eventType: "VOTE_CAST",
    actorId: session.user.id,
    hackathonEventId: event.id,
    ipHash,
    metadata: { submissionId: params.id, value: parsed.data.value }
  });

  await dispatchWebhook(event.id, "VOTE_CAST", {
    submissionId: params.id,
    value: vote.value
  });

  return NextResponse.json({ ok: true, value: vote.value });
}
