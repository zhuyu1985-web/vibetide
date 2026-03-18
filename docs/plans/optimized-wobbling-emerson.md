# 模块四：AI 团队引擎 — 完整功能需求清单

## Context

本文档基于对 Vibetide 全量代码库的深入分析，为模块四（AI 团队引擎）生成完整的功能需求清单。模块四是整个平台的核心基座，所有上层业务模块（资产管理、内容生产、渠道分发）的 AI 能力均通过本模块的 AI 员工团队来承载和交付。

核心理念：将 AI 以「有角色、有职责、能协作的团队成员」身份呈现，支持三种工作模式——全自动（AI 自主完成）、半自动（AI 执行 + 人工审批）、协同（AI + 人类实时协作）。

---

## 一、AI 员工生命周期管理

### 1.1 员工创建与初始化

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.01 | 预置员工市场 | 9 种预置角色（8 专职 + 1 频道顾问）开箱即用，`is_preset=1` | 已完成 | `src/db/seed.ts`; `src/lib/constants.ts#EMPLOYEE_META` |
| F4.1.02 | 自定义员工创建 | 基于角色模板创建自定义员工（`is_preset=0`），指定 slug/name/nickname/title/roleType | 已完成 | `src/app/actions/employees.ts#createEmployee`; `EmployeeCreateDialog` |
| F4.1.03 | 员工档案查看 | 完整展示员工基本信息、技能、绩效、偏好、知识库绑定、学习模式 | 已完成 | `src/lib/dal/employees.ts#getEmployeeFullProfile`; `/employee/[id]` |
| F4.1.04 | 员工档案编辑 | 修改员工名称、头衔、格言、权限等级 | 已完成 | `src/app/actions/employees.ts#updateEmployeeProfile` |
| F4.1.05 | 员工克隆 | 基于现有员工快速复制（含技能绑定），生成 `is_preset=0` 副本 | 已完成 | `src/app/actions/employees.ts#cloneEmployee` |
| F4.1.06 | 员工删除 | 删除自定义员工（预置员工禁止删除），级联清理技能绑定 | 已完成 | `src/app/actions/employees.ts#deleteEmployee` |
| F4.1.07 | 员工停用/启用 | 通过 `disabled` 状态临时停用员工，停用后不参与团队调度 | 待实现 | 当前只有 working/idle/learning/reviewing 四种运行态 |
| F4.1.08 | 员工导入/导出 | 将员工配置（含技能、偏好）导出为 JSON，支持跨组织导入 | 待实现 | — |
| F4.1.09 | 员工版本历史 | 记录员工配置变更历史，支持回滚到历史版本 | 待实现 | — |

### 1.2 员工状态管理

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.10 | 状态实时展示 | Team Hub 实时显示所有员工当前状态（working/idle/learning/reviewing）和任务 | 已完成 | `team-hub/page.tsx` |
| F4.1.11 | 手动状态更新 | 管理员可手动更新员工状态和当前任务描述 | 已完成 | `src/app/actions/employees.ts#updateEmployeeStatus` |
| F4.1.12 | 状态自动切换 | 工作流步骤执行时自动切 `working`，完成后自动切回 `idle` | **待补全** | Inngest 执行时未调用 `updateEmployeeStatus`，需在 `execute-workflow.ts` 中补充 |
| F4.1.13 | 状态变更通知 | 员工状态变更时通过消息系统推送通知 | 待实现 | 需新增 `employee/status-changed` Inngest 事件 |

### 1.3 四级权限体系

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.14 | 权限等级定义 | `observer`(只观察建议) → `advisor`(可提建议) → `executor`(可自主执行) → `coordinator`(可协调决策) | 已完成 | `src/db/schema/enums.ts#authorityLevelEnum` |
| F4.1.15 | 权限等级配置 UI | 管理员可在员工档案页调整权限等级（4 个单选按钮 + 说明） | 已完成 | `employee-profile-client.tsx` Permissions Tab |
| F4.1.16 | 权限执行时拦截 | Agent 执行后，`observer`/`advisor` 权限自动标记输出为 `needs_approval` | 已完成 | `src/lib/agent/execution.ts` 行 99-101 |
| F4.1.17 | 自主行动列表 | 配置员工可自主执行的操作列表（JSONB） | 已完成 | `ai_employees.auto_actions`; `updateAutoActions` |
| F4.1.18 | 需审批行动列表 | 配置员工需人工审批的操作列表（JSONB） | 已完成 | `ai_employees.need_approval_actions` |
| F4.1.19 | 动态权限升降 | 根据员工绩效和信任度自动升降权限等级 | 待实现 | 属 4.3 自学习进化范畴 |

