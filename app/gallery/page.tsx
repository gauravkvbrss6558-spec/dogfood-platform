import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { hashIp } from "@/lib/audit";
import { isVotingOpen } from "@/lib/voting";
import { seededShuffle } from "@/lib/shuffle";
import GalleryClient from "@/components/GalleryClient";

export default async function GalleryPage() {
  const session = await getSession();

  const submissions = await prisma.submission.findMany({
    where: { status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    include: {
      team: { include: { event: true, members: { include: { user: true } } } },
      track: true
    }
  });

  const data = submissions.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    repoUrl: s.repoUrl,
    demoUrl: s.demoUrl,
    trackName: s.track?.name ?? null,
    eventName: s.team.event.name,
    teamName: s.team.name,
    memberNames: s.team.members.map((m) => m.user.name),
    votingOpen: isVotingOpen(s.team.event, new Date())
  }));

  // Randomize order whenever at least one listed project has active
  // voting — position bias (people voting for whatever loads first)
  // matters for voting, not for a plain post-event archive browse.
  const anyVotingActive = data.some((d) => d.votingOpen);

  let ordered = data;
  if (anyVotingActive) {
    // Seed by logged-in user id so a viewer's order is stable across
    // reloads and pagination; anonymous visitors get a seed derived from
    // their (hashed) IP for the same stability without needing to set a
    // cookie from a server component.
    const seed = session?.user.id ?? hashIp(headers().get("x-forwarded-for") ?? "anonymous");
    ordered = seededShuffle(data, seed);
  }

  return <GalleryClient submissions={ordered} />;
}
