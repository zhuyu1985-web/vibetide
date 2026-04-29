import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getCurrentUser } from "@/lib/auth";
import { getSkillDetailWithFiles } from "@/lib/dal/skills";
import { generateSkillMd } from "@/lib/skill-package";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const skill = await getSkillDetailWithFiles(id);
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const zip = new JSZip();

  // Add SKILL.md with enriched frontmatter (category, schemas, runtimeConfig, etc.)
  const skillMd = generateSkillMd(skill.name, skill.description, skill.content, {
    name: skill.name,
    category: skill.category,
    version: skill.version,
    inputSchema: skill.inputSchema ?? undefined,
    outputSchema: skill.outputSchema ?? undefined,
    runtimeConfig: skill.runtimeConfig ?? undefined,
    compatibleRoles: skill.compatibleRoles ?? undefined,
  });
  zip.file("SKILL.md", skillMd);

  // Add files
  for (const file of skill.files) {
    zip.file(file.filePath, file.content);
  }

  const zipBuffer = await zip.generateAsync({ type: "uint8array" });

  const safeName = skill.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "_");

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.zip"`,
    },
  });
}
