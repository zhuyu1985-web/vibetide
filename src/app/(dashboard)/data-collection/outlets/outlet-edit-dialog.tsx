"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  OUTLET_TIER_VALUES,
  OUTLET_TIER_LABELS,
  type OutletTier,
} from "@/lib/collection/constants";
import { createOutlet, updateOutlet } from "@/app/actions/media-outlet-dictionary";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import type { Channel } from "@/lib/media-outlet/channels";
import { channelsArraySchema } from "@/lib/media-outlet/channels";
import { ChannelEditor } from "./channel-editor";

interface Props {
  outlet: MediaOutletRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function OutletEditDialog({ outlet, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    outletName: outlet?.outletName ?? "",
    groupName: outlet?.groupName ?? "",
    outletTier: (outlet?.outletTier as OutletTier) ?? "central",
    outletRegion: outlet?.outletRegion ?? "",
    outletDistrict: outlet?.outletDistrict ?? "",
    industryTag: outlet?.industryTag ?? "",
    description: outlet?.description ?? "",
  });
  const [channels, setChannels] = useState<Channel[]>(
    (outlet?.channels ?? []) as Channel[],
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    // 校验 channels(必填字段缺失会被 zod 拦下)
    const parse = channelsArraySchema.safeParse(channels);
    if (!parse.success) {
      const firstErr = parse.error.issues[0];
      toast.error(`平台账号校验失败:${firstErr?.message ?? "请检查必填字段"}`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        outletName: form.outletName.trim(),
        groupName: form.groupName.trim() || null,
        outletTier: form.outletTier,
        outletRegion: form.outletRegion.trim() || null,
        outletDistrict: form.outletDistrict.trim() || null,
        industryTag: form.industryTag.trim() || null,
        channels: parse.data,
        description: form.description.trim() || null,
        // 旧字段保留兼容 — 写入空数组(数据完全靠 channels)
        domains: [],
        publicAccountNames: [],
      };
      if (outlet) {
        await updateOutlet(outlet.id, payload);
      } else {
        await createOutlet(payload);
      }
      onSaved();
    } catch (e) {
      toast.error(`保存失败:${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const isDistrictTier =
    form.outletTier === "district_media" || form.outletTier === "government_self_media";
  const isIndustryTier = form.outletTier === "industry";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[640px] sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{outlet ? `编辑 ${outlet.outletName}` : "新增媒体"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 py-2">
          {/* 基本信息 */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">基本信息</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>媒体名 *</Label>
                <Input
                  value={form.outletName}
                  onChange={(e) => setForm({ ...form, outletName: e.target.value })}
                  placeholder="人民日报"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>集团 / 母公司 (可选)</Label>
                <Input
                  value={form.groupName}
                  onChange={(e) => setForm({ ...form, groupName: e.target.value })}
                  placeholder="人民日报社"
                />
                <p className="text-[11px] text-muted-foreground">
                  同集团多个 outlet (如"人民日报"/"人民网"/"人民视频") 可填同一 groupName 便于聚合
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>分级 *</Label>
                <Select
                  value={form.outletTier}
                  onValueChange={(v) => setForm({ ...form, outletTier: v as OutletTier })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTLET_TIER_VALUES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {OUTLET_TIER_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>区域</Label>
                <Input
                  value={form.outletRegion}
                  onChange={(e) => setForm({ ...form, outletRegion: e.target.value })}
                  placeholder="重庆 / 全国 / 江苏"
                />
              </div>
              {isDistrictTier && (
                <div className="space-y-1.5 col-span-2">
                  <Label>区县</Label>
                  <Input
                    value={form.outletDistrict}
                    onChange={(e) => setForm({ ...form, outletDistrict: e.target.value })}
                    placeholder="涪陵区 / 北碚区"
                  />
                </div>
              )}
              {isIndustryTier && (
                <div className="space-y-1.5 col-span-2">
                  <Label>行业标签</Label>
                  <Input
                    value={form.industryTag}
                    onChange={(e) => setForm({ ...form, industryTag: e.target.value })}
                    placeholder="环境 / 经济 / 健康"
                  />
                </div>
              )}
              <div className="space-y-1.5 col-span-2">
                <Label>描述</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="该媒体的基本介绍(可选)"
                />
              </div>
            </div>
          </section>

          {/* 平台账号 */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">平台账号矩阵</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                同一媒体可在多个平台上有账号;tikhub 采集器在"按账号"模式启动时
                会用对应平台的识别符 (secUid / ghid / uid / userId) 拉取该账号的最新内容。
              </p>
            </div>
            <ChannelEditor value={channels} onChange={setChannels} />
          </section>
        </div>

        <SheetFooter className="flex flex-row gap-2 px-4 pb-4">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            取消
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={submitting || !form.outletName.trim()}
          >
            {submitting ? "保存中..." : "保存"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
