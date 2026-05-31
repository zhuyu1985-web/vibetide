/**
 * help_feedback —— /help 文档站文档反馈记录。
 *
 * 设计动机:每篇 MDX 文档底部的 DocFeedback 组件提供 👍/👎 + 评论,用户提交后
 * 落到这张表,用于:
 *   - 衡量哪些文档对用户最有帮助 / 哪些需要改进(docPath 聚合)
 *   - 收集具体改进意见(comment)
 *   - 反滥用:同 IP 1 分钟 > N 条静默丢弃(ipHash 限流)
 *
 * 隐私:不存明文 IP,只存 sha256(ip) 用作限流键 ipHash。
 */
import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const helpFeedback = pgTable(
  "help_feedback",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** 文档相对路径,形如 "workflows/start-first-workflow"(不带 /help 前缀,不带扩展名) */
    docPath: text("doc_path").notNull(),
    /** 👍 = true, 👎 = false */
    helpful: boolean().notNull(),
    /** 用户评论,可选;运行时校验 ≤ 500 字 */
    comment: text(),
    /** 提交时的 User-Agent,用于辅助判断 bot / spam */
    userAgent: text("user_agent"),
    /** sha256(client_ip) hex,不留明文 IP;同 IP 限流键 */
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /** 按文档聚合查询(管理后台:每篇文档的 👍/👎 数量) */
    docPathIdx: index("idx_help_feedback_doc").on(t.docPath),
    /** 按时间排序 / 反滥用窗口查询(WHERE created_at > NOW() - INTERVAL '1 minute') */
    createdIdx: index("idx_help_feedback_created").on(t.createdAt),
  }),
);

export type HelpFeedback = typeof helpFeedback.$inferSelect;
export type NewHelpFeedback = typeof helpFeedback.$inferInsert;