### 1.4 工作偏好配置

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.20 | 偏好展示与编辑 | 展示/编辑：主动性、汇报频率、自主等级、沟通风格、工作时间 | 已完成 | `employee-profile-client.tsx` Work Preferences Tab |
| F4.1.21 | 偏好保存 | Server Action 持久化偏好到 `work_preferences` JSONB 字段 | 已完成 | `src/app/actions/employees.ts#updateWorkPreferences` |
| F4.1.22 | **偏好注入 Agent Prompt** | 工作偏好实际影响 Agent 的 system prompt 和执行策略 | **待实现** | `buildSystemPrompt` 未读取/注入实际偏好数据 |
| F4.1.23 | 偏好模板 | 预置偏好模板（「高度自主」「严格审批」等），一键应用 | 待实现 | — |

### 1.5 绩效数据管理

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.24 | 绩效指标存储 | `tasksCompleted`/`accuracy`/`avgResponseTime`/`satisfaction` 四项核心指标 | 已完成 | `ai_employees` 表 4 个绩效字段 |
| F4.1.25 | 绩效看板展示 | 员工档案页 Performance Tab 展示 4 项指标卡片 | 已完成 | `employee-profile-client.tsx` |
| F4.1.26 | **绩效自动更新** | 每次完成工作流步骤后自动递增 `tasksCompleted`，更新准确率等 | **待实现** | `execute-workflow.ts` 完成后未更新绩效字段 |
| F4.1.27 | 绩效趋势图表 | 按时间维度展示绩效变化趋势 | 待实现 | 需新建 `performance_snapshots` 表 |
| F4.1.28 | 团队绩效对比 | 在团队维度对比不同 AI 员工的效能表现 | 待实现 | — |

---

## 二、技能管理系统

### 2.1 技能库

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.30 | 六大分类体系 | perception / analysis / generation / production / management / knowledge | 已完成 | `src/db/schema/enums.ts#skillCategoryEnum` |
| F4.1.31 | 三种类型标记 | builtin(内置) / custom(自定义) / plugin(插件) | 已完成 | `src/db/schema/enums.ts#skillTypeEnum` |
| F4.1.32 | 技能库浏览 | 分类浏览所有可用技能，支持按分类过滤 | 已完成 | `src/lib/dal/skills.ts#getSkills`; `SkillBrowserDialog` |
| F4.1.33 | 技能详情 | 查看技能的输入输出 Schema、运行时配置、兼容角色 | 部分实现 | 字段存在但 UI 未完整展示 |
| F4.1.34 | 技能在线测试 | 选择技能 → 输入参数 → 查看执行结果 | 待实现 | — |

### 2.2 技能绑定

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.35 | 绑定技能 | 将技能绑定到员工，默认熟练度 50 | 已完成 | `bindSkillToEmployee` |
| F4.1.36 | 解绑技能 | 解除员工的技能绑定 | 已完成 | `unbindSkillFromEmployee` |
| F4.1.37 | 调整熟练度 | 滑块调整 0-100 熟练度 | 已完成 | `updateSkillLevel` |
| F4.1.38 | 可绑定过滤 | 查询尚未绑定到某员工的技能列表 | 已完成 | `getSkillsNotBoundToEmployee` |
| F4.1.39 | 兼容性检查 | 绑定时校验技能与员工角色的兼容性 | 待实现 | `skills.compatible_roles` 存在但绑定时未校验 |
| F4.1.40 | **技能驱动工具集** | 员工绑定的技能决定 Agent 可用的工具函数 | 已完成 | `assembly.ts` → `resolveTools(skillNames)` |

### 2.3 高级技能管理

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.1.41 | 技能版本管理 | 版本迭代、灰度发布、回滚 | 待实现 |
| F4.1.42 | 自定义技能接入 | 第三方通过标准接口接入自定义技能（API 适配器） | 待实现 |
| F4.1.43 | 技能组合 Combo | 多技能串联组合成复合技能 | 待实现 |
| F4.1.44 | 熟练度自动提升 | 基于使用频次和成功率自动调整熟练度 | 待实现 |

---

## 三、团队组建与管理

