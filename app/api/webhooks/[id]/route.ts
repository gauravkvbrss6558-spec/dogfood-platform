import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can delete webhooks" }, { status: 403 });
  }

  const webhook = await prisma.webhook.findUnique({
    where: { id: params.id },
    include: { event: true }
  });
  if (!webhook) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

  if (webhook.event.organizerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only this event's organizer can do that" }, { status: 403 });
  }

  await prisma.webhook.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
