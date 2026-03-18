# 全量未实现功能并行实现设计

> 日期：2026-03-08
> 策略：8 个独立 Agent 并行工作流，每个 Agent 负责一组相关功能的全栈实现

## 背景

基于 `system-function-list.md` 分析，系统共 272 项功能，已实现 174 项（76%），部分实现 32 项，未实现 66 项。排除需要外部 API/硬件（6项）和 C 端独立项目（5项），约 35 项功能可在代码层面实现。

## 实现方案

采用 **模块分组并行** 策略：8 个 Agent 各自负责一组相关功能的全栈实现（schema → DAL → action → UI），工作流之间无文件冲突。

## 冲突规避策略

- 每个 Agent 创建自己的 schema/DAL/action 文件，不修改其他 Agent 的文件
- 共享文件（如 `schema/index.ts`, `schema/enums.ts`）由各 Agent 独立追加，最后统一合并
- 每个 Agent 完成后独立做 `tsc --noEmit` 类型检查

---

## Agent 1: 通知与消息增强

### 功能清单

| 编号 | 功能 | 描述 |
|------|------|------|
| M4.F126 | 浏览器通知 | alert/decision_request 消息触发浏览器 Notification API 推送 |
| M4.F127 | 未读计数 | Topbar 通知铃铛显示未读消息数量 badge |
| M4.F128 | 已读标记 | 查看消息后自动标记已读，支持批量标记 |
| M4.F129 | @提及 | 输入框支持 @employee_name 提及，被提及者收到通知 |

### 技术方案

**Schema:**
- 新建 `src/db/schema/message-reads.ts`：`message_reads` 表（userId, messageId, readAt）
- 在 `team_messages` 现有 schema 中添加 `mentions` jsonb 字段（如需）

**DAL:**
- 新建 `src/lib/dal/notifications.ts`
  - `getUnreadCount(userId, teamId?)` — 未读消息计数
  - `getUnreadMessages(userId, teamId?)` — 未读消息列表
  - `markAsRead(userId, messageId)` — 标记已读
  - `markAllAsRead(userId, teamId)` — 批量标记已读

**Actions:**
- 新建 `src/app/actions/notifications.ts`
  - `markMessageRead(messageId)` — 标记单条已读
  - `markAllMessagesRead(teamId)` — 批量已读
  - `requestNotificationPermission()` — 客户端通知权限

**UI:**
- 修改 `src/components/layout/topbar.tsx` — 通知铃铛增加 badge 计数
- 修改 `src/components/shared/message-bubble.tsx` — 已读状态指示器
- 修改 `src/components/shared/employee-input-bar.tsx` — @提及自动完成
- 新建客户端通知 hook: `src/lib/hooks/use-notifications.ts`

---

## Agent 2: 审批看板 + 模板系统

### 功能清单

| 编号 | 功能 | 描述 |
|------|------|------|
| M4.F94 | 审批看板 | 集中展示所有待审批工作流步骤的统一视图 |
| M4.F22 | 偏好模板 | 预设工作偏好模板（高自治/严格审批/平衡模式等） |
| M4.F135 | 全自动场景模板 | 快讯自动推送/赛事速报/每日新闻简报等预设自动化场景 |

### 技术方案

**Schema:** 无需新表，使用现有 `workflow_steps`（status=waiting_approval）和 `ai_employees.workPreferences`

**DAL:**
- 新建 `src/lib/dal/approvals.ts`
  - `getPendingApprovals(orgId)` — 查询所有待审批步骤
  - `getApprovalStats(orgId)` — 审批统计（待审/已审/超时）
  - `getApprovalHistory(orgId, limit)` — 审批历史

**Actions:**
- 新建 `src/app/actions/approvals.ts`
  - `applyWorkPreferenceTemplate(employeeId, templateKey)` — 应用偏好模板

**UI:**
- 新建 `src/app/(dashboard)/approvals/page.tsx` + `approvals-client.tsx` — 审批看板页面
- 修改 `src/lib/constants.ts` — 添加 `WORK_PREFERENCE_TEMPLATES` 和 `AUTO_SCENARIO_TEMPLATES`

**常量定义:**
```typescript
WORK_PREFERENCE_TEMPLATES = {
  high_autonomy: { initiative: 'proactive', reportFrequency: 'daily', autonomyLevel: 90, ... },
  strict_approval: { initiative: 'conservative', reportFrequency: 'real-time', autonomyLevel: 20, ... },
  balanced: { initiative: 'balanced', reportFrequency: '4-hourly', autonomyLevel: 50, ... },
}

AUTO_SCENARIO_TEMPLATES = {
  breaking_news_auto: { name: '快讯自动推送', steps: ['monitor','create','review','publish'], approvalRequired: false, ... },
  event_express: { name: '赛事速报', steps: ['monitor','create','produce','publish'], approvalRequired: false, ... },
  daily_briefing: { name: '每日新闻简报', steps: ['monitor','plan','create','review','publish'], cron: '0 6 * * *', ... },
}
```

---

## Agent 3: 绩效可视化与报告

