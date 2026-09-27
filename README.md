Dogfood Platform

A self-hostable hackathon submission and judging platform, built for the

Dogfood | 72-Hour Hackathon. This is a complete T1–T4 implementation:

authentication with email OTP verification, roles, event creation, team

formation via invite codes, submission with draft/edit and deadline

enforcement, a public searchable gallery, judge invitation and assignment,

weighted rubrics, judge progress dashboards, cross-judge z-score

normalization, community voting with hidden results and randomized

ordering, comments, rate limiting, duplicate-vote detection, audit trails,

outbound webhooks, signed and publicly verifiable certificates and judge

records, an embeddable gallery widget, bulk team import, and CSV export

throughout.

Quick start (Docker — recommended)

Requires only Docker installed. No cloud account, no external services.

```bash

docker compose up

```

This will:

Start a Postgres database.

Build and start the Next.js app.

Push the database schema.

Seed demo data.

Serve the app at http://localhost:3000

Demo logins (password: `password123`)

Role	Email

Admin	admin@dogfood.dev

Organizer	organizer@dogfood.dev

Judge A	judge-a@dogfood.dev

Judge B	judge-b@dogfood.dev

Participant	alice@dogfood.dev

Participant	bob@dogfood.dev

These seeded accounts are pre-verified (`emailVerifiedAt` set directly by

the seed script) so you can log in immediately without going through OTP

verification — that flow only applies to accounts created through the

actual Register page.



\### Re-generating `.dogfood.toml` for the acceptance checker



The `\[auth]` cookies and the `judge\_a`/`event` ids in the committed

`.dogfood.toml` were valid for one specific local run and will NOT match

a fresh `docker compose up` — every boot re-seeds the database with new

random IDs and mints new session tokens. After running

`docker compose up`, run:

