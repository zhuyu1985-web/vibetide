// src/inngest/functions/account-analytics/annotate-account-posts.ts
//
// 注意：项目国内部署，使用自建 DeepSeek 接口（OPENAI_API_BASE_URL 指向 deepseek.com），
// 不走 Vercel AI Gateway。LLM 调用统一通过 src/lib/agent/model-router 封装，
// 与 viral-attributor.ts 保持同一模式（AI SDK v6 generateText + Output.object）。
//
// Phase 2 修正（2026-05-25）：本函数原名 annotate-collected-content，扫的是
// collected_items。但区块 C 类型占比 + 词云的真实数据源是"账号实际发文"
// —— my_posts (我方稿件) + benchmark_posts (对标账号稿件)。collected_items
// 是 66911 条全量舆情/热点/调研池，跟账号分析无关。本次重命名 +
// 改 UNION 扫两表，UPDATE 也按 source 分发。
//
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { myPosts, benchmarkPosts } from "@/db/schema/topic-compare-v2";
import { eq, sql } from "drizzle-orm";
import { generateText, Output } from "ai";
import { z } from "zod/v4"; // 对齐 viral-attributor.ts
import { getLanguageModel, resolveModelConfig } from "@/lib/agent/model-router";
import {
  AIGC_CONTENT_CATEGORIES,
  CHINESE_STOPWORDS,
} from "@/lib/account-analytics/content-category";

const MAX_CHAIN_DEPTH = 20;
const DEFAULT_BATCH_SIZE = 50;
const FAILURE_RATE_CIRCUIT_BREAKER = 0.5;
// 仅作为 aigc_annotation_model 字段值（数据回溯用），与 provider model 解耦
const MODEL_TAG = "deepseek.chat.v3";

const annotationSchema = z.object({
  category: z.enum(AIGC_CONTENT_CATEGORIES),
  // spec §7.3 要 5-10 个；min(3) 是兼容 LLM 短文偶尔输出少的容错
  keywords: z.array(z.string().min(1).max(20)).min(3).max(10),
});

const ATTRIBUTION_SYSTEM_PROMPT = `你是中文内容分类助手。
必须严格按以下规则输出：
- category：从 [时政, 社会, 财经, 科技, 生活, 娱乐, 体育, 其他] 中**必须选 1 个**；无法判断时选"其他"
- keywords：5-10 个中文关键词（**实词**，禁止虚词「的、了、是、在」等），按重要性排序`;

type PostRow = {
  id: string;
  source: "my" | "benchmark";
  title: string;
  summary: string | null;
  body: string | null;
};

