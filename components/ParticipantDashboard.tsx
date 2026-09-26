"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type Event = {
  id: string;
  name: string;
  slug: string;
  submissionDeadline: string | Date;
  tracks: { id: string; name: string }[];
};

type Membership = {
  team: {
    id: string;
    name: string;
    inviteCode: string;
    eventId: string;
    event: Event;
    members: { id: string }[];
    submission: {
      title: string;
      description: string;
      repoUrl: string | null;
      demoUrl: string | null;
      trackId: string | null;
      status: string;
    } | null;
  };
};

export default function ParticipantDashboard({
  events,
  memberships
}: {
  events: Event[];
  memberships: Membership[];
}) {
  const eventIdToMembership = new Map(memberships.map((m) => [m.team.eventId, m]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your dashboard</h1>
        <p className="mt-1 text-sm text-ink/60">Join a team and manage your submission per event.</p>
      </div>

      {events.length === 0 && <p className="text-sm text-ink/60">No events yet — check back soon.</p>}

      <div className="space-y-6">
        {events.map((event) => {
          const membership = eventIdToMembership.get(event.id);
          return (
            <section key={event.id} className="rounded-lg border border-line p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{event.name}</h2>
                <span className="text-xs text-ink/50">
                  Deadline: {new Date(event.submissionDeadline).toLocaleString()}
                </span>
              </div>

              {membership ? (
                <TeamPanel event={event} team={membership.team} />
              ) : (
                <JoinOrCreatePanel eventId={event.id} />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function JoinOrCreatePanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"create" | "join" | null>(null);

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("create");
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, name: teamName })
    });
    setLoading(null);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    router.refresh();
  }

  async function joinTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("join");
    const res = await fetch("/api/teams/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode })
    });
    setLoading(null);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-4">
      <form onSubmit={createTeam} className="space-y-2">
        <label className="block text-sm font-medium">Create a team</label>
        <input
          required
          placeholder="Team name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
        />
        <button
          disabled={loading === "create"}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading === "create" ? "Creating…" : "Create team"}
        </button>
      </form>

      <form onSubmit={joinTeam} className="space-y-2">
        <label className="block text-sm font-medium">Join with an invite code</label>
        <input
          required
          placeholder="ABCD-1234"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
        />
        <button
          disabled={loading === "join"}
          className="w-full rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-accentSoft disabled:opacity-50"
        >
          {loading === "join" ? "Joining…" : "Join team"}
        </button>
      </form>

      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function TeamPanel({ event, team }: { event: Event; team: Membership["team"] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const s = team.submission;
  const [title, setTitle] = useState(s?.title ?? "");
  const [description, setDescription] = useState(s?.description ?? "");
  const [repoUrl, setRepoUrl] = useState(s?.repoUrl ?? "");
  const [demoUrl, setDemoUrl] = useState(s?.demoUrl ?? "");
  const [trackId, setTrackId] = useState(s?.trackId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"draft" | "submit" | null>(null);

  const deadlinePassed = new Date() > new Date(event.submissionDeadline);

  async function downloadCertificate() {
    if (!session) return;
    const res = await fetch(`/api/events/${event.id}/certificates/participant/${session.user.id}`);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    const { token } = await res.json();
    window.open(`/certificate/${token}`, "_blank");
  }

  async function save(action: "draft" | "submit") {
    setError(null);
    setLoading(action);
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId: team.id,
        title,
        description,
        repoUrl,
        demoUrl,
        trackId: trackId || null,
        action
      })
    });
    setLoading(null);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between rounded-md bg-accentSoft px-3 py-2 text-sm">
        <span>
          Team <strong>{team.name}</strong> · {team.members.length}/4 members
        </span>
        <span className="text-xs">
          Invite code: <code className="font-mono">{team.inviteCode}</code>
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Project title</label>
          <input
            disabled={deadlinePassed}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-line/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            disabled={deadlinePassed}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-line/30"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Repo URL</label>
            <input
              disabled={deadlinePassed}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-line/30"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Demo URL</label>
            <input
              disabled={deadlinePassed}
              value={demoUrl}
              onChange={(e) => setDemoUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-line/30"
            />
          </div>
        </div>
        {event.tracks.length > 0 && (
          <div>
            <label className="block text-sm font-medium">Track</label>
            <select
              disabled={deadlinePassed}
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-line/30"
            >
              <option value="">No track</option>
              {event.tracks.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {deadlinePassed && (
        <p className="text-sm text-ink/60">The submission deadline has passed — this project is locked.</p>
      )}

      {!deadlinePassed && (
        <div className="flex gap-3">
          <button
            onClick={() => save("draft")}
            disabled={loading !== null}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-accentSoft disabled:opacity-50"
          >
            {loading === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={() => save("submit")}
            disabled={loading !== null}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading === "submit" ? "Submitting…" : "Submit final"}
          </button>
        </div>
      )}

      {s && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink/50">
            Current status: <strong>{s.status}</strong>
          </p>
          {s.status === "SUBMITTED" && (
            <button onClick={downloadCertificate} className="text-xs text-accent hover:underline">
              Get my certificate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
