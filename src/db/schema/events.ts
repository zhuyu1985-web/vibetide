import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import {
  eventTypeEnum,
  eventStatusEnum,
  highlightTypeEnum,
  eventOutputTypeEnum,
  eventOutputStatusEnum,
} from "./enums";

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: text("name").notNull(),
  type: eventTypeEnum("type").notNull(),
  status: eventStatusEnum("status").notNull().default("upcoming"),
  startTime: timestamp("start_time", { withTimezone: true }),
  endTime: timestamp("end_time", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  stats: jsonb("stats").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const eventHighlights = pgTable("event_highlights", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .references(() => events.id, { onDelete: "cascade" })
    .notNull(),

  time: text("time"),
  type: highlightTypeEnum("type").notNull(),
  description: text("description"),
  autoClipped: boolean("auto_clipped").default(false),
  clipUrl: text("clip_url"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const eventOutputs = pgTable("event_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .references(() => events.id, { onDelete: "cascade" })
    .notNull(),

  title: text("title").notNull(),
  type: eventOutputTypeEnum("type").notNull(),
  status: eventOutputStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").default(0),
  outputUrl: text("output_url"),
  duration: text("duration"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const eventTranscriptions = pgTable("event_transcriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id")
    .references(() => events.id, { onDelete: "cascade" })
    .notNull(),

  speaker: text("speaker"),
  content: text("content").notNull(),
  goldenQuote: boolean("golden_quote").default(false),
  timestamp: text("timestamp"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  highlights: many(eventHighlights),
  outputs: many(eventOutputs),
  transcriptions: many(eventTranscriptions),
}));

export const eventHighlightsRelations = relations(
  eventHighlights,
  ({ one }) => ({
    event: one(events, {
      fields: [eventHighlights.eventId],
      references: [events.id],
    }),
  })
);

export const eventOutputsRelations = relations(eventOutputs, ({ one }) => ({
  event: one(events, {
    fields: [eventOutputs.eventId],
    references: [events.id],
  }),
}));

export const eventTranscriptionsRelations = relations(
  eventTranscriptions,
  ({ one }) => ({
    event: one(events, {
      fields: [eventTranscriptions.eventId],
      references: [events.id],
    }),
  })
);
