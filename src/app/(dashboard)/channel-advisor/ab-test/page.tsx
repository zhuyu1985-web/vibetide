export const dynamic = "force-dynamic";

import { getChannelAdvisors } from "@/lib/dal/channel-advisors";
import { getAbTests } from "@/lib/dal/advisor-tests";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import AbTestClient from "./ab-test-client";

export default async function AdvisorAbTestPage() {
  const orgId = await getCurrentUserOrg().catch(() => null);
  const advisors = await getChannelAdvisors().catch(() => []);
  const tests = orgId ? await getAbTests(orgId).catch(() => []) : [];

  return <AbTestClient advisors={advisors} tests={tests} />;
}
