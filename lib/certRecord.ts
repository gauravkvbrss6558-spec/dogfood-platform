import crypto from "crypto";

// Certificates and judge records use asymmetric signing (Ed25519), not
// the HMAC scheme webhooks use. The difference matters: HMAC verification
// requires knowing the shared secret, which only this server (and anyone
// it trusts) has — fine for "prove this webhook came from us" but wrong
// for "let a third party (an employer, another platform) verify this
// certificate is real years from now without calling our API and without
// us handing them a secret." Ed25519 lets the *public* key do that
// verification, published once, forever checkable offline.

export type SignedRecord<T> = {
  payload: T;
  signature: string; // base64
};

/** Deterministic JSON serialization — sorted keys, so the same payload
 * object always signs to the same bytes regardless of property order. */
function canonicalize(payload: unknown): string {
  return JSON.stringify(sortKeysDeep(payload));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function signRecord<T>(payload: T, privateKeyPem: string): SignedRecord<T> {
  const canonical = canonicalize(payload);
  const signature = crypto.sign(null, Buffer.from(canonical), privateKeyPem);
  return { payload, signature: signature.toString("base64") };
}

export function verifyRecord<T>(record: SignedRecord<T>, publicKeyPem: string): boolean {
  const canonical = canonicalize(record.payload);
  try {
    return crypto.verify(
      null,
      Buffer.from(canonical),
      publicKeyPem,
      Buffer.from(record.signature, "base64")
    );
  } catch {
    // A malformed signature/key should mean "not verified", not a crash —
    // this function is called on arbitrary, possibly-tampered public input.
    return false;
  }
}

/** Encodes a signed record into a single URL-safe token for sharing as a link. */
export function encodeRecordToken<T>(record: SignedRecord<T>): string {
  return Buffer.from(JSON.stringify(record)).toString("base64url");
}

export function decodeRecordToken<T>(token: string): SignedRecord<T> | null {
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed.signature !== "string" || parsed.payload === undefined) {
      return null;
    }
    return parsed as SignedRecord<T>;
  } catch {
    return null;
  }
}
