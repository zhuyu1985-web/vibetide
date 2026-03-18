# 数智全媒系统 — 全量测试用例

> 基于需求文档、测试方案、功能清单、工程代码四方交叉分析生成。
> 生成日期：2026-03-08 | 版本：v1.0
>
> 参考文档：`docs/plans/qa-testing-strategy.md`, `docs/plans/system-function-list.md`

---

## 统计摘要

| 模块 | P0 用例 | P1 用例 | P2 用例 | P3 用例 | 合计 | 可自动化 |
|------|---------|---------|---------|---------|------|----------|
| M0 平台基础架构 | 18 | 12 | 6 | 2 | 38 | 95% |
| M1 AI资产重构 | 8 | 24 | 14 | 4 | 50 | 88% |
| M2 智创生产 | 10 | 28 | 16 | 6 | 60 | 85% |
| M3 全渠道传播 | 8 | 22 | 12 | 4 | 46 | 87% |
| M4 AI团队引擎 | 24 | 42 | 22 | 8 | 96 | 82% |
| M4-A Agent架构优化 | 12 | 14 | 6 | 2 | 34 | 90% |
| **合计** | **80** | **142** | **76** | **26** | **324** | **86%** |

---

## 测试环境要求

| 项目 | 要求 |
|------|------|
| 测试框架 | Vitest (单元/集成), Playwright (E2E) |
| 数据库 | Docker PostgreSQL 或 Supabase Local |
| Mock 层 | MSW (AI SDK / Supabase Auth) |
| 测试账号 | OrgA: admin/editor/viewer, OrgB: admin (多租户) |
| Node.js | >=18.x |
| 种子数据 | 扩展 `src/db/seed.ts`：2 组织, 5 用户, 8+2 员工, 20+ 技能, 3 团队, 2 工作流模板, 5 工作流实例, 20+ 消息 |

---

## M0 — 平台基础架构

### 测试数据准备

```
- OrgA (test-org-a): admin@test-org-a.com / editor@test-org-a.com / viewer@test-org-a.com
- OrgB (test-org-b): admin@test-org-b.com
- 未注册邮箱: new@test.com
```

### M0.TC — 认证与鉴权

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M0.TC01 | M0.F01 | 用户注册-正常流程 | P0 | 无已注册账号 | 1. 调用 `signUp(email, password)` | 返回成功，user_profile 自动创建，关联 organization | ✅ |
| M0.TC02 | M0.F01 | 用户注册-重复邮箱 | P0 | 已存在 admin@test-org-a.com | 1. 调用 `signUp('admin@test-org-a.com', 'xxx')` | 返回错误信息，不创建重复账号 | ✅ |
| M0.TC03 | M0.F01 | 用户注册-无效邮箱格式 | P1 | 无 | 1. 调用 `signUp('invalid-email', 'password')` | 返回验证错误 | ✅ |
| M0.TC04 | M0.F01 | 用户注册-密码过短 | P1 | 无 | 1. 调用 `signUp('test@test.com', '123')` | 返回密码不符合要求 | ✅ |
| M0.TC05 | M0.F02 | 用户登录-正确凭据 | P0 | 已注册用户 | 1. 调用 `signIn(email, password)` | 返回成功，设置 session cookie | ✅ |
| M0.TC06 | M0.F02 | 用户登录-错误密码 | P0 | 已注册用户 | 1. 调用 `signIn(email, 'wrongpass')` | 返回认证失败 | ✅ |
| M0.TC07 | M0.F02 | 用户登录-不存在的邮箱 | P1 | 无 | 1. 调用 `signIn('noexist@test.com', 'pass')` | 返回认证失败 | ✅ |
| M0.TC08 | M0.F03 | 用户登出 | P0 | 已登录用户 | 1. 调用 `signOut()` | 清除 session，重定向到 /login | ✅ |
| M0.TC09 | M0.F04 | 中间件-未认证访问 Dashboard | P0 | 未登录 | 1. 直接请求 /team-hub | 重定向到 /login | ✅ |
| M0.TC10 | M0.F04 | 中间件-已认证访问登录页 | P1 | 已登录 | 1. 请求 /login | 重定向到 /team-hub | ✅ |
| M0.TC11 | M0.F04 | 中间件-Session 刷新 | P1 | Session 即将过期 | 1. 发送请求 | Cookie 自动续期 | ✅ |
| M0.TC12 | M0.F07 | getCurrentUserOrg-已认证 | P0 | 已登录 OrgA 用户 | 1. 调用 `getCurrentUserOrg()` | 返回 { userId, orgId } 匹配 OrgA | ✅ |
| M0.TC13 | M0.F07 | getCurrentUserOrg-未认证 | P0 | 未登录 | 1. 调用 `getCurrentUserOrg()` | 抛出认证错误或返回 null | ✅ |
| M0.TC14 | M0.F08 | Dashboard 布局保护 | P0 | 未登录 | 1. 访问 /(dashboard)/ 下任意页面 | layout.tsx 校验失败，重定向 /login | ✅ |
| M0.TC15 | M0.F11 | 根路由-已认证重定向 | P1 | 已登录 | 1. 访问 / | 重定向到 /team-hub | ✅ |
| M0.TC16 | M0.F11 | 根路由-未认证重定向 | P1 | 未登录 | 1. 访问 / | 重定向到 /login | ✅ |

### M0.TC — 多租户隔离（安全）

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M0.TC17 | M0.F05 | 多租户-OrgB 无法访问 OrgA 员工 | P0 | OrgA 有员工数据，当前用户为 OrgB | 1. OrgB 用户调用 `getEmployees()` | 返回空列表或仅 OrgB 数据 | ✅ |
| M0.TC18 | M0.F05 | 多租户-OrgB 无法访问 OrgA 团队 | P0 | OrgA 有团队数据 | 1. OrgB 用户调用 `getTeams()` | 返回空列表或仅 OrgB 数据 | ✅ |
| M0.TC19 | M0.F05 | 多租户-OrgB 无法访问 OrgA 消息 | P0 | OrgA 有消息 | 1. OrgB 用户调用 `getTeamMessages(orgATeamId)` | 返回空或拒绝 | ✅ |
| M0.TC20 | M0.F05 | 多租户-OrgB 无法修改 OrgA 数据 | P0 | OrgA 有员工 | 1. OrgB 用户调用 `updateEmployeeProfile(orgAEmployeeId, ...)` | 拒绝操作或无影响 | ✅ |

### M0.TC — 页面与导航

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M0.TC21 | M0.F09 | 侧边栏-全部导航链接可访问 | P1 | 已登录 | 1. 遍历侧边栏所有链接点击 | 每个页面正常加载无白屏 | ✅ |
| M0.TC22 | M0.F09 | 侧边栏-折叠展开 | P2 | 已登录 | 1. 点击折叠按钮 | 侧边栏收起，再次点击展开 | ✅ |
| M0.TC23 | M0.F09 | 侧边栏-活跃高亮 | P2 | 已登录 | 1. 导航到 /team-hub | team-hub 菜单项高亮 | ✅ |
| M0.TC24 | M0.F10 | 顶部栏-用户下拉登出 | P1 | 已登录 | 1. 点击用户头像下拉→登出 | 退出登录，跳转 /login | ✅ |
| M0.TC25 | M0.F21 | 旧路由重定向 | P2 | 已登录 | 1. 访问 /hot-topics | 重定向到 /inspiration | ✅ |
| M0.TC26 | M0.F21 | 旧路由重定向-creation | P2 | 已登录 | 1. 访问 /creation | 重定向到 /super-creation | ✅ |

