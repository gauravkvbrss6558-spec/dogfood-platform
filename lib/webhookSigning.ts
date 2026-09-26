import crypto from "crypto";

// Same pattern GitHub/Stripe use: HMAC-SHA256 over the raw payload bytes,
// sent as a header, so a receiver can confirm a delivery actually came
// from this server (knows the shared secret) and wasn't tampered with in
// transit — without needing TLS client certs or anything heavier.

export function signWebhookPayload(payloadJson: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadJson).digest("hex");
}

export function verifyWebhookSignature(
  payloadJson: string,
  secret: string,
  signature: string
): boolean {
  const expected = signWebhookPayload(payloadJson, secret);
  // Constant-time comparison — a naive `===` leaks timing information
  // that could help an attacker guess the signature byte-by-byte.
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
