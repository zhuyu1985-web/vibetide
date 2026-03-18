"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { GlassCard } from "@/components/shared/glass-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Trash2,
  Users,
  Calendar,
  Clock,
  Star,
  Save,
  X,
  Eye,
  FileEdit,
  Download,
  FileText,
  FileCode,
  Plus,
  ChevronDown,
  ChevronRight,
  Loader2,
  History,
  RotateCcw,
  FlaskConical,
  Play,
  CheckCircle,
  XCircle,
  Info,
  Plug,
  Cpu,
  Zap,
  Shield,
  Lock,
} from "lucide-react";
import { deleteSkill, updateSkill, addSkillFile, updateSkillFile, deleteSkillFile, rollbackSkillVersion } from "@/app/actions/skills";
import { testSkillExecution } from "@/app/actions/employee-advanced";
import type { SkillDetailWithFiles, PluginConfigData, SkillUsageStats, SkillRuntimeConfig } from "@/lib/dal/skills";
import type { SkillCategory } from "@/lib/types";
import type { SkillFileRow, SkillVersionRow } from "@/db/types";

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

const MODEL_OPTIONS = [
  { value: "zhipu:glm-5", label: "GLM-5 (智谱)" },
  { value: "zhipu:glm-4-plus", label: "GLM-4 Plus (智谱)" },
  { value: "zhipu:glm-4-flash", label: "GLM-4 Flash (智谱)" },
  { value: "anthropic:claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "openai:gpt-4o", label: "GPT-4o" },
  { value: "openai:gpt-4o-mini", label: "GPT-4o Mini" },
];

function getModelLabel(dep: string): string {
  return MODEL_OPTIONS.find((m) => m.value === dep)?.label || dep || "未配置";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// --- File Item Component ---
function FileItem({
  file,
  onSave,
  onDelete,
}: {
  file: SkillFileRow;
  onSave: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.content);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const isMarkdown = file.fileName.endsWith(".md");

  const handleSave = async () => {
    setSaving(true);
    await onSave(file.id, draft);
    setSaving(false);
    setEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(file.id);
    setDeleting(false);
    setDeleteConfirm(false);
  };

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown size={12} className="text-gray-400 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-gray-400 shrink-0" />
        )}
        {file.fileType === "script" ? (
          <FileCode size={14} className="text-green-500 shrink-0" />
        ) : (
          <FileText size={14} className="text-blue-500 shrink-0" />
        )}
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300 flex-1">
          {file.filePath}
        </span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          {(file.content.length / 1024).toFixed(1)}KB
        </span>
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          {/* Actions */}
          <div className="flex gap-1.5 mb-2">
            {!editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraft(file.content);
                    setEditing(true);
                  }}
                >
                  <Pencil size={11} className="mr-1" />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2 text-red-500 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(true);
                  }}
                >
                  <Trash2 size={11} className="mr-1" />
                  删除
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={() => {
                    setEditing(false);
                    setDraft(file.content);
                  }}
                  disabled={saving}
                >
                  <X size={11} className="mr-1" />
                  取消
                </Button>
                <Button
                  size="sm"
                  className="h-6 text-[11px] px-2"
                  onClick={handleSave}
                  disabled={saving || draft === file.content}
                >
                  <Save size={11} className="mr-1" />
                  {saving ? "保存中..." : "保存"}
                </Button>
              </>
            )}
          </div>

          {/* Content */}
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full min-h-[200px] bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 resize-y focus:outline-none"
            />
          ) : isMarkdown ? (
            <div className="prose prose-sm dark:prose-invert max-w-none px-1 prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-pre:bg-gray-100 prose-pre:dark:bg-gray-800 prose-code:text-pink-600 prose-code:dark:text-pink-400">
              <ReactMarkdown>{file.content}</ReactMarkdown>
            </div>
          ) : (
            <pre className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
              {file.content}
            </pre>
          )}

          {/* Delete confirmation */}
          <ConfirmDialog
            open={deleteConfirm}
            onOpenChange={setDeleteConfirm}
            title="删除文件"
            description={`确定要删除「${file.fileName}」吗？`}
            variant="danger"
            confirmText="删除"
            loading={deleting}
            onConfirm={handleDelete}
          />
        </div>
      )}
    </div>
  );
}

