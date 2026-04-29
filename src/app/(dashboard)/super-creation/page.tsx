import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getActiveCreationGoal,
  getCreationTasks,
  getCreationChatMessages,
} from "@/lib/dal/creation";
import { SuperCreationClient } from "./super-creation-client";

export default async function SuperCreationPage() {
  let goal: Awaited<ReturnType<typeof getActiveCreationGoal>> | null = null;
  let tasks: Awaited<ReturnType<typeof getCreationTasks>> = [];
  let chatHistory: Awaited<ReturnType<typeof getCreationChatMessages>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      goal = await getActiveCreationGoal(orgId);
      if (goal) {
        [tasks, chatHistory] = await Promise.all([
          getCreationTasks(goal.id),
          getCreationChatMessages(goal.id),
        ]);
      }
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  return (
    <SuperCreationClient
      goal={goal}
      tasks={tasks}
      chatHistory={chatHistory}
    />
  );
}
