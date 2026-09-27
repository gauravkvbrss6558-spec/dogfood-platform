# Architecture

## Stack

- **Next.js (App Router)** — a single codebase serves both the UI (React
  Server Components + client components) and the backend (API routes under
  `app/api/`). This avoids running/deploying two separate servers, which
  matters for the "single command, self-hostable" requirement.
- **PostgreSQL** — relational data (users, events, teams, submissions) with
  real foreign keys and uniqueness constraints, enforced by the database
  itself, not just application code.
- **Prisma** — type-safe database access. The schema in `prisma/schema.prisma`
  is the single source of truth for the data model.
- **NextAuth (Credentials provider, JWT sessions)** — no external identity
  provider. Passwords are hashed with bcrypt and never stored in plaintext.
  Sessions are JWTs containing the user's id and role, so every request can
  be authorized without a database round-trip just to check who's logged in.

## Why this shape

**One deployable unit.** `docker compose up` starts exactly two containers:
the app and the database. There's no separate API server, no reverse proxy,
no message queue — deliberately, to keep self-hosting simple. If later
tiers need background jobs (e.g. async score normalization), those should
run as scheduled Next.js API routes or a lightweight worker in the same
compose file, not a new infrastructure dependency.

**Server-enforced authorization, not UI-hidden buttons.** Every write
endpoint (`app/api/*/route.ts`) re-checks the caller's role and relationship
to the resource (e.g. "is this user actually on this team?") on the server,
using `lib/rbac.ts`. The UI also hides irrelevant actions for a better
experience, but that's a convenience layer — it is never the only check.
This is what "backend-enforced role isolation" means in the spec, and it's
the property the acceptance suite and T2 judging integrity criteria will
test directly (e.g. by calling the API as the wrong role).

**Deadline enforcement lives on the server, at write time.** The submission
API route compares `new Date()` against `event.submissionDeadline` before
accepting any write. The client also disables the form after the deadline
for UX, but a request forged after the deadline is still rejected server-side.

**One team per user per event.** Enforced at the database level with a
unique constraint (`TeamMember` uniqueness) combined with an application
check when creating/joining a team, so a user can't accidentally end up on
two teams for the same event even under concurrent requests.

## Request flow example: submitting a project

1. Participant fills out the submission form in `ParticipantDashboard.tsx`
   and clicks "Submit final".
2. Client sends `POST /api/submissions` with the team id and `action: "submit"`.
3. The route handler (`app/api/submissions/route.ts`):
   - Confirms a session exists.
   - Confirms the caller is a member of that specific team (not just any
     logged-in user).
   - Loads the team's event and checks `now > submissionDeadline` — rejects
     with 403 if the deadline has passed.
   - Upserts the `Submission` row, setting `status = SUBMITTED` and
     `submittedAt = now`.
4. The dashboard page (a server component) re-fetches on next render, so
   the UI reflects the new status without client-side state drifting from
   the database.

## Judging (T2) — how it fits the existing shape

T2 didn't require any new infrastructure — it's five more Prisma models
(`Rubric`, `RubricCriterion`, `EventJudge`, `JudgeAssignment`, `Score`) and
a set of API routes under `app/api/events/[id]/` and
`app/api/assignments/[id]/`, following the exact same pattern as T1:
server-side role/ownership checks first, then the operation.

Two design choices worth calling out:

**The assignment algorithm and the normalization method are pure
functions** (`lib/assignment.ts`, `lib/normalization.ts`) with no database
access. The API routes that call them are thin: load data, call the pure
function, persist the result. This means the two pieces of logic that
matter most for "judging integrity" — who gets assigned to what, and how
scores get compared across judges — can be unit tested directly and
audited by reading a single file each, independent of the database or
HTTP layer. See `tests/assignment.test.ts` and `tests/normalization.test.ts`.

**A judge's global `role` is cosmetic; `EventJudge` rows are what actually
gate access.** A user's `role` field flips to `JUDGE` the first time
they're invited to judge something (so the nav bar shows the right badge),
but every judging route checks `EventJudge` membership for the *specific*
event, not the role column. This is deliberate: a real hackathon organizer
runs multiple events, and the same person might judge one event while
participating in another. Gating on a single global role would make that
impossible without a workaround; gating on the join table doesn't.

## Public (T3) — voting, comments, and abuse resistance

