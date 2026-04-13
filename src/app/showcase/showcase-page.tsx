"use client";

import { useEffect, useRef, useState } from "react";
import TocSidebar from "./components/toc-sidebar";
import { ThemeToggleButton } from "./components/theme-toggle-button";
import { SectionWrapper } from "./components/section-wrapper";
import { ChapterHeader } from "./components/chapter-header";
import { GlossaryTable } from "./components/glossary-table";
import { TOC_ITEMS } from "./data/showcase-content";

import { FourLayerArch } from "./diagrams/four-layer-arch";
import { ModuleRelationship } from "./diagrams/module-relationship";
import { SkillComparisonCards } from "./diagrams/skill-comparison-cards";
import { KnowledgePipeline } from "./diagrams/knowledge-pipeline";
import { CognitiveLoop } from "./diagrams/cognitive-loop";
import { DagExample } from "./diagrams/dag-example";
import { SevenLayerPrompt } from "./diagrams/seven-layer-prompt";
import { VerifyFlow } from "./diagrams/verify-flow";
import { TechStackCards } from "./diagrams/tech-stack-cards";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-lg font-semibold text-foreground mb-3">{children}</h3>
  );
}

export { ShowcasePage };
export default function ShowcasePage() {
  const [activeSection, setActiveSection] = useState("overview");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = TOC_ITEMS.map((item) => item.id);

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        observerRef.current.observe(el);
      }
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Theme toggle - fixed top right */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggleButton />
      </div>

      {/* Sidebar */}
      <TocSidebar activeSection={activeSection} />

      {/* Main content area */}
      <main className="lg:pl-[260px]">
        <div className="max-w-4xl mx-auto px-6 md:px-10 py-8">
          {/* ========== Overview ========== */}
          <SectionWrapper id="overview">
            <div className="pt-12 pb-8">
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight bg-gradient-to-r from-primary to-cyan-500 bg-clip-text text-transparent">
                Vibe Media 智媒体 · 技术架构方案
              </h1>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
                多智能体协同内容生产引擎的架构设计、核心机制与设计哲学
              </p>
            </div>
          </SectionWrapper>

          {/* ========== Chapter 1: 系统分层架构 ========== */}
          <SectionWrapper id="ch1">
            <ChapterHeader
              number="CHAPTER 01"
              title="系统分层架构"
              subtitle="四层架构设计，从底层基础设施到上层业务应用，每一层各司其职，通过明确的接口解耦。"
            />
          </SectionWrapper>

          <SectionWrapper id="ch1-overview">
            <SectionHeading>架构总览</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              系统采用<strong className="text-foreground">四层架构</strong>，从底向上分别是：基础设施层、能力基座层、智能体层、业务应用层。每一层只依赖下层提供的接口，上层变化不影响下层稳定性。这种分层确保了系统在快速迭代中保持核心稳定——替换底层 LLM 提供商不影响上层业务，新增业务功能不触动智能体核心。
            </p>
            <FourLayerArch />
          </SectionWrapper>

          <SectionWrapper id="ch1-layers">
            <SectionHeading>各层职责与层间关系</SectionHeading>
            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">基础设施层</strong>
                ：提供数据库存储（Supabase PostgreSQL）、大语言模型调用（DeepSeek/OpenAI 兼容接口）、向量嵌入计算（Jina Embeddings）、后台任务调度（Inngest）等基础能力。组件可替换，上层无感知。
              </p>
              <p>
                <strong className="text-foreground">能力基座层</strong>
                ：系统的「零件库」。技能（28+ 预定义）、知识库（RAG 管线）、记忆（经验沉淀）、工具（搜索/读取/分析）都是独立的、可组合的原子能力，被上层智能体按需调用。
              </p>
              <p>
                <strong className="text-foreground">智能体层</strong>
                ：系统核心。包含 8 位 AI 员工（垂类深度智能体）和工作流引擎（灵活编排），以及统一的对话中心作为人机交互入口。意图识别引擎在此层自动路由用户请求。
              </p>
              <p>
                <strong className="text-foreground">业务应用层</strong>
                ：面向用户的具体功能页面——灵感池、稿件管理、智能媒资、数据看板等 34 个路由组。不直接调用 LLM，而是通过智能体层间接驱动所有 AI 能力。
              </p>
            </div>
            <div className="my-4 rounded-xl bg-primary/5 border border-primary/10 px-5 py-4 text-sm leading-relaxed">
              🔑 <strong className="text-foreground">核心设计原则</strong>：上层应用不直接调用 LLM，而是通过智能中枢层间接驱动。AI 员工是最小执行单元，工作流是编排单元。
            </div>
          </SectionWrapper>

          <SectionWrapper id="ch1-relations">
            <SectionHeading>核心模块关系图</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              对话中心、意图识别引擎、AI 员工、工作流引擎、Agent Assembly 以及能力基座层各模块之间的调用关系。箭头方向表示调用或数据流向。
            </p>
            <ModuleRelationship />
          </SectionWrapper>

          {/* ========== Chapter 2: 核心设计哲学 ========== */}
          <SectionWrapper id="ch2">
            <ChapterHeader
              number="CHAPTER 02"
              title="核心设计哲学"
              subtitle="为什么要拆分出「技能」「AI员工」「工作流」三个独立概念？"
            />
          </SectionWrapper>

          <SectionWrapper id="ch2-skills">
            <SectionHeading>为什么需要「技能」这个抽象层？</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              如果没有「技能」，系统会面临三个问题：
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground mb-4">
              <li><strong className="text-foreground">能力复用</strong>——同一种写稿能力被硬编码在每个员工里，修改一处需改多处</li>
              <li><strong className="text-foreground">能力量化</strong>——无法衡量员工对某项任务的熟练程度，分配只能靠静态规则</li>
              <li><strong className="text-foreground">能力扩展</strong>——新增一个能力需要改动员工定义，而非简单挂载</li>
            </ul>
            <div className="my-4 rounded-xl bg-primary/5 border border-primary/10 px-5 py-4 text-sm leading-relaxed">
              🔑 <strong className="text-foreground">技能 = 能力的原子单元</strong>。每个技能包含名称、执行指南（guideline）、工具绑定、权限等级。通过多对多绑定挂载到员工，可量化熟练度（0-100 分，三档行为指导）。
            </div>
            <p className="text-muted-foreground leading-relaxed text-sm">
              熟练度评分规则：≥80 为精通（Prompt 鼓励创新）、40-79 为胜任（Prompt 侧重标准流程）、&lt;40 为新手（Prompt 强调基础规范与保守策略）。每次执行后根据质量评分自动微调。
            </p>
          </SectionWrapper>

          <SectionWrapper id="ch2-compare">
            <SectionHeading>AI 员工 vs 工作流：两种智能体形态</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              AI 员工和工作流不是对立关系，而是互补协作。AI 员工是<strong className="text-foreground">垂类深度智能体</strong>——拥有固定身份、技能组合和长期记忆；工作流是<strong className="text-foreground">灵活编排引擎</strong>——用户自定义步骤，按需组合不同员工的能力。
            </p>
            <SkillComparisonCards />
          </SectionWrapper>

          {/* ========== Chapter 3: 知识库体系 ========== */}
          <SectionWrapper id="ch3">
            <ChapterHeader
              number="CHAPTER 03"
              title="知识库体系"
              subtitle="让通用大模型具备领域专业度。"
            />
          </SectionWrapper>

          <SectionWrapper id="ch3-why">
            <SectionHeading>为什么需要知识库？</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              通用大模型存在三个固有限制，知识库正是为了弥补这些缺口：
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground mb-4">
              <li><strong className="text-foreground">知识截止</strong>——训练数据有截止日期，无法获知最新行业动态</li>
              <li><strong className="text-foreground">领域深度不足</strong>——通用模型对垂直领域（如媒体运营规范、频道调性）理解浅薄</li>
              <li><strong className="text-foreground">Prompt 长度受限</strong>——不可能将所有背景知识塞入上下文窗口</li>
            </ul>
            <div className="my-4 rounded-xl bg-primary/5 border border-primary/10 px-5 py-4 text-sm leading-relaxed">
              🔑 <strong className="text-foreground">RAG（检索增强生成）</strong>方案：将领域文档切块 → 向量化存储 → 执行时按语义相似度检索 → 注入上下文。模型既有通用推理能力，又能引用最新、最相关的领域知识。
            </div>
          </SectionWrapper>

          <SectionWrapper id="ch3-pipeline">
            <SectionHeading>知识入库 → 向量化 → 检索 全链路</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              支持三种入库方式：手动粘贴、文件上传（.md/.txt）、URL 抓取（Jina Reader）。入库后经过智能分块（500-800 字/块，50 字重叠）、Jina Embeddings v3 向量化（1024 维），异步由 Inngest 调度完成。
            </p>
            <KnowledgePipeline />
          </SectionWrapper>

          <SectionWrapper id="ch3-binding">
            <SectionHeading>员工 × 知识库绑定机制</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              知识库与员工通过<strong className="text-foreground">多对多绑定</strong>关联。一个员工可绑定多个知识库（如小文同时绑定「写作规范库」和「行业资讯库」），一个知识库也可被多名员工共享。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              执行时，Agent Assembly 自动检查员工已绑定且 <code className="text-primary text-sm">vectorization_status = done</code> 的知识库，注入 <code className="text-primary text-sm">kb_search</code> 工具。AI 员工在需要时自主调用该工具进行语义检索。
            </p>
            <div className="my-4 rounded-xl bg-primary/5 border border-primary/10 px-5 py-4 text-sm leading-relaxed">
              🔑 <strong className="text-foreground">检索时机由 AI 自主决定</strong>，而非硬编码。只在需要领域知识时才检索，避免无效检索干扰推理。
            </div>
          </SectionWrapper>

          {/* ========== Chapter 4: 认知进化闭环 ========== */}
          <SectionWrapper id="ch4">
            <ChapterHeader
              number="CHAPTER 04"
              title="认知进化闭环"
              subtitle="系统最核心的设计——让 AI 员工不是静态的 Prompt 机器人，而是能持续进化的智能体。"
            />
          </SectionWrapper>

          <SectionWrapper id="ch4-overview">
            <SectionHeading>闭环总览</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              认知进化闭环是系统的核心竞争力。每一次任务执行都会产生经验数据，经过自评、反馈、记忆沉淀和模式学习，转化为下一次执行时的能力提升。
            </p>
            <div className="my-4 rounded-xl bg-accent/5 border border-accent/10 px-5 py-4 text-sm">
              📌 <strong className="text-foreground">贯穿示例场景</strong>：用户需求「今天AI+教育话题很火，帮我规划选题方案，生成微信、抖音、微博三平台稿件」——以此贯穿后续各环节。
            </div>
            <CognitiveLoop />
          </SectionWrapper>

          <SectionWrapper id="ch4-intent">
            <SectionHeading>① 意图理解：自然语言到精准路由</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              用户在对话中心的自然语言输入，经过意图识别引擎三步处理：<strong className="text-foreground">构建分析上下文</strong>（收集员工列表+技能描述+历史对话）→ <strong className="text-foreground">LLM 结构化分析</strong>（识别意图类型、匹配最佳员工和技能）→ <strong className="text-foreground">校验与兜底</strong>（验证员工/技能存在性，无匹配时走通用对话）。
            </p>
            <div className="my-4 rounded-xl bg-accent/5 border border-accent/10 px-5 py-4 text-sm">
              📌 <strong className="text-foreground">场景</strong>：用户输入被识别为 <code className="text-primary">multi_step_task</code> 意图类型，路由到工作流引擎，而非单一员工处理。
            </div>
          </SectionWrapper>

          <SectionWrapper id="ch4-skill">
            <SectionHeading>② 技能的学习与发现</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">熟练度自动更新</strong>：每次执行后根据质量评分微调技能熟练度（±1~5 分），高质量输出提升、低质量输出下降。<strong className="text-foreground">执行模式积累</strong>：成功经验沉淀为记忆，影响后续同类任务的 Prompt 构建。
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4 text-sm">
              未来规划：技能发现机制——当 AI 员工在执行中展现出未注册的能力模式时，系统自动建议创建新技能。
            </p>
            <div className="my-4 rounded-xl bg-accent/5 border border-accent/10 px-5 py-4 text-sm">
              📌 <strong className="text-foreground">场景</strong>：Leader 根据技能匹配度分配任务——小雷（热搜监控 95 分）负责搜索、小策（选题策划 88 分）负责策划、小文（长文写作 92 分）负责写稿、小发（渠道分发 90 分）负责三平台适配。
            </div>
          </SectionWrapper>

          <SectionWrapper id="ch4-dag">
            <SectionHeading>③ 动态流程创建：从意图到 DAG 任务图</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              复杂任务被自动拆解为 <strong className="text-foreground">DAG（有向无环图）</strong>任务图。每个节点是一个原子任务，边表示依赖关系。无依赖的节点可并行执行，调度器自动处理依赖解析、失败重试和超时保护。
            </p>
            <DagExample />
            <div className="my-4 rounded-xl bg-accent/5 border border-accent/10 px-5 py-4 text-sm">
              📌 <strong className="text-foreground">场景</strong>：6 个任务构成的 DAG——热点搜索 → 选题策划 → 写稿 → 微信适配/抖音适配/微博适配。前 3 个串行，后 3 个并行执行，总耗时大幅缩短。
            </div>
          </SectionWrapper>

          <SectionWrapper id="ch4-exec">
            <SectionHeading>④ 智能执行：Agent Assembly 与 7 层提示词</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              每次执行前，<strong className="text-foreground">Agent Assembly 引擎</strong>动态组装执行上下文。流程：加载员工档案 → 提取技能集合与熟练度 → 检索已绑定知识库 → 拉取近 10 条相关记忆 → 计算工具权限 → 构建 7 层系统提示词。
            </p>
            <SevenLayerPrompt />
            <div className="my-4 rounded-xl bg-accent/5 border border-accent/10 px-5 py-4 text-sm">
              📌 <strong className="text-foreground">场景</strong>：小文执行「写稿」任务时，7 层 Prompt 包含——身份（资深内容创作者）、技能（长文写作 92 分-精通档）、权限（可调用搜索和读取工具）、知识库（写作规范+行业资讯）、工作风格（专业严谨）、记忆（上次教育选题获高分经验）、输出要求+自评标准。
            </div>
          </SectionWrapper>

          <SectionWrapper id="ch4-verify">
            <SectionHeading>⑤ 结果验证：双通道质量保障</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              LLM 执行完成后进入<strong className="text-foreground">双通道验证</strong>：AI 自评（四维打分：准确性、完整性、可用性、创新性，各 0-100）+ 用户反馈（点赞/点踩/文字评价）。两个通道的信号合并后沉淀为执行记忆。
            </p>
            <VerifyFlow />
            <div className="my-4 rounded-xl bg-accent/5 border border-accent/10 px-5 py-4 text-sm">
              📌 <strong className="text-foreground">场景</strong>：小文的稿件获得 AI 自评 87 分。用户审阅后——微信稿 👍（结构清晰）、微博稿 👎（太长，不适合微博调性）。两种反馈均记录为记忆。
            </div>
          </SectionWrapper>

          <SectionWrapper id="ch4-learn">
            <SectionHeading>⑥ 学习引擎：从经验到行为优化</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              学习引擎有两条路径：<strong className="text-foreground">即时记忆</strong>——每次执行后立即沉淀关键经验（成功策略、失败教训、用户偏好）；<strong className="text-foreground">聚合学习</strong>——日频批处理，从历史记忆中提取成功/失败模式，更新技能熟练度和行为指导。
            </p>
            <div className="my-4 rounded-xl bg-accent/5 border border-accent/10 px-5 py-4 text-sm">
              📌 <strong className="text-foreground">场景</strong>：即时记忆——「用户偏好微信稿采用总分总结构」；聚合学习——发现「教育类选题平均质量 85+，小文在该领域表现稳定」，自动提升小文「教育内容写作」熟练度。
            </div>
          </SectionWrapper>

          <SectionWrapper id="ch4-flywheel">
            <SectionHeading>闭环的飞轮效应</SectionHeading>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong className="text-foreground">第一圈</strong>：员工根据基础 Prompt 执行，输出质量中等。
              <strong className="text-foreground">第二圈</strong>：记忆注入后，员工了解用户偏好，输出更贴合需求。
              <strong className="text-foreground">第三圈</strong>：聚合学习发现成功模式，技能熟练度提升，Prompt 策略自动升档。
              <strong className="text-foreground">第 N 圈</strong>：知识库持续更新、记忆不断积累、员工从「新手」成长为「专家」。
            </p>
            <div className="my-4 rounded-xl bg-primary/5 border border-primary/10 px-5 py-4 text-sm leading-relaxed">
              🔑 <strong className="text-foreground">与传统 AI 应用的根本区别</strong>：大多数 AI 应用是无状态的——每次对话从零开始。我们通过<strong className="text-foreground">知识库 + 记忆 + 学习引擎</strong>三位一体，让每个 AI 员工具备有状态的持续进化能力。系统会越用越好。
            </div>
          </SectionWrapper>

          {/* ========== Chapter 5: 技术实现要点 ========== */}
          <SectionWrapper id="ch5">
            <ChapterHeader
              number="CHAPTER 05"
              title="技术实现要点"
            />
            <p className="text-muted-foreground leading-relaxed mb-4">
              核心技术选型与实现状态一览。前端采用 Next.js 16 + React 19 + Tailwind v4，后端基于 Supabase PostgreSQL + Drizzle ORM，AI 层使用 AI SDK v6 对接 DeepSeek，后台任务由 Inngest 驱动。
            </p>
            <TechStackCards />
          </SectionWrapper>

          {/* ========== Appendix ========== */}
          <SectionWrapper id="appendix">
            <ChapterHeader
              number="APPENDIX"
              title="术语表"
            />
            <p className="text-muted-foreground leading-relaxed mb-4">
              系统中使用的核心概念和术语定义，便于快速理解架构文档中的专有名词。
            </p>
            <GlossaryTable />
          </SectionWrapper>

          {/* Bottom spacer */}
          <div className="h-32" />
        </div>
      </main>
    </div>
  );
}
