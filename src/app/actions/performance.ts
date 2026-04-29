"use server";

import { requireAuth } from "@/lib/auth";
import { snapshotPerformance, snapshotAllPerformance } from "@/lib/dal/performance";
import { revalidatePath } from "next/cache";
/**
 * Take a performance snapshot for a single employee.
 */
export async function takePerformanceSnapshot(
  employeeId: string
): Promise<{ success: boolean }> {
  await requireAuth();
  await snapshotPerformance(employeeId);
  revalidatePath("/employee");
  return { success: true };
}

/**
 * Take performance snapshots for all employees (for cron use).
 */
export async function takeAllSnapshots(): Promise<{
  success: boolean;
  count: number;
}> {
  await requireAuth();
  const count = await snapshotAllPerformance();
  revalidatePath("/employee");
  revalidatePath("/missions");
  return { success: true, count };
}
