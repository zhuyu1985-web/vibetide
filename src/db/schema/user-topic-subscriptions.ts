import { pgTable, uuid, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";

export const userTopicSubscriptions = pgTable(
  "user_topic_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    subscribedCategories: jsonb("subscribed_categories")
      .$type<string[]>()
      .default([]),
    subscribedEventTypes: jsonb("subscribed_event_types")
      .$type<string[]>()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique().on(table.userId, table.organizationId)]
);

export const userTopicSubscriptionsRelations = relations(
  userTopicSubscriptions,
  ({ one }) => ({
    user: one(userProfiles, {
      fields: [userTopicSubscriptions.userId],
      references: [userProfiles.id],
    }),
    organization: one(organizations, {
      fields: [userTopicSubscriptions.organizationId],
      references: [organizations.id],
    }),
  })
);
