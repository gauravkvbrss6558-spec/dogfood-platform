import crypto from "crypto";
import { prisma } from "./prisma";
import { checkRateLimit, type RateLimitConfig } from "./rateLimit";

// We never store a raw IP address — only a salted hash. This is enough to
// detect "the same network made N requests" for abuse-pattern purposes,
// without keeping personally identifying data around indefinitely. The
// salt is a local secret so hashes aren't rainbow-tableable back to IPs
// by anyone with read access to the database alone.
const SALT = process.env.NEXTAUTH_SECRET ?? "dev-only-salt";

export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(SALT + ip).digest("hex").slice(0, 32);
}

export function getRequestIp(req: Request): string {
  // Behind a reverse proxy (or Docker's network), the real client IP
  // arrives via x-forwarded-for. Falls back to a constant when running
  // directly (e.g. local dev without a proxy) rather than throwing.
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// Fetches recent actions from the audit log and applies the pure
// rate-limit check, keyed by user id. Used for authenticated actions
// (voting, commenting) where a session already exists.
export async function enforceRateLimit(
  userId: string,
  eventType: string,
  config: RateLimitConfig
) {
  const since = new Date(Date.now() - config.windowMs);
  const recent = await prisma.auditLog.findMany({
    where: { actorId: userId, eventType, createdAt: { gte: since } },
    select: { createdAt: true }
  });
  return checkRateLimit(
    recent.map((r) => r.createdAt.getTime()),
    Date.now(),
    config
  );
}

// Same idea, but keyed by hashed IP instead of user id — needed for
// flows that happen *before* a session exists, like requesting a
// registration OTP. A brand-new registrant has no userId to rate-limit
// on yet; their IP is the only identity available at that point.
export async function enforceRateLimitByIp(
  ipHash: string,
  eventType: string,
  config: RateLimitConfig
) {
  const since = new Date(Date.now() - config.windowMs);
  const recent = await prisma.auditLog.findMany({
    where: { ipHash, eventType, createdAt: { gte: since } },
    select: { createdAt: true }
  });
  return checkRateLimit(
    recent.map((r) => r.createdAt.getTime()),
    Date.now(),
    config
  );
}

export async function logAudit(entry: {
  eventType: string;
  actorId?: string | null;
  hackathonEventId?: string | null;
  ipHash?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      eventType: entry.eventType,
      actorId: entry.actorId ?? null,
      hackathonEventId: entry.hackathonEventId ?? null,
      ipHash: entry.ipHash ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null
    }
  });
}