### 3.1 团队创建

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.50 | 三步创建向导 | 步骤1:选择场景 → 步骤2:选择/推荐成员 → 步骤3:配置规则 | 已完成 | `team-builder-client.tsx` |
| F4.1.51 | 四种预设场景 | `breaking_news` / `deep_report` / `social_media` / `custom` | 已完成 | `teams.scenario` |
| F4.1.52 | 智能成员推荐 | 根据场景自动推荐最佳 AI 员工组合 | 部分实现 | 推荐逻辑为前端硬编码，非动态计算 |
| F4.1.53 | 混合成员支持 | 同一团队可含 AI 成员（`member_type='ai'`）和人类成员（`member_type='human'`） | 已完成 | `createTeam` |
| F4.1.54 | 团队模板库 | 预置团队模板（新闻快讯团队/深度报道团队/运营团队），一键创建 | 部分实现 | 场景有预设但无完整模板保存/复用机制 |

### 3.2 团队协作规则（规则引擎核心）

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.55 | 审批要求 | `approvalRequired`: true 时工作流 review 步骤需人工审批 | 已完成 | `teams.rules` JSONB; `updateTeamRules` |
| F4.1.56 | 汇报频率 | `reportFrequency`: 实时/每小时/每4小时/每日 | 已完成 | 同上 |
| F4.1.57 | 敏感话题列表 | `sensitiveTopics`: 政治/军事/法律/伦理/灾难/低俗 | 已完成 | 同上 |
| F4.1.58 | **敏感话题生效** | 配置的敏感话题在 Agent 执行时注入 prompt，影响审核严格度 | **待实现** | `rules.sensitiveTopics` 存储但未传入 Agent |
| F4.1.59 | 升级策略 | 定义何种情况升级到人类审批（如敏感度 > 阈值、质量评分 < 阈值） | 部分实现 | `teams.escalation_policy` 字段存在，无读写代码 |
| F4.1.60 | **多步骤审批点配置** | 可在任意工作流步骤（不仅 review）设置审批门 | **待实现** | 当前硬编码 `wfStep.key === "review"` |
| F4.1.61 | **条件审批** | 基于内容敏感度、质量评分等条件动态决定是否需要审批 | **待实现** | — |
| F4.1.62 | 工作流模板关联 | 团队可关联默认工作流模板 | 已完成 | `teams.workflow_template_id` FK |

### 3.3 成员管理

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.63 | 添加 AI 成员 | 向团队添加 AI 员工，指定团队角色 | 已完成 | `addTeamMember`; `AddMemberDialog` |
| F4.1.64 | 添加人类成员 | 向团队添加人类成员，指定审批角色 | 已完成 | 同上 |
| F4.1.65 | 移除成员 | 从团队移除任意成员 | 已完成 | `removeTeamMember` |
| F4.1.66 | 调整成员角色 | 修改团队内成员的职责描述 | 待实现 | 需新增 `updateTeamMemberRole` |
| F4.1.67 | 成员详情展示 | 展示每个成员的完整信息（AI 含技能/状态/绩效） | 已完成 | `getTeamWithMembers` |

### 3.4 团队 CRUD

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.68 | 团队列表 | 查看组织下所有团队 | 已完成 | `getTeams` |
| F4.1.69 | 团队信息更新 | 修改团队名称或场景 | 已完成 | `updateTeam` |
| F4.1.70 | 团队删除 | 删除团队（级联删除 team_members） | 已完成 | `deleteTeam` |
| F4.1.71 | 团队详情页 | `/team-builder/[id]` 展示团队详情、成员、规则 | 已完成 | `team-builder/[id]/page.tsx` |
| F4.1.72 | 团队效能报告 | 团队级别的综合效能分析，含人机协作效率指标 | 待实现 | — |

---

## 四、工作流编排与执行引擎（核心中的核心）

### 4.1 工作流模板

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.80 | 模板定义 | `workflow_templates` 表：name, description, steps（JSONB: key, label, employeeSlug, order） | 已完成 | `src/db/schema/workflows.ts` |
| F4.1.81 | 标准 8 步流程 | 预置模板：监控(小雷)→策划(小策)→素材(小资)→创作(小文)→制作(小剪)→审核(小审)→发布(小发)→分析(小数) | 已完成 | `src/lib/constants.ts#WORKFLOW_STEPS`; seed |
| F4.1.82 | 模板查询 | 查看组织下所有可用模板 | 已完成 | `getWorkflowTemplates` |
| F4.1.83 | 自定义模板创建 | 用户自行创建工作流模板（选步骤和负责员工） | 待实现 | 无 Server Action |
| F4.1.84 | 模板编辑/删除 | 修改或删除已有模板 | 待实现 | — |

