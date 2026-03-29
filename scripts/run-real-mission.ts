/**
 * Script to create and execute a REAL mission end-to-end.
 * This will:
 * 1. Delete all old seed missions (fake data)
 * 2. Create a fresh mission
 * 3. Execute the full pipeline: leader plan → task execution → consolidation
 * 4. Output real-time progress to console
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";

import { config } from "dotenv";
config({ path: ".env.local" });
config();

const client = postgres(process.env.DATABASE_URL!, { prepare: false, idle_timeout: 60, max: 2 });
const db = drizzle(client, { schema });

async function main() {
  console.log("=== Real Mission Execution ===\n");

  // 0. Verify API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("ERROR: OPENAI_API_KEY not set in .env.local");
    process.exit(1);
  }
  console.log("✓ API key configured\n");

  // 1. Find org and leader
  const org = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!org) { console.error("No organization found"); process.exit(1); }
  console.log(`Org: ${org.name} (${org.id})`);

  const leader = await db.query.aiEmployees.findFirst({
    where: eq(schema.aiEmployees.slug, "leader"),
  });
  if (!leader) { console.error("Leader employee not found"); process.exit(1); }
  console.log(`Leader: ${leader.nickname} (${leader.id})\n`);

  // 2. Delete old fake missions
  const oldMissions = await db.select({ id: schema.missions.id }).from(schema.missions);
  if (oldMissions.length > 0) {
    console.log(`Cleaning ${oldMissions.length} old missions...`);
    for (const m of oldMissions) {
      await db.delete(schema.missionArtifacts).where(eq(schema.missionArtifacts.missionId, m.id));
      await db.delete(schema.missionMessages).where(eq(schema.missionMessages.missionId, m.id));
      await db.delete(schema.missionTasks).where(eq(schema.missionTasks.missionId, m.id));
      await db.delete(schema.missions).where(eq(schema.missions.id, m.id));
    }
    console.log("✓ Old data cleaned\n");
  }

  // 3. Create a real mission
  const [mission] = await db.insert(schema.missions).values({
    organizationId: org.id,
    title: "新能源汽车2026 Q1市场格局分析",
    scenario: "deep_report",
    userInstruction: "围绕2026年第一季度新能源汽车市场进行深度报道。要求包含：1) 各主要品牌（比亚迪、特斯拉、问界、小米汽车等）的市场表现分析；2) 销量数据对比和趋势研判；3) 核心技术突破和行业动向；4) 对下半年市场格局的预测。",
    leaderEmployeeId: leader.id,
    status: "planning",
    sourceModule: "inspiration",
    sourceEntityType: "manual_trigger",
  }).returning();

  console.log(`✓ Mission created: ${mission.id}\n`);
  console.log(`  Title: ${mission.title}`);
  console.log(`  Scenario: ${mission.scenario}\n`);

  // 4. Execute the pipeline
  console.log("─── Phase 1: Leader Planning ───");
  console.log("Leader is decomposing the task...\n");

  try {
    // Dynamic import to use the project's internal modules
    const { executeMissionDirect } = await import("../src/lib/mission-executor");

    await executeMissionDirect(mission.id, org.id);

    console.log("\n=== Mission Completed ===\n");

    // 5. Print results
    const finalMission = await db.query.missions.findFirst({
      where: eq(schema.missions.id, mission.id),
    });
    console.log(`Status: ${finalMission?.status}`);
    console.log(`Progress: ${finalMission?.progress}%`);
    console.log(`Tokens used: ${finalMission?.tokensUsed}`);

    const tasks = await db.select().from(schema.missionTasks).where(eq(schema.missionTasks.missionId, mission.id));
    console.log(`\nTasks (${tasks.length}):`);
    for (const t of tasks) {
      const hasOutput = t.outputData !== null;
      console.log(`  [${t.status}] ${t.title} ${hasOutput ? "(has output)" : ""}`);
    }

    const messages = await db.select().from(schema.missionMessages).where(eq(schema.missionMessages.missionId, mission.id));
    console.log(`\nMessages (${messages.length}):`);
    for (const m of messages) {
      console.log(`  [${m.messageType}] ${m.content.slice(0, 80)}...`);
    }

  } catch (err) {
    console.error("\n=== Mission Failed ===");
    console.error(err);

    // Still print what we have
    const tasks = await db.select({ title: schema.missionTasks.title, status: schema.missionTasks.status })
      .from(schema.missionTasks).where(eq(schema.missionTasks.missionId, mission.id));
    if (tasks.length > 0) {
      console.log("\nTasks created before failure:");
      for (const t of tasks) console.log(`  [${t.status}] ${t.title}`);
    }
  }

  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
