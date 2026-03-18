# 附录A：实现状态矩阵

> 本文档追踪所有页面路由的开发进度和 Mock 数据文件的退役计划。
> 状态说明：✅ 已完成 | 🔧 部分完成 | ❌ 未开始

---

## 1. 页面实现状态总表

| # | 路由 | 模块 | DB Schema | DAL | Server Action | UI | Mock 数据文件 | 状态 |
|---|------|------|-----------|-----|---------------|-----|-------------|------|
| 1 | `/team-hub` | 4.1 | ✅ | ✅ | ✅ | ✅ | — | ✅ 已完成 |
| 2 | `/team-builder` | 4.1 | ✅ | ✅ | ✅ | ✅ | — | ✅ 已完成 |
| 3 | `/team-builder/[id]` | 4.1 | ✅ | ✅ | ✅ | ✅ | — | ✅ 已完成 |
| 4 | `/employee/[id]` | 4.1 | ✅ | ✅ | ✅ | ✅ | — | ✅ 已完成 |
| 5 | `/employee-marketplace` | 4.1 | ✅ | ✅ | ✅ | ✅ | — | ✅ 已完成 |
| 6 | `/inspiration` | 2.3 | ❌ | ❌ | ❌ | ✅ | `inspiration-data.ts` | Mock |
| 7 | `/hot-topics` | 2.3 | ❌ | ❌ | ❌ | ✅ | `hot-topics.ts` | Mock |
| 8 | `/super-creation` | 2.1 | ❌ | ❌ | ❌ | ✅ | `super-creation-data.ts` | Mock |
| 9 | `/premium-content` | 2.1 | ❌ | ❌ | ❌ | ✅ | `premium-content-data.ts` | Mock |
| 10 | `/creation` | 2.1 | ❌ | ❌ | ❌ | ✅ | `creation-tasks.ts` | Mock |
| 11 | `/benchmarking` | 2.2 | ❌ | ❌ | ❌ | ✅ | `benchmarking-data.ts` | Mock |
| 12 | `/competitive` | 2.2 | ❌ | ❌ | ❌ | ✅ | `competitive-data.ts` | Mock |
| 13 | `/asset-intelligence` | 1.1 | ❌ | ❌ | ❌ | ✅ | `asset-intelligence-data.ts` | Mock |
| 14 | `/channel-advisor` | 1.2 | ❌ | ❌ | ❌ | ✅ | `channel-advisors.ts` | Mock |
| 15 | `/channel-advisor/create` | 1.2 | ❌ | ❌ | ❌ | ✅ | — | Mock |
| 16 | `/channel-knowledge` | 1.2 | ❌ | ❌ | ❌ | ✅ | `channel-knowledge-data.ts` | Mock |
| 17 | `/asset-revive` | 1.3 | ❌ | ❌ | ❌ | ✅ | `asset-revive-data.ts` | Mock |
| 18 | `/publishing` | 3.1 | ❌ | ❌ | ❌ | ✅ | `channels.ts` | Mock |
| 19 | `/analytics` | 3.1 | ❌ | ❌ | ❌ | ✅ | `analytics-data.ts` | Mock |
| 20 | `/video-batch` | 2.4 | ❌ | ❌ | ❌ | ✅ | `video-batch-data.ts` | Mock |
| 21 | `/event-auto` | 2.5 | ❌ | ❌ | ❌ | ✅ | `event-auto-data.ts` | Mock |

### 统计

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 已完成（DB 连接） | 5 | 24% |
| Mock（UI 已有，数据源为 Mock） | 16 | 76% |
| 未开始（无路由） | — | — |

### 待新建路由（无现有页面）

| 预计路由 | 模块 | 优先级 | 说明 |
|----------|------|--------|------|
| `/workflow-editor` | 4.2 | P2/Q4 | 可视化拖拽式工作流画布 |
| `/learning-dashboard` | 4.3 | P2/Q4 | 自学习进化可视化看板 |
| `/content-excellence` | 3.3 | P1/Q4 | 精品率看板与爆品预测 |
| `/case-library` | 3.3 | P1/Q4 | 优秀案例库 |
| C 端旗舰 APP | 3.2 | P1/Q3 | 独立移动端项目 |

---

## 2. Mock 数据文件退役追踪表

所有 Mock 数据文件位于 `src/data/` 目录下。

