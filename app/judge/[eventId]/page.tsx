import { redirect } from "next/navigation";
import { getSession } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import JudgeScoring from "@/components/JudgeScoring";

export default async function JudgeEventPage({ params }: { params: { eventId: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isJudge = await prisma.eventJudge.findUnique({
    where: { eventId_userId: { eventId: params.eventId, userId: session.user.id } }
  });
  if (!isJudge && session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const event = await prisma.event.findUnique({ where: { id: params.eventId } });
  if (!event) redirect("/dashboard");

  return <JudgeScoring eventId={params.eventId} eventName={event!.name} />;
}
