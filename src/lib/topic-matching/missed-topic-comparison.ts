import { z } from "zod";

/**
 * 漏题多媒体对比分析 schema。
 *
 * 输入：同一话题下 N 家媒体的报道（标题 + 摘要 + 正文）
 * 输出：
 *   - summary: 总结 N 家媒体的报道格局
 *   - mediaPerspectives: 每家媒体的视角/切入点
 *   - dimensionComparison: 维度对比（叙事/数据/情感/时效/立意）
 *   - coverageGaps: 覆盖空白与补报机会
 *   - recommendedAngle: 我方补报建议
 */

export const missedTopicComparisonSchema = z.object({
  summary: z.string().describe("概述该话题的报道格局，N 家媒体整体态势（80-150 字）"),

  mediaPerspectives: z
    .array(
      z.object({
        accountName: z.string().describe("账号名称"),
        level: z.string().describe("账号级别（央级/省级/地市/行业/自媒体）"),
        angle: z.string().describe("报道角度一句话描述"),
        keyPoints: z.array(z.string()).describe("核心要点 2-4 条"),
        tone: z.string().describe("语气风格：如 政策解读 / 民生温度 / 财经硬核 / 情感共鸣 / 理性评述"),
        differentiator: z.string().describe("该账号与其他账号的差异点（30 字内）"),
      })
    )
    .describe("每家报道媒体的视角分析"),

  dimensionComparison: z
    .array(
      z.object({
        dimension: z.string().describe("对比维度名"),
        winners: z.array(z.string()).describe("该维度表现突出的账号名称"),
        comment: z.string().describe("对比观察 30-80 字"),
      })
    )
    .describe("维度对比（至少覆盖：叙事角度 / 数据支撑 / 时效性 / 情感表达 / 传播价值 / 专业深度 6 个维度）"),

  coverageGaps: z
    .array(
      z.object({
        gap: z.string().describe("当前报道中缺少或不足的点"),
        suggestion: z.string().describe("如果我方补报应如何切入"),
        urgency: z.enum(["high", "medium", "low"]).describe("紧急度"),
      })
    )
    .describe("覆盖空白与补报机会 2-4 条"),

  recommendedAngle: z.string().describe("综合建议：如果我方现在补报，最佳切入角度是什么（100-200 字）"),
  recommendedHeadline: z.string().describe("建议的补报标题（10-30 字，吸引力强）"),
});

export type MissedTopicComparison = z.infer<typeof missedTopicComparisonSchema>;
