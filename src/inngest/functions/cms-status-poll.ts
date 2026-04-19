import { inngest } from "@/inngest/client";
import {
  CmsClient,
  requireCmsConfig,
  getArticleDetail,
  mapCmsStatusToPublicationState,
  classifyCmsError,
} from "@/lib/cms";
import {
  getPublicationById,
  markAsSynced,
  markAsRejectedByCms,
} from "@/lib/dal/cms-publications";

/**
 * 每次轮询等待时间（ms）：5s → 10s → 20s → 40s → 120s（总 ~3.5 分钟）。
 *
 * 超过 5 次仍为 submitted 终态不强制，保持 submitted 让运营/自动流程继续发现。
 */
const POLL_DELAYS_MS = [5000, 10000, 20000, 40000, 120000] as const;

/**
 * 入库后，CMS 可能需要人工审核或工作流流转。
 * VibeTide 轮询 `getMyArticleDetail` 直到 status 变为 "30"（synced）或 "60"（rejected）。
 * 最多 5 次，间隔 5s/10s/20s/40s/120s。
 *
 * 设计文档：docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md §11.5
 */
export const cmsStatusPoll = inngest.createFunction(
  {
    id: "cms-status-poll",
    name: "[CMS P1] CMS 入库状态轮询",
    concurrency: { limit: 20 },
    retries: 2,
  },
  { event: "cms/publication.submitted" },
  async ({ event, step, logger }) => {
    const { publicationId, cmsArticleId } = event.data as {
      publicationId: string;
      cmsArticleId: string;
    };

    const config = requireCmsConfig();
    const client = new CmsClient({
      host: config.host,
      loginCmcId: config.loginCmcId,
      loginCmcTid: config.loginCmcTid,
      timeoutMs: config.timeoutMs,
      maxRetries: 1, // 轮询本身有 5 次重试，单次 fetch 不多次
    });

    for (let attempt = 0; attempt < POLL_DELAYS_MS.length; attempt++) {
      await step.sleep(`wait-${attempt + 1}`, `${POLL_DELAYS_MS[attempt]}ms`);

      const terminal = await step.run(`poll-${attempt + 1}`, async () => {
        // 检查 publication 是否已被其他流程改为终态
        const pub = await getPublicationById(publicationId);
        if (!pub) {
          logger.warn(`publication ${publicationId} disappeared`);
          return true;
        }
        if (["synced", "rejected_by_cms", "failed"].includes(pub.cmsState)) {
          return true;
        }

        try {
          const res = await getArticleDetail(client, cmsArticleId);
          const cmsStatus = res.data?.status;
          const nextState = mapCmsStatusToPublicationState(cmsStatus);

          if (nextState === "synced") {
            await markAsSynced(publicationId);
            logger.info(`publication ${publicationId} → synced (CMS status=30)`);
            return true;
          }
          if (nextState === "rejected_by_cms") {
            await markAsRejectedByCms(publicationId);
            logger.warn(
              `publication ${publicationId} → rejected_by_cms (CMS status=60)`,
            );
            return true;
          }
          // submitted / 未知：继续下一次轮询
          return false;
        } catch (err) {
          const stage = classifyCmsError(err);
          logger.warn(
            `poll attempt ${attempt + 1} failed (stage=${stage}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          // 轮询错误不视为终态；重试下一轮
          return false;
        }
      });

      if (terminal) {
        return { publicationId, attempts: attempt + 1, terminal: true };
      }
    }

    // 5 次后仍未终态 —— 保持 submitted，任务中心显示"待 CMS 人工发布"
    logger.info(
      `publication ${publicationId} still submitted after ${POLL_DELAYS_MS.length} polls; left as-is`,
    );
    return {
      publicationId,
      attempts: POLL_DELAYS_MS.length,
      terminal: false,
    };
  },
);
