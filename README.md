# Dogfood Platform

A self-hostable hackathon submission and judging platform, built for the
Dogfood | 72-Hour Hackathon. This is a **complete T1–T4** implementation:
authentication with email OTP verification, roles, event creation, team
formation via invite codes, submission with draft/edit and deadline
enforcement, a public searchable gallery, judge invitation and assignment,
weighted rubrics, judge progress dashboards, cross-judge z-score
normalization, community voting with hidden results and randomized
ordering, comments, rate limiting, duplicate-vote detection, audit trails,
outbound webhooks, signed and publicly verifiable certificates and judge
records, an embeddable gallery widget, bulk team import, and CSV export
throughout.

## Quick start (Docker — recommended)

Requires only Docker installed. No cloud account, no external services.

```bash
docker compose up
```

This will:
1. Start a Postgres database.
2. Build and start the Next.js app.
3. Push the database schema.
4. Seed demo data.
5. Serve the app at http://localhost:3000

### Demo logins (password: `password123`)

| Role        | Email                  |
|-------------|------------------------|
| Admin       | admin@dogfood.dev      |
| Organizer   | organizer@dogfood.dev  |
| Judge       | judge@dogfood.dev      |
| Participant | alice@dogfood.dev      |
| Participant | bob@dogfood.dev        |

These seeded accounts are pre-verified (`emailVerifiedAt` set directly by
the seed script) so you can log in immediately without going through OTP
verification — that flow only applies to accounts created through the
actual **Register** page.

### Email OTP verification (new registrations)

Registering a new account requires verifying a 6-digit code sent to your
email before you can log in. **No email provider is configured by
default** — in that case the code is logged to the server console *and*
returned directly in the registration/login response, clearly labeled as
dev/demo mode, so the whole flow still works with zero setup. To send
real email instead, set `EMAIL_PROVIDER` and the matching credentials in
`.env` (or as `docker compose` environment variables) — see
`.env.example` for SMTP or Brevo configuration. See `ARCHITECTURE.md` for
why this is pluggable rather than a hard requirement.

A seeded team ("Team Fixture") with invite code `DEMO-0001` already has a
submitted project visible in the gallery. A rubric is pre-configured, the
judge account is already assigned and has pre-scored it, and community
voting is enabled and open with one demo vote and one demo comment already
in place — log in as `organizer@dogfood.dev` to see the judging panel
(rubric, judges, assignment, progress, results, exports), the community
voting panel (enable/disable, open/close dates, vote audit report), and
the integrations panel (webhooks, embeddable gallery snippet, bulk team
import, certificate generation). Log in as `judge@dogfood.dev` to see the
scoring interface and pull a judge certificate, or as `alice@dogfood.dev`
to pull a participation certificate. Visit `/embed/gallery` directly to
see the embeddable widget, and `/api/public-key` to see the published
verification key.

## Local development (without Docker)

Requires Node.js 20+ and a local Postgres instance.

```bash
npm install
cp .env.example .env   # edit DATABASE_URL if your Postgres isn't local
npm run db:push
npm run db:seed
npm run dev
```

## What's implemented

### Tier 1 — Core
- [x] Email/password authentication with sessions (NextAuth, credentials provider)
- [x] Roles: PARTICIPANT, JUDGE, ORGANIZER, ADMIN
- [x] Event creation with configurable dates, tracks, and prizes (organizers only)
- [x] Team formation through invite codes, capped at 4 members
- [x] Project submission with draft/edit and hard deadline enforcement (server-side)
- [x] Searchable public gallery of submitted projects

### Tier 2 — Judging
- [x] Judge invitation (organizer invites an existing account by email, per event)
- [x] Balanced round-robin judge assignment, excluding a judge's own team as a conflict of interest
- [x] Weighted, configurable judging rubrics (weights validated to sum to 1.0)
- [x] Backend-enforced role isolation — judges only see their own assigned submissions and can only write their own scores, checked server-side on every request
- [x] Judge progress dashboard (per-judge completed/remaining counts)
- [x] Cross-judge score normalization (z-score method — see JUDGING.md)
- [x] CSV export: teams, submissions, raw scores (audit trail), and normalized results

### Tier 3 — Public
- [x] Configurable community voting (organizer enables/disables per event, with optional open/close dates)
- [x] Comments on submissions (soft-deletable by author, event organizer, or admin)
- [x] Hidden results during voting (average score hidden from everyone but the organizer while voting is open)
- [x] Randomized project ordering (deterministic per-viewer seeded shuffle, applied whenever any listed project has active voting)
- [x] Rate limiting (sliding-window, DB-backed — no Redis or external service needed)
- [x] Duplicate detection (hard: one vote per account, DB-enforced unique constraint; soft: suspicious-IP-cluster report for organizer review, not auto-blocking)
- [x] Audit trails (append-only `AuditLog` table; CSV export)

### Tier 4 — Stretch
- [x] REST API and webhooks covering UI actions (submission submitted, vote cast, comment posted, judges assigned, score submitted — HMAC-signed deliveries, organizer-configurable per event)
- [x] Certificate and record generation (participation certificates for submitted teams, judging-participation certificates for judges)
- [x] Signed and publicly verifiable judge participation records (Ed25519, not HMAC — verifiable via the published public key at `/api/public-key`, without trusting a live API call)
- [x] Embeddable gallery widget (`/embed/gallery?eventId=...`, iframe-ready, no site chrome or session-aware content)
- [x] Bulk import and export (CSV team import with per-row partial success reporting; CSV export already covered in T2/T3)

Everything above is implemented and covered by the test suite. Beyond
this, only the optional bonus challenges (Normalization Proof, Pairwise
Mode, Threat Model, API First / OpenAPI spec) remain — see
`acceptance-report.txt` for status on those.

## Project structure

```
app/            Next.js pages and API routes (App Router)
components/     Client-side React components
lib/            Shared server logic (Prisma client, auth config, RBAC helper)
prisma/         Database schema and seed script
types/          TypeScript type augmentations
```

See `ARCHITECTURE.md` and `DATA-MODEL.md` for more detail.
