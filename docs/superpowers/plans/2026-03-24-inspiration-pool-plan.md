# 灵感池全面优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the inspiration pool from a flat P0/P1/P2 card grid into a dual-panel "Smart Feed + Workspace" layout with unread tracking, category subscriptions, calendar events (节赛会展), and deep creative assistance (outlines + material aggregation).

**Architecture:** Left panel = smart feed (AI change summary, category tabs with subscription highlights, topic list with unread markers and timeline divider, polling notification bar). Right panel = workspace (editorial briefing by default, deep topic detail with AI outlines/materials/sentiment when a topic is selected). Calendar events as a dedicated tab in the left panel. Data layer adds 3 new tables + 2 JSONB fields on hot_topics + 4 new enums.

**Tech Stack:** Next.js 16 (App Router), React 19, Drizzle ORM 0.45.1, Supabase PostgreSQL, Tailwind CSS v4, shadcn/ui, Framer Motion, Inngest, AI SDK v6 with @ai-sdk/anthropic (Zhipu GLM)

**Spec:** `docs/superpowers/specs/2026-03-24-inspiration-pool-design.md`

**Verification commands:**
- Type check: `npx tsc --noEmit`
- Build: `npm run build`
- DB push: `npm run db:push`

**Auth patterns (IMPORTANT — follow exactly):**
- **Server pages** use `getCurrentUserOrg()` from `@/lib/dal/auth` — returns `string | null` (orgId only). For userId, call `createClient()` from `@/lib/supabase/server` → `supabase.auth.getUser()`.
- **Server actions** use a local `requireAuth()` that returns the Supabase `user` object. To get `organizationId`, query `userProfiles` by `user.id`. See `src/app/actions/hot-topics.ts:26-33` for reference pattern.
- **API routes** use `createClient()` from `@/lib/supabase/server` directly.
- The project needs a new helper `getCurrentUserAndOrg()` in `src/lib/dal/auth.ts` that returns `{ userId, organizationId }` for the inspiration page (which needs both).

---

## Phase 1: Data Layer — Schema, Enums, Migration

### Task 1: Add new enums to enums.ts

**Files:**
- Modify: `src/db/schema/enums.ts`

- [ ] **Step 1: Add 4 new enums**

Add after the existing `topicAngleStatusEnum` (around line 186):

```typescript
export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "festival",
  "competition",
  "conference",
  "exhibition",
  "launch",
  "memorial",
]);

export const calendarRecurrenceEnum = pgEnum("calendar_recurrence", [
  "once",
  "yearly",
  "custom",
]);

export const calendarSourceEnum = pgEnum("calendar_source", [
  "builtin",
  "manual",
  "ai_discovered",
]);

export const calendarStatusEnum = pgEnum("calendar_status", [
  "confirmed",
  "pending_review",
]);
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/enums.ts
git commit -m "feat(inspiration): add calendar event enums"
```

---

### Task 2: Create calendar_events schema

**Files:**
- Create: `src/db/schema/calendar-events.ts`
- Modify: `src/db/schema/index.ts` (if exists, to re-export)

- [ ] **Step 1: Create the schema file**

```typescript
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
import { organizations } from "./organizations";
import { userProfiles } from "./user-profiles";

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
```

- [ ] **Step 2: Add export to schema index**

