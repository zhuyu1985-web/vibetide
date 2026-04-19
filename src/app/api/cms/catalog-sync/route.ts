import { NextRequest, NextResponse } from "next/server";
import { triggerCatalogSyncAction } from "@/app/actions/cms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SyncRequestBody {
  dryRun?: boolean;
  deleteMissing?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await safeJson(req);
    const result = await triggerCatalogSyncAction({
      dryRun: body?.dryRun === true,
      deleteMissing: body?.deleteMissing !== false,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function safeJson(req: NextRequest): Promise<SyncRequestBody> {
  try {
    return (await req.json()) as SyncRequestBody;
  } catch {
    return {};
  }
}
