"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
};

export default function CommentsSection({ submissionId }: { submissionId: string }) {
  const { data: session, status } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch(`/api/submissions/${submissionId}/comments`);
    if (res.ok) setComments(await res.json());
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPosting(true);
    const res = await fetch(`/api/submissions/${submissionId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    setPosting(false);
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setBody("");
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  return (
    <div>
      <h3 className="text-sm font-semibold">Comments ({comments.length})</h3>

      <div className="mt-3 space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-md border border-line p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.author.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink/40">{new Date(c.createdAt).toLocaleString()}</span>
                {session?.user.id === c.author.id && (
                  <button onClick={() => remove(c.id)} className="text-xs text-red-600 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-ink/80">{c.body}</p>
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-ink/50">No comments yet.</p>}
      </div>

      {status === "authenticated" ? (
        <form onSubmit={post} className="mt-4 space-y-2">
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave a comment…"
            rows={2}
            maxLength={2000}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={posting}
            className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {posting ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ink/60">
          <Link href="/login" className="text-accent hover:underline">Log in</Link> to leave a comment.
        </p>
      )}
    </div>
  );
}
