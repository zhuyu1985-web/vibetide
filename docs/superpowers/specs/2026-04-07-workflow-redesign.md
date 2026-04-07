# 工作流模块深度重构设计

> 日期：2026-04-07
> 状态：草案
> 参考：Genspark AI Workflow Editor

## 1. 核心概念纠正

### 1.1 工作流 vs AI 团队

| 维度 | 工作流（Workflow） | AI 团队/Mission |
|------|-------------------|----------------|
| 结构 | 线性管道：技能A → 技能B → 技能C | DAG：多员工并行协作 |
| 步骤单元 | **技能（Skill）** | **员工（Employee）** |
| 典型场景 | 固定场景模板、可复用流程 | 复杂一次性任务、多人协作 |
| 执行方式 | 串行，按顺序执行技能 | Leader 分解，多员工并行 |
| 用户操作 | 编排固定流程 | 描述需求，AI 自动规划 |

**关键区分：** 工作流的步骤选择的是**技能**，不是员工。系统根据技能自动匹配最合适的员工执行。

### 1.2 工作流的三种使用方式

1. **独立执行** — 在"我的工作流"页面点击"运行"
2. **对话中触发** — 意图识别匹配到已配置的工作流，自动按流程执行，结果返回对话
3. **员工/团队集成** — 作为"工具"被 AI 员工在 Mission 中调用

工作流在系统中的角色：从"独立模块"升级为**基础能力单元**，与技能并列。

### 1.3 技能是基础单元

- 每个技能有独立的 SKILL.md 定义
- 技能管理页面（`/skills`）需要恢复到侧边栏
- 工作流步骤 = 选择一个技能
- 员工通过 `employee_skills` 绑定技能

## 2. 需要修复的问题

### 2.1 恢复技能管理入口

侧边栏重构时"技能管理"被移除，需要恢复。

**方案：** 在侧边栏一级菜单"智能体"改为展开组，包含子菜单：
- 智能体（原 /ai-employees）
- 技能管理（/skills）

### 2.2 恢复员工详情页

原有的员工详情页（`/employee/[id]` 或类似路由）在新市场页中丢失了入口。

**方案：** 员工市场页的卡片点击跳转到 `/ai-employees/[slug]` 详情页，展示：技能绑定、记忆、历史任务、性能指标等。

### 2.3 员工卡片高度优化

`EmployeeAgentCard` 当前过高，需要压缩：
- 热门任务从 3 行减为 2 行
- 技能标签从多行改为单行 + 溢出计数
- 减少内边距和间距

## 3. 工作流编辑器重构

### 3.1 三栏布局

```
┌──────────────┬─────────────────────────┬──────────────────┐
│  AI 对话面板  │   步骤画布               │  右侧面板         │
│              │                         │  (添加步骤/详情)   │
│  描述任务，   │  入门                    │                  │
│  AI 自动生成  │  [触发器卡片]             │  AI 自定义步骤    │
│              │                         │  [描述操作...]     │
│              │  操作                    │                  │
│              │  [步骤1: 热点监测]        │  按分类的技能列表  │
│              │       │                 │  感知类           │
│              │  [步骤2: 选题策划]        │  · 热点监测       │
│              │       │                 │  · 趋势分析       │
│  ┌─────────┐│  [步骤3: 内容生成]        │  生成类           │
│  │ 输入框   ││       │                 │  · 内容生成       │
│  │ [对话]   ││  [+ 添加步骤]            │  · 脚本生成       │
│  └─────────┘│                         │  ...              │
│              │  [测试运行] [开启] [保存]  │                  │
└──────────────┴─────────────────────────┴──────────────────┘
```

### 3.2 步骤选择 = 选择技能

添加步骤面板展示**技能列表**（从数据库加载，按 category 分组）：

| 分类 | 英文 | 示例技能 |
|------|------|---------|
| 感知 | perception | 热点监测、趋势分析、社交监听 |
| 分析 | analysis | 受众分析、竞品分析、情感分析、数据报告 |
| 生成 | generation | 内容生成、标题生成、脚本生成、摘要生成 |
| 制作 | production | 缩略图生成、音频计划、视频剪辑计划、排版设计 |
| 管理 | management | 质量审核、发布策略、合规检查、任务规划 |
| 知识 | knowledge | 知识检索、事实核查、案例参考、翻译 |

每个技能项显示：图标 + 技能名称，点击添加为一个步骤。

### 3.3 触发器卡片

独立于操作步骤，位于画布顶部"入门"区域：
- 手动触发：显示"手动触发"标签
- 定时触发：显示 cron 描述（如"每天 09:00"）+ "触发器"徽章
- 点击可编辑触发配置

### 3.4 步骤卡片设计

```
┌─────────────────────────────────────┐
│  [技能图标]  步骤 1：热点监测    ⋮  │
└─────────────────────────────────────┘
```

- 左侧：技能分类对应的图标（按分类着色）
- 中间：步骤序号 + 技能名称
- 右侧：三点菜单（编辑/删除/上移/下移）
- 步骤间竖线连接
- 选中态：蓝色边框
- 测试运行态：pending(灰) → running(蓝+spinner) → completed(绿+勾) → failed(红)

### 3.5 右侧面板切换

**添加步骤模式（默认）：**
- AI 自定义步骤：描述操作，AI 选择技能
- 技能列表：按分类展示，点击添加

