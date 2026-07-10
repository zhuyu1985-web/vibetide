/**
 * 内容生产闭环编排器 —— 同步部分。
 *
 * 职责：解析当前阶段的语音/文字指令 → 校验 → 派异步 Inngest 步骤事件
 * （重活：抓热点/出选题/写初稿，避开 IM webhook 超时）→ 推进 scenarioPhase
 * → 立即回执。重活与回卡在 content-loop-step.ts handler 里做。
 *
 * 红线：每步 fire-and-forget 一个事件，绝不把 7 步塞进一个 DAG mission。
 */
import { inngest } from "@/inngest/client";
import {
  updateSession,
  CONTENT_LOOP_TTL_MS,
  type ChannelSessionRow,
} from "@/lib/dal/channel-sessions";
import type { ContentLoopContext } from "@/db/schema/channel-sessions";
import type { StandardizedMessage } from "../gateway";
import {
  isExitLoop,
  isRegenerate,
  parseSelection,
  isTranslateIntent,
  extractTargetLanguage,
  isFinalizeIntent,
  isSubmitReviewIntent,
  parseMultiSelection,
  isAnalyzeIntent,
} from "./intents";
import { renderReviewerCandidateCard, renderDistributionCard } from "./cards";
import { listReviewerCandidates } from "@/lib/dal/review-results";
import { listAllActiveCmsCatalogs } from "@/lib/dal/cms-catalogs";
import { isPublishIntent } from "../publish-intent";

export interface ContentLoopChannelCtx {
  organizationId: string;
  configId: string;
  platform: "dingtalk" | "wechat_work";
  chatId: string;
  externalUserId: string;
}

type LoopStep =
  | "fetch_topics"
  | "gen_angles"
  | "gen_draft"
  | "revise"
  | "translate"
  | "submit_review"
  | "publish"
  | "analyze";

function loopTtl(): Date {
  return new Date(Date.now() + CONTENT_LOOP_TTL_MS);
}

/** hot_list 空候选连续次数达到此阈值后，主动给出"重新获取/退出"出口。 */
const HOTLIST_WAIT_THRESHOLD = 3;

async function dispatchStep(
  step: LoopStep,
  session: ChannelSessionRow,
  channelCtx: ContentLoopChannelCtx,
  msg: StandardizedMessage,
  extra?: {
    instruction?: string;
    targetLang?: string;
    targetLangLabel?: string;
    assigneeUserId?: string;
    assigneeName?: string;
    selectedIdx?: number[];
  },
): Promise<void> {
  await inngest.send({
    name: "content-loop/step.requested",
    id: `cl:${step}:${session.id}:${msg.externalMessageId}`,
    data: {
      organizationId: session.organizationId,
      sessionId: session.id,
      step,
      channelCtx,
      // 把"本条用户消息"的 sessionWebhook 透传给本步异步回执，统一用 @ 的 app 机器人身份回卡。
      replyWebhook: msg.replyWebhook,
      ...extra,
    },
  });
}

/** 进入 review_pending：拉审核人候选 + 渲染候选卡（保存稿库 + 提交审核触发）。 */
async function enterReviewPending(
  session: ChannelSessionRow,
  ctx: ContentLoopContext,
): Promise<{ reply: string }> {
  if (!session.lastArticleId) {
    return { reply: "还没有可提交的稿件，请先生成初稿。" };
  }
  const cands = await listReviewerCandidates(session.organizationId);
  if (cands.length === 0) {
    return { reply: "当前没有可指派的审核人，请联系管理员在系统里添加平台用户。" };
  }
  const candidates = cands.slice(0, 6).map((c, i) => ({
    idx: i + 1,
    userId: c.userId,
    name: c.displayName,
    pendingCount: c.pendingCount,
  }));
  await updateSession(session.id, {
    scenarioPhase: "review_pending",
    loopContext: { ...ctx, reviewerCandidates: candidates, reviewId: undefined },
    expiresAt: loopTtl(),
  });
  return { reply: renderReviewerCandidateCard(candidates) };
}

