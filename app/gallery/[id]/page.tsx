import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import VoteWidget from "@/components/VoteWidget";
import CommentsSection from "@/components/CommentsSection";

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const submission = await prisma.submission.findUnique({
    where: { id: params.id },
    include: {
      team: { include: { event: true, members: { include: { user: true } } } },
      track: true
    }
  });

  if (!submission || submission.status !== "SUBMITTED") {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{submission!.title}</h1>
          <p className="mt-1 text-sm text-ink/50">
            {submission!.team.event.name} · Team {submission!.team.name}
          </p>
        </div>
        {submission!.track && (
          <span className="rounded-full bg-accentSoft px-3 py-1 text-xs text-accent">
            {submission!.track.name}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm text-ink/80">{submission!.description}</p>
      <p className="mt-3 text-xs text-ink/50">
        {submission!.team.members.map((m) => m.user.name).join(", ")}
      </p>

      <div className="mt-4 flex gap-4 text-sm">
        {submission!.repoUrl && (
          <a href={submission!.repoUrl} target="_blank" className="text-accent hover:underline">
            Repository
          </a>
        )}
        {submission!.demoUrl && (
          <a href={submission!.demoUrl} target="_blank" className="text-accent hover:underline">
            Live demo
          </a>
        )}
      </div>

      <div className="mt-8">
        <VoteWidget submissionId={submission!.id} />
      </div>

      <div className="mt-10">
        <CommentsSection submissionId={submission!.id} />
      </div>
    </div>
  );
}
