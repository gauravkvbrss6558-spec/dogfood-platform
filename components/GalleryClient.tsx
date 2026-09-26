"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Submission = {
  id: string;
  title: string;
  description: string;
  repoUrl: string | null;
  demoUrl: string | null;
  trackName: string | null;
  eventName: string;
  teamName: string;
  memberNames: string[];
  votingOpen: boolean;
};

export default function GalleryClient({
  submissions,
}: {
  submissions: Submission[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((s) =>
      [s.title, s.description, s.teamName, s.eventName, s.trackName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query, submissions]);

  const anyVotingOpen = submissions.some((s) => s.votingOpen);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-sm text-signal">gallery</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Project gallery
          </h1>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects, teams, tracks…"
          className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-signal focus:outline-none sm:w-72"
        />
      </div>
      {anyVotingOpen && (
        <p className="mt-3 text-xs text-muted">
          Community voting is open for some projects below — order is randomized
          per visitor so no project gets an unfair first-look advantage.
        </p>
      )}

      {filtered.length === 0 && (
        <p className="mt-10 text-sm text-muted">
          No submitted projects match your search yet.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filtered.map((s) => (
          <Link
            key={s.id}
            href={`/gallery/${s.id}`}
            className="block rounded-md border border-line bg-surface p-5 transition hover:border-signal"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium text-ink">{s.title}</h3>
              <div className="flex shrink-0 gap-1">
                {s.votingOpen && (
                  <span className="rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 text-xs text-signal">
                    Voting open
                  </span>
                )}
                {s.trackName && (
                  <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    {s.trackName}
                  </span>
                )}
              </div>
            </div>
            <p className="mt-1 font-mono text-xs text-muted">
              {s.eventName} · Team {s.teamName}
            </p>
            <p className="mt-3 text-sm text-ink/80">{s.description}</p>
            <p className="mt-3 text-xs text-muted">
              {s.memberNames.join(", ")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
