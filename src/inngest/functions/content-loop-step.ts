import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { generateText } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema/articles";
import { externalPublications } from "@/db/schema/external-publications";
import { publishArticleToCms, CmsConfigError } from "@/lib/cms";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";
import { reviseDraft, splitTitleBody, deriveTitle } from "@/lib/content/revise";
import { invokeToolDirectly } from "@/lib/agent/tool-registry";
import { getChannelConfig } from "@/lib/dal/channels";
import { sendChannelMessage } from "@/lib/channels/outbound";
import {
  getSessionById,
  updateSession,
  CONTENT_LOOP_TTL_MS,
} from "@/lib/dal/channel-sessions";
import { appendArticleVersion } from "@/lib/dal/article-versions";
import {
  createReviewForArticle,
  deliverReviewToReviewerCowork,
} from "@/lib/dal/review-results";
import type { ContentLoopContext } from "@/db/schema/channel-sessions";
import type { ReviewImThread } from "@/db/schema/reviews";
import {
  renderHotListCard,
  renderAngleCard,
  renderDraftCard,
  renderReviewTaskCard,
  renderPublishReceiptCard,
  renderSpreadCard,
} from "@/lib/channels/content-loop/cards";
import {
  aggregateArticleSpread,
  type ArticleSpread,
} from "@/lib/channels/content-loop/spread";

type StepData = InngestEvents["content-loop/step.requested"]["data"];
type ChannelCtx = StepData["channelCtx"];
type AngleOption = NonNullable<ContentLoopContext["angleOptions"]>[number];

function loopTtl(): Date {
  return new Date(Date.now() + CONTENT_LOOP_TTL_MS);
}

/** 主动推卡片回 IM（两端通用，照抄 AIGC handler 的回执范式）。失败不抛。 */
async function pushCard(
  channelCtx: ChannelCtx,
  title: string,
  content: string,
): Promise<void> {
  try {
    const config = await getChannelConfig(channelCtx.configId);
    if (config) {
      await sendChannelMessage({ config, chatId: channelCtx.chatId, type: "markdown", title, content });
    }
  } catch (err) {
    console.error("[content-loop] 回执失败:", err);
  }
}

/** 去 JSON 围栏 + 截取数组体（兼容 LLM 偶发加 ```json）。 */
function stripJsonArray(text: string): string {
  let t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return t;
}

/** 直调模型出 3 个差异化视角（确定性 JSON，不走 skill 的 LLM 文本解析）。 */
async function generateAngles(topic: string): Promise<AngleOption[]> {
  const prompt =
    `你是资深内容策划。围绕热点「${topic}」给出 3 个差异化创作视角` +
    `（如深度分析 / 大众解读 / 行业观点 / 热点延伸 等不同角度），用于新媒体新闻资讯写作。\n` +
    `只输出 JSON 数组，不要任何解释或代码围栏，正好 3 个，格式：\n` +
    `[{"label":"视角短名(≤12字)","pitch":"一句话切入(≤30字)","perspective":"角度类型(如 深度分析/大众解读/行业观点)"}]`;
  try {
    const { text } = await generateText({
      model: getLanguageModel({
        provider: "openai",
        model: getDefaultModel(),
        temperature: 0.7,
        maxTokens: 600,
      }),
      prompt,
      maxOutputTokens: 600,
    });
    const arr = JSON.parse(stripJsonArray(text)) as {
      label?: string;
      pitch?: string;
      perspective?: string;
    }[];
    return arr.slice(0, 3).map((a, i) => ({
      idx: i + 1,
      label: a.label?.trim() || `视角 ${i + 1}`,
      pitch: a.pitch?.trim(),
      perspective: a.perspective?.trim(),
    }));
  } catch (err) {
    console.error("[content-loop] generateAngles 失败:", err);
    return [];
  }
}

