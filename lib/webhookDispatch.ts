import { prisma } from "./prisma";
import { signWebhookPayload } from "./webhookSigning";
import { logAudit } from "./audit";

const DELIVERY_TIMEOUT_MS = 5000;

export type WebhookEventType =
  | "SUBMISSION_SUBMITTED"
  | "VOTE_CAST"
  | "COMMENT_POSTED"
  | "JUDGES_ASSIGNED"
  | "SCORE_SUBMITTED";

/**
 * Delivers `payload` to every webhook registered on `hackathonEventId`
 * that subscribes to `eventType`. Deliveries run concurrently and never
 * throw back to the caller — a slow or failing third-party endpoint must
 * never block or break the user-facing action that triggered it (e.g. a
 * vote should still succeed even if a webhook receiver is down). Success
 * and failure are both recorded to the audit log so an organizer can see
 * delivery history without needing server log access.
 */
export async function dispatchWebhook(
  hackathonEventId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await prisma.webhook.findMany({
    where: { eventId: hackathonEventId }
  });

  const matching = webhooks.filter((w) => w.eventTypes.split(",").includes(eventType));
  if (matching.length === 0) return;

  const body = JSON.stringify({ eventType, hackathonEventId, payload, deliveredAt: new Date().toISOString() });

  await Promise.allSettled(
    matching.map(async (webhook) => {
      const signature = signWebhookPayload(body, webhook.secret);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      try {
        const res = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Dogfood-Signature": signature,
            "X-Dogfood-Event": eventType
          },
          body,
          signal: controller.signal
        });

        await logAudit({
          eventType: res.ok ? "WEBHOOK_DELIVERED" : "WEBHOOK_FAILED",
          hackathonEventId,
          metadata: { webhookId: webhook.id, url: webhook.url, status: res.status, forEventType: eventType }
        });
      } catch (err) {
        await logAudit({
          eventType: "WEBHOOK_FAILED",
          hackathonEventId,
          metadata: {
            webhookId: webhook.id,
            url: webhook.url,
            error: err instanceof Error ? err.message : "Unknown error",
            forEventType: eventType
          }
        });
      } finally {
        clearTimeout(timeout);
      }
    })
  );
}
