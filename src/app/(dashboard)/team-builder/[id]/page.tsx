import { getTeamWithMembers } from "@/lib/dal/teams";
import { getEmployees } from "@/lib/dal/employees";
import { notFound } from "next/navigation";
import { TeamDetailClient } from "./team-detail-client";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [team, allEmployees] = await Promise.all([
    getTeamWithMembers(id).catch(() => null),
    getEmployees().catch(() => []),
  ]);

  if (!team) {
    notFound();
  }

  return <TeamDetailClient team={team} allEmployees={allEmployees} />;
}
