import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import {
  vectorizationStatusEnum,
  knowledgeSourceTypeEnum,
  syncLogStatusEnum,
} from "./enums";

export const knowledgeBases = pgTable("knowledge_bases", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("general"),
  documentCount: integer("document_count").default(0),

  vectorizationStatus: vectorizationStatusEnum("vectorization_status")
    .notNull()
    .default("pending"),
  chunkCount: integer("chunk_count").default(0),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncConfig: jsonb("sync_config"),
  sourceUrl: text("source_url"),
  sourceType: knowledgeSourceTypeEnum("source_type")
    .notNull()
    .default("upload"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  // Knowledge base name is unique per org.
  orgNameUidx: uniqueIndex("knowledge_bases_org_name_uidx")
    .on(table.organizationId, table.name),
}));

export const employeeKnowledgeBases = pgTable("employee_knowledge_bases", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .references(() => aiEmployees.id, { onDelete: "cascade" })
    .notNull(),
  knowledgeBaseId: uuid("knowledge_base_id")
    .references(() => knowledgeBases.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  // Join-table uniqueness — an employee either is bound to a KB or isn't.
  employeeKbUidx: uniqueIndex("employee_knowledge_bases_employee_kb_uidx")
    .on(table.employeeId, table.knowledgeBaseId),
}));

export const knowledgeItems = pgTable("knowledge_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  knowledgeBaseId: uuid("knowledge_base_id")
    .references(() => knowledgeBases.id, { onDelete: "cascade" })
    .notNull(),

  title: text("title"),
  snippet: text("snippet"),
  fullContent: text("full_content"),
  sourceDocument: text("source_document"),

  sourceType: knowledgeSourceTypeEnum("source_type")
    .notNull()
    .default("upload"),
  chunkIndex: integer("chunk_index").default(0),
  tags: jsonb("tags").$type<string[]>().default([]),

  embedding: jsonb("embedding").$type<number[]>(),
  embeddingModel: text("embedding_model"),

  relevanceScore: real("relevance_score"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const knowledgeSyncLogs = pgTable("knowledge_sync_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  knowledgeBaseId: uuid("knowledge_base_id")
    .references(() => knowledgeBases.id, { onDelete: "cascade" })
    .notNull(),

  action: text("action").notNull(),
  status: syncLogStatusEnum("status").notNull(),
  detail: text("detail"),

  documentsProcessed: integer("documents_processed").default(0),
  chunksGenerated: integer("chunks_generated").default(0),
  errorsCount: integer("errors_count").default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const knowledgeBasesRelations = relations(
  knowledgeBases,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [knowledgeBases.organizationId],
      references: [organizations.id],
    }),
    employeeKnowledgeBases: many(employeeKnowledgeBases),
    items: many(knowledgeItems),
    syncLogs: many(knowledgeSyncLogs),
  })
);

export const knowledgeItemsRelations = relations(
  knowledgeItems,
  ({ one }) => ({
    knowledgeBase: one(knowledgeBases, {
      fields: [knowledgeItems.knowledgeBaseId],
      references: [knowledgeBases.id],
    }),
  })
);

export const knowledgeSyncLogsRelations = relations(
  knowledgeSyncLogs,
  ({ one }) => ({
    knowledgeBase: one(knowledgeBases, {
      fields: [knowledgeSyncLogs.knowledgeBaseId],
      references: [knowledgeBases.id],
    }),
  })
);

export const employeeKnowledgeBasesRelations = relations(
  employeeKnowledgeBases,
  ({ one }) => ({
    employee: one(aiEmployees, {
      fields: [employeeKnowledgeBases.employeeId],
      references: [aiEmployees.id],
    }),
    knowledgeBase: one(knowledgeBases, {
      fields: [employeeKnowledgeBases.knowledgeBaseId],
      references: [knowledgeBases.id],
    }),
  })
);