/** 海外平台（本期仅标记 pending_overseas，不真发）。 */
const OVERSEAS_PLATFORMS = [
  { platform: "tiktok", name: "TikTok" },
  { platform: "instagram", name: "Instagram" },
  { platform: "twitter", name: "X/Twitter" },
];

/** 进入 publishing：列国内 CMS 栏目 + 海外平台候选 + 渲染选择卡。 */
async function enterPublishing(
  session: ChannelSessionRow,
  ctx: ContentLoopContext,
): Promise<{ reply: string }> {
  if (!session.lastArticleId) {
    return { reply: "没有可发布的稿件。" };
  }
  const catalogs = await listAllActiveCmsCatalogs(session.organizationId);
  const domestic = catalogs.slice(0, 5).map((c, i) => ({
    idx: i + 1,
    catalogId: c.cmsCatalogId,
    appId: c.appId,
    siteId: c.siteId,
    name: c.name,
  }));
  const overseas = OVERSEAS_PLATFORMS.map((o, i) => ({
    idx: domestic.length + i + 1,
    platform: o.platform,
    name: o.name,
  }));
  if (domestic.length === 0 && overseas.length === 0) {
    return { reply: "当前没有可用的发布渠道，请先在系统里配置 CMS 栏目。" };
  }
  await updateSession(session.id, {
    scenarioPhase: "publishing",
    loopContext: { ...ctx, pendingDistribution: { domestic, overseas } },
    expiresAt: loopTtl(),
  });
  return { reply: renderDistributionCard(domestic, overseas) };
}

/** idle 态收到"获取今天的热点" → 进入闭环 hot_list 阶段并派抓榜事件。 */
export async function startContentLoop(
  msg: StandardizedMessage,
  session: ChannelSessionRow,
  channelCtx: ContentLoopChannelCtx,
): Promise<{ reply: string }> {
  await updateSession(session.id, {
    scenarioPhase: "hot_list",
    status: "idle",
    loopContext: {}, // 全新闭环，清空旧候选
    activeTopicId: null,
    lastArticleId: null,
    expiresAt: loopTtl(),
  });
  await dispatchStep("fetch_topics", session, channelCtx, msg);
  return { reply: "🔍 正在获取今天的热点，稍候…" };
}

