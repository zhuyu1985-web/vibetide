import {
  getUserFeedbackStats,
  getLearnedPatterns,
  getEffectAttributions,
  getEvolutionCurve,
} from "@/lib/dal/evolution";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { EvolutionTab } from "./evolution-tab";

interface EvolutionDataLoaderProps {
  employeeId: string; // DB uuid
}

export default async function EvolutionDataLoader({
  employeeId,
}: EvolutionDataLoaderProps) {
  const orgId = await getCurrentUserOrg();

  const [feedbackStats, patterns, evolutionData, attributions] =
    await Promise.all([
      getUserFeedbackStats(employeeId, orgId ?? ""),
      getLearnedPatterns(employeeId),
      getEvolutionCurve(employeeId, 90), // fetch 90 days; UI will slice
      getEffectAttributions(employeeId, orgId ?? ""),
    ]);

  return (
    <EvolutionTab
      employeeId={employeeId}
      feedbackStats={feedbackStats}
      patterns={patterns}
      evolutionData={evolutionData}
      attributions={attributions}
    />
  );
}
