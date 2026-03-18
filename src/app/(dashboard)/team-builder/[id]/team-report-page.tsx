import {
  getTeamPerformanceComparison,
  getTeamEfficiencyReport,
} from "@/lib/dal/performance";
import { TeamReport } from "./team-report";

interface TeamReportPageProps {
  teamId: string;
}

export default async function TeamReportPage({ teamId }: TeamReportPageProps) {
  const [comparison, report] = await Promise.all([
    getTeamPerformanceComparison(teamId),
    getTeamEfficiencyReport(teamId),
  ]);

  return <TeamReport comparison={comparison} report={report} />;
}
