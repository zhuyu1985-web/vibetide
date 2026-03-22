import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { employeeScenarios, userProfiles } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up org from user profile
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return Response.json({ error: "Organization not found" }, { status: 403 });
  }

  // Fetch enabled scenarios for this employee slug
  const rows = await db
    .select()
    .from(employeeScenarios)
    .where(
      and(
        eq(employeeScenarios.organizationId, profile.organizationId),
        eq(employeeScenarios.employeeSlug, slug),
        eq(employeeScenarios.enabled, true)
      )
    )
    .orderBy(asc(employeeScenarios.sortOrder));

  const scenarios = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    inputFields: r.inputFields ?? [],
    toolsHint: r.toolsHint ?? [],
  }));

  return Response.json(scenarios);
}