| # | 文件名 | 模块 | 主要导出类型 | 替代 DAL 函数 | 退役阶段 | 状态 |
|---|--------|------|------------|-------------|----------|------|
| 1 | `employees.ts` | 4.1 | `AIEmployee[]` | `dal/employees.getEmployees()` | Q1 | ✅ 已退役 |
| 2 | `teams.ts` | 4.1 | `Team[]`, `teamScenarios` | `dal/teams.getTeams()` | Q1 | ✅ 已退役 |
| 3 | `workflows.ts` | 4.1 | `WorkflowInstance[]` | `dal/workflows.getWorkflows()` | Q1 | ✅ 已退役 |
| 4 | `messages.ts` | 4.1 | `TeamMessage[]` | `dal/messages.getTeamMessages()` | Q1 | ✅ 已退役 |
| 5 | `hot-topics.ts` | 2.3 | `HotTopic[]` | 需新建 `dal/hot-topics.ts` | Q1 | ❌ 待退役 |
| 6 | `inspiration-data.ts` | 2.3 | `InspirationTopic[]` | 需新建 `dal/inspiration.ts` | Q1 | ❌ 待退役 |
| 7 | `creation-tasks.ts` | 2.1 | `CreationTask[]` | 需新建 `dal/creation.ts` | Q2 | ❌ 待退役 |
| 8 | `super-creation-data.ts` | 2.1 | `SuperCreationTask[]`, `CreationGoal[]` | 需新建 `dal/creation.ts` | Q2 | ❌ 待退役 |
| 9 | `premium-content-data.ts` | 2.1 | `PipelineNode[]`, `HitTemplate[]` | 需新建 `dal/creation.ts` | Q2 | ❌ 待退役 |
| 10 | `benchmarking-data.ts` | 2.2 | `BenchmarkTopic[]`, `MissedTopic[]` | 需新建 `dal/benchmarking.ts` | Q2 | ❌ 待退役 |
| 11 | `competitive-data.ts` | 2.2 | `Competitor[]` | 需新建 `dal/competitors.ts` | Q2 | ❌ 待退役 |
| 12 | `channel-advisors.ts` | 1.2 | `ChannelAdvisor[]` | 需新建 `dal/channel-advisors.ts` | Q2 | ❌ 待退役 |
| 13 | `channel-knowledge-data.ts` | 1.2 | `KnowledgeSource[]`, `KnowledgeItem[]` | 需扩展 `dal/knowledge-bases.ts` | Q2 | ❌ 待退役 |
| 14 | `asset-intelligence-data.ts` | 1.1 | `IntelligentAsset[]`, `knowledgeGraph` | 需新建 `dal/assets.ts` | Q1-Q2 | ❌ 待退役 |
| 15 | `asset-revive-data.ts` | 1.3 | `ReviveRecommendation[]`, `ReviveMetrics` | 需新建 `dal/asset-revive.ts` | Q2 | ❌ 待退役 |
| 16 | `channels.ts` | 3.1 | `ChannelConfig[]`, `PublishPlan[]` | 需新建 `dal/channels.ts` | Q3 | ❌ 待退役 |
| 17 | `analytics-data.ts` | 3.1 | `ChannelMetrics[]` | 需新建 `dal/analytics.ts` | Q3 | ❌ 待退役 |
| 18 | `video-batch-data.ts` | 2.4 | `BatchTopic[]`, `ConversionTask[]` | 需新建 `dal/video-batch.ts` | Q3 | ❌ 待退役 |
| 19 | `event-auto-data.ts` | 2.5 | `SportEvent[]` | 需新建 `dal/events.ts` | Q3 | ❌ 待退役 |

### 退役统计

| 阶段 | 文件数 | 说明 |
|------|--------|------|
| ✅ 已退役（Q1 已完成） | 4 | 模块 4.1 的 employees/teams/workflows/messages |
| Q1 待退役 | 2 | 模块 2.3 的 hot-topics/inspiration |
| Q2 待退役 | 7 | 模块 1.1-1.3 + 2.1 + 2.2 |
| Q3 待退役 | 6 | 模块 2.4 + 2.5 + 3.1 |
| **合计** | **19** | |

---

## 3. DAL 文件现状

### 已有 DAL 文件（`src/lib/dal/`）

| 文件 | 导出函数 | 服务模块 |
|------|---------|----------|
| `auth.ts` | `getCurrentUserOrg()` | 跨模块 |
| `employees.ts` | `getEmployees()`, `getEmployee(slug)`, `getEmployeeFullProfile(slug)` | 4.1 |
| `teams.ts` | `getTeams()`, `getTeam(id)`, `getTeamWithMembers(teamId)`, `getWorkflowTemplates()` | 4.1 |
| `skills.ts` | `getSkills(category?)`, `getSkillsNotBoundToEmployee(employeeId)` | 4.1 |
| `knowledge-bases.ts` | `getKnowledgeBases()`, `getEmployeeKnowledgeBases(employeeId)` | 4.1 |
| `workflows.ts` | `getWorkflows()`, `getWorkflow(id)` | 4.1 |
| `messages.ts` | `getTeamMessages(teamId?)` | 4.1 |

### 需新建 DAL 文件

