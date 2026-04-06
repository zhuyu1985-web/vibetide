import type { EmployeeId } from "@/lib/constants";

export interface HotTask {
  label: string;
  prompt: string;
}

export const EMPLOYEE_HOT_TASKS: Record<string, HotTask[]> = {
  xiaolei: [
    { label: "监测今日全网热点", prompt: "帮我监测今天的全网热点事件，按热度排序" },
    { label: "竞品动态追踪", prompt: "追踪主要竞品的最新动态和报道" },
    { label: "舆情风险预警", prompt: "分析当前舆情态势，识别潜在风险点" },
  ],
  xiaoce: [
    { label: "策划深度专题选题", prompt: "基于当前热点，策划一个深度专题报道的选题方案" },
    { label: "节日选题规划", prompt: "规划下一个节日节点的选题方案和内容日历" },
    { label: "爆款选题分析", prompt: "分析近期爆款内容的选题规律，提供选题建议" },
  ],
  xiaozi: [
    { label: "整理项目素材库", prompt: "帮我整理和分类当前项目的素材资源" },
    { label: "搜索相关素材", prompt: "根据选题需求，搜索和推荐合适的素材资源" },
  ],
  xiaowen: [
    { label: "撰写新闻稿件", prompt: "根据最新热点信息，撰写一篇新闻稿件" },
    { label: "改写优化文章", prompt: "帮我改写和优化这篇文章的表达和结构" },
    { label: "生成社交媒体文案", prompt: "为这个主题生成适合各平台的社交媒体文案" },
  ],
  xiaojian: [
    { label: "生成短视频脚本", prompt: "为这个选题生成一个短视频拍摄脚本" },
    { label: "视频剪辑方案", prompt: "根据素材清单，制定视频剪辑和后期方案" },
  ],
  xiaoshen: [
    { label: "审核稿件质量", prompt: "审核这篇稿件的内容质量、事实准确性和合规性" },
    { label: "内容合规检查", prompt: "对这批内容进行全面的合规性检查" },
  ],
  xiaofa: [
    { label: "制定分发策略", prompt: "为这篇内容制定全渠道分发策略和最佳发布时间" },
    { label: "渠道效果分析", prompt: "分析各渠道的发布效果，给出优化建议" },
  ],
  xiaoshu: [
    { label: "生成数据分析报告", prompt: "生成本周的内容运营数据分析报告" },
    { label: "内容效果复盘", prompt: "对近期发布的内容进行效果复盘分析" },
    { label: "用户画像分析", prompt: "分析目标受众的用户画像和阅读偏好" },
  ],
};
