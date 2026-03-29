import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateUploadUrl, defaultBucket } from "@/lib/volc-tos";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 403 });
  }

  const body = await request.json();
  const { fileName, contentType, fileSize } = body as {
    fileName: string;
    contentType: string;
    fileSize: number;
  };

  if (!fileName || !contentType) {
    return NextResponse.json(
      { error: "fileName and contentType are required" },
      { status: 400 }
    );
  }

  const objectKey = `${profile.organizationId}/${profile.id}/${randomUUID()}/${fileName}`;
  const expiresIn = 3600;
  const uploadUrl = generateUploadUrl(objectKey, contentType, expiresIn);

  return NextResponse.json({
    uploadUrl,
    objectKey,
    bucket: defaultBucket,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    fileSize,
  });
}
