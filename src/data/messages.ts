import type { TeamMessage } from "@/lib/types";

export const teamMessages: TeamMessage[] = [
  {
    id: "msg1",
    employeeId: "xiaolei",
    type: "alert",
    content: "紧急热点预警！「AI手机大战」话题热度在过去1小时内飙升120%，目前热度指数97，建议立即启动追踪流程。华为、苹果、三星三家同日发布AI手机战略。",
    timestamp: "2026-02-26T12:05:00Z",
    actions: [
      { label: "立即追踪", variant: "primary" },
      { label: "稍后处理", variant: "default" },
    ],
    attachments: [
      { type: "topic_card", title: "AI手机大战：华为、苹果、三星三方角力", description: "热度 97 | 急升中" },
    ],
  },
  {
    id: "msg2",
    employeeId: "xiaoce",
    type: "decision_request",
    content: "针对「AI手机大战」热点，我策划了3个差异化角度，请选择优先执行的方向：\n\n1. 消费者视角：三款AI手机实测对比（预计阅读量最高）\n2. 行业分析：AI手机重新定义智能体验（深度价值最高）\n3. 投资观点：AI手机产业链机会（垂直度最高）",
    timestamp: "2026-02-26T12:08:00Z",
    actions: [
      { label: "选择方案1", variant: "primary" },
      { label: "选择方案2", variant: "default" },
      { label: "选择方案3", variant: "default" },
      { label: "全部执行", variant: "default" },
    ],
  },
  {
    id: "msg3",
    employeeId: "xiaozi",
    type: "status_update",
    content: "已为「AI手机大战」选题准备好素材包：\n- 华为发布会高清视频片段 x3\n- 苹果AI功能演示截图 x8\n- 三星Galaxy AI宣传图 x5\n- 版权状态：全部可用，已通过审查",
    timestamp: "2026-02-26T12:12:00Z",
    attachments: [
      { type: "asset", title: "AI手机素材包", description: "16个文件，总计128MB" },
    ],
  },
  {
    id: "msg4",
    employeeId: "xiaowen",
    type: "work_output",
    content: "《AI手机大战：消费者的三重抉择》初稿已完成（2800字），核心论点：\n- 华为：端侧隐私优先\n- 苹果：生态协同\n- 三星：开放灵活\n已发送至小审审核，预计10分钟内返回审核结果。",
    timestamp: "2026-02-26T12:25:00Z",
    attachments: [
      { type: "draft_preview", title: "AI手机大战：消费者的三重抉择", description: "2800字 | 图文稿" },
    ],
    actions: [
      { label: "查看全文", variant: "primary" },
      { label: "提出修改意见", variant: "default" },
    ],
  },
  {
    id: "msg5",
    employeeId: "xiaoshen",
    type: "status_update",
    content: "《AI手机大战》稿件审核完成，综合评分 92/100：\n- 事实准确性：95 ✓\n- 敏感内容检测：通过 ✓\n- 风格一致性：90 ✓\n- 建议优化：第三段「据报道」建议补充具体来源",
    timestamp: "2026-02-26T12:35:00Z",
    actions: [
      { label: "通过发布", variant: "primary" },
      { label: "退回修改", variant: "default" },
    ],
  },
  {
    id: "msg6",
    employeeId: "xiaolei",
    type: "alert",
    content: "新热点捕获：「新能源汽车集体降价潮」，热度指数93，多品牌同日宣布降价。建议优先级P0，立即追踪。",
    timestamp: "2026-02-26T11:30:00Z",
    attachments: [
      { type: "topic_card", title: "新能源汽车集体降价潮来袭", description: "热度 93 | 上升中" },
    ],
    actions: [
      { label: "加入追踪", variant: "primary" },
      { label: "暂不追踪", variant: "default" },
    ],
  },
  {
    id: "msg7",
    employeeId: "xiaofa",
    type: "status_update",
    content: "《新能源汽车降价潮》稿件已完成多平台适配：\n- 微信公众号版（长文）✓\n- 头条号版（信息流优化）✓\n- 抖音脚本（60秒短视频）✓\n\n建议发布时间：今日14:00（用户活跃高峰）",
    timestamp: "2026-02-26T13:00:00Z",
    actions: [
      { label: "按计划发布", variant: "primary" },
      { label: "调整时间", variant: "default" },
    ],
  },
  {
    id: "msg8",
    employeeId: "xiaoshu",
    type: "work_output",
    content: "本周数据周报已生成：\n- 总阅读量：125.6万（+18.3%）\n- 爆款率：23%（超目标5个百分点）\n- 最佳渠道：抖音（环比+32%）\n- 需关注：百家号打开率下降，建议调整标题策略",
    timestamp: "2026-02-26T10:00:00Z",
    attachments: [
      { type: "chart", title: "本周数据周报", description: "7日数据汇总" },
    ],
    actions: [
      { label: "查看详情", variant: "primary" },
    ],
  },
  {
    id: "msg9",
    employeeId: "xiaoce",
    type: "status_update",
    content: "下午选题会排期建议：\n1. 14:00 AI手机大战 — 后续追踪角度\n2. 14:20 新能源降价潮 — 数据可视化方向\n3. 14:40 两会前瞻 — 系列内容规划\n\n已同步给所有相关AI员工。",
    timestamp: "2026-02-26T13:30:00Z",
  },
  {
    id: "msg10",
    employeeId: "xiaojian",
    type: "work_output",
    content: "「AI手机大战」短视频已制作完成：\n- 时长：58秒\n- 封面：自动生成3版（推荐第2版，预测CTR最高）\n- 字幕：中文硬字幕已嵌入\n- 格式：横版16:9 + 竖版9:16",
    timestamp: "2026-02-26T13:15:00Z",
    actions: [
      { label: "预览视频", variant: "primary" },
      { label: "更换封面", variant: "default" },
    ],
  },
  {
    id: "msg11",
    employeeId: "xiaolei",
    type: "status_update",
    content: "热点追踪晨报（02/26）：\n- 监控平台：32个\n- 新发现热点：6个\n- P0级别：3个（AI手机/新能源降价/两会前瞻）\n- 预计今日高发时段：14:00-16:00",
    timestamp: "2026-02-26T08:30:00Z",
  },
  {
    id: "msg12",
    employeeId: "xiaoshen",
    type: "alert",
    content: "审核预警：《新能源降价潮》稿件中提到具体品牌降价数据，部分来源为社交媒体截图，建议补充官方渠道确认后再发布。风险等级：中等。",
    timestamp: "2026-02-26T12:50:00Z",
    actions: [
      { label: "暂停发布", variant: "destructive" },
      { label: "补充来源后发布", variant: "primary" },
    ],
  },
  {
    id: "msg13",
    employeeId: "xiaozi",
    type: "status_update",
    content: "媒资库今日更新：\n- 新增素材：47个\n- 自动标签完成：100%\n- 版权待审：3个（已标记）\n- 存储空间：已使用68.2GB / 100GB",
    timestamp: "2026-02-26T09:00:00Z",
  },
  {
    id: "msg14",
    employeeId: "xiaoshu",
    type: "alert",
    content: "数据异常提醒：微信公众号昨日推文打开率骤降至2.1%（平均5.8%），初步分析可能与推送时间变更有关。建议恢复原推送时间并观察2天。",
    timestamp: "2026-02-26T09:30:00Z",
    actions: [
      { label: "查看详细分析", variant: "primary" },
      { label: "调整推送时间", variant: "default" },
    ],
  },
  {
    id: "msg15",
    employeeId: "xiaowen",
    type: "status_update",
    content: "今日创作排期：\n- 09:00-11:00 「新能源降价潮」深度分析 ← 进行中\n- 11:00-12:00 「两会数字经济前瞻」快讯\n- 14:00-16:00 「AI手机大战」系列第二篇\n\n当前进度：第一篇初稿80%完成。",
    timestamp: "2026-02-26T10:30:00Z",
  },
];
