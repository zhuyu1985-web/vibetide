"use server";

import { db } from "@/db";
import {
  hotTopics,
  topicAngles,
  commentInsights,
  hotTopicCrawlLogs,
  userProfiles,
  missions,
  missionTasks,
  aiEmployees,
} from "@/db/schema";
import { and, eq, isNotNull, ne, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import {
  fetchTrendingFromApi,
  buildCrossPlatformTopics,
  normalizeHeatScore,
  normalizeTitleKey,
  parseChineseNumber,
  TOPHUB_DEFAULT_NODES,
  type TrendingItem,
} from "@/lib/trending-api";
import { getDefaultHotTopicTemplate } from "@/lib/dal/workflow-templates-listing";
import { startMissionFromTemplate } from "@/app/actions/workflow-launch";
import {
  INDUSTRY_DIMENSION_MAP,
  MAX_INDUSTRIES_PER_TRACKING,
  type IndustryKey,
} from "@/lib/constants";
import { executeMissionDirect } from "@/lib/mission-executor";
import { generateText } from "ai";
import { resolveModelConfig, getLanguageModel } from "@/lib/agent/model-router";
import { gte, gt as drizzleGt, desc, sql as drizzleSql, or } from "drizzle-orm";
export async function createHotTopic(data: {
  organizationId: string;
  title: string;
  priority?: "P0" | "P1" | "P2";
  heatScore?: number;
  trend?: "rising" | "surging" | "plateau" | "declining";
  source?: string;
  category?: string;
  summary?: string;
  heatCurve?: { time: string; value: number }[];
  platforms?: string[];
}) {
  await requireAuth();

  const [topic] = await db
    .insert(hotTopics)
    .values(data)
    .returning();

  revalidatePath("/inspiration");
  return topic;
}

export async function updateTopicPriority(
  id: string,
  priority: "P0" | "P1" | "P2"
) {
  await requireAuth();

  await db
    .update(hotTopics)
    .set({ priority, updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  revalidatePath("/inspiration");
}

export async function startTopicTracking(id: string) {
  await requireAuth();

  // Update the topic to P0 to signal tracking
  await db
    .update(hotTopics)
    .set({ priority: "P0", updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  revalidatePath("/inspiration");
  revalidatePath("/missions");
}

/**
 * Start a mission from a hot topic — creates a multi-agent task
 * that generates multi-angle articles for the topic.
 */
export async function startTopicMission(
  topicId: string,
  selectedAngle?: { angle: string; outline?: string[] }
) {
  const user = await requireAuth();

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    throw new Error("No organization found");
  }

  const topic = await db.query.hotTopics.findFirst({
    where: eq(hotTopics.id, topicId),
    with: { angles: true },
  });
  if (!topic) {
    throw new Error("Topic not found");
  }

  // 已经追踪过：直接复用已有 mission，避免重复创建。
  // 与 missions_source_dedup_uidx 唯一索引语义一致。
  const existingMission = await db.query.missions.findFirst({
    where: and(
      eq(missions.organizationId, profile.organizationId),
      eq(missions.sourceModule, "hot_topics"),
      isNotNull(missions.sourceEntityId),
      eq(missions.sourceEntityId, topicId),
      ne(missions.status, "failed"),
    ),
    columns: { id: true },
  });
  if (existingMission) {
    return { id: existingMission.id };
  }

  // B.1/Phase 4B: 走默认热点模板，不再硬编码 scenario='breaking_news'。
  const template = await getDefaultHotTopicTemplate(profile.organizationId);

  // 把热点上下文/角度信息塞进 event_keywords 的描述里（模板只有 3 个 input
  // 字段：event_keywords / urgency_level / event_time），无法 1:1 映射旧字段，
  // 所以用 event_keywords 承载话题 + 角度，event_time 取当前时间，urgency_level
  // 按 P0/P1/P2 映射到 critical/urgent/normal。
  const angleHints = topic.angles?.length
    ? `\n可参考的切入角度：\n${topic.angles
        .map((a: { angleText: string }) => `- ${a.angleText}`)
        .join("\n")}`
    : "";
  const platformInfo = (topic.platforms as string[])?.length
    ? `\n来源平台：${(topic.platforms as string[]).join("、")}`
    : "";
  const angleContext = selectedAngle
    ? `\n选定创作角度：${selectedAngle.angle}\n大纲要点：\n${(selectedAngle.outline || [])
        .map((p, i) => `${i + 1}. ${p}`)
        .join("\n")}`
    : "";

  const eventKeywords = [
    topic.title,
    topic.summary ? `摘要：${topic.summary}` : "",
    `当前热度：${topic.heatScore}/100，趋势：${topic.trend}`,
    topic.category ? `分类：${topic.category}` : "",
    platformInfo,
    angleHints,
    angleContext,
  ]
    .filter((s) => s && s.length > 0)
    .join("\n");

  const urgencyLevel =
    topic.priority === "P0"
      ? "critical"
      : topic.priority === "P1"
        ? "urgent"
        : "normal";

  const inputs: Record<string, unknown> = {
    event_keywords: eventKeywords,
    urgency_level: urgencyLevel,
    event_time: new Date().toISOString().slice(0, 10),
  };

  const res = await startMissionFromTemplate(template.id, inputs);
  if (!res.ok) {
    throw new Error(
      `启动热点追踪失败：${Object.values(res.errors).join("; ")}`,
    );
  }

  // 回填 source 关联 + 用热点标题改写 mission.title。
  // - title：默认从模板取（统一为"突发新闻"），UX 上无法区分各热点；改写为
  //   "热点追踪：${topic.title}" 与历史 mission 标题保持一致。
  // - sourceModule/sourceEntityId：DAL 反查这两个字段判断热点是否被追踪。
  // missions_source_dedup_uidx 是 partial unique，并发重复点击会拒绝第二次写入；
  // 此时 topic 已经有 mission，吞掉错误即可（前面的 existingMission 查重也会在
  // router.refresh() 后挡住后续调用）。
  await db
    .update(missions)
    .set({
      title: `热点追踪：${topic.title}`,
      sourceModule: "hot_topics",
      sourceEntityId: topicId,
      sourceEntityType: "hot_topic",
    })
    .where(eq(missions.id, res.missionId))
    .catch((err) => {
      console.warn("[hot-topics] backfill source link failed:", err);
    });

  // Mark topic as P0 (being tracked)
  await db
    .update(hotTopics)
    .set({ priority: "P0", updatedAt: new Date() })
    .where(eq(hotTopics.id, topicId));

  revalidatePath("/inspiration");
  revalidatePath("/missions");

  return { id: res.missionId };
}

export async function addTopicAngle(data: {
  hotTopicId: string;
  angleText: string;
  generatedBy?: string;
}) {
  await requireAuth();

  await db.insert(topicAngles).values(data);

  revalidatePath("/inspiration");
}

export async function updateCommentInsight(data: {
  hotTopicId: string;
  positive: number;
  neutral: number;
  negative: number;
  hotComments?: string[];
}) {
  await requireAuth();

  // Upsert: check if insight exists for this topic
  const existing = await db.query.commentInsights.findFirst({
    where: eq(commentInsights.hotTopicId, data.hotTopicId),
  });

  if (existing) {
    await db
      .update(commentInsights)
      .set({
        positive: data.positive,
        neutral: data.neutral,
        negative: data.negative,
        hotComments: data.hotComments || [],
        analyzedAt: new Date(),
      })
      .where(eq(commentInsights.id, existing.id));
  } else {
    await db.insert(commentInsights).values({
      hotTopicId: data.hotTopicId,
      positive: data.positive,
      neutral: data.neutral,
      negative: data.negative,
      hotComments: data.hotComments || [],
    });
  }

  revalidatePath("/inspiration");
}

/**
 * Crawl a single platform via the TopHub API.
 * Returns the platform name + items (or error message).
 * Not a server action per se, but exported for use by API routes.
 */
export async function crawlSinglePlatform(
  platformName: string
): Promise<{ name: string; items: TrendingItem[]; error?: string }> {
  try {
    const items = await fetchTrendingFromApi("platforms", {
      platforms: [platformName],
      limit: 30,
    });
    return { name: platformName, items };
  } catch (err) {
    return {
      name: platformName,
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Shared dedup + persist helper used by both triggerHotTopicCrawl
 * and the SSE crawl route. Accepts all collected items across platforms
 * and upserts into the hotTopics table.
 */
export async function persistCrawledTopics(
  organizationId: string,
  allItems: TrendingItem[],
  crawlLogValues: (typeof hotTopicCrawlLogs.$inferInsert)[]
): Promise<{ newTopics: number; updatedTopics: number }> {
  // Write all crawl logs in one batch
  if (crawlLogValues.length > 0) {
    await db.insert(hotTopicCrawlLogs).values(crawlLogValues);
  }

  if (allItems.length === 0) {
    return { newTopics: 0, updatedTopics: 0 };
  }

  // Dedup and persist (batch approach to avoid N+1 queries)
  const crossPlatform = buildCrossPlatformTopics(allItems);

  const topicAgg = new Map<string, {
    title: string;
    titleHash: string;
    platforms: Set<string>;
    maxHeat: number;
    url: string;
    category?: string;
  }>();

  for (const cp of crossPlatform) {
    const key = normalizeTitleKey(cp.title);
    const titleHash = crypto.createHash("md5").update(key).digest("hex");
    topicAgg.set(key, {
      title: cp.title,
      titleHash,
      platforms: new Set(cp.platforms),
      maxHeat: cp.totalHeat,
      url: "",
      category: undefined,
    });
  }

  for (const item of allItems) {
    const key = normalizeTitleKey(item.title);
    const numericHeat = parseChineseNumber(item.heat);
    if (!topicAgg.has(key)) {
      const titleHash = crypto.createHash("md5").update(key).digest("hex");
      topicAgg.set(key, {
        title: item.title,
        titleHash,
        platforms: new Set([item.platform]),
        maxHeat: numericHeat,
        url: item.url,
        category: item.category,
      });
    } else {
      const existing = topicAgg.get(key)!;
      existing.platforms.add(item.platform);
      if (numericHeat > existing.maxHeat) existing.maxHeat = numericHeat;
      if (item.url && !existing.url) existing.url = item.url;
    }
  }

  const now = new Date();
  const timeLabel = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

  let newCount = 0;
  let updatedCount = 0;

  for (const [, agg] of topicAgg) {
    const platformCount = agg.platforms.size;
    const heatScore = normalizeHeatScore(agg.maxHeat, platformCount);
    const platformsArray = Array.from(agg.platforms);

    const priority = platformCount >= 3 || heatScore > 85
      ? "P0"
      : platformCount >= 2 || heatScore >= 50
        ? "P1"
        : "P2";

    const result = await db
      .insert(hotTopics)
      .values({
        organizationId,
        title: agg.title,
        titleHash: agg.titleHash,
        sourceUrl: agg.url || null,
        priority,
        heatScore,
        trend: "rising",
        source: platformsArray[0] || "",
        category: agg.category || null,
        platforms: platformsArray,
        heatCurve: [{ time: timeLabel, value: heatScore }],
        discoveredAt: now,
      })
      .onConflictDoUpdate({
        target: [hotTopics.organizationId, hotTopics.titleHash],
        set: {
          heatScore,
          platforms: platformsArray,
          discoveredAt: now,
          updatedAt: now,
        },
      })
      .returning({ id: hotTopics.id, updatedAt: hotTopics.updatedAt });

    if (result[0]?.updatedAt) {
      updatedCount++;
    } else {
      newCount++;
    }
  }

  return { newTopics: newCount, updatedTopics: updatedCount };
}

/**
 * Direct crawl: fetches all 10 platforms via TopHub API,
 * deduplicates, and persists to hotTopics table.
 * Called directly from the UI "刷新热点" button (no Inngest dependency).
 */
export async function triggerHotTopicCrawl() {
  const user = await requireAuth();

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  if (!profile?.organizationId) {
    throw new Error("No organization found");
  }

  const organizationId = profile.organizationId;

  // Step 1: Crawl all platforms
  const platformEntries = Object.entries(TOPHUB_DEFAULT_NODES);
  const allItems: TrendingItem[] = [];

  const results = await Promise.allSettled(
    platformEntries.map(async ([name]) => {
      const items = await fetchTrendingFromApi("platforms", {
        platforms: [name],
        limit: 30,
      });
      return { name, items };
    })
  );

  const crawlLogValues: (typeof hotTopicCrawlLogs.$inferInsert)[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const [name, nodeId] = platformEntries[i];

    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
      crawlLogValues.push({ organizationId, platformName: name, platformNodeId: nodeId, status: "success", topicsFound: result.value.items.length });
    } else {
      const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      crawlLogValues.push({ organizationId, platformName: name, platformNodeId: nodeId, status: "error", topicsFound: 0, errorMessage: errMsg });
    }
  }

  // Step 2: Dedup and persist using shared helper
  const { newTopics, updatedTopics } = await persistCrawledTopics(organizationId, allItems, crawlLogValues);

  revalidatePath("/inspiration");
  return { success: true, newTopics, updatedTopics };
}

export async function refreshInspirationData() {
  revalidatePath("/inspiration");
}

const AUTO_TRIGGER_HEAT_THRESHOLD = 80;

/**
 * F4.A.02: Update a topic's heat score and auto-trigger workflow if threshold reached.
 */
export async function updateTopicHeatScore(
  id: string,
  heatScore: number,
  organizationId: string
) {
  await requireAuth();

  await db
    .update(hotTopics)
    .set({ heatScore, updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  // Auto-trigger mission when heat score reaches P0 threshold (≥80).
  // B.1/Phase 4B: 走默认热点模板，不再硬编码 scenario='breaking_news'。
  if (heatScore >= AUTO_TRIGGER_HEAT_THRESHOLD) {
    const topic = await db.query.hotTopics.findFirst({ where: eq(hotTopics.id, id) });
    if (topic) {
      try {
        const template = await getDefaultHotTopicTemplate(organizationId);
        const inputs: Record<string, unknown> = {
          event_keywords: `${topic.title}\n当前热度：${heatScore}/100${topic.source ? `\n信源：${topic.source}` : ""}`,
          urgency_level: "critical",
          event_time: new Date().toISOString().slice(0, 10),
        };
        const res = await startMissionFromTemplate(template.id, inputs);
        if (!res.ok) {
          console.error(
            "[hot-topics] auto-trigger failed:",
            Object.values(res.errors).join("; "),
          );
        }
      } catch (err) {
        console.error("[hot-topics] auto-trigger failed:", err);
      }
    }
  }

  revalidatePath("/inspiration");
  revalidatePath("/missions");
}

// ─── 热点深度追踪（多维度并行改写） ─────────────────────────────────────
//
// 与 startTopicMission（默认快速追踪）的区别：
//   - 默认快速：跑 breaking_news 模板的 5 步流水线，产 1 篇综合稿
//   - 深度追踪：用户选 1~5 个行业维度，对每个维度并行生成"行业视角稿件"，
//     全部经过合规审查，UI 列出供用户挑选 1 篇入 articles 表 status=draft
//
// 实现：手动构造 mission + task DAG（绕过 leader-plan 自动分解），
// mission-executor.leaderPlanDirect 看到 pre-existing tasks 会走 fast-path
// 直接执行。
//
// Task DAG：
//   collect (xiaozi)  ← 无依赖
//     ├─ write_industry_1 (xiaowen)
//     │   └─ audit_industry_1 (xiaoshen)
//     ├─ write_industry_2 (xiaowen)
//     │   └─ audit_industry_2 (xiaoshen)
//     └─ ... (最多 5 路并行)
//
// 完成后 leaderConsolidateDirect 会把所有 task 的 outputData 汇总到
// mission.finalOutput.summary。UI 直接读 mission_tasks 拉草稿对比。

// ─── AI 要点提炼 ────────────────────────────────────────────────────────
//
// 灵感发现里"AI 要点提炼"区域当前展示的是 hot_topics.enriched_outlines（来自
// enrichment Inngest pipeline）；如果该字段为空会 fallback 到 CATEGORY_ANGLES
// 模板套话，与原文无关，用户体验差。
//
// 这个 action 提供 "用户主动触发"路径：直接读 topic.title + topic.summary +
// 按需 jina 深读 sourceUrl 获取正文，再 1 次 LLM 调用提炼 3~5 条要点 + 一句话
// 精炼，结果写回 hot_topics.enriched_outlines（避免重复调用，下次刷新可见）。

export interface TopicKeyPointsResult {
  oneLineSummary: string;
  keyPoints: string[];
  /** 提炼时是否成功读取到原文正文（false → 仅基于 title+summary 提炼，质量略低） */
  fullTextFetched: boolean;
}

export async function summarizeTopicKeyPoints(
  topicId: string,
): Promise<TopicKeyPointsResult> {
  await requireAuth();

  const topic = await db.query.hotTopics.findFirst({
    where: eq(hotTopics.id, topicId),
  });
  if (!topic) throw new Error("Topic not found");

  // 尝试拉取原文正文（如果有 sourceUrl）—— 失败则降级到只用 title+summary
  let articleBody = "";
  let fullTextFetched = false;
  if (topic.sourceUrl && topic.sourceUrl.startsWith("http")) {
    try {
      const { fetchViaJinaReader } = await import("@/lib/web-fetch");
      const fetched = await fetchViaJinaReader(topic.sourceUrl);
      // 截断到 6000 字内防止 prompt 爆炸
      articleBody = (fetched.content ?? "").slice(0, 6000);
      fullTextFetched = articleBody.length > 200;
    } catch (err) {
      console.warn("[summarizeTopicKeyPoints] fetch source failed:", err);
    }
  }

  const prompt = `你是资深新闻编辑助手。请对下面这条热点新闻提炼**核心要点**，让读者不必读完全文就能快速掌握重点。

# 新闻基础信息
标题：${topic.title}
${topic.summary ? `摘要：${topic.summary}` : ""}
${topic.category ? `分类：${topic.category}` : ""}
${topic.sourceUrl ? `来源：${topic.sourceUrl}` : ""}
平台：${(topic.platforms as string[]).join("、")}

${fullTextFetched ? `# 原文正文（可能截断）\n${articleBody}\n` : "# 提示\n仅有标题和摘要，请基于这些信息合理提炼，不要编造细节。\n"}

# 输出要求
严格按以下 JSON 输出，不要其他文字：
{
  "oneLineSummary": "30 字内一句话精炼整条新闻最核心的事实",
  "keyPoints": [
    "3~5 条要点：每条 ≤ 50 字，按重要性排序，包含关键事实/数字/人物/影响"
  ]
}

# 约束
- 严格基于提供的信息，不编造原文未出现的事实
- keyPoints 不要套话（如"事件全貌""趋势研判"），要有真实信息含量
- oneLineSummary 是新闻 5W1H 的精炼，不是评论`;

  const config = resolveModelConfig(["content_analysis"], { temperature: 0.3, maxTokens: 1024 });
  const model = getLanguageModel(config);

  let text: string;
  try {
    const res = await generateText({
      model,
      maxOutputTokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    text = res.text;
  } catch (err) {
    // 阿里云 DashScope 的内容安全层会对 input / output 做审核，命中敏感词时
    // 直接返回 400 data_inspection_failed（`isRetryable: false`，重试无用）。
    // 我们无法从客户端决定内容是否合规，只能优雅降级：用 title + summary
    // 本地拼一个要点结构，让上层 UI 不至于完全空白。
    //   - 观察到的触发场景：原文含涉政 / 涉敏感人物的新闻
    //   - 诊断 URL：https://help.aliyun.com/zh/model-studio/error-code
    const message = err instanceof Error ? err.message : String(err);
    const isContentFilter =
      /data_inspection_failed|inappropriate content|内容.*(违规|不合规|敏感)/i.test(
        message,
      );
    if (isContentFilter) {
      console.warn(
        "[summarizeTopicKeyPoints] DashScope content filter blocked:",
        message,
      );
      const fallbackSummary = (topic.summary ?? topic.title).trim().slice(0, 60);
      const fallback: TopicKeyPointsResult = {
        oneLineSummary: fallbackSummary || topic.title,
        keyPoints: [
          topic.title,
          ...(topic.summary ? [topic.summary.slice(0, 80)] : []),
          "⚠️ 模型内容审核拦截，仅展示原始标题和摘要，请手动查看原文获取更多要点",
        ].filter(Boolean),
        fullTextFetched,
      };
      // 也写回 DB，避免下次再触发同一拦截
      await db
        .update(hotTopics)
        .set({
          summary: fallback.oneLineSummary,
          enrichedOutlines: [
            {
              angle: fallback.oneLineSummary,
              points: fallback.keyPoints,
              wordCount: "",
              style: "降级（内容审核拦截）",
            },
          ],
          updatedAt: new Date(),
        })
        .where(eq(hotTopics.id, topicId));
      revalidatePath("/inspiration");
      return fallback;
    }
    // 其他错误照常抛给上层处理
    throw err;
  }

  let jsonStr = text.trim();
  const fenced = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonStr = fenced[1].trim();
  const start = jsonStr.indexOf("{");
  const end = jsonStr.lastIndexOf("}");
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);

  let parsed: { oneLineSummary?: string; keyPoints?: string[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error("[summarizeTopicKeyPoints] parse failed:", err, "raw:", text.slice(0, 300));
    throw new Error("AI 要点提炼失败：模型输出格式异常");
  }

  const result: TopicKeyPointsResult = {
    oneLineSummary:
      typeof parsed.oneLineSummary === "string" && parsed.oneLineSummary.trim().length > 0
        ? parsed.oneLineSummary.trim()
        : topic.title,
    keyPoints:
      Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0
        ? parsed.keyPoints.map((p) => String(p).trim()).filter(Boolean).slice(0, 5)
        : [],
    fullTextFetched,
  };

  if (result.keyPoints.length === 0) {
    throw new Error("AI 未能提炼出有效要点");
  }

  // 写回 hot_topics.enriched_outlines —— 把要点存为单条 angle 结构（兼容现有
  // UI 渲染逻辑），下次刷新就直接命中而不再调 LLM
  await db
    .update(hotTopics)
    .set({
      summary: result.oneLineSummary,
      enrichedOutlines: [
        {
          angle: result.oneLineSummary,
          points: result.keyPoints,
          wordCount: "",
          style: "AI 要点提炼",
        },
      ],
      updatedAt: new Date(),
    })
    .where(eq(hotTopics.id, topicId));

  revalidatePath("/inspiration");
  return result;
}

// ─── 概要预览 ───────────────────────────────────────────────────────────
//
// 深度追踪 Step 1：用户在行业对话框选了 N 个行业 → 不立刻生成全稿，先调一次
// LLM 生成 N 个行业的"概要"（头条候选标题 + 3~5 个关键论点 + 200 字内摘要），
// 让用户审过概要后再决定哪些行业值得花成本生成完整稿件。
//
// 单次 LLM 调用一次性输出 N 个 JSON 概要（成本/延迟低），不写 mission_tasks /
// missions 表（轻量）。返回结果直接序列化给前端的 OutlinePreview 步骤展示。

export interface IndustryOutlinePreview {
  industryKey: IndustryKey;
  industryLabel: string;
  headline: string;
  keyPoints: string[];
  summary: string;
}

export async function previewIndustryOutlines(
  topicId: string,
  industryKeys: IndustryKey[],
): Promise<IndustryOutlinePreview[]> {
  await requireAuth();

  if (industryKeys.length < 1 || industryKeys.length > MAX_INDUSTRIES_PER_TRACKING) {
    throw new Error(`必须选择 1~${MAX_INDUSTRIES_PER_TRACKING} 个行业维度`);
  }
  const uniqueKeys = Array.from(new Set(industryKeys));
  for (const key of uniqueKeys) {
    if (!INDUSTRY_DIMENSION_MAP[key]) throw new Error(`未知的行业维度：${key}`);
  }

  const topic = await db.query.hotTopics.findFirst({
    where: eq(hotTopics.id, topicId),
  });
  if (!topic) throw new Error("Topic not found");

  const dimensions = uniqueKeys.map((k) => INDUSTRY_DIMENSION_MAP[k]);

  const prompt = `你是资深内容策划师。基于下面这条热点新闻，分别从 ${dimensions.length} 个行业视角各构思一份**概要**（不要生成完整稿件，只输出大纲级别的概要）。

# 热点新闻原文
标题：${topic.title}
${topic.summary ? `摘要：${topic.summary}` : ""}
${topic.category ? `分类：${topic.category}` : ""}
${topic.sourceUrl ? `来源：${topic.sourceUrl}` : ""}
平台：${(topic.platforms as string[]).join("、")}
热度：${topic.heatScore}/100

# 待构思的 ${dimensions.length} 个行业视角
${dimensions.map((d, i) => `${i + 1}. 【${d.label}】切入要点：${d.angle}`).join("\n")}

# 输出要求
严格按以下 JSON schema 输出（数组按上述行业顺序），不要输出其他任何文字：
[
  {
    "industryKey": "行业 key（必须与输入对应：${dimensions.map((d) => `"${d.key}"`).join(" / ")}）",
    "industryLabel": "行业中文名",
    "headline": "20 字内吸引人的稿件标题（保留原文核心信息，按行业视角包装）",
    "keyPoints": ["3~5 个关键论点（每点 30 字内）"],
    "summary": "150~200 字概要（说明这个视角下文章会怎么写、覆盖哪些重点）"
  }
]

# 约束
- 必须严格保留原文核心事实，不要虚构未在原文出现的数字 / 人名
- 不同行业的 headline / keyPoints 必须有显著差异（体现行业视角的不同）
- summary 不要出现"本文将"等套话，直接说重点`;

  const config = resolveModelConfig(["content_gen"], { temperature: 0.6, maxTokens: 4096 });
  const model = getLanguageModel(config);

  const { text } = await generateText({
    model,
    maxOutputTokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  // 抽 JSON：可能被 ```json``` 包裹
  let jsonStr = text.trim();
  const fenced = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) jsonStr = fenced[1].trim();
  // 兜底：找第一个 [ 到最后一个 ]
  const start = jsonStr.indexOf("[");
  const end = jsonStr.lastIndexOf("]");
  if (start >= 0 && end > start) jsonStr = jsonStr.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    console.error("[previewIndustryOutlines] JSON parse failed:", err, "raw:", text.slice(0, 500));
    throw new Error("概要生成失败：模型输出格式错误");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("概要生成失败：模型未返回数组");
  }

  // 按 industryKey 对齐 + 校验 + 兜底（任何缺字段都用模板补齐，保证返回稳定）
  const byKey = new Map<string, Partial<IndustryOutlinePreview>>(
    parsed
      .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
      .map((x) => [String(x.industryKey ?? ""), x as Partial<IndustryOutlinePreview>]),
  );

  return dimensions.map((dim): IndustryOutlinePreview => {
    const raw = byKey.get(dim.key) ?? {};
    return {
      industryKey: dim.key,
      industryLabel: dim.label,
      headline:
        typeof raw.headline === "string" && raw.headline.trim().length > 0
          ? raw.headline
          : `${dim.label}视角：${topic.title.slice(0, 18)}`,
      keyPoints:
        Array.isArray(raw.keyPoints) && raw.keyPoints.length > 0
          ? raw.keyPoints.map(String).slice(0, 5)
          : [`从 ${dim.label} 视角分析这条热点的核心影响`],
      summary:
        typeof raw.summary === "string" && raw.summary.trim().length > 0
          ? raw.summary
          : `本视角将围绕 ${dim.angle} 展开。`,
    };
  });
}

export async function startTopicMissionMulti(
  topicId: string,
  industryKeys: IndustryKey[],
): Promise<{ id: string }> {
  const user = await requireAuth();

  if (industryKeys.length < 1 || industryKeys.length > MAX_INDUSTRIES_PER_TRACKING) {
    throw new Error(`必须选择 1~${MAX_INDUSTRIES_PER_TRACKING} 个行业维度`);
  }
  const uniqueKeys = Array.from(new Set(industryKeys));
  for (const key of uniqueKeys) {
    if (!INDUSTRY_DIMENSION_MAP[key]) {
      throw new Error(`未知的行业维度：${key}`);
    }
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization found");
  const orgId = profile.organizationId;

  const topic = await db.query.hotTopics.findFirst({
    where: eq(hotTopics.id, topicId),
    with: { angles: true },
  });
  if (!topic) throw new Error("Topic not found");

  // 复用 source_entity_id 唯一约束做去重（同一 topic 已有非 failed 深度追踪 → 复用）
  const existingMission = await db.query.missions.findFirst({
    where: and(
      eq(missions.organizationId, orgId),
      eq(missions.sourceModule, "hot_topics"),
      isNotNull(missions.sourceEntityId),
      eq(missions.sourceEntityId, topicId),
      eq(missions.scenario, "深度追踪"),
      ne(missions.status, "failed"),
    ),
    columns: { id: true },
  });
  if (existingMission) return { id: existingMission.id };

  // 加载 4 个员工（小资 / 小文 / 小审 / 小雷 leader）
  const teamSlugs = ["xiaolei", "xiaozi", "xiaowen", "xiaoshen"] as const;
  const employees = await db
    .select({ id: aiEmployees.id, slug: aiEmployees.slug })
    .from(aiEmployees)
    .where(
      and(
        eq(aiEmployees.organizationId, orgId),
        inArray(aiEmployees.slug, teamSlugs as unknown as string[]),
      ),
    );
  const empBySlug = new Map(employees.map((e) => [e.slug, e.id]));
  const leaderId = empBySlug.get("xiaolei");
  const collectorId = empBySlug.get("xiaozi");
  const writerId = empBySlug.get("xiaowen");
  const auditorId = empBySlug.get("xiaoshen");
  if (!leaderId || !collectorId || !writerId || !auditorId) {
    throw new Error("缺少必要员工（xiaolei/xiaozi/xiaowen/xiaoshen），请先 seed AI 员工");
  }

  const dimensions = uniqueKeys.map((k) => INDUSTRY_DIMENSION_MAP[k]);

  // 1. 创建 mission
  const [mission] = await db
    .insert(missions)
    .values({
      organizationId: orgId,
      title: `深度追踪：${topic.title}`,
      scenario: "深度追踪",
      userInstruction: `对热点新闻「${topic.title}」从以下 ${dimensions.length} 个行业视角并行改写：${dimensions.map((d) => d.label).join("、")}。每个视角输出独立稿件，并经过合规事实审查。最终用户挑选 1 篇入稿件库。`,
      leaderEmployeeId: leaderId,
      teamMembers: [...new Set([leaderId, collectorId, writerId, auditorId])],
      status: "queued",
      sourceModule: "hot_topics",
      sourceEntityId: topicId,
      sourceEntityType: "hot_topic",
      inputParams: {
        topicId,
        topicTitle: topic.title,
        topicSummary: topic.summary,
        industries: uniqueKeys,
      },
    })
    .returning({ id: missions.id });

  const missionId = mission.id;

  // 2. 手动构造 task DAG
  const topicContext = [
    `# 热点新闻原文`,
    `标题：${topic.title}`,
    topic.summary ? `摘要：${topic.summary}` : "",
    topic.sourceUrl ? `原文链接：${topic.sourceUrl}` : "",
    topic.category ? `分类：${topic.category}` : "",
    `平台：${(topic.platforms as string[]).join("、")}`,
    `热度：${topic.heatScore}/100`,
    topic.angles?.length
      ? `\n候选切入角度：\n${topic.angles.map((a: { angleText: string }) => `- ${a.angleText}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Task 1: 资料扩充（小资）
  const [collectTask] = await db
    .insert(missionTasks)
    .values({
      missionId,
      title: "扩充信息收集",
      description: `${topicContext}\n\n请基于上述热点新闻，调用网络搜索 / 网页深读工具拉取相关多源资料（背景、数据、各方观点、历史脉络），整理成结构化知识包供下游改写使用。`,
      expectedOutput: "结构化知识包（背景 + 数据 + 各方观点 + 历史脉络）",
      assignedEmployeeId: collectorId,
      dependencies: [],
      priority: 100,
      status: "pending",
    })
    .returning({ id: missionTasks.id });

  // Task 2..N+1: N 个行业并行改写（小文）+ 各自的合规审查（小审）
  for (const dim of dimensions) {
    const [writeTask] = await db
      .insert(missionTasks)
      .values({
        missionId,
        title: `${dim.label} · 视角改写`,
        description: `请基于"扩充信息收集"任务的输出，从【${dim.label}】行业视角改写这条热点新闻。\n\n切入要点：${dim.angle}\n\n要求：\n1. 严格保留原文核心事实（时间、人物、地点、数字、事件经过）\n2. 用 ${dim.label} 行业读者关心的角度展开解读\n3. 字数 800-1200 字\n4. 输出格式：完整稿件 markdown（包含标题、摘要、正文）\n5. 不要编造未在原文 / 资料包中出现的事实`,
        expectedOutput: `${dim.label} 行业视角的完整稿件（markdown）`,
        assignedEmployeeId: writerId,
        dependencies: [collectTask.id],
        priority: 50,
        status: "pending",
        inputContext: {
          industryKey: dim.key,
          industryLabel: dim.label,
          industryAngle: dim.angle,
          taskKind: "draft",
        },
      })
      .returning({ id: missionTasks.id });

    await db.insert(missionTasks).values({
      missionId,
      title: `${dim.label} · 合规审查`,
      description: `请审查"${dim.label} · 视角改写"任务产出的稿件草稿。审查维度：\n1. 事实准确性（与原始资料是否一致）\n2. 合规风险（是否有违法 / 误导 / 敏感问题）\n3. 引用来源（是否有未注明出处的关键事实）\n\n输出格式：\n- 结论：通过 / 有风险 / 不通过\n- 风险点：列出问题清单\n- 修订建议：（如有风险）`,
      expectedOutput: "合规审查结论（结论 + 风险点 + 修订建议）",
      assignedEmployeeId: auditorId,
      dependencies: [writeTask.id],
      priority: 10,
      status: "pending",
      inputContext: {
        industryKey: dim.key,
        industryLabel: dim.label,
        taskKind: "audit",
      },
    });
  }

  // 3. 触发 executor（fire-and-forget；mission-executor.leaderPlanDirect 走 pre-populated fast-path）
  executeMissionDirect(missionId, orgId)
    .then(() => console.log(`[hot-tracking-multi] mission ${missionId} completed`))
    .catch(async (err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[hot-tracking-multi] mission ${missionId} failed:`, err);
      await db
        .update(missions)
        .set({
          status: "failed",
          completedAt: new Date(),
          finalOutput: { error: true, message: errorMsg, failedAt: new Date().toISOString() },
        })
        .where(eq(missions.id, missionId))
        .catch(() => {});
    });

  // 标记 topic 为追踪中（沿用单 topic mission 的语义）
  await db
    .update(hotTopics)
    .set({ priority: "P0", updatedAt: new Date() })
    .where(eq(hotTopics.id, topicId));

  revalidatePath("/inspiration");
  revalidatePath("/missions");

  return { id: missionId };
}

// ─── 草稿入库 ────────────────────────────────────────────────────────────
//
// 用户在 mission 详情页"草稿对比"面板里选定了 1 个 industry 改写稿，调用此
// action 把对应 task.outputData 写入 articles 表（status=draft）。
//
// 写入后跳转至 /articles/[id]，用户在稿件库里继续编辑 / 配置发送 CMS。

export async function archiveSelectedDraftAction(
  missionId: string,
  draftTaskId: string,
): Promise<{ articleId: string }> {
  const user = await requireAuth();

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization found");
  const orgId = profile.organizationId;

  const mission = await db.query.missions.findFirst({
    where: and(eq(missions.id, missionId), eq(missions.organizationId, orgId)),
  });
  if (!mission) throw new Error("Mission not found");

  const task = await db.query.missionTasks.findFirst({
    where: and(eq(missionTasks.id, draftTaskId), eq(missionTasks.missionId, missionId)),
  });
  if (!task) throw new Error("Draft task not found");

  // 用 title 模式识别 draft task —— mission-executor 会覆盖 inputContext，所以
  // 不能靠那里的 taskKind 字段。"{industryLabel} · 视角改写" 是稳定签名。
  const draftTitleMatch = /^(.+) · 视角改写$/.exec(task.title);
  if (!draftTitleMatch) {
    throw new Error("所选 task 不是稿件草稿（title 模式不匹配）");
  }
  const industryLabel = draftTitleMatch[1];

  // outputData 结构来自 executeAgent 的 result.output：{ summary, artifacts: [{ content }] }
  const output = (task.outputData ?? {}) as {
    summary?: string;
    artifacts?: { content?: string; title?: string }[];
  };
  const body =
    output.artifacts?.[0]?.content ??
    output.summary ??
    "（稿件正文为空）";
  const headline =
    output.artifacts?.[0]?.title ??
    `${industryLabel}：${mission.title.replace(/^深度追踪：/, "")}`;

  // 动态导入 articles schema（保持与现有 actions 一致的 lazy-require 习惯）
  const { articles } = await import("@/db/schema/articles");
  const [created] = await db
    .insert(articles)
    .values({
      organizationId: orgId,
      title: headline,
      body,
      content: { headline, body },
      status: "draft",
      missionId,
      createdBy: user.id,
      tags: [industryLabel, "深度追踪"],
      wordCount: body.length,
    })
    .returning({ id: articles.id });

  revalidatePath("/articles");
  revalidatePath(`/missions/${missionId}`);

  return { articleId: created.id };
}

// ─── HTML 兜底转换 ─────────────────────────────────────────────────────
//
// LLM prompt 已要求输出 HTML，但 DeepSeek 偶尔会带 ```html``` 围栏 / 偶尔退化
// 到 Markdown。这个函数确保入 articles.body 的内容**一定是 HTML**，因为
// article 详情页用 dangerouslySetInnerHTML 渲染 body。
//
// 处理顺序：
//   1. 去除 ``` 代码围栏（``` / ```html）
//   2. 检测如果整段已经是 HTML（含 <h1/h2/p/ul/li/strong），直接返回
//   3. 否则按 Markdown 简单转换（# / ## / - / **）→ HTML
function normalizeBriefingHtml(raw: string): string {
  let txt = raw.trim();
  // 去 ```html ... ```
  const fence = txt.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/);
  if (fence) txt = fence[1].trim();

  const looksLikeHtml = /<\s*(h1|h2|h3|p|ul|ol|li|strong|em|br)\b/i.test(txt);
  if (looksLikeHtml) return txt;

  // Markdown → HTML（极简，仅覆盖本场景用到的 #/##/###/-/**）
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const lines = txt.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  const flushList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushList();
      continue;
    }
    let m;
    if ((m = /^#\s+(.*)$/.exec(line))) {
      flushList();
      out.push(`<h1>${escapeHtml(m[1])}</h1>`);
      continue;
    }
    if ((m = /^##\s+(.*)$/.exec(line))) {
      flushList();
      out.push(`<h2>${escapeHtml(m[1])}</h2>`);
      continue;
    }
    if ((m = /^###\s+(.*)$/.exec(line))) {
      flushList();
      out.push(`<h3>${escapeHtml(m[1])}</h3>`);
      continue;
    }
    if ((m = /^[-*]\s+(.*)$/.exec(line))) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      // 处理 **bold**
      const li = escapeHtml(m[1]).replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>",
      );
      out.push(`  <li>${li}</li>`);
      continue;
    }
    flushList();
    const p = escapeHtml(line).replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>",
    );
    out.push(`<p>${p}</p>`);
  }
  flushList();
  return out.join("\n");
}

// ─── 每日热点快讯 ────────────────────────────────────────────────────────
//
// 取过去 24h 的 hot_topics（P0/P1 优先，按 heatScore desc 取 top N）→ 1 次 LLM
// 调用生成 markdown 简报 → 写入 articles 表 status='approved' → 立即调
// publishArticleToCms（推送目标在 article-mapper 内硬编码）。
//
// 同日去重：通过 title prefix 「YYYY-MM-DD 每日热点快讯」 反查；如果存在则更新
// body + 重新触发 publishArticleToCms（CMS MODIFY）。
//
// 调用方：
//   - 灵感发现页"今日简报"按钮（trigger='manual', orgId 来自当前用户）
//   - Inngest cron `dailyHotBriefingCron`（trigger='scheduled', 每 org 调一次）

const BRIEFING_TOPIC_LIMIT = 20;
const BRIEFING_LOOKBACK_HOURS = 24;

export interface DailyHotBriefingResult {
  articleId: string;
  isNew: boolean;
  topicCount: number;
  /** CMS 推送是否触发 + 结果（feature flag 关闭时 cmsResult 为 undefined） */
  cmsResult?: {
    success: boolean;
    publicationId?: string;
    cmsState?: string;
    error?: string;
  };
}

export async function generateDailyHotBriefing(opts: {
  /** 调用来源：手动按钮 / cron */
  trigger: "manual" | "scheduled";
  /** 显式 org（cron 用）；缺省时从 requireAuth 解析（manual 按钮场景） */
  organizationId?: string;
  /** 显式 operator ID；缺省时取登录用户 */
  operatorId?: string;
}): Promise<DailyHotBriefingResult> {
  let { organizationId, operatorId } = opts;
  const { trigger } = opts;

  // manual 触发：如果没传 org/operator，从登录用户解析
  if (!organizationId || !operatorId) {
    const user = await requireAuth();
    operatorId = operatorId ?? user.id;
    if (!organizationId) {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
      });
      if (!profile?.organizationId) throw new Error("当前用户未关联 org");
      organizationId = profile.organizationId;
    }
  }

  // 1. 拉过去 24h 的 hot_topics（按 heatScore desc，取 top N）
  const since = new Date(Date.now() - BRIEFING_LOOKBACK_HOURS * 60 * 60 * 1000);
  const topics = await db
    .select({
      id: hotTopics.id,
      title: hotTopics.title,
      summary: hotTopics.summary,
      category: hotTopics.category,
      priority: hotTopics.priority,
      heatScore: hotTopics.heatScore,
      sourceUrl: hotTopics.sourceUrl,
      platforms: hotTopics.platforms,
    })
    .from(hotTopics)
    .where(
      and(
        eq(hotTopics.organizationId, organizationId),
        drizzleGt(hotTopics.discoveredAt, since),
        or(eq(hotTopics.priority, "P0"), eq(hotTopics.priority, "P1")),
      ),
    )
    .orderBy(desc(hotTopics.heatScore))
    .limit(BRIEFING_TOPIC_LIMIT);

  if (topics.length === 0) {
    throw new Error(`过去 ${BRIEFING_LOOKBACK_HOURS} 小时无 P0/P1 热点，无法生成简报`);
  }

  // 2. 按 category 分组（要闻/财经/科技/...）
  const grouped = new Map<string, typeof topics>();
  for (const t of topics) {
    const cat = t.category || "其他";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(t);
  }

  // 3. LLM 生成简报 markdown
  const dateStr = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const topicListText = Array.from(grouped.entries())
    .map(([cat, list]) => {
      const items = list
        .map(
          (t, i) =>
            `${i + 1}. [${t.priority} · 热度 ${t.heatScore}] ${t.title}${t.summary ? ` — ${t.summary.slice(0, 100)}` : ""}`,
        )
        .join("\n");
      return `### ${cat} (${list.length} 条)\n${items}`;
    })
    .join("\n\n");

  const categorySectionsExample = Array.from(grouped.keys())
    .map(
      (cat) =>
        `<h2>${cat}</h2>\n<p>（对该分类下 ${grouped.get(cat)?.length} 条热点做整体点评，1~2 句）</p>\n<ul>\n  <li><strong>【标题1】</strong> — 30~50 字一句话讲清核心事实</li>\n  <li><strong>【标题2】</strong> — ...</li>\n</ul>`,
    )
    .join("\n\n");

  const prompt = `你是资深新闻编辑，请根据下面这份 ${dateStr} 的热点清单，撰写一份**每日热点快讯**，发布到内容平台首页。

# 今日热点清单（共 ${topics.length} 条 P0/P1 级）
${topicListText}

# 输出要求
**严格输出 HTML 片段**（不是 Markdown，不是 \`\`\`html\`\`\` 代码块，不要任何前后解释文字），使用以下标签：
- 主标题：<h1>
- 分类标题：<h2>
- 段落：<p>
- 列表：<ul><li>...</li></ul>
- 强调：<strong>

输出模板（严格遵循结构与标签）：

<h1>${dateStr} 每日热点快讯</h1>

<h2>综述</h2>
<p>（150 字内，概括今日舆论场全貌：哪些事件主导热度、有什么关联趋势、读者最该关注什么）</p>

${categorySectionsExample}

<h2>编辑视角</h2>
<p>（80 字内，给读者一句行动建议，例如"建议关注 X 后续走向"）</p>

# 约束
- 必须输出**纯 HTML 片段**，每个 block 元素之间用 \\n 换行（便于阅读）
- 不要使用 Markdown 语法（# / - / **）
- 严格基于上面提供的清单，不编造未出现的事实
- 每条 <li> 用一句话讲清"是什么 + 为什么重要"，不要贴标题完事
- 综述部分不要套话（"今日热点纷呈"），要有真实信息含量
- 不要包裹 <html> / <body> / <head> 标签，只输出内容片段`;

  const config = resolveModelConfig(["content_gen"], {
    temperature: 0.4,
    maxTokens: 4096,
  });
  const model = getLanguageModel(config);

  const { text } = await generateText({
    model,
    maxOutputTokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const briefingBody = normalizeBriefingHtml(text);
  const briefingTitle = `${dateStr} 每日热点快讯`;

  // 4. 同日去重：按 title prefix 找已存在的 article
  const { articles } = await import("@/db/schema/articles");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [existingArticle] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.organizationId, organizationId),
        eq(articles.title, briefingTitle),
        drizzleGt(articles.createdAt, todayStart),
      ),
    )
    .limit(1);

  let articleId: string;
  let isNew: boolean;
  if (existingArticle) {
    await db
      .update(articles)
      .set({
        body: briefingBody,
        content: { headline: briefingTitle, body: briefingBody },
        wordCount: briefingBody.length,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, existingArticle.id));
    articleId = existingArticle.id;
    isNew = false;
  } else {
    const [created] = await db
      .insert(articles)
      .values({
        organizationId,
        title: briefingTitle,
        body: briefingBody,
        content: { headline: briefingTitle, body: briefingBody },
        // 直接 'approved' 跳过 draft/reviewing —— 这次 user 决策"先直接发 CMS"。
        // 后续稿件库流程完善后改回 'draft' → 人审 → 'approved' → 发 CMS。
        status: "approved",
        createdBy: operatorId,
        tags: ["每日热点快讯", "AI 生成"],
        wordCount: briefingBody.length,
      })
      .returning({ id: articles.id });
    articleId = created.id;
    isNew = true;
  }

  // 5. 立即推送 CMS（feature flag 未启用时跳过，仅入库）
  //    推送目标（siteId/appId/catalogId）在 article-mapper 里硬编码，
  //    不再走 app_channels 绑定路径。
  let cmsResult: DailyHotBriefingResult["cmsResult"];
  try {
    const { isCmsPublishEnabled } = await import("@/lib/cms");
    if (isCmsPublishEnabled()) {
      const { publishArticleToCms } = await import("@/lib/cms");
      const res = await publishArticleToCms({
        articleId,
        operatorId,
        triggerSource: trigger === "scheduled" ? "scheduled" : "manual",
      });
      cmsResult = {
        success: res.success,
        publicationId: res.publicationId,
        cmsState: res.cmsState,
        error: res.error?.message,
      };
    } else {
      console.log("[daily-briefing] CMS publish flag disabled, skipped");
    }
  } catch (err) {
    console.error("[daily-briefing] CMS publish failed:", err);
    cmsResult = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  revalidatePath("/inspiration");
  revalidatePath("/articles");
  revalidatePath(`/articles/${articleId}`);

  return {
    articleId,
    isNew,
    topicCount: topics.length,
    cmsResult,
  };
}