export const annotateAccountPosts = inngest.createFunction(
  {
    id: "account-analytics-annotate-posts",
    name: "Account Analytics · AIGC 账号发文标注",
    // concurrency 与 db pool max:2 对齐（src/db/index.ts:24）——更高会触发
    // ConnectionError（其他 batch 抢不到连接，connect_timeout 30s 后报错）
    concurrency: { limit: 2 },
    // retries: 0 配合下方 Step 3 "失败行兜底写'其他'"机制 —— 单次 step 必须把这批 50 条
    // 全部解决（成功或兜底），不让 Inngest 自动重试。两者同时存在会导致兜底完后整函数
    // 重跑时已无未标注行 → 拉下一批 → 再失败 → 再熔断，链路不收敛。
    retries: 0,
  },
  [
    { event: "account-analytics/aigc-annotate.requested" },
    // 触发时机由 scheduled_jobs.account-analytics-annotate-posts 表配置(默认 SH 04:00)
    { event: "scheduled-jobs/account-analytics-annotate-posts.run" },
  ],
  async ({ event, step }) => {
    // Inngest 类型上 event.data 是 `event payload | { cron: string }` 的 union；
    // cron 触发时只有 { cron }，没有业务字段。统一用 `in` 守卫窄化。
    const data = event?.data;
    const orgId =
      data && "orgId" in data && typeof data.orgId === "string"
        ? data.orgId
        : undefined;
    const batchSize =
      data && "batchSize" in data && typeof data.batchSize === "number"
        ? data.batchSize
        : DEFAULT_BATCH_SIZE;
    const chainDepth =
      data && "chainDepth" in data && typeof data.chainDepth === "number"
        ? data.chainDepth
        : 0;

    // ⚠️ cron 触发（每天 04:00）时 event.data 为 undefined → orgId = undefined
    //    若直接进 Step 1 会跨 org 标注（多租户数据隔离漏洞）。
    //    必须先 fan-out 到每个 org 独立派发事件，避免一次 step 跨 org 写入。
    if (!orgId) {
      const orgs = await step.run("load-orgs", async () => {
        // UNION 扫 my_posts (org_id 直接) + benchmark_posts (org_id 来自 benchmark_accounts)
        // 只取有 pending (aigc_annotated_at IS NULL) 的 org
        const rows = (await db.execute(sql`
          SELECT DISTINCT organization_id FROM (
            SELECT organization_id
            FROM my_posts
            WHERE aigc_annotated_at IS NULL
            UNION
            SELECT ba.organization_id
            FROM benchmark_posts bp
            JOIN benchmark_accounts ba ON ba.id = bp.benchmark_account_id
            WHERE bp.aigc_annotated_at IS NULL
              AND ba.organization_id IS NOT NULL
          ) x
        `)) as unknown as Array<{ organization_id: string }>;
        return rows.map((r) => ({ id: r.organization_id }));
      });
      for (const o of orgs) {
        await step.sendEvent(`dispatch-${o.id}`, {
          name: "account-analytics/aigc-annotate.requested",
          data: { orgId: o.id, batchSize, chainDepth: 0 },
        });
      }
      return { fannedOut: true, orgCount: orgs.length };
    }

    // 1) 拉一批待标注（UNION my_posts + benchmark_posts，按 source 标记来源）
    //    UNION 各取 batchSize/2，合计上限 = batchSize；my_posts 数据少时 UNION 自动短少。
    //    benchmark_accounts.organization_id 可能为 NULL（全局预设），按 spec 同样纳入 org 范围。
    const items = await step.run("load-batch", async () => {
      const half = Math.max(1, Math.floor(batchSize / 2));
      const rows = (await db.execute(sql`
        (SELECT id::text AS id, 'my' AS source, title, summary, body
         FROM my_posts
         WHERE organization_id = ${orgId}
           AND aigc_annotated_at IS NULL
         ORDER BY published_at DESC NULLS LAST
         LIMIT ${half})
        UNION ALL
        (SELECT bp.id::text AS id, 'benchmark' AS source, bp.title, bp.summary, bp.body
         FROM benchmark_posts bp
         JOIN benchmark_accounts ba ON ba.id = bp.benchmark_account_id
         WHERE (ba.organization_id = ${orgId} OR ba.organization_id IS NULL)
           AND bp.aigc_annotated_at IS NULL
         ORDER BY bp.published_at DESC NULLS LAST
         LIMIT ${half})
      `)) as unknown as PostRow[];
      return rows;
    });

    if (items.length === 0) return { done: true, processed: 0 };

    // 2) 并行 LLM 调用（concurrency=2 由 createFunction 控制，对齐 db pool max:2）
    //    AI SDK v6：generateText + Output.object（generateObject 已移除）
    //    model 通过 model-router 选用项目统一配置的 LLM，不直接绑定 provider
    const modelConfig = resolveModelConfig(["content_analysis"], {
      temperature: 0,
      maxTokens: 256,
    });
    const results = await step.run("llm-annotate-batch", async () => {
      const rs = await Promise.all(
        items.map(async (it) => {
          // title + summary + body.slice(0, 500) —— 两表都有这三个字段
          const text = `${it.title ?? ""}\n${it.summary ?? ""}\n\n${(it.body ?? "").slice(0, 500)}`;
          try {
            const { output } = await generateText({
              model: getLanguageModel(modelConfig),
              system: ATTRIBUTION_SYSTEM_PROMPT,
              prompt: `请对以下内容分类并提取关键词：\n\n${text}`,
              output: Output.object({ schema: annotationSchema }),
              temperature: modelConfig.temperature,
              maxOutputTokens: modelConfig.maxTokens,
            });
            // 过滤停用词
            const filtered = output.keywords.filter(
              (kw) => !CHINESE_STOPWORDS.has(kw) && kw.length > 1,
            );
            return {
              id: it.id,
              ok: true as const,
              category: output.category,
              keywords: filtered,
            };
          } catch (err) {
            return { id: it.id, ok: false as const, error: String(err) };
          }
        }),
      );
      return rs;
    });

    const failureCount = results.filter((r) => !r.ok).length;
    const failureRate = failureCount / results.length;

    // 3) 批量 UPDATE（失败行也兜底写入'其他'防无限重选）
    //    按 source 字段决定 UPDATE my_posts 还是 benchmark_posts。
    //    postgres-js driver + prepare:false (pgbouncer transaction mode) + max:2 pool
    //    下，单一事务内**只能串行执行 query**——同事务连接已 busy 时另一个 query 立即 throw
    //    "another query is already running"。所以 for-loop 串行，不能 Promise.all。
    //    项目里已有 12 处 db.transaction（如 missions.ts:391）都是串行模式，照搬。
    //    Inngest 函数 concurrency:2 与 db pool max:2 对齐，避免抢连接。
    const itemSourceById = new Map(items.map((it) => [it.id, it.source]));
    await step.run("persist", async () => {
      const now = new Date();
      await db.transaction(async (tx) => {
        for (const r of results) {
          const source = itemSourceById.get(r.id);
          // 防御：source 不在 map 里（不应该发生）则跳过
          if (!source) continue;
          const targetTable = source === "my" ? myPosts : benchmarkPosts;
          if (r.ok) {
            await tx
              .update(targetTable)
              .set({
                aigcContentCategory: r.category,
                aigcKeywords: r.keywords,
                aigcAnnotatedAt: now,
                aigcAnnotationModel: MODEL_TAG,
              })
              .where(eq(targetTable.id, r.id));
          } else {
            // 失败兜底
            await tx
              .update(targetTable)
              .set({
                aigcContentCategory: "其他",
                aigcKeywords: [],
                aigcAnnotatedAt: now,
                aigcAnnotationModel: `${MODEL_TAG}.failed`,
              })
              .where(eq(targetTable.id, r.id));
          }
        }
      });
    });

    // 4) 熔断
    if (failureRate > FAILURE_RATE_CIRCUIT_BREAKER) {
      throw new Error(
        `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds 50% threshold, halt`,
      );
    }

    // 5) 递归链式派发
    if (items.length === batchSize && chainDepth < MAX_CHAIN_DEPTH) {
      await step.sendEvent("chain-next-batch", {
        name: "account-analytics/aigc-annotate.requested",
        data: { orgId, batchSize, chainDepth: chainDepth + 1 },
      });
    }

    return {
      done: items.length < batchSize,
      processed: items.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: failureCount,
      chainDepth,
    };
  },
);
