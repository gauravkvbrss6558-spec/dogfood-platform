"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

type JudgingEvent = {
  event: { id: string; name: string; slug: string };
};

export default function JudgeHome({ judgingEvents }: { judgingEvents: JudgingEvent[] }) {
  const { data: session } = useSession();

  async function downloadCertificate(eventId: string) {
    if (!session) return;
    const res = await fetch(`/api/events/${eventId}/certificates/judge/${session.user.id}`);
    if (!res.ok) return;
    const { token } = await res.json();
    window.open(`/certificate/${token}`, "_blank");
  }

  return (
    <section className="rounded-lg border border-line p-5">
      <h2 className="font-medium">Judging</h2>
      <p className="mt-1 text-sm text-ink/60">You've been invited to judge these events.</p>
      <div className="mt-3 space-y-2">
        {judgingEvents.map(({ event }) => (
          <div key={event.id} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
            <Link href={`/judge/${event.id}`} className="hover:text-accent">
              {event.name} — score your assigned projects →
            </Link>
            <button
              onClick={() => downloadCertificate(event.id)}
              className="text-xs text-accent hover:underline"
            >
              Get my certificate
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
