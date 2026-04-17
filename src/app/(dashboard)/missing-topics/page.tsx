import { getCurrentUserOrg } from "@/lib/dal/auth";
import { missingTopicClues, missingTopicKPIs } from "@/data/benchmarking-data";
import type { MissingTopicClue, MissingTopicKPIs } from "@/lib/types";
import { MissingTopicsClient } from "./missing-topics-client";

export const dynamic = "force-dynamic";

export default async function MissingTopicsPage() {
  let clues: MissingTopicClue[] = [];
  let kpis: MissingTopicKPIs = missingTopicKPIs;

  try {
    const orgId = await getCurrentUserOrg();
    // TODO: replace mock data with DAL query when ready
    void orgId;
    clues = missingTopicClues;
    kpis = missingTopicKPIs;
  } catch {
    clues = missingTopicClues;
    kpis = missingTopicKPIs;
  }

  return <MissingTopicsClient clues={clues} kpis={kpis} />;
}
