// Pure function — no DB, no clock dependency (the caller passes `now`),
// so it's fully unit-testable. The API route that uses this is
// responsible for fetching recent timestamps from AuditLog and passing
// them in; this file only decides the yes/no.

export type RateLimitConfig = {
  maxActions: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
};

/**
 * Sliding-window rate limiter. Given the timestamps (ms) of a user's
 * recent actions of one type, decides whether one more action right now
 * would exceed `maxActions` within the trailing `windowMs`.
 *
 * A sliding window (rather than fixed buckets like "10 per calendar
 * minute") is used because fixed buckets let someone do `maxActions` at
 * 0:59 and another `maxActions` at 1:00 — effectively doubling the limit
 * right at the boundary. Sliding window closes that gap.
 */
export function checkRateLimit(
  recentTimestampsMs: number[],
  now: number,
  { maxActions, windowMs }: RateLimitConfig
): RateLimitResult {
  const windowStart = now - windowMs;
  const withinWindow = recentTimestampsMs.filter((t) => t > windowStart);

  if (withinWindow.length < maxActions) {
    return { allowed: true, remaining: maxActions - withinWindow.length - 1, retryAfterMs: null };
  }

  // Rejected — tell the caller how long until the oldest action in the
  // window ages out and a new one becomes allowed.
  const oldest = Math.min(...withinWindow);
  const retryAfterMs = oldest + windowMs - now;

  return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) };
}
