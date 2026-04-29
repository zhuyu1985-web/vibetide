import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getNewTopicsSince } from "@/lib/dal/hot-topics";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceParam = request.nextUrl.searchParams.get("since");
  if (!sinceParam) {
    return NextResponse.json(
      { error: "Missing 'since' parameter" },
      { status: 400 }
    );
  }

  const since = new Date(sinceParam);
  if (isNaN(since.getTime())) {
    return NextResponse.json(
      { error: "Invalid 'since' parameter" },
      { status: 400 }
    );
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const result = await getNewTopicsSince(profile.organizationId, since);
  return NextResponse.json(result);
}