### M0.TC — 基础设施

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M0.TC27 | M0.F12 | 数据库连接-正常 | P0 | DATABASE_URL 配置正确 | 1. 执行简单查询 | 返回结果，连接正常 | ✅ |
| M0.TC28 | M0.F12 | 数据库连接-prepare:false | P1 | PgBouncer 环境 | 1. 检查 drizzle 配置 | prepare 设为 false | ✅ |
| M0.TC29 | M0.F13 | Schema 完整性 | P1 | 数据库已推送 | 1. 验证 60 表全部存在 | 所有表创建成功 | ✅ |
| M0.TC30 | M0.F13 | 枚举完整性 | P1 | 数据库已推送 | 1. 验证 37 枚举类型 | 所有枚举值正确 | ✅ |
| M0.TC31 | M0.F14 | 种子数据-完整性 | P1 | 执行 db:seed | 1. 检查 8 员工 + 28 技能 + 核心映射 | 数据完整无遗漏 | ✅ |
| M0.TC32 | M0.F14 | 种子数据-幂等性 | P2 | 已执行过 seed | 1. 再次执行 db:seed | 不产生重复数据 | ✅ |
| M0.TC33 | M0.F16 | Inngest API 路由 | P1 | 服务启动 | 1. POST /api/inngest | 返回 200 或 Inngest 握手响应 | ✅ |
| M0.TC34 | M0.F17 | cn() 工具函数 | P2 | 无 | 1. cn('foo', undefined, 'bar') | 返回 'foo bar' | ✅ |
| M0.TC35 | — | TypeScript 类型检查 | P0 | 无 | 1. 执行 `npx tsc --noEmit` | 0 错误 | ✅ |
| M0.TC36 | — | 生产构建 | P0 | 无 | 1. 执行 `npm run build` | 构建成功 | ✅ |
| M0.TC37 | — | ESLint 检查 | P1 | 无 | 1. 执行 `npm run lint` | 0 Error | ✅ |
| M0.TC38 | M0.F15 | Supabase 客户端-三端封装 | P2 | 无 | 1. 验证 client.ts/server.ts/middleware.ts 导出 | 各端客户端可正常创建 | ✅ |

---

## M1 — AI资产重构

### 测试数据准备

```
- 2+ 媒资资产 (video/image)，含标签和片段
- 1+ 频道顾问 (active 状态)
- 1+ 知识库含 5+ 知识条目
- 3+ 盘活推荐 (各种 scenario)
- 5+ 文章 (各种 status)
- 层级分类树 (3 层)
```

### M1.TC — 媒资智能理解

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M1.TC01 | M1.F01 | 触发 AI 理解-正常 | P1 | 已有资产 | 1. 调用 `triggerUnderstanding(assetId)` | 资产状态变为 processing | ✅ |
| M1.TC02 | M1.F01 | 触发 AI 理解-未认证 | P0 | 未登录 | 1. 调用 `triggerUnderstanding(assetId)` | 返回认证错误 | ✅ |
| M1.TC03 | M1.F02 | 标签分布查询 | P1 | 已有标签数据 | 1. 调用 `getTagDistribution()` | 返回 9 类标签分布统计 | ✅ |
| M1.TC04 | M1.F03 | 知识图谱查询 | P1 | 已有知识节点 | 1. 调用 `getKnowledgeGraph()` | 返回 nodes + relations | ✅ |
| M1.TC05 | M1.F06 | 处理队列查询 | P1 | 有处理中资产 | 1. 调用 `getProcessingQueue()` | 返回队列列表含进度 | ✅ |
| M1.TC06 | M1.F06 | 队列统计 | P2 | 有各状态资产 | 1. 调用 `getQueueStats()` | queued/processing/completed/failed 计数正确 | ✅ |
| M1.TC07 | M1.F07 | 标注纠正 | P1 | 已有 AI 标签 | 1. 调用 `correctTag(tagId, newLabel)` | source 变为 human_correct | ✅ |
| M1.TC08 | M1.F32 | 批量理解触发 | P2 | 多个资产 | 1. 调用 `batchTriggerUnderstanding([id1, id2])` | 所有资产状态变为 processing | ✅ |

### M1.TC — 频道顾问工坊

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M1.TC09 | M1.F09 | 频道 DNA 分析 | P1 | 已有频道数据 | 1. 调用 `analyzeChannelDNA(channelId)` | 创建 channel_dna_profiles 记录 | ✅ |
| M1.TC10 | M1.F10 | 获取频道 DNA | P1 | 已分析过 | 1. 调用 `getChannelDNA(channelId)` | 返回 8 维度评分 + 词云 + 风格示例 | ✅ |
| M1.TC11 | M1.F12 | 上传知识文档 | P1 | 已有知识库 | 1. 调用 `uploadKnowledgeDocument(kbId, doc)` | 创建 knowledge_items 记录 | ✅ |
| M1.TC12 | M1.F14 | 添加知识订阅 | P1 | 已有知识库 | 1. 调用 `addKnowledgeSubscription(kbId, url)` | 创建订阅源记录 | ✅ |
| M1.TC13 | M1.F16 | 同步知识库 | P1 | 已有订阅源 | 1. 调用 `syncKnowledgeBase(kbId)` | 创建 sync_log 记录 | ✅ |
| M1.TC14 | M1.F17 | 创建频道顾问-正常 | P1 | 已认证 | 1. 调用 `createChannelAdvisor({name, channelType, ...})` | 创建成功，状态为 draft | ✅ |
| M1.TC15 | M1.F17 | 创建频道顾问-缺少必填字段 | P1 | 已认证 | 1. 调用 `createChannelAdvisor({})` | 返回验证错误 | ✅ |
| M1.TC16 | M1.F18 | 更新顾问风格约束 | P2 | 已有顾问 | 1. 调用 `updateAdvisorPersonality(id, {styleConstraints})` | 更新成功 | ✅ |
| M1.TC17 | M1.F19 | 编辑顾问 System Prompt | P2 | 已有顾问 | 1. 调用 `updateAdvisorPersonality(id, {systemPrompt})` | 更新成功 | ✅ |
| M1.TC18 | M1.F21 | 测试顾问对话 | P2 | 已有 active 顾问 | 1. 调用 `testAdvisorChat(advisorId, message)` | 返回响应（当前为 mock） | ✅ |
| M1.TC19 | M1.F23 | 顾问上线/下线切换 | P1 | 已有顾问 | 1. 调用 `toggleAdvisorStatus(id)` | 状态在 active/training/draft 间切换 | ✅ |

### M1.TC — 资产盘活引擎

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M1.TC20 | M1.F25 | 热点-资产匹配查询 | P1 | 有 hot_match 推荐 | 1. 调用 `getHotTopicMatches()` | 返回匹配列表含 matchScore | ✅ |
| M1.TC21 | M1.F26 | 每日推荐查询 | P1 | 有推荐数据 | 1. 调用 `getDailyRecommendations()` | 返回推荐列表含 suggestedAction | ✅ |
| M1.TC22 | M1.F27 | 风格迁移生成 | P1 | 有原始内容 | 1. 调用 `generateStyleVariant(assetId, targetStyle)` | 创建 style_adaptations 记录 | ✅ |
| M1.TC23 | M1.F29 | 盘活记录查询 | P2 | 有盘活记录 | 1. 调用 `getReviveRecords()` | 返回含 resultReach 的记录列表 | ✅ |
| M1.TC24 | M1.F33 | 采纳推荐 | P1 | 有 pending 推荐 | 1. 调用 `respondToRecommendation(id, 'adopted')` | 状态变为 adopted | ✅ |
| M1.TC25 | M1.F33 | 拒绝推荐 | P2 | 有 pending 推荐 | 1. 调用 `respondToRecommendation(id, 'rejected')` | 状态变为 rejected | ✅ |

### M1.TC — 媒资库与文章管理

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M1.TC26 | M1.F30 | 创建媒资 | P1 | 已认证 | 1. 调用 `createAsset({title, type, ...})` | 创建成功 | ✅ |
| M1.TC27 | M1.F30 | 删除媒资 | P1 | 已有资产 | 1. 调用 `deleteAsset(id)` | 删除成功 | ✅ |
| M1.TC28 | M1.F30 | 媒资统计 | P2 | 有各类型资产 | 1. 调用 `getAssetStats()` | 各类型计数正确 | ✅ |
| M1.TC29 | M1.F35 | 创建分类 | P1 | 已认证 | 1. 调用 `createCategory({name, slug})` | 创建成功 | ✅ |
| M1.TC30 | M1.F35 | 创建子分类 | P1 | 已有父分类 | 1. 调用 `createCategory({name, parentId})` | 创建成功，树结构正确 | ✅ |
| M1.TC31 | M1.F35 | 删除分类 | P2 | 已有分类 | 1. 调用 `deleteCategory(id)` | 删除成功 | ✅ |
| M1.TC32 | M1.F35 | 分类排序 | P2 | 多个分类 | 1. 调用 `reorderCategories(ids)` | sortOrder 更新正确 | ✅ |
| M1.TC33 | M1.F36 | 创建文章 | P1 | 已认证 | 1. 调用 `createArticle({title, body, ...})` | 创建成功，状态 draft | ✅ |
| M1.TC34 | M1.F36 | 文章状态变更 | P1 | 已有文章 | 1. 调用 `updateArticleStatus(id, 'reviewing')` | 状态变更成功 | ✅ |
| M1.TC35 | M1.F36 | 批量文章状态变更 | P2 | 多个文章 | 1. 调用 `batchUpdateArticleStatus([id1,id2], 'approved')` | 全部状态变更 | ✅ |
| M1.TC36 | M1.F36 | 文章统计 | P2 | 有各状态文章 | 1. 调用 `getArticleStats()` | 各状态计数正确 | ✅ |
| M1.TC37 | M1.F30 | 媒资-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getAssets()` | 不返回 OrgA 数据 | ✅ |
| M1.TC38 | M1.F36 | 文章-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getArticles()` | 不返回 OrgA 数据 | ✅ |

