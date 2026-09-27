import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";
import {
  signRecord,
  verifyRecord,
  encodeRecordToken,
  decodeRecordToken
} from "../lib/certRecord";

let publicKey: string;
let privateKey: string;

beforeAll(() => {
  const keys = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  publicKey = keys.publicKey;
  privateKey = keys.privateKey;
});

describe("signRecord / verifyRecord", () => {
  it("verifies a record signed with the matching private key", () => {
    const record = signRecord({ judgeId: "j1", eventName: "Dogfood" }, privateKey);
    expect(verifyRecord(record, publicKey)).toBe(true);
  });

  it("rejects a record if the payload was tampered with after signing", () => {
    const record = signRecord({ judgeId: "j1" }, privateKey);
    const tampered = { ...record, payload: { judgeId: "attacker" } };
    expect(verifyRecord(tampered, publicKey)).toBe(false);
  });

  it("rejects a record verified against the wrong public key", () => {
    const otherKeys = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" }
    });
    const record = signRecord({ judgeId: "j1" }, privateKey);
    expect(verifyRecord(record, otherKeys.publicKey)).toBe(false);
  });

  it("signs identically regardless of key order in the payload object", () => {
    const a = signRecord({ a: 1, b: 2 }, privateKey);
    const b = signRecord({ b: 2, a: 1 }, privateKey);
    expect(a.signature).toBe(b.signature);
  });

  it("does not throw on a garbage record/public key", () => {
    expect(() =>
      verifyRecord({ payload: { x: 1 }, signature: "not-base64!!" }, "not a real pem")
    ).not.toThrow();
    expect(verifyRecord({ payload: { x: 1 }, signature: "not-base64!!" }, "not a real pem")).toBe(false);
  });
});

describe("encodeRecordToken / decodeRecordToken", () => {
  it("round-trips a signed record through a token", () => {
    const record = signRecord({ judgeId: "j1" }, privateKey);
    const token = encodeRecordToken(record);
    const decoded = decodeRecordToken<{ judgeId: string }>(token);
    expect(decoded).toEqual(record);
    expect(verifyRecord(decoded!, publicKey)).toBe(true);
  });

  it("returns null for a garbage token instead of throwing", () => {
    expect(decodeRecordToken("not-a-valid-token-at-all")).toBeNull();
  });
});
