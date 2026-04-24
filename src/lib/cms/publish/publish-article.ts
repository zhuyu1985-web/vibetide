import { CmsClient } from "../client";
import { saveArticle } from "../api-endpoints";
import {
  mapArticleToCms,
  loadMapperContext,
  type ArticleForMapping,
  type MapperContext,
} from "../article-mapper";
import { determineType } from "../article-mapper/determine-type";
import {
  CmsConfigError,
  CmsError,
  classifyCmsError,
  isRetriableCmsError,
} from "../errors";
import { isCmsPublishEnabled, requireCmsConfig } from "../feature-flags";
import { hashRequestPayload } from "./request-hash";

import { getArticleById } from "@/lib/dal/articles";
import { getOrganizationById } from "@/lib/dal/organizations";
import {
  createPublication,
  updateToSubmitted,
  markAsFailed,
  findLatestSuccessByArticle,
} from "@/lib/dal/cms-publications";
import { insertWorkflowArtifact } from "@/lib/dal/workflow-artifacts";

/**
 * 通知任务中心 —— 若 article 关联了 mission，写 workflow_artifacts 供 UI 可视化。
 *
 * 同时（若 SSE 通道已建立）推 `cms_publication_completed` 事件。
 * SSE 不可用时只写 artifact 不抛错（降级策略）。
 */
