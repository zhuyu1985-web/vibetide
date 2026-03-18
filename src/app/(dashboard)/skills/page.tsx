import { getSkillsWithBindCount } from "@/lib/dal/skills";
import { SkillsClient } from "./skills-client";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const skills = await getSkillsWithBindCount();
  return <SkillsClient skills={skills} />;
}
