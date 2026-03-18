import { notFound } from "next/navigation";
import { getSkillDetailPageData } from "@/lib/dal/skills";
import { SkillDetailClient } from "./skill-detail-client";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSkillDetailPageData(id);
  if (!data) notFound();
  return <SkillDetailClient skill={data.skill} versions={data.versions} usageStats={data.usageStats} />;
}