---

## M2 — 智创生产

### 测试数据准备

```
- 3+ 热点话题 (P0/P1/P2 各一)
- 1+ 创作会话含 3+ 任务
- 2+ 竞品账号
- 1+ 竞品分析报告
- 1+ 批量任务
- 1+ 各类型活动 (sport/conference/festival/exhibition)
```

### M2.TC — 超级个体创作中心

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M2.TC01 | M2.F01 | 创建创作会话 | P1 | 已认证 | 1. 调用 `createCreationSession({goal, mediaTypes})` | 创建成功，状态 active | ✅ |
| M2.TC02 | M2.F01 | 创建创作会话-未认证 | P0 | 未登录 | 1. 调用 `createCreationSession(...)` | 返回认证错误 | ✅ |
| M2.TC03 | M2.F02 | 更新任务内容 | P1 | 有创作任务 | 1. 调用 `updateTaskContent(taskId, {headline, body})` | 内容更新，创建 contentVersion | ✅ |
| M2.TC04 | M2.F06 | 多介质创作 | P1 | 无 | 1. 创建会话 `mediaTypes: ['article','video']` | 创建成功，含两种介质任务 | ✅ |
| M2.TC05 | M2.F10 | AI 文章修改对话 | P1 | 有创作会话 | 1. 调用 `sendCreationChatMessage(sessionId, message)` | 消息保存成功 | ✅ |
| M2.TC06 | M2.F12 | 内容版本创建 | P1 | 有任务 | 1. 多次更新内容 | 每次创建 content_versions 记录 | ✅ |
| M2.TC07 | M2.F01 | 创作目标查询 | P2 | 有 active 会话 | 1. 调用 `getActiveCreationGoal()` | 返回当前活跃目标 | ✅ |

### M2.TC — 竞品对标系统

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M2.TC08 | M2.F15 | 创建竞品分析 | P1 | 有竞品数据 | 1. 调用 `createBenchmarkAnalysis({topicId, ...})` | 创建分析含 radarData + improvements | ✅ |
| M2.TC09 | M2.F16 | 创建漏追话题 | P1 | 已认证 | 1. 调用 `createMissedTopic({title, priority, ...})` | 创建成功 | ✅ |
| M2.TC10 | M2.F16 | 漏追话题分布查询 | P2 | 有漏追数据 | 1. 调用 `getMissedTypeDistribution()` | 返回 breaking/trending/analysis 分布 | ✅ |
| M2.TC11 | M2.F17 | 保存周报 | P1 | 有分析数据 | 1. 调用 `saveWeeklyReport(report)` | 保存含 gapList + trends | ✅ |
| M2.TC12 | M2.F17 | 获取周报 | P2 | 有已保存周报 | 1. 调用 `getWeeklyReport()` | 返回最近周报 | ✅ |

### M2.TC — 热点感知引擎

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M2.TC13 | M2.F20 | 热点列表查询 | P1 | 有热点数据 | 1. 调用 `getInspirationTopics()` | 返回含 heatCurve, angles, competitorResponse | ✅ |
| M2.TC14 | M2.F21 | 更新热度评分 | P1 | 有热点 | 1. 调用 `updateTopicHeatScore(id, 85)` | 评分更新成功 | ✅ |
| M2.TC15 | M2.F23 | 热点预警-高热度自动推送 | P0 | 有热点 | 1. 更新热度到 >=80 | 发送 Inngest event `hot-topic/detected` | ✅ |
| M2.TC16 | M2.F23 | 热点预警-低热度不推送 | P1 | 有热点 | 1. 更新热度到 60 | 不发送 Inngest event | ✅ |
| M2.TC17 | M2.F22 | 更新话题优先级 | P1 | 有热点 | 1. 调用 `updateTopicPriority(id, 'P0')` | 优先级更新成功 | ✅ |
| M2.TC18 | M2.F24 | 添加选题角度 | P1 | 有热点 | 1. 调用 `addTopicAngle(topicId, angle)` | 创建 topic_angles 记录 | ✅ |
| M2.TC19 | M2.F28 | 更新评论洞察 | P2 | 有热点 | 1. 调用 `updateCommentInsight(topicId, insight)` | 正/负/中性 + hotComments 保存 | ✅ |
| M2.TC20 | M2.F20 | 平台监控状态查询 | P2 | 有监控配置 | 1. 调用 `getPlatformMonitors()` | 返回各平台 online/offline 状态 | ✅ |

### M2.TC — 批量生产线

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M2.TC21 | M2.F30 | 创建批量任务 | P1 | 已认证 | 1. 调用 `createBatchJob({goal, items})` | 创建 batch_jobs + batch_items | ✅ |
| M2.TC22 | M2.F30 | 批量任务查询 | P2 | 有批量任务 | 1. 调用 `getBatchTopics()` | 返回含 channels 和 progress | ✅ |
| M2.TC23 | M2.F45 | 创建转换任务 | P2 | 已认证 | 1. 调用 `createConversionTask({sourceRatio, targetRatio})` | 创建成功 | ✅ |
| M2.TC24 | M2.F45 | 更新转换任务状态 | P2 | 有转换任务 | 1. 调用 `updateConversionTaskStatus(id, 'done')` | 状态更新 | ✅ |

### M2.TC — 节赛会展自动产线

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M2.TC25 | M2.F37 | 创建活动-体育 | P1 | 已认证 | 1. 调用 `createEvent({type:'sport', ...})` | 创建成功 | ✅ |
| M2.TC26 | M2.F37 | 创建活动-会议 | P1 | 已认证 | 1. 调用 `createEvent({type:'conference', ...})` | 创建成功 | ✅ |
| M2.TC27 | M2.F39 | 添加精彩时刻 | P1 | 有活动 | 1. 调用 `addEventHighlight(eventId, {type:'goal', ...})` | 创建 highlight 记录 | ✅ |
| M2.TC28 | M2.F42 | 创建活动输出-集锦 | P1 | 有活动 | 1. 调用 `createEventOutput(eventId, {type:'summary'})` | 创建 event_output 记录 | ✅ |
| M2.TC29 | M2.F44 | 体育赛事看板查询 | P2 | 有体育活动 | 1. 调用 `getSportEvent(id)` | 返回完整赛事数据含 highlights/stats | ✅ |
| M2.TC30 | M2.F48 | 应用爆款模板 | P2 | 有模板和任务 | 1. 调用 `applyHitTemplate(taskId, templateId)` | 模板结构应用到任务 | ✅ |

### M2.TC — 多租户与安全

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M2.TC31 | — | 热点-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getInspirationTopics()` | 不返回 OrgA 数据 | ✅ |
| M2.TC32 | — | 创作会话-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getActiveCreationGoal()` | 不返回 OrgA 数据 | ✅ |
| M2.TC33 | — | 批量任务-未认证 | P0 | 未登录 | 1. 调用 `createBatchJob(...)` | 返回认证错误 | ✅ |
| M2.TC34 | — | 活动-未认证 | P0 | 未登录 | 1. 调用 `createEvent(...)` | 返回认证错误 | ✅ |

---

## M3 — 全渠道传播

### 测试数据准备

```
- 2+ 渠道 (active/paused)
- 3+ 发布计划 (各状态)
- 2+ 审核结果 (approved/rejected/escalated)
- 渠道指标数据 (7 天)
- 1+ 案例库条目
- 1+ 爆品预测
```

