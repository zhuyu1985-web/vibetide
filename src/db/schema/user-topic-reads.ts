import { pgTable, uuid, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";

export const userTopicReads = pgTable(
  "user_topic_reads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    readTopicIds: jsonb("read_topic_ids").$type<string[]>().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique().on(table.userId, table.organizationId)]
);

export const userTopicReadsRelations = relations(
  userTopicReads,
  ({ one }) => ({
    user: one(userProfiles, {
      fields: [userTopicReads.userId],
      references: [userProfiles.id],
    }),
    organization: one(organizations, {
      fields: [userTopicReads.organizationId],
      references: [organizations.id],
    }),
  })
);
