import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";
import { channelConfigs } from "./channels";
import { missions } from "./missions";
import { articles } from "./articles";
import { hotTopics } from "./hot-topics";
import { channelPlatformEnum } from "./enums";
import type { IntentStep } from "@/lib/agent/types";

/**
 * 内容生产闭环（语音 IM 场景）的纵向阶段轴。
 * 非闭环（普通 ad-hoc 任务/收稿）会话恒为 'idle'，行为不变。
 */
export type ContentLoopPhase =
  | "idle"
  | "hot_list"
  | "topic_select"
  | "drafting"
  | "translating"
  | "review_pending"
  | "approved"
  | "publishing"
  | "analytics";

/**
 * 闭环会话的等待槽 —— 一个 jsonb 收口各阶段候选/选择，避免逐阶段加列。
 * 各字段按阶段填充，下游阶段路由读取。
 */
export interface ContentLoopContext {
  /** hot_list：候选热点清单（编号锚定，供"选第N个"解析）。 */
  topicCandidates?: {
    idx: number;
    topicId?: string;
    title: string;
    heat?: string;
    source?: string;
  }[];
  /** topic_select：选定的热点。 */
  selectedTopic?: { topicId?: string; title: string };
  /** topic_select：3 个差异化视角选题（编号锚定，供"选A/B/C"解析）。 */
  angleOptions?: {
    idx: number;
    label: string;
    pitch?: string;
    perspective?: string;
    estWords?: number;
  }[];
  /** drafting：选定的创作视角。 */
  selectedAngle?: { idx: number; label: string; pitch?: string };
  /** drafting：中文母稿 articleId（translate 始终从它转写，避免 en→en）。 */
  draftArticleId?: string;
  /** translating：当前目标语种。 */
  targetLanguage?: { code: string; label: string };
  /** review_pending：审核人候选（编号锚定，供"发给第N个审"解析）。 */
  reviewerCandidates?: {
    idx: number;
    userId: string;
    name: string;
    pendingCount: number;
  }[];
  /** review_pending：已提交的审核任务 id（提交后进入等待态）。 */
  reviewId?: string;
  /** publishing：发布渠道账号候选（国内 CMS 栏目 + 海外平台，编号锚定）。 */
  pendingDistribution?: {
    domestic: {
      idx: number;
      catalogId: number;
      appId: number;
      siteId: number;
      name: string;
    }[];
    overseas: { idx: number; platform: string; name: string }[];
  };
  /** hot_list：连续"候选为空"次数，用于超过阈值后主动提示出口（P0 防无声卡死）。 */
  hotlistWaitCount?: number;
}

/** 一个 IM 会话（configId+chatId+发送者）一份澄清/执行状态。回执反查的真相源。 */
export const channelSessions = pgTable(
  "channel_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => channelConfigs.id, { onDelete: "cascade" }),
    platform: channelPlatformEnum("platform").notNull(),
    chatId: text("chat_id").notNull(),
    externalUserId: text("external_user_id").notNull(),
    status: text("status").notNull().default("idle"),
    contextTurns: jsonb("context_turns")
      .$type<{ role: string; content: string }[]>()
      .notNull()
      .default([]),
    activeMissionId: uuid("active_mission_id").references(() => missions.id, {
      onDelete: "set null",
    }),
    clarifyRounds: integer("clarify_rounds").notNull().default(0),
    pendingPlan: jsonb("pending_plan").$type<{
      summary: string;
      steps: IntentStep[];
    }>(),
    /** 上次 mission 产出的 articleId，供发布/配图 follow-up 锚定"这篇"。 */
    lastArticleId: uuid("last_article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    /** 待确认发布任务（发布意图识别后暂存，等用户二次确认）。 */
    pendingPublish: jsonb("pending_publish").$type<{
      articleId: string;
      articleTitle: string;
      catalogName: string;
      target: { catalogId: number; appId: number; siteId: number };
    }>(),
    /** 内容生产闭环的当前阶段。非闭环会话恒为 'idle'。 */
    scenarioPhase: text("scenario_phase")
      .$type<ContentLoopPhase>()
      .notNull()
      .default("idle"),
    /** 闭环选定的热点（溯源 + 阶段路由锚定）。 */
    activeTopicId: uuid("active_topic_id").references(() => hotTopics.id, {
      onDelete: "set null",
    }),
    /** 闭环各阶段的候选/选择等待槽（一个 jsonb 收口）。 */
    loopContext: jsonb("loop_context").$type<ContentLoopContext>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("channel_sessions_triple_uidx").on(
      t.configId,
      t.chatId,
      t.externalUserId
    ),
  ]
);