Like T2, this added no new infrastructure — five more things layered onto
the existing pattern: a `Vote` model, a `Comment` model, an append-only
`AuditLog` model, and voting-window fields on `Event`.

**Community rating, not a plain upvote.** Votes are 1–5 (`Vote.value`),
not a binary like/upvote. A single average score is easier to rank by and
more informative than a raw upvote count (which conflates "many people
saw it" with "many people liked it" once traffic isn't uniform — and
traffic *isn't* uniform here, since without randomization early
submissions get more looks). The trade-off: a 1–5 scale invites some
strategic anchoring (voters clustering around 3–4), which a pure
thumbs-up/down can't do. Documented as a deliberate choice, not an
oversight — see the code comment on the `Vote` model.

**Duplicate detection is two-layered, and only one layer blocks.** The
hard layer is a database unique constraint (`@@unique([submissionId, voterId])`)
— a logged-in account simply cannot vote twice on the same project; this
is enforced at write time and needs no judgment call. The soft layer is
`lib/duplicateDetection.ts`, which flags IP addresses (hashed, never
stored raw) that voted from an unusually high number of distinct
accounts. This layer *never blocks anything* — it surfaces a report for
the organizer. The reasoning: a shared IP with many voters is genuinely
ambiguous (a hackathon venue's WiFi, a university network, a NAT'd office)
and auto-blocking on it would punish legitimate participants at exactly
the events this platform is built for. Treating it as an audit signal
rather than an enforcement rule keeps a human in the loop for a decision
that has real false-positive risk.

**Rate limiting is DB-backed, not Redis-backed.** `lib/rateLimit.ts` is a
pure sliding-window function; `lib/audit.ts`'s `enforceRateLimit` feeds it
recent timestamps pulled from `AuditLog`. This keeps the "single command,
no external services" requirement intact — adding Redis just for rate
limiting would mean a third container and a new failure mode, for a
feature that a handful of indexed Postgres reads handles fine at
hackathon scale (hundreds to low thousands of voters, not millions).

**Hidden results is a read-path check, not a separate data model.**
`lib/voting.ts`'s `shouldHideResults` is called from
`GET /api/submissions/[id]/vote` before deciding whether to include
`averageScore` in the response at all — an organizer viewing their own
event's submission always sees it; everyone else sees only their own
vote while voting is open. There's no separate "results" table to keep in
sync; the tally is always computed live from `Vote` rows, just
conditionally withheld.

**Randomized ordering is seeded, not per-request-random.** `lib/shuffle.ts`
implements a small deterministic PRNG (mulberry32) seeded by the viewer's
user id (or a hashed IP for anonymous visitors). The gallery page
(`app/gallery/page.tsx`) only applies it when at least one listed project
has voting currently open — a plain post-event archive browse doesn't
need randomization, since position bias only matters while people are
actively choosing what to vote for. Seeding by viewer, not re-rolling on
every request, means a person's order is stable as they scroll or
paginate, which matters for usability — a shuffle that reorders itself on
every reload would be disorienting, not fair.

## Stretch (T4) — webhooks, verifiable records, embedding, bulk import

**Two different signing schemes, deliberately.** Webhooks use HMAC-SHA256
(`lib/webhookSigning.ts`) with a per-webhook shared secret; certificates
and judge records use Ed25519 asymmetric signing (`lib/certRecord.ts`)
with one server-wide keypair. These solve different problems and
shouldn't share a mechanism. A webhook receiver already has an ongoing
relationship with this server (they registered the URL, they were handed
the secret at that moment) — HMAC is the right, simple tool there, the
same choice GitHub and Stripe make. A certificate needs to remain
verifiable by *anyone*, including someone who has never talked to this
server and never will again (an employer checking a certificate years
later) — that requires a public key they can fetch once and check against
forever, which only asymmetric signing provides. Using HMAC for
certificates would mean either handing out the signing secret publicly
(pointless — anyone could then forge certificates) or requiring every
verifier to call this server's API forever (fragile, and stops working
the moment the server is retired). Ed25519 was chosen specifically for
being fast and simple to implement correctly with Node's built-in
`crypto` — no external dependency, keeping self-hosting to a single
`docker compose up`.

