import { NextResponse } from "next/server";
import { getServerKeypair } from "@/lib/keys";

export const dynamic = "force-dynamic";

// Deliberately unauthenticated — the whole point of publishing a public
// key is that anyone, including someone who never logs into this
// platform, can fetch it once and independently verify certificates and
// judge records forever after, without trusting a live API response for
// each verification.
export async function GET() {
  const { publicKey } = await getServerKeypair();
  return NextResponse.json({ publicKey, algorithm: "ed25519" });
}