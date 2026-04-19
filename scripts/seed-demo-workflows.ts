import { db } from "@/db";
import { organizations } from "@/db/schema";
import { seedBuiltinTemplatesForOrg } from "@/lib/dal/workflow-templates";
import { buildBuiltinScenarioSeeds } from "@/db/seed-builtin-workflows";

async function main() {
  // Get all orgs
  const orgs = await db.select().from(organizations);
  console.log(`Found ${orgs.length} organizations`);

  const seeds = buildBuiltinScenarioSeeds();
  console.log(`Building ${seeds.length} builtin scenarios`);

  for (const org of orgs) {
    console.log(`Seeding org ${org.id} (${org.name})...`);
    await seedBuiltinTemplatesForOrg(org.id, seeds);
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
