import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { articles } from "./articles";
import { annotationColorEnum } from "./enums";

export const articleAnnotations = pgTable("article_annotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  articleId: uuid("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  quote: text("quote").notNull(),
  note: text("note"),
  color: annotationColorEnum("color").notNull().default("yellow"),
  position: integer("position").notNull().default(0),
  timecode: numeric("timecode"),
  frameSnapshot: text("frame_snapshot"),
  isPinned: boolean("is_pinned").notNull().default(false),
  pinnedPosition: jsonb("pinned_position").$type<{
    x: number;
    y: number;
  } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const articleAnnotationsRelations = relations(
  articleAnnotations,
  ({ one }) => ({
    article: one(articles, {
      fields: [articleAnnotations.articleId],
      references: [articles.id],
    }),
  })
);