### 4.2 工作流实例生命周期

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.85 | 创建实例 | 基于模板创建工作流实例及步骤记录 | 已完成 | `src/app/actions/workflow-engine.ts#startWorkflow` |
| F4.1.86 | 触发 Inngest 执行 | 创建后发送 `workflow/started` 事件触发异步执行 | 已完成 | `inngest.send("workflow/started")` |
| F4.1.87 | 取消工作流 | 取消正在运行的工作流（DB 更新 + Inngest `cancelOn`） | 已完成 | `cancelWorkflow` |
| F4.1.88 | 实例状态跟踪 | 查看状态：`active` / `completed` / `cancelled` | 已完成 | `getWorkflows` / `getWorkflow` |
| F4.1.89 | 当前步骤追踪 | `current_step_key` 标记当前执行到哪步 | 已完成 | Inngest 更新 `currentStepKey` |
| F4.1.90 | **启动工作流 UI** | Team Hub 页面的「启动工作流」按钮 + 选题表单 | **待实现** | Server Actions 就绪，缺 UI |

### 4.3 工作流步骤执行

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.91 | 顺序执行 | 步骤按 `step_order` 逐一执行 | 已完成 | `execute-workflow.ts` for 循环 |
| F4.1.92 | Agent 组装+执行 | 加载员工 → 组装 Agent → 调用 LLM → 解析输出 | 已完成 | `assembleAgent` → `executeAgent` |
| F4.1.93 | 步骤状态流转 | `pending` → `active` → `completed`/`skipped`/`waiting_approval`/`failed` | 已完成 | `workflowStepStatusEnum` |
| F4.1.94 | 输出保存 | 文本存 `output`，结构化数据存 `structured_output` JSONB | 已完成 | `execute-workflow.ts` 行 117-127 |
| F4.1.95 | **上下文传递** | 前序步骤的输出（summary + artifacts）自动传递给后续步骤 | 已完成 | `completedOutputs` 累积 → 注入后续 Agent |
| F4.1.96 | 进度回调 | Agent 执行过程中实时更新进度百分比 | 已完成 | `onProgress` 回调 10%→30%→...→100% |
| F4.1.97 | 无员工步骤跳过 | 未分配员工的步骤自动标记 `skipped` | 已完成 | `execute-workflow.ts` 行 59-66 |
| F4.1.98 | 重试机制 | 失败后自动重试（Inngest `retries: 1`） | 已完成 | `retries: 1`; `workflow_steps.retry_count` |
| F4.1.99 | **并行步骤执行** | 多个无依赖步骤可并行执行（如素材准备+数据收集） | **待实现** | 当前仅顺序执行 |
| F4.1.100 | **条件分支** | 根据步骤输出条件（如热度分级）走不同后续路径 | **待实现** | 当前仅线性流程 |

### 4.4 审批门控系统

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.101 | 审批等待机制 | 需审批步骤进入 `waiting_approval`，Inngest `waitForEvent` 等待（24h 超时） | 已完成 | `execute-workflow.ts` 行 150-155 |
| F4.1.102 | 审批操作 | 人类可批准或驳回，附带反馈文本 | 已完成 | `approveWorkflowStep` |
| F4.1.103 | 审批消息 | 发 `decision_request` 类型消息，附「批准」「驳回」按钮 | 已完成 | `execute-workflow.ts` 行 130-147 |
| F4.1.104 | 驳回处理 | 驳回/超时 → 步骤 `failed` + 记录原因 + 终止工作流 | 已完成 | `execute-workflow.ts` 行 157-189 |
| F4.1.105 | **审批 UI** | Team Hub 页面将消息中的按钮连接到 `approveWorkflowStep` | **待实现** | actions 字段有数据，UI 未连接 |
| F4.1.106 | **驳回后重做** | 驳回后回退到指定步骤重新执行，而非终止整个工作流 | **待实现** | 当前驳回直接 `cancelled` |
| F4.1.107 | **附反馈重做** | 驳回时的反馈注入到 Agent 重新执行的上下文中 | **待实现** | `feedback` 字段在事件中已有，但无重做逻辑 |

---

## 五、Agent 基础设施

### 5.1 Agent 组装管线

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.110 | 7 层 System Prompt | 身份→技能→权限→知识→工作风格→学习→输出规范 | 已完成 | `src/lib/agent/prompt-templates.ts#buildSystemPrompt` |
| F4.1.111 | 技能→工具映射 | 员工技能名称 → 实际可执行的工具函数 | 已完成 | `src/lib/agent/tool-registry.ts#resolveTools` |
| F4.1.112 | 知识库上下文注入 | 加载员工绑定的知识库描述，注入 prompt | 已完成 | `assembly.ts` 行 53-70 |
| F4.1.113 | **模型路由** | 按技能分类自动选最优 LLM | 已完成 | `model-router.ts#CATEGORY_DEFAULTS` |

