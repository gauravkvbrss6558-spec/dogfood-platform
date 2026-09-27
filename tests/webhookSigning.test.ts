import { describe, it, expect } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "../lib/webhookSigning";

describe("webhook signing", () => {
  it("produces a verifiable signature for the correct secret", () => {
    const payload = JSON.stringify({ type: "VOTE_CAST", submissionId: "s1" });
    const sig = signWebhookPayload(payload, "secret-123");
    expect(verifyWebhookSignature(payload, "secret-123", sig)).toBe(true);
  });

  it("rejects a signature checked against the wrong secret", () => {
    const payload = JSON.stringify({ type: "VOTE_CAST" });
    const sig = signWebhookPayload(payload, "secret-123");
    expect(verifyWebhookSignature(payload, "wrong-secret", sig)).toBe(false);
  });

  it("rejects a signature if the payload was tampered with", () => {
    const original = JSON.stringify({ amount: 10 });
    const sig = signWebhookPayload(original, "secret");
    const tampered = JSON.stringify({ amount: 1000 });
    expect(verifyWebhookSignature(tampered, "secret", sig)).toBe(false);
  });

  it("rejects a malformed/short signature without throwing", () => {
    const payload = JSON.stringify({ a: 1 });
    expect(() => verifyWebhookSignature(payload, "secret", "not-hex-and-too-short")).not.toThrow();
    expect(verifyWebhookSignature(payload, "secret", "ab")).toBe(false);
  });
});
