import { redirect } from "next/navigation";
import { getSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import OrganizerDashboard from "@/components/OrganizerDashboard";
import ParticipantDashboard from "@/components/ParticipantDashboard";
import JudgeHome from "@/components/JudgeHome";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const events = await prisma.event.findMany({
    orderBy: { startAt: "desc" },
    include: { tracks: true }
  });

  if (session.user.role === "ORGANIZER" || session.user.role === "ADMIN") {
    const myEvents = await prisma.event.findMany({
      where: { organizerId: session.user.id },
      include: { teams: { include: { members: true, submission: true } }, tracks: true }
    });
    return <OrganizerDashboard events={myEvents} />;
  }

  // A user can be a participant on one event and a judge on another, so we
  // show both sections rather than treating "judge" as an exclusive role.
  const judgingEvents = await prisma.eventJudge.findMany({
    where: { userId: session.user.id },
    include: { event: { include: { tracks: true } } }
  });

  // Participant / judge view: find their team (if any) per event.
  const memberships = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    include: { team: { include: { event: { include: { tracks: true } }, submission: true, members: true } } }
  });

  return (
    <div className="space-y-10">
      {judgingEvents.length > 0 && <JudgeHome judgingEvents={judgingEvents} />}
      <ParticipantDashboard events={events} memberships={memberships} />
    </div>
  );
}