模型路由规则：

| 技能分类 | 模型 | 温度 | Max Tokens |
|---------|------|------|-----------|
| perception | gpt-4o-mini | 0.3 | 4k |
| analysis | claude-sonnet-4 | 0.4 | 4k |
| generation | claude-sonnet-4 | 0.7 | 8k |
| production | gpt-4o | 0.3 | 4k |
| management | claude-sonnet-4 | 0.3 | 4k |
| knowledge | gpt-4o-mini | 0.2 | 4k |

### 5.2 Agent 执行

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.114 | LLM 调用 | Vercel AI SDK `generateText()`，最多 10 次工具调用 | 已完成 | `execution.ts#executeAgent` |
| F4.1.115 | 步骤专属指令 | 8 种步骤类型各有详细中文指令 | 已完成 | `prompt-templates.ts#STEP_INSTRUCTIONS` |
| F4.1.116 | 输出解析 | LLM 文本 → 结构化 `StepOutput`（summary + artifacts + metrics） | 已完成 | `step-io.ts#parseStepOutput` |
| F4.1.117 | 权限后处理 | observer/advisor 权限自动标记 `needs_approval` | 已完成 | `execution.ts` 行 99-101 |
| F4.1.118 | 执行指标 | 记录 tokenUsed、durationMs、toolCallCount | 已完成 | `AgentExecutionResult` |

### 5.3 工具系统

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.120 | 工具注册表 | Vercel AI SDK `tool()` + Zod Schema 验证 | 已完成 | `tool-registry.ts` |
| F4.1.121 | web_search | 网络搜索工具 | **模拟实现** | 返回 mock 数据 |
| F4.1.122 | content_generate | 内容生成工具 | **模拟实现** | 返回 mock 数据 |
| F4.1.123 | fact_check | 事实核查工具 | **模拟实现** | 返回 mock 数据 |
| F4.1.124 | 未映射技能存根 | 员工拥有但未注册的技能自动创建 stub 工具 | 已完成 | `toVercelTools` 行 95-107 |
| F4.1.125 | **真实搜索 API** | 连接 Serper/SerpAPI 等搜索引擎 | **待实现** | — |
| F4.1.126 | **素材检索工具** | 连接媒资库（`media_assets` 表）检索素材 | **待实现** | — |
| F4.1.127 | **渠道 API 推送** | 连接各平台 API 执行实际发布 | **待实现** | — |
| F4.1.128 | **数据报表工具** | 从 `channel_metrics` 表聚合分析数据 | **待实现** | — |

### 5.4 知识库 RAG

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.130 | KB 存储 | `knowledge_bases` + `knowledge_items` 表支持文档分块存储 | 已完成 | `src/db/schema/knowledge-bases.ts` |
| F4.1.131 | 向量化状态 | `vectorization_status`: pending→processing→done→failed | 已完成 | Schema 就绪 |
| F4.1.132 | 嵌入存储 | `knowledge_items.embedding` JSONB 字段 | 已完成(Schema) | 无嵌入生成代码 |
| F4.1.133 | KB 绑定 | 员工←→知识库多对多 | 已完成 | `employee_knowledge_bases` |
| F4.1.134 | **RAG 检索** | Agent 执行时从绑定 KB 检索相关文档，注入上下文 | **待实现** | 当前只注入 KB 名称，不做向量检索 |
| F4.1.135 | **文档处理管线** | 上传→分块→嵌入→存储 | **待实现** | — |

---

## 六、消息与协作系统

### 6.1 团队消息

