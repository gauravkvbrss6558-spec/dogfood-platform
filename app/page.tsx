import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
});

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300";

/*
  SAMPLE DATA: yahan baad me Prisma se hackathons fetch karke daalna
  (server component hai, seedha `await prisma.event.findMany(...)` chalega).
  status: "open" | "judging" | "upcoming" | "completed"
*/
type Status = "open" | "judging" | "upcoming" | "completed";
const EVENTS: {
  slug: string;
  name: string;
  status: Status;
  note: string;
  teams: number;
}[] = [
  {
    slug: "spring-build-sprint",
    name: "Spring Build Sprint",
    status: "open",
    note: "Submissions close 15 Oct",
    teams: 48,
  },
  {
    slug: "campus-ai-hack",
    name: "Campus AI Hack",
    status: "judging",
    note: "Judges are scoring",
    teams: 32,
  },
  {
    slug: "open-source-weekend",
    name: "Open Source Weekend",
    status: "upcoming",
    note: "Opens 2 Nov",
    teams: 0,
  },
  {
    slug: "winter-hack-2025",
    name: "Winter Hack 2025",
    status: "completed",
    note: "61 projects in the gallery",
    teams: 61,
  },
];

const STATUS: Record<
  Status,
  { label: string; pill: string; cta: string; href: string }
> = {
  open: {
    label: "Open",
    pill: "border-teal-400/40 bg-teal-400/10 text-teal-300",
    cta: "Join this hackathon",
    href: "/register",
  },
  judging: {
    label: "Judging",
    pill: "border-violet-400/40 bg-violet-400/10 text-violet-300",
    cta: "View projects",
    href: "/gallery",
  },
  upcoming: {
    label: "Upcoming",
    pill: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300",
    cta: "Register early",
    href: "/register",
  },
  completed: {
    label: "Completed",
    pill: "border-white/20 bg-white/10 text-neutral-300",
    cta: "View projects",
    href: "/gallery",
  },
};

const features = [
  {
    tag: "01 · registration",
    text: "Email verification, role-based access for participants, judges, and organizers.",
    accent: "violet",
    icon: (
      <path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm6.5 3 2 2 4-4" />
    ),
  },
  {
    tag: "02 · judging",
    text: "Weighted rubrics, balanced assignment, and cross-judge normalization.",
    accent: "teal",
    icon: <path d="M4 20V10m6 10V4m6 16v-7m6 7H2" />,
  },
  {
    tag: "03 · results",
    text: "Signed certificates, public verification, and a searchable gallery.",
    accent: "cyan",
    icon: (
      <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm-3.5-.8L7 22l5-3 5 3-1.5-7.8" />
    ),
  },
] as const;

const accents = {
  violet: {
    icon: "text-violet-300 bg-violet-400/10 border-violet-400/30",
    hover: "hover:border-violet-400/40",
    bar: "from-violet-400/70",
  },
  teal: {
    icon: "text-teal-300 bg-teal-400/10 border-teal-400/30",
    hover: "hover:border-teal-400/40",
    bar: "from-teal-400/70",
  },
  cyan: {
    icon: "text-cyan-300 bg-cyan-400/10 border-cyan-400/30",
    hover: "hover:border-cyan-400/40",
    bar: "from-cyan-400/70",
  },
} as const;