/** 转外文：本地化改写（非逐字直译），保留事实。 */
async function translateDraft(
  body: string,
  title: string,
  langLabel: string,
): Promise<{ title: string; body: string } | null> {
  const prompt =
    `你是资深双语新闻编辑。把下面的中文稿件本地化改写成${langLabel}` +
    `（不是逐字直译，要符合${langLabel}读者的表达习惯与新闻语感）。\n` +
    `铁律：① 保留所有事实、数字、引用、人名地名时间不变；② 标题也要地道；③ 全文用${langLabel}。\n` +
    `输出：第一行是${langLabel}标题，空一行后是${langLabel}正文。不要任何解释或代码围栏。\n\n` +
    `【中文标题】${title}\n【中文正文】\n${body}`;
  try {
    const { text } = await generateText({
      model: getLanguageModel({
        provider: "openai",
        model: getDefaultModel(),
        temperature: 0.4,
        maxTokens: 2600,
      }),
      prompt,
      maxOutputTokens: 2600,
    });
    const parsed = splitTitleBody(text, title);
    return parsed.body.trim() ? parsed : null;
  } catch (err) {
    console.error("[content-loop] translateDraft 失败:", err);
    return null;
  }
}

/** 把稿件发到一个 CMS 栏目（先 bump approved，失败回滚）。 */
async function publishArticleToOneCatalog(
  orgId: string,
  articleId: string,
  catalog: { catalogId: number; appId: number; siteId: number; name: string },
): Promise<{ ok: boolean; detail?: string }> {
  const cur = await db
    .select({ status: articles.status })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.organizationId, orgId)))
    .limit(1);
  const origStatus = cur[0]?.status;
  const bumped = origStatus === "draft" || origStatus === "reviewing";
  if (bumped) {
    await db
      .update(articles)
      .set({ status: "approved" })
      .where(and(eq(articles.id, articleId), eq(articles.organizationId, orgId)));
  }
  try {
    const result = await publishArticleToCms({
      articleId,
      operatorId: "channel_system",
      triggerSource: "manual",
      target: { catalogId: catalog.catalogId, appId: catalog.appId, siteId: catalog.siteId },
      allowUpdate: true,
    });
    return { ok: true, detail: result.publishedUrl ?? result.previewUrl ?? "已提交，审核中" };
  } catch (err) {
    if (bumped && origStatus) {
      await db
        .update(articles)
        .set({ status: origStatus })
        .where(and(eq(articles.id, articleId), eq(articles.organizationId, orgId)));
    }
    if (err instanceof CmsConfigError) return { ok: false, detail: "该组织未开启发布功能" };
    return { ok: false, detail: err instanceof Error ? err.message : "发布失败" };
  }
}

/** 找该中文母稿的英文译稿（海外优先发英文）。 */
async function findEnArticle(orgId: string, zhArticleId: string): Promise<string | null> {
  const r = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(
        eq(articles.organizationId, orgId),
        eq(articles.translatedFromArticleId, zhArticleId),
        eq(articles.language, "en"),
      ),
    )
    .orderBy(desc(articles.createdAt))
    .limit(1);
  return r[0]?.id ?? null;
}

/** 海外平台标记 pending_overseas（决策 D：本期不真发，只挂起待人工）。 */
async function markOverseasPending(
  orgId: string,
  articleId: string,
  platform: string,
): Promise<void> {
  await db.insert(externalPublications).values({
    organizationId: orgId,
    articleId,
    platform,
    status: "pending_overseas",
    operatorId: "channel_system",
  });
  await db
    .update(articles)
    .set({ externalPublishStatus: "pending_overseas", updatedAt: new Date() })
    .where(and(eq(articles.id, articleId), eq(articles.organizationId, orgId)));
}

