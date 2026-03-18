import { db } from "@/db";
import { tagSchemas } from "@/db/schema/tag-schemas";
import { eq, and, asc } from "drizzle-orm";

/**
 * Built-in tag categories — the 9 types from asset_tags enum.
 * These are shown as locked/non-deletable in the UI.
 */
const DEFAULT_TAG_SCHEMAS: {
  name: string;
  category: string;
  description: string;
  options: { value: string; label: string }[];
}[] = [
  {
    name: "主题",
    category: "topic",
    description: "内容主题分类",
    options: [
      { value: "养老金改革", label: "养老金改革" },
      { value: "社会保障", label: "社会保障" },
      { value: "AI技术", label: "AI技术" },
    ],
  },
  {
    name: "事件",
    category: "event",
    description: "新闻事件分类",
    options: [
      { value: "两会报道", label: "两会报道" },
      { value: "台风杜苏芮", label: "台风杜苏芮" },
      { value: "春运", label: "春运" },
    ],
  },
  {
    name: "情感",
    category: "emotion",
    description: "情感倾向标注",
    options: [
      { value: "积极正面", label: "积极正面" },
      { value: "严肃客观", label: "严肃客观" },
      { value: "紧张", label: "紧张" },
    ],
  },
  {
    name: "人物",
    category: "person",
    description: "出现人物标注",
    options: [
      { value: "主持人", label: "主持人" },
      { value: "记者", label: "记者" },
      { value: "专家学者", label: "专家学者" },
    ],
  },
  {
    name: "地点",
    category: "location",
    description: "地理位置标注",
    options: [
      { value: "北京", label: "北京" },
      { value: "上海", label: "上海" },
      { value: "广州", label: "广州" },
    ],
  },
  {
    name: "拍摄手法",
    category: "shotType",
    description: "拍摄镜头类型",
    options: [
      { value: "中景", label: "中景" },
      { value: "特写", label: "特写" },
      { value: "航拍", label: "航拍" },
    ],
  },
  {
    name: "画质",
    category: "quality",
    description: "画面质量评级",
    options: [
      { value: "4K", label: "4K" },
      { value: "高清", label: "高清" },
      { value: "标清", label: "标清" },
    ],
  },
  {
    name: "物体",
    category: "object",
    description: "画面中的物体",
    options: [
      { value: "话筒", label: "话筒" },
      { value: "文件", label: "文件" },
      { value: "高铁", label: "高铁" },
    ],
  },
  {
    name: "动作",
    category: "action",
    description: "画面中的动作",
    options: [
      { value: "采访", label: "采访" },
      { value: "演讲", label: "演讲" },
      { value: "走访", label: "走访" },
    ],
  },
];

export function getDefaultTagSchemas() {
  return DEFAULT_TAG_SCHEMAS;
}

export async function getTagSchemas(
  orgId: string,
  includeInactive = false
): Promise<
  {
    id: string;
    name: string;
    category: string;
    description: string | null;
    options: { value: string; label: string }[] | null;
    isCustom: boolean | null;
    isActive: boolean | null;
    sortOrder: number | null;
  }[]
> {
  const conditions = [eq(tagSchemas.organizationId, orgId)];
  if (!includeInactive) {
    conditions.push(eq(tagSchemas.isActive, true));
  }

  const rows = await db
    .select()
    .from(tagSchemas)
    .where(and(...conditions))
    .orderBy(asc(tagSchemas.sortOrder));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    options: r.options as { value: string; label: string }[] | null,
    isCustom: r.isCustom,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));
}

export async function getTagSchema(id: string) {
  const rows = await db
    .select()
    .from(tagSchemas)
    .where(eq(tagSchemas.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    options: row.options as { value: string; label: string }[] | null,
    isCustom: row.isCustom,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}
