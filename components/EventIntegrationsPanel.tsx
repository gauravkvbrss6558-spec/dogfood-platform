"use client";

import { useEffect, useState } from "react";

type Webhook = { id: string; url: string; eventTypes: string[] };
type Participant = { userId: string; name: string; teamName: string };
type Judge = { user: { id: string; name: string } };
type ImportResult = { lineNumber: number; teamName: string; status: string; reason?: string };

const EVENT_TYPES = ["SUBMISSION_SUBMITTED", "VOTE_CAST", "COMMENT_POSTED", "JUDGES_ASSIGNED", "SCORE_SUBMITTED"];

export default function EventIntegrationsPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(EVENT_TYPES);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [csv, setCsv] = useState("");
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!open) return;
    loadWebhooks();
    loadParticipants();
    loadJudges();
  }, [open]);

  async function loadWebhooks() {
    const res = await fetch(`/api/events/${eventId}/webhooks`);
    if (res.ok) setWebhooks(await res.json());
  }
  async function loadParticipants() {
    const res = await fetch(`/api/events/${eventId}/participants`);
    if (res.ok) setParticipants(await res.json());
  }
  async function loadJudges() {
    const res = await fetch(`/api/events/${eventId}/judges`);
    if (res.ok) setJudges(await res.json());
  }

  async function addWebhook(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewSecret(null);
    setLoading("webhook");
    const res = await fetch(`/api/events/${eventId}/webhooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, eventTypes: selectedTypes })
    });
    setLoading(null);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    const data = await res.json();
    setNewSecret(data.secret);
    setWebhookUrl("");
    loadWebhooks();
  }

  async function deleteWebhook(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    loadWebhooks();
  }

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("import");
    const res = await fetch(`/api/events/${eventId}/import/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv })
    });
    setLoading(null);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setImportResults(data.results);
  }

  async function openCertificate(kind: "participant" | "judge", userId: string) {
    const res = await fetch(`/api/events/${eventId}/certificates/${kind}/${userId}`);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    const { token } = await res.json();
    window.open(`/certificate/${token}`, "_blank");
  }

  return (
    <div className="mt-3 rounded-md border border-line">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium"
      >
        Integrations &amp; certificates
        <span className="text-ink/40">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-6 border-t border-line p-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Embed snippet */}
          <section>
            <h4 className="text-sm font-semibold">Embeddable gallery widget</h4>
            <p className="mt-1 text-xs text-ink/50">Paste this into any page to show a live feed of submissions.</p>
            <code className="mt-2 block overflow-x-auto rounded-md bg-accentSoft p-2 text-xs">
              {`<iframe src="${origin}/embed/gallery?eventId=${eventId}" width="600" height="400" style="border:0"></iframe>`}
            </code>
          </section>

          {/* Webhooks */}
          <section>
            <h4 className="text-sm font-semibold">Webhooks</h4>
            <form onSubmit={addWebhook} className="mt-2 space-y-2">
              <input
                required
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-server.example.com/webhook"
                className="w-full rounded-md border border-line px-2 py-1 text-sm"
              />
              <div className="flex flex-wrap gap-2 text-xs">
                {EVENT_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(t)}
                      onChange={(e) =>
                        setSelectedTypes((prev) =>
                          e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)
                        )
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
              <button
                disabled={loading === "webhook"}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading === "webhook" ? "Adding…" : "Add webhook"}
              </button>
            </form>

            {newSecret && (
              <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                Signing secret (shown once — save it now):{" "}
                <code className="font-mono">{newSecret}</code>
              </p>
            )}

            <div className="mt-3 space-y-1">
              {webhooks.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{w.url}</span>
                  <button onClick={() => deleteWebhook(w.id)} className="text-red-600 hover:underline">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Bulk import */}
          <section>
            <h4 className="text-sm font-semibold">Bulk import teams</h4>
            <p className="mt-1 text-xs text-ink/50">
              One team per line: <code>teamName,member1@email.com,member2@email.com</code>. Members must
              already have accounts.
            </p>
            <form onSubmit={runImport} className="mt-2 space-y-2">
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={4}
                placeholder="Team Rocket,alice@example.com,bob@example.com"
                className="w-full rounded-md border border-line px-2 py-1 font-mono text-xs"
              />
              <button
                disabled={loading === "import"}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading === "import" ? "Importing…" : "Import teams"}
              </button>
            </form>
            {importResults && (
              <table className="mt-2 w-full text-xs">
                <tbody>
                  {importResults.map((r) => (
                    <tr key={r.lineNumber} className="border-t border-line">
                      <td className="py-1">{r.teamName}</td>
                      <td className={`py-1 ${r.status === "created" ? "text-accent" : "text-red-600"}`}>
                        {r.status}{r.reason ? ` — ${r.reason}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Certificates */}
          <section>
            <h4 className="text-sm font-semibold">Certificates</h4>
            <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium text-ink/60">Participants</p>
                {participants.map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => openCertificate("participant", p.userId)}
                    className="mt-1 block text-accent hover:underline"
                  >
                    {p.name} ({p.teamName})
                  </button>
                ))}
              </div>
              <div>
                <p className="font-medium text-ink/60">Judges</p>
                {judges.map((j) => (
                  <button
                    key={j.user.id}
                    onClick={() => openCertificate("judge", j.user.id)}
                    className="mt-1 block text-accent hover:underline"
                  >
                    {j.user.name}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
