import {
  pgTable,
  uuid,
  text,
  date,
  boolean,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  calendarEventTypeEnum,
  calendarRecurrenceEnum,
  calendarSourceEnum,
  calendarStatusEnum,
} from "./enums";
import { organizations, userProfiles } from "./users";

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  eventType: calendarEventTypeEnum("event_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isAllDay: boolean("is_all_day").notNull().default(true),
  recurrence: calendarRecurrenceEnum("recurrence").notNull().default("once"),
  source: calendarSourceEnum("source").notNull(),
  status: calendarStatusEnum("status").notNull().default("confirmed"),
  aiAngles: jsonb("ai_angles").$type<string[]>().default([]),
  reminderDaysBefore: integer("reminder_days_before").notNull().default(3),
  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [calendarEvents.organizationId],
    references: [organizations.id],
  }),
  creator: one(userProfiles, {
    fields: [calendarEvents.createdBy],
    references: [userProfiles.id],
  }),
}));
