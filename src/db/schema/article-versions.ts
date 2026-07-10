import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations, userProfiles } from "./users";
import { articles } from "./articles";

/**
 * 稿件版本链（append-only）—— 语音内容闭环的多轮改稿 / 中英双语留痕。
 *
 * `articles` 表始终是"最新版"的物化；`article_versions` 是历史，可回滚/对比。
 * 中英按 `language` 分链（各自从 version_no=1 起）。审核驳回后重改时 `review_id` 回链。
 */
export const articleVersions = pgTable(
  "article_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    articleId: uuid("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    versionNo: integer("version_no").notNull(),
    language: text("language").notNull().default("zh"),
    title: text("title"),
    body: text("body"),
    summary: text("summary"),
    wordCount: integer("word_count").default(0),
    /** 本版怎么来的：initial(初稿) | rewrite(改稿) | translate(转外文) | revise_after_reject(驳回后重改) */
    changeKind: text("change_kind").notNull(),
    /** 触发本版的那句语音/文字指令原文 */
    changeInstruction: text("change_instruction"),
    /** 若由审核驳回触发，回链 review_results（软引用，P3 用） */
    reviewId: uuid("review_id"),
    createdBy: uuid("created_by").references(() => userProfiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    articleVerIdx: index("idx_article_versions_article").on(
      t.articleId,
      t.versionNo,
    ),
  }),
);
