"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { FileText, Settings2, Workflow, type LucideIcon } from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WorkflowLaunchDialog } from "@/components/workflows/workflow-launch-dialog";
import { startMissionFromTemplate } from "@/app/actions/workflow-launch";
import type { EmployeeId } from "@/lib/constants";
import type { WorkflowTemplateRow } from "@/db/types";
import type { HomepageTabKey } from "@/lib/dal/workflow-templates-listing";

// Task 2.3 — The custom-scenario type is retained as an export for any
// lingering consumer, but the homepage grid no longer renders the
// localStorage-backed "我的场景" chips. Custom workflows now live in the
// "我的工作流" tab and are sourced from `workflow_templates`.
export interface CustomScenario {
  id: string;
  name: string;
  baseKey: string;
  teamMembers: EmployeeId[];
  workflowSteps: unknown[];
  inputFields: unknown[];
  createdAt: string;
}

interface ScenarioGridProps {
  /**
   * Map of tab key → workflow templates for that tab. Keys are "featured"
   * + 8 employee slugs + "custom". Produced server-side in `/home/page.tsx`
   * via `listTemplatesForHomepageByTab`.
   */
  templatesByTab: Record<string, WorkflowTemplateRow[]>;
}

interface TabDef {
  key: HomepageTabKey;
  label: string;
}

const TAB_ORDER: TabDef[] = [
  { key: "featured", label: "主流场景" },
  { key: "xiaolei", label: "热点分析" },
  { key: "xiaoce", label: "选题策划" },
  { key: "xiaozi", label: "素材研究" },
  { key: "xiaowen", label: "内容创作" },
  { key: "xiaojian", label: "视频脚本" },
  { key: "xiaoshen", label: "质量审核" },
  { key: "xiaofa", label: "渠道运营" },
  { key: "xiaoshu", label: "数据分析" },
  { key: "custom", label: "我的工作流" },
];

/**
 * Dynamically resolve a Lucide icon by its component name string (stored in
 * `workflow_templates.icon`). Falls back to `FileText` if the name doesn't
 * match any exported icon.
 */
function resolveLucideIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return FileText;
  const maybeIcon = (LucideIcons as unknown as Record<string, LucideIcon>)[
    iconName
  ];
  return maybeIcon ?? FileText;
}

export function ScenarioGrid({ templatesByTab }: ScenarioGridProps) {
  const router = useRouter();
  const [launching, setLaunching] =
    React.useState<WorkflowTemplateRow | null>(null);
  const [directStartingId, setDirectStartingId] = React.useState<string | null>(
    null,
  );
  const [directError, setDirectError] = React.useState<string | null>(null);

  const handleCardClick = React.useCallback(
    async (tpl: WorkflowTemplateRow) => {
      setDirectError(null);
      if (tpl.launchMode === "direct") {
        setDirectStartingId(tpl.id);
        try {
          const res = await startMissionFromTemplate(tpl.id, {});
          if (res.ok) {
            router.push(`/missions/${res.missionId}`);
          } else {
            setDirectError(res.errors._global ?? "启动失败");
          }
        } catch (e) {
          setDirectError(e instanceof Error ? e.message : "启动失败");
        } finally {
          setDirectStartingId(null);
        }
      } else {
        setLaunching(tpl);
      }
    },
    [router],
  );

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">
          场景快捷启动
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="border-0 cursor-pointer text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground">
              + 自定义场景
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-56 p-2">
            <div className="space-y-0.5">
              <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
                选择创建方式
              </p>
              <button
                onClick={() => router.push("/scenarios/customize")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors duration-150 hover:bg-accent"
              >
                <Settings2 size={14} className="shrink-0 text-indigo-500" />
                <div>
                  <p className="font-medium leading-tight">基于现有场景修改</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    从预设场景调参
                  </p>
                </div>
              </button>
              <button
                onClick={() => router.push("/workflows/new")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors duration-150 hover:bg-accent"
              >
                <Workflow size={14} className="shrink-0 text-violet-500" />
                <div>
                  <p className="font-medium leading-tight">从零创建工作流</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    完全自定义步骤
                  </p>
                </div>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {directError && (
        <p className="text-xs text-red-600">{directError}</p>
      )}

      <Tabs defaultValue="featured" className="w-full gap-5">
        <TabsList variant="glass" className="gap-0.5 max-w-full whitespace-nowrap">
          {TAB_ORDER.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_ORDER.map((tab) => {
          const list = templatesByTab[tab.key] ?? [];
          return (
            <TabsContent key={tab.key} value={tab.key} className="mt-1">
              {list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-sky-200 p-8 text-center text-sm text-muted-foreground">
                  <p>
                    {tab.key === "custom"
                      ? "还没有自定义工作流"
                      : `${tab.label} 暂无预设工作流`}
                  </p>
                  <Button variant="link" asChild className="mt-2">
                    <Link href="/workflows">前往工作流模块查看</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {list.map((tpl, index) => {
                    const Icon = resolveLucideIcon(tpl.icon);
                    const team = (tpl.defaultTeam ?? []) as EmployeeId[];
                    const isStarting = directStartingId === tpl.id;
                    return (
                      <motion.div
                        key={tpl.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: index * 0.04,
                          ease: "easeOut",
                        }}
                        className="h-full"
                      >
                        <GlassCard
                          padding="md"
                          hover
                          className="flex h-full cursor-pointer flex-col"
                          onClick={() => handleCardClick(tpl)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1.5">
                                <Icon size={22} className="text-sky-500" />
                              </div>
                              <h3 className="truncate text-base font-medium">
                                {tpl.name}
                              </h3>
                              {tpl.description && (
                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                  {tpl.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {team.length > 0 && (
                            <div className="mt-3 flex items-center -space-x-1">
                              {team.slice(0, 5).map((memberId) => (
                                <EmployeeAvatar
                                  key={memberId}
                                  employeeId={memberId}
                                  size="sm"
                                />
                              ))}
                              {team.length > 5 && (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  +{team.length - 5}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="mt-auto flex justify-end pt-4">
                            <Button
                              size="sm"
                              disabled={isStarting}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCardClick(tpl);
                              }}
                            >
                              {isStarting ? "启动中…" : "启动"}
                            </Button>
                          </div>
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {launching && (
        <WorkflowLaunchDialog
          template={launching}
          open={!!launching}
          onOpenChange={(o) => {
            if (!o) setLaunching(null);
          }}
        />
      )}
    </div>
  );
}
