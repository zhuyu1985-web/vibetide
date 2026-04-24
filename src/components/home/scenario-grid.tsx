"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, Reorder } from "framer-motion";
import * as LucideIcons from "lucide-react";
import {
  ArrowUpDown,
  FileText,
  GripVertical,
  Pin,
  PinOff,
  Settings2,
  Workflow,
  type LucideIcon,
} from "lucide-react";

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
import {
  pinHomepageTemplate,
  reorderHomepageTemplates,
  unpinHomepageTemplate,
} from "@/app/actions/homepage-template-order";
import { isAllowedTabKey } from "@/lib/homepage-template-tabs";
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

// Task 4 — DAL 给共享 tab 的行附加了非持久 `__homepagePinnedAt`，客户端
// 由它区分置顶区 / 非置顶区。custom tab 无此字段（undefined 即 false）。
type TplWithPin = WorkflowTemplateRow & { __homepagePinnedAt?: Date | null };

function isPinned(t: TplWithPin): boolean {
  return t.__homepagePinnedAt != null;
}

interface ScenarioGridProps {
  /**
   * Map of tab key → workflow templates for that tab. Keys are "featured"
   * + 8 employee slugs + "custom". Produced server-side in `/home/page.tsx`
   * via `listTemplatesForHomepageByTab`.
   */
  templatesByTab: Record<string, TplWithPin[]>;
  /**
   * Task 4 — whether the current user can manage homepage template order
   * (admin / owner / super admin). Normal users see no edit controls.
   */
  canManageHomepage?: boolean;
}

interface TabDef {
  key: HomepageTabKey;
  label: string;
}

