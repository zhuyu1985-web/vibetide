import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { missions } from "@/db/schema/missions";
import { savedConversations } from "@/db/schema/saved-conversations";
import { userProfiles } from "@/db/schema/users";
import { desc, eq } from "drizzle-orm";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let recentMissions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    sourceModule?: string;
  }> = [];
  let recentConversations: Array<{
    id: string;
    title: string;
    employeeSlug: string;
    updatedAt: string;
  }> = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Get user's organization
      const profile = await db
        .select({ organizationId: userProfiles.organizationId })
        .from(userProfiles)
        .where(eq(userProfiles.id, user.id))
        .limit(1);

      const orgId = profile[0]?.organizationId;

      // Fetch recent missions (missions belong to org)
      if (orgId) {
        const missionsResult = await db
          .select({
            id: missions.id,
            title: missions.title,
            status: missions.status,
            createdAt: missions.createdAt,
            sourceModule: missions.sourceModule,
          })
          .from(missions)
          .where(eq(missions.organizationId, orgId))
          .orderBy(desc(missions.createdAt))
          .limit(5);

        recentMissions = missionsResult.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
          sourceModule: m.sourceModule ?? undefined,
        }));
      }

      // Fetch recent conversations (owned by user)
      const convsResult = await db
        .select({
          id: savedConversations.id,
          title: savedConversations.title,
          employeeSlug: savedConversations.employeeSlug,
          updatedAt: savedConversations.updatedAt,
        })
        .from(savedConversations)
        .where(eq(savedConversations.userId, user.id))
        .orderBy(desc(savedConversations.updatedAt))
        .limit(5);

      recentConversations = convsResult.map((c) => ({
        ...c,
        updatedAt: c.updatedAt.toISOString(),
      }));
    }
  } catch {
    // Graceful degradation — show empty data
  }

  return (
    <HomeClient
      recentMissions={recentMissions}
      recentConversations={recentConversations}
    />
  );
}
