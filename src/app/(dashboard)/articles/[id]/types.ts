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
export type ActiveView = "immersive" | "web" | "brief" | "archive";
export type LeftTab = "outline" | "chat" | "history" | "library" | "aigc";
export type RightTab = "analysis" | "annotations" | "transcript" | "info" | "channels";

export interface AppearanceSettings {
  fontSize: number;
  lineHeight: "compact" | "comfortable" | "loose";
  margins: "narrow" | "standard" | "wide";
  theme: "light" | "dark" | "sepia" | "system";
  fontFamily: "system" | "serif" | "sans" | "mono";
}
