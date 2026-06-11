import { getSkillsWithBindCount } from "@/lib/dal/skills";
import { PluginsClient } from "./plugins-client";

export const dynamic = "force-dynamic";

export default async function CoworkPluginsPage() {
  let all: Awaited<ReturnType<typeof getSkillsWithBindCount>> = [];
  try {
    all = await getSkillsWithBindCount();
  } catch {
    // 优雅降级
  }
  // 个人插件 = 用户自定义 / 上传的 skill(排除 builtin 预置)
  const custom = all.filter((s) => s.type !== "builtin");
  return <PluginsClient skills={custom} />;
}
