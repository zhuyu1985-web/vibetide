import { ChannelsClient } from "./channels-client";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listChannelConfigs, listChannelMessages } from "@/lib/dal/channels";

export const dynamic = "force-dynamic";

export default async function ChannelsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div>请先登录</div>;

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) return <div>未找到组织</div>;

  const [configs, messages] = await Promise.all([
    listChannelConfigs(profile.organizationId),
    listChannelMessages(profile.organizationId, { limit: 20 }),
  ]);

  return <ChannelsClient initialConfigs={configs} initialMessages={messages} />;
}
