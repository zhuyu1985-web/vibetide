/**
 * surfaceCliOutput — 把 CLI 工具产出的媒体资产「呈现」到 mission 控制台和/或 cowork 会话。
 *
 * 调用方已把 media_asset 存库；本函数只负责把它「浮出水面」给用户可见的两个入口：
 * 1. mission_artifacts 表（任务控制台实时产物区）
 * 2. cowork conversation_messages（import_card 卡片）
 *
 * producedBy 约束（NOT NULL）：优先用 taskId 对应任务的 assignedEmployeeId；
 * 回退用 missionId 对应 mission 的 leaderEmployeeId。
 */

import { db } from "@/db";
import { missionArtifacts, missionTasks, missions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appendMessage } from "@/lib/dal/cowork-conversations";

export interface SurfaceCliCtx {
  organizationId: string;
  missionId?: string | null;
  taskId?: string | null;
  conversationId?: string | null;
  /** CLI 工具名称，用于卡片说明文字 */
  cliToolName: string;
}

export interface SurfaceCliOutput {
  assetId: string;
  publicUrl: string;
  /** 'video' | 'image' | 'audio' | 'document' */
  assetType: string;
  title: string;
}

/**
 * 通过以下两个渠道把已存储的 media_asset 呈现给用户：
 * - mission_artifacts（若有 missionId）
 * - conversation import_card（若有 conversationId）
 * 两者均无则静默返回（资产已在素材库中，无需额外操作）。
 */
export async function surfaceCliOutput(
  ctx: SurfaceCliCtx,
  output: SurfaceCliOutput,
): Promise<void> {
  const hasMission = Boolean(ctx.missionId);
  const hasConversation = Boolean(ctx.conversationId);

  if (!hasMission && !hasConversation) {
    // 资产已入库，不需要额外呈现
    return;
  }

  // ── 1. Mission 控制台：写入 mission_artifacts ──────────────────────────────
  if (hasMission) {
    const missionId = ctx.missionId!;

    // producedBy NOT NULL — 优先 task 分配员工，回退 mission leader
    const producedBy = await resolveProducedBy(missionId, ctx.taskId ?? null);

    if (producedBy) {
      await db.insert(missionArtifacts).values({
        missionId,
        taskId: ctx.taskId ?? null,
        producedBy,
        type: output.assetType,
        title: output.title,
        fileUrl: output.publicUrl,
        metadata: {
          assetId: output.assetId,
          assetType: output.assetType,
          source: "cli",
          cliToolName: ctx.cliToolName,
        },
      });
    }
  }

  // ── 2. Cowork 会话：追加 import_card 消息 ─────────────────────────────────
  if (hasConversation) {
    await appendMessage(ctx.conversationId!, {
      role: "assistant",
      kind: "import_card",
      content: `已生成产物：${output.title}`,
      meta: {
        assetId: output.assetId,
        fileUrl: output.publicUrl,
        assetType: output.assetType,
        cliToolName: ctx.cliToolName,
      },
    });
  }
}

/**
 * 解析 producedBy：优先取 task.assignedEmployeeId，回退取 mission.leaderEmployeeId。
 * 两者均无（极边界）则返回 null，调用方跳过写入。
 */
async function resolveProducedBy(
  missionId: string,
  taskId: string | null,
): Promise<string | null> {
  if (taskId) {
    const [task] = await db
      .select({ assignedEmployeeId: missionTasks.assignedEmployeeId })
      .from(missionTasks)
      .where(eq(missionTasks.id, taskId))
      .limit(1);
    if (task?.assignedEmployeeId) return task.assignedEmployeeId;
  }

  const [mission] = await db
    .select({ leaderEmployeeId: missions.leaderEmployeeId })
    .from(missions)
    .where(eq(missions.id, missionId))
    .limit(1);

  return mission?.leaderEmployeeId ?? null;
}
