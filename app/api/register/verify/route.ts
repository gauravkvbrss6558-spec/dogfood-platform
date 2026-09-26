import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkOtp } from "@/lib/otp";
import { getRequestIp, hashIp, enforceRateLimitByIp, logAudit } from "@/lib/audit";

const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6)
});

// A tighter limit than requesting an OTP — this endpoint is the actual
// brute-force target (guessing a 6-digit code), so it needs to be capped
// hard regardless of the code's own expiry.
const VERIFY_RATE_LIMIT = { maxActions: 10, windowMs: 10 * 60 * 1000 };

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const ipHash = hashIp(getRequestIp(req));
  const rate = await enforceRateLimitByIp(ipHash, "OTP_VERIFY_ATTEMPT", VERIFY_RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil((rate.retryAfterMs ?? 0) / 1000)}s.` },
      { status: 429 }
    );
  }

  await logAudit({ eventType: "OTP_VERIFY_ATTEMPT", ipHash, metadata: { email: parsed.data.email } });

  const otp = await prisma.emailOtp.findFirst({
    where: { email: parsed.data.email, purpose: "REGISTRATION" },
    orderBy: { createdAt: "desc" }
  });

  const result = checkOtp(otp, parsed.data.code, new Date());

  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "No verification code was requested for this email",
      expired: "This code has expired — request a new one",
      already_used: "This code has already been used",
      wrong_code: "Incorrect code"
    };
    return NextResponse.json({ error: messages[result.reason] }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.emailOtp.update({ where: { id: otp!.id }, data: { consumedAt: new Date() } }),
    prisma.user.update({
      where: { email: parsed.data.email },
      data: { emailVerifiedAt: new Date() }
    })
  ]);

  return NextResponse.json({ ok: true });
}
