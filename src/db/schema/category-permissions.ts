import { pgTable, uuid, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { categories } from "./categories";
import { userProfiles, organizations } from "./users";
import { categoryPermissionTypeEnum, permissionGranteeTypeEnum } from "./enums";

export const categoryPermissions = pgTable("category_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  categoryId: uuid("category_id")
    .references(() => categories.id, { onDelete: "cascade" })
    .notNull(),

  // Who is granted
  granteeType: permissionGranteeTypeEnum("grantee_type").notNull(),
  granteeId: text("grantee_id").notNull(), // user uuid or role name ("admin"/"editor"/"viewer")

  // What permission
  permissionType: categoryPermissionTypeEnum("permission_type").notNull(),

  // Inherit to children
  inherited: boolean("inherited").notNull().default(true),

  createdBy: uuid("created_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_category_permission").on(
    table.categoryId,
    table.granteeType,
    table.granteeId,
    table.permissionType,
  ),
]);

export const categoryPermissionsRelations = relations(categoryPermissions, ({ one }) => ({
  category: one(categories, {
    fields: [categoryPermissions.categoryId],
    references: [categories.id],
  }),
  organization: one(organizations, {
    fields: [categoryPermissions.organizationId],
    references: [organizations.id],
  }),
}));