Check `src/db/schema/index.ts` (or wherever schemas are aggregated) and add:
```typescript
export * from "./calendar-events";
```

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/calendar-events.ts src/db/schema/index.ts
git commit -m "feat(inspiration): add calendar_events schema"
```

---

### Task 3: Create user_topic_subscriptions schema

**Files:**
- Create: `src/db/schema/user-topic-subscriptions.ts`

- [ ] **Step 1: Create the schema file**

```typescript
import { pgTable, uuid, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { userProfiles } from "./user-profiles";

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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
```

- [ ] **Step 2: Add export to schema index**

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/user-topic-subscriptions.ts src/db/schema/index.ts
git commit -m "feat(inspiration): add user_topic_subscriptions schema"
```

---

### Task 4: Create user_topic_reads schema

**Files:**
- Create: `src/db/schema/user-topic-reads.ts`

- [ ] **Step 1: Create the schema file**

```typescript
import { pgTable, uuid, timestamp, jsonb, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { userProfiles } from "./user-profiles";

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
    lastViewedAt: timestamp("last_viewed_at").defaultNow().notNull(),
    readTopicIds: jsonb("read_topic_ids").$type<string[]>().default([]),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
```

- [ ] **Step 2: Add export to schema index**

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/db/schema/user-topic-reads.ts src/db/schema/index.ts
git commit -m "feat(inspiration): add user_topic_reads schema"
```

---

### Task 5: Extend hot_topics table with new JSONB fields

**Files:**
- Modify: `src/db/schema/hot-topics.ts`

- [ ] **Step 1: Add enrichedOutlines and relatedMaterials fields**

Add after the existing `platforms` field in `hotTopics` table definition:

```typescript
  enrichedOutlines: jsonb("enriched_outlines")
    .$type<
      Array<{
        angle: string;
        points: string[];
        wordCount: string;
        style: string;
      }>
    >()
    .default([]),
  relatedMaterials: jsonb("related_materials")
    .$type<
      Array<{
        type: "report" | "data" | "comment";
        title: string;
        source: string;
        url?: string;
        snippet: string;
      }>
    >()
    .default([]),
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/hot-topics.ts
git commit -m "feat(inspiration): add enrichedOutlines and relatedMaterials to hot_topics"
```

---

### Task 6: Generate and apply database migration

**Files:**
- Generate: `supabase/migrations/` (new migration file)

- [ ] **Step 1: Generate migration**

Run: `npm run db:generate`
Expected: New migration SQL file generated in `supabase/migrations/`

- [ ] **Step 2: Review generated SQL**

Read the generated migration file. Verify it contains:
- 4 new enum types (calendar_event_type, calendar_recurrence, calendar_source, calendar_status)
- 3 new tables (calendar_events, user_topic_subscriptions, user_topic_reads)
- 2 new columns on hot_topics (enriched_outlines, related_materials)
- Unique constraints on user tables
- Correct foreign key references

- [ ] **Step 3: Push migration to database**

Run: `npm run db:push`
Expected: Schema applied successfully

- [ ] **Step 4: Commit migration**

```bash
git add supabase/migrations/
git commit -m "feat(inspiration): database migration for inspiration pool optimization"
```

---

## Phase 2: Types & DAL

### Task 7: Update TypeScript type definitions

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Update InspirationTopic type**

Find the `InspirationTopic` interface (around line 877) and update:

```typescript
export interface InspirationTopic {
  id: string;
  title: string;
  priority: "P0" | "P1" | "P2";
  heatScore: number;
  aiScore: number;
  trend: "rising" | "surging" | "plateau" | "declining";
  source: string;
  category: string;
  discoveredAt: string;
  heatCurve: { time: string; value: number }[];
  suggestedAngles: string[];
  enrichedOutlines: Array<{
    angle: string;
    points: string[];
    wordCount: string;
    style: string;
  }>;
  relatedMaterials: Array<{
    type: "report" | "data" | "comment";
    title: string;
    source: string;
    url?: string;
    snippet: string;
  }>;
  competitorResponse: string[];
  relatedAssets: string[];
  summary: string;
  platforms: string[];
  commentInsight: {
    positive: number;
    neutral: number;
    negative: number;
    hotComments: string[];
  };
  isRead: boolean;
  missionId?: string;
}
```

- [ ] **Step 2: Add new type definitions**

Add after the `EditorialMeeting` interface:

```typescript
export interface CalendarEvent {
  id: string;
  name: string;
  category: string;
  eventType: "festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial";
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  recurrence: "once" | "yearly" | "custom";
  source: "builtin" | "manual" | "ai_discovered";
  status: "confirmed" | "pending_review";
  aiAngles: string[];
  reminderDaysBefore: number;
}

export interface UserTopicSubscription {
  subscribedCategories: string[];
  subscribedEventTypes: string[];
}

export interface TopicReadState {
  lastViewedAt: string;
  readTopicIds: string[];
}

export interface InspirationDelta {
  timeSinceLastView: string;
  newTopicsCount: number;
  newP0Count: number;
  newP1Count: number;
  newP2Count: number;
  significantChanges: string[];
  subscribedChannelUpdates: string;
}
```

- [ ] **Step 3: Update EditorialMeeting to include delta**

```typescript
export interface EditorialMeeting {
  p0Count: number;
  p1Count: number;
  p2Count: number;
  totalTopics: number;
  activePlatforms: number;
  topCategories: { name: string; count: number }[];
  aiSummary: string;
  generatedAt: string;
  delta?: InspirationDelta;
}
```

- [ ] **Step 4: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(inspiration): update type definitions for inspiration pool optimization"
```

---

### Task 8: Create topic-reads DAL

**Files:**
- Create: `src/lib/dal/topic-reads.ts`

- [ ] **Step 1: Implement read state DAL**

```typescript
import { db } from "@/db";
import { userTopicReads } from "@/db/schema/user-topic-reads";
import { hotTopics } from "@/db/schema/hot-topics";
import { eq, and, sql, gt } from "drizzle-orm";
import type { TopicReadState } from "@/lib/types";

export async function getTopicReadState(
  userId: string,
  organizationId: string
): Promise<TopicReadState> {
  const result = await db
    .select()
    .from(userTopicReads)
    .where(
      and(
        eq(userTopicReads.userId, userId),
        eq(userTopicReads.organizationId, organizationId)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return {
      lastViewedAt: new Date().toISOString(),
      readTopicIds: [],
    };
  }

  return {
    lastViewedAt: result[0].lastViewedAt.toISOString(),
    readTopicIds: (result[0].readTopicIds as string[]) || [],
  };
}

export async function markTopicsAsRead(
  userId: string,
  organizationId: string,
  topicIds: string[]
): Promise<void> {
  // Upsert: append new IDs to existing array, deduplicate
  const existing = await getTopicReadState(userId, organizationId);
  const mergedIds = [...new Set([...existing.readTopicIds, ...topicIds])];

  // Clean up IDs older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const validTopics = await db
    .select({ id: hotTopics.id })
    .from(hotTopics)
    .where(gt(hotTopics.discoveredAt, sevenDaysAgo));
  const validIds = new Set(validTopics.map((t) => t.id));
  const cleanedIds = mergedIds.filter((id) => validIds.has(id));

  await db
    .insert(userTopicReads)
    .values({
      userId,
      organizationId,
      readTopicIds: cleanedIds,
      lastViewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userTopicReads.userId, userTopicReads.organizationId],
      set: {
        readTopicIds: cleanedIds,
        updatedAt: new Date(),
      },
    });
}

export async function updateLastViewedAt(
  userId: string,
  organizationId: string
): Promise<void> {
  await db
    .insert(userTopicReads)
    .values({
      userId,
      organizationId,
      lastViewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userTopicReads.userId, userTopicReads.organizationId],
      set: {
        lastViewedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/dal/topic-reads.ts
git commit -m "feat(inspiration): add topic-reads DAL"
```

---

### Task 9: Create topic-subscriptions DAL

**Files:**
- Create: `src/lib/dal/topic-subscriptions.ts`

- [ ] **Step 1: Implement subscriptions DAL**

```typescript
import { db } from "@/db";
import { userTopicSubscriptions } from "@/db/schema/user-topic-subscriptions";
import { eq, and } from "drizzle-orm";
import type { UserTopicSubscription } from "@/lib/types";

export async function getUserSubscriptions(
  userId: string,
  organizationId: string
): Promise<UserTopicSubscription | null> {
  const result = await db
    .select()
    .from(userTopicSubscriptions)
    .where(
      and(
        eq(userTopicSubscriptions.userId, userId),
        eq(userTopicSubscriptions.organizationId, organizationId)
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  return {
    subscribedCategories:
      (result[0].subscribedCategories as string[]) || [],
    subscribedEventTypes:
      (result[0].subscribedEventTypes as string[]) || [],
  };
}

export async function upsertSubscriptions(
  userId: string,
  organizationId: string,
  categories: string[],
  eventTypes: string[]
): Promise<void> {
  await db
    .insert(userTopicSubscriptions)
    .values({
      userId,
      organizationId,
      subscribedCategories: categories,
      subscribedEventTypes: eventTypes,
    })
    .onConflictDoUpdate({
      target: [
        userTopicSubscriptions.userId,
        userTopicSubscriptions.organizationId,
      ],
      set: {
        subscribedCategories: categories,
        subscribedEventTypes: eventTypes,
        updatedAt: new Date(),
      },
    });
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/dal/topic-subscriptions.ts
git commit -m "feat(inspiration): add topic-subscriptions DAL"
```

---

### Task 10: Create calendar-events DAL

**Files:**
- Create: `src/lib/dal/calendar-events.ts`

- [ ] **Step 1: Implement calendar events DAL**

```typescript
import { db } from "@/db";
import { calendarEvents } from "@/db/schema/calendar-events";
import { eq, and, gte, lte, or, sql } from "drizzle-orm";
import type { CalendarEvent } from "@/lib/types";

export async function getCalendarEvents(
  organizationId: string,
  startRange: Date,
  endRange: Date
): Promise<CalendarEvent[]> {
  const results = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.organizationId, organizationId),
        or(
          // Events that start within range
          and(
            gte(calendarEvents.startDate, startRange.toISOString().split("T")[0]),
            lte(calendarEvents.startDate, endRange.toISOString().split("T")[0])
          ),
          // Events that are ongoing within range
          and(
            lte(calendarEvents.startDate, endRange.toISOString().split("T")[0]),
            gte(calendarEvents.endDate, startRange.toISOString().split("T")[0])
          )
        ),
        // Only confirmed or pending_review (not rejected)
        or(
          eq(calendarEvents.status, "confirmed"),
          eq(calendarEvents.status, "pending_review")
        )
      )
    )
    .orderBy(calendarEvents.startDate);

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    eventType: row.eventType,
    startDate: row.startDate,
    endDate: row.endDate,
    isAllDay: row.isAllDay,
    recurrence: row.recurrence,
    source: row.source,
    status: row.status,
    aiAngles: (row.aiAngles as string[]) || [],
    reminderDaysBefore: row.reminderDaysBefore,
  }));
}

export async function getUpcomingReminders(
  organizationId: string
): Promise<CalendarEvent[]> {
  // Get events where today is within reminderDaysBefore of startDate
  const today = new Date().toISOString().split("T")[0];
  const maxFuture = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  return getCalendarEvents(
    organizationId,
    new Date(today),
    new Date(maxFuture)
  );
}

export async function createCalendarEvent(
  data: {
    organizationId: string;
    name: string;
    category: string;
    eventType: "festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial";
    startDate: string;
    endDate: string;
    isAllDay?: boolean;
    recurrence?: "once" | "yearly" | "custom";
    source: "builtin" | "manual" | "ai_discovered";
    status?: "confirmed" | "pending_review";
    aiAngles?: string[];
    reminderDaysBefore?: number;
    createdBy?: string;
  }
): Promise<string> {
  const result = await db
    .insert(calendarEvents)
    .values({
      organizationId: data.organizationId,
      name: data.name,
      category: data.category,
      eventType: data.eventType,
      startDate: data.startDate,
      endDate: data.endDate,
      isAllDay: data.isAllDay ?? true,
      recurrence: data.recurrence ?? "once",
      source: data.source,
      status: data.status ?? "confirmed",
      aiAngles: data.aiAngles ?? [],
      reminderDaysBefore: data.reminderDaysBefore ?? 3,
      createdBy: data.createdBy,
    })
    .returning({ id: calendarEvents.id });

  return result[0].id;
}

export async function updateCalendarEventStatus(
  eventId: string,
  status: "confirmed" | "pending_review"
): Promise<void> {
  await db
    .update(calendarEvents)
    .set({ status, updatedAt: new Date() })
    .where(eq(calendarEvents.id, eventId));
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/lib/dal/calendar-events.ts
git commit -m "feat(inspiration): add calendar-events DAL"
```

---

### Task 11: Update hot-topics DAL

**Files:**
- Modify: `src/lib/dal/hot-topics.ts`

- [ ] **Step 1: Update getInspirationTopics to accept userId and return isRead**

Modify the function signature and add read state lookup. The function currently takes `(orgId: string)`. Update to:

```typescript
export async function getInspirationTopics(
  orgId: string,
  userId?: string
): Promise<InspirationTopic[]> {
```

After querying topics, before the return, add read state check:

```typescript
  // Look up read state if userId provided
  let readTopicIds: Set<string> = new Set();
  if (userId) {
    const { getTopicReadState } = await import("./topic-reads");
    const readState = await getTopicReadState(userId, orgId);
    readTopicIds = new Set(readState.readTopicIds);
  }
```

In the map function where topics are transformed, add to the returned object:

```typescript
    isRead: readTopicIds.has(row.id),
    enrichedOutlines: row.enrichedOutlines ?? [],
    relatedMaterials: row.relatedMaterials ?? [],
```

- [ ] **Step 2: Update getEditorialMeeting to support delta**

Add `lastViewedAt` parameter and compute delta. Modify the function signature:

```typescript
export async function getEditorialMeeting(
  topics: InspirationTopic[],
  monitors: PlatformMonitor[],
  lastViewedAt?: string
): Promise<EditorialMeeting> {
```

Before the return statement, compute delta if lastViewedAt is provided:

```typescript
  let delta: InspirationDelta | undefined;
  if (lastViewedAt) {
    const lastView = new Date(lastViewedAt);
    const now = new Date();
    const diffMs = now.getTime() - lastView.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const timeSinceLastView = hours > 0 ? `${hours}小时${minutes}分` : `${minutes}分钟`;

    const newTopics = topics.filter(
      (t) => new Date(t.discoveredAt) > lastView
    );

    delta = {
      timeSinceLastView,
      newTopicsCount: newTopics.length,
      newP0Count: newTopics.filter((t) => t.priority === "P0").length,
      newP1Count: newTopics.filter((t) => t.priority === "P1").length,
      newP2Count: newTopics.filter((t) => t.priority === "P2").length,
      significantChanges: [], // Could be enhanced later with heat spike detection
      subscribedChannelUpdates: "",
    };
  }
```

Add `delta` to the return object.

- [ ] **Step 3: Add getNewTopicsSince function**

Add at the end of the file:

```typescript
export async function getNewTopicsSince(
  orgId: string,
  since: Date
): Promise<{ count: number; maxPriority: "P0" | "P1" | "P2" | null }> {
  const results = await db
    .select({
      priority: hotTopics.priority,
    })
    .from(hotTopics)
    .where(
      and(
        eq(hotTopics.organizationId, orgId),
        gt(hotTopics.createdAt, since)
      )
    );

  if (results.length === 0) {
    return { count: 0, maxPriority: null };
  }

  const priorityOrder = { P0: 0, P1: 1, P2: 2 };
  const maxPriority = results.reduce((max, r) => {
    return priorityOrder[r.priority] < priorityOrder[max] ? r.priority : max;
  }, "P2" as "P0" | "P1" | "P2");

  return { count: results.length, maxPriority };
}
```

- [ ] **Step 4: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/lib/dal/hot-topics.ts
git commit -m "feat(inspiration): update hot-topics DAL with read state, delta, and polling support"
```

---

## Phase 3: Server Actions & API Route

### Task 12: Create topic-reads server actions

**Files:**
- Create: `src/app/actions/topic-reads.ts`

- [ ] **Step 1: Implement actions**

Follow the existing auth pattern from `src/app/actions/hot-topics.ts`: local `requireAuth()` returns Supabase `user`, then query `userProfiles` for orgId.

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  markTopicsAsRead,
  updateLastViewedAt,
} from "@/lib/dal/topic-reads";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function getUserOrg(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
  });
  if (!profile?.organizationId) throw new Error("No organization");
  return profile.organizationId;
}

export async function markAsReadAction(topicIds: string[]) {
  const user = await requireAuth();
  const orgId = await getUserOrg(user.id);
  await markTopicsAsRead(user.id, orgId, topicIds);
  revalidatePath("/inspiration");
}

export async function markAllAsReadAction(topicIds: string[]) {
  const user = await requireAuth();
  const orgId = await getUserOrg(user.id);
  await markTopicsAsRead(user.id, orgId, topicIds);
  revalidatePath("/inspiration");
}

export async function updateLastViewedAtAction() {
  const user = await requireAuth();
  const orgId = await getUserOrg(user.id);
  await updateLastViewedAt(user.id, orgId);
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/topic-reads.ts
git commit -m "feat(inspiration): add topic-reads server actions"
```

---

### Task 13: Create topic-subscriptions server actions

**Files:**
- Create: `src/app/actions/topic-subscriptions.ts`

- [ ] **Step 1: Implement actions**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertSubscriptions } from "@/lib/dal/topic-subscriptions";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function updateSubscriptionsAction(
  categories: string[],
  eventTypes: string[]
) {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization");
  await upsertSubscriptions(user.id, profile.organizationId, categories, eventTypes);
  revalidatePath("/inspiration");
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/topic-subscriptions.ts
git commit -m "feat(inspiration): add topic-subscriptions server actions"
```

---

### Task 14: Create calendar-events server actions

**Files:**
- Create: `src/app/actions/calendar-events.ts`

- [ ] **Step 1: Implement actions**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  createCalendarEvent,
  updateCalendarEventStatus,
} from "@/lib/dal/calendar-events";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createCalendarEventAction(data: {
  name: string;
  category: string;
  eventType: "festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial";
  startDate: string;
  endDate: string;
  isAllDay?: boolean;
  recurrence?: "once" | "yearly" | "custom";
  reminderDaysBefore?: number;
}) {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization");

  const eventId = await createCalendarEvent({
    ...data,
    organizationId: profile.organizationId,
    source: "manual",
    status: "confirmed",
    createdBy: user.id,
  });

  // TODO: Trigger AI angle generation via Inngest event
  // await inngest.send({ name: "hot-topics/enrich-requested", data: { organizationId: profile.organizationId, topicIds: [], calendarEventId: eventId } });

  revalidatePath("/inspiration");
  return eventId;
}

export async function confirmCalendarEventAction(eventId: string) {
  const user = await requireAuth();
  await updateCalendarEventStatus(eventId, "confirmed");
  revalidatePath("/inspiration");
}

export async function rejectCalendarEventAction(eventId: string) {
  const user = await requireAuth();
  // Soft delete by marking confirmed (so AI doesn't re-discover)
  await updateCalendarEventStatus(eventId, "confirmed");
  revalidatePath("/inspiration");
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/calendar-events.ts
git commit -m "feat(inspiration): add calendar-events server actions"
```

---

### Task 15: Update startTopicMission to accept selectedAngle

**Files:**
- Modify: `src/app/actions/hot-topics.ts`

- [ ] **Step 1: Extend the function signature**

Find `startTopicMission` in `src/app/actions/hot-topics.ts`. Update the signature to accept an optional second parameter:

```typescript
export async function startTopicMission(
  topicId: string,
  selectedAngle?: { angle: string; outline?: string[] }
)
```

In the `sourceContext` object, add:

```typescript
  sourceContext: {
    heatScore: topic.heatScore,
    trend: topic.trend,
    source: topic.source,
    category: topic.category,
    platforms: topic.platforms,
    ...(selectedAngle && {
      selectedAngle: selectedAngle.angle,
      selectedOutline: selectedAngle.outline,
    }),
  },
```

If `selectedAngle` is provided, append it to the `userInstruction`:

```typescript
  const angleContext = selectedAngle
    ? `\n\n选定创作角度：${selectedAngle.angle}\n大纲要点：\n${(selectedAngle.outline || []).map((p, i) => `${i + 1}. ${p}`).join("\n")}`
    : "";
```

Append `angleContext` to the instruction string.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/hot-topics.ts
git commit -m "feat(inspiration): extend startTopicMission with selectedAngle support"
```

---

### Task 16: Create polling API route

**Files:**
- Create: `src/app/api/inspiration/new-topics/route.ts`

- [ ] **Step 1: Implement the route handler**

Follow the existing auth pattern: `createClient()` → `supabase.auth.getUser()` → query `userProfiles` for orgId.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNewTopicsSince } from "@/lib/dal/hot-topics";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceParam = request.nextUrl.searchParams.get("since");
  if (!sinceParam) {
    return NextResponse.json(
      { error: "Missing 'since' parameter" },
      { status: 400 }
    );
  }

  const since = new Date(sinceParam);
  if (isNaN(since.getTime())) {
    return NextResponse.json(
      { error: "Invalid 'since' parameter" },
      { status: 400 }
    );
  }

  // Get orgId from user profile (matches existing codebase pattern)
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return NextResponse.json(
      { error: "No organization" },
      { status: 400 }
    );
  }

  const result = await getNewTopicsSince(profile.organizationId, since);

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/inspiration/new-topics/route.ts
git commit -m "feat(inspiration): add polling API route for new topics"
```

---

## Phase 4: AI Enrichment Pipeline Extension

### Task 17: Extend hot-topic-enrichment.ts with outline and material generation

**Files:**
- Modify: `src/inngest/functions/hot-topic-enrichment.ts`
- Modify: `src/inngest/events.ts`

- [ ] **Step 1: Update event type to support calendarEventId**

In `src/inngest/events.ts`, find the `"hot-topics/enrich-requested"` event definition and add optional `calendarEventId`:

```typescript
"hot-topics/enrich-requested": {
  data: {
    organizationId: string;
    topicIds: string[];
    calendarEventId?: string;
  };
};
```

- [ ] **Step 1b: Add calendar event AI angle generation branch**

At the top of the enrichment function, add early return branch for calendar events:

```typescript
// Calendar event angle generation branch
if (event.data.calendarEventId) {
  const calendarEvent = await step.run("load-calendar-event", async () => {
    return db.query.calendarEvents.findFirst({
      where: eq(calendarEvents.id, event.data.calendarEventId!),
    });
  });

  if (!calendarEvent) return { enriched: 0 };

  await step.run("generate-calendar-angles", async () => {
    const prompt = `你是一位资深新闻编辑顾问。针对以下即将到来的事件，生成2-3个适合提前策划的选题角度。

事件名称：${calendarEvent.name}
分类：${calendarEvent.category}
事件类型：${calendarEvent.eventType}
日期：${calendarEvent.startDate} - ${calendarEvent.endDate}

请返回JSON数组，每个元素是一个选题角度字符串。例如：["历史回顾与数据盘点", "行业趋势前瞻", "用户/受众视角"]

只返回JSON数组，不要其他文字。`;

    const result = await generateText({
      model: zhipu("glm-4-plus"),
      prompt,
      maxOutputTokens: 500,
    });

    const angles = JSON.parse(result.text);
    await db
      .update(calendarEvents)
      .set({ aiAngles: angles, updatedAt: new Date() })
      .where(eq(calendarEvents.id, calendarEvent.id));
  });

  return { enriched: 0, calendarEventEnriched: true };
}
```

This ensures manually created calendar events get AI angles via the same Inngest pipeline.

- [ ] **Step 2: Add outline generation step to enrichment pipeline**

In `src/inngest/functions/hot-topic-enrichment.ts`, after the existing AI analysis step that generates category/summary/trend/angles/sentiment, add a new step:

```typescript
// Step: Generate enriched outlines and related materials
await step.run("generate-outlines-and-materials", async () => {
  for (const topic of enrichedTopics) {
    const outlinePrompt = `你是一位资深新闻编辑顾问。针对以下热点话题，为每个创作角度生成详细的内容大纲。

热点标题：${topic.title}
分类：${topic.category}
摘要：${topic.summary}
创作角度：${topic.angles.join("、")}

请为每个角度返回JSON数组，格式如下：
[{
  "angle": "角度名称",
  "points": ["要点1", "要点2", "要点3", "要点4"],
  "wordCount": "建议字数范围如2000-3000",
  "style": "deep_report或quick_news或opinion或data_analysis"
}]

同时，请生成相关的参考素材（AI推理生成，非真实链接），格式如下：
{
  "outlines": [...上述数组...],
  "materials": [
    {"type": "report", "title": "相关报道标题", "source": "来源媒体", "snippet": "内容摘要"},
    {"type": "data", "title": "数据点描述", "source": "数据来源", "snippet": "具体数据"},
    {"type": "comment", "title": "评论摘要", "source": "平台", "snippet": "评论内容"}
  ]
}

只返回JSON，不要其他文字。`;

    try {
      // Use existing AI call pattern from the file (Zhipu GLM)
      const result = await generateText({
        model: zhipu("glm-4-plus"),
        prompt: outlinePrompt,
        maxOutputTokens: 2000,
      });

      const parsed = JSON.parse(result.text);

      await db
        .update(hotTopics)
        .set({
          enrichedOutlines: parsed.outlines || [],
          relatedMaterials: parsed.materials || [],
          updatedAt: new Date(),
        })
        .where(eq(hotTopics.id, topic.id));
    } catch {
      // Silently skip failed enrichment for this topic
    }
  }
});
```

- [ ] **Step 3: Add calendar event identification step**

After the outline generation step:

```typescript
// Step: Identify potential calendar events from hot topics
await step.run("identify-calendar-events", async () => {
  const eventSignals = ["倒计时", "即将开幕", "即将举办", "即将召开", "第.*届", "将于.*月.*日"];
  const signalRegex = new RegExp(eventSignals.join("|"));

  for (const topic of enrichedTopics) {
    if (!signalRegex.test(topic.title + (topic.summary || ""))) continue;

    try {
      const eventPrompt = `分析以下热点，判断是否包含一个即将到来的事件（节日、赛事、会议、展会、发布会、纪念日）。

标题：${topic.title}
摘要：${topic.summary}

如果包含事件，返回JSON：
{
  "isEvent": true,
  "name": "事件名称",
  "category": "分类（要闻/国际/军事/体育/娱乐/财经/科技/社会/健康/教育/时政）",
  "eventType": "festival/competition/conference/exhibition/launch/memorial",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "angles": ["选题角度1", "选题角度2"]
}
如果不是事件，返回：{"isEvent": false}

只返回JSON。`;

      const result = await generateText({
        model: zhipu("glm-4-plus"),
        prompt: eventPrompt,
        maxOutputTokens: 500,
      });

      const parsed = JSON.parse(result.text);
      if (parsed.isEvent) {
        await db.insert(calendarEvents).values({
          organizationId: event.data.organizationId,
          name: parsed.name,
          category: parsed.category || "要闻",
          eventType: parsed.eventType || "conference",
          startDate: parsed.startDate,
          endDate: parsed.endDate || parsed.startDate,
          source: "ai_discovered",
          status: "pending_review",
          aiAngles: parsed.angles || [],
        });
      }
    } catch {
      // Skip failed event identification
    }
  }
});
```

- [ ] **Step 4: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/inngest/functions/hot-topic-enrichment.ts src/inngest/events.ts
git commit -m "feat(inspiration): extend enrichment pipeline with outlines, materials, and calendar event detection"
```

---

### Task 18: Create calendar event seed data

**Files:**
- Create: `src/data/calendar-seed.ts`

- [ ] **Step 1: Create seed data with ~50 initial events**

Create a file with Chinese holidays, 24 solar terms, major sports events, and notable conferences/exhibitions for 2026. Structure each entry as an object matching the `calendar_events` insert shape. Include:
- All Chinese public holidays (春节, 清明, 劳动节, 端午, 中秋, 国庆)
- 24 solar terms for 2026
- ~20 major events (世界杯, 奥运会, CES, MWC, 进博会, 广交会, 世界互联网大会, etc.)
- International days (世界读书日, 世界环境日, etc.)

Each entry should have: name, category, eventType, startDate, endDate, recurrence ("yearly" for recurring), source: "builtin", status: "confirmed".

- [ ] **Step 2: Add a seed script or modify existing db:seed**

Add a function in `src/db/seed.ts` (or create `src/data/calendar-seed.ts` as a standalone importable module) that can be invoked to seed the calendar_events table.

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/data/calendar-seed.ts
git commit -m "feat(inspiration): add calendar event seed data"
```

---

## Phase 5: Server Page Update

### Task 19: Update inspiration page.tsx server component

**Files:**
- Modify: `src/app/(dashboard)/inspiration/page.tsx`

- [ ] **Step 1: Add new data fetching calls**

Follow the existing pattern from current `page.tsx`: uses `getCurrentUserOrg()` from `@/lib/dal/auth`. For userId, add a separate Supabase call. Also add a new `getCurrentUserAndOrg()` helper to `src/lib/dal/auth.ts` that returns both.

First, add to `src/lib/dal/auth.ts`:

```typescript
export const getCurrentUserAndOrg = cache(
  async (): Promise<{ userId: string; organizationId: string } | null> => {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const profile = await withRetry(() =>
        db.query.userProfiles.findFirst({
          where: eq(userProfiles.id, user.id),
        })
      );

      if (!profile?.organizationId) return null;
      return { userId: user.id, organizationId: profile.organizationId };
    } catch {
      return null;
    }
  }
);
```

Then update `page.tsx`:

```typescript
export const dynamic = "force-dynamic";

import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import {
  getInspirationTopics,
  getPlatformMonitors,
  getEditorialMeeting,
} from "@/lib/dal/hot-topics";
import { getUserSubscriptions } from "@/lib/dal/topic-subscriptions";
import { getTopicReadState } from "@/lib/dal/topic-reads";
import { getCalendarEvents } from "@/lib/dal/calendar-events";
import { updateLastViewedAt } from "@/lib/dal/topic-reads";
import { InspirationClient } from "./inspiration-client";

export default async function InspirationPage() {
  let topics: Awaited<ReturnType<typeof getInspirationTopics>> = [];
  let monitors: Awaited<ReturnType<typeof getPlatformMonitors>> = [];
  let subscriptions: Awaited<ReturnType<typeof getUserSubscriptions>> = null;
  let calendarEventsData: Awaited<ReturnType<typeof getCalendarEvents>> = [];
  let lastViewedAt = new Date().toISOString();

  try {
    const auth = await getCurrentUserAndOrg();
    if (auth) {
      const readState = await getTopicReadState(auth.userId, auth.organizationId);
      lastViewedAt = readState.lastViewedAt;

      [topics, monitors, subscriptions, calendarEventsData] = await Promise.all([
        getInspirationTopics(auth.organizationId, auth.userId),
        getPlatformMonitors(auth.organizationId),
        getUserSubscriptions(auth.userId, auth.organizationId),
        getCalendarEvents(
          auth.organizationId,
          new Date(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ),
      ]);

      // Update lastViewedAt (fire and forget)
      updateLastViewedAt(auth.userId, auth.organizationId);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  const editorial = getEditorialMeeting(topics, monitors, lastViewedAt);

  return (
    <InspirationClient
      topics={topics}
      monitors={monitors}
      editorial={editorial}
      subscriptions={subscriptions}
      calendarEvents={calendarEventsData}
      lastViewedAt={lastViewedAt}
    />
  );
}
```

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/inspiration/page.tsx
git commit -m "feat(inspiration): update server page with parallel data fetching"
```

---

## Phase 6: UI — Client Component Rebuild

### Task 20: Build the dual-panel layout shell

**Files:**
- Modify: `src/app/(dashboard)/inspiration/inspiration-client.tsx`

- [ ] **Step 1: Rewrite the component with dual-panel structure**

Replace the entire file. Start with the component shell that establishes the layout:

```typescript
"use client";

import { useState, useEffect, useCallback, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
// ... (import all needed components, actions, types)

interface InspirationClientProps {
  topics: InspirationTopic[];
  monitors: PlatformMonitor[];
  editorial: EditorialMeeting;
  subscriptions: UserTopicSubscription | null;
  calendarEvents: CalendarEvent[];
  lastViewedAt: string;
}

type TabType = "subscribed" | "all" | "calendar";

export default function InspirationClient({
  topics,
  monitors,
  editorial,
  subscriptions,
  calendarEvents,
  lastViewedAt,
}: InspirationClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("subscribed");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [localTopics, setLocalTopics] = useState(topics);
  const [newTopicCount, setNewTopicCount] = useState(0);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // ... state and handlers will be added in subsequent steps

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Smart Feed (~45%) */}
        <div className="w-[45%] flex flex-col border-r border-white/10">
          {/* AI Change Summary Bar */}
          {/* Category Tab Bar */}
          {/* Topic List */}
        </div>

        {/* Right panel - Workspace (~55%) */}
        <div className="w-[55%] flex flex-col overflow-y-auto">
          {/* Editorial Briefing (default) or Topic Detail */}
        </div>
      </div>

      {/* Bottom: Platform Monitor Status Bar */}
      <div className="border-t border-white/10 px-4 py-2">
        {/* Compact platform status row */}
      </div>
    </div>
  );
}
```

This is the layout skeleton. The following tasks fill in each section.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/inspiration/inspiration-client.tsx
git commit -m "feat(inspiration): scaffold dual-panel layout shell"
```

