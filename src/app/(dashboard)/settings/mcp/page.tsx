import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listMcpServersByOrg } from "@/lib/dal/mcp-servers";
import { McpClient } from "./mcp-client";

export const dynamic = "force-dynamic";

export default async function McpSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) return <div>未找到组织</div>;

  const servers = await listMcpServersByOrg(user.organizationId);

  return <McpClient initialServers={servers} />;
}
