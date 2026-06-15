import type { MissionArtifact } from "@/lib/types";

export const ARTIFACT_INLINE_TEXT_LIMIT = 280;

export type ArtifactPreviewKind =
  | "short_text"
  | "draft"
  | "image"
  | "video"
  | "document"
  | "markdown"
  | "data"
  | "unknown";

export type ArtifactPreviewSource =
  | "task_output"
  | "final_output"
  | "mission_artifact";

export interface ArtifactPreviewItem {
  id: string;
  missionId: string;
  taskId: string | null;
  title: string;
  kind: ArtifactPreviewKind;
  source: ArtifactPreviewSource;
  content: string;
  fileUrl: string | null;
  mimeType: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
  version: number | null;
  editable: boolean;
  edited: boolean;
}

interface RawArtifactLike {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  content?: unknown;
  fileUrl?: unknown;
  file_url?: unknown;
  mimeType?: unknown;
  mime_type?: unknown;
  metadata?: unknown;
  version?: unknown;
  createdAt?: unknown;
  created_at?: unknown;
}

interface NormalizableTask {
  id: string;
  missionId?: string;
  title: string;
  priority?: number | null;
  outputData?: unknown;
  createdAt?: string | null;
  completedAt?: string | null;
}

export interface NormalizeArtifactSourcesInput {
  missionId: string;
  tasks: NormalizableTask[];
  finalOutput: unknown;
  persistedArtifacts: MissionArtifact[];
}

const IMAGE_EXT_RE = /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i;
const VIDEO_EXT_RE = /\.(m4v|mov|mp4|ogg|webm)(\?|#|$)/i;
const DOCUMENT_EXT_RE = /\.(csv|docx?|md|pdf|pptx?|rtf|txt|xlsx?)(\?|#|$)/i;

export function inferArtifactKind(input: {
  type?: unknown;
  content?: unknown;
  fileUrl?: unknown;
  metadata?: unknown;
}): ArtifactPreviewKind {
  const type = asString(input.type).toLowerCase();
  const content = asString(input.content);
  const fileUrl = asString(input.fileUrl).toLowerCase();
  const metadata = asRecord(input.metadata);
  const mimeType = asString(metadata.mimeType ?? metadata.mime_type).toLowerCase();

  if (type.includes("image") || mimeType.startsWith("image/") || IMAGE_EXT_RE.test(fileUrl)) {
    return "image";
  }
  if (type.includes("video") || mimeType.startsWith("video/") || VIDEO_EXT_RE.test(fileUrl)) {
    return "video";
  }
  if (
    type.includes("document") ||
    type.includes("file") ||
    mimeType === "application/pdf" ||
    mimeType.includes("word") ||
    mimeType.includes("spreadsheet") ||
    DOCUMENT_EXT_RE.test(fileUrl)
  ) {
    return "document";
  }
  if (
    type.includes("article") ||
    type.includes("draft") ||
    type.includes("稿件") ||
    type.includes("report")
  ) {
    return "draft";
  }
  if (type.includes("table") || type.includes("chart") || type.includes("json")) {
    return "data";
  }
  if (type.includes("markdown") || content.includes("\n#") || content.startsWith("#")) {
    return content.length <= ARTIFACT_INLINE_TEXT_LIMIT ? "short_text" : "markdown";
  }
  if (content.trim()) {
    return content.length <= ARTIFACT_INLINE_TEXT_LIMIT ? "short_text" : "draft";
  }
  return "unknown";
}

export function normalizeArtifactSources({
  missionId,
  tasks,
  finalOutput,
  persistedArtifacts,
}: NormalizeArtifactSourcesInput): ArtifactPreviewItem[] {
  const items: ArtifactPreviewItem[] = [];
  const fingerprintToIndex = new Map<string, number>();

  function add(item: ArtifactPreviewItem) {
    const fingerprint = artifactFingerprint(item);
    const existingIndex = fingerprintToIndex.get(fingerprint);
    if (existingIndex == null) {
      fingerprintToIndex.set(fingerprint, items.length);
      items.push(item);
      return;
    }
    const existing = items[existingIndex];
    if (sourceRank(item.source) > sourceRank(existing.source)) {
      items[existingIndex] = item;
    }
  }

  const sortedTasks = [...tasks].sort(
    (a, b) =>
      (a.priority ?? 0) - (b.priority ?? 0) ||
      timeOf(a.completedAt ?? a.createdAt) - timeOf(b.completedAt ?? b.createdAt),
  );

  for (const task of sortedTasks) {
    const artifacts = readArtifacts(task.outputData);
    artifacts.forEach((artifact, index) => {
      add(
        normalizeRawArtifact({
          missionId,
          taskId: task.id,
          fallbackTitle: artifactTitle(artifact, task.title),
          artifact,
          source: "task_output",
          index,
          createdAt: task.completedAt ?? task.createdAt ?? null,
        }),
      );
    });
  }

  readArtifacts(finalOutput).forEach((artifact, index) => {
    add(
      normalizeRawArtifact({
        missionId,
        taskId: null,
        fallbackTitle: artifactTitle(artifact, "交付结果"),
        artifact,
        source: "final_output",
        index,
        createdAt: null,
      }),
    );
  });

  [...persistedArtifacts]
    .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt))
    .forEach((artifact, index) => {
      add(
        normalizeRawArtifact({
          missionId,
          taskId: artifact.taskId,
          fallbackTitle: artifact.title,
          artifact,
          source: "mission_artifact",
          index,
          createdAt: artifact.createdAt,
        }),
      );
    });

  return items;
}