| 编号 | 功能名称 | 说明 | 状态 | 代码位置 |
|------|---------|------|------|---------|
| F4.1.140 | 四种消息类型 | `alert`(预警) / `decision_request`(决策请求) / `status_update`(状态更新) / `work_output`(工作产出) | 已完成 | `messageTypeEnum` |
| F4.1.141 | AI 自动发消息 | 工作流执行过程中自动发送状态更新和工作产出消息 | 已完成 | `execute-workflow.ts` 每步插入消息 |
| F4.1.142 | 人类发消息 | 人类用户可向团队发送消息 | 已完成 | `sendTeamMessage` |
| F4.1.143 | 操作按钮 | 消息附带操作按钮（批准/驳回/查看详情） | 已完成 | `team_messages.actions` JSONB |
| F4.1.144 | 附件支持 | 选题卡片/草稿预览/图表/资产 4 种附件类型 | 已完成 | `team_messages.attachments` JSONB |
| F4.1.145 | Activity Feed | 按时间倒序展示团队消息 | 已完成 | `getTeamMessages` |
| F4.1.146 | 工作流关联 | 消息关联到具体工作流实例和步骤 | 已完成 | `workflow_instance_id` + `workflow_step_key` |
| F4.1.147 | 跨模块消息 | 其他模块事件（审核完成/发布状态/数据异常）通过消息推送 | 已完成 | `postTeamMessage` |

### 6.2 通知增强（待实现）

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.1.148 | 浏览器通知 | alert/decision_request 触发浏览器推送 | 待实现 |
| F4.1.149 | 未读计数 | 显示用户未读消息数量 | 待实现 |
| F4.1.150 | 已读标记 | 阅读后标记已读 | 待实现 |
| F4.1.151 | @提及 | 在消息中 @特定员工或人类 | 待实现 |

---

## 七、三种自动化模式设计

### 7.1 全自动模式（Full-Auto）

> AI 员工全权处理，人类只看结果。适用于低风险、高频次、标准化内容。

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.A.01 | 全自动执行 | `approvalRequired=false` 时，8 步工作流无人工干预自动执行到底 | 已完成 |
| F4.A.02 | **热点自动触发** | 热点达到阈值 → 自动创建工作流实例并启动 | **待实现** |
| F4.A.03 | **定时调度** | cron 排班自动启动周期性内容生产 | **待实现** |
| F4.A.04 | **自动数据回流** | 发布后自动收集传播数据 → 更新员工绩效 | 部分实现 |
| F4.A.05 | **异常自动升级** | 全自动模式下遇到异常（质量低/敏感内容）自动切换到半自动 | **待实现** |
| F4.A.06 | **全自动场景模板** | 预设全自动场景：「快讯自动推送」「赛事实时报道」「每日资讯汇编」 | **待实现** |

### 7.2 半自动模式（Semi-Auto）

> AI 员工执行，人类在关键节点审批。适用于中等风险、需品质把控的内容。

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.S.01 | review 步骤审批 | `approvalRequired=true` 时 review 步骤等待人工审批 | 已完成 |
| F4.S.02 | **任意步骤审批** | 可在任意步骤设置审批点（如创作完成后、发布前） | **待实现** |
| F4.S.03 | **条件触发审批** | 规则引擎：质量 < 60 → 需审批；敏感话题 → 需审批；其余自动通过 | **待实现** |
| F4.S.04 | **驳回后重做** | 驳回时提供反馈 → AI 根据反馈修改 → 重新提交审批 | **待实现** |
| F4.S.05 | **批量审批** | 同时审批多个等待中的工作流步骤 | **待实现** |
| F4.S.06 | **审批仪表盘** | 集中展示所有待审批项目，按优先级排列 | **待实现** |
| F4.S.07 | **审批超时策略** | 超时后可选：自动通过 / 自动驳回 / 升级到更高级别 | **待实现** |

### 7.3 协同模式（Collaborative）

> AI 员工和人类实时协作，各自发挥优势。适用于高价值、创意性内容。

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.C.01 | **人机实时对话** | 人类与 AI 员工在消息流中实时对话，共同完成任务 | **待实现** |
| F4.C.02 | **AI 辅助编辑** | AI 根据人类编辑的实时修改提供即时建议 | **待实现** |
| F4.C.03 | **并行工作分配** | 同一内容：AI 写初稿 + 人类做选题；AI 做数据 + 人类做评论 | **待实现** |
| F4.C.04 | **共享创作会话** | `creation_sessions` 表支持多 AI + 人类共同参与的创作会话 | 已完成(Schema) |
| F4.C.05 | **接力模式** | AI 完成 60% → 交给人类 → 人类修改后 → AI 继续后续步骤 | **待实现** |
| F4.C.06 | **AI 候选方案** | AI 生成多个方案 → 人类选择最佳 → AI 基于选择继续深化 | **待实现** |

### 7.4 模式切换与混合

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.M.01 | **模式预设** | 团队创建时选择默认工作模式（全自动/半自动/协同） | **待实现** |
| F4.M.02 | **运行中切换** | 工作流执行过程中可由人类介入切换模式（如全自动→半自动） | **待实现** |
| F4.M.03 | **混合模式** | 不同步骤可设定不同模式（监控全自动 + 创作协同 + 审核半自动） | **待实现** |
| F4.M.04 | **模式记忆** | 记录每次工作流使用的模式和效果，推荐最优模式 | **待实现** |

