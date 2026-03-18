import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { mediaAssets } from "./media-assets";
import { entityTypeEnum } from "./enums";

export const knowledgeNodes = pgTable("knowledge_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  entityType: entityTypeEnum("entity_type").notNull(),
  entityName: text("entity_name").notNull(),
  description: text("description"),

  metadata: jsonb("metadata").$type<{
    aliases?: string[];
    imageUrl?: string;
    externalId?: string;
    properties?: Record<string, unknown>;
  }>(),

  connectionCount: integer("connection_count").notNull().default(0),
  sourceAssetId: uuid("source_asset_id").references(() => mediaAssets.id),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const knowledgeRelations_ = pgTable("knowledge_relations", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceNodeId: uuid("source_node_id")
    .references(() => knowledgeNodes.id, { onDelete: "cascade" })
    .notNull(),
  targetNodeId: uuid("target_node_id")
    .references(() => knowledgeNodes.id, { onDelete: "cascade" })
    .notNull(),

  relationType: text("relation_type").notNull(),
  weight: real("weight").default(1.0),
  metadata: jsonb("metadata"),

  sourceAssetId: uuid("source_asset_id").references(() => mediaAssets.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const knowledgeNodesRelations = relations(
  knowledgeNodes,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [knowledgeNodes.organizationId],
      references: [organizations.id],
    }),
    sourceAsset: one(mediaAssets, {
      fields: [knowledgeNodes.sourceAssetId],
      references: [mediaAssets.id],
    }),
    outgoingRelations: many(knowledgeRelations_, {
      relationName: "sourceNode",
    }),
    incomingRelations: many(knowledgeRelations_, {
      relationName: "targetNode",
    }),
  })
);

export const knowledgeRelationsRelations = relations(
  knowledgeRelations_,
  ({ one }) => ({
    sourceNode: one(knowledgeNodes, {
      fields: [knowledgeRelations_.sourceNodeId],
      references: [knowledgeNodes.id],
      relationName: "sourceNode",
    }),
    targetNode: one(knowledgeNodes, {
      fields: [knowledgeRelations_.targetNodeId],
      references: [knowledgeNodes.id],
      relationName: "targetNode",
    }),
    sourceAsset: one(mediaAssets, {
      fields: [knowledgeRelations_.sourceAssetId],
      references: [mediaAssets.id],
    }),
  })
);
