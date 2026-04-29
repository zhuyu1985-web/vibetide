import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Organization-level settings stored as JSONB.
 *
 * `defaultTemplates` lets ops pin which workflow_template each module's
 * "quick action" should launch. UNIVERSAL pattern — add new module keys
 * (e.g. `deepReport`, `socialMedia`) here as the need arises.
 *
 * Currently supported:
 *   - `hotTopic`: template id used by `getDefaultHotTopicTemplate` for the
 *     灵感发现"启动追踪"按钮 / cron 自动追踪。
 */
export interface OrganizationSettings {
  defaultTemplates?: {
    hotTopic?: string;
  };
  /**
   * 每日热点快讯发布配置：
   *   - `cmsChannelSlug`: 推送到哪个 app_channel（默认 'app_home'）
   *   - `enabled`: 是否启用 cron 自动推送（默认 true）
   */
  dailyHotBriefing?: {
    cmsChannelSlug?: string;
    enabled?: boolean;
  };
  [key: string]: unknown;
}

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: jsonb("settings").$type<OrganizationSettings>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey(), // legacy: matched Supabase auth.users.id; now self-managed uuid
  organizationId: uuid("organization_id").references(() => organizations.id),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("editor"), // legacy: admin, editor, viewer
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  avatarUrl: text("avatar_url"),
  // Self-built auth (replaces Supabase Auth)
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  passwordHashAlgo: text("password_hash_algo").default("argon2id"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  userProfiles: many(userProfiles),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [userProfiles.organizationId],
    references: [organizations.id],
  }),
}));
