/**
 * 输入框语义建议 —— 纯前端上下文规则（Phase 1 无 LLM、零延迟）。
 * 后续可在此接轻 LLM 生成更贴语境的建议（保留同签名）。
 */
export interface CoworkInputContext {
  /** 当前会话消息总数 */
  messageCount: number;
  /** 会话里是否出现过稿件（draft_result） */
  hasDraft: boolean;
  /** 是否有未终态的 mission 在执行 */
  hasRunningMission: boolean;
}

export interface InputSuggestion {
  /** chip 上显示的短标签 */
  label: string;
  /** 点击后填入输入框的完整指令 */
  fill: string;
}

export function suggestInputs(ctx: CoworkInputContext): InputSuggestion[] {
  if (ctx.hasRunningMission) {
    return [
      { label: "看执行进度", fill: "看一下当前任务执行进度" },
      { label: "补充素材", fill: "把相关素材补充进来" },
    ];
  }
  if (ctx.hasDraft) {
    return [
      { label: "多版本分产", fill: "出各端版本：微博、抖音、视频号" },
      { label: "改得更口语化", fill: "把稿件改得更口语化、更适合短视频" },
      { label: "送审", fill: "送审这条稿件" },
      { label: "补背景数据", fill: "补充相关背景与数据支撑" },
    ];
  }
  if (ctx.messageCount === 0) {
    return [
      { label: "监测今日热点", fill: "监测今天的全网热点，给我几个选题" },
      { label: "立项做快讯+成片", fill: "今天的热点这条，立项做快讯+成片，把素材拉进来" },
      { label: "写一篇深度稿", fill: "围绕这个主题写一篇深度稿" },
    ];
  }
  return [
    { label: "写条快讯", fill: "先出一条快讯" },
    { label: "查素材", fill: "查一下相关素材" },
    { label: "出深度稿", fill: "围绕这个主题出一篇深度稿" },
  ];
}
