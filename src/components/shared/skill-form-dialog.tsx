"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plug, Cpu } from "lucide-react";
import { createSkill, updateSkill, registerPluginSkill } from "@/app/actions/skills";
import type { SkillCategory } from "@/lib/types";

const modelOptions = [
  { value: "glm-5", label: "GLM-5 (智谱)", provider: "zhipu" },
  { value: "glm-4-plus", label: "GLM-4 Plus (智谱)", provider: "zhipu" },
  { value: "glm-4-flash", label: "GLM-4 Flash (智谱)", provider: "zhipu" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic" },
  { value: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
] as const;

const categoryOptions: { value: SkillCategory; label: string }[] = [
  { value: "perception", label: "感知" },
  { value: "analysis", label: "分析" },
  { value: "generation", label: "生成" },
  { value: "production", label: "制作" },
  { value: "management", label: "管理" },
  { value: "knowledge", label: "知识" },
];

interface SkillFormData {
  id?: string;
  name: string;
  category: SkillCategory;
  description: string;
  version: string;
  type?: "builtin" | "custom" | "plugin";
  compatibleRoles?: string[];
}

interface SkillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: SkillFormData;
  onSaved?: (data: { id: string; name: string; category: SkillCategory; description: string; version: string; type: string }) => void;
}

export function SkillFormDialog({
  open,
  onOpenChange,
  initialData,
  onSaved,
}: SkillFormDialogProps) {
  const isEdit = !!initialData?.id;

  const [name, setName] = useState(initialData?.name ?? "");
  const [category, setCategory] = useState<SkillCategory>(
    initialData?.category ?? "perception"
  );
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [version, setVersion] = useState(initialData?.version ?? "1.0");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});


  // Model selection
  const [modelId, setModelId] = useState("glm-5");

  // Plugin mode
  const [isPlugin, setIsPlugin] = useState(false);
  const [pluginEndpoint, setPluginEndpoint] = useState("");
  const [pluginMethod, setPluginMethod] = useState<"GET" | "POST">("POST");
  const [pluginAuthType, setPluginAuthType] = useState<"none" | "api_key" | "bearer">("none");
  const [pluginAuthKey, setPluginAuthKey] = useState("");
  const [pluginTimeout, setPluginTimeout] = useState("30000");

  // Reset form state when dialog opens or initialData changes
  useEffect(() => {
    if (open) {
      setName(initialData?.name ?? "");
      setCategory(initialData?.category ?? "perception");
      setDescription(initialData?.description ?? "");
      setVersion(initialData?.version ?? "1.0");
      setErrors({});
      setSaving(false);
      setModelId("glm-5");
      setIsPlugin(false);
      setPluginEndpoint("");
      setPluginMethod("POST");
      setPluginAuthType("none");
      setPluginAuthKey("");
      setPluginTimeout("30000");
    }
  }, [open, initialData]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "请输入技能名称";
    if (!description.trim()) errs.description = "请输入技能描述";
    if (isPlugin && !pluginEndpoint.trim()) errs.endpoint = "请输入 API 端点";
    if (isPlugin && pluginEndpoint.trim()) {
      try {
        new URL(pluginEndpoint);
      } catch {
        errs.endpoint = "API 端点 URL 格式无效";
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let result;
      if (isEdit && initialData?.id) {
        result = await updateSkill(initialData.id, {
          name,
          category,
          description,
          version,
        });
      } else if (isPlugin) {
        result = await registerPluginSkill({
          name,
          category,
          description,
          version,
          pluginConfig: {
            endpoint: pluginEndpoint.trim(),
            method: pluginMethod,
            authType: pluginAuthType,
            authKey: pluginAuthType !== "none" ? pluginAuthKey : undefined,
            timeoutMs: parseInt(pluginTimeout) || 30000,
          },
        });
      } else {
        const selectedModel = modelOptions.find((m) => m.value === modelId);
        result = await createSkill({
          name,
          category,
          description,
          version,
          runtimeConfig: {
            type: "llm",
            avgLatencyMs: 0,
            maxConcurrency: 1,
            modelDependency: selectedModel
              ? `${selectedModel.provider}:${selectedModel.value}`
              : `zhipu:${modelId}`,
          },
        });
      }
      onOpenChange(false);
      if (result && onSaved) {
        onSaved({
          id: result.id,
          name: result.name,
          category: result.category as SkillCategory,
          description: result.description,
          version: result.version,
          type: result.type,
        });
      }
    } catch (err) {
      console.error("Failed to save skill:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑技能" : "添加技能"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto">
          {/* Skill type toggle (only for new skills) */}
          {!isEdit && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!isPlugin ? "default" : "outline"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setIsPlugin(false)}
              >
                自定义技能
              </Button>
              <Button
                type="button"
                variant={isPlugin ? "default" : "outline"}
                size="sm"
                className="text-xs h-7"
                onClick={() => setIsPlugin(true)}
              >
                <Plug size={12} className="mr-1" />
                第三方插件
              </Button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="skill-name">
                名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入技能名称"
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skill-version">版本</Label>
              <Input
                id="skill-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="skill-category">
              分类 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as SkillCategory)}
            >
              <SelectTrigger id="skill-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model selection (for non-plugin skills) */}
          {!isPlugin && (
            <div className="space-y-1.5">
              <Label htmlFor="skill-model">
                <span className="flex items-center gap-1.5">
                  <Cpu size={12} />
                  执行模型
                </span>
              </Label>
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger id="skill-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                技能测试和工作流执行时使用的 AI 模型
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              描述 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`输入技能描述，支持 Markdown 格式：\n\n## 技能说明\n- 功能点 1\n- 功能点 2\n\n### 使用场景\n> 适用于...`}
              rows={isPlugin ? 6 : 12}
              className="font-mono text-sm"
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Plugin Configuration (S2.15) */}
          {isPlugin && !isEdit && (
            <div className="space-y-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/25 border border-blue-200/50 dark:border-blue-800/30">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Plug size={12} />
                插件配置
              </h4>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  API 端点 <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={pluginEndpoint}
                  onChange={(e) => setPluginEndpoint(e.target.value)}
                  placeholder="https://api.example.com/skill"
                  className="text-sm font-mono"
                />
                {errors.endpoint && (
                  <p className="text-xs text-red-500">{errors.endpoint}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">请求方法</Label>
                  <Select
                    value={pluginMethod}
                    onValueChange={(v) => setPluginMethod(v as "GET" | "POST")}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">超时 (ms)</Label>
                  <Input
                    value={pluginTimeout}
                    onChange={(e) => setPluginTimeout(e.target.value)}
                    placeholder="30000"
                    className="text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">认证方式</Label>
                <Select
                  value={pluginAuthType}
                  onValueChange={(v) => setPluginAuthType(v as "none" | "api_key" | "bearer")}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无认证</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                    <SelectItem value="bearer">Bearer Token</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pluginAuthType !== "none" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {pluginAuthType === "api_key" ? "API Key" : "Token"}
                  </Label>
                  <Input
                    value={pluginAuthKey}
                    onChange={(e) => setPluginAuthKey(e.target.value)}
                    placeholder={pluginAuthType === "api_key" ? "输入 API Key" : "输入 Bearer Token"}
                    type="password"
                    className="text-sm font-mono"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
            {isEdit ? "保存" : isPlugin ? "注册插件" : "添加"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