**步骤详情模式（点击步骤时）：**
- 步骤名称编辑
- 步骤说明输入
- 当前绑定技能（可更换）
- 参数配置
- 关闭 → 回到添加模式

### 3.6 AI 对话面板

- 用户输入自然语言描述（如"每天自动生成热点早报"）
- 调用 LLM，传入可用技能列表
- LLM 返回步骤序列 JSON（每步指定 skillSlug + 步骤名称）
- 自动填充到中间画布
- 首次进入显示引导气泡

### 3.7 测试运行

- 点击"测试运行"进入预览模式
- 顶部提示栏："预览模式 - 编辑或启用后将保存为您的工作流"
- 触发器模拟完成（绿勾 + "模拟定时触发器已完成"）
- 步骤依次执行，调用 Mission 引擎的单步执行
- 每步实时状态更新（SSE 流）
- 点击已完成的步骤，右侧显示执行结果
- 执行完毕后可查看每步详情

### 3.8 底部操作栏

- **测试运行**：运行一次看效果
- **开启**：启用定时工作流（仅定时类型显示）
- **保存更改**：保存工作流

## 4. 数据结构调整

### 4.1 WorkflowStepDef 修改

```typescript
interface WorkflowStepDef {
  id: string;
  order: number;
  dependsOn: string[];
  name: string;
  type: "skill" | "output";  // 改：去掉 "employee"，"tool" 改为更明确的类型
  config: {
    skillSlug?: string;       // 核心：绑定技能 slug
    skillName?: string;       // 技能显示名（冗余，方便展示）
    skillCategory?: string;   // 技能分类
    outputAction?: string;
    parameters: Record<string, any>;
    description?: string;     // 步骤说明
  };
}
```

### 4.2 意图识别扩展

`intent-recognition.ts` 需要扩展匹配范围：
- 现有：匹配技能 → 分配给员工
- 新增：匹配已配置的工作流 → 按工作流执行

识别结果新增 `workflowId` 字段：
```typescript
interface IntentResult {
  // 现有字段...
  workflowId?: string;        // 匹配到的工作流 ID
  workflowName?: string;      // 工作流名称
  executionMode: "skill" | "workflow";  // 执行模式
}
```

### 4.3 工作流作为工具注册

在 `tool-registry.ts` 中注册工作流为可调用工具：
- 工具名：`workflow_<slug>`
- 输入：工作流的触发参数
- 执行：创建 Mission 或直接串行执行技能链

## 5. 文件清单

### 新增
```
src/components/workflows/workflow-canvas.tsx       — 中间画布
src/components/workflows/trigger-card.tsx          — 触发器卡片
src/components/workflows/step-card.tsx             — 步骤卡片（含执行状态）
src/components/workflows/ai-chat-panel.tsx         — 左侧 AI 对话面板
src/components/workflows/right-panel.tsx           — 右侧面板（切换容器）
src/components/workflows/skill-step-panel.tsx      — 技能列表添加面板
src/components/workflows/step-detail-panel.tsx     — 步骤详情面板
src/components/workflows/test-run-banner.tsx       — 测试运行顶部提示
src/components/workflows/bottom-action-bar.tsx     — 底部操作栏
src/app/api/workflows/generate/route.ts           — AI 生成工作流 API
src/app/api/workflows/test-run/route.ts           — 测试运行 SSE API
src/app/(dashboard)/ai-employees/[slug]/page.tsx   — 员工详情页（恢复）
```

### 重写
```
src/components/workflows/workflow-editor.tsx        — 三栏布局主组件
src/components/workflows/add-step-panel.tsx         — 改为技能选择面板
src/components/workflows/step-list.tsx              — 改为画布中的步骤序列
src/components/workflows/step-config-panel.tsx      — 改为步骤详情面板
src/components/ai-employees/employee-agent-card.tsx  — 卡片高度优化
```

### 修改
```
src/components/layout/app-sidebar.tsx               — 恢复技能管理入口
src/lib/agent/intent-recognition.ts                 — 扩展工作流匹配
src/lib/agent/tool-registry.ts                      — 注册工作流为工具
src/db/schema/workflows.ts                          — WorkflowStepDef 类型调整
src/lib/workflow-templates.ts                        — 内置模板改为技能绑定
src/app/(dashboard)/ai-employees/ai-employees-client.tsx — 卡片点击跳转详情
```

## 6. 实施分期

### Phase A：基础修复（紧急）
1. 恢复侧边栏技能管理入口
2. 恢复员工详情页
3. 员工卡片高度优化
4. WorkflowStepDef 类型从 employee 改为 skill

### Phase B：编辑器重构
1. 三栏布局框架
2. 触发器卡片
3. 技能选择面板（替代员工选择）
4. 步骤画布 + 步骤卡片
5. 右侧面板切换（添加/详情）
6. 底部操作栏

### Phase C：AI 能力
1. AI 对话面板 + LLM 生成工作流
2. AI 自定义步骤
3. 意图识别扩展（匹配工作流）
4. 工作流注册为工具

### Phase D：测试运行
1. 测试运行 SSE API
2. 步骤执行状态实时更新
3. 执行结果展示
4. 预览模式 UI

## 7. 不在本次范围

- DAG 可视化（保持线性）
- 工作流版本管理
- 工作流市场/分享
- 定时触发的实际 cron 调度（Inngest 集成后续做）
