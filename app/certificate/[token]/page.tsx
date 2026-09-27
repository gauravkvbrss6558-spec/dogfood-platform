import { getServerKeypair } from "@/lib/keys";
import { decodeRecordToken, verifyRecord } from "@/lib/certRecord";

type CertPayload = {
  type: "PARTICIPATION" | "JUDGE";
  recipientName: string;
  eventName: string;
  issuedAt: string;
  teamName?: string;
  projectTitle?: string;
  assignmentsCompleted?: number;
  assignmentsTotal?: number;
};

export default async function CertificatePage({ params }: { params: { token: string } }) {
  const record = decodeRecordToken<CertPayload>(params.token);
  const { publicKey } = await getServerKeypair();
  const valid = record ? verifyRecord(record, publicKey) : false;

  if (!record || !valid) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-red-700">Not verified</h1>
        <p className="mt-2 text-sm text-red-600">
          This link's signature could not be verified against this server's published public key.
          It may be malformed, tampered with, or issued by a different server.
        </p>
      </div>
    );
  }

  const p = record.payload;

  return (
    <div className="print:m-0">
      <div className="rounded-lg border-2 border-accent p-10 text-center">
        <p className="text-xs uppercase tracking-widest text-ink/50">
          {p.type === "JUDGE" ? "Certificate of Judging Participation" : "Certificate of Participation"}
        </p>
        <h1 className="mt-4 text-3xl font-semibold">{p.recipientName}</h1>
        <p className="mt-4 text-ink/70">
          {p.type === "JUDGE" ? (
            <>
              judged <strong>{p.eventName}</strong>, completing {p.assignmentsCompleted} of{" "}
              {p.assignmentsTotal} assigned project reviews.
            </>
          ) : (
            <>
              participated in <strong>{p.eventName}</strong> as part of team{" "}
              <strong>{p.teamName}</strong>, submitting <em>{p.projectTitle}</em>.
            </>
          )}
        </p>
        <p className="mt-6 text-xs text-ink/40">Issued {new Date(p.issuedAt).toLocaleDateString()}</p>
      </div>

      <div className="mt-4 rounded-md bg-accentSoft p-3 text-center text-xs text-accent print:hidden">
        ✓ Cryptographically verified against this server's published Ed25519 public key
        (<a href="/api/public-key" className="underline">/api/public-key</a>). Anyone with this link can
        re-verify it independently — verification doesn't rely on trusting this page.
      </div>

      <div className="mt-4 text-center print:hidden">
        <button
          className="rounded-md border border-line px-4 py-2 text-sm hover:bg-accentSoft"
          data-print-trigger
        >
          Print / Save as PDF
        </button>
      </div>

      {/* Minimal inline script for the print button — a tiny, self-contained
          interaction that doesn't warrant pulling this whole page into a
          client component just for one onClick handler. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelector('[data-print-trigger]')?.addEventListener('click', () => window.print());`
        }}
      />
    </div>
  );
}
