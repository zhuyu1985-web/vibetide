"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/shared/date-picker";
import { GlassCard } from "@/components/shared/glass-card";
import type { TopicSummary } from "@/lib/dal/research/research-topics";
import type { CqDistrict } from "@/lib/dal/research/cq-districts";
import { createResearchTask } from "@/app/actions/research/research-tasks";

const TIERS = [
  { value: "central", label: "中央级" },
  { value: "provincial_municipal", label: "省/市级" },
  { value: "industry", label: "行业级" },
  { value: "district_media", label: "区县融媒体" },
] as const;

type MediaTier = (typeof TIERS)[number]["value"];

export function NewTaskClient({
  topics,
  districts,
}: {
  topics: TopicSummary[];
  districts: CqDistrict[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(`${new Date().getFullYear() - 1}年研究任务`);
  const [topicIds, setTopicIds] = useState<string[]>(topics.map((t) => t.id));
  const [districtIds, setDistrictIds] = useState<string[]>(districts.map((d) => d.id));
  const [tiers, setTiers] = useState<string[]>(TIERS.map((t) => t.value));
  const [timeStart, setTimeStart] = useState("2025-01-01");
  const [timeEnd, setTimeEnd] = useState("2025-12-31");
  const [customUrls, setCustomUrls] = useState("");

  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("请输入任务名称");
      return;
    }
    if (topicIds.length === 0) {
      setError("请至少选择一个主题");
      return;
    }
    if (tiers.length === 0) {
      setError("请至少选择一级媒体");
      return;
    }

    const urls = customUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await createResearchTask({
        name: name.trim(),
        timeRangeStart: new Date(timeStart).toISOString(),
        timeRangeEnd: new Date(timeEnd + "T23:59:59.999Z").toISOString(),
        topicIds,
        districtIds,
        mediaTiers: tiers as MediaTier[],
        customUrls: urls,
        semanticEnabled: true,
        semanticThreshold: 0.72,
        dedupLevel: "district",
      });
      if (!res.ok) setError(res.error);
      else router.push(`/research/admin/tasks/${res.id}`);
    });
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">新建研究任务</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          选择主题、区县、媒体层级和时间范围，系统将自动采集全网与白名单媒体数据
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">① 任务名称</h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">② 时间范围</h2>
        <div className="flex gap-3 items-center">
          <DatePicker
            value={timeStart ? new Date(timeStart) : null}
            onChange={(d) => setTimeStart(d ? format(d, "yyyy-MM-dd") : "")}
            placeholder="开始日期"
          />
          <span className="text-gray-500 dark:text-gray-400 text-sm">至</span>
          <DatePicker
            value={timeEnd ? new Date(timeEnd) : null}
            onChange={(d) => setTimeEnd(d ? format(d, "yyyy-MM-dd") : "")}
            placeholder="结束日期"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            ③ 主题（{topicIds.length}/{topics.length}）
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setTopicIds(
                topicIds.length === topics.length ? [] : topics.map((t) => t.id),
              )
            }
          >
            {topicIds.length === topics.length ? "全部取消" : "全选"}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {topics.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded-lg glass-card px-3 py-2 cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition"
            >
              <Checkbox
                checked={topicIds.includes(t.id)}
                onCheckedChange={() => setTopicIds(toggle(topicIds, t.id))}
              />
              <span className="text-sm truncate">{t.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            ④ 区县（{districtIds.length}/{districts.length}）
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDistrictIds(
                districtIds.length === districts.length
                  ? []
                  : districts.map((d) => d.id),
              )
            }
          >
            {districtIds.length === districts.length ? "全部取消" : "全选"}
          </Button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {districts.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-2 rounded-lg glass-card px-2 py-1.5 cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition text-xs"
            >
              <Checkbox
                checked={districtIds.includes(d.id)}
                onCheckedChange={() =>
                  setDistrictIds(toggle(districtIds, d.id))
                }
              />
              <span className="truncate">{d.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">⑤ 媒体层级</h2>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <label
              key={t.value}
              className="flex items-center gap-2 rounded-lg glass-card px-3 py-2 cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition"
            >
              <Checkbox
                checked={tiers.includes(t.value)}
                onCheckedChange={() => setTiers(toggle(tiers, t.value))}
              />
              <span className="text-sm">{t.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          ⑥ 手动粘贴 URL{" "}
          <span className="text-gray-500 dark:text-gray-400 text-xs font-normal">
            （可选，每行一个）
          </span>
        </h2>
        <Textarea
          rows={4}
          value={customUrls}
          onChange={(e) => setCustomUrls(e.target.value)}
          placeholder={"https://...\nhttps://..."}
        />
      </section>

      <div className="flex gap-3 pt-4">
        <Button variant="ghost" onClick={() => router.push("/research/admin/tasks")}>
          取消
        </Button>
        <Button variant="ghost" onClick={submit} disabled={pending}>
          {pending ? "提交中..." : "提交任务"}
        </Button>
      </div>
    </div>
  );
}
