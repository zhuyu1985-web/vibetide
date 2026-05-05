"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import { createOutlet, updateOutlet } from "@/app/actions/media-outlet-dictionary";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

interface Props {
  outlet: MediaOutletRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function OutletEditDialog({ outlet, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    outletName: outlet?.outletName ?? "",
    outletTier: (outlet?.outletTier as OutletTier) ?? "central",
    outletRegion: outlet?.outletRegion ?? "",
    outletDistrict: outlet?.outletDistrict ?? "",
    industryTag: outlet?.industryTag ?? "",
    domains: (outlet?.domains ?? []).join(", "),
    publicAccountNames: (outlet?.publicAccountNames ?? []).join(", "),
    description: outlet?.description ?? "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      const payload = {
        outletName: form.outletName.trim(),
        outletTier: form.outletTier,
        outletRegion: form.outletRegion.trim() || null,
        outletDistrict: form.outletDistrict.trim() || null,
        industryTag: form.industryTag.trim() || null,
        domains: form.domains.split(",").map((s) => s.trim()).filter(Boolean),
        publicAccountNames: form.publicAccountNames.split(",").map((s) => s.trim()).filter(Boolean),
        description: form.description.trim() || null,
      };
      if (outlet) {
        await updateOutlet(outlet.id, payload);
      } else {
        await createOutlet(payload);
      }
      onSaved();
    } catch (e) {
      toast.error(`保存失败：${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const isDistrictTier = form.outletTier === "district_media" || form.outletTier === "government_self_media";
  const isIndustryTier = form.outletTier === "industry";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{outlet ? `编辑 ${outlet.outletName}` : "新增媒体"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm">媒体名 *</label>
            <Input value={form.outletName} onChange={(e) => setForm({ ...form, outletName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">分级 *</label>
            <Select value={form.outletTier} onValueChange={(v) => setForm({ ...form, outletTier: v as OutletTier })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTLET_TIER_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>{OUTLET_TIER_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">区域</label>
            <Input value={form.outletRegion} onChange={(e) => setForm({ ...form, outletRegion: e.target.value })} placeholder="重庆 / 全国 / 江苏" />
          </div>
          {isDistrictTier && (
            <div>
              <label className="text-sm">区县</label>
              <Input value={form.outletDistrict} onChange={(e) => setForm({ ...form, outletDistrict: e.target.value })} placeholder="涪陵区 / 北碚区" />
            </div>
          )}
          {isIndustryTier && (
            <div>
              <label className="text-sm">行业标签</label>
              <Input value={form.industryTag} onChange={(e) => setForm({ ...form, industryTag: e.target.value })} placeholder="环境 / 经济 / 健康" />
            </div>
          )}
          <div>
            <label className="text-sm">域名（逗号分隔）</label>
            <Input value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} placeholder="people.com.cn, paper.people.com.cn" />
          </div>
          <div>
            <label className="text-sm">公众号（逗号分隔）</label>
            <Input value={form.publicAccountNames} onChange={(e) => setForm({ ...form, publicAccountNames: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">描述</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={submitting || !form.outletName.trim()}>
            {submitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