---

### Task 21: Implement AI Change Summary Bar

**Context:** This is the top section of the left panel. Shows delta since last visit with a collapsible card.

- [ ] **Step 1: Add summary bar section**

Inside the left panel div, add the summary bar component. Use the `editorial.delta` data to render:
- Time since last view
- New topics count with P0/P1/P2 breakdown
- Collapse/expand toggle
- "一键全部已读" button
- Collapsed state shows single-line summary

Use GlassCard for the container. Wire the "一键全部已读" button to `markAllAsReadAction` with the IDs of currently visible topics.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(inspiration): implement AI change summary bar"
```

---

### Task 22: Implement Category Tab Bar with subscription management

**Context:** Tab bar below the summary: "我的订阅(N) | 全部热点(N) | 日历灵感(N)" + ⚙️ button.

- [ ] **Step 1: Add tab bar and subscription Sheet**

Implement the tab bar with unread counts computed from `localTopics`. Add the ⚙️ button that opens a Sheet with category and event type checkboxes. Wire save to `updateSubscriptionsAction`.

Tab counts logic:
- "我的订阅": count unread topics whose category is in `subscriptions.subscribedCategories`
- "全部热点": count all unread topics
- "日历灵感": count calendar events with `status === "pending_review"`

When switching tabs, clear `selectedTopicId`.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(inspiration): implement category tab bar with subscription management"
```

