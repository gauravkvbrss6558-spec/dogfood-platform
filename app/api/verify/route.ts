import { NextResponse } from "next/server";
import { getServerKeypair } from "@/lib/keys";
import { decodeRecordToken, verifyRecord } from "@/lib/certRecord";

// Fully public and unauthenticated by design — this is the "publicly
// verifiable" half of the requirement. Anyone with a token (printed on a
// certificate, shared as a link) can confirm it's authentic without an
// account and without trusting anything except the published public key
// itself, which they could in principle fetch once and check offline.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const record = decodeRecordToken<Record<string, unknown>>(token);
  if (!record) {
    return NextResponse.json({ valid: false, error: "Malformed token" }, { status: 400 });
  }

  const { publicKey } = await getServerKeypair();
  const valid = verifyRecord(record, publicKey);

  return NextResponse.json({ valid, payload: valid ? record.payload : null });
}
