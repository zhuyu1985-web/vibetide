import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { projectStatusEnum } from "./enums";

// ─── Projects (cowork 化:把会话/任务归类到项目下) ───
// 纯分组容器,不持有执行状态。会话通过 conversations.projectId 关联,
// 任务通过 missions.projectId 关联(冗余便于聚合)。
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id").notNull(),

    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon"), // lucide 图标名
    color: text("color"), // hex 主题色

    status: projectStatusEnum("status").notNull().default("active"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 列表热路径:某 org 下按状态 + 最近更新排序
    orgStatusUpdatedIdx: index("projects_org_status_updated_idx").on(
      table.organizationId,
      table.status,
      table.updatedAt,
    ),
  }),
);

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  // NOTE: 不在此声明 conversations: many(conversations) —— 会与
  // conversations.ts(import projects)形成 ES module 循环。项目下会话用
  // DAL 直接按 projectId 查。
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
