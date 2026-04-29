import { getChannelAdvisors } from "@/lib/dal/channel-advisors";
import ChannelAdvisorClient from "./channel-advisor-client";

export default async function ChannelAdvisorPage() {
  const advisors = await getChannelAdvisors().catch(() => []);
  return <ChannelAdvisorClient advisors={advisors} />;
}
