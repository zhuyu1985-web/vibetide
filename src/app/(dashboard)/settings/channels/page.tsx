import { ChannelsClient } from "./channels-client";
import { getCurrentUser } from "@/lib/auth";
import { listChannelConfigs, listChannelMessages } from "@/lib/dal/channels";

export default async function ChannelsSettingsPage() {
  const user = await getCurrentUser();
  if (!user) return <div>请先登录</div>;
  if (!user.organizationId) return <div>未找到组织</div>;

  const [configs, messages] = await Promise.all([
    listChannelConfigs(user.organizationId),
    listChannelMessages(user.organizationId, { limit: 20 }),
  ]);

  return <ChannelsClient initialConfigs={configs} initialMessages={messages} />;
}
