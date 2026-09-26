import crypto from "crypto";
import { prisma } from "./prisma";

// Lazily creates the server's signing keypair on first use, then reuses
// the same row forever. Storing the private key in the same database as
// everything else is consistent with this platform's trust model overall
// (see the note on password hashing in lib/auth.ts) — whoever can read
// the database can already do far more damage than forge a certificate.
// A higher-security deployment could instead load the private key from
// an environment variable / secrets manager and only store the public
// key in the DB; that's a reasonable hardening step flagged in
// ARCHITECTURE.md, not implemented here to keep self-hosting to a single
// `docker compose up` with no extra secret-provisioning step.

let cached: { publicKey: string; privateKey: string } | null = null;

export async function getServerKeypair(): Promise<{ publicKey: string; privateKey: string }> {
  if (cached) return cached;

  const existing = await prisma.serverKeypair.findFirst();
  if (existing) {
    cached = { publicKey: existing.publicKey, privateKey: existing.privateKey };
    return cached;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });

  // findFirst-then-create has a theoretical race under concurrent first
  // requests; harmless here since a second row would just never be read
  // (getServerKeypair always takes findFirst), but documented rather than
  // silently relied upon.
  const created = await prisma.serverKeypair.create({ data: { publicKey, privateKey } });
  cached = { publicKey: created.publicKey, privateKey: created.privateKey };
  return cached;
}
