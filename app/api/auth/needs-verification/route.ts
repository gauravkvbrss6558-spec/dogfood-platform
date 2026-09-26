import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ needsVerification: false });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  return NextResponse.json({ needsVerification: !!user && !user.emailVerifiedAt });
}
