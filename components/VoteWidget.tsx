"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type VoteStatus = {
  votingEnabled: boolean;
  votingOpen: boolean;
  resultsHidden: boolean;
  myVote: number | null;
  averageScore?: number | null;
  voteCount?: number;
};

export default function VoteWidget({ submissionId }: { submissionId: string }) {
  const { data: session, status } = useSession();
  const [voteStatus, setVoteStatus] = useState<VoteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch(`/api/submissions/${submissionId}/vote`);
    if (res.ok) setVoteStatus(await res.json());
  }

  async function castVote(value: number) {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/submissions/${submissionId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    load();
  }

  if (!voteStatus) return null;
  if (!voteStatus.votingEnabled) return null; // Voting was never enabled for this event.

  return (
    <div className="rounded-lg border border-line p-5">
      <h3 className="text-sm font-semibold">Community rating</h3>

      {status === "unauthenticated" && (
        <p className="mt-2 text-sm text-ink/60">
          <Link href="/login" className="text-accent hover:underline">Log in</Link> to vote.
        </p>
      )}

      {status === "authenticated" && voteStatus.votingOpen && (
        <div className="mt-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              disabled={saving}
              onClick={() => castVote(n)}
              className={`h-8 w-8 rounded-md text-sm font-medium ${
                voteStatus.myVote !== null && n <= voteStatus.myVote
                  ? "bg-accent text-white"
                  : "border border-line hover:bg-accentSoft"
              }`}
            >
              {n}
            </button>
          ))}
          {voteStatus.myVote !== null && (
            <span className="ml-2 text-xs text-ink/50">Your rating: {voteStatus.myVote}/5</span>
          )}
        </div>
      )}

      {!voteStatus.votingOpen && voteStatus.myVote !== null && (
        <p className="mt-2 text-xs text-ink/50">You rated this {voteStatus.myVote}/5.</p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {voteStatus.resultsHidden ? (
        <p className="mt-3 text-xs text-ink/50">
          Results are hidden while voting is open, to keep votes independent.
        </p>
      ) : (
        voteStatus.averageScore !== null &&
        voteStatus.averageScore !== undefined && (
          <p className="mt-3 text-sm">
            Average: <strong>{voteStatus.averageScore}/5</strong> ({voteStatus.voteCount} vote
            {voteStatus.voteCount !== 1 ? "s" : ""})
          </p>
        )
      )}
    </div>
  );
}
