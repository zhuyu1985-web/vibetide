"use server";

/**
 * submitCoworkMessage —— cowork 单窗口的"发一句话"统一入口(MVP)。
 *
 * 流程:落用户消息 → recognizeIntent → 路由:
 *   - 有可执行步骤(steps>0)→ startAdHocMission,落一条 mission_card 消息
 *   - general_chat(无步骤)→ 非流式 generateText 简单回复(流式留 P4),落 text 消息
 *
 * 说明:为聚焦原型形态,workflow 类意图本批也走 ad-hoc(intent.steps),不处理
 * 模板输入表单;workflow-template 精确路由 + 流式自由聊天留 P4 细化。
 */
import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { missionArtifacts } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  appendMessage,
  getConversationById,
} from "@/lib/dal/cowork-conversations";
import { recognizeIntentForOrg } from "@/lib/cowork/intent-routing";
import { startAdHocMission } from "@/app/actions/ad-hoc-mission";
import { getMissionById } from "@/lib/dal/missions";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";

export type CoworkSubmitResult =
  | { ok: false; error: string }
  | { ok: true; kind: "mission"; missionId: string; intentSummary: string }
  | { ok: true; kind: "chat"; reply: string }
  | { ok: true; kind: "plan" };

export type SaveCoworkArtifactDraftResult =
  | { ok: true; artifactId: string; version: number }
  | { ok: false; error: string };

export async function submitCoworkMessage(
  conversationId: string,
  message: string,
): Promise<CoworkSubmitResult> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, error: "用户未关联组织" };
  const text = message.trim();
  if (!text) return { ok: false, error: "消息不能为空" };

  const convo = await getConversationById(orgId, user.id, conversationId);
  if (!convo) return { ok: false, error: "对话不存在或无权访问" };

  // 1. 落用户消息
  await appendMessage(conversationId, {
    role: "user",
    content: text,
    kind: "text",
  });

  // 1.5 URL 导入意图短路（确定性最高 → 绕过 LLM 意图分类，直接异步抓取入库）
  const { extractUrls } = await import("@/lib/channels/link-extract");
  const urls = extractUrls(text);
  if (urls.length > 0) {
    const { dispatchCoworkLinkImport } = await import(
      "@/lib/cowork/link-import-dispatch"
    );
    await dispatchCoworkLinkImport({
      organizationId: orgId,
      conversationId,
      userId: user.id,
      urls,
      userName: user.displayName || undefined,
    });
    revalidatePath(`/cowork/${conversationId}`);
    return { ok: true, kind: "chat", reply: "已开始导入稿件" };
  }

  // 2. 意图识别
  const intent = await recognizeIntentForOrg(orgId, user.id, text);

  // 2.5 写稿类意图 → 先弹创作计划卡（不起 mission，等用户确认后走 confirmCreationPlan）
  if (intent.intentType === "content_creation") {
    const { buildCreationPlan } = await import("@/lib/cowork/creation-plan");
    const plan = await buildCreationPlan(orgId, text);
    await appendMessage(conversationId, {
      role: "assistant",
      content: plan.topic.title
        ? `已读到今天的热点，帮你拟了份创作计划，确认或改一改 👇`
        : `帮你拟了份创作计划，填一下选题再开始 👇`,
      kind: "plan_card",
      meta: { plan, intent },
    });
    revalidatePath(`/cowork/${conversationId}`);
    return { ok: true, kind: "plan" };
  }

  // 3. 路由
  if (intent.steps && intent.steps.length > 0) {
    const res = await startAdHocMission({
      message: text,
      steps: intent.steps,
      summary: intent.summary,
      conversationId,
      projectId: convo.projectId,
    });
    if (!res.ok) {
      const err = res.errors?._global ?? "任务启动失败";
      await appendMessage(conversationId, {
        role: "assistant",
        content: `任务启动失败：${err}`,
        kind: "text",
      });
      revalidatePath(`/cowork/${conversationId}`);
      return { ok: false, error: err };
    }
    await appendMessage(conversationId, {
      role: "assistant",
      content: intent.summary || "已为你启动任务",
      kind: "mission_card",
      missionId: res.missionId,
      meta: { intentSummary: intent.summary, confidence: intent.confidence, intent },
    });
    revalidatePath(`/cowork/${conversationId}`);
    return {
      ok: true,
      kind: "mission",
      missionId: res.missionId,
      intentSummary: intent.summary,
    };
  }

  // general_chat → 非流式简单回复(MVP)
  let reply = "";
  try {
    const model = getLanguageModel({
      provider: "openai",
      model: getDefaultModel(),
      temperature: 0.7,
      maxTokens: 800,
    });
    const result = await generateText({
      model,
      system: "你是融媒云的 AI 助手，用简洁专业的中文回答用户。",
      prompt: text,
      maxOutputTokens: 800,
    });
    reply = result.text?.trim() ?? "";
  } catch (err) {
    console.error("[cowork-submit] free chat failed:", err);
  }
  if (!reply) reply = "好的，我在。需要我帮你执行什么任务吗？";

  await appendMessage(conversationId, {
    role: "assistant",
    content: reply,
    kind: "text",
    meta: { intent },
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true, kind: "chat", reply };
}

/**
 * 右栏取 mission 详情(初始渲染 + 校验 org 归属);客户端再订阅 progress SSE。
 */
export async function getCoworkMissionDetail(missionId: string) {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return null;
  const mission = await getMissionById(missionId);
  if (!mission || mission.organizationId !== orgId) return null;
  return mission;
}

export async function saveCoworkArtifactDraft(input: {
  missionId: string;
  artifactId: string;
  content: string;
}): Promise<SaveCoworkArtifactDraftResult> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, error: "用户未关联组织" };
  if (!input.missionId || !input.artifactId) {
    return { ok: false, error: "缺少产物信息" };
  }
  if (typeof input.content !== "string") {
    return { ok: false, error: "稿件内容无效" };
  }

  const mission = await getMissionById(input.missionId);
  if (!mission || mission.organizationId !== orgId) {
    return { ok: false, error: "任务不存在或无权访问" };
  }

  const artifact = mission.artifacts.find((a) => a.id === input.artifactId);
  if (!artifact) return { ok: false, error: "产物不存在或尚未持久化" };
  if (!["article_draft", "draft", "report", "text"].includes(artifact.type)) {
    return { ok: false, error: "该产物类型暂不支持编辑保存" };
  }

  const editedAt = new Date().toISOString();
  const nextMetadata = {
    ...(artifact.metadata ?? {}),
    edited: true,
    editedAt,
  };

  const [updated] = await db
    .update(missionArtifacts)
    .set({
      content: input.content,
      metadata: nextMetadata,
      version: sql`${missionArtifacts.version} + 1`,
    })
    .where(
      and(
        eq(missionArtifacts.id, input.artifactId),
        eq(missionArtifacts.missionId, input.missionId),
      ),
    )
    .returning({ id: missionArtifacts.id, version: missionArtifacts.version });

  if (!updated) return { ok: false, error: "产物保存失败" };
  revalidatePath("/cowork");
  revalidatePath(`/missions/${input.missionId}`);
  return { ok: true, artifactId: updated.id, version: updated.version };
}
