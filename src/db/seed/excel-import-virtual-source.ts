import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { collectionSources } from "@/db/schema/collection";

export const EXCEL_IMPORT_SOURCE_NAME = "__system_excel_import__";
export const EXCEL_IMPORT_SOURCE_TYPE = "excel_import";

export async function seedExcelImportVirtualSource(orgId: string): Promise<void> {
  await db
    .insert(collectionSources)
    .values({
      organizationId: orgId,
      name: EXCEL_IMPORT_SOURCE_NAME,
      sourceType: EXCEL_IMPORT_SOURCE_TYPE,
      config: {},
      targetModules: [],
      enabled: false, // 不允许 cron 触发；仅作 import 挂载
    })
    .onConflictDoNothing();
}

export async function getOrCreateExcelImportVirtualSource(orgId: string): Promise<string> {
  await seedExcelImportVirtualSource(orgId);
  const [row] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        eq(collectionSources.name, EXCEL_IMPORT_SOURCE_NAME),
      ),
    )
    .limit(1);
  if (!row) throw new Error("virtual excel_import source 创建失败");
  return row.id;
}