// --- Add File Dialog ---
function AddFileDialog({
  open,
  onOpenChange,
  fileType,
  skillId,
  onFileAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileType: "reference" | "script";
  skillId: string;
  onFileAdded?: () => void;
}) {
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const prefix = fileType === "reference" ? "references/" : "scripts/";

  const handleSave = async () => {
    if (!fileName.trim()) return;
    setSaving(true);
    try {
      await addSkillFile(skillId, {
        fileType,
        fileName: fileName.trim(),
        filePath: prefix + fileName.trim(),
        content,
      });
      onOpenChange(false);
      setFileName("");
      setContent("");
      onFileAdded?.();
    } catch (err) {
      console.error("Failed to add file:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setFileName("");
          setContent("");
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-mono">
            {fileType === "reference" ? "添加参考文档" : "添加脚本"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              文件名
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                {prefix}
              </span>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={
                  fileType === "reference" ? "example.md" : "script.sh"
                }
                className="flex-1 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              内容
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full min-h-[150px] bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 resize-y focus:outline-none"
              placeholder="输入文件内容..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !fileName.trim()}
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="mr-1 animate-spin" />
                  添加中...
                </>
              ) : (
                "添加"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Test Result Type ---
interface SkillTestResult {
  skillName: string;
  skillCategory: string;
  skillVersion: string;
  description: string;
  testInput: string;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  runtimeInfo: {
    type: string;
    estimatedLatency: string;
    maxConcurrency: number;
    modelDependency: string;
  };
  expectedBehavior: string;
  executionResult?: {
    success: boolean;
    output?: string;
    error?: string;
    durationMs: number;
  } | null;
  validationChecks: {
    check: string;
    status: string;
    detail: string;
  }[];
}

const testStatusIcons: Record<string, React.ReactNode> = {
  pass: <CheckCircle size={12} className="text-green-500" />,
  fail: <XCircle size={12} className="text-red-500" />,
  info: <Info size={12} className="text-blue-500" />,
};

// --- Main Component ---
interface SkillDetailClientProps {
  skill: SkillDetailWithFiles;
  versions?: SkillVersionRow[];
  usageStats?: SkillUsageStats | null;
}

export function SkillDetailClient({ skill, versions = [], usageStats }: SkillDetailClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Frontmatter inline editing
  const [metaEditing, setMetaEditing] = useState(false);
  const currentModel = skill.runtimeConfig?.modelDependency || "";
  const [metaDraft, setMetaDraft] = useState({
    name: skill.name,
    description: skill.description,
    category: skill.category,
    version: skill.version,
    model: currentModel,
  });
  const [metaSaving, setMetaSaving] = useState(false);

  const [mdEditing, setMdEditing] = useState(false);
  const [mdDraft, setMdDraft] = useState(skill.content);
  const [mdPreview, setMdPreview] = useState(false);
  const [mdSaving, setMdSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // File management
  const [activeFileTab, setActiveFileTab] = useState<"reference" | "script">("reference");
  const [addRefOpen, setAddRefOpen] = useState(false);
  const [addScriptOpen, setAddScriptOpen] = useState(false);

  // Version history
  const [rollbackingId, setRollbackingId] = useState<string | null>(null);

  // Skill testing (S6.04)
  const [testInput, setTestInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SkillTestResult | null>(null);
  const [showTest, setShowTest] = useState(false);

  const referenceFiles = skill.files.filter((f) => f.fileType === "reference");
  const scriptFiles = skill.files.filter((f) => f.fileType === "script");
  const activeFiles = activeFileTab === "reference" ? referenceFiles : scriptFiles;

  useEffect(() => {
    if (mdEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [mdEditing]);

  const handleMdSave = async () => {
    setMdSaving(true);
    try {
      await updateSkill(skill.id, { content: mdDraft });
      setMdEditing(false);
      setMdPreview(false);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Failed to save skill description:", err);
    } finally {
      setMdSaving(false);
    }
  };

  const handleMdCancel = () => {
    setMdDraft(skill.content);
    setMdEditing(false);
    setMdPreview(false);
  };

  const handleMetaSave = async () => {
    if (!metaDraft.name.trim()) return;
    setMetaSaving(true);
    try {
      await updateSkill(skill.id, {
        name: metaDraft.name.trim(),
        description: metaDraft.description.trim(),
        category: metaDraft.category,
        version: metaDraft.version.trim(),
        ...(metaDraft.model !== currentModel
          ? {
              runtimeConfig: {
                type: "llm",
                avgLatencyMs: skill.runtimeConfig?.avgLatencyMs ?? 0,
                maxConcurrency: skill.runtimeConfig?.maxConcurrency ?? 1,
                modelDependency: metaDraft.model || undefined,
              },
            }
          : {}),
      });
      setMetaEditing(false);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Failed to save skill metadata:", err);
    } finally {
      setMetaSaving(false);
    }
  };

  const handleMetaCancel = () => {
    setMetaDraft({
      name: skill.name,
      description: skill.description,
      category: skill.category,
      version: skill.version,
      model: currentModel,
    });
    setMetaEditing(false);
  };

  const isBuiltin = skill.type === "builtin";

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSkill(skill.id);
      router.push("/skills");
    } catch (err) {
      console.error("Failed to delete skill:", err);
      setDeleting(false);
    }
  };

  const handleExport = () => {
    window.open(`/api/skills/${skill.id}/export`, "_blank");
  };

  const handleFileSave = async (fileId: string, content: string) => {
    await updateSkillFile(fileId, { content });
    startTransition(() => router.refresh());
  };

  const handleFileDelete = async (fileId: string) => {
    await deleteSkillFile(fileId);
    startTransition(() => router.refresh());
  };

  const handleRollback = async (versionId: string) => {
    setRollbackingId(versionId);
    try {
      await rollbackSkillVersion(skill.id, versionId);
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Failed to rollback:", err);
    } finally {
      setRollbackingId(null);
    }
  };

  const handleTest = async () => {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSkillExecution(skill.id, testInput);
      setTestResult(res as SkillTestResult);
    } catch (err) {
      console.error("Skill test failed:", err);
    } finally {
      setTesting(false);
    }
  };

  const shortDesc = skill.description;

  return (
    <div>
      {/* Compact header: breadcrumb + title + badges + actions */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          {/* Breadcrumb */}
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-400 dark:text-gray-500 mb-2">
            <span className="text-green-600 dark:text-green-400">$</span>
            <Link
              href="/skills"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              技能管理
            </Link>
            <span>/</span>
            <span className="text-gray-600 dark:text-gray-300">
              {categoryLabels[skill.category]}
            </span>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200">
              {skill.name}
            </span>
          </div>

          {/* Title + badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono text-orange-600 dark:text-orange-400">
              {skill.name}
            </h1>
            <Badge className={`${categoryColors[skill.category]} text-xs`}>
              {categoryLabels[skill.category]}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${
                skill.type === "builtin"
                  ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  : skill.type === "plugin"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              }`}
            >
              {skill.type === "builtin" ? "内置" : skill.type === "plugin" ? "插件" : "自定义"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              v{skill.version}
            </Badge>
          </div>

          {/* Short description */}
          <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-1.5">
            <span className="text-green-600 dark:text-green-400">//</span>{" "}
            {shortDesc}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 mt-5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs px-3 text-purple-500 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-200"
            onClick={() => setShowTest(!showTest)}
          >
            <FlaskConical size={13} className="mr-1.5" />
            测试
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs px-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={handleExport}
          >
            <Download size={13} className="mr-1.5" />
            导出
          </Button>
          {skill.type !== "builtin" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs px-3 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={13} className="mr-1.5" />
              删除
            </Button>
          )}
        </div>
      </div>

      {/* Inline Skill Test Panel (S6.04) */}
      {showTest && (
        <GlassCard className="mb-4" padding="none">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <FlaskConical size={14} className="text-purple-500" />
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                技能独立测试
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[11px] px-2 text-gray-400 hover:text-gray-600"
              onClick={() => {
                setShowTest(false);
                setTestResult(null);
                setTestInput("");
              }}
            >
              <X size={11} className="mr-1" />
              关闭
            </Button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                测试输入
              </label>
              <textarea
                className="w-full min-h-[80px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 resize-none"
                placeholder="输入测试参数或文本内容..."
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              className="w-full text-xs"
              onClick={handleTest}
              disabled={!testInput.trim() || testing}
            >
              {testing ? (
                <Loader2 size={14} className="mr-1 animate-spin" />
              ) : (
                <Play size={14} className="mr-1" />
              )}
              {testing ? "分析中..." : "执行测试"}
            </Button>

            {testResult && (
              <div className="space-y-3 mt-2">
                <div className="p-3 rounded-lg bg-purple-50/50 dark:bg-purple-950/25 border border-purple-100/50 dark:border-purple-800/30">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {testResult.skillName}
                    </h4>
                    <Badge variant="outline" className="text-[10px]">
                      v{testResult.skillVersion}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{testResult.description}</p>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/25 border border-blue-100/50 dark:border-blue-800/30">
                  <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">运行时信息</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">类型</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{testResult.runtimeInfo.type}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">延迟</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{testResult.runtimeInfo.estimatedLatency}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">并发</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{testResult.runtimeInfo.maxConcurrency}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">模型</span>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{testResult.runtimeInfo.modelDependency}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/25 border border-green-100/50 dark:border-green-800/30">
                  <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">预期行为</h4>
                  <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {testResult.expectedBehavior}
                  </pre>
                </div>

                {testResult.executionResult && (
                  <div className={`p-3 rounded-lg border ${testResult.executionResult.success ? "bg-emerald-50/50 dark:bg-emerald-950/25 border-emerald-100/50 dark:border-emerald-800/30" : "bg-red-50/50 dark:bg-red-950/25 border-red-100/50 dark:border-red-800/30"}`}>
                    <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                      {testResult.executionResult.success ? <CheckCircle size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
                      执行结果
                      <span className="text-[10px] text-gray-400 font-normal">
                        ({testResult.executionResult.durationMs}ms)
                      </span>
                    </h4>
                    {testResult.executionResult.output ? (
                      <pre className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-white/50 dark:bg-gray-900/50 rounded p-2 max-h-[200px] overflow-y-auto">
                        {testResult.executionResult.output}
                      </pre>
                    ) : testResult.executionResult.error ? (
                      <p className="text-xs text-red-600 dark:text-red-400">{testResult.executionResult.error}</p>
                    ) : null}
                  </div>
                )}

                <div className="p-3 rounded-lg bg-gray-50/50 dark:bg-gray-800/25 border border-gray-100/50 dark:border-gray-700/30">
                  <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">验证检查</h4>
                  <div className="space-y-2">
                    {testResult.validationChecks.map((check, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {testStatusIcons[check.status] || testStatusIcons.info}
                        <div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{check.check}</span>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">{check.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Two-column: main content + sidebar */}
      <div className="flex gap-6 items-start">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Frontmatter metadata card */}
          <GlassCard padding="none">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-2">
                <Shield size={13} className="text-orange-500" />
                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  frontmatter
                </span>
              </div>
              {metaEditing ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] font-mono px-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={handleMetaCancel}
                    disabled={metaSaving}
                  >
                    <X size={11} className="mr-1" />
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-[11px] font-mono px-2.5"
                    onClick={handleMetaSave}
                    disabled={metaSaving || (
                      metaDraft.name === skill.name &&
                      metaDraft.description === skill.description &&
                      metaDraft.category === skill.category &&
                      metaDraft.version === skill.version &&
                      metaDraft.model === currentModel
                    )}
                  >
                    {metaSaving ? (
                      <Loader2 size={11} className="mr-1 animate-spin" />
                    ) : (
                      <Save size={11} className="mr-1" />
                    )}
                    {metaSaving ? "保存中..." : "保存"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] font-mono px-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={() => {
                    setMetaDraft({
                      name: skill.name,
                      description: skill.description,
                      category: skill.category,
                      version: skill.version,
                      model: currentModel,
                    });
                    setMetaEditing(true);
                  }}
                >
                  <Pencil size={10} className="mr-1" />
                  编辑
                </Button>
              )}
            </div>

            {/* Builtin restriction hint */}
            {metaEditing && isBuiltin && (
              <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 px-3 py-2">
                <Lock size={12} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  内置技能的 <span className="font-semibold">name</span>、<span className="font-semibold">category</span>、<span className="font-semibold">version</span> 由系统管理，不可修改。如需完全自定义，请基于此技能创建自定义副本。
                </p>
              </div>
            )}

            {/* Core metadata table */}
            <div className="divide-y divide-gray-200/60 dark:divide-gray-700/60">
              <table className="text-sm w-full font-mono">
                <tbody>
                  <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                    <td className="text-orange-600 dark:text-orange-400 px-4 py-2.5 bg-orange-50/30 dark:bg-orange-950/10 w-[140px] font-medium">
                      <span className="flex items-center gap-1.5">
                        name
                        {metaEditing && isBuiltin && <Lock size={10} className="text-gray-400" />}
                      </span>
                    </td>
                    <td className="text-gray-800 dark:text-gray-200 px-4 py-2">
                      {metaEditing && !isBuiltin ? (
                        <Input
                          value={metaDraft.name}
                          onChange={(e) => setMetaDraft({ ...metaDraft, name: e.target.value })}
                          className="h-7 text-sm font-mono"
                        />
                      ) : (
                        <span className={`py-0.5 inline-block ${metaEditing && isBuiltin ? "text-gray-400 dark:text-gray-500" : ""}`}>{skill.name}</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                    <td className="text-orange-600 dark:text-orange-400 px-4 py-2.5 bg-orange-50/30 dark:bg-orange-950/10 font-medium">
                      description
                    </td>
                    <td className="text-gray-800 dark:text-gray-200 px-4 py-2">
                      {metaEditing ? (
                        <Input
                          value={metaDraft.description}
                          onChange={(e) => setMetaDraft({ ...metaDraft, description: e.target.value })}
                          className="h-7 text-sm font-mono"
                        />
                      ) : (
                        <span className="py-0.5 inline-block">{shortDesc}</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                    <td className="text-orange-600 dark:text-orange-400 px-4 py-2.5 bg-orange-50/30 dark:bg-orange-950/10 font-medium">
                      <span className="flex items-center gap-1.5">
                        category
                        {metaEditing && isBuiltin && <Lock size={10} className="text-gray-400" />}
                      </span>
                    </td>
                    <td className="text-gray-800 dark:text-gray-200 px-4 py-2">
                      {metaEditing && !isBuiltin ? (
                        <Select
                          value={metaDraft.category}
                          onValueChange={(v) => setMetaDraft({ ...metaDraft, category: v as SkillCategory })}
                        >
                          <SelectTrigger className="h-7 text-sm font-mono w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(categoryLabels) as SkillCategory[]).map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-sm font-mono">
                                {categoryLabels[cat]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`py-0.5 inline-block ${metaEditing && isBuiltin ? "text-gray-400 dark:text-gray-500" : ""}`}>{categoryLabels[skill.category]}</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                    <td className="text-orange-600 dark:text-orange-400 px-4 py-2.5 bg-orange-50/30 dark:bg-orange-950/10 font-medium">
                      <span className="flex items-center gap-1.5">
                        version
                        {metaEditing && isBuiltin && <Lock size={10} className="text-gray-400" />}
                      </span>
                    </td>
                    <td className="text-gray-800 dark:text-gray-200 px-4 py-2">
                      {metaEditing && !isBuiltin ? (
                        <Input
                          value={metaDraft.version}
                          onChange={(e) => setMetaDraft({ ...metaDraft, version: e.target.value })}
                          className="h-7 text-sm font-mono"
                        />
                      ) : (
                        <span className={`py-0.5 inline-block ${metaEditing && isBuiltin ? "text-gray-400 dark:text-gray-500" : ""}`}>v{skill.version}</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                    <td className="text-orange-600 dark:text-orange-400 px-4 py-2.5 bg-orange-50/30 dark:bg-orange-950/10 font-medium">
                      type
                    </td>
                    <td className="text-gray-800 dark:text-gray-200 px-4 py-2">
                      <span className="py-0.5 inline-block text-gray-500 dark:text-gray-400">
                        {skill.type === "builtin" ? "内置" : skill.type === "plugin" ? "插件" : "自定义"}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                    <td className="text-orange-600 dark:text-orange-400 px-4 py-2.5 bg-orange-50/30 dark:bg-orange-950/10 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Cpu size={10} />
                        model
                      </span>
                    </td>
                    <td className="text-gray-800 dark:text-gray-200 px-4 py-2">
                      {metaEditing ? (
                        <Select
                          value={metaDraft.model || "zhipu:glm-5"}
                          onValueChange={(v) => setMetaDraft({ ...metaDraft, model: v })}
                        >
                          <SelectTrigger className="h-7 text-sm font-mono w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MODEL_OPTIONS.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="text-sm font-mono">
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="py-0.5 inline-block text-gray-600 dark:text-gray-300">
                          {getModelLabel(currentModel)}
                        </span>
                      )}
                    </td>
                  </tr>
                  {skill.compatibleRoles.length > 0 && (
                    <tr className="border-b border-gray-200/60 dark:border-gray-700/60">
                      <td className="text-orange-600 dark:text-orange-400 px-4 py-2.5 bg-orange-50/30 dark:bg-orange-950/10 font-medium">
                        roles
                      </td>
                      <td className="text-gray-800 dark:text-gray-200 px-4 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {skill.compatibleRoles.map((role) => (
                            <Badge key={role} variant="outline" className="text-[10px] font-mono">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Extended metadata: schemas + runtime */}
            {(skill.inputSchema || skill.outputSchema || skill.runtimeConfig) && (
              <div className="border-t border-gray-200/50 dark:border-gray-700/50">
                {/* Input / Output schema */}
                {(skill.inputSchema || skill.outputSchema) && (
                  <div className="px-4 py-3 grid grid-cols-2 gap-4">
                    {skill.inputSchema && Object.keys(skill.inputSchema).length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Zap size={11} className="text-blue-500" />
                          <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">inputSchema</span>
                        </div>
                        <div className="space-y-1">
                          {Object.entries(skill.inputSchema).map(([key, val]) => (
                            <div key={key} className="flex items-baseline gap-2 text-xs font-mono">
                              <span className="text-blue-600 dark:text-blue-400">{key}</span>
                              <span className="text-gray-400">:</span>
                              <span className="text-gray-600 dark:text-gray-300">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {skill.outputSchema && Object.keys(skill.outputSchema).length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Zap size={11} className="text-green-500" />
                          <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">outputSchema</span>
                        </div>
                        <div className="space-y-1">
                          {Object.entries(skill.outputSchema).map(([key, val]) => (
                            <div key={key} className="flex items-baseline gap-2 text-xs font-mono">
                              <span className="text-green-600 dark:text-green-400">{key}</span>
                              <span className="text-gray-400">:</span>
                              <span className="text-gray-600 dark:text-gray-300">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Runtime config */}
                {skill.runtimeConfig && (
                  <div className="px-4 py-3 border-t border-gray-200/50 dark:border-gray-700/50">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Cpu size={11} className="text-purple-500" />
                      <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">runtimeConfig</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block">运行类型</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{skill.runtimeConfig.type}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block">平均延迟</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{skill.runtimeConfig.avgLatencyMs}ms</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 block">最大并发</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{skill.runtimeConfig.maxConcurrency}</span>
                      </div>
                      {skill.runtimeConfig.modelDependency && (
                        <div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 block">模型依赖</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">{skill.runtimeConfig.modelDependency}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>

          {/* SKILL.md terminal card */}
          <GlassCard padding="none">
            {/* Window chrome */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  SKILL.md
                </span>
              </div>
              {mdEditing ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-xs font-mono px-2.5 ${
                      !mdPreview
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                    onClick={() => setMdPreview(false)}
                  >
                    <FileEdit size={12} className="mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 text-xs font-mono px-2.5 ${
                      mdPreview
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                    onClick={() => setMdPreview(true)}
                  >
                    <Eye size={12} className="mr-1" />
                    预览
                  </Button>
                  <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs font-mono px-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={handleMdCancel}
                    disabled={mdSaving}
                  >
                    <X size={12} className="mr-1" />
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs font-mono px-3"
                    onClick={handleMdSave}
                    disabled={mdSaving || mdDraft === skill.content}
                  >
                    <Save size={12} className="mr-1" />
                    {mdSaving ? "保存中..." : "保存"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs font-mono px-2.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={() => {
                    setMdDraft(skill.content);
                    setMdEditing(true);
                    setMdPreview(false);
                  }}
                >
                  <Pencil size={11} className="mr-1" />
                  编辑
                </Button>
              )}
            </div>

            {/* Markdown body / editor */}
            <div className="px-5 py-5">
              {mdEditing ? (
                mdPreview ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-p:my-2.5 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-gray-100 prose-pre:dark:bg-gray-800 prose-code:text-pink-600 prose-code:dark:text-pink-400 prose-blockquote:border-l-blue-400 prose-blockquote:dark:border-l-blue-500 prose-a:text-blue-600 prose-a:dark:text-blue-400">
                    <ReactMarkdown>{mdDraft}</ReactMarkdown>
                  </div>
                ) : (
                  <textarea
                    ref={textareaRef}
                    value={mdDraft}
                    onChange={(e) => setMdDraft(e.target.value)}
                    className="w-full min-h-[400px] bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-800 dark:text-gray-200 resize-y focus:outline-none placeholder:text-gray-400"
                    placeholder="输入 Markdown 内容..."
                  />
                )
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-5 prose-headings:mb-2 prose-p:my-2.5 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:bg-gray-100 prose-pre:dark:bg-gray-800 prose-code:text-pink-600 prose-code:dark:text-pink-400 prose-blockquote:border-l-blue-400 prose-blockquote:dark:border-l-blue-500 prose-a:text-blue-600 prose-a:dark:text-blue-400">
                  <ReactMarkdown>{skill.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Skill Files */}
          {(skill.files.length > 0 || skill.type !== "builtin") && (
            <GlassCard padding="none">
              {/* Tab header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center gap-1">
                  <Button
                    variant={activeFileTab === "reference" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs font-mono px-3"
                    onClick={() => setActiveFileTab("reference")}
                  >
                    <FileText size={12} className="mr-1" />
                    参考文档
                    {referenceFiles.length > 0 && (
                      <span className="ml-1.5 text-[10px] opacity-70">
                        ({referenceFiles.length})
                      </span>
                    )}
                  </Button>
                  <Button
                    variant={activeFileTab === "script" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs font-mono px-3"
                    onClick={() => setActiveFileTab("script")}
                  >
                    <FileCode size={12} className="mr-1" />
                    脚本
                    {scriptFiles.length > 0 && (
                      <span className="ml-1.5 text-[10px] opacity-70">
                        ({scriptFiles.length})
                      </span>
                    )}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={() =>
                    activeFileTab === "reference"
                      ? setAddRefOpen(true)
                      : setAddScriptOpen(true)
                  }
                >
                  <Plus size={12} className="mr-1" />
                  添加文件
                </Button>
              </div>

              {/* File list */}
              {activeFiles.length > 0 ? (
                <div>
                  {activeFiles.map((file) => (
                    <FileItem
                      key={file.id}
                      file={file}
                      onSave={handleFileSave}
                      onDelete={handleFileDelete}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                  {activeFileTab === "reference"
                    ? "暂无参考文档，点击「添加文件」上传"
                    : "暂无脚本文件，点击「添加文件」上传"}
                </div>
              )}
            </GlassCard>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-[280px] shrink-0 space-y-4 hidden lg:block">
          {/* Skill metadata */}
          <GlassCard padding="none">
            <div className="px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50">
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                skill.info
              </span>
            </div>
            <div className="px-4 py-3 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                  <Users size={12} />
                  绑定员工
                </span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {skill.bindCount} 个
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-gray-500">版本</span>
                <span className="text-gray-700 dark:text-gray-300 font-mono">
                  v{skill.version}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-gray-500">分类</span>
                <Badge
                  className={`${categoryColors[skill.category]} text-[10px]`}
                >
                  {categoryLabels[skill.category]}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 dark:text-gray-500">类型</span>
                <span className="text-gray-700 dark:text-gray-300">
                  {skill.type === "builtin" ? "内置" : skill.type === "plugin" ? "插件" : "自定义"}
                </span>
              </div>
              {skill.files.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-gray-500">附加文件</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {skill.files.length} 个
                  </span>
                </div>
              )}
              {usageStats && usageStats.totalUsages > 0 && (
                <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 dark:text-gray-500">使用次数</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {usageStats.totalUsages}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 dark:text-gray-500">成功率</span>
                    <span className={`font-semibold ${usageStats.successRate >= 80 ? "text-green-600 dark:text-green-400" : usageStats.successRate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {usageStats.successRate}%
                    </span>
                  </div>
                  {usageStats.avgQualityScore != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 dark:text-gray-500">平均质量</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {usageStats.avgQualityScore}分
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-gray-200/50 dark:border-gray-700/50 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <Calendar size={11} />
                    创建时间
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 font-mono text-[11px]">
                    {formatDate(skill.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <Clock size={11} />
                    更新时间
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 font-mono text-[11px]">
                    {formatDate(skill.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Plugin Configuration (S2.15) */}
          {skill.type === "plugin" && skill.pluginConfig && (
            <GlassCard padding="none">
              <div className="px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center gap-1.5">
                  <Plug size={12} className="text-blue-400" />
                  <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                    插件配置
                  </span>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2.5 text-xs">
                <div>
                  <span className="text-gray-400 dark:text-gray-500 block mb-0.5">API 端点</span>
                  <span className="text-gray-700 dark:text-gray-300 font-mono text-[11px] break-all">
                    {skill.pluginConfig.endpoint}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-gray-500">请求方法</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {skill.pluginConfig.method || "POST"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-gray-500">认证方式</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {skill.pluginConfig.authType === "bearer" ? "Bearer Token" : skill.pluginConfig.authType === "api_key" ? "API Key" : "无认证"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 dark:text-gray-500">超时</span>
                  <span className="text-gray-700 dark:text-gray-300 font-mono">
                    {skill.pluginConfig.timeoutMs || 30000}ms
                  </span>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Bound employees */}
          <GlassCard padding="none">
            <div className="px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50">
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                绑定员工
              </span>
            </div>
            <div className="px-4 py-3">
              {skill.boundEmployees.length > 0 ? (
                <div className="space-y-2.5">
                  {skill.boundEmployees.map((emp) => (
                    <Link
                      key={emp.id}
                      href={`/employee/${emp.id}`}
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0">
                          {emp.nickname.charAt(0)}
                        </div>
                        <div className="text-xs">
                          <div className="text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors font-medium">
                            {emp.nickname}
                          </div>
                          <div className="text-gray-400 dark:text-gray-500 text-[11px]">
                            {emp.name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
                        <Star size={10} className="text-amber-400" />
                        Lv.{emp.level}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">
                  暂无员工绑定此技能
                </div>
              )}
            </div>
          </GlassCard>

          {/* Version History (S2.14) */}
          <GlassCard padding="none">
            <div className="px-4 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50">
              <div className="flex items-center gap-1.5">
                <History size={12} className="text-gray-400" />
                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                  版本历史
                </span>
                {versions.length > 0 && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    ({versions.length})
                  </span>
                )}
              </div>
            </div>
            <div className="px-4 py-3">
              {versions.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {versions.map((v) => {
                    const snapshot = v.snapshot as { name?: string; description?: string } | null;
                    return (
                      <div
                        key={v.id}
                        className="relative pl-4 border-l-2 border-gray-200 dark:border-gray-700"
                      >
                        <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300">
                                #{v.versionNumber}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                                v{v.version}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                              {v.changeDescription || "更新"}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                              {formatDate(v.createdAt.toISOString ? v.createdAt.toISOString() : String(v.createdAt))}
                            </p>
                          </div>
                          {skill.type !== "builtin" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] px-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0"
                              onClick={() => handleRollback(v.id)}
                              disabled={rollbackingId === v.id}
                              title="回滚到此版本"
                            >
                              {rollbackingId === v.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <RotateCcw size={10} />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center">
                  暂无版本记录
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除技能"
        description={
          skill.bindCount > 0
            ? `该技能已被 ${skill.bindCount} 个员工绑定，删除后将自动解绑。确定要删除「${skill.name}」吗？`
            : `确定要删除「${skill.name}」吗？`
        }
        variant="danger"
        confirmText="删除"
        loading={deleting}
        onConfirm={handleDelete}
      />

      {/* Add File Dialogs */}
      <AddFileDialog
        open={addRefOpen}
        onOpenChange={setAddRefOpen}
        fileType="reference"
        skillId={skill.id}
        onFileAdded={() => startTransition(() => router.refresh())}
      />
      <AddFileDialog
        open={addScriptOpen}
        onOpenChange={setAddScriptOpen}
        fileType="script"
        skillId={skill.id}
        onFileAdded={() => startTransition(() => router.refresh())}
      />
    </div>
  );
}
