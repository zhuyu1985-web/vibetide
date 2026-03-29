# VibeTide 潮汐 · AI Multi-Agent 任务中心 — 功能架构设计文档

> **文档性质：** PRD + 技术架构设计  
> **目标受众：** 开发团队（后端 / 前端 / AI 工程）  
> **版本：** v1.0 Draft  
> **日期：** 2026-03-22

---

## 目录

- [1. 产品概述](#1-产品概述)
- [2. 系统架构总览](#2-系统架构总览)
- [3. 核心实体与数据模型](#3-核心实体与数据模型)
- [4. 五阶段生命周期状态机](#4-五阶段生命周期状态机)
- [5. 任务调度引擎](#5-任务调度引擎)
- [6. 通信协议](#6-通信协议)
- [7. 智能体实例管理](#7-智能体实例管理)
- [8. 场景模板系统](#8-场景模板系统)
- [9. 异常处理机制](#9-异常处理机制)
- [10. 用户侧交互逻辑](#10-用户侧交互逻辑)
- [11. 接口契约摘要](#11-接口契约摘要)
- [12. 非功能性要求](#12-非功能性要求)
- [附录 A：预设场景模板详表](#附录-a预设场景模板详表)
- [附录 B：术语表](#附录-b术语表)

---

## 1. 产品概述

### 1.1 产品定位

VibeTide 任务中心是平台的**多智能体协作引擎**，将 AI 能力从单一助手模式升级为团队协作模式。核心思想借鉴 Claude Code 的 Agent Team 架构：一个 Team Leader 主智能体负责统筹调度，多个子智能体（AI 员工）各自拥有独立会话上下文，在共享任务看板上自主认领、并行执行、直接通信，最终由 Team Leader 汇总交付。

### 1.2 解决的核心问题

媒体内容生产的"策采编发审"链条天然是多角色、有依赖、需要协调的。当前 AI 产品的两种模式各有瓶颈：

| 模式 | 问题 |
|------|------|
| 单一 AI 助手串行执行 | 复杂任务耗时长，无法并行，单点上下文窗口容易溢出 |
| 用户手动调度多个 AI | 门槛高，用户需要自己拆任务、分配、协调、汇总 |

本系统将调度层自动化——用户只需选择场景、输入需求，系统自动完成组队→拆解→并行执行→协调→交付的全流程。用户角色从"操作者"变为"观察者/验收者"。

### 1.3 与 Claude Code Agent Team 的架构映射

| Claude Code 概念 | VibeTide 对应 | 说明 |
|---|---|---|
| Main conversation | Mission Session | 一次任务会话，承载 Team Leader 的主上下文 |
| Team Leader | 小策（或场景指定的主控角色） | 负责组队、拆解、协调、汇总 |
| Subagent (independent context) | AI Employee Instance | 每个 AI 员工是独立的 LLM 会话实例 |
| Shared task list | Task Board | 共享任务看板，所有子任务的单一事实来源 |
| Inter-agent messaging | Message Bus | 点对点 + 广播消息系统 |
| Task completion → notify leader | Event: TASK_COMPLETED | 子任务完成事件自动上报 Team Leader |

### 1.4 设计原则

1. **Leader 驱动，Worker 自治：** Team Leader 负责全局决策（拆解、分配、协调），AI 员工在自己的任务范围内完全自主。
2. **去中心化通信：** 子智能体之间直接通信，不必经过 Team Leader 中转，减少瓶颈。
3. **共享看板为单一事实来源：** 所有任务状态变更必须通过 Task Board，确保全局一致性。
4. **失败隔离：** 单个子智能体的失败不应导致整个任务崩溃，Team Leader 有能力重新分配。
5. **资源有界：** 每次任务会话消耗的智能体实例数量有上限，完成后必须释放。

---

## 2. 系统架构总览

### 2.1 架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│                     用户交互层 (Presentation)                    │
│        任务列表页  ←→  任务详情页（实时协作工作台）                │
├─────────────────────────────────────────────────────────────────┤
│                     业务编排层 (Orchestration)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Mission      │  │ Lifecycle    │  │ Scenario Template      │ │
│  │ Manager      │  │ State Machine│  │ Engine                 │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                     调度与通信层 (Core Engine)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Task         │  │ Message      │  │ Agent Instance         │ │
│  │ Scheduler    │  │ Bus          │  │ Pool                   │ │
│  │ (DAG Engine) │  │ (Router)     │  │ (Lifecycle Manager)    │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                     智能体运行层 (Agent Runtime)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 小策     │ │ 小雷     │ │ 小资     │ │ 小文     │ ...      │
│  │ (Leader) │ │ (Worker) │ │ (Worker) │ │ (Worker) │          │
│  │ Session  │ │ Session  │ │ Session  │ │ Session  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
├─────────────────────────────────────────────────────────────────┤
│                     基础设施层 (Infrastructure)                   │
│        LLM API Gateway  |  状态存储  |  事件队列  |  文件存储    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心模块职责

| 模块 | 职责 | 关键能力 |
|------|------|----------|
| **Mission Manager** | 任务会话的全生命周期管理 | 创建/暂停/恢复/终止 Mission |
| **Lifecycle State Machine** | 五阶段状态流转的严格控制 | 阶段转换条件校验、超时监控 |
| **Scenario Template Engine** | 场景模板的解析与实例化 | 模板→团队组合→任务 DAG 的映射 |
| **Task Scheduler** | 子任务的 DAG 解析与调度 | 依赖解析、并行度计算、动态重分配 |
| **Message Bus** | 智能体间的消息路由 | 点对点、广播、系统通知三种模式 |
| **Agent Instance Pool** | 智能体实例的创建/复用/销毁 | 实例池管理、上下文初始化、资源回收 |

### 2.3 数据流概览

```
用户选择场景 → Mission Manager 创建会话
                    ↓
        Scenario Template Engine 解析模板
                    ↓
        Agent Instance Pool 创建 Leader + Workers
                    ↓
        Leader 执行任务拆解 → 写入 Task Board
                    ↓
        Task Scheduler 计算 DAG → 释放无依赖任务
                    ↓
        Workers 认领任务 → 独立执行 → 通过 Message Bus 协作
                    ↓
        任务完成 → Event 通知 Leader → Leader 检查全局
                    ↓
        全部完成 → Leader 汇总 → 产出物交付 → 释放资源
```

---

## 3. 核心实体与数据模型

### 3.1 Mission（任务会话）

Mission 是系统的顶层实体，代表一次完整的多智能体协作过程。

```typescript
interface Mission {
  id: string;                    // 唯一标识 e.g. "mission-20260322-001"
  title: string;                 // 任务名称 e.g. "新能源汽车2026 Q1市场格局深度分析"
  description: string;           // 用户输入的需求描述
  scenario_id: string;           // 关联的场景模板 ID
  status: MissionStatus;         // 当前状态（见 3.1.1）
  phase: MissionPhase;           // 当前生命周期阶段（见第4章）
  
  // 团队
  team_id: string;               // 关联的 Team 实例
  leader_agent_id: string;       // Team Leader 的 Agent 实例 ID
  
  // 时间线
  created_at: timestamp;
  started_at: timestamp | null;  // Phase 1 开始时间
  completed_at: timestamp | null;
  estimated_duration: number;    // 预计耗时（秒）
  
  // 进度
  progress: number;              // 0-100 综合进度百分比
  
  // 产出物
  artifacts: Artifact[];         // 最终交付物列表
  
  // 配置
  config: {
    max_retries: number;         // 子任务最大重试次数，默认 3
    task_timeout: number;        // 单个子任务超时时间（秒），默认 300
    max_agents: number;          // 最大智能体数量，默认 8
  };
}

enum MissionStatus {
  QUEUED      = "queued",        // 排队等待资源
  RUNNING     = "running",       // 执行中
  PAUSED      = "paused",       // 暂停（用户触发或系统触发）
  COMPLETED   = "completed",     // 成功完成
  FAILED      = "failed",       // 失败终止
  CANCELLED   = "cancelled"      // 用户取消
}

enum MissionPhase {
  ASSEMBLING  = "assembling",    // Phase 1: 组队
  DECOMPOSING = "decomposing",   // Phase 2: 拆解
  EXECUTING   = "executing",     // Phase 3: 并行执行
  COORDINATING= "coordinating",  // Phase 4: 协调收口
  DELIVERING  = "delivering"     // Phase 5: 汇总交付
}
```

### 3.2 Team（团队）

```typescript
interface Team {
  id: string;
  mission_id: string;            // 所属 Mission
  members: TeamMember[];         // 成员列表
  created_at: timestamp;
  dissolved_at: timestamp | null;// 团队解散时间
}

interface TeamMember {
  agent_instance_id: string;     // Agent 运行实例 ID
  role_id: string;               // 角色模板 ID（如 "xiaolei"）
  team_role: "leader" | "worker";
  joined_at: timestamp;
  status: AgentStatus;           // 当前状态
}

enum AgentStatus {
  INITIALIZING = "initializing", // 正在创建实例 / 加载上下文
  IDLE         = "idle",         // 空闲待命
  WORKING      = "working",     // 正在执行任务
  WAITING      = "waiting",     // 等待上游依赖
  COORDINATING = "coordinating",// 仅 Leader: 正在统筹协调
  ERROR        = "error",       // 执行出错
  TERMINATED   = "terminated"    // 已销毁
}
```

### 3.3 AgentRole（智能体角色模板）

角色模板是静态配置，定义每个 AI 员工的身份和能力。

```typescript
interface AgentRole {
  id: string;                    // e.g. "xiaolei"
  name: string;                  // e.g. "小雷"
  title: string;                 // e.g. "线索猎手"
  emoji: string;                 // e.g. "⚡"
  color: string;                 // e.g. "#00D4FF"
  
  // LLM 配置
  system_prompt: string;         // 角色专属的系统提示词
  model: string;                 // 推荐使用的模型 e.g. "claude-sonnet-4"
  temperature: number;           // 推荐温度
  max_context_tokens: number;    // 上下文窗口限制
  
  // 能力声明
  capabilities: string[];        // e.g. ["web_search", "data_analysis", "content_writing"]
  tools: ToolDefinition[];       // 该角色可调用的工具列表
  
  // 约束
  can_be_leader: boolean;        // 是否可以担任 Team Leader
  max_concurrent_tasks: number;  // 最大并发任务数，默认 1
}
```

**预设角色清单：**

| ID | 名称 | 角色 | 核心能力 | 可任 Leader | 专属色 |
|---|---|---|---|---|---|
| xiaece | 小策 | 策划总控 | 任务拆解、全局协调、质量把控 | ✓ | #FF6B35 |
| xiaolei | 小雷 | 线索猎手 | 全网信息采集、数据源发现、素材整理 | ✗ | #00D4FF |
| xiaozi | 小资 | 数据分析师 | 数据处理、趋势分析、图表生成 | ✗ | #A855F7 |
| xiaowen | 小文 | 内容创作者 | 文案撰写、稿件组织、风格把控 | ✗ | #10B981 |
| xiaojian | 小剪 | 视频剪辑师 | 脚本拆解、镜头规划、字幕生成 | ✗ | #6366F1 |
| xiaoshen | 小审 | 质量审核 | 内容审校、合规检查、修改建议 | ✗ | #F59E0B |
| xiaofa | 小发 | 分发运营 | 多渠道适配、标题优化、发布策略 | ✗ | #EC4899 |
| xiaoshu | 小数 | 数据监测 | 舆情监控、传播分析、效果追踪 | ✗ | #14B8A6 |
| guwen | 频道顾问 | 策略咨询 | 行业洞察、策略建议、竞品分析 | ✓ | #8B5CF6 |

### 3.4 AgentInstance（智能体运行实例）

每个 AgentInstance 是一个独立的 LLM 会话，拥有自己的上下文窗口。

```typescript
interface AgentInstance {
  id: string;                    // 运行实例 ID
  role_id: string;               // 对应的角色模板
  mission_id: string;            // 所属任务
  
  // 会话状态
  session: {
    system_prompt: string;       // 角色 prompt + 任务上下文注入
    messages: Message[];         // 会话历史（该实例的完整对话记录）
    context_tokens_used: number; // 当前已消耗的 token 数
  };
  
  // 任务绑定
  current_task_id: string | null;// 当前正在执行的子任务
  completed_tasks: string[];     // 已完成的子任务 ID 列表
  
  // 元数据
  created_at: timestamp;
  last_active_at: timestamp;
  total_api_calls: number;
  total_tokens_consumed: number;
}
```

**上下文初始化策略：**

每个 AgentInstance 创建时，其 system_prompt 由以下部分拼接而成：

```
1. 角色基础人设 ← 来自 AgentRole.system_prompt
2. 任务背景注入 ← Mission 的 title + description + 用户需求
3. 团队信息注入 ← 当前团队成员清单、各自角色、通信方式
4. 工作协议注入 ← 任务完成后如何汇报、消息格式约定、工具使用规范
5. （仅 Leader）全局调度指令 ← 拆解规范、协调策略、异常处理流程
```

### 3.5 Task（子任务）

```typescript
interface Task {
  id: string;                    // e.g. "task-001"
  mission_id: string;
  
  // 基本信息
  title: string;                 // e.g. "全网素材搜集与整理"
  description: string;           // 详细任务描述，由 Leader 生成
  acceptance_criteria: string;   // 验收标准，由 Leader 定义
  
  // 分配
  assigned_agent_id: string | null; // 负责的智能体实例 ID
  assigned_role_id: string;      // 期望的角色类型（即使未分配也要指定）
  phase: number;                 // 所属阶段（1-5）
  priority: TaskPriority;        // 优先级
  
  // 状态
  status: TaskStatus;
  progress: number;              // 0-100
  
  // 依赖关系
  depends_on: string[];          // 上游依赖的 task ID 列表
  blocks: string[];              // 被本任务阻塞的下游 task ID 列表（自动计算）
  
  // 时间
  created_at: timestamp;
  started_at: timestamp | null;
  completed_at: timestamp | null;
  deadline: timestamp | null;    // 超时截止时间
  retry_count: number;           // 已重试次数
  
  // 产出
  artifacts: Artifact[];         // 本任务的产出物
  output_summary: string | null; // Leader 可读的完成摘要
  
  // 错误信息
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  } | null;
}

enum TaskStatus {
  PENDING     = "pending",       // 已创建，等待依赖解锁
  READY       = "ready",        // 依赖已满足，可以被认领
  CLAIMED     = "claimed",      // 已被某个 Agent 认领
  IN_PROGRESS = "in_progress",  // 执行中
  IN_REVIEW   = "in_review",    // 执行完成，等待 Leader 审核（可选）
  COMPLETED   = "completed",    // 完成
  FAILED      = "failed",       // 失败
  CANCELLED   = "cancelled",    // 取消
  BLOCKED     = "blocked"       // 被依赖死锁或上游失败阻塞
}

enum TaskPriority {
  CRITICAL = "P0",               // 阻塞性任务
  HIGH     = "P1",               // 高优先级
  NORMAL   = "P2",               // 常规
  LOW      = "P3"                // 低优先级 / 可选增强
}
```

**任务状态流转图：**

```
                    ┌─────────────────────────────────┐
                    │            PENDING               │
                    │   (等待上游依赖完成)               │
                    └──────────┬──────────────────────┘
                               │ 所有 depends_on 的任务状态 == COMPLETED
                               ▼
                    ┌─────────────────────────────────┐
                    │             READY                │
                    │   (可被认领)                      │
                    └──────────┬──────────────────────┘
                               │ Agent 发起认领请求
                               ▼
                    ┌─────────────────────────────────┐
                    │            CLAIMED               │
                    │   (已锁定给某 Agent)              │
                    └──────────┬──────────────────────┘
                               │ Agent 开始执行
                               ▼
                    ┌─────────────────────────────────┐
          ┌─────── │          IN_PROGRESS              │ ──────────┐
          │        │   (执行中，进度 0-100)             │           │
          │        └──────────┬──────────────────────┘           │
          │ 失败               │ 执行完成                         │ 超时
          ▼                   ▼                                  ▼
  ┌──────────────┐  ┌────────────────┐                  ┌──────────────┐
  │   FAILED     │  │  IN_REVIEW     │ (可选)           │   FAILED     │
  │              │  │  (Leader审核)   │                  │  (timeout)   │
  └──────┬───────┘  └───────┬────────┘                  └──────┬───────┘
         │                  │ 审核通过                          │
         │                  ▼                                  │
         │        ┌────────────────┐                           │
         │        │  COMPLETED     │                           │
         │        └────────────────┘                           │
         │                                                     │
         └──────────────────┬──────────────────────────────────┘
                            │ retry_count < max_retries?
                            ├── 是 → 重置为 READY，retry_count++
                            └── 否 → 保持 FAILED，通知 Leader 人工介入
```

### 3.6 Message（消息）

```typescript
interface AgentMessage {
  id: string;
  mission_id: string;
  
  // 路由
  from_agent_id: string;         // 发送者 Agent Instance ID
  to_agent_id: string | null;    // 接收者 ID（null 表示广播）
  channel: MessageChannel;
  
  // 内容
  type: MessageType;
  content: {
    text: string;                // 自然语言内容
    structured_data?: any;       // 结构化数据附件（JSON）
    attachments?: Artifact[];    // 文件/数据附件
  };
  
  // 元数据
  priority: "normal" | "urgent"; // urgent 会冒泡到用户界面
  timestamp: timestamp;
  read_by: string[];             // 已读的 Agent ID 列表
  
  // 关联
  reply_to: string | null;       // 回复的消息 ID
  task_id: string | null;        // 关联的子任务（如果有）
}

enum MessageChannel {
  DIRECT     = "direct",         // 点对点
  BROADCAST  = "broadcast",      // 广播给全体
  LEADER     = "leader",        // 专门发给 Leader 的汇报通道
  SYSTEM     = "system"          // 系统消息（状态变更通知等）
}

enum MessageType {
  // 对话类
  CHAT           = "chat",           // 普通对话
  QUESTION       = "question",       // 提问（期望回复）
  ANSWER         = "answer",         // 回答
  
  // 协作类
  DATA_HANDOFF   = "data_handoff",   // 数据交接（含 structured_data）
  REVIEW_REQUEST = "review_request", // 请求审核
  REVIEW_RESULT  = "review_result",  // 审核结果
  
  // 汇报类
  PROGRESS_UPDATE= "progress_update",// 进度更新
  TASK_COMPLETED = "task_completed", // 任务完成通知
  TASK_FAILED    = "task_failed",    // 任务失败通知
  HELP_REQUEST   = "help_request",   // 请求 Leader 协助
  
  // 系统类
  AGENT_JOINED   = "agent_joined",   // 新成员加入
  AGENT_LEFT     = "agent_left",     // 成员离开
  MISSION_UPDATE = "mission_update"  // 全局任务状态更新
}
```

### 3.7 Artifact（产出物）

```typescript
interface Artifact {
  id: string;
  mission_id: string;
  task_id: string | null;        // 由哪个子任务产出（null = 汇总产出）
  produced_by: string;           // 产出的 Agent Instance ID
  
  type: ArtifactType;
  title: string;
  content: string | null;        // 文本内容
  file_url: string | null;       // 文件存储路径
  metadata: Record<string, any>; // 额外元数据
  
  created_at: timestamp;
  version: number;               // 版本号（审核修改后递增）
}

enum ArtifactType {
  TEXT         = "text",          // 文本稿件
  DATA_TABLE   = "data_table",   // 数据表格
  CHART        = "chart",        // 图表
  IMAGE        = "image",        // 图片
  VIDEO_SCRIPT = "video_script", // 视频脚本
  REPORT       = "report",       // 综合报告
  PUBLISH_PLAN = "publish_plan"  // 分发计划
}
```

---

## 4. 五阶段生命周期状态机

### 4.1 状态机总览

```
QUEUED → PHASE_1 → PHASE_2 → PHASE_3 ⇄ PHASE_4 → PHASE_5 → COMPLETED
           组队       拆解     并行执行   协调收口    汇总交付

  任何阶段均可进入：PAUSED / FAILED / CANCELLED
```

注意：Phase 3 和 Phase 4 之间是**双向循环**关系——执行过程中随时可能触发协调，协调完成后继续执行。

### 4.2 Phase 1：组队 (ASSEMBLING)

**触发条件：** Mission 状态从 QUEUED → RUNNING

**内部逻辑：**

```
1. Scenario Template Engine 根据 scenario_id 查找模板
2. 解析模板中的 required_roles 列表
3. Agent Instance Pool 为每个 role 创建实例：
   a. 创建 Leader 实例（优先，因为后续步骤依赖 Leader）
   b. 并行创建所有 Worker 实例
   c. 每个实例执行上下文初始化（注入 system_prompt + 任务背景）
4. 组装 Team 实体，将所有成员注册到 Team
5. Leader 接收初始化指令，进入就绪状态
```

**退出条件：**
- ✅ 所有必需角色的 Agent 实例创建成功且状态为 IDLE → 进入 Phase 2
- ❌ 任意必需角色创建失败且重试耗尽 → Mission 进入 FAILED

**超时设置：** 30 秒（智能体实例创建不应该很慢）

**发出的事件：**
- `AGENT_JOINED`（每个成员创建成功时广播）
- `TEAM_ASSEMBLED`（全部就绪时通知 Leader）

### 4.3 Phase 2：拆解 (DECOMPOSING)

**触发条件：** Phase 1 完成，Team 已就绪

**内部逻辑：**

```
1. 向 Leader 发送拆解指令：
   - 输入：Mission 的 title + description + 场景模板的参考任务结构
   - 要求 Leader 输出：子任务列表 + 每个子任务的描述、验收标准、
     所需角色、依赖关系、优先级、预估耗时
   - 输出格式：结构化 JSON

2. 解析 Leader 的拆解结果：
   a. 校验每个子任务的 assigned_role 是否在团队中存在
   b. 校验依赖关系是否形成 DAG（无环检测）
   c. 计算关键路径和预估总耗时

3. 将子任务写入 Task Board：
   - 有依赖的任务状态设为 PENDING
   - 无依赖的任务状态设为 READY

4. 通知所有 Worker 任务板已就绪
```

**Leader 拆解输出格式：**

```json
{
  "tasks": [
    {
      "title": "全网素材搜集与整理",
      "description": "在主流媒体、行业报告网站、政策发布平台搜集...",
      "acceptance_criteria": "至少覆盖30篇行业报告、100条相关新闻",
      "assigned_role": "xiaolei",
      "depends_on": [],
      "priority": "P1",
      "estimated_minutes": 3
    },
    {
      "title": "深度报道稿件撰写",
      "description": "基于素材和数据分析结果，撰写3000字深度报道...",
      "acceptance_criteria": "结构完整、论点清晰、数据引用准确",
      "assigned_role": "xiaowen",
      "depends_on": ["全网素材搜集与整理", "行业数据深度分析"],
      "priority": "P1",
      "estimated_minutes": 5
    }
  ]
}
```

**退出条件：**
- ✅ 子任务列表通过校验且写入 Task Board → 进入 Phase 3
- ❌ Leader 拆解输出格式错误（重试最多 2 次）
- ❌ 依赖关系存在环路（要求 Leader 修正）

**超时设置：** 60 秒

### 4.4 Phase 3：并行执行 (EXECUTING)

**触发条件：** Phase 2 完成，Task Board 上存在 READY 状态的任务

**内部逻辑（核心调度循环）：**

```
LOOP（持续运行，直到所有任务完成或失败）:

  1. Task Scheduler 扫描 Task Board：
     - 查找所有 status == READY 的任务
     - 按 priority 排序

  2. 对每个 READY 任务执行自动分配：
     a. 查找 assigned_role 对应的 Agent Instance
     b. 检查该 Agent 当前是否空闲（status == IDLE）
     c. 如果空闲：
        - 将任务状态更新为 CLAIMED
        - 向该 Agent 发送执行指令
        - Agent 开始执行，任务状态更新为 IN_PROGRESS
     d. 如果忙碌：
        - 任务保持 READY，等待下一轮扫描

  3. 监听任务状态变更事件：
     - TASK_COMPLETED：
       a. 更新该任务状态
       b. 重新计算依赖图：解锁所有以该任务为依赖的下游任务
       c. 被解锁的任务状态从 PENDING → READY
       d. 通知 Leader（通过 LEADER channel）
       
     - TASK_FAILED：
       a. 判断是否可重试（retry_count < max_retries 且 error.recoverable）
       b. 可重试：重置为 READY，retry_count++
       c. 不可重试：保持 FAILED，触发 Phase 4 协调介入
       
     - TASK_TIMEOUT：
       a. 强制中断该 Agent 的当前执行
       b. 按 TASK_FAILED 处理

  4. Worker 间通信处理：
     - Worker 可随时通过 Message Bus 向其他 Worker 发消息
     - 消息类型为 DATA_HANDOFF 时，自动将 structured_data 注入接收方上下文
     - 消息类型为 HELP_REQUEST 时，同时抄送 Leader
```

**Worker 执行单个任务的内部流程：**

```
1. 接收任务指令（注入到该 Agent 的会话上下文）
2. Agent 自主规划执行步骤
3. 执行过程中可以：
   a. 调用自己的 tools（如 web_search、data_analysis）
   b. 向其他 Agent 发消息（请求数据、咨询意见）
   c. 更新任务进度（通过 PROGRESS_UPDATE 消息）
4. 执行完成后：
   a. 生成产出物（Artifact）
   b. 生成完成摘要（output_summary）
   c. 发送 TASK_COMPLETED 通知
   d. Agent 状态回到 IDLE
```

**退出条件：**
- ✅ Task Board 上所有任务状态为 COMPLETED → 进入 Phase 5
- ↔️ 出现需要 Leader 介入的异常 → 临时切入 Phase 4

**超时设置：** Mission 级别总超时（默认 600 秒），单任务超时（默认 300 秒）

### 4.5 Phase 4：协调收口 (COORDINATING)

Phase 4 不是一个独立的顺序阶段，而是在 Phase 3 执行过程中随时可能触发的**协调子流程**。

**触发条件（任一满足）：**

| 触发场景 | 处理逻辑 |
|----------|----------|
| 某个子任务 FAILED 且不可自动重试 | Leader 分析失败原因，决定：重新分配给其他 Agent / 修改任务描述后重试 / 标记为跳过 |
| 多个 Worker 间产生冲突或矛盾 | Leader 阅读相关消息，做出裁决并通知相关 Worker |
| 某个 Worker 发送 HELP_REQUEST | Leader 评估问题，给出指导或调整任务分配 |
| Task Board 上出现依赖死锁 | Leader 重新评估依赖关系，拆解或合并任务以解锁 |
| 进度严重滞后（某任务超过预估时间 200%） | Leader 主动介入，分析瓶颈并采取措施 |

**Leader 的协调动作清单：**

```typescript
enum CoordinationAction {
  REASSIGN_TASK,      // 将失败/滞后的任务重新分配给另一个 Agent
  MODIFY_TASK,        // 修改任务描述或验收标准后重新启动
  SKIP_TASK,          // 标记某个非关键任务为跳过
  ADD_TASK,           // 拆解出新的子任务
  MERGE_TASKS,        // 合并多个子任务
  SEND_GUIDANCE,      // 向特定 Worker 发送指导意见
  ADJUST_PRIORITY,    // 调整任务优先级
  ESCALATE_TO_USER    // 上报给用户（极端情况，系统通知冒泡）
}
```

**协调完成后：** 返回 Phase 3 继续执行。

### 4.6 Phase 5：汇总交付 (DELIVERING)

**触发条件：** Task Board 上所有非 CANCELLED/SKIPPED 的任务状态为 COMPLETED

**内部逻辑：**

```
1. Leader 收到 ALL_TASKS_COMPLETED 通知
2. Leader 收集所有子任务的 Artifact 和 output_summary
3. Leader 执行汇总：
   a. 将分散的产出物整合为最终交付物
   b. 生成整体任务总结报告
   c. 如果是文稿类任务：进行通篇统稿，确保风格一致
   d. 如果是多渠道分发：生成各渠道的适配版本
4. 将最终 Artifact 挂载到 Mission
5. 更新 Mission 状态为 COMPLETED
6. 触发资源清理流程（见第7章）
```

**退出条件：**
- ✅ Leader 汇总完成，最终 Artifact 就绪 → Mission COMPLETED
- ❌ 汇总过程失败（如 Leader 上下文溢出） → 降级处理：直接将各子任务 Artifact 打包交付

**超时设置：** 120 秒

---

## 5. 任务调度引擎

### 5.1 DAG（有向无环图）依赖模型

所有子任务的依赖关系构成一个 DAG。Task Scheduler 的核心职责是维护这个 DAG 并据此驱动任务流转。

```
示例 DAG（深度报道场景）:

    t1(选题策划)
      ↙      ↘
  t2(素材搜集)  t3(数据分析)    ← 可并行
      ↘      ↙
    t4(稿件撰写)               ← 等待 t2 + t3
        ↓
    t5(质量审核)
        ↓
    t6(多渠道分发)
```

### 5.2 依赖解析算法

```python
def resolve_dependencies(task_board):
    """
    扫描 Task Board，解锁所有依赖已满足的任务。
    在以下时机被调用：
    - Phase 2 完成后首次调用
    - 每次有任务变为 COMPLETED 时调用
    """
    for task in task_board.get_tasks(status=PENDING):
        deps = task.depends_on
        if all(task_board.get(dep_id).status == COMPLETED for dep_id in deps):
            task.status = READY
            emit_event(TASK_UNLOCKED, task.id)
```

### 5.3 并行度计算

系统在 Phase 2 完成后，根据 DAG 结构计算理论最大并行度和关键路径：

```
最大并行度 = DAG 中同一层级（无依赖关系）的任务数量最大值
关键路径 = DAG 中从入口到出口的最长路径（按预估时间加权）

示例：
  t1(2min) → t2(3min) → t4(5min) → t5(2min) → t6(1min)
            → t3(4min) ↗
  关键路径 = t1 + t3 + t4 + t5 + t6 = 14min
  最大并行度 = 2（t2 和 t3 可并行）
```

### 5.4 任务认领机制

当前版本采用**指派制**（由 Leader 在拆解阶段指定 assigned_role），而非自由竞争认领。原因是：

1. 媒体生产场景中，每个角色的专业分工明确，自由竞争意义不大
2. Leader 拥有全局视角，指派更合理
3. 减少了并发冲突

调度器按以下优先级分配 READY 任务：

```
1. 任务的 assigned_role 对应的 Agent 是否空闲？ → 是：直接分配
2. 如果该 Agent 正忙，是否有相同 capabilities 的其他空闲 Agent？ → 是：备选分配
3. 都忙？ → 保持 READY，等待下一轮调度
```

### 5.5 进度计算

Mission 的综合进度按以下公式计算：

```
mission_progress = Σ(task_progress × task_weight) / Σ(task_weight)

其中：
- task_weight 由 Task Priority 决定：P0=4, P1=3, P2=2, P3=1
- task_progress: COMPLETED=100, IN_PROGRESS=实际值, 其他=0
```

---

## 6. 通信协议

### 6.1 消息路由规则

Message Bus 接收所有消息并根据以下规则路由：

| 条件 | 路由行为 |
|------|----------|
| `to_agent_id` 非空 | 点对点：仅投递给目标 Agent |
| `to_agent_id` 为空，`channel` = BROADCAST | 投递给本 Mission 所有 Agent |
| `channel` = LEADER | 投递给 Team Leader |
| `channel` = SYSTEM | 投递给所有 Agent + 写入 Mission 事件日志 |
| `priority` = urgent | 额外：冒泡到用户界面通知 |

### 6.2 结构化数据传递

当 MessageType 为 `DATA_HANDOFF` 时，`content.structured_data` 字段携带结构化数据。接收方 Agent 的处理方式：

```
1. Message Bus 将消息投递给目标 Agent
2. 目标 Agent 的会话中注入一条特殊消息：
   "[SYSTEM] 你收到了来自 {发送者名称} 的数据交接：
   数据类型：{type}
   数据摘要：{summary}
   完整数据：{structured_data_json}"
3. 目标 Agent 的后续输出即可引用这些数据
```

支持的 structured_data 类型：

| 类型 | 说明 | 示例 |
|------|------|------|
| `data_table` | 表格数据 | 销量对比表、关键词列表 |
| `key_findings` | 关键发现 | 数据分析结论列表 |
| `outline` | 大纲结构 | 文章骨架 |
| `file_reference` | 文件引用 | 图表 URL、素材包路径 |
| `review_feedback` | 审核意见 | 逐条修改建议 |

### 6.3 消息与上下文管理

每个 Agent 的上下文窗口有限，不能无限注入消息。管理策略：

```
1. 仅与该 Agent 直接相关的消息才注入其上下文：
   - 自己发出的消息
   - 发给自己的消息
   - 广播消息
   - 系统消息
   
2. 不注入其他 Agent 之间的点对点消息

3. 当 Agent 上下文接近上限（>80% max_context_tokens）时：
   a. 对早期消息进行摘要压缩
   b. 保留最近 N 轮完整消息 + 早期摘要
```

### 6.4 关键消息冒泡机制

部分消息需要被"冒泡"到更高层级（Leader 或用户界面）：

```
Level 0 - Agent 内部：普通 CHAT 消息，仅参与者可见
Level 1 - 冒泡到 Leader：HELP_REQUEST、TASK_FAILED、TASK_COMPLETED
Level 2 - 冒泡到用户界面：priority=urgent 的消息、Mission 状态变更
Level 3 - 系统告警：资源耗尽、全局超时、不可恢复错误
```

---

## 7. 智能体实例管理

### 7.1 实例生命周期

```
    创建请求
       │
       ▼
  ┌──────────┐    初始化失败（重试3次后）
  │CREATING  │ ─────────────────────────── → 销毁
  └────┬─────┘
       │ 初始化成功
       ▼
  ┌──────────┐    收到任务指令
  │  IDLE    │ ─────────────── → WORKING
  └────┬─────┘                      │
       │                            │ 任务完成/失败
       │                            ▼
       │                      ┌──────────┐
       │               ┌──── │  IDLE    │ ←─── 循环
       │               │     └──────────┘
       │               │
       │ Mission 完成/取消
       ▼
  ┌──────────┐
  │TERMINATED│ → 资源释放
  └──────────┘
```

### 7.2 实例池策略

```typescript
interface AgentPoolConfig {
  // 全局限制
  max_total_instances: number;       // 系统级上限，默认 50
  max_instances_per_mission: number; // 单个 Mission 上限，默认 8
  
  // 资源分配
  queue_strategy: "fifo" | "priority"; // 排队策略
  
  // 超时与清理
  idle_timeout: number;              // 空闲超时自动销毁（秒），默认 60
  session_max_duration: number;      // 单实例最长存活时间（秒），默认 1800
}
```

### 7.3 资源清理流程

Mission 完成/失败/取消后的清理步骤：

```
1. 标记 Mission 状态为终态（COMPLETED / FAILED / CANCELLED）
2. 向所有 Agent 发送 TERMINATE 信号
3. 等待所有 Agent 完成当前输出（grace period: 10秒）
4. 收集所有 Agent 的最终状态和产出物
5. 销毁所有 Agent 实例，释放 LLM 会话资源
6. 更新 Team 的 dissolved_at 时间戳
7. 归档 Mission 数据到冷存储（保留消息记录和 Artifact）
8. 释放实例池配额
```

---

## 8. 场景模板系统

### 8.1 模板数据结构

```typescript
interface ScenarioTemplate {
  id: string;                    // e.g. "deep_report"
  name: string;                  // e.g. "深度报道"
  description: string;
  icon: string;                  // e.g. "📰"
  category: string;              // e.g. "内容生产"
  
  // 团队配置
  required_roles: RoleRequirement[];
  leader_role: string;           // 指定谁当 Leader
  
  // 任务参考结构
  task_template: TaskTemplate[]; // Leader 拆解时的参考模板
  
  // 约束
  estimated_duration: number;    // 预估总耗时（秒）
  max_tasks: number;             // 最大子任务数
  
  // 用户输入要求
  input_schema: {
    required_fields: string[];   // 必填字段 e.g. ["topic", "target_length"]
    optional_fields: string[];   // 可选字段 e.g. ["reference_urls", "tone"]
  };
}

interface RoleRequirement {
  role_id: string;               // e.g. "xiaolei"
  required: boolean;             // 是否必需
  count: number;                 // 该角色需要几个实例（通常为1）
}

interface TaskTemplate {
  title_pattern: string;         // e.g. "全网素材搜集与整理"
  role_id: string;               // 推荐分配给哪个角色
  phase: number;                 // 所属阶段
  depends_on_indices: number[];  // 依赖的模板序号
  description_hint: string;      // 给 Leader 参考的描述提示
}
```

### 8.2 预设场景列表

| 场景 ID | 名称 | 团队组合 | 预估耗时 | 子任务参考数 |
|---------|------|----------|----------|------------|
| deep_report | 深度报道 | 小策 + 小雷 + 小资 + 小文 + 小审 + 小发 | 8-15min | 5-7 |
| topic_planning | 专题策划 | 小策 + 小雷 + 小文 + 小审 | 10-20min | 4-6 |
| short_video_batch | 短视频矩阵 | 小策 + 小文 + 小剪 + 小发 | 10-15min | 6-10 |
| breaking_news | 舆情快报 | 小策 + 小雷 + 小数 + 小文 | 3-5min | 3-4 |
| graphic_article | 图文创作 | 小策 + 小雷 + 小文 | 5-8min | 3-5 |
| data_report | 数据专题 | 小策 + 小资 + 小文 + 频道顾问 | 12-20min | 5-8 |

详细配置见附录 A。

---

## 9. 异常处理机制

### 9.1 异常分类与处理策略

#### 9.1.1 子任务级异常

| 异常类型 | 检测方式 | 处理策略 |
|----------|----------|----------|
| Agent 输出格式错误 | 输出解析失败 | 重新提示该 Agent 修正格式，最多重试 2 次 |
| Agent 调用工具失败 | 工具返回错误 | 标记 `error.recoverable = true`，自动重试 |
| Agent 上下文溢出 | token 计数超限 | 执行上下文压缩后重试；若仍超限，向 Leader 报告 |
| 单任务执行超时 | 计时器触发 | 中断当前执行，标记 FAILED，由调度器决定重试或升级 |
| Agent 输出质量不达标 | Leader 审核不通过 | 将审核意见注入 Agent 上下文，要求修改重做 |

#### 9.1.2 协调级异常

| 异常类型 | 检测方式 | 处理策略 |
|----------|----------|----------|
| 依赖死锁 | DAG 中出现所有叶子节点都处于 PENDING/BLOCKED | Leader 介入：拆解死锁任务、修改依赖关系、或强制跳过某个任务 |
| Worker 间冲突 | 两个 Worker 的产出物存在矛盾 | Leader 裁决采用哪个版本，或要求其中一方修改 |
| 关键任务反复失败 | 同一任务 retry_count >= max_retries | Leader 评估是否降级处理、修改任务范围、或标记 Mission 为部分完成 |
| 进度严重滞后 | 任务已用时间 > 预估时间 × 2 | Leader 主动分析瓶颈，考虑拆分任务或请求额外资源 |

#### 9.1.3 系统级异常

| 异常类型 | 检测方式 | 处理策略 |
|----------|----------|----------|
| LLM API 不可用 | API 调用返回 5xx 或超时 | 指数退避重试（1s, 2s, 4s, 8s），5次后暂停 Mission |
| Agent 实例意外终止 | 心跳检测失败 | 重新创建实例，从最近的检查点恢复 |
| 资源池耗尽 | 创建请求被拒绝 | Mission 进入 QUEUED 排队，用户收到排队通知 |
| Mission 总超时 | 全局计时器触发 | 强制进入 Phase 5（汇总已有产出物），标记为 PARTIAL_COMPLETED |
| 数据存储故障 | 写入失败 | 内存缓存兜底，故障恢复后回写 |

### 9.2 降级交付策略

当 Mission 无法完全正常完成时，系统按以下优先级降级：

```
Level 1（正常交付）：所有任务完成，Leader 汇总后交付完整产出物
Level 2（部分交付）：核心任务完成，非核心任务失败/跳过，Leader 汇总已有产出物
Level 3（原始交付）：Leader 汇总失败，直接将各子任务 Artifact 打包交付
Level 4（失败报告）：核心任务失败，生成错误报告说明哪些步骤失败及原因
```

### 9.3 检查点机制

为了支持异常恢复，系统在以下时机保存检查点（Checkpoint）：

```
1. 每个 Phase 完成时
2. 每个子任务完成时
3. Leader 每次做出协调决策后

检查点内容：
- Mission 当前状态快照
- Task Board 完整状态
- 所有 Agent 的最近一轮会话上下文摘要
- 已生成的 Artifact 列表
```

---

## 10. 用户侧交互逻辑

### 10.1 用户角色定义

本系统中用户是**纯观察者**，在任务执行过程中不直接干预。用户的操作仅限于：

| 操作 | 时机 | 说明 |
|------|------|------|
| 选择场景 + 输入需求 | 任务创建时 | 唯一的主动输入点 |
| 查看任务列表和状态 | 任何时候 | 只读 |
| 查看任务详情和实时协作 | 任何时候 | 只读，包括消息流 |
| 取消任务 | 任何时候 | 终止正在执行的 Mission |
| 验收产出物 | Phase 5 完成后 | 查看/下载最终交付物 |
| 查看历史任务 | 任何时候 | 查看已完成/失败的 Mission 记录 |

### 10.2 实时推送

前端通过 WebSocket / SSE 订阅以下事件流：

| 事件 | 推送频率 | 前端行为 |
|------|----------|----------|
| `MISSION_PHASE_CHANGED` | 阶段切换时 | 更新顶栏阶段流程指示器 |
| `TASK_STATUS_CHANGED` | 每次状态变更 | 更新任务卡片状态 |
| `TASK_PROGRESS_UPDATED` | 每 5 秒或有变化时 | 更新进度条 |
| `NEW_MESSAGE` | 每条新消息 | 插入消息流 + 更新实时动态面板 |
| `AGENT_STATUS_CHANGED` | Agent 状态变更 | 更新左栏团队面板 |
| `ARTIFACT_CREATED` | 有新产出物 | 更新任务卡片产出物区域 |
| `MISSION_COMPLETED` | Mission 完成 | 展示交付物、切换到完成状态 |
| `MISSION_FAILED` | Mission 失败 | 展示错误信息和降级产出 |

### 10.3 消息可见性

用户可以看到本 Mission 内所有智能体之间的全部消息（包括点对点消息）。这是出于透明性考虑——用户作为"指挥官"需要了解团队内部的协作过程。

前端展示时对消息进行以下处理：
- 默认 Tab 展示任务看板，消息流在第二个 Tab
- 右侧实时动态面板展示最近 5-8 条消息的摘要（截断到 30 字）
- `priority = urgent` 的消息以通知气泡形式在界面顶部弹出

---

## 11. 接口契约摘要

### 11.1 前端 → 后端（REST API）

```
POST   /api/missions                  # 创建新 Mission
GET    /api/missions                  # 获取 Mission 列表（支持筛选）
GET    /api/missions/:id              # 获取 Mission 详情
DELETE /api/missions/:id              # 取消 Mission
GET    /api/missions/:id/tasks        # 获取子任务列表
GET    /api/missions/:id/messages     # 获取消息历史
GET    /api/missions/:id/artifacts    # 获取产出物列表
GET    /api/scenarios                 # 获取场景模板列表
GET    /api/agents/utilization        # 获取智能体负载信息
```

### 11.2 后端 → 前端（WebSocket / SSE）

```
WS /ws/missions/:id/events           # 订阅 Mission 事件流

事件格式：
{
  "event": "TASK_STATUS_CHANGED",
  "timestamp": "2026-03-22T14:32:08Z",
  "data": {
    "task_id": "task-002",
    "old_status": "in_progress",
    "new_status": "completed",
    "progress": 100,
    "agent_id": "instance-xiaolei-001"
  }
}
```

### 11.3 后端 → LLM API

每个 Agent Instance 对 LLM API 的调用封装为：

```
POST /v1/messages
{
  "model": "{agent_role.model}",
  "system": "{assembled_system_prompt}",
  "messages": [{agent_instance.session.messages}],
  "tools": [{agent_role.tools}],
  "max_tokens": 4096,
  "temperature": {agent_role.temperature}
}
```

---

## 12. 非功能性要求

### 12.1 性能要求

| 指标 | 目标值 |
|------|--------|
| Mission 创建到 Phase 1 完成 | < 10 秒 |
| 单个子任务平均执行时间 | < 60 秒 |
| 消息投递延迟 | < 500ms |
| 前端事件推送延迟 | < 1 秒 |
| 同时运行的 Mission 数 | ≥ 10 |
| 系统级智能体实例上限 | 50 |

### 12.2 可观测性

- 每个 Mission 的完整事件日志可回放
- 每个 Agent 的 LLM API 调用日志（含 token 消耗统计）
- 每个子任务的执行时间、重试次数、产出物质量评分
- 系统级：实例池利用率、API 调用 QPS、错误率

### 12.3 安全与隔离

- 不同 Mission 之间的 Agent 实例完全隔离，不共享任何上下文
- 用户数据不会泄露到其他用户的 Agent 会话中
- Agent 的 tool 调用受权限控制，仅允许该角色声明的 capabilities 范围内的工具
- 所有 Agent 输出经过基础的安全过滤（敏感信息、不当内容）

### 12.4 成本控制

- 每个 Mission 设置 token 消耗上限（默认 200K tokens）
- 超过上限时自动触发降级交付
- Leader 使用较强模型（如 claude-sonnet），Worker 根据任务复杂度可使用较轻模型（如 claude-haiku）
- 空闲超过 60 秒的 Agent 实例自动销毁

---

## 附录 A：预设场景模板详表

### A.1 深度报道 (deep_report)

```yaml
id: deep_report
name: 深度报道
leader_role: xiaece
required_roles:
  - { role: xiaece,   required: true }   # 策划总控
  - { role: xiaolei,  required: true }   # 素材采集
  - { role: xiaozi,   required: true }   # 数据分析
  - { role: xiaowen,  required: true }   # 内容撰写
  - { role: xiaoshen, required: true }   # 质量审核
  - { role: xiaofa,   required: false }  # 分发运营（可选）

task_template:
  - title: 选题策划与任务拆解
    role: xiaece
    phase: 1
    depends_on: []
    
  - title: 全网素材搜集与整理
    role: xiaolei
    phase: 2
    depends_on: [0]
    
  - title: 行业数据深度分析
    role: xiaozi
    phase: 2
    depends_on: [0]
    
  - title: 深度报道稿件撰写
    role: xiaowen
    phase: 3
    depends_on: [1, 2]
    
  - title: 内容质量审核
    role: xiaoshen
    phase: 4
    depends_on: [3]
    
  - title: 多渠道分发准备
    role: xiaofa
    phase: 5
    depends_on: [4]

estimated_duration: 480  # 8分钟
```

### A.2 舆情快报 (breaking_news)

```yaml
id: breaking_news
name: 舆情快报
leader_role: xiaece
required_roles:
  - { role: xiaece,   required: true }
  - { role: xiaolei,  required: true }
  - { role: xiaoshu,  required: true }
  - { role: xiaowen,  required: true }

task_template:
  - title: 事件定性与任务分配
    role: xiaece
    phase: 1
    depends_on: []
    
  - title: 多源信息快速采集
    role: xiaolei
    phase: 2
    depends_on: [0]
    
  - title: 舆情数据分析
    role: xiaoshu
    phase: 2
    depends_on: [0]
    
  - title: 快报稿件生成
    role: xiaowen
    phase: 3
    depends_on: [1, 2]

estimated_duration: 300  # 5分钟
```

### A.3 短视频矩阵 (short_video_batch)

```yaml
id: short_video_batch
name: 短视频矩阵
leader_role: xiaece
required_roles:
  - { role: xiaece,   required: true }
  - { role: xiaowen,  required: true }
  - { role: xiaojian, required: true }
  - { role: xiaofa,   required: true }

task_template:
  - title: 选题策划与角度拆分
    role: xiaece
    phase: 1
    depends_on: []
    
  - title: 各条视频脚本撰写
    role: xiaowen
    phase: 2
    depends_on: [0]
    
  - title: 分镜规划与字幕生成
    role: xiaojian
    phase: 3
    depends_on: [1]
    
  - title: 多平台适配与发布策略
    role: xiaofa
    phase: 4
    depends_on: [2]

estimated_duration: 600  # 10分钟
```

---

## 附录 B：术语表

| 术语 | 定义 |
|------|------|
| **Mission** | 一次完整的多智能体协作任务，从用户发起到产出物交付的全过程 |
| **Team Leader** | 主智能体，负责任务拆解、全局协调、汇总交付。通常由"小策"担任 |
| **AI Employee / Worker** | 子智能体，在自己的独立上下文窗口中自主执行分配的子任务 |
| **Task Board** | 共享任务看板，所有子任务状态的单一事实来源 |
| **Message Bus** | 智能体间的消息路由系统，支持点对点、广播、系统通知 |
| **DAG** | 有向无环图，描述子任务之间的依赖关系 |
| **Phase** | 任务生命周期的阶段（组队→拆解→执行→协调→交付） |
| **Artifact** | 产出物，由智能体执行任务后产生的文件或数据 |
| **Scenario Template** | 场景模板，预定义了特定媒体生产场景的团队组合和任务结构 |
| **Agent Instance** | 智能体运行实例，一个独立的 LLM 会话，拥有独立上下文 |
| **Checkpoint** | 检查点，用于异常恢复的状态快照 |
| **Grace Period** | 优雅终止等待期，Agent 被终止前完成当前输出的缓冲时间 |

---

*文档结束*
