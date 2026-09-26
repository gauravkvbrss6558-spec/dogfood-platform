# Data Model

Schema source of truth: `prisma/schema.prisma`. This document explains the
*why* behind it; the schema file itself is the exact *what*.

## Entity overview

```
User ──< TeamMember >── Team ── Submission ──< JudgeAssignment >── User (judge)
  │                        │           │            │
  │                        │           │            └── Score >── RubricCriterion ── Rubric ── Event
  │                        │           ├── Vote >── User (voter)
  │                        │           └── Comment >── User (author)
  │                        └── Event ── Track
  ├── (organizes) ── Event ── Prize
  └── (judges, via EventJudge) ── Event

AuditLog ── User (actor, nullable — survives the actor being deleted)
```

## Tables

### User
- `role` is one enum column (`PARTICIPANT | JUDGE | ORGANIZER | ADMIN`),
  not a separate roles/permissions table. At T1 scale this is simpler and
  just as auditable; if T2+ needs finer-grained permissions (e.g. a judge
  scoped to one event only), that becomes a join table
  (`EventJudge { eventId, userId }`) rather than changing this column.
- `passwordHash` — bcrypt hash only. Never store or log the raw password.
- `emailVerifiedAt` — null until the registration OTP is verified; login
  is refused while it's null (see `lib/auth.ts`). A single nullable
  timestamp rather than a separate `verified: Boolean` because it also
  records *when* verification happened, which is useful audit context for
  free and costs nothing extra to store.

### Event
- Owned by exactly one `organizer` (a `User`). Multiple organizers per
  event isn't needed yet; if it becomes a requirement, add an
  `EventOrganizer` join table rather than making `organizerId` a list.
- `submissionDeadline` is a separate field from `endAt` deliberately —
  many hackathons close submissions before the event's closing ceremony.
- `votingEnabled` / `votingOpensAt` / `votingClosesAt`: voting config
  lives directly on `Event` rather than a separate `VotingConfig` table,
  since it's a 1:1, small, and always-present-or-defaulted set of fields —
  a separate table would just mean an extra join on every voting check
  for no real benefit. Both date bounds are optional independently, so an
  organizer can open voting with no end date, or set only a close date.

