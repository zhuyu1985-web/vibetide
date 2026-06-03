import { db } from "@/db";
import { benchmarkPosts } from "@/db/schema";
import { isTikhubAccountSupported } from "./constants";

export type SyncSourceBinding =
  | { kind: "benchmark"; platform: string; benchmarkAccountId: string }
  | { kind: "my"; platform: string; myAccountId: string };

export interface CollectedItemInput {
  externalId: string;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  sourceUrl?: string | null;
  publishedAt?: Date | null;
  views?: number | null;
  likes?: number | null;
  shares?: number | null;
  comments?: number | null;
  contentFingerprint?: string | null;
  rawMetadata?: unknown;
}

export interface SyncResult {
  skipped: boolean;
  skipReason?: "platform_not_supported";
  processed: number;
  succeeded: number;
  parseFailed: number;
  upserted: number;
  newMyPostIds: string[];
}

function isParseable(item: CollectedItemInput): boolean {
  return typeof item.title === "string" && item.title.trim().length > 0;
}

export async function syncCollectedItems(params: {
  organizationId: string;
  binding: SyncSourceBinding;
  items: CollectedItemInput[];
}): Promise<SyncResult> {
  const { organizationId: _organizationId, binding, items } = params;
  const empty: SyncResult = {
    skipped: false,
    processed: items.length,
    succeeded: 0,
    parseFailed: 0,
    upserted: 0,
    newMyPostIds: [],
  };

  if (!isTikhubAccountSupported(binding.platform)) {
    return { ...empty, skipped: true, skipReason: "platform_not_supported", processed: 0 };
  }

  let succeeded = 0;
  let parseFailed = 0;
  let upserted = 0;
  const newMyPostIds: string[] = [];

  for (const item of items) {
    if (!isParseable(item)) {
      parseFailed++;
      continue;
    }

    try {
      if (binding.kind === "benchmark") {
        await db
          .insert(benchmarkPosts)
          .values({
            benchmarkAccountId: binding.benchmarkAccountId,
            title: item.title!,
            summary: item.summary ?? null,
            body: item.body ?? null,
            sourceUrl: item.sourceUrl ?? null,
            contentFingerprint: item.contentFingerprint ?? null,
            publishedAt: item.publishedAt ?? null,
            views: item.views ?? 0,
            likes: item.likes ?? 0,
            shares: item.shares ?? 0,
            comments: item.comments ?? 0,
            rawMetadata: item.rawMetadata ?? null,
          })
          .onConflictDoUpdate({
            target: [benchmarkPosts.benchmarkAccountId, benchmarkPosts.sourceUrl],
            set: {
              views: item.views ?? 0,
              likes: item.likes ?? 0,
              shares: item.shares ?? 0,
              comments: item.comments ?? 0,
              rawMetadata: item.rawMetadata ?? null,
            },
          });
        upserted++;
        succeeded++;
      } else {
        // my 分支留给 Task 1.5
        throw new Error("my-binding not implemented yet");
      }
    } catch (err) {
      console.error("[sync-collected] upsert failed:", { externalId: item.externalId, err });
      parseFailed++;
    }
  }

  return {
    skipped: false,
    processed: items.length,
    succeeded,
    parseFailed,
    upserted,
    newMyPostIds,
  };
}