---

## 八、跨模块集成接口

### 8.1 与模块一（AI 资产重构）

| 编号 | 集成点 | 实现状态 |
|------|--------|---------|
| F4.X.01 | `channel_advisors.ai_employee_id` → 频道顾问关联 AI 员工 | 已完成 |
| F4.X.02 | 小资在 `material` 步骤中执行素材检索（连接 `media_assets` 表） | 已完成(架构) |
| F4.X.03 | 知识库通过 `employee_knowledge_bases` 绑定给频道顾问和相关员工 | 已完成 |

### 8.2 与模块二（智创生产）

| 编号 | 集成点 | 实现状态 |
|------|--------|---------|
| F4.X.04 | `creation_sessions.team_id` → 创作会话关联团队 | 已完成 |
| F4.X.05 | `content_versions.task_id` → 内容版本关联任务 | 已完成 |
| F4.X.06 | `topic_angles.generated_by` → 热点选题角度由 AI 员工生成 | 已完成 |
| F4.X.07 | `tasks.assignee_id` → 任务分配给 AI 员工 | 已完成 |
| F4.X.08 | `articles` 表引用 teams/aiEmployees/tasks/workflowInstances | 已完成 |

### 8.3 与模块三（全渠道传播）

| 编号 | 集成点 | 实现状态 |
|------|--------|---------|
| F4.X.09 | `review_results.reviewer_employee_id` → 小审执行审核 | 已完成 |
| F4.X.10 | `publish_plans.task_id` → 发布计划关联任务 | 已完成 |
| F4.X.11 | 小数通过 Inngest cron 自动生成周报推送到团队消息 | 已完成 |
| F4.X.12 | `publishing/review-completed`、`publishing/plan-status-changed` Inngest 事件 | 已定义 |

---

## 九、子模块 4.2：可视化团队编排（Q4 规划）

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.2.01 | 拖拽式工作流画布 | 基于 React Flow，AI 员工节点可视化拖拽 | 待实现 |
| F4.2.02 | 条件分支节点 | 基于热度分级/内容类型/敏感度走不同分支 | 待实现 |
| F4.2.03 | 并行处理节点 | 多员工并行执行无依赖步骤 | 待实现 |
| F4.2.04 | 人机交互节点 | 流程中插入人工审批/编辑检查点 | 待实现 |
| F4.2.05 | 流程模板保存 | 画布编排结果保存为 `workflow_templates` | 待实现 |
| F4.2.06 | 流程执行监控 | 实时可视化运行中工作流的节点状态 | 待实现 |
| F4.2.07 | 节点配置面板 | 每节点可配置超时、重试、输入输出映射 | 待实现 |
| F4.2.08 | 流程验证 | 保存前校验合法性（无环、有起止、连接完整） | 待实现 |
| F4.2.09 | 流程版本对比 | 对比模板不同版本差异 | 待实现 |

> 预计路由：`/workflow-editor`
> 技术依赖：React Flow + `workflow_templates` 表
> 数据模型：扩展 `steps` JSONB 支持 `conditional`/`parallel`/`approval` 节点类型

---

## 十、子模块 4.3：自学习进化基座（Q4 规划）

### 10.1 行为数据采集

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.3.01 | 执行记录沉淀 | 记录每次 Agent 执行的输入/输出/token/耗时 | 待实现 |
| F4.3.02 | 用户反馈采集 | 记录用户对 AI 输出的采纳/拒绝/修改行为 | 待实现 |
| F4.3.03 | 审批行为记录 | 通过率、驳回原因、反馈内容 | 待实现 |
| F4.3.04 | 效果关联 | 发布传播数据关联回生产它的 AI 员工和工作流 | 待实现 |

### 10.2 模式发现与优化

| 编号 | 功能名称 | 说明 | 状态 |
|------|---------|------|------|
| F4.3.05 | 偏好模式发现 | 从历史数据中发现用户偏好（如「偏好民生选题」「喜欢短标题」） | 待实现 |
| F4.3.06 | 模式可视化 | 展示已学习模式列表和置信度 | 部分实现 |
| F4.3.07 | 人工纠偏 | 用户修正/删除 AI 学到的错误模式 | 待实现 |
| F4.3.08 | 能力自动优化 | 基于模式自动调整 Prompt 策略和推荐参数 | 待实现 |
| F4.3.09 | 进化曲线 | 员工能力随时间变化的趋势图 | 待实现 |
| F4.3.10 | A/B 测试 | 对比不同策略的 AI 输出效果 | 待实现 |

