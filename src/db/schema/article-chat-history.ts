import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { articles } from "./articles";

export const articleChatHistory = pgTable("article_chat_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  role: varchar("role", { length: 10 }).notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