### 功能清单

| 编号 | 功能 | 描述 |
|------|------|------|
| M4.F26 | 绩效趋势图 | 时间序列展示员工绩效变化（任务完成/准确率/响应时间/满意度） |
| M4.F27 | 团队绩效对比 | 雷达图/柱状图对比不同 AI 员工效率 |
| M4.F65 | 团队效率报告 | 团队级综合效率分析（产出量/质量分/响应速度/协作效率） |

### 技术方案

**Schema:**
- 新建 `src/db/schema/performance-snapshots.ts`
  - `performance_snapshots` 表：employeeId, date, tasksCompleted, accuracy, avgResponseTime, satisfaction, qualityAvg

**DAL:**
- 新建 `src/lib/dal/performance.ts`
  - `getPerformanceTrend(employeeId, days)` — 员工绩效趋势数据
  - `getTeamPerformanceComparison(teamId)` — 团队成员绩效对比
  - `getTeamEfficiencyReport(teamId)` — 团队效率报告
  - `snapshotPerformance(employeeId)` — 记录当日绩效快照

**UI:**
- 新建 `src/app/(dashboard)/employee/[id]/performance-charts.tsx` — 趋势图+雷达图组件
- 新建 `src/app/(dashboard)/team-builder/[id]/team-report.tsx` — 团队效率报告组件
- 使用 Recharts area chart + radar chart

---

## Agent 4: 自学习进化系统

### 功能清单

| 编号 | 功能 | 描述 |
|------|------|------|
| M4.F144 | 用户反馈收集 | 记录用户对 AI 输出的采纳/拒绝/编辑行为 |
| M4.F146 | 效果关联 | 发布数据回链到 AI 员工和工作流实例 |
| M4.F148 | 模式可视化 | 列出已学习模式（learnedPatterns）和置信度 |
| M4.F149 | 人工纠正 | 用户可删除错误学习模式 |
| M4.F150 | 自动能力优化 | 基于高频模式自动调整 Prompt 策略 |
| M4.F151 | 进化曲线 | 员工能力趋势时间线 |

### 技术方案

**Schema:**
- 新建 `src/db/schema/user-feedback.ts`
  - `user_feedback` 表：userId, workflowInstanceId, stepKey, feedbackType(accept/reject/edit), originalContent, editedContent, createdAt
  - `effect_attributions` 表：publishPlanId, workflowInstanceId, employeeId, reach, engagement, qualityScore

**DAL:**
- 新建 `src/lib/dal/evolution.ts`
  - `getUserFeedback(employeeId)` — 获取反馈记录
  - `getLearnedPatterns(employeeId)` — 获取已学习模式列表
  - `getEffectAttributions(employeeId)` — 获取效果关联数据
  - `getEvolutionCurve(employeeId, days)` — 获取进化曲线数据

**Actions:**
- 新建 `src/app/actions/evolution.ts`
  - `submitFeedback(stepId, type, editedContent?)` — 提交反馈
  - `deleteLearnedPattern(employeeId, patternKey)` — 删除错误模式
  - `attributeEffect(publishPlanId, workflowInstanceId)` — 关联发布效果

**UI:**
- 新建 `src/app/(dashboard)/employee/[id]/evolution-tab.tsx` — 进化 Tab（模式列表+进化曲线+反馈统计）

---

## Agent 5: 员工+技能高级管理

### 功能清单

| 编号 | 功能 | 描述 |
|------|------|------|
| M4.F09 | 员工版本历史 | 配置变更记录+回滚 |
| M4.F19 | 动态权限调整 | 基于绩效和信任度自动升降级 |
| M4.F32 | 技能在线测试 | 选择技能→输入参数→查看执行结果 |
| M4.F41 | 技能组合 (Combo) | 多技能串联为复合技能 |

### 技术方案

**Schema:**
- 新建 `src/db/schema/employee-versions.ts`
  - `employee_config_versions` 表：employeeId, version, snapshot(jsonb), changedBy, changedFields, createdAt
  - `skill_combos` 表：name, description, skillIds(jsonb), orgId

**DAL:**
- 新建 `src/lib/dal/employee-advanced.ts`
  - `getConfigVersions(employeeId)` — 获取版本历史
  - `getConfigVersion(versionId)` — 获取特定版本快照
  - `getSkillCombos(orgId)` — 获取技能组合列表

**Actions:**
- 新建 `src/app/actions/employee-advanced.ts`
  - `rollbackEmployeeConfig(employeeId, versionId)` — 回滚到指定版本
  - `adjustAuthorityByPerformance(employeeId)` — 基于绩效调整权限
  - `testSkill(skillId, input)` — 技能在线测试
  - `createSkillCombo(name, skillIds)` — 创建技能组合
  - `deleteSkillCombo(comboId)` — 删除技能组合

**自动版本记录:** 在现有 `updateEmployeeProfile`, `updateWorkPreferences` 等 action 中追加版本快照逻辑

---

## Agent 6: M2 智创生产增强

### 功能清单