const TAB_ORDER: TabDef[] = [
  { key: "featured", label: "常用场景" },
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

// ─── TemplateCard ───────────────────────────────────────────────────

interface TemplateCardProps {
  tpl: TplWithPin;
  index: number;
  pinned: boolean;
  editing: boolean;
  canManage: boolean;
  isDirectStarting: boolean;
  onClickCard: () => void;
  onTogglePin: () => void;
}

function TemplateCard({
  tpl,
  index,
  pinned,
  editing,
  canManage,
  isDirectStarting,
  onClickCard,
  onTogglePin,
}: TemplateCardProps) {
  // 用 React.createElement 渲染动态 Lucide 图标——避免 `react-hooks/static-components`
  // 误判 `const Foo = resolve(...)` + `<Foo .../>` 模式为"render 内创建组件"。
  const iconNode = React.createElement(resolveLucideIcon(tpl.icon), {
    size: 22,
    className: "text-sky-500",
  });
  const team = (tpl.defaultTeam ?? []) as EmployeeId[];

  // 编辑态下关掉入场动画，避免拖拽时每次重排都闪动。
  const motionProps = editing
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: index * 0.04,
          ease: "easeOut" as const,
        },
      };

  return (
    <motion.div {...motionProps} className="h-full">
      <GlassCard
        padding="md"
        hover={!editing}
        className={[
          "relative flex h-full flex-col",
          editing ? "cursor-default" : "cursor-pointer",
          pinned ? "ring-1 ring-sky-300/40" : "",
        ].join(" ")}
        onClick={editing ? undefined : onClickCard}
      >
        {pinned && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-[inherit] bg-gradient-to-r from-sky-400/80 via-sky-300/60 to-transparent"
          />
        )}
        <div className="flex items-start justify-between gap-2">
          {editing && !pinned && (
            // 纯视觉拖拽手柄：Framer Motion Reorder.Item 默认整项可拖，手柄
            // 只是线索提示，不是独立交互元素。role="presentation" 把它移出
            // 可访问性树（不用 aria-label 因为 presentation 会 discard），
            // 用 <GripVertical> 的 aria-hidden 配套隐藏。键盘排序本期不支持
            // —— 属已知 v1 限制，同 <Reorder.Group> 的键盘交互缺失一并改进。
            <div
              role="presentation"
              className="mt-1 -ml-1 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground/60 transition-colors hover:text-sky-500 active:cursor-grabbing"
            >
              <GripVertical size={16} aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1.5">{iconNode}</div>
            <h3 className="flex items-center gap-1.5 truncate text-base font-medium">
              {tpl.name}
              {pinned && (
                <Pin
                  size={14}
                  className="shrink-0 rotate-[30deg] text-sky-500/80"
                  aria-label="已置顶"
                />
              )}
            </h3>
            {tpl.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {tpl.description}
              </p>
            )}
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={pinned ? "取消置顶" : "置顶"}
              className="absolute right-2 top-2 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              {pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </Button>
          )}
        </div>
        {team.length > 0 && (
          <div className="mt-3 flex items-center -space-x-1">
            {team.slice(0, 5).map((memberId) => (
              <EmployeeAvatar key={memberId} employeeId={memberId} size="sm" />
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
            disabled={isDirectStarting || editing}
            onClick={(e) => {
              e.stopPropagation();
              if (!editing) onClickCard();
            }}
          >
            {isDirectStarting ? "启动中…" : "启动"}
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─── ScenarioGrid ───────────────────────────────────────────────────

export function ScenarioGrid({
  templatesByTab,
  canManageHomepage = false,
}: ScenarioGridProps) {
  const router = useRouter();
  const [launching, setLaunching] =
    React.useState<WorkflowTemplateRow | null>(null);
  const [directStartingId, setDirectStartingId] = React.useState<string | null>(
    null,
  );
  const [directError, setDirectError] = React.useState<string | null>(null);

  // Task 4 — 每个 tab 独立的"整理顺序"开关（同时只能编辑一个 tab）。
  const [editingTab, setEditingTab] = React.useState<string | null>(null);
  // 乐观更新：保存每个 tab 当前非置顶区的 id 顺序。成功 router.refresh()
  // 后会拿到服务端新顺序，我们通过 useEffect 清掉乐观层。
  const [localUnpinnedOrder, setLocalUnpinnedOrder] = React.useState<
    Record<string, string[] | undefined>
  >({});

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

  const handleReorder = React.useCallback(
    async (tab: string, next: TplWithPin[]) => {
      const unpinnedIds = next.filter((t) => !isPinned(t)).map((t) => t.id);
      setLocalUnpinnedOrder((prev) => ({ ...prev, [tab]: unpinnedIds }));
      const res = await reorderHomepageTemplates({
        tab,
        orderedUnpinnedIds: unpinnedIds,
      });
      // 无论成功失败都清本地乐观层：失败 → 回滚显示服务端最新顺序；
      // 成功 → 清除后 router.refresh() 的结果才会被采用，否则并发/刷新
      // 下会持续用过时的 local 顺序覆盖服务端新数据。
      setLocalUnpinnedOrder((prev) => {
        const copy = { ...prev };
        delete copy[tab];
        return copy;
      });
      if (!res.ok) {
        console.warn("[homepage-reorder]", res.error, res.message);
      } else {
        router.refresh();
      }
    },
    [router],
  );

  const handleTogglePin = React.useCallback(
    async (tab: string, tpl: TplWithPin) => {
      const action = isPinned(tpl) ? unpinHomepageTemplate : pinHomepageTemplate;
      const res = await action({ tab, templateId: tpl.id });
      if (res.ok) {
        router.refresh();
      } else {
        console.warn("[homepage-pin]", res.error, res.message);
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

      {directError && <p className="text-xs text-red-600">{directError}</p>}

      <Tabs defaultValue="featured" className="w-full gap-5">
        <TabsList
          variant="glass"
          className="gap-0.5 max-w-full whitespace-nowrap"
        >
          {TAB_ORDER.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_ORDER.map((tab) => {
          const rawList = (templatesByTab[tab.key] ?? []) as TplWithPin[];
          const isSharedTab = isAllowedTabKey(tab.key);
          const showEditing =
            isSharedTab && canManageHomepage && editingTab === tab.key;
          const pinned = rawList.filter(isPinned);
          const unpinnedServer = rawList.filter((t) => !isPinned(t));

          // 套上乐观层：用户刚拖过的顺序立即展示，未 refresh 前先不回退。
          const localIds = localUnpinnedOrder[tab.key];
          const unpinned =
            localIds && localIds.length > 0
              ? (localIds
                  .map((id) => unpinnedServer.find((t) => t.id === id))
                  .filter((t): t is TplWithPin => !!t)
                  .concat(
                    unpinnedServer.filter((t) => !localIds.includes(t.id)),
                  ))
              : unpinnedServer;

          const gridCls = showEditing
            ? "grid grid-cols-1 gap-3"
            : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3";

          return (
            <TabsContent key={tab.key} value={tab.key} className="mt-1">
              {isSharedTab && canManageHomepage && (
                <div className="mb-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEditingTab((cur) =>
                        cur === tab.key ? null : tab.key,
                      )
                    }
                  >
                    <ArrowUpDown size={14} className="mr-1" />
                    {showEditing ? "完成" : "整理顺序"}
                  </Button>
                </div>
              )}

              {rawList.length === 0 ? (
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
                <>
                  {pinned.length > 0 && (
                    <div className={`${gridCls} mb-3`}>
                      {pinned.map((tpl, index) => (
                        <TemplateCard
                          key={tpl.id}
                          tpl={tpl}
                          index={index}
                          pinned
                          editing={showEditing}
                          canManage={canManageHomepage && isSharedTab}
                          isDirectStarting={directStartingId === tpl.id}
                          onClickCard={() => handleCardClick(tpl)}
                          onTogglePin={() => handleTogglePin(tab.key, tpl)}
                        />
                      ))}
                    </div>
                  )}
                  {showEditing && unpinned.length > 0 ? (
                    <Reorder.Group
                      axis="y"
                      values={unpinned}
                      onReorder={(next) => handleReorder(tab.key, next)}
                      className={gridCls}
                      as="div"
                    >
                      {unpinned.map((tpl, index) => (
                        <Reorder.Item
                          key={tpl.id}
                          value={tpl}
                          as="div"
                          className="list-none"
                        >
                          <TemplateCard
                            tpl={tpl}
                            index={index}
                            pinned={false}
                            editing
                            canManage={canManageHomepage && isSharedTab}
                            isDirectStarting={directStartingId === tpl.id}
                            onClickCard={() => handleCardClick(tpl)}
                            onTogglePin={() =>
                              handleTogglePin(tab.key, tpl)
                            }
                          />
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  ) : (
                    <div className={gridCls}>
                      {unpinned.map((tpl, index) => (
                        <TemplateCard
                          key={tpl.id}
                          tpl={tpl}
                          index={index}
                          pinned={false}
                          editing={false}
                          canManage={canManageHomepage && isSharedTab}
                          isDirectStarting={directStartingId === tpl.id}
                          onClickCard={() => handleCardClick(tpl)}
                          onTogglePin={() => handleTogglePin(tab.key, tpl)}
                        />
                      ))}
                    </div>
                  )}
                </>
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
