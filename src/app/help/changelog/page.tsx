import { listChangelogEntries } from "@/lib/help/changelog";
import { ChangelogClient } from "./changelog-client";
import { ChangelogMonth } from "@/components/help/changelog/changelog-month";

export const dynamic = "force-static";
export const metadata = { title: "更新日志", description: "Vibe Media 平台版本更新与新功能" };

export default async function ChangelogPage() {
  const entries = await listChangelogEntries();
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-3">更新日志</h1>
      <p className="text-muted-foreground mb-8">查看每月平台新功能、优化与修复记录。</p>
      <ChangelogClient />
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无更新记录。</p>
      ) : (
        <div>
          {entries.map((e, i) => (
            <ChangelogMonth key={e.slug} entry={e} defaultOpen={i < 3} />
          ))}
        </div>
      )}
    </div>
  );
}