/** 传播复盘一句话洞察（有真实数据才调 LLM，否则给固定说明）。 */
async function generateSpreadInsight(spread: ArticleSpread): Promise<string> {
  if (!spread.hasRealData) {
    return "数据采集中：国内 CMS 统计接口接入后显示真实阅读/评论；海外本期未真发，不计入。";
  }
  const a = spread.aggregated;
  try {
    const { text } = await generateText({
      model: getLanguageModel({
        provider: "openai",
        model: getDefaultModel(),
        temperature: 0.5,
        maxTokens: 160,
      }),
      prompt:
        `用一句话点评这篇稿件的传播表现（≤40字，口语化，可给一条改进建议）：\n` +
        `阅读 ${a.views}、评论 ${a.comments}、转发 ${a.shares}；` +
        `渠道：${spread.byChannel.map((c) => `${c.channel} ${c.views}`).join("、")}`,
      maxOutputTokens: 160,
    });
    return text.trim() || "传播数据已更新。";
  } catch {
    return "传播数据已更新。";
  }
}

/** 核心逻辑（可单测要 mock 依赖）：按 step 跑重活 → 回写 session → 推卡片。 */
export async function runContentLoopStep(data: StepData): Promise<void> {
  const session = await getSessionById(data.sessionId);
  if (!session) return;
  const ctx = (session.loopContext ?? {}) as ContentLoopContext;

  if (data.step === "fetch_topics") {
    const r = await invokeToolDirectly(
      "trending_topics",
      { mode: "hot", limit: 20 },
      { organizationId: data.organizationId },
    );
    if (!r.ok) {
      await updateSession(session.id, {
        scenarioPhase: "idle",
        loopContext: { ...ctx, topicCandidates: undefined, hotlistWaitCount: 0 },
      });
      await pushCard(
        data.channelCtx,
        "热点",
        `获取热点失败：${r.error}\n回复「获取今天的热点」可重试。`,
      );
      return;
    }
    const result = r.result as {
      topics?: { title: string; heat?: number | string; platform?: string }[];
    };
    const topics = (result.topics ?? []).slice(0, 8);
    if (topics.length === 0) {
      await updateSession(session.id, {
        scenarioPhase: "idle",
        loopContext: { ...ctx, topicCandidates: undefined, hotlistWaitCount: 0 },
      });
      await pushCard(data.channelCtx, "热点", "没抓到热点，回复「获取今天的热点」可重试。");
      return;
    }
    const candidates = topics.map((t, i) => ({
      idx: i + 1,
      title: t.title,
      heat: t.heat != null ? String(t.heat) : undefined,
      source: t.platform,
    }));
    await updateSession(session.id, {
      loopContext: { ...ctx, topicCandidates: candidates, hotlistWaitCount: 0 },
      expiresAt: loopTtl(),
    });
    await pushCard(data.channelCtx, "今日热点", renderHotListCard(candidates));
    return;
  }

  if (data.step === "gen_angles") {
    const topic = ctx.selectedTopic?.title;
    if (!topic) {
      await pushCard(data.channelCtx, "选题", "没找到选定的热点，请重新「获取今天的热点」。");
      return;
    }
    const angles = await generateAngles(topic);
    if (angles.length === 0) {
      await pushCard(data.channelCtx, "选题", "生成选题失败，请说「换一批」重试。");
      return;
    }
    await updateSession(session.id, {
      loopContext: { ...ctx, angleOptions: angles },
      expiresAt: loopTtl(),
    });
    await pushCard(data.channelCtx, "3 个视角选题", renderAngleCard(topic, angles));
    return;
  }

  if (data.step === "gen_draft") {
    const topic = ctx.selectedTopic?.title;
    const angle = ctx.selectedAngle;
    if (!topic || !angle) {
      await pushCard(data.channelCtx, "初稿", "缺少选题或视角，请重新选。");
      return;
    }
    const outline =
      `热点：${topic}\n创作视角：${angle.label}${angle.pitch ? `（${angle.pitch}）` : ""}\n` +
      `要求：1000 字左右的中文原创新闻/资讯稿件，含标题、导语、正文，观点清晰，有数据或案例支撑。`;
    const gen = await invokeToolDirectly(
      "content_generate",
      { outline, style: "news", maxLength: 1100 },
      { organizationId: data.organizationId },
    );
    if (!gen.ok) {
      await pushCard(data.channelCtx, "初稿", `写稿失败：${gen.error}`);
      return;
    }
    const { content, wordCount } = gen.result as { content: string; wordCount: number };
    const title = deriveTitle(content, angle.label);

    const arch = await invokeToolDirectly(
      "archive_to_drafts",
      {
        articles: [
          {
            title,
            body: content,
            language: "zh",
            sourceTopicId: ctx.selectedTopic?.topicId,
          },
        ],
        initialStatus: "draft",
        dedupBySourceUrl: false,
        organizationId: data.organizationId,
      },
      { organizationId: data.organizationId },
    );
    let articleId: string | null = session.lastArticleId ?? null;
    if (arch.ok) {
      const ar = arch.result as { firstArticleId?: string | null };
      articleId = ar.firstArticleId ?? articleId;
    }
    // 初稿落库后追加 v1 版本链 + 锚定中文母稿（translate 始终从它转写）
    if (articleId) {
      await appendArticleVersion({
        organizationId: data.organizationId,
        articleId,
        language: "zh",
        title,
        body: content,
        wordCount: wordCount ?? content.length,
        changeKind: "initial",
      }).catch((err) => console.error("[content-loop] 初稿版本留痕失败:", err));
    }
    await updateSession(session.id, {
      lastArticleId: articleId,
      loopContext: { ...ctx, draftArticleId: articleId ?? undefined },
      expiresAt: loopTtl(),
    });
    await pushCard(
      data.channelCtx,
      "初稿",
      renderDraftCard(title, wordCount ?? content.length, content),
    );
    return;
  }

  if (data.step === "revise") {
    const articleId = session.lastArticleId;
    if (!articleId) {
      await pushCard(data.channelCtx, "改稿", "没有可改的稿件，请先生成初稿。");
      return;
    }
    const article = await db.query.articles.findFirst({
      where: and(eq(articles.id, articleId), eq(articles.organizationId, data.organizationId)),
    });
    if (!article) {
      await pushCard(data.channelCtx, "改稿", "找不到稿件，请重新发起。");
      return;
    }
    const instruction = (data.instruction ?? "").trim();
    const revised = await reviseDraft(
      article.body ?? "",
      article.title,
      instruction,
      article.language,
    );
    if (!revised) {
      await pushCard(data.channelCtx, "改稿", "改稿失败，请重说一次修改要求。");
      return;
    }
    const newVersion = (article.version ?? 1) + 1;
    await db
      .update(articles)
      .set({
        title: revised.title,
        body: revised.body,
        wordCount: revised.body.length,
        version: newVersion,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));
    await appendArticleVersion({
      organizationId: data.organizationId,
      articleId,
      language: article.language,
      title: revised.title,
      body: revised.body,
      wordCount: revised.body.length,
      changeKind: "rewrite",
      changeInstruction: instruction,
    }).catch((err) => console.error("[content-loop] 改稿版本留痕失败:", err));
    await updateSession(session.id, { expiresAt: loopTtl() });
    const langTag = article.language === "zh" ? "" : `（${article.language}）`;
    await pushCard(
      data.channelCtx,
      `改稿${langTag}`,
      renderDraftCard(revised.title, revised.body.length, revised.body),
    );
    return;
  }

  if (data.step === "translate") {
    // 始终从中文母稿转写（避免在 translating 阶段对 en 稿再翻译）
    const srcId = ctx.draftArticleId ?? session.lastArticleId;
    if (!srcId) {
      await pushCard(data.channelCtx, "转写", "没有可转写的稿件，请先生成初稿。");
      return;
    }
    const src = await db.query.articles.findFirst({
      where: and(eq(articles.id, srcId), eq(articles.organizationId, data.organizationId)),
    });
    if (!src) {
      await pushCard(data.channelCtx, "转写", "找不到母稿，请重新发起。");
      return;
    }
    const langCode = data.targetLang ?? "en";
    const langLabel = data.targetLangLabel ?? "英文";
    const out = await translateDraft(src.body ?? "", src.title, langLabel);
    if (!out) {
      await pushCard(data.channelCtx, "转写", "转写失败，请说「重新翻译」重试。");
      return;
    }
    const [created] = await db
      .insert(articles)
      .values({
        organizationId: data.organizationId,
        title: out.title,
        body: out.body,
        wordCount: out.body.length,
        language: langCode,
        status: "draft",
        sourceType: "original",
        translatedFromArticleId: src.id,
        translatedFromTopicId: src.translatedFromTopicId,
        version: 1,
      })
      .returning({ id: articles.id });
    const translatedId = created.id;
    await appendArticleVersion({
      organizationId: data.organizationId,
      articleId: translatedId,
      language: langCode,
      title: out.title,
      body: out.body,
      wordCount: out.body.length,
      changeKind: "translate",
    }).catch((err) => console.error("[content-loop] 译稿版本留痕失败:", err));
    await updateSession(session.id, {
      scenarioPhase: "translating",
      lastArticleId: translatedId, // 后续改稿默认作用在译稿上
      loopContext: { ...ctx, targetLanguage: { code: langCode, label: langLabel } },
      expiresAt: loopTtl(),
    });
    await pushCard(
      data.channelCtx,
      `${langLabel}版`,
      renderDraftCard(out.title, out.body.length, out.body),
    );
    return;
  }

  if (data.step === "submit_review") {
    const articleId = session.lastArticleId;
    const assigneeUserId = data.assigneeUserId;
    if (!articleId || !assigneeUserId) {
      await pushCard(data.channelCtx, "提交审核", "提交失败，缺少稿件或审核人，请重试。");
      return;
    }
    const article = await db.query.articles.findFirst({
      where: and(eq(articles.id, articleId), eq(articles.organizationId, data.organizationId)),
    });
    if (!article) {
      await pushCard(data.channelCtx, "提交审核", "找不到稿件，请重新发起。");
      return;
    }
    const imThread: ReviewImThread = {
      author: {
        platform: data.channelCtx.platform,
        configId: data.channelCtx.configId,
        chatId: data.channelCtx.chatId,
        externalUserId: data.channelCtx.externalUserId,
        channelSessionId: session.id,
      },
    };
    const review = await createReviewForArticle({
      orgId: data.organizationId,
      articleId,
      assigneeUserId,
      imThread,
    });
    const authorLabel = data.channelCtx.externalUserId || "作者";
    const card = renderReviewTaskCard(
      article.title,
      article.summary || article.body || "",
      authorLabel,
      article.language,
    );
    await deliverReviewToReviewerCowork(data.organizationId, assigneeUserId, review.id, card);
    await updateSession(session.id, {
      loopContext: { ...ctx, reviewId: review.id },
      expiresAt: loopTtl(),
    });
    await pushCard(
      data.channelCtx,
      "提交审核",
      `✅ 已提交给「${data.assigneeName ?? "审核人"}」审核，结果出来第一时间通知你。`,
    );
    return;
  }

  if (data.step === "publish") {
    const dist = ctx.pendingDistribution;
    if (!dist) {
      await pushCard(data.channelCtx, "发布", "没有发布目标，请重新说「发布」。");
      return;
    }
    const selected = new Set(data.selectedIdx ?? []);
    const domestic = dist.domestic.filter((d) => selected.has(d.idx));
    const overseas = dist.overseas.filter((o) => selected.has(o.idx));
    // 国内发中文母稿，海外发英文译稿（若有）
    const zhId = ctx.draftArticleId ?? session.lastArticleId;
    if (!zhId) {
      await pushCard(data.channelCtx, "发布", "找不到稿件，请重新发起。");
      return;
    }

    const results: {
      label: string;
      ok: boolean;
      kind: "domestic" | "overseas";
      detail?: string;
    }[] = [];

    for (const d of domestic) {
      const r = await publishArticleToOneCatalog(data.organizationId, zhId, d);
      results.push({ label: d.name, ok: r.ok, kind: "domestic", detail: r.detail });
    }

    if (overseas.length) {
      const enId =
        (await findEnArticle(data.organizationId, zhId)) ?? session.lastArticleId ?? zhId;
      for (const o of overseas) {
        try {
          await markOverseasPending(data.organizationId, enId, o.platform);
          results.push({ label: o.name, ok: true, kind: "overseas" });
        } catch (err) {
          console.error("[content-loop] 海外标记失败:", err);
          results.push({ label: o.name, ok: false, kind: "overseas", detail: "标记失败" });
        }
      }
    }

    await updateSession(session.id, {
      scenarioPhase: "analytics",
      loopContext: { ...ctx, pendingDistribution: undefined },
      expiresAt: loopTtl(),
    });
    await pushCard(data.channelCtx, "发布", renderPublishReceiptCard(results));
    return;
  }

  if (data.step === "analyze") {
    const articleId = ctx.draftArticleId ?? session.lastArticleId;
    if (!articleId) {
      await pushCard(data.channelCtx, "传播复盘", "找不到稿件，无法复盘。");
      return;
    }
    const article = await db.query.articles.findFirst({
      where: and(eq(articles.id, articleId), eq(articles.organizationId, data.organizationId)),
      columns: { title: true },
    });
    const spread = await aggregateArticleSpread(data.organizationId, articleId);
    const insight = await generateSpreadInsight(spread);
    const syncedAt = new Date().toLocaleString("zh-CN", { hour12: false }).slice(5, 16);
    await updateSession(session.id, { expiresAt: loopTtl() });
    await pushCard(
      data.channelCtx,
      "传播复盘",
      renderSpreadCard(article?.title ?? "稿件", spread, insight, syncedAt),
    );
    return;
  }
}