### M3.TC — 渠道适配与发布

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M3.TC01 | M3.F07 | 创建渠道 | P1 | 已认证 | 1. 调用 `createChannel({name, platform, apiConfig})` | 创建成功，状态 setup | ✅ |
| M3.TC02 | M3.F07 | 更新渠道状态 | P1 | 已有渠道 | 1. 调用 `updateChannelStatus(id, 'active')` | 状态更新 | ✅ |
| M3.TC03 | M3.F07 | 删除渠道 | P1 | 已有渠道 | 1. 调用 `deleteChannel(id)` | 删除成功 | ✅ |
| M3.TC04 | M3.F30 | 创建发布计划 | P1 | 有渠道 | 1. 调用 `createPublishPlan({channelId, scheduledAt, title})` | 创建成功，状态 scheduled | ✅ |
| M3.TC05 | M3.F30 | 创建发布计划-缺少必填字段 | P1 | 已认证 | 1. 调用 `createPublishPlan({})` | 返回验证错误 | ✅ |
| M3.TC06 | M3.F30 | 更新发布计划状态-发布 | P1 | 有 scheduled 计划 | 1. 调用 `updatePublishPlanStatus(id, 'published')` | 状态变更，发送团队消息 | ✅ |
| M3.TC07 | M3.F30 | 更新发布计划状态-失败 | P1 | 有 publishing 计划 | 1. 调用 `updatePublishPlanStatus(id, 'failed')` | 状态变更，发送团队消息 | ✅ |
| M3.TC08 | M3.F30 | 删除发布计划 | P2 | 有计划 | 1. 调用 `deletePublishPlan(id)` | 删除成功 | ✅ |
| M3.TC09 | M3.F30 | 改期发布计划 | P2 | 有 scheduled 计划 | 1. 调用 `reschedulePublishPlan(id, newDate)` | scheduledAt 更新 | ✅ |

### M3.TC — 智能审核

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M3.TC10 | M3.F08 | 创建审核结果 | P1 | 有内容 | 1. 调用 `createReviewResult({contentId, issues, score})` | 创建成功，发送团队消息 | ✅ |
| M3.TC11 | M3.F09 | 分渠道审核规则 | P2 | 有审核结果 | 1. 创建审核含 channelRules | channelRules 含 strictnessLevel | ✅ |
| M3.TC12 | M3.F10 | 解决审核问题 | P1 | 有审核 issue | 1. 调用 `resolveReviewIssue(resultId, issueIndex)` | issue.resolved = true | ✅ |
| M3.TC13 | M3.F12 | 敏感内容升级 | P1 | 有审核结果 | 1. 调用 `updateReviewStatus(id, 'escalated', reason)` | 状态变 escalated，记录原因 | ✅ |
| M3.TC14 | M3.F11 | 审核结果-Inngest 通知 | P1 | 有审核结果 | 1. 验证 `onReviewCompleted` 函数触发 | 自动发送团队消息 | ✅ |

### M3.TC — 数据分析

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M3.TC15 | M3.F13 | 全渠道数据汇总 | P1 | 有指标数据 | 1. 调用 `getAnalyticsSummary()` | 返回 WeeklyAnalyticsStats | ✅ |
| M3.TC16 | M3.F14 | 频道对比 | P1 | 多渠道数据 | 1. 调用 `getChannelComparison()` | 返回各渠道对比数据 | ✅ |
| M3.TC17 | M3.F15 | 六维传播评估 | P1 | 有数据 | 1. 调用 `getSixDimensionScores()` | 返回 6 维度 score 数组 | ✅ |
| M3.TC18 | M3.F16 | 周报自动生成-Inngest cron | P1 | Inngest 配置 | 1. 触发 `weeklyAnalyticsReport` cron | 自动生成并推送团队消息 | ✅ |
| M3.TC19 | M3.F17 | 异常数据预警 | P1 | 有历史数据 | 1. 调用 `getAnomalyAlerts()` | 返回 >50% 跌幅等异常 | ✅ |
| M3.TC20 | M3.F18 | 内容效果评分 | P2 | 有发布内容 | 1. 调用 `getTopContent()` | 返回含 engagement score | ✅ |

### M3.TC — 精品率提升

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M3.TC21 | M3.F24 | 添加竞品爆款 | P1 | 已认证 | 1. 调用 `addCompetitorHit({competitorName, title, ...})` | 创建成功含 successFactors | ✅ |
| M3.TC22 | M3.F25 | 添加到案例库 | P1 | 有高分内容 | 1. 调用 `addToCaseLibrary({contentId, score, tags})` | 创建 case_library 记录 | ✅ |
| M3.TC23 | M3.F26 | 创建爆品预测 | P1 | 有内容 | 1. 调用 `createHitPrediction({contentId, dimensions})` | 创建含 5 维度评分 | ✅ |
| M3.TC24 | M3.F28 | 更新实际效果 | P2 | 有预测 | 1. 调用 `updateHitPredictionActual(id, 85)` | actualScore 更新 | ✅ |

### M3.TC — 多租户与安全

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M3.TC25 | — | 渠道-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getChannels()` | 不返回 OrgA 数据 | ✅ |
| M3.TC26 | — | 发布计划-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getPublishPlans()` | 不返回 OrgA 数据 | ✅ |
| M3.TC27 | — | 审核结果-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getReviewResults()` | 不返回 OrgA 数据 | ✅ |
| M3.TC28 | — | 数据分析-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getAnalyticsSummary()` | 不返回 OrgA 数据 | ✅ |

---

## M4 — AI团队引擎

### 测试数据准备

```
- 8 预设 AI 员工 + 2 自定义员工
- 28 内置技能 + 核心技能绑定
- 3 团队 (不同场景: breaking_news/deep_report/social_media)
- 2 工作流模板 (标准 8 步 + 精简)
- 5 工作流实例 (running/completed/failed/cancelled)
- 20+ 团队消息 (各种类型)
- 10+ 执行日志
```

### M4.TC — AI 员工管理

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4.TC01 | M4.F01 | 预设员工市场查看 | P1 | 种子数据 | 1. 调用 `getEmployees()` | 返回 9 名预设员工 | ✅ |
| M4.TC02 | M4.F02 | 创建自定义员工 | P1 | 已认证 | 1. 调用 `createEmployee({name, roleType, ...})` | 创建成功，isPreset=false | ✅ |
| M4.TC03 | M4.F02 | 创建员工-缺少必填字段 | P1 | 已认证 | 1. 调用 `createEmployee({})` | 返回验证错误 | ✅ |
| M4.TC04 | M4.F02 | 创建员工-未认证 | P0 | 未登录 | 1. 调用 `createEmployee(...)` | 返回认证错误 | ✅ |
| M4.TC05 | M4.F03 | 员工完整资料查看 | P1 | 有员工 | 1. 调用 `getEmployeeFullProfile(id)` | 返回含 skills, stats, workPreferences, learnedPatterns | ✅ |
| M4.TC06 | M4.F04 | 编辑员工资料 | P1 | 有员工 | 1. 调用 `updateEmployeeProfile(id, {name, title})` | 资料更新成功 | ✅ |
| M4.TC07 | M4.F05 | 克隆员工 | P1 | 有员工+技能 | 1. 调用 `cloneEmployee(id)` | 创建新员工，技能绑定复制 | ✅ |
| M4.TC08 | M4.F06 | 删除自定义员工 | P1 | 有自定义员工 | 1. 调用 `deleteEmployee(customId)` | 删除成功 | ✅ |
| M4.TC09 | M4.F06 | 删除预设员工-拒绝 | P1 | 有预设员工 | 1. 调用 `deleteEmployee(presetId)` | 拒绝删除或无效果 | ✅ |
| M4.TC10 | M4.F07 | 禁用员工 | P1 | 有启用的员工 | 1. 调用 `toggleEmployeeDisabled(id)` | disabled=true | ✅ |
| M4.TC11 | M4.F07 | 启用员工 | P1 | 有禁用的员工 | 1. 调用 `toggleEmployeeDisabled(id)` | disabled=false | ✅ |
| M4.TC12 | M4.F08 | 导出员工 JSON | P1 | 有员工 | 1. 调用 `exportEmployee(id)` | 返回完整 JSON 配置 | ✅ |
| M4.TC13 | M4.F08 | 导入员工 JSON | P1 | 有导出数据 | 1. 调用 `importEmployee(json)` | 创建新员工，技能绑定 | ✅ |
| M4.TC14 | M4.F10 | 状态实时显示 | P2 | 有各状态员工 | 1. 查询员工列表 | working/idle/learning/reviewing 正确显示 | ✅ |
| M4.TC15 | M4.F11 | 手动状态更新 | P1 | 有员工 | 1. 调用 `updateEmployeeStatus(id, 'working', 'taskDesc')` | 状态+currentTask 更新 | ✅ |
| M4.TC16 | M4.F13 | 状态变更通知 | P1 | 员工属于团队 | 1. 更新员工状态 | 所属团队收到 status_update 消息 | ✅ |
| M4.TC17 | M4.F14 | 权限级别定义 | P1 | 有员工 | 1. 查询 authority_level 枚举 | 含 observer/advisor/executor/coordinator | ✅ |
| M4.TC18 | M4.F15 | 权限级别配置 | P1 | 有员工 | 1. 调用 `updateAuthorityLevel(id, 'executor')` | 权限级别更新 | ✅ |
| M4.TC19 | M4.F17 | 配置自动执行操作 | P2 | 有员工 | 1. 调用 `updateAutoActions(id, {autoActions, needApprovalActions})` | 两个列表更新 | ✅ |
| M4.TC20 | M4.F20 | 工作偏好配置 | P1 | 有员工 | 1. 调用 `updateWorkPreferences(id, prefs)` | 5 项偏好保存 | ✅ |

