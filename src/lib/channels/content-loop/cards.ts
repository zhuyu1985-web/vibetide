/**
 * 内容生产闭环的 IM 卡片渲染（纯函数，markdown）。
 * 字段对齐 channel-sessions.ts 的 ContentLoopContext。
 */
import type { ContentLoopContext } from "@/db/schema/channel-sessions";

type TopicCandidate = NonNullable<ContentLoopContext["topicCandidates"]>[number];
type AngleOption = NonNullable<ContentLoopContext["angleOptions"]>[number];

/** A/B/C… 编号（1→A）。 */
function letter(idx: number): string {
  return String.fromCharCode(64 + idx);
}

/** 热点清单卡（hot_list 阶段）。 */
export function renderHotListCard(candidates: TopicCandidate[]): string {
  const lines = candidates.map((c) => {
    const heat = c.heat ? `  🔥${c.heat}` : "";
    const src = c.source ? `（${c.source}）` : "";
    return `${c.idx}. ${c.title}${src}${heat}`;
  });
  return [
    `🔥 今日热点（取前 ${candidates.length} 条）`,
    "",
    ...lines,
    "",
    "👉 说编号选一个，比如「选第 3 个」，我来出 3 个不同视角的选题。",
  ].join("\n");
}

/** 3 视角选题卡（topic_select 阶段）。 */
export function renderAngleCard(topicTitle: string, angles: AngleOption[]): string {
  const lines = angles.map((a) => {
    const persp = a.perspective ? ` · ${a.perspective}` : "";
    const pitch = a.pitch ? ` —— ${a.pitch}` : "";
    const words = a.estWords ? `（约${a.estWords}字）` : "";
    return `【${letter(a.idx)}${persp}】${a.label}${pitch}${words}`;
  });
  return [
    `✍️ 围绕「${topicTitle}」给你 3 个视角：`,
    "",
    ...lines,
    "",
    "👉 说 A / B / C 或「选第 N 个」锁定，或说「换一批」。",
  ].join("\n");
}

/** 审核人候选卡（review_pending 阶段，作者侧）。 */
export function renderReviewerCandidateCard(
  candidates: { idx: number; name: string; pendingCount: number }[],
): string {
  const lines = candidates.map((c) => {
    const load = c.pendingCount === 0 ? "🟢空闲" : `当前 ${c.pendingCount} 条待审`;
    return `${c.idx}. ${c.name}  —— ${load}`;
  });
  return [
    "✅ 已保存到稿库。选一位审核人，我把审核任务推到 TA 的对话窗：",
    "",
    ...lines,
    "",
    "👉 说编号选一位，比如「发给第 1 个审」。",
  ].join("\n");
}

/** 审核任务卡（投递到审核人 cowork 对话窗）。 */
export function renderReviewTaskCard(
  articleTitle: string,
  preview: string,
  authorLabel: string,
  language: string,
): string {
  const langTag = language === "zh" ? "" : `（${language}）`;
  const body = preview.length > 200 ? `${preview.slice(0, 200)}…` : preview;
  return [
    `🔔 有一篇稿件请你审核（来自 ${authorLabel}）`,
    "",
    `**标题** ${articleTitle}${langTag}`,
    "",
    body,
    "",
    "👉 直接说「通过」放行；要打回说「驳回，<理由>」。",
  ].join("\n");
}

/** 单篇传播复盘卡（analytics 阶段）。 */
export function renderSpreadCard(
  title: string,
  spread: {
    aggregated: { views: number; comments: number; shares: number };
    byChannel: { channel: string; views: number; pct?: number; status?: string }[];
  },
  insight: string,
  syncedAt: string,
): string {
  const a = spread.aggregated;
  const channelLines = spread.byChannel.map((c) => {
    if (c.status === "pending_overseas") return `  · ${c.channel}  待发布（未计入）`;
    const pct = c.pct != null ? ` · 占 ${c.pct}%` : "";
    return `  · ${c.channel}  ${c.views} 阅读${pct}`;
  });
  return [
    `📊「${title}」传播复盘（数据截至 ${syncedAt}）`,
    "",
    `  阅读 ${a.views}  ｜ 评论 ${a.comments}  ｜ 转发 ${a.shares}`,
    "",
    "渠道流量：",
    ...channelLines,
    "",
    `🔎 ${insight}`,
    "👉 想刷新说「再查一次」，或「退出」结束。",
  ].join("\n");
}

/** 发布渠道账号选择卡（publishing 阶段）。 */
export function renderDistributionCard(
  domestic: { idx: number; name: string }[],
  overseas: { idx: number; platform: string; name: string }[],
): string {
  const lines: string[] = ["🚀 这篇审核已通过，发到哪些渠道？", ""];
  if (domestic.length) {
    lines.push("【国内 · 真发布】");
    domestic.forEach((d) => lines.push(`  ${d.idx}. ${d.name}（CMS）`));
  }
  if (overseas.length) {
    lines.push("【海外 · 仅标记待发布，本期不真发】");
    overseas.forEach((o) => lines.push(`  ${o.idx}. ${o.name}`));
  }
  lines.push("");
  lines.push("👉 例「发 1 和 3」「都发」「只发国内」。");
  return lines.join("\n");
}

/** 发布回执卡（publishing 完成）。 */
export function renderPublishReceiptCard(
  results: { label: string; ok: boolean; kind: "domestic" | "overseas"; detail?: string }[],
): string {
  const lines = results.map((r) => {
    if (r.kind === "overseas") return `  🕓 ${r.label}  已标记「待发布」（本期不自动发）`;
    return r.ok
      ? `  ✅ ${r.label}  ${r.detail ?? "已提交"}`
      : `  ❌ ${r.label}  ${r.detail ?? "发布失败"}`;
  });
  return [
    "🚀 发布结果：",
    "",
    ...lines,
    "",
    "想看效果稍后说「查这篇传播数据」。",
  ].join("\n");
}

/** 初稿预览卡（drafting 阶段）。 */
export function renderDraftCard(
  title: string,
  wordCount: number,
  body: string,
): string {
  const preview = body.length > 220 ? `${body.slice(0, 220)}…` : body;
  return [
    `📄 初稿已生成（${wordCount} 字）`,
    "",
    `**${title}**`,
    "",
    preview,
    "",
    "👉 多轮改稿 / 转外文 / 提交审核 将在后续阶段开放。说「重写」可重新生成。",
  ].join("\n");
}
