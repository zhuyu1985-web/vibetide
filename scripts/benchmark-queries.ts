import { db } from "../src/db";
import { missions, missionTasks, missionMessages, aiEmployees } from "../src/db/schema";
import { eq, desc } from "drizzle-orm";
import { config } from "dotenv";
config({ path: ".env.local" });

const orgId = "a0000000-0000-4000-8000-000000000001";

async function main() {
  const start = Date.now();

  const [ms, tasks, msgs, emps] = await Promise.all([
    db.select().from(missions).where(eq(missions.organizationId, orgId)),
    db.select({
      missionId: missionTasks.missionId,
      status: missionTasks.status,
      title: missionTasks.title,
      assignedEmployeeId: missionTasks.assignedEmployeeId,
    }).from(missionTasks)
      .innerJoin(missions, eq(missionTasks.missionId, missions.id))
      .where(eq(missions.organizationId, orgId)),
    db.select({
      missionId: missionMessages.missionId,
      content: missionMessages.content,
      fromEmployeeId: missionMessages.fromEmployeeId,
      createdAt: missionMessages.createdAt,
    }).from(missionMessages)
      .innerJoin(missions, eq(missionMessages.missionId, missions.id))
      .where(eq(missions.organizationId, orgId))
      .orderBy(desc(missionMessages.createdAt)),
    db.select({ id: aiEmployees.id, slug: aiEmployees.slug }).from(aiEmployees)
      .where(eq(aiEmployees.organizationId, orgId)),
  ]);

  console.log("Parallel query total:", Date.now() - start, "ms");
  console.log("missions:", ms.length, "tasks:", tasks.length, "msgs:", msgs.length, "emps:", emps.length);
  if (tasks[0]) console.log("task keys:", Object.keys(tasks[0]));
  process.exit(0);
}

main().catch(console.error);
