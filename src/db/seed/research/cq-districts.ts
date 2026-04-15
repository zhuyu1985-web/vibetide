// src/db/seed/research/cq-districts.ts
import { db } from "@/db";
import { cqDistricts } from "@/db/schema/research/cq-districts";

const DISTRICTS = [
  "北碚区","两江新区","九龙坡区","云阳县","巴南区","巫山县","涪陵区","奉节县",
  "江津区","梁平区","忠县","渝中区","长寿区","开州区","黔江区","南岸区",
  "南川区","大渡口区","永川区","沙坪坝区","璧山区","万州区","秀山县","丰都县",
  "铜梁区","万盛经开区","合川区","潼南区","科学城重庆高新区","城口县","彭水县","武隆区",
  "垫江县","綦江区","荣昌区","酉阳县","大足区","石柱县","巫溪县",
];

export async function seedCqDistricts() {
  const rows = DISTRICTS.map((name, i) => ({ name, sortOrder: i }));
  await db.insert(cqDistricts).values(rows).onConflictDoNothing();
  console.log(`✓ Seeded ${DISTRICTS.length} 重庆区县`);
}