| 编号 | 功能 | 描述 |
|------|------|------|
| M2.F11 | 实时合规检查 | 创作时实时检测敏感内容 |
| M2.F18 | 改进建议追踪 | 追踪竞品改进建议采纳后效果变化 |
| M2.F19 | 竞品动态预警 | 竞品异常时主动推送团队消息 |
| M2.F29 | 趋势预测 | 基于历史热度模型预测热点生命周期 |
| M2.F33 | 批量审核看板 | 统一审核界面，支持批量通过/驳回 |
| M2.F35 | 模板化生产 | 高频内容设定生产模板 |

### 技术方案

**Schema:**
- 新建 `src/db/schema/compliance.ts` — `compliance_checks` 表
- 新建 `src/db/schema/production-templates.ts` — `production_templates` 表
- 修改 `src/db/schema/benchmarking.ts` — `improvement_trackings` 表追加 effectData 字段

**DAL:**
- 新建 `src/lib/dal/compliance.ts`
- 新建 `src/lib/dal/production-templates.ts`
- 修改 `src/lib/dal/benchmarking.ts` — 追加改进追踪和趋势预测查询

**Actions:**
- 新建 `src/app/actions/compliance.ts`
- 新建 `src/app/actions/production-templates.ts`
- 修改 `src/app/actions/benchmarking.ts` — 追加预警和追踪 action

**UI:**
- 新建 `src/app/(dashboard)/batch-review/` — 批量审核看板页面
- 新建 `src/app/(dashboard)/production-templates/` — 模板管理页面
- 修改 `src/app/(dashboard)/super-creation/` — 实时合规检查面板

**Inngest:**
- 新建竞品预警 cron 函数
- 新建趋势预测计算函数

---

## Agent 7: M3 全渠道传播增强

### 功能清单

| 编号 | 功能 | 描述 |
|------|------|------|
| M3.F02 | 适配版本预览 | 并排预览所有渠道适配版本 |
| M3.F03 | 智能发布时间推荐 | 基于历史数据推荐最佳发布时间 |
| M3.F06 | 发布日历 | 日历视图展示发布排期 |
| M3.F29 | 效果激励看板 | 编辑个人积分排行榜 |

### 技术方案

**Schema:**
- 新建 `src/db/schema/editor-scores.ts` — `editor_scores` 表（userId, points, level, achievements）

**DAL:**
- 新建 `src/lib/dal/publish-calendar.ts`
  - `getPublishCalendar(orgId, month)` — 按月获取发布计划日历数据
  - `getOptimalPublishTimes(channelId)` — 基于历史 metrics 推荐发布时间
- 新建 `src/lib/dal/editor-scores.ts`
  - `getEditorLeaderboard(orgId)` — 编辑积分排行榜

**Actions:**
- 新建 `src/app/actions/publish-calendar.ts`

**UI:**
- 新建 `src/app/(dashboard)/publishing/channel-preview.tsx` — 多渠道并排预览组件
- 新建 `src/app/(dashboard)/publishing/publish-calendar.tsx` — 日历视图组件
- 新建 `src/app/(dashboard)/leaderboard/` — 效果激励看板页面

---

## Agent 8: M1 AI资产重构补全

### 功能清单

| 编号 | 功能 | 描述 |
|------|------|------|
| M1.F05 | 小资对话检索 | 通过与小资 AI 对话完成资产搜索 |
| M1.F08 | 标注体系配置 | 管理员自定义扩展标注维度 |
| M1.F22 | 多顾问对比测试 | 对比不同顾问对同一输入的输出 |
| M1.F24 | A/B 测试 | 对比不同顾问配置效果 |

### 技术方案

**Schema:**
- 新建 `src/db/schema/tag-schemas.ts` — `tag_schemas` 表（自定义标注维度配置）
- 新建 `src/db/schema/advisor-tests.ts` — `advisor_ab_tests` 表（A/B 测试记录）

**DAL:**
- 新建 `src/lib/dal/tag-schemas.ts`
- 新建 `src/lib/dal/advisor-tests.ts`

**Actions:**
- 新建 `src/app/actions/tag-schemas.ts`
- 新建 `src/app/actions/advisor-tests.ts`

**UI:**
- 新建 `src/app/(dashboard)/asset-intelligence/asset-chat.tsx` — 小资对话检索界面
- 新建 `src/app/(dashboard)/asset-intelligence/tag-config.tsx` — 标注体系配置
- 新建 `src/app/(dashboard)/channel-advisor/compare/` — 多顾问对比页面
- 新建 `src/app/(dashboard)/channel-advisor/ab-test/` — A/B 测试页面

---

## 实现顺序

所有 8 个 Agent 并行启动，每个 Agent 内部按以下顺序实现：
1. Schema 定义 + enum 追加
2. DAL 查询函数
3. Server Actions
4. UI 组件和页面
5. `tsc --noEmit` 类型检查

## 验证策略

- 每个 Agent 完成后独立 `tsc --noEmit`
- 全部 Agent 完成后执行 `npm run build` 验证
- 检查 schema/index.ts 和 enums.ts 的合并
