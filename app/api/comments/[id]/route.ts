import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { getRequestIp, hashIp, logAudit } from "@/lib/audit";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be logged in" }, { status: 401 });
  }

  const comment = await prisma.comment.findUnique({
    where: { id: params.id },
    include: { submission: { include: { team: { include: { event: true } } } } }
  });
  if (!comment || comment.deletedAt) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const event = comment.submission.team.event;
  const isAuthor = comment.authorId === session.user.id;
  const isEventOrganizer = event.organizerId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";

  if (!isAuthor && !isEventOrganizer && !isAdmin) {
    return NextResponse.json(
      { error: "Only the author or the event organizer can delete this comment" },
      { status: 403 }
    );
  }

  // Soft delete — see schema comment on Comment.deletedAt for why we
  // never hard-delete: it would erase the audit trail of what was posted.
  await prisma.comment.update({
    where: { id: params.id },
    data: { deletedAt: new Date() }
  });

  await logAudit({
    eventType: "COMMENT_DELETED",
    actorId: session.user.id,
    hackathonEventId: event.id,
    ipHash: hashIp(getRequestIp(req)),
    metadata: { commentId: comment.id, wasAuthor: isAuthor }
  });

  return NextResponse.json({ ok: true });
}
