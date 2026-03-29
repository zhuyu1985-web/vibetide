import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

export const hotTopicCrawlLogs = pgTable("hot_topic_crawl_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  platformName: text("platform_name").notNull(),
  platformNodeId: text("platform_node_id"),
  status: text("status").notNull(), // "success" | "error"
  topicsFound: integer("topics_found").notNull().default(0),
  errorMessage: text("error_message"),

  crawledAt: timestamp("crawled_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const hotTopicCrawlLogsRelations = relations(hotTopicCrawlLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [hotTopicCrawlLogs.organizationId],
    references: [organizations.id],
  }),
}));
