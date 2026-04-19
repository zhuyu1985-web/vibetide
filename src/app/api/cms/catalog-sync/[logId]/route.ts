import { NextRequest, NextResponse } from "next/server";
import { getSyncLogById } from "@/lib/dal/cms-sync-logs";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Inline auth helpers — matches project convention (see benchmarking.ts / cms.ts).
async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireUserAndOrg(): Promise<{ userId: string; organizationId: string }> {
  await requireAuth();
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) throw new Error("无法获取组织信息");
  return ctx;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  try {
    const { logId } = await params;
    const { organizationId } = await requireUserAndOrg();

    const log = await getSyncLogById(logId);
    if (!log) {
      return NextResponse.json({ error: "sync log not found" }, { status: 404 });
    }
    if (log.organizationId !== organizationId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      id: log.id,
      state: log.state,
      stats: log.stats,
      warnings: log.warnings,
      startedAt: log.startedAt,
      completedAt: log.completedAt,
      durationMs: log.durationMs,
      errorMessage: log.errorMessage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
