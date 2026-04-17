import { notFound } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { missingTopicClues } from "@/data/benchmarking-data";
import type { MissingTopicDetail } from "@/lib/types";
import { MissingDetailClient } from "./missing-detail-client";

export const dynamic = "force-dynamic";

export default async function MissingTopicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getCurrentUserOrg();

  const clue = missingTopicClues.find((c) => c.id === id);
  if (!clue) notFound();

  const detail: MissingTopicDetail = {
    ...clue,
    sourceTags: clue.isMultiSource
      ? [clue.sourceType, "multi_source"]
      : [clue.sourceType],
    sourceUrl: "#",
    publishedAt: "2026-04-17T09:45:00Z",
    contentSummary:
      "科技部今日正式发布《人工智能安全发展白皮书（2026）》，全文共计8章42节，涵盖大模型安全评估框架、数据安全治理规范、AI伦理准则等核心议题。白皮书首次提出\"AI安全分级管理制度\"，将AI应用按风险等级分为四类...",
    contentLength: 3200,
    reportedBy: clue.competitors.map((name) => ({
      name,
      level: [
        "人民日报",
        "新华社",
        "央视新闻",
        "光明日报",
        "经济日报",
      ].includes(name)
        ? ("central" as const)
        : ("provincial" as const),
    })),
    aiAnalysis: null,
    linkedArticleId: null,
    linkedArticleTitle: null,
    pushedAt: null,
    pushedToSystem: null,
  };

  return <MissingDetailClient detail={detail} />;
}
