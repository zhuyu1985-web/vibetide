import { getSkillsWithBindCount } from "@/lib/dal/skills";
import { SkillsClient } from "./skills-client";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  let skills: Awaited<ReturnType<typeof getSkillsWithBindCount>> = [];
  try {
    skills = await getSkillsWithBindCount();
  } catch {
    skills = [];
  }
  return <SkillsClient skills={skills} />;
}
