/** 通义听悟任务状态。 */
export type TingwuTaskStatus = "ONGOING" | "COMPLETED" | "FAILED" | "INVALID";

/** CreateTask 返回。 */
export interface TingwuCreateTaskResult {
  taskId: string;
  taskKey?: string;
  status?: TingwuTaskStatus;
}

/** GetTaskInfo 返回（result 是一组结果文件下载 URL，30 天有效）。 */
export interface TingwuTaskInfo {
  status: TingwuTaskStatus;
  result?: {
    Transcription?: string;
    Summarization?: string;
    AutoChapters?: string;
    [k: string]: string | undefined;
  };
  errorMessage?: string;
}

/** 转写结果 JSON（从 Result.Transcription URL 下载）。词级时间戳(ms)，句子靠 SentenceId 聚合。 */
export interface TingwuTranscriptionJson {
  Transcription?: {
    Paragraphs?: Array<{
      ParagraphId?: string | number;
      SpeakerId?: string | number;
      Words?: Array<{
        Text?: string;
        Start?: number;
        End?: number;
        SentenceId?: number;
      }>;
    }>;
  };
}

/** 归一后的转写分段（写入 asset_segments；assetId 由调用方补）。 */
export interface ParsedSegment {
  transcript: string;
  startTimeSeconds?: number;
  endTimeSeconds?: number;
  segmentOrder: number;
}

/** 归一后的章节（写入 articles.chapters）。 */
export interface ParsedChapter {
  title: string;
  startTimeSeconds?: number;
  summary?: string;
}
