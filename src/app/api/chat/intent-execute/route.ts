import { verify } from "@/lib/cognitive/verify-learner";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { aiEmployees, userProfiles, intentLogs } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { streamText, stepCountIs } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { toVercelTools, invokeToolDirectly } from "@/lib/agent/tool-registry";
import { assembleAgent } from "@/lib/agent/assembly";
import { getBuiltinSkillSlugToName } from "@/lib/skill-loader";
import type { IntentResult } from "@/lib/agent/intent-recognition";
import { notifyChatMessage } from "@/lib/channels/chat-notifier";
import {
  extractSearchQuery,
  parseExplicitTimeRange,
  resolveWebSearchTimeRange,
} from "@/lib/chat/search-params";

/** Friendly Chinese labels for tool names */
const TOOL_LABELS: Record<string, string> = {
  web_search: "正在搜索互联网资料",
  web_deep_read: "正在深度阅读网页",
  trending_topics: "正在获取全网热榜",
  content_generate: "正在生成内容",
  fact_check: "正在进行事实核查",
  media_search: "正在检索媒资库",
  data_report: "正在生成数据报告",
  trend_monitor: "正在监控趋势",
  social_listening: "正在监测社交舆情",
  sentiment_analysis: "正在分析情感倾向",
  heat_scoring: "正在评估热度",
};

const TOOL_TO_SKILL: Record<string, string> = Object.fromEntries(
  getBuiltinSkillSlugToName()
);

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function extractSources(toolResult: unknown): string[] {
  if (!toolResult || typeof toolResult !== "object") return [];
  const obj = toolResult as Record<string, unknown>;
  if (Array.isArray(obj.results)) {
    const domains = new Set<string>();
    for (const r of obj.results) {
      if (r && typeof r === "object") {
        const item = r as Record<string, unknown>;
        if (typeof item.url === "string") domains.add(extractDomain(item.url));
        else if (typeof item.source === "string") domains.add(item.source);
      }
    }
    return Array.from(domains);
  }
  if (typeof obj.url === "string") return [extractDomain(obj.url)];
  return [];
}

