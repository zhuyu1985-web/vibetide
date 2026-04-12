import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TOPHUB_DEFAULT_NODES } from "@/lib/trending-api";
import {
  crawlSinglePlatform,
  persistCrawledTopics,
} from "@/app/actions/hot-topics";
import { hotTopicCrawlLogs } from "@/db/schema";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

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

  const organizationId = profile.organizationId;
  const platformEntries = Object.entries(TOPHUB_DEFAULT_NODES);
  const total = platformEntries.length;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(data)));
        } catch {
          // Controller may be closed
        }
      };

      try {
        const allItems: Awaited<ReturnType<typeof crawlSinglePlatform>>["items"] = [];
        const crawlLogValues: (typeof hotTopicCrawlLogs.$inferInsert)[] = [];

        for (let i = 0; i < platformEntries.length; i++) {
          const [name, nodeId] = platformEntries[i];

          // Notify start of this platform
          enqueue({ type: "progress", current: i, total, platform: name });

          const result = await crawlSinglePlatform(name);

          if (result.error) {
            crawlLogValues.push({
              organizationId,
              platformName: name,
              platformNodeId: nodeId,
              status: "error",
              topicsFound: 0,
              errorMessage: result.error,
            });
          } else {
            allItems.push(...result.items);
            crawlLogValues.push({
              organizationId,
              platformName: name,
              platformNodeId: nodeId,
              status: "success",
              topicsFound: result.items.length,
            });
          }

          // Notify completion of this platform
          enqueue({
            type: "progress",
            current: i + 1,
            total,
            platform: name,
            itemsFound: result.items.length,
            error: result.error,
          });
        }

        // Persist all collected topics
        const { newTopics, updatedTopics } = await persistCrawledTopics(
          organizationId,
          allItems,
          crawlLogValues
        );

        revalidatePath("/inspiration");

        enqueue({
          type: "complete",
          newTopics,
          updatedTopics,
          total,
        });
      } catch (err) {
        enqueue({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
