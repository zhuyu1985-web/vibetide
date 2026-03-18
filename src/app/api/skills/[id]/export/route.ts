import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { getSkillDetailWithFiles } from "@/lib/dal/skills";
import { generateSkillMd } from "@/lib/skill-package";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const skill = await getSkillDetailWithFiles(id);
  if (!skill) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }

  const zip = new JSZip();

  // Add SKILL.md with frontmatter
  const skillMd = generateSkillMd(skill.name, skill.description, skill.content);
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
