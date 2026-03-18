export const dynamic = "force-dynamic";

import { getChannelAdvisors } from "@/lib/dal/channel-advisors";
import { getCompareTests } from "@/lib/dal/advisor-tests";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import CompareClient from "./compare-client";

export default async function AdvisorComparePage() {
  const orgId = await getCurrentUserOrg().catch(() => null);
  const advisors = await getChannelAdvisors().catch(() => []);
  const history = orgId ? await getCompareTests(orgId, 20).catch(() => []) : [];

  return <CompareClient advisors={advisors} history={history} />;
}