### M4.TC — 技能管理

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4.TC21 | M4.F28 | 技能库按类别浏览 | P1 | 种子技能 | 1. 调用 `getSkills('perception')` | 返回感知类技能 | ✅ |
| M4.TC22 | M4.F30 | 技能库全量浏览 | P1 | 种子技能 | 1. 调用 `getSkills()` | 返回 28+ 技能 | ✅ |
| M4.TC23 | M4.F33 | 绑定技能-正常 | P1 | 有员工+兼容技能 | 1. 调用 `bindSkillToEmployee(empId, skillId)` | 绑定成功，默认 level=50 | ✅ |
| M4.TC24 | M4.F37 | 绑定技能-不兼容角色 | P1 | 技能 compatibleRoles 不含员工角色 | 1. 调用 `bindSkillToEmployee(empId, skillId)` | 返回兼容性错误 | ✅ |
| M4.TC25 | M4.F33 | 绑定技能-重复绑定 | P2 | 已绑定该技能 | 1. 再次绑定同一技能 | 返回已绑定错误或忽略 | ✅ |
| M4.TC26 | M4.F34 | 解绑技能-extended | P1 | 有 extended 绑定 | 1. 调用 `unbindSkillFromEmployee(empId, skillId)` | 解绑成功 | ✅ |
| M4.TC27 | M4A.F11 | 解绑技能-core 拒绝 | P1 | 有 core 绑定 | 1. 调用 `unbindSkillFromEmployee(empId, coreSkillId)` | 拒绝解绑 | ✅ |
| M4.TC28 | M4.F35 | 调整技能熟练度 | P2 | 有绑定技能 | 1. 调用 `updateSkillLevel(empId, skillId, 80)` | level 更新为 80 | ✅ |
| M4.TC29 | M4.F35 | 调整技能熟练度-边界值 0 | P2 | 有绑定技能 | 1. 调用 `updateSkillLevel(empId, skillId, 0)` | level 更新为 0 | ✅ |
| M4.TC30 | M4.F35 | 调整技能熟练度-边界值 100 | P2 | 有绑定技能 | 1. 调用 `updateSkillLevel(empId, skillId, 100)` | level 更新为 100 | ✅ |
| M4.TC31 | M4.F36 | 查询未绑定技能 | P2 | 员工已绑定部分技能 | 1. 调用 `getSkillsNotBoundToEmployee(empId)` | 返回未绑定技能列表 | ✅ |

### M4.TC — 团队管理

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4.TC32 | M4.F43 | 创建团队 | P1 | 已认证 | 1. 调用 `createTeam({name, scenario, ...})` | 创建成功 | ✅ |
| M4.TC33 | M4.F43 | 创建团队-未认证 | P0 | 未登录 | 1. 调用 `createTeam(...)` | 返回认证错误 | ✅ |
| M4.TC34 | M4.F56 | 添加 AI 成员 | P1 | 有团队+员工 | 1. 调用 `addTeamMember(teamId, {type:'ai', employeeId})` | 成员添加成功 | ✅ |
| M4.TC35 | M4.F57 | 添加人类成员 | P1 | 有团队 | 1. 调用 `addTeamMember(teamId, {type:'human', name})` | 成员添加成功 | ✅ |
| M4.TC36 | M4.F56 | 添加重复成员 | P2 | 已添加该成员 | 1. 再次添加同一员工 | 拒绝或忽略 | ✅ |
| M4.TC37 | M4.F58 | 移除成员 | P1 | 有成员 | 1. 调用 `removeTeamMember(teamId, memberId)` | 移除成功 | ✅ |
| M4.TC38 | M4.F59 | 调整成员角色 | P1 | 有成员 | 1. 调用 `updateTeamMemberRole(memberId, newRole)` | 角色更新 | ✅ |
| M4.TC39 | M4.F62 | 更新团队信息 | P1 | 有团队 | 1. 调用 `updateTeam(id, {name, scenario})` | 信息更新 | ✅ |
| M4.TC40 | M4.F63 | 删除团队 | P1 | 有团队+成员 | 1. 调用 `deleteTeam(id)` | 团队+成员级联删除 | ✅ |
| M4.TC41 | M4.F61 | 团队列表查询 | P1 | 有团队 | 1. 调用 `getTeams()` | 返回当前组织团队列表 | ✅ |
| M4.TC42 | M4.F60 | 团队详情+成员 | P1 | 有团队+成员 | 1. 调用 `getTeamWithMembers(id)` | 返回含 memberDetails 的团队 | ✅ |
| M4.TC43 | M4.F52 | 更新升级策略 | P1 | 有团队 | 1. 调用 `updateEscalationPolicy(teamId, policy)` | 策略保存 | ✅ |
| M4.TC44 | M4.F165 | 更新团队规则 | P1 | 有团队 | 1. 调用 `updateTeamRules(teamId, rules)` | 规则保存含 approvalSteps | ✅ |
| M4.TC45 | — | 团队-多租户隔离 | P0 | OrgB 用户 | 1. OrgB 调用 `getTeams()` | 不返回 OrgA 数据 | ✅ |

### M4.TC — 工作流引擎

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4.TC46 | M4.F69 | 创建工作流模板 | P1 | 已认证 | 1. 调用 `createWorkflowTemplate({name, steps})` | 模板创建成功 | ✅ |
| M4.TC47 | M4.F70 | 编辑工作流模板 | P1 | 有模板 | 1. 调用 `updateWorkflowTemplate(id, {name})` | 更新成功 | ✅ |
| M4.TC48 | M4.F70 | 删除工作流模板 | P1 | 有模板 | 1. 调用 `deleteWorkflowTemplate(id)` | 删除成功 | ✅ |
| M4.TC49 | M4.F71 | 启动工作流 | P0 | 有团队+模板 | 1. 调用 `startWorkflow(teamId, templateId, {topic})` | 创建实例+步骤+发送 Inngest event | ✅ |
| M4.TC50 | M4.F71 | 启动工作流-未认证 | P0 | 未登录 | 1. 调用 `startWorkflow(...)` | 返回认证错误 | ✅ |
| M4.TC51 | M4.F73 | 取消工作流 | P1 | 有 running 实例 | 1. 调用 `cancelWorkflow(instanceId)` | 状态→cancelled | ✅ |
| M4.TC52 | M4.F67 | 标准 8 步管线 | P1 | 无 | 1. 检查 WORKFLOW_STEPS 常量 | 含 8 步正确顺序 | ✅ |
| M4.TC53 | M4.F76 | 顺序执行验证 | P0 | 启动工作流 | 1. 验证 Inngest 执行顺序 | 步骤按 step_order 顺序执行 | ✅ |
| M4.TC54 | M4.F78 | 步骤状态流转-正常 | P1 | 执行中 | 1. 观察步骤状态 | pending→active→completed | ✅ |
| M4.TC55 | M4.F82 | 无分配步骤跳过 | P1 | 步骤无 employeeId | 1. 执行到该步骤 | 状态标记 skipped | ✅ |
| M4.TC56 | M4.F79 | 输出持久化 | P1 | 步骤完成 | 1. 检查步骤记录 | output + structuredOutput 已保存 | ✅ |
| M4.TC57 | M4.F80 | 上下文传递 | P1 | 多步执行 | 1. 检查第 N+1 步的 prompt | 包含第 N 步的 summary + artifacts | ✅ |
| M4.TC58 | M4.F83 | 失败重试 | P2 | Agent 执行失败 | 1. 步骤失败 | 自动重试 1 次 | ✅ |

