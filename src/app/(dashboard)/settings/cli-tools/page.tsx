import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listCliToolsByOrg, listRecentCliToolRunsByOrg } from "@/lib/dal/cli-tools";
import { allowedBinaries } from "@/lib/cli/allowlist";
import { CliToolsClient } from "./cli-tools-client";

export const dynamic = "force-dynamic";

export default async function CliToolsSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.organizationId) return <div>未找到组织</div>;

  const [tools, recentRuns] = await Promise.all([
    listCliToolsByOrg(user.organizationId),
    listRecentCliToolRunsByOrg(user.organizationId, 50),
  ]);

  // allowedBinaries() reads env var — must be called server-side and passed as prop
  const binaries = allowedBinaries();

  return (
    <CliToolsClient
      initialTools={tools}
      initialRuns={recentRuns}
      allowedBinaries={binaries}
    />
  );
}
