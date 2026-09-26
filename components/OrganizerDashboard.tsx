"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EventJudgingPanel from "./EventJudgingPanel";
import EventPublicPanel from "./EventPublicPanel";
import EventIntegrationsPanel from "./EventIntegrationsPanel";

type Event = {
  id: string;
  name: string;
  slug: string;
  startAt: string | Date;
  endAt: string | Date;
  submissionDeadline: string | Date;
  tracks: { id: string; name: string }[];
  teams: {
    id: string;
    name: string;
    inviteCode: string;
    members: { id: string }[];
    submission: { status: string; title: string } | null;
  }[];
};

export default function OrganizerDashboard({ events }: { events: Event[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [tracksInput, setTracksInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        description,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        submissionDeadline: new Date(submissionDeadline).toISOString(),
        tracks: tracksInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      })
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    setName("");
    setSlug("");
    setDescription("");
    setStartAt("");
    setEndAt("");
    setSubmissionDeadline("");
    setTracksInput("");
    router.refresh();
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Organizer dashboard</h1>
        <p className="mt-1 text-sm text-ink/60">Create events and monitor team submissions.</p>
      </div>

      <section className="rounded-lg border border-line p-6">
        <h2 className="font-medium">Create a new event</h2>
        <form onSubmit={handleCreate} className="mt-4 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium">Event name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium">Slug (URL-safe id)</label>
            <input required value={slug} onChange={(e) => setSlug(e.target.value)}
              placeholder="dogfood-2026"
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium">Description</label>
            <textarea required value={description} onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium">Start</label>
            <input required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium">End</label>
            <input required type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium">Submission deadline</label>
            <input required type="datetime-local" value={submissionDeadline}
              onChange={(e) => setSubmissionDeadline(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium">Tracks (comma-separated, optional)</label>
            <input value={tracksInput} onChange={(e) => setTracksInput(e.target.value)}
              placeholder="AI, Fintech, Open Source"
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm" />
          </div>

          {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}

          <div className="col-span-2">
            <button type="submit" disabled={loading}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
              {loading ? "Creating…" : "Create event"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-medium">Your events</h2>
        <div className="mt-4 space-y-4">
          {events.length === 0 && (
            <p className="text-sm text-ink/60">You haven't created any events yet.</p>
          )}
          {events.map((event) => (
            <div key={event.id} className="rounded-lg border border-line p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{event.name}</h3>
                <span className="text-xs text-ink/50">/{event.slug}</span>
              </div>
              <p className="mt-1 text-xs text-ink/60">
                {event.teams.length} team{event.teams.length !== 1 ? "s" : ""} registered
              </p>
              <div className="mt-3 divide-y divide-line">
                {event.teams.map((team) => (
                  <div key={team.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{team.name} · {team.members.length} member(s)</span>
                    <span
                      className={
                        team.submission?.status === "SUBMITTED"
                          ? "rounded-full bg-accentSoft px-2 py-0.5 text-xs text-accent"
                          : "rounded-full bg-line/60 px-2 py-0.5 text-xs text-ink/60"
                      }
                    >
                      {team.submission?.status ?? "No submission"}
                    </span>
                  </div>
                ))}
              </div>
              <EventJudgingPanel eventId={event.id} />
              <EventPublicPanel eventId={event.id} />
              <EventIntegrationsPanel eventId={event.id} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
