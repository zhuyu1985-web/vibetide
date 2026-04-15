// scripts/seed-research.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import("@/db/seed/research").then(({ seedResearchModule }) =>
  seedResearchModule()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); })
);
