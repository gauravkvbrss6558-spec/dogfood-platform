import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hasRole } from "@/lib/rbac";
import type { WebhookEventType } from "@/lib/webhookDispatch";

const VALID_EVENT_TYPES: WebhookEventType[] = [
  "SUBMISSION_SUBMITTED",
  "VOTE_CAST",
  "COMMENT_POSTED",
  "JUDGES_ASSIGNED",
  "SCORE_SUBMITTED"
];

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  eventTypes: z.array(z.enum(VALID_EVENT_TYPES as [string, ...string[]])).min(1)
});

async function assertOwnsEvent(eventId: string, userId: string, role: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false as const, status: 404, error: "Event not found" };
  if (event.organizerId !== userId && role !== "ADMIN") {
    return { ok: false as const, status: 403, error: "Only this event's organizer can do that" };
  }
  return { ok: true as const };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can view webhooks" }, { status: 403 });
  }
  const ownership = await assertOwnsEvent(params.id, session!.user.id, session!.user.role);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status });

  const webhooks = await prisma.webhook.findMany({ where: { eventId: params.id } });
  // The secret is only ever shown once, at creation time (see POST below) —
  // it's write-once-read-never after that, the same principle as an API
  // key. Returning it again here would defeat the point of a shared
  // secret if the list endpoint ever gets exposed more broadly later.
  return NextResponse.json(
    webhooks.map((w) => ({ id: w.id, url: w.url, eventTypes: w.eventTypes.split(","), createdAt: w.createdAt }))
  );
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasRole(session?.user?.role, ["ORGANIZER", "ADMIN"])) {
    return NextResponse.json({ error: "Only organizers can register webhooks" }, { status: 403 });
  }
  const ownership = await assertOwnsEvent(params.id, session!.user.id, session!.user.role);
  if (!ownership.ok) return NextResponse.json({ error: ownership.error }, { status: ownership.status });

  const body = await req.json();
  const parsed = CreateWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const secret = crypto.randomBytes(24).toString("hex");

  const webhook = await prisma.webhook.create({
    data: {
      eventId: params.id,
      url: parsed.data.url,
      secret,
      eventTypes: parsed.data.eventTypes.join(",")
    }
  });

  // The only time the raw secret is ever returned — the receiver's
  // integration code needs it once, to verify the X-Dogfood-Signature
  // header on future deliveries.
  return NextResponse.json(
    { id: webhook.id, url: webhook.url, eventTypes: parsed.data.eventTypes, secret },
    { status: 201 }
  );
}
