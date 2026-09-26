"use client";

import { useEffect, useState } from "react";

type Criterion = { id: string; name: string; weight: number; maxScore: number };
type Assignment = {
  id: string;
  submission: {
    id: string;
    title: string;
    description: string;
    repoUrl: string | null;
    demoUrl: string | null;
    track: { name: string } | null;
  };
  scores: { criterionId: string; value: number }[];
};

export default function JudgeScoring({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [rubric, setRubric] = useState<{ criteria: Criterion[] } | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/events/${eventId}/assignments`);
    setLoading(false);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    const data = await res.json();
    setRubric(data.rubric);
    setAssignments(data.assignments);
  }

  if (loading) return <p className="text-sm text-ink/60">Loading your assignments…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!rubric) return <p className="text-sm text-ink/60">This event doesn't have a rubric set up yet.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{eventName} — your assignments</h1>
      <p className="mt-1 text-sm text-ink/60">
        You've been assigned {assignments.length} project{assignments.length !== 1 ? "s" : ""} to score.
      </p>

      <div className="mt-6 space-y-4">
        {assignments.map((a) => (
          <ScoreCard key={a.id} assignment={a} criteria={rubric.criteria} onSaved={load} />
        ))}
      </div>
    </div>
  );
}

function ScoreCard({
  assignment,
  criteria,
  onSaved
}: {
  assignment: Assignment;
  criteria: Criterion[];
  onSaved: () => void;
}) {
  const existing = new Map(assignment.scores.map((s) => [s.criterionId, s.value]));
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(criteria.map((c) => [c.id, existing.get(c.id) ?? 0]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(assignment.scores.length === criteria.length);
  const [error, setError] = useState<string | null>(null);

  const s = assignment.submission;

  async function save() {
    setError(null);
    setSaving(true);
    const res = await fetch(`/api/assignments/${assignment.id}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scores: criteria.map((c) => ({ criterionId: c.id, value: values[c.id] }))
      })
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setSaved(true);
    onSaved();
  }

  return (
    <div className="rounded-lg border border-line p-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">{s.title}</h3>
          {s.track && (
            <span className="mt-1 inline-block rounded-full bg-accentSoft px-2 py-0.5 text-xs text-accent">
              {s.track.name}
            </span>
          )}
        </div>
        {saved && <span className="text-xs text-accent">Scored</span>}
      </div>
      <p className="mt-2 text-sm text-ink/80">{s.description}</p>
      <div className="mt-2 flex gap-3 text-xs">
        {s.repoUrl && <a href={s.repoUrl} target="_blank" className="text-accent hover:underline">Repository</a>}
        {s.demoUrl && <a href={s.demoUrl} target="_blank" className="text-accent hover:underline">Live demo</a>}
      </div>

      <div className="mt-4 space-y-3">
        {criteria.map((c) => (
          <div key={c.id}>
            <div className="flex items-center justify-between text-sm">
              <label>{c.name} <span className="text-ink/40">(weight {c.weight})</span></label>
              <span className="text-xs text-ink/50">{values[c.id]} / {c.maxScore}</span>
            </div>
            <input
              type="range"
              min={0}
              max={c.maxScore}
              step={1}
              value={values[c.id]}
              onChange={(e) => {
                setSaved(false);
                setValues((prev) => ({ ...prev, [c.id]: Number(e.target.value) }));
              }}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="mt-3 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save scores"}
      </button>
    </div>
  );
}
