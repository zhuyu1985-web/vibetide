"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Puzzle, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillImportDialog } from "@/components/shared/skill-import-dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteSkill } from "@/app/actions/skills";
import type { SkillWithBindCount } from "@/lib/dal/skills";

export function PluginsClient({ skills }: { skills: SkillWithBindCount[] }) {
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SkillWithBindCount | null>(
    null,
  );
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteSkill(id, { force: true });
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-medium">个人插件</h1>
        <Button
          variant="secondary"
          className="gap-1.5"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="size-4" /> 上传插件
        </Button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        上传 SKILL.md / .zip 技能包,变成 AI 团队可调用的自定义技能(个人插件)。
      </p>

      {skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
          <Puzzle className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            还没有个人插件,点「上传插件」导入 SKILL.md
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((s) => (
            <div
              key={s.id}
              className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card px-4 py-3"
            >
              <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Puzzle className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{s.name}</span>
                  <span className="flex-none rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {s.type === "plugin" ? "插件" : "自定义"}
                  </span>
                </div>
                {s.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {s.description}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  {s.category} · 绑定 {s.bindCount} 个员工
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="删除插件"
                className="flex-none text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                onClick={() => setDeleteTarget(s)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <SkillImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="删除插件"
        description={`确定删除插件「${deleteTarget?.name ?? ""}」?删除后绑定它的员工将失去该技能。`}
        confirmText="删除"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
