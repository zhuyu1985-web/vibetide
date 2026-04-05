"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Upload,
  FileText,
  FileCode,
  FolderOpen,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { parseSkillZip, parseFrontmatter } from "@/lib/skill-package";
import type { ParsedSkillPackage, ValidationError } from "@/lib/skill-package";
import { importSkillPackage, importSkillMd } from "@/app/actions/skills";
import type { SkillCategory } from "@/lib/types";

const categoryOptions: { value: SkillCategory; label: string }[] = [
  { value: "perception", label: "感知" },
  { value: "analysis", label: "分析" },
  { value: "generation", label: "生成" },
  { value: "production", label: "制作" },
  { value: "management", label: "管理" },
  { value: "knowledge", label: "知识" },
];

interface SkillImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillImportDialog({
  open,
  onOpenChange,
}: SkillImportDialogProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [pkg, setPkg] = useState<ParsedSkillPackage | null>(null);
  const [mdRawContent, setMdRawContent] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SkillCategory>("knowledge");

  const reset = () => {
    setParsing(false);
    setImporting(false);
    setErrors([]);
    setPkg(null);
    setMdRawContent(null);
    setName("");
    setDescription("");
    setCategory("knowledge");
  };

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    setErrors([]);
    setPkg(null);
    setMdRawContent(null);

    try {
      if (file.name.endsWith(".md")) {
        // Single SKILL.md file import
        const raw = await file.text();
        const { name: parsedName, description: parsedDesc, body, meta } = parseFrontmatter(raw);

        if (!body.trim()) {
          setErrors([{ type: "missing_skill_md", message: "SKILL.md 文件内容为空" }]);
          setParsing(false);
          return;
        }

        setMdRawContent(raw);
        setPkg({
          name: parsedName,
          description: parsedDesc,
          content: body,
          meta,
          files: [],
        });
        setName(parsedName);
        setDescription(parsedDesc);
        if (meta.category) setCategory(meta.category);
      } else {
        // ZIP package import
        const result = await parseSkillZip(file);
        setErrors(result.errors);

        const blockingErrors = result.errors.filter(
          (e) => e.type !== "unsafe_path"
        );
        if (blockingErrors.length > 0) {
          setParsing(false);
          return;
        }

        setPkg(result.package);
        setName(result.package.name);
        setDescription(result.package.description);
        if (result.package.meta.category) setCategory(result.package.meta.category);
      }
    } catch {
      setErrors([
        {
          type: "file_too_large",
          message: "无法解析文件，请检查文件格式",
        },
      ]);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".zip") || file.name.endsWith(".md"))) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleImport = async () => {
    if (!pkg || !name.trim()) return;
    setImporting(true);
    try {
      if (mdRawContent) {
        // Single SKILL.md import
        await importSkillMd({
          rawContent: mdRawContent,
          category,
        });
      } else {
        // ZIP package import
        await importSkillPackage({
          name: name.trim(),
          description: description.trim(),
          category,
          content: pkg.content,
          files: pkg.files,
        });
      }
      router.refresh();
      onOpenChange(false);
      reset();
    } catch (err) {
      setErrors([
        {
          type: "file_too_large",
          message:
            err instanceof Error ? err.message : "导入失败，请重试",
        },
      ]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">
            导入技能包
          </DialogTitle>
        </DialogHeader>

        {/* Error display */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg p-3 space-y-1">
            {errors.map((err, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400"
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <div>
                  <p>{err.message}</p>
                  {err.details?.map((d, j) => (
                    <p key={j} className="text-red-500/70 dark:text-red-500/50 font-mono">
                      {d}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!pkg ? (
          /* Drop zone */
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.md"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={32} className="text-blue-500 animate-spin" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  解析中...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload
                  size={32}
                  className="text-gray-400 dark:text-gray-500"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  拖放文件到此处，或点击选择文件
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  支持 .md（单文件）或 .zip（技能包），最大 10MB
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Preview & edit */
          <div className="space-y-4">
            {/* Metadata form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  技能名称
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入技能名称"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[60px] bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-800 dark:text-gray-200 resize-y focus:outline-none"
                  placeholder="输入技能描述"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  分类
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {categoryOptions.map((opt) => (
                    <Button
                      key={opt.value}
                      variant={category === opt.value ? "default" : "ghost"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setCategory(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* File tree */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
                <span className="font-mono">文件预览</span>
                <span>
                  {pkg.files.length + 1} 个文件
                </span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {/* SKILL.md */}
                <div className="flex items-center gap-2 px-3 py-2 text-xs">
                  <FileText
                    size={14}
                    className="text-blue-500 shrink-0"
                  />
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    SKILL.md
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] ml-auto"
                  >
                    核心文件
                  </Badge>
                </div>
                {/* Other files */}
                {pkg.files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 text-xs"
                  >
                    {f.fileType === "script" ? (
                      <FileCode
                        size={14}
                        className="text-green-500 shrink-0"
                      />
                    ) : (
                      <FolderOpen
                        size={14}
                        className="text-amber-500 shrink-0"
                      />
                    )}
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {f.filePath}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 ml-auto">
                      {(f.content.length / 1024).toFixed(1)}KB
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  reset();
                }}
              >
                重新选择
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || !name.trim()}
              >
                {importing ? (
                  <>
                    <Loader2 size={14} className="mr-1 animate-spin" />
                    导入中...
                  </>
                ) : (
                  <>
                    <Check size={14} className="mr-1" />
                    确认导入
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
