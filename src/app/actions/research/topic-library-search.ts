"use server";

import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { advancedSearchCollectedItems } from "@/lib/dal/research/collected-item-search";

export async function searchByTopic(payload: {
  topicId: string;
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  const page = payload.page ?? 1;
  const pageSize = payload.pageSize ?? 50;

  const result = await advancedSearchCollectedItems(
    organizationId,
    [],
    { limit: pageSize, offset: (page - 1) * pageSize },
    { topicIds: [payload.topicId] },
  );

  return { items: result.items, total: result.total, page, pageSize };
}