/** 闭环进行中（scenarioPhase !== 'idle'）的阶段感知路由。 */
export async function handleContentLoopMessage(
  text: string,
  msg: StandardizedMessage,
  session: ChannelSessionRow,
  channelCtx: ContentLoopChannelCtx,
): Promise<{ reply: string }> {
  if (isExitLoop(text)) {
    await updateSession(session.id, {
      scenarioPhase: "idle",
      status: "idle",
      loopContext: null,
      activeTopicId: null,
      expiresAt: null,
    });
    return { reply: "已退出内容生产闭环。需要时再说「获取今天的热点」。" };
  }

  const ctx = (session.loopContext ?? {}) as ContentLoopContext;

  switch (session.scenarioPhase) {
    case "hot_list": {
      if (isRegenerate(text)) {
        await dispatchStep("fetch_topics", session, channelCtx, msg);
        return { reply: "🔄 重新获取今日热点中…" };
      }
      const cands = ctx.topicCandidates ?? [];
      if (cands.length === 0) {
        // 计数是 poll 驱动而非时间驱动：只有用户再发一条消息撞到这里才 +1，
        // 不会自行随时间推进（抓榜真正的失败回滚在 content-loop-step 的 fetch_topics 分支）。
        const waited = (ctx.hotlistWaitCount ?? 0) + 1;
        await updateSession(session.id, {
          loopContext: { ...ctx, hotlistWaitCount: waited },
          expiresAt: loopTtl(),
        });
        if (waited >= HOTLIST_WAIT_THRESHOLD) {
          return {
            reply:
              "热点抓取似乎没成功（可能热榜服务暂时不可用）。回复「重新获取」再试一次，或回复「退出」结束。",
          };
        }
        // 候选为空但未到上限：主动重抓一次（自愈丢失的 fetch_topics 事件），而不是干等
        await dispatchStep("fetch_topics", session, channelCtx, msg);
        return { reply: "🔄 正在重新获取今日热点，稍候…" };
      }
      const sel = parseSelection(text, cands.length);
      if (sel == null) {
        return { reply: "说编号选一个，比如「选第 2 个」。" };
      }
      if (sel < 1 || sel > cands.length) {
        return { reply: `只有 ${cands.length} 条热点，请说 1~${cands.length}。` };
      }
      const chosen = cands[sel - 1];
      await updateSession(session.id, {
        scenarioPhase: "topic_select",
        activeTopicId: chosen.topicId ?? null,
        loopContext: {
          ...ctx,
          selectedTopic: { topicId: chosen.topicId, title: chosen.title },
          angleOptions: undefined, // 重选热点 → 旧选题作废
          selectedAngle: undefined,
        },
        expiresAt: loopTtl(),
      });
      await dispatchStep("gen_angles", session, channelCtx, msg);
      return { reply: `已选「${chosen.title}」，✍️ 正在生成 3 个不同视角的选题…` };
    }

    case "topic_select": {
      if (isRegenerate(text)) {
        await dispatchStep("gen_angles", session, channelCtx, msg);
        return { reply: "🔄 重新生成 3 个视角选题中…" };
      }
      const angles = ctx.angleOptions ?? [];
      if (angles.length === 0) {
        return { reply: "选题还在生成中，稍等几秒。" };
      }
      const sel = parseSelection(text, angles.length);
      if (sel == null) {
        return { reply: "说 A / B / C 或「选第 N 个」锁定视角。" };
      }
      if (sel < 1 || sel > angles.length) {
        return { reply: `只有 ${angles.length} 个视角，请说 1~${angles.length}。` };
      }
      const chosen = angles[sel - 1];
      await updateSession(session.id, {
        scenarioPhase: "drafting",
        loopContext: {
          ...ctx,
          selectedAngle: { idx: chosen.idx, label: chosen.label, pitch: chosen.pitch },
        },
        expiresAt: loopTtl(),
      });
      await dispatchStep("gen_draft", session, channelCtx, msg);
      return { reply: `已选视角「${chosen.label}」，📝 正在写 1000 字初稿…` };
    }

    case "drafting": {
      if (isRegenerate(text)) {
        await dispatchStep("gen_draft", session, channelCtx, msg);
        return { reply: "🔄 正在重写初稿…" };
      }
      if (isTranslateIntent(text)) {
        const lang = extractTargetLanguage(text);
        await updateSession(session.id, {
          scenarioPhase: "translating",
          loopContext: { ...ctx, targetLanguage: lang },
          expiresAt: loopTtl(),
        });
        await dispatchStep("translate", session, channelCtx, msg, {
          targetLang: lang.code,
          targetLangLabel: lang.label,
        });
        return { reply: `🌐 正在把稿件转写成${lang.label}…` };
      }
      if (isSubmitReviewIntent(text)) {
        return enterReviewPending(session, ctx);
      }
      if (isFinalizeIntent(text)) {
        return {
          reply:
            "✅ 已定稿。说「提交审核」送审，或「转成英文」做多语种，也可以继续提修改要求。",
        };
      }
      // 其余自由文本 = 改稿指令
      await dispatchStep("revise", session, channelCtx, msg, {
        instruction: text,
      });
      return { reply: "✏️ 正在按你的要求改稿，稍候…" };
    }

    case "translating": {
      const lang = ctx.targetLanguage ?? { code: "en", label: "英文" };
      if (isRegenerate(text)) {
        await dispatchStep("translate", session, channelCtx, msg, {
          targetLang: lang.code,
          targetLangLabel: lang.label,
        });
        return { reply: `🔄 正在重新转写成${lang.label}…` };
      }
      if (isTranslateIntent(text)) {
        const next = extractTargetLanguage(text);
        await updateSession(session.id, {
          loopContext: { ...ctx, targetLanguage: next },
          expiresAt: loopTtl(),
        });
        await dispatchStep("translate", session, channelCtx, msg, {
          targetLang: next.code,
          targetLangLabel: next.label,
        });
        return { reply: `🌐 正在转写成${next.label}…` };
      }
      if (isSubmitReviewIntent(text)) {
        return enterReviewPending(session, ctx);
      }
      if (isFinalizeIntent(text)) {
        return { reply: "✅ 外文也定了。说「提交审核」送审，或继续提修改要求。" };
      }
      // 其余自由文本 = 改外文稿指令
      await dispatchStep("revise", session, channelCtx, msg, {
        instruction: text,
      });
      return { reply: `✏️ 正在按你的要求修改${lang.label}稿，稍候…` };
    }

    case "review_pending": {
      // 已提交（有 reviewId）→ 等待审核人结果
      if (ctx.reviewId) {
        if (/撤回|取消审核|不审了|撤销/.test(text)) {
          await updateSession(session.id, {
            scenarioPhase: "drafting",
            loopContext: { ...ctx, reviewId: undefined },
            expiresAt: loopTtl(),
          });
          return {
            reply: "已撤回审核，回到改稿。继续提修改要求，或重新说「提交审核」。",
          };
        }
        return {
          reply: "稿件审核中，等审核人结果。可说「撤回」回到改稿，或「退出」结束。",
        };
      }
      // 选审核人
      const cands = ctx.reviewerCandidates ?? [];
      if (cands.length === 0) {
        return enterReviewPending(session, ctx);
      }
      const sel = parseSelection(text, cands.length);
      if (sel == null) {
        return { reply: "说编号选审核人，比如「发给第 1 个审」。" };
      }
      if (sel < 1 || sel > cands.length) {
        return { reply: `只有 ${cands.length} 位候选，请说 1~${cands.length}。` };
      }
      const chosen = cands[sel - 1];
      await dispatchStep("submit_review", session, channelCtx, msg, {
        assigneeUserId: chosen.userId,
        assigneeName: chosen.name,
      });
      return { reply: `已选审核人「${chosen.name}」，正在提交审核…` };
    }

    case "approved": {
      if (isPublishIntent(text)) {
        return enterPublishing(session, ctx);
      }
      return {
        reply:
          "✅ 稿件已通过审核。说「发到民生频道」或「发布」指定渠道开始发布，或「退出」结束。",
      };
    }

    case "publishing": {
      const dist = ctx.pendingDistribution;
      if (!dist) return enterPublishing(session, ctx);
      if (/取消|不发了|再想想|先不发/.test(text)) {
        await updateSession(session.id, {
          scenarioPhase: "approved",
          loopContext: { ...ctx, pendingDistribution: undefined },
          expiresAt: loopTtl(),
        });
        return { reply: "已取消发布。说「发布」可重新选择渠道。" };
      }
      const sel = parseMultiSelection(text);
      if (!sel) {
        return { reply: "回复编号选择，比如「发 1 和 3」「都发」「只发国内」。" };
      }
      const allIdx = [
        ...dist.domestic.map((d) => d.idx),
        ...dist.overseas.map((o) => o.idx),
      ];
      let chosen: number[];
      if (sel.kind === "all") chosen = allIdx;
      else if (sel.kind === "domestic") chosen = dist.domestic.map((d) => d.idx);
      else if (sel.kind === "overseas") chosen = dist.overseas.map((o) => o.idx);
      else chosen = sel.idx.filter((i) => allIdx.includes(i));
      if (chosen.length === 0) {
        return { reply: `编号超出范围，请从 1~${allIdx.length} 选，或说「都发」。` };
      }
      await dispatchStep("publish", session, channelCtx, msg, {
        selectedIdx: chosen,
      });
      return { reply: "🚀 正在发布，稍候…" };
    }

    case "analytics": {
      if (isAnalyzeIntent(text)) {
        await dispatchStep("analyze", session, channelCtx, msg);
        return { reply: "📊 正在统计这篇的传播数据，稍候…" };
      }
      return { reply: "说「查这篇传播数据」看复盘，或「退出」结束本次闭环。" };
    }

    default:
      return { reply: "该阶段将在后续版本上线。说「退出」可结束闭环。" };
  }
}
