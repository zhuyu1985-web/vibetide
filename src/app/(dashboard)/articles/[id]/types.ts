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

export interface ArticleDetailClientProps {
  article: ArticleDetail;
  initialAnnotations: Annotation[];
  initialAIAnalysis: AIAnalysisCacheItem[];
}

export type ViewMode = "read" | "edit";
export type ContentType = "article" | "video";
export type ActiveView = "immersive" | "web" | "brief" | "archive";
export type LeftTab = "outline" | "chat" | "history";
export type RightTab = "analysis" | "annotations" | "transcript";

export interface AppearanceSettings {
  fontSize: number;
  lineHeight: "compact" | "comfortable" | "loose";
  margins: "narrow" | "standard" | "wide";
  theme: "light" | "dark" | "sepia" | "system";
  fontFamily: "system" | "serif" | "sans" | "mono";
}
