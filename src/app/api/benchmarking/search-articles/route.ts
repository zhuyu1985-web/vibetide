import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { searchArticlesForLinking } from "@/lib/dal/benchmarking";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const profile = await db.query.userProfiles.findFirst({ where: eq(userProfiles.id, user.id) });
  if (!profile?.organizationId) return NextResponse.json([]);

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchArticlesForLinking(profile.organizationId, q);
  return NextResponse.json(results);
}
