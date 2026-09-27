import { prisma } from "@/lib/prisma";

// Deliberately a plain server component with no client-side JS beyond
// what the browser needs to render links — an embeddable widget running
// inside someone else's page should be as lightweight and dependency-free
// as possible. No search box, no voting UI, no session-aware content:
// just a read-only showcase, which is what third parties embedding a
// hackathon's results actually want.
export default async function EmbedGalleryPage({
  searchParams
}: {
  searchParams: { eventId?: string };
}) {
  const submissions = await prisma.submission.findMany({
    where: {
      status: "SUBMITTED",
      ...(searchParams.eventId ? { team: { eventId: searchParams.eventId } } : {})
    },
    orderBy: { submittedAt: "desc" },
    take: 24,
    include: { team: { include: { event: true } }, track: true }
  });

  return (
    <div>
      <p className="mb-4 text-xs text-ink/40">
        Powered by <a href="/gallery" target="_top" className="underline">Dogfood</a>
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {submissions.map((s) => (
          <a
            key={s.id}
            href={`/gallery/${s.id}`}
            target="_top"
            className="block rounded-lg border border-line p-4 hover:border-accent"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-medium">{s.title}</h3>
              {s.track && (
                <span className="rounded-full bg-accentSoft px-2 py-0.5 text-xs text-accent">
                  {s.track.name}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink/50">{s.team.event.name}</p>
            <p className="mt-2 line-clamp-2 text-xs text-ink/70">{s.description}</p>
          </a>
        ))}
        {submissions.length === 0 && (
          <p className="text-sm text-ink/50">No submitted projects yet.</p>
        )}
      </div>
    </div>
  );
}
