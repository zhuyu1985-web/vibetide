"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassCard } from "@/components/shared/glass-card";
import { confirmCreationPlan } from "@/app/actions/cowork-content-creation";
import {
  type CreationPlan,
  type CreationChannel,
  type CreationGenre,
  CHANNEL_PRESETS,
  GENRE_LABELS,
} from "@/lib/cowork/creation-plan-types";

const WORD_OPTIONS = [600, 1000, 1500, 2000];

export function CreationPlanForm({
  conversationId,
  plan: initial,
}: {
  conversationId: string;
  plan: CreationPlan;
}) {
  // 仅以 initial 作为初值播种一次：plan_card 消息一旦落库即不可变，且在消息流里按
  // 消息 id 作 key（见 conversation-thread），故本卡不会收到变化后的 plan prop，
  // 后续编辑都在本地 state 内进行，seeding-once 安全。
  const [plan, setPlan] = useState<CreationPlan>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof CreationPlan>(k: K, v: CreationPlan[K]) =>
    setPlan((p) => ({ ...p, [k]: v }));

  const onConfirm = async () => {
    setSubmitting(true);
    setError(null);
    const res = await confirmCreationPlan(conversationId, plan);
    setSubmitting(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  };

  if (done) {
    return (
      <GlassCard className="max-w-md p-3 text-sm text-muted-foreground">
        ✅ 已开始撰写，稍候出稿…
      </GlassCard>
    );
  }

  return (
    <GlassCard className="max-w-md space-y-3 p-4">
      <div className="text-sm font-medium">📋 创作计划 · 确认后开始撰写</div>

      {/* 选题 */}
      <Field label="选题">
        {plan.topicOptions.length > 0 ? (
          <Select
            value={plan.topic.title}
            onValueChange={(v) => set("topic", { ...plan.topic, title: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选一个热点" />
            </SelectTrigger>
            <SelectContent>
              {plan.topicOptions.map((t, i) => (
                <SelectItem key={`${t.title}-${i}`} value={t.title}>
                  {t.title}
                  {t.heat ? ` · ${t.heat}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={plan.topic.title}
            placeholder="输入你想写的主题"
            onChange={(e) => set("topic", { ...plan.topic, title: e.target.value })}
          />
        )}
      </Field>

      <Field label="角度">
        <Input value={plan.angle} onChange={(e) => set("angle", e.target.value)} />
      </Field>

      <Field label="体裁">
        <ChipRow<CreationGenre>
          value={plan.genre}
          options={Object.keys(GENRE_LABELS) as CreationGenre[]}
          label={(g) => GENRE_LABELS[g]}
          onPick={(g) => set("genre", g)}
        />
      </Field>

      <Field label="渠道">
        <ChipRow<CreationChannel>
          value={plan.channel}
          options={Object.keys(CHANNEL_PRESETS) as CreationChannel[]}
          label={(c) => CHANNEL_PRESETS[c].label}
          onPick={(c) => set("channel", c)}
        />
      </Field>

      <Field label="字数">
        <ChipRow<number>
          value={plan.wordCount}
          options={WORD_OPTIONS}
          label={(n) => String(n)}
          onPick={(n) => set("wordCount", n)}
        />
      </Field>

      <Field label="用途">
        <Input
          value={plan.purpose ?? ""}
          placeholder="选填：给领导审阅 / 对外发布…"
          onChange={(e) => set("purpose", e.target.value)}
        />
      </Field>

      {/* label 用 htmlFor 关联（不包裹 Checkbox），点击文字稳定切换且不会双触发 */}
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          id="cowork-illustrate"
          checked={plan.illustrate}
          onCheckedChange={(c) => set("illustrate", c === true)}
        />
        <label htmlFor="cowork-illustrate">出稿后顺便配一张题图（AIGC）</label>
      </div>

      <div className="flex flex-col gap-2 pt-1">
        {error && <p className="text-xs text-amber-600">{error}</p>}
        <Button
          onClick={onConfirm}
          disabled={submitting || !plan.topic.title.trim()}
          className="self-start"
        >
          {submitting ? "撰写中…" : "✅ 开始撰写"}
        </Button>
      </div>
    </GlassCard>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-12 shrink-0 pt-2 text-xs text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function ChipRow<T extends string | number>({
  value,
  options,
  label,
  onPick,
}: {
  value: T;
  options: T[];
  label: (v: T) => string;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Button
          key={String(o)}
          size="sm"
          variant={o === value ? "secondary" : "ghost"}
          onClick={() => onPick(o)}
        >
          {label(o)}
        </Button>
      ))}
    </div>
  );
}
