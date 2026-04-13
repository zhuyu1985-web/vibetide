export interface TocItem {
  id: string;
  title: string;
  level: number; // 1 = chapter, 2 = section
}

export const TOC_ITEMS: TocItem[] = [
  { id: "overview", title: "概述", level: 1 },
  { id: "ch1", title: "一、系统分层架构", level: 1 },
  { id: "ch1-overview", title: "架构总览", level: 2 },
  { id: "ch1-layers", title: "各层职责", level: 2 },
  { id: "ch1-relations", title: "模块关系图", level: 2 },
  { id: "ch2", title: "二、核心设计哲学", level: 1 },
  { id: "ch2-skills", title: "为什么需要「技能」", level: 2 },
  { id: "ch2-compare", title: "AI员工 vs 工作流", level: 2 },
  { id: "ch3", title: "三、知识库体系", level: 1 },
  { id: "ch3-why", title: "为什么需要知识库", level: 2 },
  { id: "ch3-pipeline", title: "全链路流程", level: 2 },
  { id: "ch3-binding", title: "员工绑定机制", level: 2 },
  { id: "ch4", title: "四、认知进化闭环", level: 1 },
  { id: "ch4-overview", title: "闭环全景", level: 2 },
  { id: "ch4-intent", title: "① 意图理解", level: 2 },
  { id: "ch4-skill", title: "② 技能学习与发现", level: 2 },
  { id: "ch4-dag", title: "③ 动态流程创建", level: 2 },
  { id: "ch4-exec", title: "④ 智能执行", level: 2 },
  { id: "ch4-verify", title: "⑤ 结果验证", level: 2 },
  { id: "ch4-learn", title: "⑥ 学习引擎", level: 2 },
  { id: "ch4-flywheel", title: "飞轮效应", level: 2 },
  { id: "ch5", title: "五、技术实现要点", level: 1 },
  { id: "appendix", title: "附录", level: 1 },
];

// Architecture layers data
export interface ArchLayer {
  name: string;
  color: string; // tailwind color class
  modules: { name: string; highlight?: boolean }[];
}

export const ARCH_LAYERS: ArchLayer[] = [
  {
    name: "业务应用层",
    color: "pink",
    modules: [
      { name: "灵感池" }, { name: "超级创作" }, { name: "视频批量" },
      { name: "全渠道发布" }, { name: "竞品分析" }, { name: "数据分析" },
      { name: "智能媒资" }, { name: "审批中心" }, { name: "排行榜" },
      { name: "事件自动化" },
    ],
  },
  {
    name: "智能体层",
    color: "indigo",
    modules: [
      { name: "AI 员工", highlight: true }, { name: "工作流引擎", highlight: true },
      { name: "对话中心", highlight: true }, { name: "意图识别", highlight: true },
      { name: "任务中心", highlight: true },
    ],
  },
  {
    name: "能力基座层",
    color: "cyan",
    modules: [
      { name: "技能系统", highlight: true }, { name: "知识库", highlight: true },
      { name: "记忆系统", highlight: true }, { name: "工具注册表", highlight: true },
      { name: "7层提示词引擎", highlight: true },
    ],
  },
  {
    name: "基础设施层",
    color: "emerald",
    modules: [
      { name: "Supabase PostgreSQL" }, { name: "AI SDK + LLM" },
      { name: "Jina Embeddings" }, { name: "Inngest 事件调度" },
      { name: "Tavily 搜索" }, { name: "Next.js 16" },
    ],
  },
];

// Cognitive loop steps
export interface LoopStep {
  id: string;
  num: string;
  title: string;
  description: string;
  color: string; // hex color
}

export const COGNITIVE_LOOP_STEPS: LoopStep[] = [
  { id: "intent", num: "①", title: "意图理解", description: "自然语言 → 意图分析 → 路由", color: "#6366f1" },
  { id: "skill", num: "②", title: "技能学习与发现", description: "技能匹配 → 熟练度评估", color: "#06b6d4" },
  { id: "dag", num: "③", title: "动态流程创建", description: "DAG拆解 → 员工分配 → 并行调度", color: "#10b981" },
  { id: "exec", num: "④", title: "智能执行", description: "Agent Assembly → 7层Prompt → LLM", color: "#f59e0b" },
  { id: "verify", num: "⑤", title: "结果验证", description: "四维自评 + 用户反馈", color: "#ef4444" },
  { id: "learn", num: "⑥", title: "学习引擎", description: "模式提取 → 记忆沉淀 → 行为优化", color: "#ec4899" },
];

// 7-layer prompt data
export interface PromptLayer {
  layer: number;
  name: string;
  content: string;
  dynamicLevel: "静态" | "半动态" | "高度动态";
}

export const PROMPT_LAYERS: PromptLayer[] = [
  { layer: 1, name: "身份层", content: "员工姓名、角色、性格特征、工作风格", dynamicLevel: "静态" },
  { layer: 2, name: "技能层", content: "已绑定技能列表 + 各技能熟练度 + 执行指南", dynamicLevel: "半动态" },
  { layer: 3, name: "权限层", content: "权限等级约束（观察者/顾问/领导者）", dynamicLevel: "静态" },
  { layer: 4, name: "知识层", content: "绑定的知识库清单 + kb_search 工具说明", dynamicLevel: "半动态" },
  { layer: 5, name: "风格层", content: "敏感话题规避 + 工作偏好", dynamicLevel: "半动态" },
  { layer: 6, name: "记忆层", content: "Top-10 历史记忆 + 学习模式", dynamicLevel: "高度动态" },
  { layer: 7, name: "输出层", content: "输出格式要求 + 质量自评评分标准", dynamicLevel: "静态" },
];

