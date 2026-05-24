"use server";

// Server Action wrappers for the 3 Tab1 DAL functions.
// 统一在 action 层做 org scope 校验,组件只传 accountId / platform / 选项参数。

import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getMetricSeries,
  getPublishActivity,
  getRecentTopPosts,
} from "@/lib/dal/account-analytics";
import type {
  Granularity,
  MetricKey,
} from "@/lib/account-analytics/platform-meta";

async function requireOrgId(): Promise<string> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");
  return orgId;
}

export async function loadMetricSeriesAction(input: {
  accountId: string;
  granularity: Granularity;
  metric: MetricKey;
}) {
  const orgId = await requireOrgId();
  return getMetricSeries({ orgId, ...input });
}

export async function loadPublishActivityAction(input: {
  accountId: string;
  /** 平台 slug；由 page.tsx 上层从 account 对象提取后传入 */
  platform: string;
  granularity: Granularity;
}) {
  const orgId = await requireOrgId();
  return getPublishActivity({ orgId, ...input });
}

export async function loadRecentTopPostsAction(input: {
  accountId: string;
  mode: "hot" | "latest";
}) {
  const orgId = await requireOrgId();
  return getRecentTopPosts({ orgId, ...input });
}
