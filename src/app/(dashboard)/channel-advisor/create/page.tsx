import { getKnowledgeSources } from "@/lib/dal/channel-advisors";
import CreateAdvisorClient from "./create-advisor-client";

export default async function CreateAdvisorPage() {
  const knowledgeSources = await getKnowledgeSources().catch(() => ({ upload: [], cms: [], subscription: [], stats: { totalDocuments: 0, totalChunks: 0, lastSync: "" } }));
  return <CreateAdvisorClient knowledgeSources={knowledgeSources} />;
}
