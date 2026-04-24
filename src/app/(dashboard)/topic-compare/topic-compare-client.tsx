"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ExternalLink, Settings, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { TopicCompareListRow } from "@/lib/dal/topic-compare";

const PLATFORM_LABELS: Record<string, string> = {
  all: "全部",
  app: "APP",
  website: "网站",
  wechat: "微信",
  weibo: "微博",
  douyin: "抖音",
  kuaishou: "快手",
  bilibili: "B 站",
  xiaohongshu: "小红书",
  tv: "电视",
  radio: "广播",
  other: "其他",
};

function platformLabel(p: string): string {
  return PLATFORM_LABELS[p] ?? p;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface Props {
  items: TopicCompareListRow[];
  platformOptions: Array<{
    platform: string;
    accounts: Array<{ id: string; name: string; handle: string; postCount: number }>;
  }>;
}

export function TopicCompareClient({ items, platformOptions }: Props) {
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  const availableAccounts = useMemo(() => {
    if (platformFilter === "all") return [];
    const opt = platformOptions.find((p) => p.platform === platformFilter);
    return opt?.accounts ?? [];
  }, [platformFilter, platformOptions]);

  const filtered = useMemo(() => {
    if (platformFilter === "all") return items;
    return items.filter((item) => {
      if (accountFilter !== "all") {
        return item.distributions.some((d) => d.accountId === accountFilter);
      }
      return item.distributions.some((d) => d.accountPlatform === platformFilter);
    });
  }, [items, platformFilter, accountFilter]);

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="同题对比"
        description="以我方账号发布作品为锚点，对比央级/省级/地市/行业/自媒体的同题报道，找到叙事差异与改进方向"
        actions={
          <div className="flex gap-2">
            <Link href="/topic-compare/accounts">
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4 mr-1.5" />
                我方账号
              </Button>
            </Link>
            <Link href="/benchmark-accounts">
              <Button variant="ghost" size="sm">
                <Users className="w-4 h-4 mr-1.5" />
                对标账号库
              </Button>
            </Link>
          </div>
        }
      />

      {/* 渠道切换 */}
      <div className="mb-3">
        <Tabs
          value={platformFilter}
          onValueChange={(v) => {
            setPlatformFilter(v);
            setAccountFilter("all");
          }}
        >
          <TabsList variant="line">
            <TabsTrigger value="all">全部</TabsTrigger>
            {platformOptions.map((p) => (
              <TabsTrigger key={p.platform} value={p.platform}>
                {platformLabel(p.platform)}
                <span className="ml-1 text-xs opacity-70">({p.accounts.length})</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* 账号二级筛选 */}
      {availableAccounts.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm text-gray-500">账号：</span>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部账号</SelectItem>
              {availableAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} ({a.postCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filtered.length === 0 ? (
        <GlassCard padding="lg">
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">{items.length === 0 ? "暂无作品数据" : "当前筛选无数据"}</p>
            <p className="text-xs mt-2">
              请先在{" "}
              <Link href="/topic-compare/accounts" className="text-sky-600 hover:underline">
                我方账号
              </Link>{" "}
              绑定账号并导入作品
            </p>
          </div>
        </GlassCard>
      ) : (
        <DataTable
          rows={filtered}
          rowKey={(r) => r.id}
          columns={[
              {
                key: "title",
                header: "作品标题",
                render: (r) => (
                  <div className="min-w-0">
                    <Link
                      href={`/topic-compare/${r.id}`}
                      className="text-sm text-gray-900 dark:text-gray-100 hover:text-sky-600 dark:hover:text-sky-400 truncate block"
                    >
                      {r.title}
                    </Link>
                    {r.topic && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        主题：{r.topic}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "distributions",
                header: "发布渠道",
                width: "200px",
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.distributions.slice(0, 4).map((d) => (
                      <a
                        key={d.accountId}
                        href={d.publishedUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-xs text-sky-700 dark:text-sky-300 hover:bg-sky-100"
                        onClick={(e) => {
                          if (!d.publishedUrl) e.preventDefault();
                        }}
                      >
                        {d.accountName}
                        {d.publishedUrl && <ExternalLink className="w-2.5 h-2.5" />}
                      </a>
                    ))}
                    {r.distributions.length > 4 && (
                      <span className="text-xs text-gray-500">+{r.distributions.length - 4}</span>
                    )}
                  </div>
                ),
              },
              {
                key: "publishedAt",
                header: "发布时间",
                width: "110px",
                render: (r) => (
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {formatDate(r.publishedAt)}
                  </span>
                ),
              },
              {
                key: "totalViews",
                header: "阅读",
                align: "right",
                width: "80px",
                render: (r) => <span className="text-xs">{formatNumber(r.totalViews)}</span>,
              },
              {
                key: "totalLikes",
                header: "点赞",
                align: "right",
                width: "80px",
                render: (r) => <span className="text-xs">{formatNumber(r.totalLikes)}</span>,
              },
              {
                key: "totalComments",
                header: "评论",
                align: "right",
                width: "80px",
                render: (r) => <span className="text-xs">{formatNumber(r.totalComments)}</span>,
              },
              {
                key: "matchCount",
                header: "同题数",
                align: "center",
                width: "80px",
                render: (r) =>
                  r.matchCount > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-green-50 dark:bg-green-950/40 text-xs text-green-700 dark:text-green-300">
                      {r.matchCount}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">0</span>
                  ),
              },
              {
                key: "status",
                header: "分析状态",
                width: "120px",
                render: (r) => (
                  <Link href={`/topic-compare/${r.id}`}>
                    {r.hasAnalysis ? (
                      <span className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700">
                        {r.summaryExpired ? "已分析（可刷新）" : "查看分析"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700">
                        生成分析
                      </span>
                    )}
                  </Link>
                ),
              },
          ]}
        />
      )}
    </div>
  );
}
