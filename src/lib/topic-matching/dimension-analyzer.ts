import { z } from "zod";

/**
 * 10 维度分析 Schema（源自用户贴的优质/创意对标分析模板）。
 *
 * 每个维度给出：
 *  - score: 0-100 评分
 *  - summary: 核心结论
 *  - strengths: 亮点
 *  - weaknesses: 短板
 *  - suggestions: 改进建议
 */

const dimensionSchema = z.object({
  score: z.number().min(0).max(100).describe("维度评分 0-100"),
  summary: z.string().describe("核心结论（30-80 字）"),
  strengths: z.array(z.string()).describe("亮点要点"),
  weaknesses: z.array(z.string()).describe("短板要点"),
  suggestions: z.array(z.string()).describe("改进建议"),
});

export const tenDimensionAnalysisSchema = z.object({
  // 一、选题维度
  topicDimension: dimensionSchema.describe("选题维度：是否锚定民生需求，是否兼具实用性与时代性"),
  // 二、内容维度
  contentDimension: dimensionSchema.describe("内容维度：要素是否完整，厚度是否充分，叙事是否聚焦"),
  // 三、细节维度
  detailDimension: dimensionSchema.describe("细节维度：条款是否具象，实操性如何，指导性与说服力"),
  // 四、话题设置维度
  topicSettingDimension: dimensionSchema.describe("话题设置维度：是否紧扣公共关切，延伸空间是否多元"),
  // 五、结构逻辑维度
  structureLogicDimension: dimensionSchema.describe("结构逻辑维度：层次是否清晰，服务导向是否鲜明"),
  // 六、专业性维度
  professionalismDimension: dimensionSchema.describe("专业性维度：术语是否规范，解读是否深入"),
  // 七、时效性维度
  timelinessDimension: dimensionSchema.describe("时效性维度：发布节点是否精准，引导预期是否到位"),
  // 八、传播价值维度
  communicationValueDimension: dimensionSchema.describe("传播价值维度：是否具备正向引导与服务/教化性"),
  // 九、情感表达维度
  emotionalExpressionDimension: dimensionSchema.describe("情感表达维度：客观务实 vs 人文关怀的平衡"),
  // 十、留白空间维度
  blankSpaceDimension: dimensionSchema.describe("留白空间维度：是否预留解读接口，适配多元传播场景"),

  // 总评
  overallVerdict: z.string().describe("整体总结（100-200 字）"),
  overallScore: z.number().min(0).max(100).describe("综合评分 0-100"),
  keyInsights: z.array(z.string()).describe("关键洞察 3-5 条"),
  coreImprovements: z.array(z.string()).describe("核心改进建议 3-5 条"),
});

export type TenDimensionAnalysis = z.infer<typeof tenDimensionAnalysisSchema>;

export const DIMENSION_META: Array<{
  key: keyof TenDimensionAnalysis;
  label: string;
  shortLabel: string;
}> = [
  { key: "topicDimension", label: "选题维度", shortLabel: "选题" },
  { key: "contentDimension", label: "内容维度", shortLabel: "内容" },
  { key: "detailDimension", label: "细节维度", shortLabel: "细节" },
  { key: "topicSettingDimension", label: "话题设置维度", shortLabel: "话题" },
  { key: "structureLogicDimension", label: "结构逻辑维度", shortLabel: "结构" },
  { key: "professionalismDimension", label: "专业性维度", shortLabel: "专业性" },
  { key: "timelinessDimension", label: "时效性维度", shortLabel: "时效" },
  { key: "communicationValueDimension", label: "传播价值维度", shortLabel: "传播" },
  { key: "emotionalExpressionDimension", label: "情感表达维度", shortLabel: "情感" },
  { key: "blankSpaceDimension", label: "留白空间维度", shortLabel: "留白" },
];