export async function POST(req: Request) {
  try {
    // Auth
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { message, intent, conversationHistory, userEdited } = body as {
      message: string;
      intent: IntentResult;
      conversationHistory?: { role: "user" | "assistant"; content: string }[];
      userEdited?: boolean;
    };

    if (!message || !intent?.steps?.length) {
      return new Response("缺少必要参数", { status: 400 });
    }

    // Look up org
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
    });
    const orgId = profile?.organizationId;
    if (!orgId) {
      return new Response("Organization not found", { status: 403 });
    }

    // Resolve employee DB IDs for all steps
    const slugs = [...new Set(intent.steps.map((s) => s.employeeSlug))];
    const employeeRows = await Promise.all(
      slugs.map((slug) =>
        db.query.aiEmployees.findFirst({
          where: and(
            eq(aiEmployees.slug, slug),
            eq(aiEmployees.organizationId, orgId)
          ),
        })
      )
    );
    const employeeMap = new Map(
      employeeRows
        .filter(Boolean)
        .map((e) => [e!.slug, e!])
    );

    // Validate all employees exist
    for (const step of intent.steps) {
      if (!employeeMap.has(step.employeeSlug)) {
        return new Response(
          `员工 ${step.employeeSlug} 不存在`,
          { status: 404 }
        );
      }
    }

    // Log intent (fire and forget)
    db.insert(intentLogs)
      .values({
        organizationId: orgId,
        userId: user.id,
        employeeSlug: intent.steps[0].employeeSlug,
        userMessage: message,
        intentType: intent.intentType,
        intentResult: intent,
        userEdited: userEdited ?? false,
        editedIntent: userEdited ? intent : null,
      })
      .catch((err) =>
        console.error("[intent-execute] Failed to log intent:", err)
      );

    // Build SSE stream
    const encoder = new TextEncoder();
    const allSources: string[] = [];
    let referenceCount = 0;
    const usedSkills: { tool: string; skillName: string }[] = [];
    const usedToolSet = new Set<string>();

    // Accumulate the combined assistant output across all steps so we can
    // forward the Q&A to external channels after streaming completes.
    let fullAssistantOutput = "";
    const primarySlug = intent.steps[0].employeeSlug;
    const primaryEmployee = employeeMap.get(primarySlug);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: Record<string, unknown>) => {
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
              )
            );
          } catch {
            // Controller already closed
          }
        };

        let priorStepOutput = "";

        try {
          for (let i = 0; i < intent.steps.length; i++) {
            const step = intent.steps[i];
            const emp = employeeMap.get(step.employeeSlug)!;

            // Notify client of step switch
            send("step-start", {
              stepIndex: i,
              totalSteps: intent.steps.length,
              employeeSlug: step.employeeSlug,
              employeeName: step.employeeName,
              taskDescription: step.taskDescription,
            });

            // Assemble agent with skill overrides
            const agent = await assembleAgent(emp.id, undefined, {
              skillOverrides: step.skills,
            });

            const model = getLanguageModel(agent.modelConfig);
            const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs);

            // ── Server-side tool pre-execution (anti-hallucination) ─────────
            // 背景：对 "CCBN" 这类 LLM "自认为熟悉"的话题，它会绕过工具按
            // 2023 训练数据直接编内容（tool-registry.ts:1073-1083 的事故）。
            //
            // 关键坑：xiaolei 等员工的技能里有 trend_monitor / heat_scoring /
            // social_listening 这些 **没有真实 tool 实现** 的 slug（见
            // tool-registry.ts 的 createToolDefinitions —— 只有 web_search /
            // web_deep_read / trending_topics / content_generate / fact_check /
            // media_search / data_report / cms_publish 有 execute）。LLM 调
            // 这些"虚拟"工具只能拿到 `[已完成处理]` 占位，于是转头从训练数
            // 据里编。
            //
            // 解法：只要 step.skills 里出现任何"检索意图"的 slug（不管是否有
            // 真实实现），就用真实的 web_search 用户消息作 query 预执行一次，
            // 把真实结果作为前置 assistant 消息注入，禁止 LLM 补填。
            const RETRIEVAL_INTENT_SLUGS = new Set([
              "web_search",
              "web_deep_read",
              "trending_topics",
              "trend_monitor",
              "social_listening",
              "news_aggregation",
              "heat_scoring",
              "media_search",
              "knowledge_retrieval",
              "fact_check",
              "competitor_analysis",
              "sentiment_analysis",
            ]);
            const hasRetrievalIntent = step.skills.some((s) =>
              RETRIEVAL_INTENT_SLUGS.has(s)
            );
            // 识别"需要 LLM 写作"的步骤 —— 含这些技能就必须走 LLM 生成，
            // 不能短路（短路只能吐原始数据，无法产出稿件/标题/摘要）。
            const GENERATION_SLUGS = new Set([
              "content_generate",
              "headline_generate",
              "summary_generate",
              "script_generate",
              "style_rewrite",
              "translation",
              "angle_design",
              "zhongcao_script",
              "tandian_script",
              "duanju_script",
              "podcast_script",
              "zongyi_highlight",
              "aigc_script_push",
              "topic_extraction",
              "publish_strategy",
              "task_planning",
              "video_edit_plan",
              "layout_design",
              "thumbnail_generate",
              "audio_plan",
            ]);
            const hasGenerationIntent = step.skills.some((s) =>
              GENERATION_SLUGS.has(s)
            );
            const preExecBlocks: string[] = [];
            // 保存 web_search 的原始真实结果，用于短路直出
            let preExecRealResult: {
              toolName: string;
              params: Record<string, unknown>;
              result: unknown;
              count: number;
            } | null = null;

            // 只自动预执行 web_search —— 参数通用（只要 query）。
            // trending_topics 的 mode/platforms/query 高度上下文相关（比如
            // "微博科技热榜" 需要 mode=platforms + platforms=["weibo"]，
            // "成都抖音本地新闻"需要 query 过滤），server 端硬塞 mode=hot
            // 会拿到"全网热点"掩盖用户真实意图。交给 LLM 按 SKILL.md 指引
            // 自己挑参数调用。
            const toolsToPrefetch: string[] = [];
            if (hasRetrievalIntent) toolsToPrefetch.push("web_search");

            console.log(
              `[chat/intent-execute] step ${i + 1}/${intent.steps.length} ` +
                `(${step.employeeSlug}) skills=${JSON.stringify(step.skills)} ` +
                `→ prefetch=${JSON.stringify(toolsToPrefetch)}`
            );

            const searchQuery = extractSearchQuery(message);
            // 优先级：显式（场景表单 "检索时间窗: 24h"）> 自然语言推断。
            // 显式命中时跳过 widenFallback —— 用户明确指定的窗口不应被自动
            // 放宽（否则"突发新闻 1h"可能被悄悄放成 30d，彻底背离语义）。
            const explicitTimeRange = parseExplicitTimeRange(message);
            const resolvedTimeRange = resolveWebSearchTimeRange(message);
            // 自动放宽序列：当"每日/今日"窗口空载时，按 24h → 7d → 30d 逐步放宽
            // 重试，避免 LLM 拿到"0 条真实数据"之后从训练语料里伪造"看起来最近"
            // 的条目（典型翻车：每日时政热点拿到 12 天前的伪造日期）。
            const widenFallback: Array<"24h" | "7d" | "30d"> =
              !explicitTimeRange && resolvedTimeRange === "24h"
                ? ["24h", "7d", "30d"]
                : [];
            let widenedTimeRange: "1h" | "24h" | "7d" | "30d" | undefined =
              resolvedTimeRange;
            for (const toolName of toolsToPrefetch) {
              // timeRange 优先从启动表单显式字段取值（"检索时间窗: 1h/24h/7d/30d"），
              // 否则按语义推断（inferTimeRange）：
              //   "突发/今日/每日" → 24h；"本周" → 7d；"本月" → 30d；其余不设
              // 以前写死 30d 的后果：搜"每日时政热点"拿到 12 天前的旧文章
              // （tool-registry.ts 的 description 早就说过不要写死默认）。
              // query 走 extractSearchQuery —— 把场景表单格式（含 "场景：XX"
              // + 多行 key:value）解析成纯关键词串，避免 label 稀释检索。
              const params: Record<string, unknown> = {
                query: searchQuery,
                maxResults: 8,
                topic: "news",
              };
              if (resolvedTimeRange) {
                params.timeRange = resolvedTimeRange;
              }

              // 通知客户端"正在调技能"
              if (!usedToolSet.has(toolName)) {
                usedToolSet.add(toolName);
                usedSkills.push({
                  tool: toolName,
                  skillName: TOOL_TO_SKILL[toolName] ?? toolName,
                });
              }
              send("thinking", {
                tool: toolName,
                label: TOOL_LABELS[toolName] ?? `正在执行${toolName}`,
                skillName: TOOL_TO_SKILL[toolName] ?? toolName,
              });

              let invocation = await invokeToolDirectly(toolName, params, {
                organizationId: orgId,
                operatorId: user.id,
              });

              // 自动放宽：24h 0 条 → 7d → 30d，直到拿到 ≥1 条真实数据
              if (toolName === "web_search" && widenFallback.length > 0) {
                const readCount = (inv: typeof invocation) => {
                  if (!inv.ok) return 0;
                  const obj = inv.result as { results?: unknown[] } | null;
                  return Array.isArray(obj?.results) ? obj!.results!.length : 0;
                };
                let idx = widenFallback.indexOf(
                  (params.timeRange ?? "24h") as "24h" | "7d" | "30d",
                );
                while (readCount(invocation) === 0 && idx < widenFallback.length - 1) {
                  idx += 1;
                  const nextRange = widenFallback[idx];
                  console.log(
                    `[chat/intent-execute] pre-exec ${toolName} empty at ${params.timeRange}, widening to ${nextRange}`,
                  );
                  params.timeRange = nextRange;
                  widenedTimeRange = nextRange;
                  send("thinking", {
                    tool: toolName,
                    label: `${TOOL_LABELS[toolName] ?? toolName}（扩大时间窗到 ${nextRange}）`,
                    skillName: TOOL_TO_SKILL[toolName] ?? toolName,
                  });
                  invocation = await invokeToolDirectly(toolName, params, {
                    organizationId: orgId,
                    operatorId: user.id,
                  });
                }
              }

              if (invocation.ok) {
                const sources = extractSources(invocation.result);
                if (sources.length > 0) {
                  for (const s of sources) {
                    if (!allSources.includes(s)) allSources.push(s);
                  }
                  referenceCount += sources.length;
                  send("source", {
                    tool: toolName,
                    sources,
                    totalSources: allSources.length,
                    totalReferences: referenceCount,
                  });
                }

                const serialized = JSON.stringify(invocation.result, null, 2);
                const truncated =
                  serialized.length > 8000
                    ? serialized.slice(0, 8000) +
                      "\n... (结果过长已截断)"
                    : serialized;

                // 探测列表长度 —— 0 条 / ≤2 条加强警示，防止 LLM 补填
                const resultObj = invocation.result as {
                  results?: unknown[];
                  topics?: unknown[];
                } | null;
                const list =
                  resultObj && typeof resultObj === "object"
                    ? (Array.isArray(resultObj.results)
                        ? resultObj.results
                        : Array.isArray(resultObj.topics)
                          ? resultObj.topics
                          : null)
                    : null;
                let hint = "";
                if (list) {
                  if (list.length === 0) {
                    hint = `\n\n⚠️ 真实结果为空（0 条）。你必须如实告知用户"未检索到最新结果"，并建议调整关键词或时间范围。**严禁从训练数据里补填任何文章、日期、数据、引用** —— 这是伪造。`;
                  } else if (list.length <= 2) {
                    hint = `\n\n⚠️ 真实结果仅 ${list.length} 条。只在这 ${list.length} 条内做处理；**不得**从训练数据里补充其他条目（哪怕你"记得"的相关新闻）。日期、标题、来源、数据点必须 1:1 引用结果字段。`;
                  }
                }

                const countForLog = Array.isArray(list) ? list.length : 0;
                console.log(
                  `[chat/intent-execute] pre-exec ${toolName} for "${message}":`,
                  {
                    resultCount: Array.isArray(list) ? list.length : "n/a",
                    stepSkills: step.skills,
                  }
                );

                // 保存第一个成功的 web_search 结果用于短路直出
                if (toolName === "web_search" && !preExecRealResult) {
                  preExecRealResult = {
                    toolName,
                    params: invocation.params,
                    result: invocation.result,
                    count: countForLog,
                  };
                }

                preExecBlocks.push(
                  `【前置工具调用结果（server 端已执行，这是真实数据）】\n调用：\`${toolName}(${JSON.stringify(
                    invocation.params
                  )})\`\n\n结果：\n\`\`\`json\n${truncated}\n\`\`\`${hint}`
                );
              } else {
                console.warn(
                  `[chat/intent-execute] pre-exec ${toolName} FAILED:`,
                  invocation.error
                );
                preExecBlocks.push(
                  `【前置工具调用失败（server 端已尝试）】\n调用：\`${toolName}(${JSON.stringify(
                    params
                  )})\`\n\n错误：${invocation.error}\n\n请如实报告该工具失败；不要凭空编造结果。`
                );
              }
            }

            // 本步骤最终输出 —— 短路分支和 LLM 分支都会写它
            let stepText = "";

            // ── Short-circuit: skip LLM for pure-retrieval steps ────────────
            // 经验教训（mission-executor.ts:804-812 亲测）：对 DeepSeek 这类
            // 模型，"真实数据 + 严禁补填" 的 prompt 指令压不住它按 SKILL.md 模
            // 板生编内容的惯性。唯一可靠方法是 server 端直接把真实结果格式化
            // 为步骤输出，完全跳过 LLM 生成。
            //
            // 触发条件：有 web_search 真实结果 + 步骤只含检索类技能（不含任何
            // 需要写作的生成类技能）。例如 xiaolei 的"热点监控"纯检索步骤 →
            // 直出真实新闻列表，不交 LLM。若含 content_generate 等生成类技能
            // 就必须走 LLM，只能靠强 prompt 约束（LLM 写稿才是该步骤的 job）。
            //
            // 2026-04-23 修正：阈值从 ≥3 下调到 ≥1，count=0 也短路。原先希望
            // "一两条太少就让 LLM 实话实说"，实测 DeepSeek 根本不会实话实说
            // ——"每日时政热点"拿到 1 条真实数据后，LLM 转头从训练语料里又
            // 编 2-3 条"看起来最近"的假新闻（例如 12 天前的伪造条目）。
            // 有几条真数据就展示几条，没有就直出"未检索到"，坚决不给 LLM
            // 伪造空间。
            if (
              preExecRealResult &&
              hasRetrievalIntent &&
              !hasGenerationIntent
            ) {
              const todayIso = new Date().toISOString().slice(0, 10);
              const result = preExecRealResult.result as {
                query?: string;
                generatedAt?: string;
                summary?: string;
                coverage?: { returnedCount?: number; sourceCount?: number };
                results?: Array<{
                  title?: string;
                  snippet?: string;
                  url?: string;
                  source?: string;
                  sourceType?: string;
                  publishedAt?: string;
                }>;
                hotTopics?: Array<{
                  topic?: string;
                  representativeTitle?: string;
                  latestPublishedAt?: string;
                  sources?: string[];
                  heatLevel?: string;
                }>;
              };
              const resultsList = Array.isArray(result.results) ? result.results : [];
              const topicsList = Array.isArray(result.hotTopics) ? result.hotTopics : [];

              // timeRange 放宽提示：用户输入"每日"但 24h 没命中 → 自动放宽到
              // 7d/30d 的场景，要在报告里明确标注，避免用户误以为是今日数据。
              const widenedNotice =
                resolvedTimeRange === "24h" &&
                widenedTimeRange &&
                widenedTimeRange !== "24h"
                  ? `\n\n> ⚠️ 过去 24 小时内未检索到相关报道，已自动放宽到 **${widenedTimeRange}** 窗口，以下为近期数据（非今日新发）。`
                  : "";

              // count=0 分支：明确告知未检索到，不做任何伪造。
              if (resultsList.length === 0) {
                const emptyText = `【${step.employeeName} · 实时检索报告】

**检索参数**：query="${preExecRealResult.params.query ?? ""}"，timeRange=${preExecRealResult.params.timeRange ?? "unset"}，topic=${preExecRealResult.params.topic ?? "general"}
**生成时间**：${todayIso}
**命中条数**：0 条

## 未检索到符合条件的真实报道

已按 "${resolvedTimeRange ?? "不限"}" 时间窗 + 放宽到 "${widenedTimeRange ?? "（未放宽）"}" 重试仍无命中。可能原因：
- 当前话题在过去时段无新发报道
- 检索关键词过窄（试试精简到 2-3 个核心词）
- 信源域名白名单未覆盖（当前限定央媒/行业媒体域）

**不伪造结果：** 本系统不会从训练语料里补填"看起来最近"的假新闻。请：
1. 调整关注区域或紧急程度后重试；
2. 或把时间窗显式放宽到"本周"/"本月"再发起。

---
*本步骤由 server 端直接执行，未经 LLM 改写。*`;

                send("text-delta", { text: emptyText });
                stepText = emptyText;

                send("step-complete", {
                  stepIndex: i,
                  employeeSlug: step.employeeSlug,
                  employeeName: step.employeeName,
                  summary: stepText.slice(0, 200),
                });

                priorStepOutput = stepText;
                if (intent.steps.length > 1) {
                  fullAssistantOutput +=
                    (fullAssistantOutput ? "\n\n" : "") +
                    `【${step.employeeName}】\n${stepText}`;
                } else {
                  fullAssistantOutput = stepText;
                }

                console.log(
                  `[chat/intent-execute] short-circuited empty-retrieval step ${i + 1} (${step.employeeSlug})`,
                );
                continue;
              }

              const formattedResults = resultsList
                .slice(0, 8)
                .map((r, idx) => {
                  const date = r.publishedAt
                    ? new Date(r.publishedAt).toISOString().slice(0, 10)
                    : "日期未知";
                  return `${idx + 1}. **${r.title ?? "(无标题)"}**\n   · ${r.source ?? "未知来源"}（${r.sourceType ?? ""}）· ${date}\n   · ${r.snippet ?? ""}\n   · ${r.url ?? ""}`;
                })
                .join("\n\n");

              const formattedTopics = topicsList.length
                ? topicsList
                    .slice(0, 5)
                    .map(
                      (t, idx) =>
                        `${idx + 1}. ${t.topic ?? "(无话题名)"}（${t.heatLevel ?? "observed"}，${(t.sources ?? []).join("、")}）`
                    )
                    .join("\n")
                : "暂未聚类出显著话题";

              const shortCircuitText = `【${step.employeeName} · 实时检索报告】

**检索参数**：query="${preExecRealResult.params.query ?? ""}"，timeRange=${preExecRealResult.params.timeRange ?? "unset"}，topic=${preExecRealResult.params.topic ?? "general"}
**生成时间**：${todayIso}
**命中条数**：${result.coverage?.returnedCount ?? resultsList.length} 条（来源 ${result.coverage?.sourceCount ?? 0} 个）${widenedNotice}

**检索摘要**：${result.summary ?? "（无摘要）"}

## 最新报道（按相关度排序）

${formattedResults}

## 聚类话题

${formattedTopics}

---
*本步骤由 server 端直接从 Tavily 实时返回，未经 LLM 改写，保证来源、标题、日期、URL 100% 原样。下游稿件撰写步骤请严格基于以上真实数据，不得引入训练数据里的旧内容。*`;

              // 通过 SSE 把文本分片发给前端，维持与 LLM 路径一致的 UI 体验
              send("text-delta", { text: shortCircuitText });
              stepText = shortCircuitText;

              send("step-complete", {
                stepIndex: i,
                employeeSlug: step.employeeSlug,
                employeeName: step.employeeName,
                summary: stepText.slice(0, 200),
              });

              priorStepOutput = stepText;
              if (intent.steps.length > 1) {
                fullAssistantOutput +=
                  (fullAssistantOutput ? "\n\n" : "") +
                  `【${step.employeeName}】\n${stepText}`;
              } else {
                fullAssistantOutput = stepText;
              }

              console.log(
                `[chat/intent-execute] short-circuited retrieval step ${i + 1} (${step.employeeSlug})`
              );
              continue; // 跳到下一个 step，不走 LLM
            }

            // Build messages: include prior step output as context
            const messages: { role: "user" | "assistant"; content: string }[] =
              [];
            if (conversationHistory?.length) {
              messages.push(...conversationHistory.slice(-5));
            }
            if (priorStepOutput) {
              messages.push({
                role: "assistant",
                content: `[上一步执行结果]\n${priorStepOutput}`,
              });
            }
            // 当天日期 + 反伪造硬约束：无论是否有 preExecBlocks 都注入，避免
            // 生成类步骤（content_generate 等）在没有本步 preExec、仅靠 priorStepOutput
            // 时按训练数据胡编时间/条目。
            const today = new Date().toISOString().slice(0, 10);
            const hardConstraints = `\n\n【基于真实数据的硬约束】\n- 今天是 **${today}**。凡是年份早于本年、或日期早于今天 7 天以上的条目都属于历史资料，可引用但必须明确标注（例如"据 2025 年 CCBN 报道"），**不得伪装成当前新闻**\n- 只能使用"上一步执行结果"与"前置工具调用结果"中列出的真实条目；**禁止**引入这些上下文里没有出现过的任何标题、来源、日期、数据、URL（哪怕你"记得"相关话题）\n- 真实结果若集中在去年或更早：如实告知"最新数据暂未检索到，以下基于 YYYY 年资料"，然后引用；**不得**把历史条目直接写成当年报道\n- 真实结果为空时：如实说明"未检索到相关内容"并建议调整检索词/时间范围，**禁止虚构任何报道内容**\n- 生成类步骤（撰写/改写/摘要/标题）只能围绕真实条目展开，不得扩写为真实结果之外的"新报道"`;
            if (preExecBlocks.length > 0) {
              messages.push({
                role: "assistant",
                content: preExecBlocks.join("\n\n") + hardConstraints,
              });
            } else {
              messages.push({
                role: "assistant",
                content: `【上下文硬约束】${hardConstraints}`,
              });
            }
            messages.push({
              role: "user",
              content: step.taskDescription,
            });

            // Stream this step
            const result = streamText({
              model,
              system: agent.systemPrompt,
              messages,
              tools: vercelTools,
              stopWhen: stepCountIs(10),
              maxOutputTokens: 8192,
              temperature: 0.5,
            });

            for await (const part of result.fullStream) {
              switch (part.type) {
                case "tool-call": {
                  const label =
                    TOOL_LABELS[part.toolName] ??
                    `正在执行${part.toolName}`;
                  const skillName =
                    TOOL_TO_SKILL[part.toolName] ?? part.toolName;
                  if (!usedToolSet.has(part.toolName)) {
                    usedToolSet.add(part.toolName);
                    usedSkills.push({ tool: part.toolName, skillName });
                  }
                  send("thinking", {
                    tool: part.toolName,
                    label,
                    skillName,
                  });
                  break;
                }
                case "tool-result": {
                  const sources = extractSources(part.output);
                  if (sources.length > 0) {
                    for (const s of sources) {
                      if (!allSources.includes(s)) allSources.push(s);
                    }
                    referenceCount += sources.length;
                    send("source", {
                      tool: part.toolName,
                      sources,
                      totalSources: allSources.length,
                      totalReferences: referenceCount,
                    });
                  }
                  break;
                }
                case "text-delta": {
                  stepText += part.text;
                  send("text-delta", { text: part.text });
                  break;
                }
                case "finish": {
                  // Don't send "done" yet for intermediate steps
                  break;
                }
              }
            }

            // Save step output as context for next step
            priorStepOutput = stepText;

            // Accumulate for post-stream channel notification
            if (intent.steps.length > 1) {
              fullAssistantOutput +=
                (fullAssistantOutput ? "\n\n" : "") +
                `【${step.employeeName}】\n${stepText}`;
            } else {
              fullAssistantOutput = stepText;
            }

            // --- Cognitive Engine: verify step output (non-blocking) ---
            if (stepText.length > 50) {
              verify({
                output: stepText,
                taskTitle: step.taskDescription,
                taskDescription: step.taskDescription,
                employeeId: emp.id,
                employeeSlug: step.employeeSlug,
                organizationId: orgId,
                intentType: intent.intentType,
              })
                .then((vr) => {
                  send("verification", {
                    stepIndex: i,
                    qualityScore: vr.qualityScore,
                    passed: vr.passed,
                    feedback: vr.feedback,
                    issueCount: vr.issues.length,
                    memoriesGenerated: vr.memoriesGenerated.length,
                  });
                })
                .catch((err) =>
                  console.error("[intent-execute] Verification failed:", err)
                );
            }

            // Notify step complete
            send("step-complete", {
              stepIndex: i,
              employeeSlug: step.employeeSlug,
              employeeName: step.employeeName,
              summary: stepText.slice(0, 200),
            });
          }

          // All steps done
          send("done", {
            sources: allSources,
            referenceCount,
            skillsUsed: usedSkills,
            finishReason: "stop",
          });
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "未知错误",
          });
        } finally {
          try {
            controller.close();
          } catch {
            // Already closed
          }

          // Fire-and-forget channel sync
          if (fullAssistantOutput.trim() && message) {
            void notifyChatMessage({
              organizationId: orgId,
              userId: user.id,
              employeeSlug: primarySlug,
              employeeName:
                primaryEmployee?.nickname ||
                primaryEmployee?.name ||
                intent.steps[0].employeeName ||
                primarySlug,
              userMessage: message,
              assistantMessage: fullAssistantOutput,
              skillsUsed: usedSkills.map((s) => s.skillName),
            });
          }
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
  } catch (err) {
    console.error("[intent-execute] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Internal Server Error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
