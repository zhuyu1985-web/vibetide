import { pgTable, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { teamMessages } from "./messages";

export const messageReads = pgTable(
  "message_reads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => teamMessages.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique("message_reads_user_message_unique").on(t.userId, t.messageId)]
);
