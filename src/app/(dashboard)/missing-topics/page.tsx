import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  listMissingTopics,
  getMissingTopicKpis,
  type MissingTopicRow,
} from "@/lib/dal/missing-topics";
import { MissingTopicsClient } from "./missing-topics-client";

export const dynamic = "force-dynamic";

export default async function MissingTopicsPage() {
  let items: MissingTopicRow[] = [];
  let kpis = {
    totalClues: 0,
    suspectedMissed: 0,
    confirmedMissed: 0,
    covered: 0,
    excluded: 0,
    pushed: 0,
    coverageRate: 0,
  };

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      const [list, k] = await Promise.all([
        listMissingTopics(orgId, { pageSize: 100 }),
        getMissingTopicKpis(orgId),
      ]);
      items = list.items;
      kpis = k;
    }
  } catch (err) {
    console.error("[missing-topics] 加载失败:", err);
  }

  return <MissingTopicsClient items={items} kpis={kpis} />;
}
