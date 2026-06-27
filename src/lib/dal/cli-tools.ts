import { db } from "@/db";
import { cliTools, cliToolRuns } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { InferInsertModel } from "drizzle-orm";

// ---------------------------------------------------------------------------
// DAL — cli_tools / cli_tool_runs（按 org 隔离）
//
// 读接口（list/get）严格走 org 过滤，是多租户隔离缝。
// 写接口（insertCliToolRun / updateCliToolRun）用于 run 追踪记录——
// run 行在创建时即带 organizationId，更新按主键 id 定位，符合本文件职责。
// ---------------------------------------------------------------------------

/** 返回指定 org 下所有已启用（enabled=1）的 CLI 工具配置。 */
export async function listEnabledCliTools(orgId: string) {
  return db.query.cliTools.findMany({
    where: and(eq(cliTools.organizationId, orgId), eq(cliTools.enabled, 1)),
  });
}

/** 按 id 查单条 CLI 工具配置（含 org 隔离校验）。 */
export async function getCliToolById(orgId: string, id: string) {
  return db.query.cliTools.findFirst({
    where: and(eq(cliTools.id, id), eq(cliTools.organizationId, orgId)),
  });
}

type CliToolRunInsert = InferInsertModel<typeof cliToolRuns>;

/** 创建一条 CLI 工具执行记录，返回新行 id。 */
export async function insertCliToolRun(
  values: CliToolRunInsert,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(cliToolRuns)
    .values(values)
    .returning({ id: cliToolRuns.id });
  return { id: row.id };
}

/** 按 id 更新一条 CLI 工具执行记录。 */
export async function updateCliToolRun(
  id: string,
  patch: Partial<CliToolRunInsert>,
): Promise<void> {
  await db.update(cliToolRuns).set(patch).where(eq(cliToolRuns.id, id));
}