// Tech stack data
export interface TechItem {
  name: string;
  category: string;
  reason: string;
}

export const TECH_STACK: TechItem[] = [
  { name: "Next.js 16 + React 19", category: "框架", reason: "Server Component 天然适合 AI 流式渲染" },
  { name: "Supabase PostgreSQL", category: "数据库", reason: "开源、JSONB 存向量和学习模式" },
  { name: "Drizzle ORM", category: "ORM", reason: "类型安全、轻量、迁移管理清晰" },
  { name: "AI SDK v6", category: "AI 调用", reason: "统一接口、内置工具调用、流式支持" },
  { name: "Jina Embeddings v3", category: "向量化", reason: "1024维、中文优化、批量处理" },
  { name: "Inngest", category: "任务调度", reason: "事件驱动、自带重试、可视化任务流" },
  { name: "Tavily API", category: "搜索", reason: "专为 AI Agent 设计的结构化搜索" },
];

// Implementation status
export interface StatusItem {
  feature: string;
  status: "done" | "planned";
  note: string;
}

export const IMPL_STATUS: StatusItem[] = [
  { feature: "四层架构", status: "done", note: "完整运行" },
  { feature: "技能系统（多对多绑定）", status: "done", note: "28+技能" },
  { feature: "技能熟练度自动更新", status: "done", note: "基于质量评分delta规则" },
  { feature: "熟练度影响Prompt行为", status: "done", note: "三档行为指导" },
  { feature: "熟练度影响Leader分配", status: "planned", note: "目前Leader只看技能名" },
  { feature: "AI员工直接对话", status: "done", note: "对话中心+意图识别" },
  { feature: "工作流编排+DAG执行", status: "done", note: "模板→Mission→调度" },
  { feature: "Leader动态员工匹配", status: "done", note: "根据技能智能匹配" },
  { feature: "知识库三通道入库", status: "done", note: "手动/上传/URL" },
  { feature: "向量化+RAG检索", status: "done", note: "Jina 1024维" },
  { feature: "pgvector原生检索", status: "planned", note: "超10k条时升级" },
  { feature: "VerifyLearner自评", status: "done", note: "四维打分+记忆生成" },
  { feature: "用户反馈即时记忆", status: "done", note: "点赞/点踩→employeeMemories" },
  { feature: "学习引擎聚合", status: "done", note: "日频/事件触发" },
  { feature: "7层提示词动态组装", status: "done", note: "Assembly时自动构建" },
  { feature: "技能需求自动发现", status: "planned", note: "AI发现能力缺口" },
];

// Knowledge pipeline steps
export interface PipelineStep {
  icon: string; // lucide icon name
  title: string;
  detail: string;
}

export const KNOWLEDGE_PIPELINE: PipelineStep[] = [
  { icon: "FileText", title: "三通道入库", detail: "手动/上传/URL抓取" },
  { icon: "Scissors", title: "智能分块", detail: "500-800字/块 50字重叠" },
  { icon: "Cpu", title: "向量化", detail: "Jina 1024维 批量100" },
  { icon: "Link", title: "员工绑定", detail: "多对多 权限隔离" },
  { icon: "Search", title: "执行时检索", detail: "余弦相似度 Top-K" },
];

// DAG example tasks
export interface DagTask {
  id: number;
  title: string;
  employee: string;
  employeeColor: string;
  skill: string;
  dependsOn: number[];
}

export const DAG_TASKS: DagTask[] = [
  { id: 1, title: "搜索热点话题", employee: "小雷", employeeColor: "#ef4444", skill: "全网搜索+热度分析", dependsOn: [] },
  { id: 2, title: "规划选题方案", employee: "小策", employeeColor: "#f59e0b", skill: "选题策划+角度设计", dependsOn: [1] },
  { id: 3, title: "撰写主体稿件", employee: "小文", employeeColor: "#6366f1", skill: "内容生成", dependsOn: [2] },
  { id: 4, title: "适配微信公众号", employee: "小发", employeeColor: "#10b981", skill: "多平台适配", dependsOn: [3] },
  { id: 5, title: "适配抖音脚本", employee: "小发", employeeColor: "#10b981", skill: "多平台适配", dependsOn: [3] },
  { id: 6, title: "适配微博短文", employee: "小发", employeeColor: "#10b981", skill: "多平台适配", dependsOn: [3] },
];

// Glossary
export interface GlossaryItem {
  term: string;
  definition: string;
}

export const GLOSSARY: GlossaryItem[] = [
  { term: "Agent Assembly", definition: "智能体组装——每次执行前，动态组装员工的技能、知识、记忆、工具为完整的 Agent" },
  { term: "DAG", definition: "有向无环图——工作流任务的依赖关系结构，决定执行顺序" },
  { term: "RAG", definition: "检索增强生成——执行时检索知识库相关片段注入 LLM 上下文" },
  { term: "Mission", definition: "任务实例——工作流模板实例化后的具体执行单元" },
  { term: "VerifyLearner", definition: "自我验证学习器——AI 对自身输出进行质量评估的模块" },
  { term: "learnedPatterns", definition: "学习模式——员工从历史反馈中提取的行为模式（JSONB 存储）" },
  { term: "7层提示词", definition: "身份→技能→权限→知识→风格→记忆→输出，分层构建的系统 Prompt" },
];
