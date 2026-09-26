import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, hashOtpCode } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email";
import { getRequestIp, hashIp, enforceRateLimitByIp, logAudit } from "@/lib/audit";

const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
// Keyed by IP, not by email/user — at this point in the flow there is no
// user account we can safely rate-limit on yet (see lib/audit.ts).
const OTP_REQUEST_RATE_LIMIT = { maxActions: 5, windowMs: 15 * 60 * 1000 };

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const ipHash = hashIp(getRequestIp(req));

  const rate = await enforceRateLimitByIp(ipHash, "OTP_REQUESTED", OTP_REQUEST_RATE_LIMIT);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many registration attempts. Try again in ${Math.ceil((rate.retryAfterMs ?? 0) / 1000)}s.` },
      { status: 429 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.emailVerifiedAt) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  // Never store the raw password — only a one-way hash of it.
  const passwordHash = await bcrypt.hash(password, 10);

  // If a previous registration attempt for this email was never verified,
  // update it in place rather than creating a duplicate row (email is
  // unique) — this also lets someone who mistyped their password on the
  // first attempt just register again with the corrected one.
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { name, passwordHash } })
    : await prisma.user.create({ data: { name, email, passwordHash, role: "PARTICIPANT" } });

  const code = generateOtpCode();
  await prisma.emailOtp.create({
    data: {
      email,
      codeHash: hashOtpCode(code),
      purpose: "REGISTRATION",
      expiresAt: new Date(Date.now() + OTP_TTL_MS)
    }
  });

  const emailResult = await sendOtpEmail(email, code);

  await logAudit({ eventType: "OTP_REQUESTED", ipHash, metadata: { email, purpose: "REGISTRATION" } });

  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      requiresVerification: true,
      // Only present when no real email provider is configured — see
      // lib/email.ts. Never present once EMAIL_PROVIDER is set to smtp/brevo.
      devModeCode: emailResult.devModeCode
    },
    { status: 201 }
  );
}