### Track / Prize
- Both belong to exactly one `Event` and cascade-delete with it. Tracks
  are referenced by `Submission.trackId` (optional — a submission doesn't
  have to pick a track if the event doesn't require one).

### Team
- `inviteCode` is globally unique (not just unique per event) so a single
  short code is enough to join — no need to also specify which event.
- `@@unique([eventId, name])` — team names must be unique within an event,
  but the same name can be reused across different events.

### TeamMember
- The join table between `User` and `Team`, with a `role` of `LEADER` or
  `MEMBER`. `@@unique([teamId, userId])` prevents duplicate memberships.
- "One team per user per event" is enforced in application code (checked
  in both the create-team and join-team API routes) because Prisma/Postgres
  can't express "unique per user across a *related* event" as a single
  database constraint without a computed/generated column. This is called
  out explicitly so a future contributor doesn't assume the DB alone
  guarantees it under all race conditions — the check-then-write is not
  wrapped in a transaction yet. A hardening pass before production use
  should wrap the create/join flow in a serializable transaction.

### Submission
- `teamId` is `@unique` — one submission per team, modeled as a true
  one-to-one relation rather than a one-to-many, because the platform's
  submission model is "a team has one evolving project," not multiple
  competing drafts.
- `status` (`DRAFT | SUBMITTED`) plus `submittedAt` gives both a quick
  filter for the gallery (`status = SUBMITTED`) and an audit timestamp.

### Rubric / RubricCriterion
- One `Rubric` per `Event` (`eventId` is `@unique`) — an event has exactly
  one active rubric at a time. Re-saving a rubric wipes and recreates its
  criteria inside a transaction (`app/api/events/[id]/rubric/route.ts`)
  rather than diffing rows, since rubrics are small and expected to be
  finalized before judging opens, not edited incrementally.
- `weight` is a fraction (0–1); the API rejects a rubric whose criteria
  weights don't sum to ~1.0. This is validated in application code, not
  the database, since Postgres/Prisma can't express a cross-row SUM
  constraint directly.

### EventJudge
- Join table between `User` and `Event`, `@@unique([eventId, userId])`.
- This is the actual access-control gate for judging routes — a user's
  global `role` column is not checked for judging permissions, only
  whether an `EventJudge` row exists for that specific event. See
  `ARCHITECTURE.md` for why.

### JudgeAssignment
- The output of the assignment algorithm: one row per (judge, submission)
  pair, `@@unique([judgeId, submissionId])` so re-running assignment can't
  silently double up. `Score` rows hang off this, not directly off `User`
  or `Submission`, so "has this judge finished this submission" is a
  single existence/count check on one table.

### Score
- One row per (assignment, criterion), `@@unique([assignmentId, criterionId])`.
  A judge's full scoring of one submission is therefore
  `criteria.length` rows, and "is this assignment fully scored" is
  `scores.length === criteria.length` — computed in
  `app/api/events/[id]/progress/route.ts` and `lib/results.ts`.

### Vote
- `@@unique([submissionId, voterId])` — this single constraint is the
  entire enforcement mechanism for "one vote per person per project." No
  application-level check is needed for the common case; the database
  rejects a second insert outright (the API upserts instead, so casting a
  second vote *updates* the first rather than erroring, which is the
  correct UX for "change my mind").
- `value` is an integer 1–5 (a star rating), not a boolean upvote — see
  `ARCHITECTURE.md` for the reasoning.
- `ipHash` is a salted SHA-256 hash, never the raw IP. It exists solely to
  feed `lib/duplicateDetection.ts`'s cluster report; it is not used to
  block votes and is not linkable back to an IP without the server's
  salt, which isn't stored in the database.

### Comment
- `deletedAt` implements a soft delete. A hard delete would remove the
  evidence a "post spam, delete instantly" abuse pattern leaves behind;
  soft-deleting keeps the row (and its timestamps) while hiding it from
  public queries (`WHERE deletedAt IS NULL`, see
  `app/api/submissions/[id]/comments/route.ts`).

### AuditLog
- Deliberately denormalized and loosely typed (`eventType` is a free-text
  label like `"VOTE_CAST"`, `metadata` is a JSON string) rather than one
  strongly-typed table per action. An audit log's job is to capture what
  happened without knowing in advance every shape "what happened" might
  take — a rigid schema would need a migration every time a new
  auditable action is added. `hackathonEventId` and `actorId` are kept as
  plain, indexed lookup fields (not full relations for `hackathonEventId`,
  a real `onDelete: SetNull` relation for `actorId`) so the log survives
  even if the event or the acting user is later removed — an audit trail
  that disappears when the thing it's auditing is deleted defeats the
  purpose.

### Webhook
- `secret` is generated server-side at creation (`crypto.randomBytes`) and
  returned to the organizer exactly once, in the POST response — it is
  never returned again by the GET list endpoint. This is the same
  write-once-read-never pattern as an API key; if it's lost, the fix is
  deleting and re-creating the webhook, not "showing it again."
- `eventTypes` is a comma-separated string, not a join table to a fixed
  enum list — see `ARCHITECTURE.md`'s note on `AuditLog.eventType` for the
  same reasoning: new event types shouldn't require a migration.

### ServerKeypair
- Single-row table (the app always does `findFirst()`, and creates the
  row lazily on first use if none exists — see `lib/keys.ts`). Holds one
  Ed25519 keypair used to sign every certificate and judge record this
  server ever issues. `publicKey` is also served unauthenticated at
  `GET /api/public-key` so verification never requires a database lookup
  or a trusted session on the verifier's end.
- Deliberately not per-event or per-organizer — a single hackathon
  platform deployment should have one identity that all of its
  certificates trace back to, the same way a university has one
  registrar's signature on every diploma it issues, not one per department.

### EmailOtp
- Not linked to `User` by foreign key — deliberately, since a code can be
  requested for an email address before its account row settles into a
  final state (registration creates the user first, then the OTP; a
  resend for an already-pending registration re-uses the same user row).
  Looked up by `email` + `purpose` instead, taking the most recently
  created row (`orderBy: createdAt desc` in
  `app/api/register/verify/route.ts`) as the active one. This means
  requesting a new code implicitly supersedes an older, still-unexpired
  one — only ever one "live" code per email at a time, which is the
  correct behavior for an OTP flow (the newest code is what the user
  actually received last).
- `codeHash` uses SHA-256, not bcrypt — see `ARCHITECTURE.md` for why a
  short-lived, low-entropy code doesn't benefit from bcrypt's slow-hash
  design the way a password does.
- No foreign key also means a stale/expired OTP row surviving a user
  being deleted isn't a dangling-reference problem — it's just an inert
  row that a cleanup job could periodically purge (not implemented; rows
  are small and harmless to leave, but noted as a housekeeping item for a
  long-running production deployment).

## Import / export paths

**CSV export (implemented, T2 + T3):** organizer-only routes under
`app/api/events/[id]/export/` — `teams`, `submissions`, `scores` (the full
raw judge-score audit trail), `results` (normalized rankings), and `audit`
(the full `AuditLog` for the event — votes, comments, and comment
deletions with timestamps and hashed IPs). All reuse the same Prisma
queries already written for the dashboards, `lib/results.ts`, and
`lib/duplicateDetection.ts`, rather than duplicating query logic for export.

**Bulk import (implemented, T4):** `POST /api/events/[id]/import/teams`
accepts pasted CSV text (`lib/csvImport.ts` handles parsing) and creates
one `Team` + its `TeamMember` rows per valid row, matching members to
*existing* accounts by email — it never creates accounts or passwords on
someone's behalf. Each row is processed independently; the response
reports per-row success or a specific failure reason (missing account,
already on a team, duplicate team name) rather than failing the whole
batch on one bad line.

Beyond the CSV routes, the data is also reachable two other ways:

- **Direct DB access:** `psql` against the Postgres container, or
  `npx prisma studio` for a GUI, since everything lives in one Postgres
  instance with no hidden external stores.
- **Seed script (`prisma/seed.ts`):** doubles as a reference for the exact
  shape of data the app expects, and as the fixture-loading mechanism the
  acceptance suite relies on. It now also seeds a rubric, a judge
  invitation, an assignment, and a demo score, so T2 has working fixture
  data too.
