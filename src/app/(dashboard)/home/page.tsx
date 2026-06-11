import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentUserProfile } from "@/lib/dal/auth";
import { listProjectsByOrg } from "@/lib/dal/projects";
import { listConversationsByUser } from "@/lib/dal/cowork-conversations";
import {
  listTemplatesForHomepageByTab,
  type HomepageTabKey,
} from "@/lib/dal/workflow-templates-listing";
import type { WorkflowTemplateRow } from "@/db/types";
import type { Project } from "@/db/schema/projects";
import type { Conversation } from "@/db/schema/conversations";
import { HomeWorkspaceClient } from "./home-workspace-client";

export const dynamic = "force-dynamic";

// 首页 tab — "主流场景 + 8 职能 + 我的工作流" = 10 tab，服务端并行 fetch。
const HOMEPAGE_TAB_KEYS: HomepageTabKey[] = [
  "featured",
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
  "custom",
];

export default async function HomePage() {
  let projects: Project[] = [];
  let conversations: Conversation[] = [];
  let templatesByTab: Record<
    string,
    (WorkflowTemplateRow & { __homepagePinnedAt?: Date | null })[]
  > = {};
  let canManageHomepage = false;

  try {
    const user = await getCurrentUser();
    if (user) {
      const orgId = user.organizationId;
      if (orgId) {
        // cowork 工作区栏数据(项目 + 最近对话)
        [projects, conversations] = await Promise.all([
          listProjectsByOrg(orgId),
          listConversationsByUser(orgId, user.id),
        ]);

        // 场景宫格 — 并行 fetch 10 个 tab。
        try {
          const results = await Promise.all(
            HOMEPAGE_TAB_KEYS.map((key) =>
              listTemplatesForHomepageByTab(orgId, key, { userId: user.id }),
            ),
          );
          templatesByTab = Object.fromEntries(
            HOMEPAGE_TAB_KEYS.map((key, i) => [key, results[i]]),
          );
        } catch {
          // 优雅降级 — 空 tab map。
        }
      }

      // 是否可管理首页(admin / owner / 超级管理员)。
      try {
        const profile = await getCurrentUserProfile();
        if (profile) {
          canManageHomepage =
            profile.isSuperAdmin ||
            profile.role === "admin" ||
            profile.role === "owner";
        }
      } catch {
        // 普通用户视图
      }
    }
  } catch {
    // 优雅降级 — 空数据
  }

  return (
    <Suspense>
      <HomeWorkspaceClient
        conversations={conversations}
        projects={projects}
        templatesByTab={templatesByTab}
        canManageHomepage={canManageHomepage}
      />
    </Suspense>
  );
}
