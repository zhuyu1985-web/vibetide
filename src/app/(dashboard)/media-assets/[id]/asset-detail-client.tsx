"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Share2, Download, Heart, MoreHorizontal,
  Video, Image as ImageIcon, Headphones, FileText, FileEdit,
  Save, Tag, X, Tags, ScanFace, AudioLines, Subtitles, ChevronRight,
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

type TabKey = "catalog" | "mediaProps" | "basicInfo" | "aiTags" | "aiFaces" | "aiSpeech" | "aiSubtitles";

const baseTabs: { key: TabKey; label: string }[] = [
  { key: "catalog", label: "编目" },
  { key: "mediaProps", label: "媒体属性" },
  { key: "basicInfo", label: "基本信息" },
];

const aiTabs: { key: TabKey; label: string; icon: typeof Tags }[] = [
  { key: "aiTags", label: "标签", icon: Tags },
  { key: "aiFaces", label: "人脸", icon: ScanFace },
  { key: "aiSpeech", label: "语音", icon: AudioLines },
  { key: "aiSubtitles", label: "字幕", icon: Subtitles },
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
          {/* Tab bar — base tabs */}
          <div className="flex items-center gap-0.5 bg-gray-100/60 dark:bg-white/5 rounded-lg p-0.5 mb-2">
            {baseTabs.map((tab) => (
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

          {/* Tab bar — AI info tabs */}
          <div className="flex items-center gap-0.5 bg-gray-100/60 dark:bg-white/5 rounded-lg p-0.5 mb-4">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 px-2 shrink-0">AI</span>
            {aiTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex-1 px-2 py-1.5 rounded-md text-[12px] transition-colors text-center flex items-center justify-center gap-1",
                    activeTab === tab.key
                      ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium"
                      : "text-gray-500 dark:text-gray-400"
                  )}
                >
                  <TabIcon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <GlassCard padding="md" className="min-h-[400px]">
            {activeTab === "catalog" && <CatalogTab asset={asset} />}
            {activeTab === "mediaProps" && <MediaPropsTab asset={asset} />}
            {activeTab === "basicInfo" && <BasicInfoTab asset={asset} />}
            {activeTab === "aiTags" && <AITagsTab asset={asset} />}
            {activeTab === "aiFaces" && <AIFacesTab asset={asset} />}
            {activeTab === "aiSpeech" && <AISpeechTab asset={asset} />}
            {activeTab === "aiSubtitles" && <AISubtitlesTab asset={asset} />}
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
          className="h-8 px-4 rounded-lg bg-sky-300/10 text-blue-900 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(14,165,233,0.08)] ring-1 ring-inset ring-sky-300/25 text-[13px] font-medium hover:bg-sky-300/18 hover:ring-sky-300/40 disabled:opacity-50 flex items-center gap-1.5 transition-all"
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

// --- AI Tags Tab ---
function AITagsTab({ asset }: { asset: AssetDetailFull }) {
  // Aggregate all tags from all segments
  const allTags = (asset.segments || []).flatMap((s) => s.tags);
  // Deduplicate by label
  const tagMap = new Map<string, { label: string; category: string; confidence: number; count: number }>();
  for (const tag of allTags) {
    const existing = tagMap.get(tag.label);
    if (existing) {
      existing.count += 1;
      existing.confidence = Math.max(existing.confidence, tag.confidence);
    } else {
      tagMap.set(tag.label, { label: tag.label, category: tag.category, confidence: tag.confidence, count: 1 });
    }
  }
  const uniqueTags = Array.from(tagMap.values()).sort((a, b) => b.confidence - a.confidence);

  // Also include manual tags
  const manualTags = asset.tags.filter((t) => !tagMap.has(t));

  const categoryLabels: Record<string, string> = {
    topic: "主题", event: "事件", emotion: "情绪", person: "人物",
    location: "地点", shotType: "镜头", quality: "质量", object: "物体", action: "动作",
  };
  const categoryColors: Record<string, string> = {
    topic: "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400",
    event: "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400",
    emotion: "bg-pink-50 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400",
    person: "bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400",
    location: "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400",
    object: "bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400",
    action: "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400",
    shotType: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400",
    quality: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  };

  if (uniqueTags.length === 0 && manualTags.length === 0) {
    return <EmptyState text="暂无AI标签数据" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
        AI识别标签
        <span className="ml-2 text-[11px] text-gray-400 font-normal">{uniqueTags.length} 个</span>
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {uniqueTags.map((tag) => (
          <span
            key={tag.label}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px]",
              categoryColors[tag.category] || "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            )}
          >
            <span className="text-[10px] opacity-70">{categoryLabels[tag.category] || tag.category}</span>
            {tag.label}
            <span className="text-[10px] opacity-50">{Math.round(tag.confidence * 100)}%</span>
          </span>
        ))}
      </div>

      {manualTags.length > 0 && (
        <>
          <h3 className="text-[13px] font-medium text-gray-700 dark:text-gray-300 mt-4">
            手动标签
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {manualTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[12px]"
              >
                <Tag size={10} />
                {tag}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- AI Faces Tab ---
function AIFacesTab({ asset }: { asset: AssetDetailFull }) {
  const allFaces = (asset.segments || []).flatMap((s) => s.detectedFaces);
  // Deduplicate by name
  const faceMap = new Map<string, { name: string; role: string; confidence: number; appearances: number }>();
  for (const face of allFaces) {
    const existing = faceMap.get(face.name);
    if (existing) {
      existing.appearances += face.appearances;
      existing.confidence = Math.max(existing.confidence, face.confidence);
    } else {
      faceMap.set(face.name, { ...face });
    }
  }
  const uniqueFaces = Array.from(faceMap.values()).sort((a, b) => b.appearances - a.appearances);

  if (uniqueFaces.length === 0) {
    return <EmptyState text="暂无人脸识别数据" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
        AI人脸识别
        <span className="ml-2 text-[11px] text-gray-400 font-normal">{uniqueFaces.length} 人</span>
      </h3>
      <div className="space-y-2">
        {uniqueFaces.map((face) => (
          <div
            key={face.name}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.03]"
          >
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <ScanFace size={16} className="text-purple-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate">
                {face.name}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {face.role && <span>{face.role} · </span>}
                出现 {face.appearances} 次 · 置信度 {Math.round(face.confidence * 100)}%
              </p>
            </div>
            <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- AI Speech Tab ---
function AISpeechTab({ asset }: { asset: AssetDetailFull }) {
  const segments = (asset.segments || []).filter((s) => s.transcript);

  if (segments.length === 0) {
    return <EmptyState text="暂无语音转文字数据" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
        语音转文字
        <span className="ml-2 text-[11px] text-gray-400 font-normal">{segments.length} 段</span>
      </h3>
      <div className="space-y-1">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="flex gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors group"
          >
            <span className="text-[11px] tabular-nums text-blue-500 dark:text-blue-400 shrink-0 pt-0.5 w-24">
              {seg.startTime} → {seg.endTime}
            </span>
            <p className="text-[13px] text-gray-700 dark:text-gray-300 flex-1 leading-relaxed">
              {seg.transcript}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- AI Subtitles Tab ---
function AISubtitlesTab({ asset }: { asset: AssetDetailFull }) {
  const segments = (asset.segments || []).filter((s) => s.ocrTexts && s.ocrTexts.length > 0);

  if (segments.length === 0) {
    return <EmptyState text="暂无OCR字幕数据" />;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
        OCR字幕识别
        <span className="ml-2 text-[11px] text-gray-400 font-normal">{segments.length} 段</span>
      </h3>
      <div className="space-y-1">
        {segments.map((seg) => (
          <div
            key={seg.id}
            className="flex gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
          >
            <span className="text-[11px] tabular-nums text-amber-500 dark:text-amber-400 shrink-0 pt-0.5 w-24">
              {seg.startTime} → {seg.endTime}
            </span>
            <div className="flex-1 space-y-0.5">
              {seg.ocrTexts.map((text, i) => (
                <p key={i} className="text-[13px] text-gray-700 dark:text-gray-300 leading-relaxed">
                  {text}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Empty state ---
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
      <Tags size={32} className="mb-2 opacity-50" />
      <p className="text-[13px]">{text}</p>
      <p className="text-[11px] mt-1">资源入库后自动发起AI分析</p>
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
