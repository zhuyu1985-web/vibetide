"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { bindSkillToEmployee } from "@/app/actions/employees";
import { Loader2, Link as LinkIcon, Sparkles } from "lucide-react";
import type { Skill, SkillCategory } from "@/lib/types";
import type { SkillRecommendation } from "@/lib/dal/skills";

const categoryLabels: Record<SkillCategory, string> = {
  perception: "感知",
  analysis: "分析",
  generation: "生成",
  production: "制作",
  management: "管理",
  knowledge: "知识",
};

const categoryColors: Record<SkillCategory, string> = {
  perception: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  analysis: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  generation: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",
  production: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  management: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  knowledge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
};

interface SkillBrowserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeDbId: string;
  availableSkills: Skill[];
  recommendations?: SkillRecommendation[];
}

export function SkillBrowserDialog({
  open,
  onOpenChange,
  employeeDbId,
  availableSkills,
  recommendations = [],
}: SkillBrowserDialogProps) {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bindingId, setBindingId] = useState<string | null>(null);
  const [showRecommended, setShowRecommended] = useState(recommendations.length > 0);

  const filtered = availableSkills.filter((s) => {
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    return true;
  });

  const recommendedIds = new Set(recommendations.map((r) => r.skill.id));

  const handleBind = async (skillId: string) => {
    setBindingId(skillId);
    try {
      await bindSkillToEmployee(employeeDbId, skillId, 50);
      router.refresh();
    } catch (err) {
      console.error("Failed to bind skill:", err);
    } finally {
      setBindingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>技能库</DialogTitle>
        </DialogHeader>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap pb-2">
          {recommendations.length > 0 && (
            <Button
              variant={showRecommended ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setShowRecommended(!showRecommended);
                setCategoryFilter("all");
              }}
            >
              <Sparkles size={12} className="mr-1" />
              推荐
            </Button>
          )}
          <Button
            variant={!showRecommended && categoryFilter === "all" ? "default" : "outline"}
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              setCategoryFilter("all");
              setShowRecommended(false);
            }}
          >
            全部
          </Button>
          {(Object.keys(categoryLabels) as SkillCategory[]).map((cat) => (
            <Button
              key={cat}
              variant={!showRecommended && categoryFilter === cat ? "default" : "outline"}
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setCategoryFilter(cat);
                setShowRecommended(false);
              }}
            >
              {categoryLabels[cat]}
            </Button>
          ))}
        </div>

        {/* Skills List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {showRecommended && recommendations.length > 0 && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 px-1 pb-1">
                <Sparkles size={11} className="inline mr-1 text-amber-500" />
                基于角色和能力分析的推荐技能
              </p>
              {recommendations.map((rec) => (
                <div
                  key={rec.skill.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-700/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {rec.skill.name}
                      </h4>
                      <Badge variant="outline" className="text-[10px]">
                        v{rec.skill.version}
                      </Badge>
                      <Badge className={`${categoryColors[rec.skill.category]} text-[10px]`}>
                        {categoryLabels[rec.skill.category]}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{rec.skill.description}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      {rec.reason}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 shrink-0"
                    onClick={() => handleBind(rec.skill.id)}
                    disabled={bindingId === rec.skill.id}
                  >
                    {bindingId === rec.skill.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <>
                        <LinkIcon size={12} className="mr-1" />
                        绑定
                      </>
                    )}
                  </Button>
                </div>
              ))}
              <div className="border-t border-gray-200/30 dark:border-gray-700/30 my-2" />
              <p className="text-xs text-gray-400 dark:text-gray-500 px-1">其他可用技能</p>
            </>
          )}
          {(showRecommended
            ? filtered.filter((s) => !recommendedIds.has(s.id))
            : filtered
          ).length === 0 && !showRecommended ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
              没有可绑定的技能
            </p>
          ) : (
            (showRecommended
              ? filtered.filter((s) => !recommendedIds.has(s.id))
              : filtered
            ).map((skill) => (
              <div
                key={skill.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/40 dark:bg-gray-900/40 border border-blue-100/30 dark:border-blue-800/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {skill.name}
                    </h4>
                    <Badge variant="outline" className="text-[10px]">
                      v{skill.version}
                    </Badge>
                    <Badge className={`${categoryColors[skill.category]} text-[10px]`}>
                      {categoryLabels[skill.category]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{skill.description}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 shrink-0"
                  onClick={() => handleBind(skill.id)}
                  disabled={bindingId === skill.id}
                >
                  {bindingId === skill.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <>
                      <LinkIcon size={12} className="mr-1" />
                      绑定
                    </>
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
