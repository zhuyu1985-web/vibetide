"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Layers,
  Plus,
  Trash2,
  Link as LinkIcon,
  Loader2,
  GripVertical,
  ArrowRight,
  Puzzle,
} from "lucide-react";
import {
  createSkillCombo,
  deleteSkillCombo,
  applySkillCombo,
} from "@/app/actions/employee-advanced";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/types";

interface SkillComboData {
  id: string;
  name: string;
  description: string | null;
  skillIds: string[];
  config: { sequential: boolean; passOutput: boolean } | null;
  resolvedSkills: { id: string; name: string }[];
}

interface SkillComboManagerProps {
  employeeDbId: string;
  combos: SkillComboData[];
  allSkills: Skill[];
}

export function SkillComboManager({
  employeeDbId,
  combos,
  allSkills,
}: SkillComboManagerProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  // Action states
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim() || selectedSkillIds.length < 2) return;
    setCreating(true);
    try {
      await createSkillCombo(newName.trim(), newDescription.trim(), selectedSkillIds);
      setCreateDialogOpen(false);
      setNewName("");
      setNewDescription("");
      setSelectedSkillIds([]);
      router.refresh();
    } catch (err) {
      console.error("Failed to create combo:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (comboId: string) => {
    setDeletingId(comboId);
    try {
      await deleteSkillCombo(comboId);
      router.refresh();
    } catch (err) {
      console.error("Failed to delete combo:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleApply = async (comboId: string) => {
    setApplyingId(comboId);
    try {
      await applySkillCombo(employeeDbId, comboId);
      router.refresh();
    } catch (err) {
      console.error("Failed to apply combo:", err);
    } finally {
      setApplyingId(null);
    }
  };

  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const moveSkill = (index: number, direction: "up" | "down") => {
    const newIds = [...selectedSkillIds];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newIds.length) return;
    [newIds[index], newIds[targetIndex]] = [newIds[targetIndex], newIds[index]];
    setSelectedSkillIds(newIds);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              技能组合
            </h3>
            <Badge variant="secondary" className="text-[10px]">
              {combos.length} 个组合
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus size={14} className="mr-1" />
            创建组合
          </Button>
        </div>

        {/* Combos list */}
        {combos.length === 0 ? (
          <GlassCard>
            <div className="text-center py-10">
              <Puzzle size={36} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                暂无技能组合
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                创建技能组合可以将多个技能链式组合，一键应用到员工
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {combos.map((combo) => (
              <GlassCard key={combo.id} variant="interactive" padding="md">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {combo.name}
                    </h4>
                    {combo.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {combo.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => handleApply(combo.id)}
                      disabled={applyingId === combo.id}
                    >
                      {applyingId === combo.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <>
                          <LinkIcon size={12} className="mr-1" />
                          应用
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 text-red-400 hover:text-red-600"
                      onClick={() => handleDelete(combo.id)}
                      disabled={deletingId === combo.id}
                    >
                      {deletingId === combo.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Skill chain visualization */}
                <div className="flex items-center flex-wrap gap-1 mt-2">
                  {combo.resolvedSkills.map((skill, idx) => (
                    <div key={skill.id} className="flex items-center gap-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700/50"
                      >
                        {idx + 1}. {skill.name}
                      </Badge>
                      {idx < combo.resolvedSkills.length - 1 && (
                        <ArrowRight
                          size={10}
                          className="text-gray-300 shrink-0"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {combo.config && (
                  <div className="flex gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] text-gray-500 dark:text-gray-400"
                    >
                      {combo.config.sequential ? "顺序执行" : "并行执行"}
                    </Badge>
                    {combo.config.passOutput && (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-gray-500 dark:text-gray-400"
                      >
                        输出传递
                      </Badge>
                    )}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Create Combo Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="glass-panel sm:max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>创建技能组合</DialogTitle>
            <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
              选择多个技能并排列执行顺序，创建可复用的技能链
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Name */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                组合名称
              </label>
              <Input
                placeholder="例如：热点监控+内容策划"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="glass-input"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                描述（可选）
              </label>
              <Input
                placeholder="组合用途说明..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="glass-input"
              />
            </div>

            {/* Selected skills (ordered) */}
            {selectedSkillIds.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                  已选技能（拖动调整顺序）
                </label>
                <div className="space-y-1">
                  {selectedSkillIds.map((id, idx) => {
                    const skill = allSkills.find((s) => s.id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-purple-50/50 dark:bg-purple-950/25 border border-purple-100/30 dark:border-purple-800/20"
                      >
                        <GripVertical size={12} className="text-gray-300" />
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-400 w-5">
                          {idx + 1}.
                        </span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">
                          {skill?.name || id}
                        </span>
                        <div className="flex gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                            onClick={() => moveSkill(idx, "up")}
                            disabled={idx === 0}
                          >
                            &uarr;
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600"
                            onClick={() => moveSkill(idx, "down")}
                            disabled={idx === selectedSkillIds.length - 1}
                          >
                            &darr;
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 text-red-400 hover:text-red-600"
                            onClick={() => toggleSkillSelection(id)}
                          >
                            &times;
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Available skills to pick */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
                可选技能
              </label>
              <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                {allSkills
                  .filter((s) => !selectedSkillIds.includes(s.id))
                  .map((skill) => (
                    <button
                      key={skill.id}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-lg border transition-all text-left",
                        "border-gray-100 dark:border-gray-700/50 hover:border-purple-200 dark:hover:border-purple-700/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/20"
                      )}
                      onClick={() => toggleSkillSelection(skill.id)}
                    >
                      <Plus size={12} className="text-purple-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {skill.name}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-2">
                          {skill.category}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        v{skill.version}
                      </Badge>
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setCreateDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={handleCreate}
              disabled={
                !newName.trim() || selectedSkillIds.length < 2 || creating
              }
            >
              {creating ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <Plus size={12} className="mr-1" />
              )}
              创建组合
              {selectedSkillIds.length > 0 && (
                <span className="ml-1 opacity-70">
                  ({selectedSkillIds.length} 个技能)
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
