// src/db/seed/research/index.ts
import { seedCqDistricts } from "./cq-districts";
import { seedResearchTopics } from "./research-topics";
import { seedMediaOutlets } from "./media-outlets";

export async function seedResearchModule() {
  console.log("→ Seeding research module...");
  await seedCqDistricts();
  await seedResearchTopics();
  await seedMediaOutlets();
  console.log("✓ Research module seed complete");
}
