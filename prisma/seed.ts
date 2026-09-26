import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database…");

  const password = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@dogfood.dev" },
    update: {},
    create: { name: "Admin", email: "admin@dogfood.dev", passwordHash: password, role: "ADMIN", emailVerifiedAt: new Date() }
  });

  const organizer = await prisma.user.upsert({
    where: { email: "organizer@dogfood.dev" },
    update: {},
    create: { name: "Jamie Organizer", email: "organizer@dogfood.dev", passwordHash: password, role: "ORGANIZER", emailVerifiedAt: new Date() }
  });

  // Two judges are seeded on purpose (not one) — the acceptance checker's
  // "judge cannot see peer scores" check needs a real judge_a / judge_b
  // pair, each with their own assignment and scores, to prove isolation.
  const judgeA = await prisma.user.upsert({
    where: { email: "judge-a@dogfood.dev" },
    update: {},
    create: { name: "Jordan Judge A", email: "judge-a@dogfood.dev", passwordHash: password, role: "JUDGE", emailVerifiedAt: new Date() }
  });

  const judgeB = await prisma.user.upsert({
    where: { email: "judge-b@dogfood.dev" },
    update: {},
    create: { name: "Sam Judge B", email: "judge-b@dogfood.dev", passwordHash: password, role: "JUDGE", emailVerifiedAt: new Date() }
  });

  const alice = await prisma.user.upsert({
    where: { email: "alice@dogfood.dev" },
    update: {},
    create: { name: "Alice Participant", email: "alice@dogfood.dev", passwordHash: password, role: "PARTICIPANT", emailVerifiedAt: new Date() }
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@dogfood.dev" },
    update: {},
    create: { name: "Bob Participant", email: "bob@dogfood.dev", passwordHash: password, role: "PARTICIPANT", emailVerifiedAt: new Date() }
  });

  const event = await prisma.event.upsert({
    where: { slug: "dogfood-demo" },
    update: {},
    create: {
      name: "Dogfood Demo Hackathon",
      slug: "dogfood-demo",
      description: "A seeded demo event for local development and the acceptance suite.",
      // Deliberately in the past — the acceptance checker's "closed event
      // refuses submissions" check expects a closed event, matching how
      // the real fixtures.json ships (its submissions_close is also past).
      startAt: new Date(Date.now() - 1000 * 60 * 60 * 96),
      endAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      submissionDeadline: new Date(Date.now() - 1000 * 60 * 60 * 24),
      organizerId: organizer.id,
      tracks: { create: [{ name: "Open Track" }, { name: "AI/ML" }] },
      prizes: {
        create: [{ title: "Grand Prize", description: "Winner across all tracks" }]
      }
    },
    include: { tracks: true }
  });

  const existingTeam = await prisma.team.findFirst({ where: { eventId: event.id, name: "Team Fixture" } });
  const team =
    existingTeam ??
    (await prisma.team.create({
      data: {
        name: "Team Fixture",
        eventId: event.id,
        inviteCode: "DEMO-0001",
        members: {
          create: [
            { userId: alice.id, role: "LEADER" },
            { userId: bob.id, role: "MEMBER" }
          ]
        }
      }
    }));

  await prisma.submission.upsert({
    where: { teamId: team.id },
    update: {},
    create: {
      teamId: team.id,
      title: "Glass Signal",
      description: "A demo submission created by the seed script for testing the gallery and judging flow.",
      repoUrl: "https://github.com/example/fixture-project",
      demoUrl: "https://example.com/demo",
      trackId: event.tracks[0].id,
      status: "SUBMITTED",
      submittedAt: new Date()
    }
  });

  // --- T2: judging fixture data ---

  const rubric = await prisma.rubric.upsert({
    where: { eventId: event.id },
    update: {},
    create: {
      eventId: event.id,
      criteria: {
        create: [
          { name: "Technical depth", weight: 0.4, maxScore: 10 },
          { name: "Execution & polish", weight: 0.6, maxScore: 10 }
        ]
      }
    },
    include: { criteria: true }
  });

  for (const j of [judgeA, judgeB]) {
    await prisma.eventJudge.upsert({
      where: { eventId_userId: { eventId: event.id, userId: j.id } },
      update: {},
      create: { eventId: event.id, userId: j.id }
    });
  }

  const fixtureSubmission = await prisma.submission.findUnique({ where: { teamId: team.id } });

  if (fixtureSubmission) {
    // Both judges score the same fixture project, with different values —
    // this is also what makes cross-judge normalization visible/testable.
    const scoreByJudge: Record<string, number> = { [judgeA.id]: 8, [judgeB.id]: 6 };

    for (const j of [judgeA, judgeB]) {
      const assignment = await prisma.judgeAssignment.upsert({
        where: { judgeId_submissionId: { judgeId: j.id, submissionId: fixtureSubmission.id } },
        update: {},
        create: { eventId: event.id, judgeId: j.id, submissionId: fixtureSubmission.id }
      });

      for (const criterion of rubric.criteria) {
        await prisma.score.upsert({
          where: { assignmentId_criterionId: { assignmentId: assignment.id, criterionId: criterion.id } },
          update: {},
          create: { assignmentId: assignment.id, criterionId: criterion.id, value: scoreByJudge[j.id] }
        });
      }
    }
  }

  // --- T3: public voting & comments fixture data ---

  await prisma.event.update({
    where: { id: event.id },
    data: {
      votingEnabled: true,
      votingOpensAt: new Date(Date.now() - 1000 * 60 * 60), // opened 1h ago
      votingClosesAt: new Date(Date.now() + 1000 * 60 * 60 * 24) // closes in 24h
    }
  });

  if (fixtureSubmission) {
    // Admin (not on Team Fixture) casts a demo vote.
    await prisma.vote.upsert({
      where: { submissionId_voterId: { submissionId: fixtureSubmission.id, voterId: admin.id } },
      update: {},
      create: {
        submissionId: fixtureSubmission.id,
        voterId: admin.id,
        value: 4,
        ipHash: "seed-fixture-ip-hash"
      }
    });

    const existingComment = await prisma.comment.findFirst({
      where: { submissionId: fixtureSubmission.id, authorId: admin.id }
    });
    if (!existingComment) {
      await prisma.comment.create({
        data: {
          submissionId: fixtureSubmission.id,
          authorId: admin.id,
          body: "Nice work on the fixture project — clean write-up!"
        }
      });
    }
  }

  console.log("Seed complete. Demo logins (password: password123):");
  console.log(`  Admin:       ${admin.email}`);
  console.log(`  Organizer:   ${organizer.email}`);
  console.log(`  Judge A:     ${judgeA.email} (assigned Fixture Project, scored 8)`);
  console.log(`  Judge B:     ${judgeB.email} (assigned Fixture Project, scored 6)`);
  console.log(`  Participant: ${alice.email} / ${bob.email}`);
  console.log(`  Team invite code: DEMO-0001`);
  console.log(`  Voting is enabled and open on the demo event — visit /gallery/<fixture-project-id>`);
  console.log(`  Certificates, webhooks, and the embed widget are available from the organizer dashboard.`);
  console.log(`  Event id (for .dogfood.toml csv_export route): ${event.id}`);
  console.log(`  Judge A id (for .dogfood.toml peer_scores route): ${judgeA.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