**The private key lives in the same database as everything else,** not a
separate secrets manager (`lib/keys.ts`). This mirrors the trust model
already established for password hashes: whoever can read this database
can already impersonate any user, so a stronger secret-isolation story for
just the signing key wouldn't meaningfully raise the bar for this
platform's threat model, while adding real setup friction (a secrets
manager, or a required environment variable with no safe default) to the
"one command, no external services" goal. This is a real trade-off, not
a blind spot — a deployment that wants HSM-backed or env-var-only key
storage would need to change `lib/keys.ts`, and that's flagged here as
the specific place to do it.

**Webhook delivery never blocks or fails the triggering request.**
`dispatchWebhook` (`lib/webhookDispatch.ts`) is awaited from the route
handlers that call it (submission submitted, vote cast, comment posted,
judges assigned, score submitted) but internally uses `Promise.allSettled`
with a 5-second per-delivery timeout, and every outcome — success or
failure — is written to `AuditLog` rather than thrown. A slow or dead
third-party endpoint registered by an organizer must never be able to
make voting, commenting, or judging fail for participants.

**The embeddable widget and certificates share one layout mechanism.**
Both need to render without this platform's own nav bar and session
chrome — a certificate because it's meant to be printed/saved standalone,
the gallery widget because it's meant to live inside someone else's page.
Rather than duplicating a bare layout in two places, `ChromeWrapper.tsx`
checks the pathname once and both `/certificate/*` and `/embed/*` opt out
of the nav bar through the same mechanism.

**Bulk import processes rows independently, matching the seed script's
philosophy.** `app/api/events/[id]/import/teams` wraps each CSV row in
its own try/catch and reports per-row success/failure rather than
all-or-nothing — a real registration export from an external form will
have some bad rows (an unregistered email, a duplicate team name), and an
organizer importing hundreds of teams needs to see exactly which ones
failed and why, not have the whole batch rejected over one bad line.

## Email OTP verification (added beyond the original tier spec)

Not part of T1–T4, but added since real registration flows benefit from
proving the registrant controls the email they signed up with.

**Email sending is a pluggable provider, not a hard dependency.** This
matters specifically because of the "must run locally with a single
command... without a hosted database, authentication provider, external
API, or network connection" requirement. If OTP delivery *required* a
real email account, `docker compose up` would stop being self-contained —
someone couldn't demo or judge this platform without first signing up for
Brevo or an SMTP provider. `lib/email.ts` defaults to a console/dev mode:
the code is logged to the server's stdout and also returned directly in
the API response, clearly labeled as insecure-but-convenient dev/demo
behavior. Setting `EMAIL_PROVIDER=smtp` or `EMAIL_PROVIDER=brevo` (plus
credentials) switches to real delivery for production use. The interface
(`sendOtpEmail`) is the same either way — routes never know or care which
path is active.

**OTP codes are hashed with SHA-256, not bcrypt.** This looks inconsistent
with password storage (`bcrypt`) until you consider what each hash is
defending against. Bcrypt's deliberate slowness defends a *long-lived,
often-reused* secret against offline brute-forcing if the database leaks.
A 6-digit OTP has only 1,000,000 possible values and expires in 10
minutes — slow hashing barely helps against a 10-minute brute-force
window, while it would make every verification request slower for no
real benefit. The actual defenses here are the expiry and a hard rate
limit on verification attempts (`VERIFY_RATE_LIMIT` in
`app/api/register/verify/route.ts`), not hash cost.

**Rate limiting for OTP requests is keyed by IP, not user id.** Every
other rate limit in this codebase (voting, commenting) is keyed by
`userId`, because a session already exists by the time those actions
happen. Requesting a registration OTP happens *before* any session exists
— there's no authenticated user id to attach a limit to yet, so
`lib/audit.ts` gained a second variant, `enforceRateLimitByIp`, reusing
the exact same pure `checkRateLimit` function from `lib/rateLimit.ts`.
Both paths share one piece of tested logic; only the lookup key differs.

**Login is blocked at the `authorize()` callback, not with a UI-only
check.** `lib/auth.ts` throws before returning a user object if
`emailVerifiedAt` is null — NextAuth cannot issue a session for an
unverified account under any circumstance, including a direct API call
that bypasses the login form entirely. One real limitation: NextAuth v4's
Credentials provider does not reliably forward a thrown error's message
to the client when `signIn(..., { redirect: false })` is used — it
normalizes to a generic `CredentialsSignin` code. Rather than depend on
that message, the login page makes a small separate call
(`/api/auth/needs-verification`) after a failed login to determine
*why* it failed and route the person to inline OTP verification instead
of a dead-end "wrong password" message.
