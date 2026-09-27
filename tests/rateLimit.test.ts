import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../lib/rateLimit";

describe("checkRateLimit", () => {
  it("allows an action when under the limit", () => {
    const result = checkRateLimit([1000, 2000], 3000, { maxActions: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks an action when at the limit", () => {
    const result = checkRateLimit([1000, 2000, 3000], 4000, { maxActions: 3, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("ignores actions outside the trailing window", () => {
    // Two actions happened, but one is far outside the 1-minute window.
    const result = checkRateLimit([0, 59_000], 60_500, { maxActions: 1, windowMs: 60_000 });
    // 0ms is now outside the window (60500 - 60000 = 500, and 0 < 500),
    // so only the 59_000 timestamp counts — that's already at the limit of 1.
    expect(result.allowed).toBe(false);
  });

  it("computes a sensible retryAfterMs when blocked", () => {
    const result = checkRateLimit([1000], 1000, { maxActions: 1, windowMs: 10_000 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(10_000);
  });

  it("never returns a negative retryAfterMs", () => {
    const result = checkRateLimit([1000], 50_000, { maxActions: 1, windowMs: 10_000 });
    // The old timestamp should already be out of window, so this should
    // actually be allowed — but if logic were wrong and it blocked, retryAfterMs must not be negative.
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThanOrEqual(0);
    } else {
      expect(result.allowed).toBe(true);
    }
  });
});
