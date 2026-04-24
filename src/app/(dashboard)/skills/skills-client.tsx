"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { SkillFormDialog } from "@/components/shared/skill-form-dialog";
import { SkillImportDialog } from "@/components/shared/skill-import-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Upload,
  Download,
  Search,
  Pencil,
  Trash2,
  Users,
  ArrowDownWideNarrow,
  Clock,
  SortAsc,
  CheckSquare,
  Square,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { deleteSkill, getSkillsForExport } from "@/app/actions/skills";
import { generateSkillMd } from "@/lib/skill-package";
import type { SkillWithBindCount } from "@/lib/dal/skills";
import type { SkillCategory } from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WorkflowsPanel } from "./workflows-panel";

const categoryLabels: Record<SkillCategory, string> = {
  web_search: "全网检索",
  data_collection: "数据采集",
  topic_planning: "选题策划",
  content_gen: "内容生成",
  av_script: "视音频脚本",
  quality_review: "质量审核",
  content_analysis: "内容分析",
  data_analysis: "数据分析",
  distribution: "渠道分发",
  other: "其他",
};

const categoryColors: Record<SkillCategory, string> = {
  web_search:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  data_collection:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  topic_planning:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  content_gen:
    "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  av_script:
    "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  quality_review:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  content_analysis:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  data_analysis:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  distribution:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  other:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

type SkillType = "all" | "builtin" | "custom" | "plugin";

const typeLabels: Record<SkillType, string> = {
  all: "全部类型",
  builtin: "内置",
  custom: "自定义",
  plugin: "插件",
};

type SortKey = "createdAt" | "bindCount" | "updatedAt" | "name";

const sortOptions: { key: SortKey; label: string; icon: typeof Users }[] = [
  { key: "createdAt", label: "添加时间", icon: Clock },
  { key: "bindCount", label: "绑定数", icon: ArrowDownWideNarrow },
  { key: "updatedAt", label: "最近更新", icon: Clock },
  { key: "name", label: "名称", icon: SortAsc },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}


interface SkillsClientProps {
  skills: SkillWithBindCount[];
  /**
   * B.1 unified scenario workflow — the "场景工作流" tab shows workflow
   * templates alongside atomic skills. Both are "能力" in the user mental
   * model (场景 = 工作流 = 员工固化的能力)。
   */
  workflows?: WorkflowTemplateRow[];
}

export function SkillsClient({
  skills: initialSkills,
  workflows = [],
}: SkillsClientProps) {
  const [localSkills, setLocalSkills] = useState(initialSkills);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("createdAt");
  const [typeFilter, setTypeFilter] = useState<SkillType>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillWithBindCount | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<SkillWithBindCount | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  // Sync with server props when they update
  useEffect(() => {
    setLocalSkills(initialSkills);
  }, [initialSkills]);

  const handleSkillSaved = (data: { id: string; name: string; category: SkillCategory; description: string; version: string; type: string }) => {
    const now = new Date().toISOString();
    const skillType = data.type as "builtin" | "custom" | "plugin";
    setLocalSkills((prev) => {
      const idx = prev.findIndex((s) => s.id === data.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], name: data.name, category: data.category, description: data.description, version: data.version, type: skillType, updatedAt: now };
        return updated;
      }
      return [
        {
          id: data.id,
          name: data.name,
          category: data.category,
          description: data.description,
          version: data.version,
          type: skillType,
          level: 1,
          createdAt: now,
          updatedAt: now,
          bindCount: 0,
        },
        ...prev,
      ];
    });
    setEditingSkill(null);
  };

  const sorted = useMemo(() => {
    const filtered = localSkills.filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter)
        return false;
      if (typeFilter !== "all" && s.type !== typeFilter)
        return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "createdAt":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "bindCount":
          return b.bindCount - a.bindCount;
        case "updatedAt":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "name":
          return a.name.localeCompare(b.name, "zh-CN");
        default:
          return 0;
      }
    });
  }, [localSkills, categoryFilter, typeFilter, search, sortBy]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSkill(deleteTarget.id);
      setLocalSkills((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    } catch (err) {
      console.error("Failed to delete skill:", err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = sorted.map((s) => s.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleBatchExport = async () => {
    if (selected.size === 0) return;
    setExporting(true);
    try {
      const ids = Array.from(selected);
      const data = await getSkillsForExport(ids);
      if (data.length === 0) return;

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const skill of data) {
        const folderName = (skill.slug || skill.name).replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, "_");
        const md = generateSkillMd(skill.name, skill.description, skill.content, {
          name: skill.slug || skill.name,
          displayName: skill.name,
          category: skill.category,
          version: skill.version,
          inputSchema: skill.inputSchema ?? undefined,
          outputSchema: skill.outputSchema ?? undefined,
          runtimeConfig: skill.runtimeConfig ?? undefined,
          compatibleRoles: skill.compatibleRoles,
        });
        zip.file(`${folderName}/SKILL.md`, md);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `skills-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setSelected(new Set());
    } catch (err) {
      console.error("Failed to export skills:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="技能管理"
        description="管理 AI 员工可用的技能库，添加自定义技能或查看内置技能"
        actions={
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button
                variant="ghost"
                onClick={handleBatchExport}
                disabled={exporting}
              >
                <Download size={16} className="mr-1" />
                {exporting ? "导出中..." : `导出 (${selected.size})`}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              <Upload size={16} className="mr-1" />
              导入技能
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} className="mr-1" />
              添加技能
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="atomic" className="w-full">
        <TabsList variant="line" className="mb-5">
          <TabsTrigger value="atomic">
            原子能力 ({initialSkills.length})
          </TabsTrigger>
          <TabsTrigger value="workflows">
            场景工作流 ({workflows.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atomic" className="mt-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={toggleSelectAll}
        >
          {sorted.length > 0 && sorted.every((s) => selected.has(s.id)) ? (
            <CheckSquare size={14} />
          ) : (
            <Square size={14} />
          )}
          全选
        </Button>
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能名称或描述..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-0.5">
            分类
          </span>
          <Button
            variant={categoryFilter === "all" ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setCategoryFilter("all")}
          >
            全部
          </Button>
          {(Object.keys(categoryLabels) as SkillCategory[]).map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setCategoryFilter(cat)}
            >
              {categoryLabels[cat]}
            </Button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-300/60 dark:bg-gray-600/40 self-center" />

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mr-0.5">
            来源
          </span>
          {(Object.keys(typeLabels) as SkillType[]).map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setTypeFilter(t)}
            >
              {typeLabels[t]}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="mr-1">排序</span>
          {sortOptions.map((opt) => (
            <Button
              key={opt.key}
              variant={sortBy === opt.key ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => setSortBy(opt.key)}
            >
              <opt.icon size={12} className="mr-1" />
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          {search || categoryFilter !== "all" || typeFilter !== "all"
            ? "没有匹配的技能"
            : "暂无技能，点击「添加技能」创建"}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((skill) => (
            <GlassCard key={skill.id} variant="interactive" padding="none">
              {/* Terminal-style top bar */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Checkbox
                    checked={selected.has(skill.id)}
                    onCheckedChange={() => toggleSelect(skill.id)}
                    className="shrink-0"
                  />
                  <div className="flex gap-1.5 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <Link
                    href={`/skills/${skill.id}`}
                    className="text-sm font-semibold text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                  >
                    {skill.name}
                  </Link>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  <Users size={12} />
                  <span>{skill.bindCount}</span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
                <Badge
                  className={`${categoryColors[skill.category]} text-[10px]`}
                >
                  {categoryLabels[skill.category]}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    skill.type === "builtin"
                      ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      : skill.type === "plugin"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  }`}
                >
                  {skill.type === "builtin" ? "内置" : skill.type === "plugin" ? "插件" : "自定义"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  v{skill.version}
                </Badge>
              </div>

              {/* Description */}
              <Link href={`/skills/${skill.id}`} className="block px-4 pb-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-4 leading-relaxed min-h-[4rem]">
                  {skill.description}
                </p>
              </Link>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200/50 dark:border-gray-700/50">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {formatDate(skill.updatedAt)}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSkill(skill);
                    }}
                  >
                    <Pencil size={13} />
                  </Button>
                  {skill.type !== "builtin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(skill);
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
        </TabsContent>

        <TabsContent value="workflows" className="mt-0">
          <WorkflowsPanel workflows={workflows} />
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <SkillImportDialog open={importOpen} onOpenChange={setImportOpen} />

      {/* Create Dialog */}
      <SkillFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={handleSkillSaved}
      />

      {/* Edit Dialog */}
      {editingSkill && (
        <SkillFormDialog
          open={!!editingSkill}
          onOpenChange={(open) => {
            if (!open) setEditingSkill(null);
          }}
          initialData={{
            id: editingSkill.id,
            name: editingSkill.name,
            category: editingSkill.category,
            description: editingSkill.description,
            version: editingSkill.version,
            type: editingSkill.type,
          }}
          onSaved={handleSkillSaved}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除技能"
        description={
          deleteTarget?.bindCount
            ? `该技能已被 ${deleteTarget.bindCount} 个员工绑定，删除后将自动解绑。确定要删除「${deleteTarget.name}」吗？`
            : `确定要删除「${deleteTarget?.name ?? ""}」吗？`
        }
        variant="danger"
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
