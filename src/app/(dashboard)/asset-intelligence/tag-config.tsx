"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Lock,
  Pencil,
  Trash2,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
  Tag,
} from "lucide-react";
import {
  createTagSchema,
  updateTagSchema,
  deleteTagSchema,
} from "@/app/actions/tag-schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagSchemaItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  options: { value: string; label: string }[] | null;
  isCustom: boolean | null;
  isActive: boolean | null;
  sortOrder: number | null;
}

interface DefaultTagSchema {
  name: string;
  category: string;
  description: string;
  options: { value: string; label: string }[];
}

interface Props {
  customSchemas: TagSchemaItem[];
  defaultSchemas: DefaultTagSchema[];
}

// ---------------------------------------------------------------------------
// Default category colors
// ---------------------------------------------------------------------------

const categoryColors: Record<string, { bg: string; text: string }> = {
  topic: { bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-700 dark:text-blue-400" },
  event: { bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-700 dark:text-amber-400" },
  emotion: { bg: "bg-pink-50 dark:bg-pink-950/50", text: "text-pink-700 dark:text-pink-400" },
  person: { bg: "bg-indigo-50 dark:bg-indigo-950/50", text: "text-indigo-700 dark:text-indigo-400" },
  location: { bg: "bg-green-50 dark:bg-green-950/50", text: "text-green-700 dark:text-green-400" },
  shotType: { bg: "bg-purple-50 dark:bg-purple-950/50", text: "text-purple-700 dark:text-purple-400" },
  quality: { bg: "bg-teal-50 dark:bg-teal-950/50", text: "text-teal-700 dark:text-teal-400" },
  object: { bg: "bg-orange-50 dark:bg-orange-950/50", text: "text-orange-700 dark:text-orange-400" },
  action: { bg: "bg-red-50 dark:bg-red-950/50", text: "text-red-700 dark:text-red-400" },
};

function getCategoryColor(category: string) {
  return categoryColors[category] || { bg: "bg-gray-50 dark:bg-gray-800/50", text: "text-gray-700 dark:text-gray-300" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TagConfig({ customSchemas, defaultSchemas }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOptions, setFormOptions] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormCategory("");
    setFormDescription("");
    setFormOptions("");
  }

  function startEdit(schema: TagSchemaItem) {
    setEditingId(schema.id);
    setFormName(schema.name);
    setFormCategory(schema.category);
    setFormDescription(schema.description || "");
    setFormOptions(
      schema.options?.map((o) => o.label).join("、") || ""
    );
    setShowForm(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCategory.trim()) return;
    setSaving(true);
    try {
      const options = formOptions
        .split(/[、,，]/)
        .filter(Boolean)
        .map((s) => ({ value: s.trim(), label: s.trim() }));

      if (editingId) {
        await updateTagSchema(editingId, {
          name: formName,
          category: formCategory,
          description: formDescription || undefined,
          options,
        });
      } else {
        await createTagSchema({
          name: formName,
          category: formCategory,
          description: formDescription || undefined,
          options,
        });
      }
      resetForm();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteTagSchema(id);
    router.refresh();
  }

  async function handleToggleActive(schema: TagSchemaItem) {
    await updateTagSchema(schema.id, {
      isActive: !schema.isActive,
    });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
            <Tag size={16} className="text-blue-500" />
            标注维度管理
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            配置和管理素材标注的分类维度，内置维度不可删除
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus size={14} className="mr-1" />
          添加标注维度
        </Button>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <GlassCard variant="blue">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {editingId ? "编辑标注维度" : "新建标注维度"}
          </h4>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                维度名称
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：拍摄手法"
                className="w-full h-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 text-xs outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                分类标识
              </label>
              <input
                type="text"
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="例如：shooting_style"
                className="w-full h-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 text-xs outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] font-medium text-gray-500 mb-1 block">
              描述
            </label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="该维度的用途说明"
              className="w-full h-8 rounded-lg bg-white border border-gray-200 px-3 text-xs outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
            />
          </div>
          <div className="mb-3">
            <label className="text-[10px] font-medium text-gray-500 mb-1 block">
              预设选项（用顿号分隔）
            </label>
            <input
              type="text"
              value={formOptions}
              onChange={(e) => setFormOptions(e.target.value)}
              placeholder="例如：中景、特写、航拍、全景"
              className="w-full h-8 rounded-lg bg-white border border-gray-200 px-3 text-xs outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetForm}
              className="text-xs h-7"
            >
              <X size={12} className="mr-1" />
              取消
            </Button>
            <Button
              size="sm"
              disabled={!formName.trim() || !formCategory.trim() || saving}
              onClick={handleSave}
              className="text-xs h-7"
            >
              <Save size={12} className="mr-1" />
              {saving ? "保存中..." : "保存"}
            </Button>
          </div>
        </GlassCard>
      )}

      {/* Default (built-in) schemas */}
      <GlassCard>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <Lock size={12} className="text-gray-400 dark:text-gray-500" />
          内置标注维度
          <Badge variant="outline" className="text-[9px]">
            {defaultSchemas.length} 个
          </Badge>
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {defaultSchemas.map((schema) => {
            const color = getCategoryColor(schema.category);
            return (
              <div
                key={schema.category}
                className={cn(
                  "p-3 rounded-lg border border-gray-100 dark:border-gray-700/50",
                  color.bg
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-xs font-semibold", color.text)}>
                    {schema.name}
                  </span>
                  <Lock size={10} className="text-gray-300" />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1.5">
                  {schema.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {schema.options.slice(0, 3).map((opt, i) => (
                    <Badge
                      key={i}
                      className={cn("text-[9px] py-0", color.bg, color.text)}
                    >
                      {opt.label}
                    </Badge>
                  ))}
                  {schema.options.length > 3 && (
                    <span className="text-[9px] text-gray-400 dark:text-gray-500">
                      +{schema.options.length - 3}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Custom schemas */}
      <GlassCard>
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
          <Tag size={12} className="text-blue-500" />
          自定义标注维度
          <Badge variant="outline" className="text-[9px]">
            {customSchemas.length} 个
          </Badge>
        </h4>
        {customSchemas.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
            暂无自定义维度，点击上方&ldquo;添加标注维度&rdquo;创建
          </div>
        ) : (
          <div className="space-y-2">
            {customSchemas.map((schema) => {
              const color = getCategoryColor(schema.category);
              return (
                <div
                  key={schema.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                    schema.isActive
                      ? "border-gray-100 dark:border-gray-700/50 bg-white/70 dark:bg-gray-900/70"
                      : "border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50 opacity-60"
                  )}
                >
                  <GripVertical
                    size={14}
                    className="text-gray-300 cursor-grab shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                        {schema.name}
                      </span>
                      <Badge
                        className={cn(
                          "text-[9px] py-0",
                          color.bg,
                          color.text
                        )}
                      >
                        {schema.category}
                      </Badge>
                      {!schema.isActive && (
                        <Badge className="text-[9px] py-0 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          已停用
                        </Badge>
                      )}
                    </div>
                    {schema.description && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {schema.description}
                      </p>
                    )}
                    {schema.options && schema.options.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {schema.options.map((opt, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[9px] py-0"
                          >
                            {opt.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-blue-500"
                      onClick={() => handleToggleActive(schema)}
                      title={schema.isActive ? "停用" : "启用"}
                    >
                      {schema.isActive ? (
                        <ToggleRight size={14} className="text-green-500" />
                      ) : (
                        <ToggleLeft size={14} />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-blue-500"
                      onClick={() => startEdit(schema)}
                    >
                      <Pencil size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
                      onClick={() => handleDelete(schema.id)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
