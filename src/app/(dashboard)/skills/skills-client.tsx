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
  Search,
  Pencil,
  Trash2,
  Users,
  ArrowDownWideNarrow,
  Clock,
  SortAsc,
} from "lucide-react";
import { deleteSkill } from "@/app/actions/skills";
import type { SkillWithBindCount } from "@/lib/dal/skills";
import type { SkillCategory } from "@/lib/types";

const categoryLabels: Record<SkillCategory, string> = {
  perception: "感知",
  analysis: "分析",
  generation: "生成",
  production: "制作",
  management: "管理",
  knowledge: "知识",
};

const categoryColors: Record<SkillCategory, string> = {
  perception:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  analysis:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  generation:
    "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  production:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  management:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  knowledge:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

type SkillType = "all" | "builtin" | "custom" | "plugin";

const typeLabels: Record<SkillType, string> = {
  all: "全部类型",
  builtin: "内置",
  custom: "自定义",
  plugin: "插件",
};

type SortKey = "bindCount" | "updatedAt" | "name";

const sortOptions: { key: SortKey; label: string; icon: typeof Users }[] = [
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
}

export function SkillsClient({ skills: initialSkills }: SkillsClientProps) {
  const [localSkills, setLocalSkills] = useState(initialSkills);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("bindCount");
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

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="技能管理"
        description="管理 AI 员工可用的技能库，添加自定义技能或查看内置技能"
        actions={
          <div className="flex gap-2">
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

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
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

        <div className="flex gap-1.5 flex-wrap">
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

        <div className="flex gap-1.5 flex-wrap">
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
