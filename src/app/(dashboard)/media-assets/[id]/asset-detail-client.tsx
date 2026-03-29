"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Share2, Download, Heart, MoreHorizontal,
  Video, Image as ImageIcon, Headphones, FileText, FileEdit,
  Save, Tag, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/shared/glass-card";
import { updateCatalog, updateAsset } from "@/app/actions/assets";
import type { AssetDetailFull } from "@/lib/types";

const typeIcons: Record<string, { icon: typeof Video; color: string; bg: string }> = {
  video: { icon: Video, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
  image: { icon: ImageIcon, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
  audio: { icon: Headphones, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/20" },
  document: { icon: FileText, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
  manuscript: { icon: FileEdit, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-900/20" },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  not_submitted: { label: "未提审", color: "text-gray-400" },
  pending: { label: "待审核", color: "text-amber-500" },
  reviewing: { label: "审核中", color: "text-blue-500" },
  approved: { label: "已通过", color: "text-green-500" },
  rejected: { label: "已打回", color: "text-red-500" },
};

type TabKey = "catalog" | "mediaProps" | "basicInfo";

const tabs: { key: TabKey; label: string }[] = [
  { key: "catalog", label: "编目" },
  { key: "mediaProps", label: "媒体属性" },
  { key: "basicInfo", label: "基本信息" },
];

interface Props {
  asset: AssetDetailFull;
}

export default function AssetDetailClient({ asset }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("catalog");
  const tc = typeIcons[asset.type] || typeIcons.document;
  const Icon = tc.icon;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Back nav */}
      <Link
        href="/media-assets"
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
      >
        <ArrowLeft size={14} />
        返回资源库
      </Link>

      <div className="flex gap-6">
        {/* Left: Preview area (55%) */}
        <div className="w-[55%] shrink-0">
          <GlassCard padding="none" className="overflow-hidden">
            {/* Preview */}
            <div className={cn("aspect-video flex items-center justify-center", tc.bg)}>
              {asset.type === "video" && asset.fileUrl ? (
                <video
                  src={asset.fileUrl}
                  controls
                  className="w-full h-full object-contain bg-black"
                  poster={asset.thumbnailUrl}
                />
              ) : asset.type === "audio" && asset.fileUrl ? (
                <div className="flex flex-col items-center gap-4 p-8">
                  <Icon size={48} className={tc.color} />
                  <audio src={asset.fileUrl} controls className="w-full max-w-md" />
                </div>
              ) : asset.type === "image" && (asset.thumbnailUrl || asset.fileUrl) ? (
                <img
                  src={asset.thumbnailUrl || asset.fileUrl}
                  alt={asset.title}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <Icon size={64} className={tc.color} />
              )}
            </div>
          </GlassCard>

          {/* Title + actions */}
          <div className="flex items-center justify-between mt-4">
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 truncate">
              {asset.title}
            </h1>
            <div className="flex items-center gap-1 shrink-0">
              <ActionBtn icon={Share2} label="分享" />
              <ActionBtn icon={Download} label="下载" />
              <ActionBtn icon={Heart} label="收藏" />
              <ActionBtn icon={MoreHorizontal} label="更多" />
            </div>
          </div>
        </div>

        {/* Right: Info tabs (45%) */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 bg-gray-100/60 dark:bg-white/5 rounded-lg p-0.5 mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-md text-[13px] transition-colors text-center",
                  activeTab === tab.key
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium"
                    : "text-gray-500 dark:text-gray-400"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <GlassCard padding="md" className="min-h-[400px]">
            {activeTab === "catalog" && <CatalogTab asset={asset} />}
            {activeTab === "mediaProps" && <MediaPropsTab asset={asset} />}
            {activeTab === "basicInfo" && <BasicInfoTab asset={asset} />}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

// --- Action button ---
function ActionBtn({ icon: Icon, label }: { icon: typeof Share2; label: string }) {
  return (
    <button
      className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
      title={label}
    >
      <Icon size={16} />
    </button>
  );
}

// --- Catalog Tab ---
function CatalogTab({ asset }: { asset: AssetDetailFull }) {
  const router = useRouter();
  const [title, setTitle] = useState(asset.title);
  const [description, setDescription] = useState(asset.description || "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(asset.tags);
  const [saving, setSaving] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const save = async () => {
    setSaving(true);
    await updateAsset(asset.id, { title, description, tags });
    await updateCatalog(asset.id, { title, description });
    setSaving(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          "text-[12px] px-2 py-0.5 rounded",
          asset.catalogStatus === "cataloged"
            ? "bg-green-100 dark:bg-green-900/30 text-green-600"
            : "bg-gray-100 dark:bg-gray-800 text-gray-500"
        )}>
          {asset.catalogStatus === "cataloged" ? "已编目" : "未编目"}
        </span>
      </div>

      <Field label="标题">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-8 px-3 rounded-lg bg-gray-50 dark:bg-white/5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </Field>

      <Field label="关键词/标签">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-[12px] text-blue-600 dark:text-blue-400">
              <Tag size={10} />
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="输入标签后回车"
            className="flex-1 h-7 px-3 rounded-lg bg-gray-50 dark:bg-white/5 text-[12px] outline-none"
          />
        </div>
      </Field>

      <Field label="描述">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 text-[13px] outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
        />
      </Field>

      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="h-8 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
        >
          <Save size={14} />
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

// --- Media Properties Tab ---
function MediaPropsTab({ asset }: { asset: AssetDetailFull }) {
  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-3">原始文件</h3>
      <InfoGrid items={[
        { label: "文件名", value: asset.fileName },
        { label: "文件大小", value: asset.fileSizeDisplay },
        { label: "格式", value: asset.mimeType },
        ...(asset.width ? [{ label: "分辨率", value: `${asset.width} × ${asset.height}` }] : []),
        ...(asset.duration ? [{ label: "时长", value: asset.duration }] : []),
        ...(asset.durationSeconds ? [{ label: "时长(秒)", value: `${asset.durationSeconds}s` }] : []),
      ]} />
    </div>
  );
}

// --- Basic Info Tab ---
function BasicInfoTab({ asset }: { asset: AssetDetailFull }) {
  const typeLabels: Record<string, string> = {
    video: "视频", image: "图片", audio: "音频", document: "文档", manuscript: "文稿",
  };
  const securityLabels: Record<string, string> = {
    public: "公开", secret: "秘密", private: "不公开", top_secret: "绝密", confidential: "机密",
  };
  const reviewInfo = statusLabels[asset.reviewStatus] || statusLabels.not_submitted;

  return (
    <div className="space-y-4">
      <InfoGrid items={[
        { label: "所属栏目", value: asset.categoryPath || "—" },
        { label: "资源类型", value: typeLabels[asset.type] || asset.type },
        { label: "上传人", value: asset.uploaderName || "—" },
        { label: "创建时间", value: new Date(asset.createdAt).toLocaleString("zh-CN") },
        { label: "文件大小", value: asset.fileSizeDisplay || "—" },
        { label: "密级", value: securityLabels[asset.securityLevel] || asset.securityLevel },
        { label: "版本号", value: `V${asset.versionNumber}` },
        { label: "审核状态", value: reviewInfo.label, color: reviewInfo.color },
        { label: "编目状态", value: asset.catalogStatus === "cataloged" ? "已编目" : "未编目",
          color: asset.catalogStatus === "cataloged" ? "text-green-500" : "text-gray-400" },
        { label: "AI分析", value:
          asset.understandingStatus === "completed" ? "已完成" :
          asset.understandingStatus === "processing" ? "分析中" :
          asset.understandingStatus === "failed" ? "失败" : "未发起",
          color:
            asset.understandingStatus === "completed" ? "text-green-500" :
            asset.understandingStatus === "processing" ? "text-blue-500" :
            asset.understandingStatus === "failed" ? "text-red-500" : "text-gray-400",
        },
        { label: "转码状态", value:
          asset.transcodeStatus === "completed" ? "已完成" :
          asset.transcodeStatus === "processing" ? "转码中" : "未开始" },
      ]} />
    </div>
  );
}

// --- Shared components ---
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function InfoGrid({ items }: { items: { label: string; value?: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-2">
          <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0 w-20">{item.label}</span>
          <span className={cn("text-[13px] text-gray-700 dark:text-gray-300", item.color)}>
            {item.value || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