async function notifyMissionChannelSafely(params: {
  missionId: string | null | undefined;
  publicationId: string;
  cmsArticleId: string;
  title: string;
  previewUrl?: string;
  publishedUrl?: string;
  producerEmployeeId: string;
}): Promise<void> {
  if (!params.missionId) return;

  // 1. 落 workflow_artifacts（§11.3 extended artifactTypeEnum 已加 cms_publication）
  await insertWorkflowArtifact({
    missionId: params.missionId,
    artifactType: "cms_publication",
    title: `CMS 入库：${params.title}`,
    content: {
      publicationId: params.publicationId,
      cmsArticleId: params.cmsArticleId,
      previewUrl: params.previewUrl,
      publishedUrl: params.publishedUrl,
    },
    producerEmployeeId: params.producerEmployeeId,
  });

  // 2. SSE 推送（降级友好：失败不抛）
  //
  // `@/lib/mission/sse` 是可选模块 —— 在 Phase 1 尚未实现。用动态 import 表达式
  // 绕过 TS 静态解析，运行时失败会被 catch 吞掉（只在 dev 打 debug 日志）。
  try {
    const specifier = "@/lib/mission/sse";
    const dynImport = new Function(
      "s",
      "return import(s)",
    ) as (s: string) => Promise<unknown>;
    const mod = (await dynImport(specifier)) as {
      notifyMissionChannel?: (
        missionId: string,
        payload: Record<string, unknown>,
      ) => Promise<void> | void;
    };
    if (typeof mod.notifyMissionChannel === "function") {
      await mod.notifyMissionChannel(params.missionId, {
        type: "cms_publication_completed",
        publicationId: params.publicationId,
        cmsArticleId: params.cmsArticleId,
        previewUrl: params.previewUrl,
      });
    }
  } catch (err) {
    // SSE 模块可选；未启用时静默降级
    if (process.env.NODE_ENV !== "production") {
      console.debug(
        "[cms] SSE notify skipped:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export interface PublishInput {
  articleId: string;
  operatorId: string;
  triggerSource: "manual" | "workflow" | "scheduled" | "daily_plan";
  /** 是否允许覆盖 CMS 已有稿件（默认 true，走 CMS MODIFY） */
  allowUpdate?: boolean;
}

export interface PublishResult {
  success: boolean;
  publicationId: string;
  cmsArticleId?: string;
  cmsState: "submitting" | "submitted" | "synced" | "rejected_by_cms" | "failed";
  previewUrl?: string;
  publishedUrl?: string;
  error?: {
    code: string;
    message: string;
    stage: "mapping" | "auth" | "network" | "cms_business" | "polling" | "config";
    retriable: boolean;
  };
  timings: {
    totalMs: number;
    mappingMs: number;
    httpMs: number;
  };
}

/**
 * Phase 1 核心入口：把一篇已审稿件入库到 CMS。
 *
 * 9-step 流程（skill MD `cms_publish.md` §Workflow Checklist）：
 *   1. Feature flag 检查
 *   2. 加载 article + organization
 *   3. 审核状态校验
 *   4. 加载 MapperContext
 *   5. 幂等检查（findLatestSuccessByArticle）
 *   6. 映射 → CmsArticleSaveDTO
 *   7. 落 cms_publications (submitting)
 *   8. 调 saveArticle
 *   9. 更新 submitted + 触发轮询事件（Task 35 实现）
 */
export async function publishArticleToCms(
  input: PublishInput,
): Promise<PublishResult> {
  const t0 = performance.now();

  // 1. Feature flag
  if (!isCmsPublishEnabled()) {
    throw new CmsConfigError(
      "CMS 发布已被 feature flag 禁用（VIBETIDE_CMS_PUBLISH_ENABLED=true 启用）",
    );
  }

  // 2. 加载 article + organization
  const article = await getArticleById(input.articleId);
  if (!article) {
    throw new CmsConfigError(`article not found: ${input.articleId}`);
  }

  // 3. 状态校验（articleStatusEnum: draft/reviewing/approved/published/archived）
  if (!["approved", "publishing", "published"].includes(article.publishStatus)) {
    throw new CmsConfigError(
      `article ${article.id} status=${article.publishStatus}, 不允许发布（需 approved/publishing/published）`,
    );
  }

  const org = await getOrganizationById(article.organizationId);
  if (!org) {
    throw new CmsConfigError(
      `organization not found: ${article.organizationId}`,
    );
  }

  // 5. 幂等检查（先于 mapper 执行，避免重复映射）
  const existing = await findLatestSuccessByArticle(input.articleId);
  const allowUpdate = input.allowUpdate ?? true;

  if (existing && !allowUpdate) {
    return {
      success: true,
      publicationId: existing.id,
      cmsArticleId: existing.cmsArticleId ?? undefined,
      cmsState: existing.cmsState as PublishResult["cmsState"],
      publishedUrl: existing.publishedUrl ?? undefined,
      previewUrl: existing.previewUrl ?? undefined,
      timings: { totalMs: performance.now() - t0, mappingMs: 0, httpMs: 0 },
    };
  }

  // 4. MapperContext（硬编码推送目标：siteId/appId/catalogId，见 article-mapper/index.ts）
  const ctx: MapperContext = loadMapperContext({
    brandName: org.brandName ?? "智媒编辑部",
  });

  // 6. 映射
  const mappingStart = performance.now();
  const asMapping: ArticleForMapping = {
    id: article.id,
    title: article.title,
    authorName: article.authorName,
    summary: article.summary,
    shortTitle: article.shortTitle,
    tags: article.tags,
    coverImageUrl: article.coverImageUrl,
    // mapper 的 publishStatus 值域比 DB 窄；这里接受字符串并由 mapper 兜底转换。
    publishStatus:
      article.publishStatus as ArticleForMapping["publishStatus"],
    publishedAt: article.publishedAt,
    body: article.body,
    externalUrl: article.externalUrl,
    galleryImages: article.galleryImages,
    videoId: article.videoId,
    audioId: article.audioId,
    mediaType: article.mediaType,
  };
  const cmsType = Number(determineType(asMapping));
  const dto = await mapArticleToCms(asMapping, ctx);

  if (existing && existing.cmsArticleId && allowUpdate) {
    // 触发 CMS MODIFY 路径：附加 articleId 让 CMS 识别为修改
    (dto as unknown as { articleId?: number }).articleId = Number(
      existing.cmsArticleId,
    );
  }
  const mappingMs = performance.now() - mappingStart;

  // 7. 落库（requestHash 忽略易变字段，便于重试幂等）
  const requestHash = hashRequestPayload(dto);
  const publicationId = await createPublication({
    organizationId: article.organizationId,
    articleId: input.articleId,
    cmsType,
    requestHash,
    requestPayload: dto,
    operatorId: input.operatorId,
    triggerSource: input.triggerSource,
  });

  // 8. 调 saveArticle
  const config = requireCmsConfig();
  const client = new CmsClient({
    host: config.host,
    loginCmcId: config.loginCmcId,
    loginCmcTid: config.loginCmcTid,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  const httpStart = performance.now();
  try {
    const res = await saveArticle(client, dto);
    const httpMs = performance.now() - httpStart;

    const cmsArticleId = String(res.data?.article.id ?? "");
    const url = res.data?.url ?? "";
    const previewUrl = res.data?.preViewPath;
    const publishedUrl = url ? buildPublishedUrl(url) : undefined;

    // 9.1 更新 submitted
    await updateToSubmitted(publicationId, {
      cmsArticleId,
      cmsCatalogId: String(ctx.catalogId),
      cmsSiteId: ctx.siteId,
      publishedUrl,
      previewUrl,
      responsePayload: res.data,
    });

    // 9.2 通知任务中心（workflow_artifacts + SSE）—— cms_publish.md Workflow Step 9
    await notifyMissionChannelSafely({
      missionId: article.missionId,
      publicationId,
      cmsArticleId,
      title: article.title,
      previewUrl,
      publishedUrl,
      producerEmployeeId: input.operatorId,
    });

    // 9.3 触发轮询（Task 35 的 Inngest 处理）
    await triggerStatusPoll(publicationId, cmsArticleId);

    return {
      success: true,
      publicationId,
      cmsArticleId,
      cmsState: "submitted",
      publishedUrl,
      previewUrl,
      timings: { totalMs: performance.now() - t0, mappingMs, httpMs },
    };
  } catch (err) {
    const stage = classifyCmsError(err);
    const message = err instanceof Error ? err.message : String(err);
    const retriable = isRetriableCmsError(err);

    await markAsFailed(publicationId, {
      errorCode: stage === "unknown" ? "cms_unknown" : `cms_${stage}`,
      errorMessage: message,
      retriable,
    });

    // 触发重试（Task 36 的 Inngest 处理）
    if (retriable) {
      await triggerPublishRetry(publicationId);
    }

    throw err instanceof CmsError
      ? err
      : new CmsError(`publishArticleToCms failed: ${message}`);
  }
}

/** 由 Task 35 的 cms-status-poll Inngest 函数消费 */
async function triggerStatusPoll(
  publicationId: string,
  cmsArticleId: string,
): Promise<void> {
  // 延迟 import 避免循环依赖
  const { inngest } = await import("@/inngest/client");
  await inngest.send({
    name: "cms/publication.submitted",
    data: { publicationId, cmsArticleId },
  });
}

/** 由 Task 36 的 cms-publish-retry Inngest 函数消费 */
async function triggerPublishRetry(publicationId: string): Promise<void> {
  const { inngest } = await import("@/inngest/client");
  await inngest.send({
    name: "cms/publication.retry",
    data: { publicationId },
  });
}

function buildPublishedUrl(relativePath: string): string {
  const base = process.env.CMS_WEB_BASE ?? "https://web.demo.chinamcloud.cn/cms";
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}