export const contentLoopStep = inngest.createFunction(
  {
    id: "content-loop-step",
    retries: 2,
    // 同一会话的步骤严格串行，避免并发回写 loopContext 互相覆盖
    concurrency: { limit: 1, key: "event.data.sessionId" },
  },
  { event: "content-loop/step.requested" },
  async ({ event, step }) => {
    await step.run("run-content-loop-step", () => runContentLoopStep(event.data));
    return { ok: true };
  },
);

/**
 * 终态失败核心逻辑（可单测）：fetch_topics 在 retries 用尽后仍卡 hot_list 时回滚 idle，
 * 否则不动 phase；任何情况都补推失败卡。inngest 包装只负责认领事件 + step 化。
 */
export async function handleContentLoopStepFailure(data: StepData): Promise<void> {
  if (data.step === "fetch_topics") {
    const s = await getSessionById(data.sessionId);
    if (s && s.scenarioPhase === "hot_list") {
      await updateSession(data.sessionId, { scenarioPhase: "idle" });
    }
  }
  await pushCard(data.channelCtx, "内容闭环", "❌ 处理失败，请重试，或说「退出」结束。");
}

/** 终态失败回执 —— 订阅 inngest/function.failed，仅认领本函数失败。 */
export const contentLoopStepFailureHandler = inngest.createFunction(
  { id: "content-loop-step-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const fnId = (event.data as Record<string, unknown>)?.function_id;
    if (fnId !== "content-loop-step") return;
    const originalEvent = (event.data as Record<string, unknown>)?.event as
      | { data?: StepData }
      | undefined;
    const data = originalEvent?.data;
    if (!data) return;
    await step.run("notify-failure", () => handleContentLoopStepFailure(data));
  },
);