---

### Task 23: Implement Topic List with unread markers and timeline divider

**Context:** The scrollable list of topics in the left panel. Shows different content based on active tab.

- [ ] **Step 1: Implement topic list for "subscribed" and "all" tabs**

Filter topics based on active tab:
- "subscribed": filter by `subscriptions.subscribedCategories`
- "all": show all, but sort subscribed categories first within same priority

Sort order: priority (P0 first) → subscribed first (in "all" tab) → heatScore descending.

Each list item renders:
- Unread dot (● if `!topic.isRead`)
- Priority badge (P0 red / P1 orange / P2 gray)
- Heat score, trend indicator, category tag (accent bg if subscribed in "all" tab)
- Title (bold if unread)
- Summary (1-2 lines, truncated)
- Platform icons + discovered time + angle count
- Selected state: left border accent

Insert timeline divider between topics newer and older than `lastViewedAt`.

On click: set `selectedTopicId`, call `markAsReadAction([topic.id])`, update local state.

- [ ] **Step 2: Implement "calendar" tab list**

When activeTab is "calendar", show calendar events grouped by time:
- 今天, 明天, 本周, 下周, 未来30天
- Each event: emoji + name + category + eventType + date + AI angles preview
- "＋ 添加事件" button at top
- Pending review events show confirm/reject buttons

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(inspiration): implement topic list with unread markers and timeline divider"
```

---

### Task 24: Implement new topic floating notification bar

**Context:** When new topics arrive (detected by polling), show a floating bar at the top of the list.

- [ ] **Step 1: Add polling logic with useEffect**

```typescript
useEffect(() => {
  let lastCheckAt = new Date().toISOString();
  let intervalId: NodeJS.Timeout | null = null;

  const poll = async () => {
    try {
      const res = await fetch(
        `/api/inspiration/new-topics?since=${encodeURIComponent(lastCheckAt)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.count > 0) {
          setNewTopicCount((prev) => prev + data.count);
        }
        lastCheckAt = new Date().toISOString();
      }
    } catch {
      // Silent ignore, retry next interval
    }
  };

  const startPolling = () => {
    intervalId = setInterval(poll, 60000);
  };

  const handleVisibility = () => {
    if (document.hidden) {
      if (intervalId) clearInterval(intervalId);
    } else {
      poll(); // Immediate poll on return
      startPolling();
    }
  };

  startPolling();
  document.addEventListener("visibilitychange", handleVisibility);

  return () => {
    if (intervalId) clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}, []);
```

- [ ] **Step 2: Render the floating bar**

Above the topic list, conditionally render:

```tsx
{newTopicCount > 0 && (
  <button
    className="sticky top-0 z-10 w-full py-2 text-center text-sm bg-blue-500/20 backdrop-blur-sm text-blue-400 hover:bg-blue-500/30 transition-colors"
    onClick={() => {
      setNewTopicCount(0);
      router.refresh();
    }}
  >
    ↑ 发现 {newTopicCount} 条新热点，点击查看
  </button>
)}
```

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(inspiration): implement new topic floating notification bar with polling"
```

---

### Task 25: Implement right panel — Editorial Briefing (default view)

**Context:** Right panel when no topic is selected. Shows the editorial meeting summary.

- [ ] **Step 1: Build the editorial briefing component**

When `selectedTopicId` is null, render:
- Title: "编辑简报 · 今日全景"
- AI summary text (from `editorial.aiSummary`)
- Two-column layout: priority distribution (P0/P1/P2 bars) + category TOP 5
- Calendar events preview (next 3 days from `calendarEvents`)
- "一键追踪全部 P0" button that batch-calls `startTopicMission` for all P0 topics

Use GlassCard containers. Follow existing glass UI patterns from the codebase.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(inspiration): implement editorial briefing default view"
```

---

### Task 26: Implement right panel — Topic Detail (deep inspiration)

**Context:** Right panel when a topic is selected. Shows all 7 sections from the spec.

- [ ] **Step 1: Build the topic detail component**

When `selectedTopicId` is set, find the topic and render:

**① Header:** "← 返回简报" link + priority/category/heat/trend badges + title + platforms + discovered time

**② Heat Curve Chart:** Reuse existing `HeatCurveChart` component

**③ AI Creative Angles:** Collapsible sections per angle from `topic.enrichedOutlines`. Each shows angle name, expandable outline (points list + word count + style). Fall back to `topic.suggestedAngles` if no outlines.

**④ Material Aggregation:** Three grouped lists from `topic.relatedMaterials`:
- 📰 相关报道 (type === "report")
- 📊 可引用数据 (type === "data")
- 💬 热门评论观点 (type === "comment")

**⑤ Sentiment Analysis:** Horizontal stacked bar (positive green / neutral gray / negative red) from `topic.commentInsight`

**⑥ Competitor Activity:** List from `topic.competitorResponse`

**⑦ Action Buttons:**
- "启动追踪" → calls `startTopicMission(topicId, selectedAngle)`. If user expanded an angle, pass that angle.
- "加入选题策划会素材" → lightweight save (can be a simple toast/state for now)

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(inspiration): implement topic detail deep inspiration panel"
```

---

### Task 27: Implement bottom platform monitor status bar

**Context:** Compact single-row status bar at bottom of the page.

- [ ] **Step 1: Build the compact platform status bar**

Render all 10 platforms in a single row:
- Each: dot indicator (green=online, gray=offline) + platform name + last scan time
- Compact layout, small text, horizontal scroll if needed

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(inspiration): implement platform monitor status bar"
```

---

### Task 28: Implement first-use onboarding dialog

**Context:** When `subscriptions` is null (new user), show a dialog to select categories.

- [ ] **Step 1: Add onboarding dialog**

Use an AlertDialog or Dialog that appears when `subscriptions === null`. Show:
- Title: "选择你关注的内容领域"
- Description: "订阅后相关热点将优先展示"
- 11 category checkboxes
- 6 event type checkboxes
- "跳过" (dismiss) and "保存" buttons

Wire save to `updateSubscriptionsAction`.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(inspiration): implement first-use onboarding dialog"
```

---

### Task 29: Add calendar event creation Sheet

**Context:** "＋ 添加事件" button in the calendar tab opens a Sheet form.

- [ ] **Step 1: Build the event creation Sheet**

Sheet form with fields:
- 名称 (text input)
- 分类 (select from 11 categories)
- 事件类型 (select from 6 event types)
- 开始日期 / 结束日期 (date pickers)
- 是否周期 (select: once/yearly/custom)
- 提前提醒天数 (number input, default 3)

Wire submit to `createCalendarEventAction`.

- [ ] **Step 2: Verify type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(inspiration): implement calendar event creation Sheet"
```

---

## Phase 7: Final Integration & Verification

### Task 30: Update loading.tsx skeleton

**Files:**
- Modify: `src/app/(dashboard)/inspiration/loading.tsx`

- [ ] **Step 1: Update skeleton to match dual-panel layout**

Replace current 3-column grid skeleton with a layout that shows:
- Left panel skeleton (40%): header skeleton + tab bar skeleton + 6 list item skeletons
- Right panel skeleton (60%): large card skeleton

- [ ] **Step 2: Commit**

```bash
git commit -am "feat(inspiration): update loading skeleton for dual-panel layout"
```

---

### Task 31: Full build verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Fix any remaining issues**

If type check or build fails, fix all errors and re-run.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(inspiration): complete inspiration pool optimization - dual panel layout with smart feed, workspace, calendar events, subscriptions, and unread tracking"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | 1-6 | Schema, enums, migration |
| Phase 2 | 7-11 | Types, DAL functions |
| Phase 3 | 12-16 | Server actions, API route |
| Phase 4 | 17-18 | AI enrichment pipeline, seed data |
| Phase 5 | 19 | Server page update |
| Phase 6 | 20-29 | Client component rebuild (10 tasks) |
| Phase 7 | 30-31 | Loading skeleton, final verification |

**Total: 31 tasks across 7 phases.**
