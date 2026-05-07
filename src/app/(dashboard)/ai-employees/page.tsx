import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { AiEmployeesClient } from "./ai-employees-client";
import type { AIEmployee } from "@/lib/types";

// 60s — 适配 Supabase pooler 跨区（Seoul）冷启动时多 roundtrip 耗时。
// 之前 15s 在国内网络下首次 nav 经常 timeout 返空，导致 employees 列表显示"0 名员工"。
function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 60000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function AiEmployeesPage() {
  const [employees, orgId] = await Promise.all([
    withTimeout(getEmployees(), []),
    withTimeout(getCurrentUserOrg(), null),
  ]);

  return <AiEmployeesClient employees={employees} organizationId={orgId || ""} />;
}
