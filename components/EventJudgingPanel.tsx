"use client";

import { useEffect, useState } from "react";

type Criterion = { id?: string; name: string; weight: number; maxScore: number };
type ProgressRow = {
  judge: { id: string; name: string; email: string };
  totalAssigned: number;
  completed: number;
  remaining: number;
};
type ResultRow = {
  submissionId: string;
  title: string;
  teamName: string;
  trackName: string | null;
  normalizedScore: number;
  judgeCount: number;
};

export default function EventJudgingPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [criteria, setCriteria] = useState<Criterion[]>([
    { name: "Technical depth", weight: 0.4, maxScore: 10 },
    { name: "Judging integrity / execution", weight: 0.6, maxScore: 10 }
  ]);
  const [judgeEmail, setJudgeEmail] = useState("");
  const [judgesPerSubmission, setJudgesPerSubmission] = useState(3);
  const [progress, setProgress] = useState<ProgressRow[] | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  useEffect(() => {
    if (!open) return;
    loadRubric();
    loadProgress();
  }, [open]);

  async function loadRubric() {
    const res = await fetch(`/api/events/${eventId}/rubric`);
    const data = await res.json();
    if (data?.criteria?.length) {
      setCriteria(data.criteria.map((c: any) => ({ id: c.id, name: c.name, weight: c.weight, maxScore: c.maxScore })));
    }
  }

  async function loadProgress() {
    const res = await fetch(`/api/events/${eventId}/progress`);
    if (res.ok) setProgress(await res.json());
  }

  async function loadResults() {
    setLoading("results");
    const res = await fetch(`/api/events/${eventId}/results`);
    setLoading(null);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setResults(await res.json());
  }

  function updateCriterion(index: number, field: keyof Criterion, value: string) {
    setCriteria((prev) =>
      prev.map((c, i) =>
        i === index
          ? { ...c, [field]: field === "name" ? value : Number(value) }
          : c
      )
    );
  }

  function addCriterion() {
    setCriteria((prev) => [...prev, { name: "", weight: 0, maxScore: 10 }]);
  }

  async function saveRubric(force = false) {
    setError(null);
    setMessage(null);
    setLoading("rubric");
    const res = await fetch(`/api/events/${eventId}/rubric`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria: criteria.map(({ id, ...rest }) => rest), force })
    });
    setLoading(null);
    if (!res.ok) {
      const data = await res.json();
      if (res.status === 409) {
        const confirmed = window.confirm(`${data.error}\n\nReplace the rubric and delete those scores?`);
        if (confirmed) {
          await saveRubric(true);
        }
        return;
      }
      setError(data.error);
      return;
    }
    setMessage("Rubric saved.");
    loadProgress();
  }

  async function inviteJudge(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading("invite");
    const res = await fetch(`/api/events/${eventId}/judges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: judgeEmail })
    });
    setLoading(null);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setMessage(`Invited ${judgeEmail} as a judge.`);
    setJudgeEmail("");
    loadProgress();
  }

  async function runAssignment(force: boolean) {
    setError(null);
    setMessage(null);
    setLoading("assign");
    const res = await fetch(`/api/events/${eventId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ judgesPerSubmission, force })
    });
    setLoading(null);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setMessage(
      `Created ${data.created} assignments across ${data.submissionsCovered} submissions.` +
        (data.warning ? ` ${data.warning}` : "")
    );
    loadProgress();
  }

  return (
    <div className="mt-4 rounded-md border border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium"
      >
        Judging setup
        <span className="text-ink/40">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-line p-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {message && <p className="text-sm text-accent">{message}</p>}

          {/* Rubric */}
          <section>
            <h4 className="text-sm font-semibold">Rubric</h4>
            <p className="text-xs text-ink/50">Weights must sum to 1.0 (currently {totalWeight.toFixed(2)})</p>
            <div className="mt-2 space-y-2">
              {criteria.map((c, i) => (
                <div key={i} className="grid grid-cols-6 gap-2">
                  <input
                    value={c.name}
                    onChange={(e) => updateCriterion(i, "name", e.target.value)}
                    placeholder="Criterion name"
                    className="col-span-3 rounded-md border border-line px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    step="0.05"
                    value={c.weight}
                    onChange={(e) => updateCriterion(i, "weight", e.target.value)}
                    placeholder="Weight"
                    className="col-span-2 rounded-md border border-line px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    value={c.maxScore}
                    onChange={(e) => updateCriterion(i, "maxScore", e.target.value)}
                    placeholder="Max"
                    className="col-span-1 rounded-md border border-line px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button onClick={addCriterion} className="text-xs text-accent hover:underline">
                + Add criterion
              </button>
              <button
                onClick={() => saveRubric()}
                disabled={loading === "rubric"}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading === "rubric" ? "Saving…" : "Save rubric"}
              </button>
            </div>
          </section>

          {/* Judges */}
          <section>
            <h4 className="text-sm font-semibold">Invite a judge</h4>
            <form onSubmit={inviteJudge} className="mt-2 flex gap-2">
              <input
                required
                type="email"
                value={judgeEmail}
                onChange={(e) => setJudgeEmail(e.target.value)}
                placeholder="judge@example.com (must already have an account)"
                className="flex-1 rounded-md border border-line px-2 py-1 text-sm"
              />
              <button
                disabled={loading === "invite"}
                className="rounded-md border border-line px-3 py-1 text-xs font-medium hover:bg-accentSoft disabled:opacity-50"
              >
                {loading === "invite" ? "Inviting…" : "Invite"}
              </button>
            </form>
          </section>

          {/* Assignment */}
          <section>
            <h4 className="text-sm font-semibold">Run assignment</h4>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-xs">Judges per submission</label>
              <input
                type="number"
                min={1}
                max={10}
                value={judgesPerSubmission}
                onChange={(e) => setJudgesPerSubmission(Number(e.target.value))}
                className="w-16 rounded-md border border-line px-2 py-1 text-sm"
              />
              <button
                onClick={() => runAssignment(false)}
                disabled={loading === "assign"}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading === "assign" ? "Running…" : "Assign judges"}
              </button>
              <button
                onClick={() => runAssignment(true)}
                disabled={loading === "assign"}
                className="rounded-md border border-line px-3 py-1 text-xs hover:bg-accentSoft disabled:opacity-50"
              >
                Reset &amp; re-run
              </button>
            </div>
          </section>

          {/* Progress */}
          <section>
            <h4 className="text-sm font-semibold">Judge progress</h4>
            {progress === null ? (
              <p className="text-xs text-ink/50">Loading…</p>
            ) : progress.length === 0 ? (
              <p className="text-xs text-ink/50">No judges invited yet.</p>
            ) : (
              <table className="mt-2 w-full text-xs">
                <thead className="text-left text-ink/50">
                  <tr>
                    <th className="pb-1">Judge</th>
                    <th className="pb-1">Completed</th>
                    <th className="pb-1">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {progress.map((p) => (
                    <tr key={p.judge.id} className="border-t border-line">
                      <td className="py-1">{p.judge.name}</td>
                      <td className="py-1">{p.completed} / {p.totalAssigned}</td>
                      <td className="py-1">{p.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Results + exports */}
          <section>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Results (normalized)</h4>
              <button onClick={loadResults} disabled={loading === "results"} className="text-xs text-accent hover:underline">
                {loading === "results" ? "Computing…" : "Compute results"}
              </button>
            </div>
            {results && (
              <table className="mt-2 w-full text-xs">
                <thead className="text-left text-ink/50">
                  <tr>
                    <th className="pb-1">#</th>
                    <th className="pb-1">Project</th>
                    <th className="pb-1">Team</th>
                    <th className="pb-1">Score</th>
                    <th className="pb-1">Judges</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={r.submissionId} className="border-t border-line">
                      <td className="py-1">{i + 1}</td>
                      <td className="py-1">{r.title}</td>
                      <td className="py-1">{r.teamName}</td>
                      <td className="py-1">{r.normalizedScore}</td>
                      <td className="py-1">{r.judgeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <a className="text-accent hover:underline" href={`/api/events/${eventId}/export/teams`}>Export teams CSV</a>
              <a className="text-accent hover:underline" href={`/api/events/${eventId}/export/submissions`}>Export submissions CSV</a>
              <a className="text-accent hover:underline" href={`/api/events/${eventId}/export/scores`}>Export raw scores CSV</a>
              <a className="text-accent hover:underline" href={`/api/events/${eventId}/export/results`}>Export results CSV</a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