| 文件 | 预计函数 | 服务模块 | 优先级 |
|------|---------|----------|--------|
| `hot-topics.ts` | `getHotTopics()`, `getHotTopic(id)` | 2.3 | Q1 |
| `inspiration.ts` | `getInspirationTopics()` | 2.3 | Q1 |
| `assets.ts` | `getAssets()`, `getAssetSegments(id)`, `semanticSearch(query)` | 1.1 | Q1-Q2 |
| `channel-advisors.ts` | `getChannelAdvisors()`, `getChannelAdvisor(id)` | 1.2 | Q2 |
| `asset-revive.ts` | `getReviveRecommendations()`, `getReviveMetrics()` | 1.3 | Q2 |
| `creation.ts` | `getCreationTasks()`, `getCreationSession(id)` | 2.1 | Q2 |
| `benchmarking.ts` | `getBenchmarkTopics()`, `getMissedTopics()` | 2.2 | Q2 |
| `competitors.ts` | `getCompetitors()` | 2.2 | Q2 |
| `channels.ts` | `getChannels()`, `getPublishPlans()` | 3.1 | Q3 |
| `analytics.ts` | `getChannelMetrics(channelId, dateRange)` | 3.1 | Q3 |
| `video-batch.ts` | `getBatchTopics()`, `getConversionTasks()` | 2.4 | Q3 |
| `events.ts` | `getSportEvents()`, `getEventClips(eventId)` | 2.5 | Q3 |

---

## 4. Server Action 文件现状

### 已有 Server Action 文件（`src/app/actions/`）

| 文件 | 导出函数数 | 服务模块 |
|------|-----------|----------|
| `auth.ts` | 3（signIn, signUp, signOut） | 跨模块 |
| `employees.ts` | 11（CRUD + 配置变更） | 4.1 |
| `teams.ts` | 6（CRUD + 规则更新） | 4.1 |
| `workflows.ts` | 2（创建实例 + 更新步骤） | 4.1 |
| `messages.ts` | 1（发送消息） | 4.1 |

### 需新建 Server Action 文件

| 文件 | 预计函数 | 服务模块 | 优先级 |
|------|---------|----------|--------|
| `hot-topics.ts` | `createHotTopic`, `updateTopicPriority`, `dismissTopic` | 2.3 | Q1 |
| `assets.ts` | `triggerUnderstanding`, `correctTag`, `semanticSearch` | 1.1 | Q1-Q2 |
| `channel-advisors.ts` | `createAdvisor`, `updateAdvisorConfig`, `toggleAdvisorStatus` | 1.2 | Q2 |
| `creation.ts` | `startCreationSession`, `updateDraft`, `submitForReview` | 2.1 | Q2 |
| `publishing.ts` | `adaptContent`, `schedulePub`, `executePub` | 3.1 | Q3 |
| `reviews.ts` | `autoReview`, `humanOverride` | 3.1 | Q3 |
| `analytics.ts` | `generateReport`, `configureAlerts` | 3.1 | Q3 |

---

## 5. 数据库表现状

### 已有表（14 个）

| 表名 | Schema 文件 | 服务模块 | 说明 |
|------|------------|----------|------|
| `organizations` | `schema/users.ts` | 跨模块 | 多租户根表 |
| `user_profiles` | `schema/users.ts` | 跨模块 | 用户档案 |
| `ai_employees` | `schema/ai-employees.ts` | 4.1 | AI 员工 |
| `skills` | `schema/skills.ts` | 4.1 | 技能定义 |
| `employee_skills` | `schema/skills.ts` | 4.1 | 员工-技能绑定 |
| `teams` | `schema/teams.ts` | 4.1 | 团队配置 |
| `team_members` | `schema/teams.ts` | 4.1 | 团队成员 |
| `workflow_templates` | `schema/workflows.ts` | 4.1 | 工作流模板 |
| `workflow_instances` | `schema/workflows.ts` | 4.1 | 工作流实例 |
| `workflow_steps` | `schema/workflows.ts` | 4.1 | 工作流步骤 |
| `team_messages` | `schema/messages.ts` | 4.1 | 团队消息 |
| `tasks` | `schema/tasks.ts` | 4.1 | 创作任务 |
| `knowledge_bases` | `schema/knowledge-bases.ts` | 4.1 | 知识库 |
| `employee_knowledge_bases` | `schema/knowledge-bases.ts` | 4.1 | 员工-知识库绑定 |

### 需新增表（预估）

| 表名 | 服务模块 | 优先级 | 说明 |
|------|----------|--------|------|
| `hot_topics` | 2.3 | Q1 | 热点记录 |
| `topic_angles` | 2.3 | Q1 | 选题角度 |
| `assets` | 1.1 | Q1-Q2 | 媒资基本信息 |
| `asset_segments` | 1.1 | Q1-Q2 | 视频片段 |
| `asset_tags` | 1.1 | Q1-Q2 | 资产标签 |
| `knowledge_nodes` | 1.1 | Q2 | 知识图谱节点 |
| `knowledge_relations` | 1.1 | Q2 | 知识图谱关系 |
| `channel_advisors` | 1.2 | Q2 | 频道顾问实例 |
| `creation_sessions` | 2.1 | Q2 | 创作会话 |
| `content_versions` | 2.1 | Q2 | 内容版本历史 |
| `competitor_accounts` | 2.2 | Q2 | 竞品账号 |
| `channels` | 3.1 | Q3 | 渠道配置 |
| `publish_plans` | 3.1 | Q3 | 发布计划 |
| `channel_metrics` | 3.1 | Q3 | 渠道指标 |
| `review_results` | 3.1 | Q3 | 审核结果 |
| `case_library` | 3.3 | Q4 | 优秀案例库 |
| `hit_predictions` | 3.3 | Q4 | 爆品预测记录 |
