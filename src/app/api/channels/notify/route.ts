import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getChannelConfigForOrg } from "@/lib/dal/channels";
import { sendChannelMessage } from "@/lib/channels/outbound";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  // Auth
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) {
    return NextResponse.json({ error: "无法获取组织信息" }, { status: 403 });
  }

  const body = (await req.json()) as {
    configId: string;
    chatId: string;
    type?: "text" | "markdown" | "card";
    title?: string;
    content: string;
    actions?: { label: string; url: string }[];
    missionId?: string;
  };

  if (!body.configId || !body.chatId || !body.content) {
    return NextResponse.json(
      { error: "缺少必填字段：configId、chatId、content" },
      { status: 400 }
    );
  }

  const config = await getChannelConfigForOrg(
    body.configId,
    profile.organizationId
  );
  if (!config || !config.isEnabled) {
    return NextResponse.json(
      { error: "渠道配置不存在或已禁用" },
      { status: 404 }
    );
  }

  const result = await sendChannelMessage({
    config,
    chatId: body.chatId,
    type: body.type ?? "text",
    title: body.title,
    content: body.content,
    actions: body.actions,
    missionId: body.missionId,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
