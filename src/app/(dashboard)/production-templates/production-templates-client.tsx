"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Layers,
  BarChart3,
  FileText,
  Trash2,
  Pencil,
  Play,
  Copy,
} from "lucide-react";
import {
  createProductionTemplate,
  deleteProductionTemplate,
  applyProductionTemplate,
} from "@/app/actions/production-templates";
import type { ProductionTemplateItem } from "@/lib/dal/production-templates";

const categoryLabels: Record<string, string> = {
  news_flash: "快讯",
  interview: "访谈",
  commentary: "评论",
  feature: "特稿",
  social_post: "社交帖",
};

const categoryColors: Record<string, string> = {
  news_flash: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200",
  interview: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/50",
  commentary: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200",
  feature: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200",
  social_post: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200",
};

interface TemplateStats {
  categories: {
    category: string;
    label: string;
    count: number;
    totalUsage: number;
  }[];
  totalTemplates: number;
  totalUsage: number;
}

interface ProductionTemplatesClientProps {
  templates: ProductionTemplateItem[];
  stats: TemplateStats;
}

export function ProductionTemplatesClient({
  templates,
  stats,
}: ProductionTemplatesClientProps) {
  const [isPending, startTransition] = useTransition();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ProductionTemplateItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("news_flash");
  const [formSections, setFormSections] = useState([
    { title: "", prompt: "", wordCount: 300 },
  ]);

  // Apply form state
  const [applyVariables, setApplyVariables] = useState<Record<string, string>>(
    {}
  );
  const [applyResult, setApplyResult] = useState<{
    templateName: string;
    sections: { title: string; prompt: string; wordCount: number }[];
  } | null>(null);

  const filteredTemplates =
    filterCategory === "all"
      ? templates
      : templates.filter((t) => t.category === filterCategory);

  const handleCreate = () => {
    startTransition(async () => {
      await createProductionTemplate({
        name: formName,
        description: formDescription,
        category: formCategory,
        structure: {
          sections: formSections,
          mediaTypes: ["article"],
          targetChannels: [],
        },
        variables: [],
      });
      setShowCreateDialog(false);
      setFormName("");
      setFormDescription("");
      setFormSections([{ title: "", prompt: "", wordCount: 300 }]);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteProductionTemplate(id);
    });
  };

  const handleApply = (template: ProductionTemplateItem) => {
    setSelectedTemplate(template);
    setApplyVariables({});
    setApplyResult(null);
    setShowApplyDialog(true);
  };

  const handleApplySubmit = () => {
    if (!selectedTemplate) return;
    startTransition(async () => {
      const result = await applyProductionTemplate(
        selectedTemplate.id,
        applyVariables
      );
      setApplyResult(result);
    });
  };

  const addSection = () => {
    setFormSections([...formSections, { title: "", prompt: "", wordCount: 200 }]);
  };

  const updateSection = (
    index: number,
    field: "title" | "prompt" | "wordCount",
    value: string | number
  ) => {
    const updated = [...formSections];
    if (field === "wordCount") {
      updated[index] = { ...updated[index], [field]: Number(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setFormSections(updated);
  };

  const removeSection = (index: number) => {
    if (formSections.length <= 1) return;
    setFormSections(formSections.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="生产模板"
        description="高频内容类型模板化 · 标准化生产流程 · 提升出稿效率"
        actions={
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus size={14} className="mr-1" />
            创建模板
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="模板总数"
          value={stats.totalTemplates}
          suffix="个"
          icon={<Layers size={18} />}
        />
        <StatCard
          label="总使用次数"
          value={stats.totalUsage}
          suffix="次"
          icon={<BarChart3 size={18} />}
        />
        <StatCard
          label="分类数"
          value={stats.categories.length}
          suffix="个"
          icon={<FileText size={18} />}
        />
        <StatCard
          label="平均使用"
          value={
            stats.totalTemplates > 0
              ? Math.round(stats.totalUsage / stats.totalTemplates)
              : 0
          }
          suffix="次/模板"
          icon={<Play size={18} />}
        />
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button
          variant={filterCategory === "all" ? "default" : "outline"}
          size="sm"
          className="text-xs h-7"
          onClick={() => setFilterCategory("all")}
        >
          全部
        </Button>
        {Object.entries(categoryLabels).map(([key, label]) => (
          <Button
            key={key}
            variant={filterCategory === key ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setFilterCategory(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.length === 0 && (
          <GlassCard className="col-span-full">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              暂无模板，点击&ldquo;创建模板&rdquo;开始
            </p>
          </GlassCard>
        )}

        {filteredTemplates.map((template) => (
          <GlassCard key={template.id} variant="interactive" padding="md">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {template.description}
                  </p>
                )}
              </div>
              {template.category && (
                <Badge
                  className={`text-[10px] shrink-0 ml-2 ${
                    categoryColors[template.category] ||
                    "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {categoryLabels[template.category] || template.category}
                </Badge>
              )}
            </div>

            {/* Structure preview */}
            <div className="mb-3">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">模板结构:</p>
              <div className="flex flex-wrap gap-1">
                {template.structure.sections.map((section, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] py-0"
                  >
                    {section.title || `段落${i + 1}`}
                    <span className="text-gray-400 dark:text-gray-500 ml-1">
                      {section.wordCount}字
                    </span>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span>使用 {template.usageCount} 次</span>
                <span>
                  {template.structure.mediaTypes.length} 种媒体
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleApply(template)}
                >
                  <Play size={14} className="text-blue-500" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  disabled={isPending}
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 size={14} className="text-red-400" />
                </Button>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建生产模板</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>模板名称</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：热点快讯模板"
              />
            </div>

            <div>
              <Label>描述</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="模板用途说明"
              />
            </div>

            <div>
              <Label>分类</Label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>模板段落</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={addSection}
                >
                  <Plus size={12} className="mr-1" />
                  添加段落
                </Button>
              </div>

              <div className="space-y-3">
                {formSections.map((section, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50/50 dark:bg-gray-800/25"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        段落 {i + 1}
                      </span>
                      {formSections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(i)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <Input
                      value={section.title}
                      onChange={(e) =>
                        updateSection(i, "title", e.target.value)
                      }
                      placeholder="段落标题"
                      className="mb-2"
                    />
                    <textarea
                      value={section.prompt}
                      onChange={(e) =>
                        updateSection(i, "prompt", e.target.value)
                      }
                      placeholder="段落写作提示，支持 {{变量名}} 占位符"
                      className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none h-20"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Label className="text-xs">字数:</Label>
                      <Input
                        type="number"
                        value={section.wordCount}
                        onChange={(e) =>
                          updateSection(i, "wordCount", e.target.value)
                        }
                        className="w-20 h-7 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isPending || !formName.trim()}
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              使用模板: {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedTemplate && !applyResult && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {selectedTemplate.description || "配置模板参数后开始生产"}
              </p>

              {/* Template variables */}
              {selectedTemplate.variables.length > 0 && (
                <div className="space-y-3">
                  <Label>模板变量</Label>
                  {selectedTemplate.variables.map((v) => (
                    <div key={v.name}>
                      <Label className="text-xs">{v.label}</Label>
                      <Input
                        value={applyVariables[v.name] || v.default || ""}
                        onChange={(e) =>
                          setApplyVariables((prev) => ({
                            ...prev,
                            [v.name]: e.target.value,
                          }))
                        }
                        placeholder={v.label}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Preview structure */}
              <div>
                <Label className="text-xs text-gray-500 dark:text-gray-400">模板结构预览</Label>
                <div className="mt-2 space-y-2">
                  {selectedTemplate.structure.sections.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded p-2"
                    >
                      <span className="font-medium">{i + 1}.</span>
                      <span>{s.title || `段落${i + 1}`}</span>
                      <span className="text-gray-400 dark:text-gray-500 ml-auto">
                        {s.wordCount}字
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowApplyDialog(false)}
                >
                  取消
                </Button>
                <Button onClick={handleApplySubmit} disabled={isPending}>
                  <Play size={14} className="mr-1" />
                  应用模板
                </Button>
              </DialogFooter>
            </div>
          )}

          {applyResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Copy size={16} />
                <span className="text-sm font-medium">
                  模板已应用成功
                </span>
              </div>

              <div className="space-y-3">
                {applyResult.sections.map((section, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">
                      {section.title || `段落 ${i + 1}`}
                    </h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{section.prompt}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      目标字数: {section.wordCount}
                    </p>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button onClick={() => setShowApplyDialog(false)}>
                  完成
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
