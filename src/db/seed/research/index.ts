// src/db/seed/research/index.ts
import { seedCqDistricts } from "./cq-districts";
import { seedResearchTopics } from "./research-topics";

export async function seedResearchModule() {
  console.log("→ Seeding research module...");
  await seedCqDistricts();
  await seedResearchTopics();
  console.log("✓ Research module seed complete");
}
