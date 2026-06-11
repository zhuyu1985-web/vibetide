/**
 * projects DAL —— cowork 化对话中心的"项目"分组容器读写接口。
 *
 * 所有查询/写入都被 organization_id 严格过滤(多租户隔离)。
 * 错误约定:DAL 不抛 user-facing 错;由 server action 包装。
 */
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  /** 置顶时间;传 Date 置顶、传 null 取消 */
  pinnedAt?: Date | null;
}

/** 列出某 org 的项目(默认只 active,按最近更新倒序) */
export async function listProjectsByOrg(
  orgId: string,
  opts: { includeArchived?: boolean } = {},
) {
  const where = opts.includeArchived
    ? eq(projects.organizationId, orgId)
    : and(eq(projects.organizationId, orgId), eq(projects.status, "active"));
  return db
    .select()
    .from(projects)
    .where(where)
    // 置顶组(pinnedAt 非 null)优先,组内按最近更新倒序
    .orderBy(
      sql`${projects.pinnedAt} IS NOT NULL DESC`,
      desc(projects.updatedAt),
    );
}

/** 取单个项目;不属于该 org 返回 null(避免泄露) */
export async function getProjectById(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.organizationId, orgId), eq(projects.id, id)))
    .limit(1);
  return row ?? null;
}

export async function createProject(
  orgId: string,
  userId: string,
  input: CreateProjectInput,
) {
  const [row] = await db
    .insert(projects)
    .values({
      organizationId: orgId,
      userId,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
    })
    .returning();
  return row;
}

export async function updateProject(
  orgId: string,
  id: string,
  input: UpdateProjectInput,
) {
  const patch: Partial<typeof projects.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.color !== undefined) patch.color = input.color;
  if (input.pinnedAt !== undefined) patch.pinnedAt = input.pinnedAt;

  const [row] = await db
    .update(projects)
    .set(patch)
    .where(and(eq(projects.organizationId, orgId), eq(projects.id, id)))
    .returning();
  return row ?? null;
}

/** 归档/取消归档。归档时记 archivedAt,取消时清空。 */
export async function setProjectArchived(
  orgId: string,
  id: string,
  archived: boolean,
) {
  const [row] = await db
    .update(projects)
    .set({
      status: archived ? "archived" : "active",
      archivedAt: archived ? new Date() : null,
      // 归档自动清置顶(正交边界)
      ...(archived ? { pinnedAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(projects.organizationId, orgId), eq(projects.id, id)))
    .returning();
  return row ?? null;
}

/** 硬删除项目。会话的 projectId 因 FK(set null)自动置空,会话本身保留。 */
export async function deleteProject(orgId: string, id: string) {
  const [row] = await db
    .delete(projects)
    .where(and(eq(projects.organizationId, orgId), eq(projects.id, id)))
    .returning({ id: projects.id });
  return row?.id ?? null;
}