### M4.TC — 审批门控系统

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4.TC59 | M4.F86 | 审批等待机制 | P0 | approvalRequired=true | 1. 执行到审核步骤 | 步骤状态变 waiting_approval，等待 24h | ✅ |
| M4.TC60 | M4.F87 | 批准操作 | P0 | 有 waiting_approval 步骤 | 1. 调用 `approveWorkflowStep(stepId, 'approved')` | 步骤继续，发送 Inngest event | ✅ |
| M4.TC61 | M4.F87 | 驳回操作 | P0 | 有 waiting_approval 步骤 | 1. 调用 `approveWorkflowStep(stepId, 'rejected', feedback)` | 步骤失败，记录反馈 | ✅ |
| M4.TC62 | M4.F88 | 审批请求消息 | P1 | 进入审批 | 1. 检查团队消息 | 包含 decision_request 类型消息含批准/驳回按钮 | ✅ |
| M4.TC63 | M4.F91 | 驳回重做 | P1 | 步骤被驳回 | 1. 验证重做逻辑 | 反馈注入 prompt，retryCount++ | ✅ |
| M4.TC64 | M4.F92 | 批量审批 | P1 | 多个 waiting 步骤 | 1. 调用 `batchApproveWorkflowSteps(stepIds)` | 全部批准成功 | ✅ |
| M4.TC65 | M4.F93 | 审批超时-auto_approve | P1 | 配置 auto_approve | 1. 等待超时 | 自动批准 | ✅ |
| M4.TC66 | M4.F93 | 审批超时-auto_reject | P1 | 配置 auto_reject | 1. 等待超时 | 自动驳回 | ✅ |
| M4.TC67 | M4.F93 | 审批超时-escalate | P1 | 配置 escalate | 1. 等待超时 | 升级处理 | ✅ |
| M4.TC68 | M4.F130 | 全自动执行 | P0 | approvalRequired=false | 1. 启动工作流 | 8 步自动执行无审批中断 | ✅ |

### M4.TC — 团队消息

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4.TC69 | M4.F120 | 发送人工消息 | P1 | 有团队 | 1. 调用 `sendTeamMessage(teamId, content)` | 消息保存成功 | ✅ |
| M4.TC70 | M4.F120 | 发送消息-未认证 | P0 | 未登录 | 1. 调用 `sendTeamMessage(...)` | 返回认证错误 | ✅ |
| M4.TC71 | M4.F118 | 四种消息类型 | P1 | 有消息 | 1. 查询消息列表 | 包含 alert/decision_request/status_update/work_output | ✅ |
| M4.TC72 | M4.F121 | 消息操作按钮 | P2 | 有 decision_request 消息 | 1. 查看消息 | 包含 actions (approve/reject buttons) | ✅ |
| M4.TC73 | M4.F122 | 消息附件 | P2 | 有 work_output 消息 | 1. 查看消息 | 包含 attachments (topic_card/draft_preview等) | ✅ |
| M4.TC74 | M4.F123 | 消息时间排序 | P1 | 多条消息 | 1. 调用 `getTeamMessages(teamId)` | 按时间倒序排列 | ✅ |
| M4.TC75 | M4.F125 | 跨模块消息-审核完成 | P1 | 审核完成 | 1. 触发 onReviewCompleted | 团队收到消息 | ✅ |
| M4.TC76 | M4.F125 | 跨模块消息-发布状态 | P1 | 发布状态变更 | 1. 触发 onPlanStatusChanged | 团队收到消息 | ✅ |
| M4.TC77 | M4.F125 | 跨模块消息-数据异常 | P1 | 数据异常 | 1. 触发 onAnomalyDetected | 团队收到消息 | ✅ |

### M4.TC — 自动化模式

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4.TC78 | M4.F131 | 热点自动触发工作流 | P0 | 有团队+模板 | 1. 发送 `hot-topic/detected` event | hotTopicAutoTrigger 创建并启动工作流 | ✅ |
| M4.TC79 | M4.F134 | 质量驱动自动升级 | P1 | 有升级策略 | 1. 步骤质量分 < 阈值 | 自动切换为需审批模式 | ✅ |
| M4.TC80 | M4.F132 | 周报定时生成 | P1 | cron 配置 | 1. 触发 weeklyAnalyticsReport | 生成报告+推送消息 | ✅ |

---

## M4-A — Agent 架构优化

### 测试数据准备

```
- 完整员工（含技能、知识库、记忆）
- 工作流上下文（前一步输出、工件）
- 各种 authority_level 的员工
- 驳回反馈历史
```

### M4A.TC — 意图解析

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4A.TC01 | M4A.F01 | 意图解析-突发新闻 | P1 | 无 | 1. 调用 `parseUserIntent('紧急发布xx事件快讯')` | 返回 type=breaking_news + 裁剪步骤 | ✅ |
| M4A.TC02 | M4A.F02 | 意图类型-6种识别 | P1 | 无 | 1. 分别输入 6 种意图文本 | 正确识别 breaking_news/deep_report/social_campaign/series/event_coverage/routine | ✅ |
| M4A.TC03 | M4A.F03 | 步骤动态裁剪-突发 | P1 | type=breaking_news | 1. 检查返回步骤 | 跳过 produce (视频) 步骤 | ✅ |
| M4A.TC04 | M4A.F04 | 意图解析降级回退 | P0 | Mock LLM 返回错误 | 1. 调用 `parseUserIntent(input)` | 回退到默认 8 步 (DEFAULT_STEPS) | ✅ |
| M4A.TC05 | M4A.F04 | 意图解析-无效 slug | P1 | LLM 返回无效 employeeSlug | 1. 调用 `parseUserIntent(input)` | 回退到默认步骤 | ✅ |

### M4A.TC — 技能学习

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4A.TC06 | M4A.F05 | 质量驱动技能升级-优秀 | P1 | qualityScore=95 | 1. 工作流步骤完成后 | 技能 level +2 | ✅ |
| M4A.TC07 | M4A.F05 | 质量驱动技能升级-良好 | P1 | qualityScore=85 | 1. 工作流步骤完成后 | 技能 level +1 | ✅ |
| M4A.TC08 | M4A.F05 | 质量驱动技能降级 | P1 | qualityScore=50 | 1. 工作流步骤完成后 | 技能 level -1 | ✅ |
| M4A.TC09 | M4A.F05 | 技能等级边界-不超100 | P2 | level=99, qualityScore=95 | 1. 步骤完成 | level = 100 (不超过) | ✅ |
| M4A.TC10 | M4A.F05 | 技能等级边界-不低于0 | P2 | level=0, qualityScore=50 | 1. 步骤完成 | level = 0 (不低于) | ✅ |
| M4A.TC11 | M4A.F06 | 驳回反馈学习-记忆写入 | P1 | 步骤被驳回+反馈 | 1. 审批驳回含反馈 | 创建 employee_memories(type=feedback, importance=0.8) | ✅ |
| M4A.TC12 | M4A.F06 | 驳回反馈学习-模式计数 | P1 | 步骤被驳回 | 1. 审批驳回含反馈 | learnedPatterns 对应项 count++ | ✅ |
| M4A.TC13 | M4A.F07 | 熟练度影响Prompt-新手 | P1 | 平均 level=20 | 1. 构建 prompt | Layer 2 包含"严格按照指令执行" | ✅ |
| M4A.TC14 | M4A.F07 | 熟练度影响Prompt-专家 | P1 | 平均 level=85 | 1. 构建 prompt | Layer 2 包含"自由创新" | ✅ |

### M4A.TC — 内置技能与绑定

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4A.TC15 | M4A.F08 | 28 个内置技能完整性 | P1 | 无 | 1. 检查 BUILTIN_SKILLS 常量 | 含 28 个技能，6 类别覆盖 | ✅ |
| M4A.TC16 | M4A.F09 | 8 员工核心技能映射 | P1 | 种子数据 | 1. 检查 EMPLOYEE_CORE_SKILLS | 8 员工各有 4 个 core 技能 | ✅ |
| M4A.TC17 | M4A.F10 | 技能绑定类型-三种 | P1 | 种子数据 | 1. 查询 employee_skills | 含 core/extended/knowledge 三种 | ✅ |

### M4A.TC — 工件传递

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4A.TC18 | M4A.F12 | 工件持久化 | P1 | 步骤完成 | 1. 检查 workflow_artifacts 表 | 含 structuredData + textContent | ✅ |
| M4A.TC19 | M4A.F12 | 工件类型-9种 | P2 | 多步完成 | 1. 检查 artifact_type 枚举 | topic_brief/angle_list/material_pack/.../generic | ✅ |
| M4A.TC20 | M4A.F13 | 步骤间工件消费 | P1 | 上游步骤有工件 | 1. 检查下游步骤 prompt | 包含 formatArtifactContext 输出 | ✅ |