function Pill({ status }: { status: Status }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium sm:text-xs ${STATUS[status].pill}`}
    >
      {STATUS[status].label}
    </span>
  );
}

export default function HomePage() {
  const [front, mid, back] = EVENTS;

  return (
    <div
      className="relative overflow-hidden bg-[#07061a]"
      style={{
        background:
          "radial-gradient(1100px 620px at 12% -8%, rgba(124,58,237,0.38), transparent 60%), radial-gradient(900px 540px at 92% 2%, rgba(20,184,166,0.28), transparent 60%), radial-gradient(900px 500px at 50% 105%, rgba(219,39,119,0.16), transparent 60%), linear-gradient(180deg, #0a0820 0%, #07061a 55%, #050512 100%)",
      }}
    >
      <style>{`@keyframes hero-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>

      {/* ================= HERO ================= */}
      <div className="relative">
        {/* 3D grid floor: perspective ki wajah se horizon tak jaata hua */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-64 overflow-hidden [perspective:520px] sm:h-80"
        >
          <div
            className="absolute inset-x-[-60%] inset-y-0 [transform:rotateX(62deg)]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(167,139,250,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(45,212,191,0.22) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "linear-gradient(to top, black 10%, transparent 75%)",
              WebkitMaskImage:
                "linear-gradient(to top, black 10%, transparent 75%)",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <section className="grid items-center gap-12 py-10 sm:py-14 lg:grid-cols-2 lg:gap-8 lg:py-24">
            <div>
              <h1
                className={`${display.className} text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl`}
              >
                <span className="bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
                  Run your
                </span>
                <br />
                <span className="bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
                  hackathons
                </span>
                <br />
                <span className="bg-gradient-to-r from-teal-300 to-violet-400 bg-clip-text text-transparent">
                  end to end.
                </span>
              </h1>

              <p className="mt-4 max-w-md text-sm leading-relaxed text-neutral-400 sm:mt-5 sm:text-base">
                Registration, teams, submissions, and a public gallery for every
                event you host — self-hosted, no cloud accounts required.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
                <Link
                  href="/register"
                  className={`group relative overflow-hidden rounded-xl bg-gradient-to-b from-violet-500 to-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-violet-500/30 transition-all hover:-translate-y-0.5 hover:shadow-violet-500/50 ${focus}`}
                >
                  <span className="relative z-10">Get started</span>
                  <span className="absolute inset-0 -translate-x-full bg-white/20 transition-transform duration-300 group-hover:translate-x-0" />
                </Link>
                <Link
                  href="/gallery"
                  className={`rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-neutral-100 backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/[0.15] ${focus}`}
                >
                  Browse gallery
                </Link>
              </div>
            </div>

            {/* 3D stack: ek se zyada hackathons ek saath */}
            <div className="relative mx-auto h-[380px] w-full max-w-md [perspective:1400px] sm:h-[420px] lg:max-w-none">
              <div className="absolute inset-0 motion-safe:animate-[hero-float_7s_ease-in-out_infinite]">
                <div className="relative h-full w-full transition-transform duration-700 ease-out [transform-style:preserve-3d] [transform:rotateX(5deg)_rotateY(-9deg)] lg:[transform:rotateX(9deg)_rotateY(-18deg)] lg:hover:[transform:rotateX(4deg)_rotateY(-8deg)]">
                  {/* back card */}
                  <div className="absolute right-0 top-0 w-[76%] rounded-2xl border border-white/10 bg-neutral-900/70 p-4 opacity-70 shadow-xl shadow-black/40 backdrop-blur-md [transform:translateZ(-90px)]">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={`${display.className} truncate text-base font-extrabold text-neutral-200`}
                      >
                        {back.name}
                      </p>
                      <Pill status={back.status} />
                    </div>
                    <div className="mt-3 h-2 w-2/3 rounded-full bg-white/10" />
                    <div className="mt-2 h-2 w-1/2 rounded-full bg-white/10" />
                  </div>

                  {/* middle card */}
                  <div className="absolute right-5 top-14 w-[82%] rounded-2xl border border-white/15 bg-neutral-900/80 p-4 opacity-90 shadow-xl shadow-black/40 backdrop-blur-md [transform:translateZ(-40px)]">
                    <div className="flex items-center justify-between gap-3">
                      <p
                        className={`${display.className} truncate text-base font-extrabold text-neutral-100`}
                      >
                        {mid.name}
                      </p>
                      <Pill status={mid.status} />
                    </div>
                    <div className="mt-3 h-2 w-3/4 rounded-full bg-white/15" />
                    <div className="mt-2 h-2 w-1/2 rounded-full bg-white/15" />
                  </div>

                  {/* front card: gradient border */}
                  <div className="absolute bottom-0 left-0 w-[92%] rounded-3xl bg-gradient-to-br from-violet-400/60 via-white/10 to-teal-400/60 p-px shadow-2xl shadow-violet-500/20 [transform:translateZ(40px)]">
                    <div className="rounded-3xl bg-neutral-950/90 p-4 backdrop-blur-2xl sm:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={`${display.className} truncate text-lg font-extrabold text-white sm:text-xl`}
                        >
                          {front.name}
                        </p>
                        <Pill status={front.status} />
                      </div>
                      <p className="mt-1 text-xs text-neutral-400 sm:text-sm">
                        {front.note}
                      </p>

                      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="rounded-xl border border-teal-400/30 bg-teal-400/10 p-2.5 sm:p-3">
                          <div
                            className={`${display.className} text-xl font-extrabold tabular-nums text-teal-300 sm:text-2xl`}
                          >
                            12
                          </div>
                          <div className="text-[11px] text-neutral-400 sm:text-xs">
                            judged
                          </div>
                        </div>
                        <div className="rounded-xl border border-violet-400/30 bg-violet-400/10 p-2.5 sm:p-3">
                          <div
                            className={`${display.className} text-xl font-extrabold tabular-nums text-violet-300 sm:text-2xl`}
                          >
                            48
                          </div>
                          <div className="text-[11px] text-neutral-400 sm:text-xs">
                            teams
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/[0.08] p-2.5 sm:p-3">
                          <div
                            className={`${display.className} text-xl font-extrabold tabular-nums text-neutral-100 sm:text-2xl`}
                          >
                            96%
                          </div>
                          <div className="text-[11px] text-neutral-400 sm:text-xs">
                            on time
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ================= HACKATHONS ================= */}
        <section className="border-t border-white/10 py-12 sm:py-16">
          <h2
            className={`${display.className} text-2xl font-extrabold tracking-tight text-white sm:text-4xl`}
          >
            Every hackathon, one place.
          </h2>
          <p className="mt-2 max-w-xl text-sm text-neutral-400 sm:text-base">
            Join one that is open, follow one in progress, or browse the
            projects from past events.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EVENTS.map((e) => {
              const s = STATUS[e.status];
              return (
                <Link
                  key={e.slug}
                  href={s.href}
                  className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-lg shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:border-white/25 hover:bg-white/[0.09] hover:[transform:perspective(900px)_rotateX(3deg)_translateY(-4px)] ${focus}`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                  <div className="relative">
                    <Pill status={e.status} />
                    <h3
                      className={`${display.className} mt-4 text-xl font-extrabold text-white`}
                    >
                      {e.name}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-400">{e.note}</p>
                  </div>
                  <div className="relative mt-6 flex items-center justify-between text-sm">
                    <span className="text-neutral-400">
                      {e.teams > 0
                        ? `${e.teams} ${e.status === "completed" ? "projects" : "teams"}`
                        : "Not started"}
                    </span>
                    <span className="font-medium text-violet-300 group-hover:text-violet-200">
                      {s.cta}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section className="grid gap-4 border-t border-white/10 py-10 sm:gap-6 sm:py-14 md:grid-cols-3">
          {features.map((item) => {
            const a = accents[item.accent];
            return (
              <div
                key={item.tag}
                className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg shadow-black/30 backdrop-blur-xl transition-all hover:-translate-y-1 hover:bg-white/[0.09] sm:p-6 ${a.hover}`}
              >
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent" />
                <div
                  className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${a.bar} to-transparent`}
                />

                <div className="relative flex items-center justify-between">
                  <p className="font-mono text-xs text-teal-300">{item.tag}</p>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border ${a.icon}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </svg>
                  </span>
                </div>
                <p className="relative mt-4 text-sm leading-relaxed text-neutral-300">
                  {item.text}
                </p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
