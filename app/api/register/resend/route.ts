import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, hashOtpCode } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";
import { getRequestIp, hashIp, enforceRateLimitByIp, logAudit } from "@/lib/audit";

const ResendSchema = z.object({ email: z.string().email() });
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_RATE_LIMIT = { maxActions: 5, windowMs: 15 * 60 * 1000 };

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = ResendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const ipHash = hashIp(getRequestIp(req));
  const rate = await enforceRateLimitByIp(ipHash, "OTP_REQUESTED", RESEND_RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil((rate.retryAfterMs ?? 0) / 1000)}s.` },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Deliberately return the same success response whether or not an
  // unverified account exists for this email — confirming "that email
  // isn't registered" to an anonymous caller is a minor information leak
  // (email enumeration) with no upside here.
  if (!user || user.emailVerifiedAt) {
    return NextResponse.json({ ok: true });
  }

  const code = generateOtpCode();
  await prisma.emailOtp.create({
    data: {
      email: parsed.data.email,
      codeHash: hashOtpCode(code),
      purpose: "REGISTRATION",
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });

  const emailResult = await sendOtpEmail(parsed.data.email, code);
  await logAudit({ eventType: "OTP_REQUESTED", ipHash, metadata: { email: parsed.data.email, resend: true } });

  return NextResponse.json({ ok: true, devModeCode: emailResult.devModeCode });
}