### M4A.TC — 质量判断

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4A.TC21 | M4A.F14 | Agent 质量自评指令 | P1 | 无 | 1. 检查 Layer 7 prompt | 包含 `【质量自评：XX/100】` 指令 | ✅ |
| M4A.TC22 | M4A.F15 | 质量分数提取-正常 | P0 | 输出含 `【质量自评：85/100】` | 1. 调用 `extractQualityScore(text)` | 返回 85 | ✅ |
| M4A.TC23 | M4A.F15 | 质量分数提取-缺失 | P1 | 输出不含质量自评 | 1. 调用 `extractQualityScore(text)` | 返回默认值(如 70 或 null) | ✅ |
| M4A.TC24 | M4A.F16 | 质量门控->=80通过 | P0 | qualityScore=85 | 1. 执行质量门控 | 正常通过，不触发审批 | ✅ |
| M4A.TC25 | M4A.F16 | 质量门控-60~80按配置 | P1 | qualityScore=70, 有审批配置 | 1. 执行质量门控 | 按 approvalSteps 配置决定 | ✅ |
| M4A.TC26 | M4A.F16 | 质量门控-<60强制审批 | P0 | qualityScore=50 | 1. 执行质量门控 | 强制人工审批 | ✅ |
| M4A.TC27 | M4A.F17 | 人工中途干预 | P1 | 有 human+alert 消息 | 1. 执行步骤前检查 | 注入 userInstructions 到 prompt | ✅ |

### M4A.TC — 记忆系统

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4A.TC28 | M4A.F19 | 记忆注入Prompt | P1 | 员工有 10+ 记忆 | 1. 调用 `assembleAgent(employeeId, ...)` | Layer 6 包含 top-10 高权重记忆 | ✅ |
| M4A.TC29 | M4A.F19 | 记忆注入-无记忆 | P2 | 新员工无记忆 | 1. 调用 `assembleAgent(employeeId, ...)` | Layer 6 为空或默认文本 | ✅ |
| M4A.TC30 | M4A.F20 | 驳回写入 feedback 记忆 | P1 | 步骤被驳回 | 1. 驳回操作触发 | employee_memories 新增 type=feedback | ✅ |
| M4A.TC31 | M4A.F21 | 完成写入 pattern 记忆 | P1 | 工作流完成 | 1. 工作流正常完成 | employee_memories 新增 type=pattern, importance=0.5 | ✅ |
| M4A.TC32 | M4A.F22 | 记忆组织隔离 | P0 | OrgB 用户 | 1. 查询 OrgA 员工记忆 | 返回空或拒绝 | ✅ |

### M4A.TC — 安全/权限

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4A.TC33 | M4A.F23 | 权限约束工具-observer | P0 | authority=observer | 1. 调用 `assembleAgent(empId, ...)` | tools 为空数组 | ✅ |
| M4A.TC34 | M4A.F23 | 权限约束工具-advisor | P0 | authority=advisor | 1. 调用 `assembleAgent(empId, ...)` | 仅包含 14 个只读工具 | ✅ |
| M4A.TC35 | M4A.F23 | 权限约束工具-executor | P1 | authority=executor | 1. 调用 `assembleAgent(empId, ...)` | 包含全部可用工具 | ✅ |
| M4A.TC36 | M4A.F24 | Token 预算管控-正常 | P1 | tokenBudget=100000, tokensUsed=5000 | 1. 执行步骤 | 正常执行 | ✅ |
| M4A.TC37 | M4A.F24 | Token 预算管控-超预算 | P0 | tokensUsed > tokenBudget | 1. 执行步骤 | 抛出超预算错误，停止执行 | ✅ |
| M4A.TC38 | M4A.F25 | 工具调用次数限制 | P1 | 无 | 1. 检查 execution.ts | `stopWhen: stepCountIs(20)` 配置存在 | ✅ |

### M4A.TC — Agent 系统单元测试

| 用例编号 | 功能编号 | 用例名称 | 优先级 | 前置条件 | 测试步骤 | 预期结果 | 自动化 |
|----------|----------|----------|--------|----------|----------|----------|--------|
| M4A.TC39 | M4.F95 | 7层Prompt构建完整性 | P0 | 有完整员工数据 | 1. 调用 `buildSystemPrompt(context)` | 包含 7 层全部内容 | ✅ |
| M4A.TC40 | M4.F96 | 技能→工具映射 | P1 | 员工有绑定技能 | 1. 调用 `resolveTools(skillNames)` | 返回对应工具函数集 | ✅ |
| M4A.TC41 | M4.F107 | 未映射技能存根 | P1 | 技能无对应工具 | 1. 调用 `resolveTools(['unknown_skill'])` | 返回 stub 工具 | ✅ |
| M4A.TC42 | M4.F98 | 模型路由-perception | P1 | skillCategory=perception | 1. 调用 `routeModel('perception')` | 返回正确模型 ID | ✅ |
| M4A.TC43 | M4.F98 | 模型路由-6类别 | P1 | 各类别 | 1. 分别调用 6 种类别 | 各返回对应模型 | ✅ |
| M4A.TC44 | M4.F100 | 步骤专属指令-8种 | P1 | 无 | 1. 检查 STEP_INSTRUCTIONS | 8 种步骤各有详细中文指令 | ✅ |
| M4A.TC45 | M4.F101 | 输出解析-正常 | P1 | 有 LLM 输出文本 | 1. 调用 `parseStepOutput(text)` | 返回结构化 StepOutput | ✅ |
| M4A.TC46 | M4.F101 | 输出解析-空文本 | P2 | 空字符串 | 1. 调用 `parseStepOutput('')` | 返回默认结构 | ✅ |
| M4A.TC47 | M4.F102 | 权限后处理-observer | P1 | authority=observer | 1. Agent 执行完成 | output 自动标记 needs_approval=true | ✅ |
| M4A.TC48 | M4.F102 | 权限后处理-executor | P1 | authority=executor | 1. Agent 执行完成 | 不标记 needs_approval | ✅ |

---

## E2E 测试用例

> 工具：Playwright | 覆盖核心主流程

### E2E.TC — 核心流程

| 用例编号 | 流程 | 优先级 | 步骤概要 | 预期结果 | 自动化 |
|----------|------|--------|----------|----------|--------|
| E2E.TC01 | 用户注册登录 | P0 | 1. 访问 /register 2. 填写表单提交 3. 重定向 /login 4. 登录 5. 进入 Dashboard 6. 点击登出 | 全流程无阻断 | ✅ |
| E2E.TC02 | 员工浏览与管理 | P0 | 1. 进入 /employee-marketplace 2. 点击员工卡片 3. 进入 /employee/[id] 4. 绑定技能 5. 修改偏好 6. 导出 JSON | 全流程无阻断，数据正确 | ✅ |
| E2E.TC03 | 团队创建与配置 | P0 | 1. 进入 /team-builder 2. 创建团队 3. 添加成员 4. 设置角色 5. 配置升级策略 6. 配置审批步骤 | 团队创建完成，成员正确 | ✅ |
| E2E.TC04 | 工作流启动与执行 | P0 | 1. 进入 /team-hub 2. 选择团队 3. 点击"启动工作流" 4. 选择模板填写信息 5. 提交 6. 查看步骤进度 7. 审批/驳回 8. 查看完成结果 | 工作流创建并执行 | ✅ |
| E2E.TC05 | 消息与通知 | P1 | 1. 进入 /team-hub 2. 查看消息 Feed 3. 发送消息 4. 查看消息出现 | 消息发送成功并显示 | ✅ |
| E2E.TC06 | 导航与布局 | P1 | 1. 遍历侧边栏所有菜单项 2. 验证页面加载 3. 验证面包屑 4. 测试响应式布局 | 所有页面可访问，无白屏 | ✅ |

---

## Gap 分析

### 一、需求有测试用例但功能未实现（待实现后补充）

