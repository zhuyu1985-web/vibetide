import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { collectionSources, collectionRuns, userProfiles } from "@/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { TOPHUB_DEFAULT_NODES, PLATFORM_ALIASES } from "@/lib/trending-api";

export const dynamic = "force-dynamic";

const DEFAULT_INSPIRATION_SOURCE_NAME = "__inspiration_default__";

/**
 * Build the platform list from TOPHUB_DEFAULT_NODES (which honours
 * env-configurable TRENDING_RESPONSE_MAPPING).
 * TOPHUB_DEFAULT_NODES keys are Chinese canonical names (e.g. "微博热搜").
 * We map each to its first English alias (the form the tophub adapter
 * accepts in its config.platforms enum).
 */
function buildDefaultPlatforms(): string[] {
  return Object.keys(TOPHUB_DEFAULT_NODES).map((chineseName) => {
    const aliases = PLATFORM_ALIASES[chineseName];
    return aliases?.[0] ?? chineseName.toLowerCase();
  });
}
const DEFAULT_PLATFORMS = buildDefaultPlatforms();

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST() {
  // Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile?.organizationId) {
    return new Response("No organization found", { status: 400 });
  }

  const orgId = profile.organizationId;

  // Find or create the default inspiration tophub source for this org
  const [existing] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        eq(collectionSources.name, DEFAULT_INSPIRATION_SOURCE_NAME),
        isNull(collectionSources.deletedAt),
      ),
    )
    .limit(1);

  let sourceId: string;
  if (existing) {
    sourceId = existing.id;
  } else {
    const [created] = await db
      .insert(collectionSources)
      .values({
        organizationId: orgId,
        name: DEFAULT_INSPIRATION_SOURCE_NAME,
        sourceType: "tophub",
        config: { platforms: DEFAULT_PLATFORMS },
        targetModules: ["hot_topics"],
        defaultCategory: null,
        defaultTags: ["灵感池"],
        enabled: true,
        createdBy: user.id,
      })
      .returning({ id: collectionSources.id });
    sourceId = created.id;
  }

  // Record the pre-trigger last-run timestamp so we can detect the new run
  const preTriggerSourceRow =
    existing ??
    (await db
      .select()
      .from(collectionSources)
      .where(eq(collectionSources.id, sourceId))
      .limit(1)
      .then((r) => r[0]));
  const preTriggerLastRunAt = preTriggerSourceRow?.lastRunAt ?? null;

  // Dispatch event to the new collection pipeline
  await inngest.send({
    name: "collection/source.run-requested",
    data: {
      sourceId,
      organizationId: orgId,
      trigger: "manual",
    },
  });

  // Stream progress via polling collection_runs
  const total = DEFAULT_PLATFORMS.length;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const enqueue = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(data)));
        } catch {
          // Controller may already be closed
        }
      };

      const maxAttempts = 30; // 30 × 2 s = 60 s max
      let attempts = 0;

      enqueue({
        type: "progress",
        current: 0,
        total,
        platform: "启动中",
      });

      while (attempts++ < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));

        const [latestRun] = await db
          .select()
          .from(collectionRuns)
          .where(eq(collectionRuns.sourceId, sourceId))
          .orderBy(desc(collectionRuns.startedAt))
          .limit(1);

        if (!latestRun) continue;

        // Only act on a run that finished AFTER our pre-trigger timestamp,
        // so we don't mistakenly latch onto a previous completed run.
        const finished = latestRun.finishedAt;
        if (
          finished &&
          (!preTriggerLastRunAt || finished > preTriggerLastRunAt)
        ) {
          if (latestRun.status === "failed") {
            enqueue({
              type: "complete",
              newTopics: 0,
              updatedTopics: 0,
              total: 0,
              error: latestRun.errorSummary ?? "采集失败",
            });
          } else {
            enqueue({
              type: "complete",
              newTopics: latestRun.itemsInserted,
              updatedTopics: latestRun.itemsMerged,
              total: latestRun.itemsAttempted,
            });
          }
          controller.close();
          return;
        }

        // Still running — emit a generic progress tick
        enqueue({
          type: "progress",
          current: Math.min(attempts, total),
          total,
          platform: "处理中",
        });
      }

      // Timeout — close with zeroes so the frontend can reset its state
      enqueue({
        type: "complete",
        newTopics: 0,
        updatedTopics: 0,
        total: 0,
        timeout: true,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
