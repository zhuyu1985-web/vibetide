import { NextResponse } from "next/server";
import { getEmployees } from "@/lib/dal/employees";
import { getCurrentUserOrg } from "@/lib/dal/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [employees, orgId] = await Promise.all([
      getEmployees(),
      getCurrentUserOrg(),
    ]);
    return NextResponse.json({ employees, organizationId: orgId || "" });
  } catch (error) {
    console.error("[api/employees] failed:", error);
    return NextResponse.json(
      { employees: [], organizationId: "", error: "数据加载失败" },
      { status: 500 }
    );
  }
}
