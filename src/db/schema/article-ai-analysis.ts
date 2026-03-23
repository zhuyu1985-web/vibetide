import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { articles } from "./articles";
import { aiAnalysisPerspectiveEnum, aiSentimentEnum } from "./enums";

export const articleAiAnalysis = pgTable(
  "article_ai_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
    perspective: aiAnalysisPerspectiveEnum("perspective").notNull(),
    analysisText: text("analysis_text").notNull(),
    sentiment: aiSentimentEnum("sentiment"),
    metadata: jsonb("metadata"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("article_ai_analysis_unique").on(table.articleId, table.perspective),
  ]
);