### 10.3 规划中的新表

| 表名 | 用途 |
|------|------|
| `execution_logs` | Agent 执行详情（输入/输出/token/耗时） |
| `learning_events` | 用户反馈行为记录 |
| `preference_models` | 用户偏好模型 |
| `evolution_snapshots` | 员工能力快照（进化曲线数据） |
| `ab_test_experiments` | A/B 测试实验记录 |

---

## 十一、Inngest 事件体系

### 已实现事件

| 事件名 | 用途 | 处理方 | 状态 |
|--------|------|--------|------|
| `workflow/started` | 启动工作流 | `executeWorkflow` | 已完成 |
| `workflow/step-approved` | 审批步骤 | `executeWorkflow` waitForEvent | 已完成 |
| `workflow/cancelled` | 取消工作流 | `executeWorkflow` cancelOn | 已完成 |
| `analytics/generate-report` | 生成周报 | `weeklyAnalyticsReport` | 已完成 |

### 已定义未处理事件

| 事件名 | 用途 | 状态 |
|--------|------|------|
| `publishing/review-completed` | 审核完成后触发发布 | 事件已定义，处理函数待注册 |
| `publishing/plan-status-changed` | 发布状态变更 | 同上 |
| `analytics/anomaly-detected` | 数据异常预警 | 同上 |

### 待新增事件

| 事件名 | 用途 |
|--------|------|
| `employee/status-changed` | 员工状态变更广播 |
| `workflow/step-retry` | 步骤重试 |
| `hotTopic/threshold-reached` | 热点达阈值，自动启动工作流 |
| `team/member-added` | 团队成员变更通知 |
| `knowledge/sync-completed` | 知识库同步完成 |

---

## 十二、实现差距总结

### 关键差距（直接影响核心体验）

| # | 差距 | 影响 |
|---|------|------|
| 1 | **工作流启动/审批 UI 缺失** | Server Actions 就绪但无前端触发入口 |
| 2 | **审批点固定为 review 步骤** | 无法灵活配置审批节点 |
| 3 | **3 个工具为模拟实现** | Agent 无法产出真实内容 |
| 4 | **工作偏好未注入 Prompt** | 偏好配置存而不用 |
| 5 | **敏感话题未传入 Agent** | 敏感话题过滤不生效 |
| 6 | **绩效不自动更新** | 工作流完成后绩效数据不变 |
| 7 | **知识库 RAG 未实现** | AI 员工无法利用知识库内容 |
| 8 | **员工状态不自动切换** | 执行时不自动切 working/idle |

### 增长空间（Q4 目标）

| # | 能力 | 说明 |
|---|------|------|
| 1 | 可视化工作流编排 | React Flow 拖拽画布 |
| 2 | 自学习进化 | 行为采集→模式发现→能力优化闭环 |
| 3 | 条件分支+并行执行 | 突破线性流程限制 |
| 4 | 协同模式 | 人机实时对话和并行编辑 |
| 5 | 驳回重做 | 审批闭环而非单向终止 |

### 技术债务

| # | 问题 | 代码位置 |
|---|------|---------|
| 1 | DAL 缺少 `organizationId` 过滤 | `getEmployees()` 等未按组织过滤 |
| 2 | Agent 执行不更新员工状态 | `execute-workflow.ts` |
| 3 | 无执行日志持久化 | Agent 执行详情未存表 |
| 4 | `escalation_policy` 字段闲置 | `teams` 表 |

---

## 十三、统计概览

| 维度 | 已完成 | 部分实现 | 待实现 |
|------|--------|---------|--------|
| 员工管理 (1.x) | 9 | 2 | 5 |
| 技能系统 (2.x) | 7 | 1 | 6 |
| 团队管理 (3.x) | 12 | 3 | 5 |
| 工作流引擎 (4.x) | 17 | 0 | 8 |
| Agent 基础设施 (5.x) | 12 | 0 | 8 |
| 消息协作 (6.x) | 8 | 0 | 4 |
| 自动化模式 (7.x) | 2 | 1 | 17 |
| 跨模块集成 (8.x) | 11 | 0 | 1 |
| 可视化编排 (9.x) | 0 | 0 | 9 |
| 自学习进化 (10.x) | 0 | 1 | 9 |
| **合计** | **78** | **8** | **72** |