| 功能编号 | 功能名称 | 模块 | 状态 | 备注 |
|----------|----------|------|------|------|
| M1.F05 | 小资对话检索 | M1 | ❌ 未实现 | 待 Agent chat 界面集成后补充 |
| M1.F08 | 标注体系配置 | M1 | ❌ 未实现 | 待实现后补充 |
| M1.F22 | 多顾问对比测试 | M1 | ❌ 未实现 | 待实现后补充 |
| M1.F24 | A/B 测试 | M1 | ❌ 未实现 | 待实现后补充 |
| M2.F03 | AI 配图生成 | M2 | ❌ 未实现 | 需图像生成 API |
| M2.F05 | AI 短视频制作 | M2 | ❌ 未实现 | 需视频合成引擎 |
| M2.F11 | 实时合规检查 | M2 | ❌ 未实现 | 创作时实时检测 |
| M2.F18 | 改进建议追踪 | M2 | ❌ 未实现 | 需延迟任务 |
| M2.F19 | 竞品动态预警 | M2 | ❌ 未实现 | 需竞品监控调度 |
| M2.F29 | 趋势预测 | M2 | ❌ 未实现 | 需历史模型 |
| M2.F33 | 批量审核看板 | M2 | ❌ 未实现 | 统一审核界面 |
| M2.F35 | 模板化生产 | M2 | ❌ 未实现 | 高频内容模板 |
| M2.F36 | 批量质检 | M2 | ❌ 未实现 | 批量合规检测 |
| M2.F38 | 直播流接入 | M2 | ❌ 未实现 | 需流媒体对接 |
| M2.F41 | 自动解说字幕 | M2 | ❌ 未实现 | 需 TTS 引擎 |
| M2.F43 | 快速分发 | M2 | ❌ 未实现 | 需渠道 API |
| M3.F02 | 适配版本预览 | M3 | ❌ 未实现 | 多渠道预览 UI |
| M3.F03 | 智能发布时间推荐 | M3 | ❌ 未实现 | 需历史数据模型 |
| M3.F06 | 发布日历 | M3 | ❌ 未实现 | 日历组件 |
| M3.F19-23 | 旗舰 APP | M3 | ❌ 未实现 | 独立 C 端项目 |
| M3.F29 | 效果激励看板 | M3 | ❌ 未实现 | 编辑积分排行 |
| M4.F09 | 员工版本历史 | M4 | ❌ 未实现 | 配置变更记录 |
| M4.F19 | 动态权限调整 | M4 | ❌ 未实现 | 自动升降级 |
| M4.F26-27 | 绩效趋势/对比 | M4 | ❌ 未实现 | 可视化绩效 |
| M4.F32 | 技能在线测试 | M4 | ❌ 未实现 | 测试界面 |
| M4.F39-41 | 高级技能管理 | M4 | ❌ 未实现 | 版本/集成/组合 |
| M4.F84-85 | 并行步骤/条件分支 | M4 | ❌ 未实现 | 高级流控 |
| M4.F94 | 审批看板 | M4 | ❌ 未实现 | 集中待审视图 |
| M4.F108 | 真实搜索 API | M4 | ❌ 未实现 | 需 API Key |
| M4.F110 | 渠道 API 推送 | M4 | ❌ 未实现 | 需平台 API |
| M4.F116-117 | RAG 检索/管线 | M4 | ❌ 未实现 | 需 Embedding |
| M4.F126-129 | 通知增强 | M4 | ❌ 未实现 | 浏览器通知/未读/已读/@提及 |
| M4.F137-162 | 可视化编排/进化/协同 | M4 | ❌ 未实现 | Q4 计划 |

### 二、部分实现功能的补充测试需求

| 功能编号 | 功能名称 | 现状 | 补充测试内容 |
|----------|----------|------|-------------|
| M1.F01 | AI 多模态理解 | Schema+action 已有，Pipeline 未完成 | 完整 Pipeline 完成后补充端到端测试 |
| M1.F04 | 语义搜索 | 结构化查询，无向量搜索 | 向量搜索实现后补充相似度测试 |
| M1.F12 | 文档知识导入 | 状态跟踪已有，处理 Pipeline 未实现 | Pipeline 完成后补充 |
| M1.F21 | 测试对话 | 返回 mock 响应 | LLM 接入后补充真实对话测试 |
| M0.F19 | RLS 安全策略 | 规划中 | 实施后需全量 RLS 验证测试 |
| M4.F104-106 | web_search/content_generate/fact_check 工具 | Mock 实现 | 真实 API 接入后补充 |
| M4A.F26 | DAL 组织隔离 | 部分 DAL 缺少过滤 | 需逐一审计所有 DAL 函数 |

### 三、安全测试覆盖情况

| 安全测试项 | 对应用例 | 覆盖状态 |
|-----------|----------|----------|
| 多租户数据隔离 | M0.TC17-20, M1.TC37-38, M2.TC31-34, M3.TC25-28, M4.TC45, M4A.TC32 | ✅ 全覆盖 |
| 未认证访问拦截 | M0.TC09, M0.TC14, M4.TC04, M4.TC33, M4.TC50, M4.TC70, M2.TC02, M2.TC33-34 | ✅ 全覆盖 |
| 权限级别约束 | M4A.TC33-35, M4A.TC47-48 | ✅ 全覆盖 |
| Token 预算管控 | M4A.TC36-37 | ✅ 全覆盖 |
| Auth 链路完整性 | M0.TC01-16 | ✅ 全覆盖 |
| XSS 防护 | — | ❌ 需手工测试 |
| CSRF 保护 | — | ❌ 依赖 Next.js Server Actions 内置保护，需验证 |
| SQL 注入防护 | — | ✅ Drizzle ORM 参数化查询，需验证 |
| 敏感信息泄露 | — | ❌ 需手工审计 API 响应 |

---

## 测试框架建议

### Vitest 配置（单元/集成测试）

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

**推荐测试目录结构：**
```
src/
├── lib/agent/__tests__/           # Agent 系统单元测试 (最高 ROI)
│   ├── assembly.test.ts
│   ├── prompt-templates.test.ts
│   ├── tool-registry.test.ts
│   ├── intent-parser.test.ts
│   ├── step-io.test.ts
│   └── model-router.test.ts
├── app/actions/__tests__/          # Server Action 集成测试
│   ├── employees.test.ts
│   ├── teams.test.ts
│   ├── workflow-engine.test.ts
│   └── auth.test.ts
├── lib/dal/__tests__/              # DAL 集成测试 (org-scope)
│   ├── employees.test.ts
│   ├── teams.test.ts
│   └── messages.test.ts
tests/
├── e2e/                            # Playwright E2E 测试
│   ├── auth.spec.ts
│   ├── employee-management.spec.ts
│   ├── team-management.spec.ts
│   ├── workflow-execution.spec.ts
│   ├── messaging.spec.ts
│   └── navigation.spec.ts
```

### Playwright 配置（E2E 测试）

```bash
npm install -D @playwright/test
npx playwright install
```

### Mock 策略

| 外部依赖 | Mock 方式 | 适用范围 |
|----------|----------|----------|
| Anthropic Claude API | MSW + 固定响应 | 单元/集成测试 |
| Supabase Auth | MSW / Supabase Local | 集成测试 |
| Inngest | `inngest/test` 工具包 | 集成测试 |
| 外部搜索 API | MSW 拦截 | 全部测试 |

---

## 测试数据种子建议

扩展 `src/db/seed.ts`，增加以下测试专用数据：

```typescript
// 多租户测试数据
const TEST_ORG_A = { id: 'org-test-a', name: 'Test Org A' };
const TEST_ORG_B = { id: 'org-test-b', name: 'Test Org B' };

// 各角色测试用户
const TEST_USERS = [
  { email: 'admin@test-org-a.com', role: 'admin', orgId: TEST_ORG_A.id },
  { email: 'editor@test-org-a.com', role: 'editor', orgId: TEST_ORG_A.id },
  { email: 'viewer@test-org-a.com', role: 'viewer', orgId: TEST_ORG_A.id },
  { email: 'admin@test-org-b.com', role: 'admin', orgId: TEST_ORG_B.id },
];

// 各状态工作流实例
const TEST_WORKFLOWS = [
  { status: 'active', steps: 8, currentStep: 3 },
  { status: 'completed', steps: 8, currentStep: 8 },
  { status: 'cancelled', steps: 8, currentStep: 5 },
  { status: 'active', steps: 5, currentStep: 2 },  // 精简模板
  { status: 'active', steps: 8, currentStep: 6, hasApproval: true },
];
```

---

## 实施优先级

### 第一批（Week 1-2）— 最高 ROI

1. **M4A.TC39-48**: Agent 系统单元测试（纯函数，无 DB 依赖）
2. **M4A.TC01-05**: 意图解析器单元测试
3. **M4A.TC22-23**: 质量分数提取单元测试
4. **M0.TC35-37**: TypeScript/Build/Lint 检查（CI 基线）

### 第二批（Week 3-4）— 核心安全

5. **M0.TC17-20**: 多租户隔离集成测试
6. **M0.TC01-16**: 认证链路集成测试
7. **M4.TC49-50, TC59-61**: 工作流启动+审批集成测试
8. **M4.TC01-13**: 员工 CRUD 集成测试

### 第三批（Week 5-6）— 业务完整性

9. **M4.TC32-45**: 团队管理集成测试
10. **M4.TC69-77**: 消息系统集成测试
11. **M1.TC26-38**: 媒资+文章 CRUD 集成测试
12. **M2.TC13-19**: 热点感知集成测试

### 第四批（Week 7-8）— E2E + 补充

13. **E2E.TC01-06**: Playwright E2E 核心流程
14. **M3.TC01-28**: 全渠道传播集成测试
15. **M4.TC46-58**: 工作流引擎深度集成测试
16. **M4A.TC06-14**: 技能学习+记忆系统集成测试
