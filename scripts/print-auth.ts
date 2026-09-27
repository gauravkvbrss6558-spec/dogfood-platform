// Prints a ready-to-paste .dogfood.toml for the acceptance checker.
//
// Why this exists: the checker (run.py) never logs in — it just attaches
// whatever header .dogfood.toml gives it to each request. NextAuth's
// session cookie is a signed JWT that normally only exists after someone
// actually signs in through the browser. On a fresh `docker compose up`
// nobody has signed in yet, so there is no such cookie to hand over.
//
// This script encodes valid session JWTs directly — using the same
// `encode()` NextAuth itself uses, with the same NEXTAUTH_SECRET and the
// same token shape lib/auth.ts's jwt() callback produces — for the fixed
// seeded test accounts, so a fresh boot has working cookies immediately.
import { encode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const secret = process.env.NEXTAUTH_SECRET;

if (!secret) {
  console.error("NEXTAUTH_SECRET is not set — cannot generate session tokens.");
  process.exit(1);
}

async function tokenFor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const jwt = await encode({
    token: {
      name: user.name,
      email: user.email,
      sub: user.id,
      id: user.id,
      role: user.role
    },
    secret: secret as string,
    maxAge: 30 * 24 * 60 * 60 // 30 days, same default NextAuth uses
  });
  // Cookie name for HTTP (non-https) NextAuth deployments, e.g. localhost.
  return `Cookie: next-auth.session-token=${jwt}`;
}

async function main() {
  const organizer = await tokenFor("organizer@dogfood.dev");
  const judgeA = await tokenFor("judge-a@dogfood.dev");
  const judgeB = await tokenFor("judge-b@dogfood.dev");
  const participant = await tokenFor("alice@dogfood.dev");

  const event = await prisma.event.findUniqueOrThrow({ where: { slug: "dogfood-demo" } });
  const judgeAUser = await prisma.user.findUniqueOrThrow({ where: { email: "judge-a@dogfood.dev" } });

  console.log("\n===== Paste this as .dogfood.toml (tokens are fresh for THIS run only) =====\n");
  console.log(`[portal]
base_url = "http://localhost:3000"

[tiers]
claimed = ["T1", "T2", "T3", "T4"]
pitch = "Self-hostable hackathon submission + judging platform."

[auth]
organizer   = "${organizer}"
judge_a     = "${judgeA}"
judge_b     = "${judgeB}"
participant = "${participant}"

[routes]
gallery      = "/gallery"
submit       = "/api/submissions"
judge_scores = "/api/judge/scores"
peer_scores  = "/api/judge/scores?judge=${judgeAUser.id}"
csv_export   = "/api/events/${event.id}/export/scores"
`);
  console.log("===== end =====\n");
  console.log("Re-run `npm run print:auth` any time — every run mints fresh tokens.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
