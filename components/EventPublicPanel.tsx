"use client";

import { useEffect, useState } from "react";

type Cluster = { ipHash: string; distinctVoters: number; totalVotes: number; submissionIds: string[] };

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventPublicPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [audit, setAudit] = useState<{ totalVotes: number; suspiciousClusters: Cluster[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadConfig();
    loadAudit();
  }, [open]);

  async function loadConfig() {
    const res = await fetch(`/api/events/${eventId}/voting`);
    if (res.ok) {
      const data = await res.json();
      setVotingEnabled(data.votingEnabled);
      setOpensAt(toLocalInputValue(data.votingOpensAt));
      setClosesAt(toLocalInputValue(data.votingClosesAt));
    }
  }

  async function loadAudit() {
    const res = await fetch(`/api/events/${eventId}/vote-audit`);
    if (res.ok) setAudit(await res.json());
  }

  async function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading("config");
    const res = await fetch(`/api/events/${eventId}/voting`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        votingEnabled,
        votingOpensAt: opensAt ? new Date(opensAt).toISOString() : null,
        votingClosesAt: closesAt ? new Date(closesAt).toISOString() : null
      })
    });
    setLoading(null);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setMessage("Voting settings saved.");
  }

  return (
    <div className="mt-3 rounded-md border border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium"
      >
        Community voting
        <span className="text-ink/40">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-line p-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-accent">{message}</p>}

          <form onSubmit={saveConfig} className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={votingEnabled}
                onChange={(e) => setVotingEnabled(e.target.checked)}
              />
              Enable community voting for this event
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium">Opens (optional)</label>
                <input
                  type="datetime-local"
                  value={opensAt}
                  onChange={(e) => setOpensAt(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium">Closes (optional)</label>
                <input
                  type="datetime-local"
                  value={closesAt}
                  onChange={(e) => setClosesAt(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line px-2 py-1 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-ink/50">
              Results (average scores) are hidden from everyone except you while voting is open.
            </p>
            <button
              disabled={loading === "config"}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading === "config" ? "Saving…" : "Save voting settings"}
            </button>
          </form>

          <section>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Vote audit</h4>
              <a
                href={`/api/events/${eventId}/export/audit`}
                className="text-xs text-accent hover:underline"
              >
                Export audit log CSV
              </a>
            </div>
            {audit === null ? (
              <p className="mt-2 text-xs text-ink/50">Loading…</p>
            ) : (
              <>
                <p className="mt-2 text-xs text-ink/50">{audit.totalVotes} total votes cast.</p>
                {audit.suspiciousClusters.length === 0 ? (
                  <p className="mt-1 text-xs text-ink/50">No suspicious voting patterns detected.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-amber-700">
                      {audit.suspiciousClusters.length} network(s) with unusually many distinct voters
                      — review before trusting results, don't assume abuse automatically (shared
                      networks like a campus or office can trigger this too).
                    </p>
                    <table className="w-full text-xs">
                      <thead className="text-left text-ink/50">
                        <tr>
                          <th className="pb-1">Network (hashed)</th>
                          <th className="pb-1">Distinct voters</th>
                          <th className="pb-1">Total votes</th>
                          <th className="pb-1">Projects affected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {audit.suspiciousClusters.map((c) => (
                          <tr key={c.ipHash} className="border-t border-line">
                            <td className="py-1 font-mono">{c.ipHash.slice(0, 10)}…</td>
                            <td className="py-1">{c.distinctVoters}</td>
                            <td className="py-1">{c.totalVotes}</td>
                            <td className="py-1">{c.submissionIds.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
