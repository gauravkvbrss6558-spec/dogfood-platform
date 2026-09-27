# Judging

**Status: implemented (T2).** Judge invitation, balanced round-robin
assignment, weighted rubrics, per-judge scoring, z-score normalization,
a judge progress dashboard, and CSV export are all live. The design below
was written before implementation and matches what was actually built —
where reality forced a small deviation, it's called out inline. Pairwise
comparison (Bradley-Terry) is a separate bonus challenge, not implemented
as part of core T2.

## Data model

The actual schema (in `prisma/schema.prisma`) matches this closely, with
one addition not anticipated below: `EventJudge`, a join table recording
which users are invited to judge which events (needed because a user's
global `role` isn't enough to say *which* event they judge — the same
person could judge one event and participate in another).

```prisma
model Rubric {
  id        String @id @default(cuid())
  eventId   String
  criteria  RubricCriterion[]
}

model RubricCriterion {
  id       String @id @default(cuid())
  rubricId String
  name     String
  weight   Float   // e.g. 0.3 for 30%
  maxScore Int     // e.g. 10
}

model JudgeAssignment {
  id           String @id @default(cuid())
  eventId      String
  judgeId      String
  submissionId String
  @@unique([judgeId, submissionId])
}

model Score {
  id            String @id @default(cuid())
  assignmentId  String
  criterionId   String
  value         Float
  @@unique([assignmentId, criterionId])
}
```

## Judge assignment strategy

Implemented as **balanced round-robin assignment** (`lib/assignment.ts`) —
each submission gets assigned to a fixed number of judges (configurable
per event via the assign endpoint, default 3). For each submission in
turn, the algorithm picks the eligible judges with the fewest assignments
so far, so load stays as even as possible without needing a global
optimizer. This is simpler to defend than a "smart" matching algorithm and
avoids introducing bias from an opaque matching heuristic. A judge is
never assigned to a submission from their own team — that exclusion is
computed from team membership before the round-robin fill runs, so it's a
hard constraint, not a preference. Unit tests in `tests/assignment.test.ts`
verify both the conflict exclusion and the load balancing directly.

One real-world wrinkle the design didn't originally call out: if every
eligible judge for a submission has a conflict of interest (e.g. a very
small event where all judges are also participants), that submission
simply gets fewer than the requested number of judges rather than the
assignment failing outright. The `/assign` endpoint surfaces this as a
warning in its response so the organizer can invite more judges if needed.

## Scoring

Each event defines a rubric: a set of weighted criteria (e.g. "Technical
depth" 40%, "Execution & polish" 60% in the seeded demo data) whose
weights are validated to sum to 1.0 when the organizer saves them. A judge
scores each assigned submission against every criterion on a 0–`maxScore`
scale (a slider in the UI, default max 10). A submission's raw score from
one judge is the weighted sum of criterion scores, normalized to a 0–10
scale before normalization so criteria with different `maxScore` values
contribute proportionally to their weight rather than their raw range.

## Cross-judge normalization

Raw scores aren't directly comparable across judges — some judges score
harshly, others generously, which distorts rankings if left unadjusted.
Implemented as **z-score normalization per judge** (`lib/normalization.ts`):

1. For each judge, compute the mean and standard deviation of the raw
   scores they gave across all their assigned submissions.
2. Convert each of that judge's scores to a z-score:
   `z = (raw_score - judge_mean) / judge_stddev`.
3. Average the z-scores a submission received across all judges who
   scored it, to get its normalized score.
4. Rank submissions by normalized score, not raw score.

This is a well-understood, easily-explained method (compared to, say,
Bradley-Terry pairwise estimation, which is a separate **Pairwise Mode
bonus challenge**, not the default T2 mechanism). Z-score normalization
was chosen as the T2 default because it requires no extra UI (judges still
just enter numeric scores) and is straightforward to audit: given the raw
score CSV export, anyone can recompute the normalized ranking by hand.

Edge case handled: a judge who scores every submission identically has
zero standard deviation, which would make z-scores undefined. `lib/normalization.ts`
treats that judge's contribution as neutral (z = 0) for every score they
gave, rather than dividing by zero or crashing — covered directly by a
unit test (`tests/normalization.test.ts`). One gap versus the original
plan: the judge progress dashboard does not yet flag a zero-variance judge
for organizer review — it currently only shows completion counts, not
score variance. That would be a small, worthwhile follow-up.

## Role isolation for judging

- Judges only ever see submissions they've been assigned
  (`GET /api/events/[id]/assignments` scopes strictly to `judgeId: session.user.id`)
  — never the full gallery of hidden/unsubmitted drafts, and never another
  judge's worklist.
- Judges never see other judges' scores for the same submission at all —
  there is no route that returns another judge's raw scores to a judge.
  Only organizers can see the full picture (progress dashboard, raw score
  export, normalized results).
- Writing a score is checked at the individual assignment level: `POST
  /api/assignments/[id]/scores` verifies `assignment.judgeId === session.user.id`
  before accepting any write, so a judge can't guess or enumerate another
  judge's assignment id and write to it.
- All of this is enforced the same way T1 enforces role checks: in the API
  route handler, not just hidden in the UI (see `ARCHITECTURE.md`).
