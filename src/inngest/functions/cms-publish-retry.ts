import { inngest } from "@/inngest/client";
import { publishArticleToCms, type PublishInput } from "@/lib/cms";
import {
  getPublicationById,
  incrementAttempt,
} from "@/lib/dal/cms-publications";

/**
 * 最多重试 3 次；加上首次入库共 4 次尝试。
 */
const MAX_RETRY_COUNT = 3;

/**
 * 每次重试前等待的延迟（ms）：1s → 5s → 30s，指数级 backoff。
 *
 * `pub.attempts` 在首次入库时已为 1，因此第 N 次重试对应 attempts=N（索引 N-1）。
 */
const RETRY_DELAYS_MS = [1000, 5000, 30000] as const;

/**
 * 当 `publishArticleToCms` 因可重试错误（5xx / 网络超时等）失败并将 publication 标记为
 * `retrying` 时，由 `publishArticleToCms` 内部触发 `cms/publication.retry` 事件。
 * 本函数消费该事件，按指数 backoff 延迟后再次发起发布；最多 3 次后仍失败则 publication
 * 会进入终态 `failed`（由 `publishArticleToCms` 在超出次数后自行写入）。
 *
 * 设计文档：docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md §11.5
 */
export const cmsPublishRetry = inngest.createFunction(
  {
    id: "cms-publish-retry",
    name: "[CMS P1] CMS 入库失败重试",
    concurrency: { limit: 10 },
    retries: 0, // 本函数自身管理重试节奏，不依赖 Inngest 自动重试
  },
  { event: "cms/publication.retry" },
  async ({ event, step, logger }) => {
    const { publicationId } = event.data as { publicationId: string };

    const pub = await step.run("load-pub", async () => {
      return await getPublicationById(publicationId);
    });

    if (!pub) {
      logger.warn(`retry: publication ${publicationId} not found`);
      return { skipped: true };
    }

    if (pub.cmsState !== "retrying") {
      logger.info(
        `retry: publication ${publicationId} state=${pub.cmsState}, skipping`,
      );
      return { skipped: true };
    }

    if ((pub.attempts ?? 0) >= MAX_RETRY_COUNT + 1) {
      logger.warn(`retry: publication ${publicationId} exhausted retries`);
      return { exhausted: true };
    }

    const delayIndex = Math.min(
      (pub.attempts ?? 1) - 1,
      RETRY_DELAYS_MS.length - 1,
    );
    const delay = RETRY_DELAYS_MS[delayIndex];
    await step.sleep("retry-delay", `${delay}ms`);

    await step.run("increment-attempt", async () => {
      await incrementAttempt(publicationId);
    });

    return await step.run("republish", async () => {
      try {
        const result = await publishArticleToCms({
          articleId: pub.articleId,
          appChannelSlug: pub.appChannelSlug as PublishInput["appChannelSlug"],
          operatorId: pub.operatorId ?? "system",
          triggerSource: "scheduled",
          allowUpdate: true,
        });
        logger.info(
          `retry: publication ${publicationId} re-published, cmsState=${result.cmsState}`,
        );
        return { success: true, cmsState: result.cmsState };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(
          `retry: publication ${publicationId} failed again: ${message}`,
        );
        return { success: false, error: message };
      }
    });
  },
);
