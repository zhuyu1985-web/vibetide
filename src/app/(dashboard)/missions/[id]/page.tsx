import { getMissionById } from "@/lib/dal/missions";
import { MissionConsoleClient } from "./mission-console-client";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let mission;
  try {
    mission = await getMissionById(id);
  } catch {
    // DB connection failure (e.g. Supabase circuit breaker) — show retry UI
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="text-sm text-muted-foreground">数据库连接异常，请稍后重试</p>
        <div className="flex gap-2">
          <Link href={`/missions/${id}`} className="text-sm text-cyan-400 hover:underline">刷新页面</Link>
          <span className="text-muted-foreground/30">|</span>
          <Link href="/missions" className="text-sm text-muted-foreground hover:underline">返回任务列表</Link>
        </div>
      </div>
    );
  }

  if (!mission) return notFound();

  return <MissionConsoleClient mission={mission} />;
}