function normalizeRawArtifact({
  missionId,
  taskId,
  fallbackTitle,
  artifact,
  source,
  index,
  createdAt,
}: {
  missionId: string;
  taskId: string | null;
  fallbackTitle: string;
  artifact: RawArtifactLike | MissionArtifact;
  source: ArtifactPreviewSource;
  index: number;
  createdAt: string | null;
}): ArtifactPreviewItem {
  const rawArtifact = artifact as RawArtifactLike;
  const fileUrl = asString(rawArtifact.fileUrl ?? rawArtifact.file_url) || null;
  const metadata = asRecord(rawArtifact.metadata);
  const mimeType =
    asString(rawArtifact.mimeType ?? rawArtifact.mime_type ?? metadata.mimeType ?? metadata.mime_type) ||
    null;
  const content = stringifyContent(rawArtifact.content);
  const type = asString(rawArtifact.type);
  const kind = inferArtifactKind({ type, content, fileUrl, metadata });
  const id =
    asString(rawArtifact.id) ||
    `${source}:${taskId ?? "final"}:${index}:${slugify(fallbackTitle)}`;
  const version = typeof rawArtifact.version === "number" ? rawArtifact.version : null;
  const edited = metadata.edited === true || metadata.editedAt != null;

  return {
    id,
    missionId,
    taskId,
    title: fallbackTitle,
    kind,
    source,
    content,
    fileUrl,
    mimeType,
    metadata,
    createdAt: asString(rawArtifact.createdAt ?? rawArtifact.created_at) || createdAt,
    version,
    editable: source === "mission_artifact" && kind === "draft",
    edited,
  };
}

function readArtifacts(raw: unknown): RawArtifactLike[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const artifacts = (raw as { artifacts?: unknown }).artifacts;
  if (!Array.isArray(artifacts)) return [];
  return artifacts.filter(
    (artifact): artifact is RawArtifactLike =>
      artifact != null && typeof artifact === "object" && !Array.isArray(artifact),
  );
}

function artifactTitle(artifact: RawArtifactLike, fallback: string): string {
  const title = asString(artifact.title);
  return title || fallback || "未命名产物";
}

function artifactFingerprint(item: ArtifactPreviewItem): string {
  return [
    item.taskId ?? "final",
    item.title.trim().toLowerCase(),
    item.kind,
    item.fileUrl ?? "",
    item.content.slice(0, 160),
  ].join("|");
}

function sourceRank(source: ArtifactPreviewSource): number {
  if (source === "mission_artifact") return 3;
  if (source === "final_output") return 2;
  return 1;
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value, null, 2);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function timeOf(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
