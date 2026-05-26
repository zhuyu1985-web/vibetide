import type { ArticleDetail } from "@/lib/types";

export type AnnotationColor = "red" | "yellow" | "green" | "blue" | "purple";

export interface Annotation {
  id: string;
  articleId: string;
  quote: string;
  note?: string;
  color: AnnotationColor;
  position: number;
  timecode?: number;
  frameSnapshot?: string;
  isPinned: boolean;
  pinnedPosition?: { x: number; y: number } | null;
  createdAt: string;
  updatedAt: string;
}

export type AIAnalysisPerspective = "summary" | "journalist" | "quotes" | "timeline" | "qa" | "deep";
export type AISentiment = "neutral" | "bullish" | "critical" | "advertorial";

export interface AIAnalysisCacheItem {
  id: string;
  articleId: string;
  perspective: AIAnalysisPerspective;
  analysisText: string;
  sentiment?: AISentiment;
  metadata?: Record<string, unknown>;
  generatedAt: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  speakerLabel?: string;
  startTime: number;
  endTime: number;
  text: string;
  correctedText?: string;
}

export interface VideoChapter {
  title: string;
  startTime: number;
  endTime: number;
}

export interface ExternalPublicationView {
  platform: string;
  status: string;
  platformPostUrl?: string | null;
}

export interface ArticleDetailClientProps {
  article: ArticleDetail;
  organizationId: string;
  initialAnnotations: Annotation[];
  initialAIAnalysis: AIAnalysisCacheItem[];
  /** 文章语种（zh / en），决定是否展示「发布到外站」面板。 */
  articleLanguage: string;
  /** 该文章已有的外站发布记录（按 submittedAt desc）。 */
  externalPublications: ExternalPublicationView[];
}

export type ViewMode = "read" | "edit";
export type ContentType = "article" | "video";
// preview: 稿件预览（默认）—— 中央显示正文，保留左右侧栏
// immersive: 沉浸阅读 —— 全屏遮罩，只显示正文
// translate: 翻译 —— 全屏遮罩，左右双栏（原文 / 译文）
// web / brief / archive: 原始网页 / AI 速览 / 网页存档
export type ActiveView =
  | "preview"
  | "immersive"
  | "web"
  | "brief"
  | "translate"
  | "archive";
export type LeftTab = "outline" | "chat" | "history" | "library" | "aigc";
export type RightTab = "analysis" | "annotations" | "transcript" | "info" | "channels";

// 80px outer icon nav 的 3 个分类（按用户原始需求严格 3 项）
export type LeftCategory =
  | "ai"          // AI 助手（与 AI 对话）
  | "library"     // 资源库（素材选择）
  | "apps";       // AIGC 应用（文生图等工具）

// 右侧 80px outer nav：'info' 显示基本信息表单，'channel' 显示某 platform 的渠道改写
export type RightCategory = "info" | "channel";

export interface AppearanceSettings {
  fontSize: number;
  lineHeight: "compact" | "comfortable" | "loose";
  margins: "narrow" | "standard" | "wide";
  theme: "light" | "dark" | "sepia" | "system";
  fontFamily: "system" | "serif" | "sans" | "mono";
}
