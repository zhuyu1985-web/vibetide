# 数智全媒系统 — 全量功能清单

> 基于需求文档、实施计划、工程代码三方交叉比对，反向分析生成。
> 生成日期：2026-03-07 | 更新日期：2026-03-07 v2.0
>
> **v2.0 变更：** 新增 M4-A Agent 架构优化模块（19 项功能），覆盖用户 10 项改进要求（意图拆解/技能学习/内置技能/员工协同/结果判断/记忆系统/员工-技能关系/安全权限/外部对标）。更新实际代码统计（60 表/37 枚举）。

---

## 统计摘要

| 模块 | 已实现 | 部分实现 | 未实现 | 合计 | 完成率 |
|------|--------|----------|--------|------|--------|
| M0 平台基础架构 | 18 | 2 | 1 | 21 | 90% |
| M1 AI资产重构 | 22 | 5 | 4 | 31 | 81% |
| M2 智创生产 | 28 | 4 | 12 | 44 | 68% |
| M3 全渠道传播 | 19 | 5 | 5 | 29 | 76% |
| M4 AI团队引擎 | 70 | 14 | 44 | 128 | 66% |
| M4-A Agent架构优化（10项要求） | 17 | 2 | 0 | 19 | 95% |
| **合计** | **174** | **32** | **66** | **272** | **76%** |

---

## M0 — 平台基础架构

> 来源：`docs/requirement/00-平台基础架构.md` + 代码反向工程。需求文档为架构规格，无编号功能项，以下编号由代码反向生成。

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M0.F01 | 用户注册 | 邮箱+密码注册，自动创建 user_profile | ✅ 已实现 | `src/app/actions/auth.ts:signUp`, `src/app/(auth)/register/page.tsx` | 00-平台基础架构 | — |
| M0.F02 | 用户登录 | 邮箱+密码登录，Supabase Auth | ✅ 已实现 | `src/app/actions/auth.ts:signIn`, `src/app/(auth)/login/page.tsx` | 00-平台基础架构 | — |
| M0.F03 | 用户登出 | 清除 Supabase session | ✅ 已实现 | `src/app/actions/auth.ts:signOut`, `src/components/layout/topbar.tsx` | 00-平台基础架构 | — |
| M0.F04 | 会话中间件 | 刷新 cookie、保护 dashboard 路由、重定向认证页 | ✅ 已实现 | `src/middleware.ts` | 00-平台基础架构 | — |
| M0.F05 | 组织管理 | 多租户组织表，所有核心表关联 organization_id | ✅ 已实现 | `src/db/schema/users.ts:organizations` | 00-平台基础架构 | — |
| M0.F06 | 用户角色 | user_profiles.role (admin/editor/viewer) | ✅ 已实现 | `src/db/schema/users.ts:userProfiles` | 00-平台基础架构 | — |
| M0.F07 | 当前用户组织获取 | DAL 获取当前认证用户的 org_id | ✅ 已实现 | `src/lib/dal/auth.ts:getCurrentUserOrg` | 00-平台基础架构 | — |
| M0.F08 | Dashboard 布局保护 | layout.tsx 校验认证，未登录重定向 /login | ✅ 已实现 | `src/app/(dashboard)/layout.tsx` | 00-平台基础架构 | — |
| M0.F09 | 侧边栏导航 | 5 组 20+ 页面导航，可折叠，活跃高亮 | ✅ 已实现 | `src/components/layout/app-sidebar.tsx` | 00-平台基础架构 | — |
| M0.F10 | 顶部导航栏 | 面包屑、搜索栏、通知铃铛、用户下拉 | ✅ 已实现 | `src/components/layout/topbar.tsx` | 00-平台基础架构 | — |
| M0.F11 | 根路由重定向 | / 根据认证状态重定向到 /team-hub 或 /login | ✅ 已实现 | `src/app/page.tsx` | 00-平台基础架构 | — |
| M0.F12 | 数据库连接 | Drizzle ORM + postgres driver + PgBouncer prepare:false | ✅ 已实现 | `src/db/index.ts` | 00-平台基础架构 | — |
| M0.F13 | 数据库 Schema 管理 | 60 表 + 37 枚举，27 个 schema 文件，Drizzle 定义 | ✅ 已实现 | `src/db/schema/index.ts` (27 文件) | 00-平台基础架构 | — |
| M0.F14 | 种子数据 | 8 员工 + 28 技能 + 核心技能映射 + 3 团队 + 工作流模板 | ✅ 已实现 | `src/db/seed.ts` (使用 BUILTIN_SKILLS + EMPLOYEE_CORE_SKILLS) | 00-平台基础架构 | connect-pages plan |
| M0.F15 | Supabase 客户端封装 | browser/server/middleware 三端 Supabase 客户端 | ✅ 已实现 | `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` | 00-平台基础架构 | — |
| M0.F16 | Inngest API 路由 | /api/inngest webhook 接入点 | ✅ 已实现 | `src/app/api/inngest/route.ts` | 00-平台基础架构 | distributed-chasing-owl |
| M0.F17 | 通用 UI 组件库 | shadcn/ui 25+ 基础组件 + cn() 工具 | ✅ 已实现 | `src/components/ui/`, `src/lib/utils.ts` | 00-平台基础架构 | — |
| M0.F18 | 领域共享组件 | GlassCard/StatCard/EmployeeAvatar 等 22 个 | ✅ 已实现 | `src/components/shared/` | 00-平台基础架构 | — |
| M0.F19 | RLS 行级安全策略 | Supabase RLS 按 organization_id 隔离数据 | 🔧 部分实现 | `supabase/migrations/` (规划中) | 00-平台基础架构 | connect-pages plan |
| M0.F20 | 社交登录 | OAuth 社交登录（微信/Google 等） | ❌ 未实现 | — | 00-平台基础架构 (隐含) | — |
| M0.F21 | 旧路由重定向 | /hot-topics→/inspiration, /creation→/super-creation, /competitive→/benchmarking | ✅ 已实现 | `src/app/(dashboard)/hot-topics/`, `creation/`, `competitive/` | 代码补充 | — |

---

## M1 — AI资产重构

> 来源：`docs/requirement/01-AI资产重构.md`，功能编号 F1.x.xx

### 1.1 媒资智能理解中心

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M1.F01 | AI 多模态内容理解 | 上传视频后自动执行 ASR/OCR/NLU/人脸检测 | 🔧 部分实现 | schema: `asset_segments`, `asset_tags`, `detected_faces`; action: `triggerUnderstanding`; page: `/asset-intelligence` | F1.1.01 | — |
| M1.F02 | 专业维度自动标注 | 100+ 行业维度自动标注（分类/事件/情绪/人物/地点/拍摄手法） | ✅ 已实现 | schema: `asset_tags` (9 类 tag_category); DAL: `getTagDistribution`; action: `correctTag` | F1.1.02 | — |
| M1.F03 | 知识图谱构建 | 人物/事件/地点/组织节点，自动建立关系 | ✅ 已实现 | schema: `knowledge_nodes`, `knowledge_relations_`; DAL: `getKnowledgeGraph` | F1.1.03 | — |
| M1.F04 | 语义搜索引擎 | 自然语言查询精确视频片段检索 | 🔧 部分实现 | schema: `asset_segments`; DAL: `getAssetSegments` (结构化查询，未实现向量语义搜索) | F1.1.04 | — |
| M1.F05 | 小资对话检索 | 通过与小资对话完成资产搜索 | ❌ 未实现 | — | F1.1.05 | — |
| M1.F06 | 理解进度看板 | 查看理解队列和进度 | ✅ 已实现 | DAL: `getProcessingQueue`, `getQueueStats`; page: `/asset-intelligence` | F1.1.06 | — |
| M1.F07 | 标注纠正反馈 | 人工纠正标签回馈模型 | ✅ 已实现 | action: `correctTag` (更新 source 为 human_correct) | F1.1.07 | — |
| M1.F08 | 标注体系配置 | 管理员自定义扩展标注维度 | ❌ 未实现 | — | F1.1.08 | — |

### 1.2 频道顾问工坊

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M1.F09 | 历史内容自动分析 | 分析频道爆款内容，提取风格特征 | ✅ 已实现 | action: `analyzeChannelDNA`; DAL: `getChannelDNA`; schema: `channel_dna_profiles` | F1.2.01 | — |
| M1.F10 | 内容基因画像 | 雷达图+词云+风格示例（8维评估） | ✅ 已实现 | DAL: `getChannelDNA` (dimensions + report + wordCloud + styleExamples) | F1.2.02 | — |
| M1.F11 | 基因画像刷新 | 定期或手动刷新画像 | ✅ 已实现 | action: `analyzeChannelDNA` (手动触发) | F1.2.03 | — |
| M1.F12 | 文档知识导入 | 批量上传 PDF/Word/Excel，自动解析/分块/向量化 | 🔧 部分实现 | action: `uploadKnowledgeDocument`; schema: `knowledge_items` (向量化状态跟踪，实际处理 Pipeline 未实现) | F1.2.04 | — |
| M1.F13 | 内部 CMS 自动关联 | 自动关联频道历史文章 | ✅ 已实现 | schema: `knowledge_bases.sourceType='cms'`; DAL: `getKnowledgeSources` (按源类型分组) | F1.2.05 | — |
| M1.F14 | 外部知识源订阅 | 配置外部源 URL 定期抓取 | ✅ 已实现 | action: `addKnowledgeSubscription`; schema: `knowledge_bases.syncConfig` | F1.2.06 | — |
| M1.F15 | 知识条目管理 | 查看/编辑/删除条目，支持过期 | ✅ 已实现 | DAL: `getKnowledgeItems`; schema: `knowledge_items.expiresAt` | F1.2.07 | — |
| M1.F16 | 知识实时同步 | 知识库变更自动同步到顾问上下文 | ✅ 已实现 | action: `syncKnowledgeBase`; DAL: `getSyncLogs`; schema: `knowledge_sync_logs` | F1.2.08 | — |
| M1.F17 | 顾问基本信息 | 名称、头像、座右铭、性格描述 | ✅ 已实现 | action: `createChannelAdvisor`; schema: `channel_advisors` | F1.2.09 | — |
| M1.F18 | 风格约束配置 | 语气、偏好词汇、禁用词、替换规则 | ✅ 已实现 | schema: `channel_advisors.styleConstraints`; action: `updateAdvisorPersonality` | F1.2.10 | — |
| M1.F19 | 性格 Prompt 编辑 | 高级模式直接编辑 System Prompt | ✅ 已实现 | schema: `channel_advisors.systemPrompt`; action: `updateAdvisorPersonality` | F1.2.11 | — |
| M1.F20 | 技能绑定 | 选择可用技能组合 | ✅ 已实现 | schema: `channel_advisors.aiEmployeeId` → employee_skills | F1.2.12 | — |
| M1.F21 | 测试对话 | 实时对话窗口验证输出质量 | 🔧 部分实现 | action: `testAdvisorChat` (返回 mock 响应，未接入 LLM) | F1.2.13 | — |
| M1.F22 | 多顾问对比测试 | 对比不同顾问对同一输入的输出 | ❌ 未实现 | — | F1.2.14 | — |
| M1.F23 | 顾问上线/下线 | 控制状态切换 | ✅ 已实现 | action: `toggleAdvisorStatus` (active/training/draft) | F1.2.15 | — |
| M1.F24 | A/B 测试 | 对比不同顾问配置效果 | ❌ 未实现 | — | F1.2.16 | — |

### 1.3 资产盘活引擎

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M1.F25 | 热点-资产智能关联 | 新热点出现时自动匹配内部历史资产 | ✅ 已实现 | DAL: `getHotTopicMatches`; schema: `revive_recommendations` (scenario=hot_match) | F1.3.01 | — |
| M1.F26 | 话题联动推荐 | 话题确认后自动推荐相关资产+二创建议 | ✅ 已实现 | DAL: `getDailyRecommendations`; schema: `revive_recommendations.suggestedAction` | F1.3.02 | — |
| M1.F27 | 内容风格迁移 | 旧内容转新风格（电视报道→短视频脚本） | ✅ 已实现 | action: `generateStyleVariant`; schema: `style_adaptations` | F1.3.03 | — |
| M1.F28 | 每日自动推荐 | 每日 8:00 推送"今日可盘活资产" | 🔧 部分实现 | action: `triggerDailyReviveScan` (占位); DAL: `getDailyRecommendations`; page: `/asset-revive` | F1.3.04 | — |
| M1.F29 | 盘活效果追踪 | 小数追踪二创内容传播效果 | ✅ 已实现 | DAL: `getReviveRecords`, `getReviveTrend`; schema: `revive_records.resultReach` | F1.3.05 | — |

### 代码补充功能（需求/计划未提及）

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M1.F30 | 媒资库管理 | 媒资列表浏览、筛选、统计 | ✅ 已实现 | DAL: `getAssets`, `getAssetStats`; actions: `createAsset`, `updateAsset`, `deleteAsset`; page: `/media-assets` | 代码补充 | — |
| M1.F31 | 国际化适配 | 资产多语言翻译适配 | ✅ 已实现 | action: `generateInternationalAdaptation`; schema: `international_adaptations` | 代码补充 | — |
| M1.F32 | 批量理解触发 | 多选资产批量触发 AI 理解 | ✅ 已实现 | action: `batchTriggerUnderstanding` | 代码补充 | — |
| M1.F33 | 盘活推荐响应 | 采纳/拒绝推荐操作 | ✅ 已实现 | action: `respondToRecommendation` | 代码补充 | — |
| M1.F34 | 场景分布统计 | 按盘活场景类型统计推荐数量 | ✅ 已实现 | DAL: `getScenarioDistribution` | 代码补充 | — |
| M1.F35 | 分类管理 CRUD | 层级分类创建/编辑/删除/排序 | ✅ 已实现 | DAL: `getCategories`, `getCategoryTree`, `getCategory`; actions: `createCategory`, `updateCategory`, `deleteCategory`, `reorderCategories`; page: `/categories` | 代码补充 | — |
| M1.F36 | 文章管理 CRUD | 文章创建/编辑/删除/状态变更/批量操作 | ✅ 已实现 | DAL: `getArticles`, `getArticle`, `getArticleStats`; actions: `createArticle`, `updateArticle`, `deleteArticle`, `updateArticleStatus`, `batchUpdateArticleStatus`; page: `/articles`, `/articles/create`, `/articles/[id]` | 代码补充 | — |

---

## M2 — 智创生产

> 来源：`docs/requirement/02-智创生产.md`，功能编号 F2.x.xx

### 2.1 超级个体创作中心

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M2.F01 | 目标驱动创作启动 | 输入自然语言创作目标，AI 团队自动分工协作 | ✅ 已实现 | action: `createCreationSession`; DAL: `getActiveCreationGoal`; page: `/super-creation` | F2.1.01 | — |
| M2.F02 | AI 写作 | 小文根据选题+角度+素材自动生成初稿 | ✅ 已实现 | action: `updateTaskContent`; DAL: `getCreationTasks`; schema: `tasks.content` | F2.1.02 | — |
| M2.F03 | AI 配图生成 | 根据文章内容自动生成/推荐配图 | ❌ 未实现 | — | F2.1.03 | — |
| M2.F04 | AI 视频脚本 | 小剪根据选题生成视频脚本+分镜 | 🔧 部分实现 | agent: `STEP_INSTRUCTIONS.produce` (分镜指令); schema: `tasks.mediaType='video'` | F2.1.04 | — |
| M2.F05 | AI 短视频制作 | 小剪根据脚本+素材自动制作短视频 | ❌ 未实现 | — | F2.1.05 | — |
| M2.F06 | 多介质切换 | 同时启动图文+视频创作 | ✅ 已实现 | schema: `creation_sessions.mediaTypes` (jsonb[]); page: `/super-creation` | F2.1.06 | — |
| M2.F07 | 素材推荐面板 | 小资实时推荐相关素材到创作区 | 🔧 部分实现 | agent tool: `media_search` (DB 查询 media_assets); 创作页面未集成面板 | F2.1.07 | — |
| M2.F08 | 频道风格约束 | 顾问实时检查内容是否符合频道风格 | 🔧 部分实现 | schema: `channel_advisors.styleConstraints`; agent: sensitive topics injection; 创作时未实时检查 | F2.1.08 | — |
| M2.F09 | 一键多渠道适配 | 小发自动将内容适配为各渠道格式 | 🔧 部分实现 | schema: `publish_plans.adaptedContent`; action: `createPublishPlan` (单渠道); 批量适配未实现 | F2.1.09 | — |
| M2.F10 | AI 文章修改对话 | 对话式修改："把第二段换个写法" | ✅ 已实现 | action: `sendCreationChatMessage`; DAL: `getCreationChatMessages`; schema: `creation_chat_messages` | F2.1.10 | — |
| M2.F11 | 实时合规检查 | 小审创作过程中实时检测敏感内容 | ❌ 未实现 | — (审核在发布前执行，非创作时实时) | F2.1.11 | — |
| M2.F12 | 创作历史版本 | 保留所有创作版本，支持回滚对比 | ✅ 已实现 | action: `updateTaskContent` (创建 contentVersion); schema: `content_versions` | F2.1.12 | — |

### 2.2 竞品对标系统

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M2.F13 | 竞品账号管理 | 配置监控的竞品媒体账号 | ✅ 已实现 | schema: `competitors` (name, platform, followers, avgViews); page: `/benchmarking` | F2.2.01 | — |
| M2.F14 | 竞品排名看板 | 多维度排名：阅读/互动/发布频率/涨粉 | ✅ 已实现 | DAL: `getBenchmarkTopics`; schema: `benchmark_analyses.mediaScores` | F2.2.02 | — |
| M2.F15 | 竞品内容分析 | 小数分析竞品爆款 4 维度 | ✅ 已实现 | action: `createBenchmarkAnalysis` (radarData + improvements); DAL: `getBenchmarkTopics` | F2.2.03 | — |
| M2.F16 | 漏追话题发现 | 小数对比话题覆盖差异 | ✅ 已实现 | action: `createMissedTopic`; DAL: `getMissedTopics`, `getMissedTypeDistribution` | F2.2.04 | — |
| M2.F17 | 差距洞察报告 | 小数生成差距分析+改进建议 | ✅ 已实现 | action: `saveWeeklyReport`; DAL: `getWeeklyReport` (gapList + trends) | F2.2.05 | — |
| M2.F18 | 改进建议追踪 | 追踪建议采纳后效果变化 | ❌ 未实现 | — | F2.2.06 | — |
| M2.F19 | 竞品动态预警 | 小数检测竞品异常时主动推送 | ❌ 未实现 | — | F2.2.07 | — |

### 2.3 热点感知引擎

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M2.F20 | 全网热点扫描 | 小雷 7x24h 扫描 30+ 平台 | ✅ 已实现 | schema: `hot_topics`; DAL: `getInspirationTopics`, `getPlatformMonitors`; page: `/inspiration` | F2.3.01 | — |
| M2.F21 | 热度评分 | 0-100 热度指数+趋势方向 | ✅ 已实现 | schema: `hot_topics.heatScore`, `hot_topics.trend`; action: `updateTopicHeatScore` | F2.3.02 | — |
| M2.F22 | 三级分类 | P0 必追/P1 建议/P2 关注 | ✅ 已实现 | schema: `hot_topics.priority`; action: `updateTopicPriority` | F2.3.03 | — |
| M2.F23 | 热点预警推送 | P0 热点实时推送至团队消息流 | ✅ 已实现 | action: `updateTopicHeatScore` (≥80 发送 Inngest event); inngest: `hotTopicAutoTrigger` | F2.3.04 | optimized-wobbling-emerson F4.A.02 |
| M2.F24 | 角度自动生成 | 小策自动生成 3-5 个选题角度 | ✅ 已实现 | action: `addTopicAngle`; schema: `topic_angles`; DAL: `getInspirationTopics` (含 angles) | F2.3.05 | — |
| M2.F25 | 竞品响应追踪 | 小雷追踪各竞品对热点的响应 | ✅ 已实现 | schema: `competitor_responses`; DAL: `getInspirationTopics` (含 competitorResponses) | F2.3.06 | — |
| M2.F26 | 资产关联 | 小资自动匹配内部相关历史资产 | ✅ 已实现 | 联动 M1.F25: `revive_recommendations` (scenario=hot_match) | F2.3.07 | — |
| M2.F27 | 热点看板 | 独立全景页展示热点全貌 | ✅ 已实现 | page: `/inspiration` (inspiration-client.tsx) | F2.3.08 | — |
| M2.F28 | 评论洞察 | 小策分析评论区热议，发现舆情 | ✅ 已实现 | action: `updateCommentInsight`; schema: `comment_insights` (positive/neutral/negative + hotComments) | F2.3.09 | — |
| M2.F29 | 趋势预测 | 小雷基于历史模型预测热点生命周期 | ❌ 未实现 | — | F2.3.10 | — |

### 2.4 批量生产线

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M2.F30 | 批量任务创建 | 自然语言描述批量生产目标 | ✅ 已实现 | action: `createBatchJob`; DAL: `getBatchTopics`; page: `/video-batch` | F2.4.01 | — |
| M2.F31 | 一源多内容 | 一个选题→多种介质格式 | ✅ 已实现 | schema: `batch_items` (topicTitle + format); DAL: `getBatchTopics` | F2.4.02 | — |
| M2.F32 | 一稿多渠道适配 | 一篇内容→多渠道格式 | ✅ 已实现 | schema: `batch_items.channel`; DAL: `getChannelAdaptations` (静态配置) | F2.4.03 | — |
| M2.F33 | 批量审核看板 | 统一审核界面，支持批量通过/驳回 | ❌ 未实现 | — | F2.4.04 | — |
| M2.F34 | 定时批量产出 | 设定定时任务，AI 团队自动完成 | 🔧 部分实现 | schema: `batch_jobs.scheduledAt`; 实际调度未实现 | F2.4.05 | — |
| M2.F35 | 模板化生产 | 高频内容设定生产模板 | ❌ 未实现 | — | F2.4.06 | — |
| M2.F36 | 批量质检 | 小审统一质检批量内容 | ❌ 未实现 | — | F2.4.07 | — |

### 2.5 节赛会展自动产线

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M2.F37 | 活动预设 | 预设赛程/议程/活动日程/展会信息 | ✅ 已实现 | action: `createEvent`; schema: `events` (4 类型: sport/conference/festival/exhibition); page: `/event-auto` | F2.5.01 | — |
| M2.F38 | 直播流接入 | 接入直播流作为实时素材源 | ❌ 未实现 | — | F2.5.02 | — |
| M2.F39 | 精彩时刻检测 | 小剪实时检测进球/扣篮/重要发言等 | ✅ 已实现 | action: `addEventHighlight`; schema: `event_highlights` (7 类型) | F2.5.03 | — |
| M2.F40 | 自动裁剪 | 精彩时刻自动裁剪为短视频 | ✅ 已实现 | schema: `event_highlights.autoClipped`, `event_highlights.clipUrl` | F2.5.04 | — |
| M2.F41 | 自动解说字幕 | 裁剪内容自动添加解说字幕 | ❌ 未实现 | — | F2.5.05 | — |
| M2.F42 | 自动集锦 | 赛事/会议结束后自动生成集锦 | ✅ 已实现 | action: `createEventOutput` (type=summary); schema: `event_outputs` | F2.5.06 | — |
| M2.F43 | 快速分发 | 生成内容自动分发到预设渠道 | ❌ 未实现 | — | F2.5.07 | — |
| M2.F44 | 赛事数据看板 | 实时展示赛事内容产出和传播数据 | ✅ 已实现 | DAL: `getSportEvent`, `getConferenceEvent`, `getFestivalEvent`, `getExhibitionEvent`; page: `/event-auto` | F2.5.08 | — |

### 代码补充功能

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M2.F45 | 横竖屏转换任务 | 视频横竖屏比例转换管理 | ✅ 已实现 | action: `createConversionTask`, `updateConversionTaskStatus`; DAL: `getConversionTasks` | 代码补充 | — |
| M2.F46 | 数字人配置 | 数字人形象选择 | ✅ 已实现 | DAL: `getDigitalHumans` (静态配置) | 代码补充 | — |
| M2.F47 | 精品内容制作 | 工作流管线+爆款模板+EDL 编辑 | ✅ 已实现 | DAL: `getPipelineNodes`, `getHitTemplates`, `getDefaultEDLProject`; page: `/premium-content` | 代码补充 | — |
| M2.F48 | 爆款模板应用 | 将模板结构应用到任务内容 | ✅ 已实现 | action: `applyHitTemplate` | 代码补充 | — |

---

## M3 — 全渠道传播

> 来源：`docs/requirement/03-全渠道传播.md`，功能编号 F3.x.xx
> 计划来源：`rosy-tumbling-ladybug.md` (M3 详细功能清单)

### 3.1-A 渠道适配与发布

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M3.F01 | 一稿多渠道适配 | 小发自动生成 8 渠道适配版本 | 🔧 部分实现 | schema: `publish_plans.adaptedContent`; action: `createPublishPlan` (单条创建); 自动多渠道适配未实现 | F3.1.01 | rosy-tumbling-ladybug |
| M3.F02 | 适配版本预览 | 并排预览所有渠道版本 | ❌ 未实现 | — | F3.1.02 | rosy-tumbling-ladybug |
| M3.F03 | 智能发布时间推荐 | 基于历史数据推荐最佳发布时间 | ❌ 未实现 | — | F3.1.03 | rosy-tumbling-ladybug |
| M3.F04 | 一键批量发布 | 多渠道同步/分时发布 | 🔧 部分实现 | action: `updatePublishPlanStatus`; 实际 API 推送未实现 | F3.1.04 | rosy-tumbling-ladybug |
| M3.F05 | 条件触发发布 | 热度达 80 自动发布等 | 🔧 部分实现 | schema: `publish_plans.triggerConditions`; 条件引擎未实现 | F3.1.05 | rosy-tumbling-ladybug |
| M3.F06 | 发布日历 | 日历视图展示排期 | ❌ 未实现 | — | F3.1.06 | rosy-tumbling-ladybug |
| M3.F07 | 渠道账号管理 | 管理 8 平台账号授权 | ✅ 已实现 | action: `createChannel`, `updateChannelStatus`, `deleteChannel`; DAL: `getChannels`; schema: `channels` (apiConfig) | F3.1.07 | rosy-tumbling-ladybug |

### 3.1-B 智能审核

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M3.F08 | 多媒介自动审核 | 文字/图片/视频合规检测 | ✅ 已实现 | action: `createReviewResult`; DAL: `getReviewResults`; schema: `review_results.issues` (type/severity/location/description/suggestion) | F3.1.08 | rosy-tumbling-ladybug |
| M3.F09 | 分渠道审核规则 | 不同渠道不同审核严格度 | ✅ 已实现 | schema: `review_results.channelRules` (channelId + strictnessLevel + customRules) | F3.1.09 | rosy-tumbling-ladybug |
| M3.F10 | 问题标注与建议 | 标注具体位置+修改建议+一键采纳 | ✅ 已实现 | schema: `review_results.issues[]` (location + suggestion); action: `resolveReviewIssue` | F3.1.10 | rosy-tumbling-ladybug |
| M3.F11 | 审核结果通知 | 审核结果通过团队消息流通知 | ✅ 已实现 | action: `createReviewResult` (发送 teamMessage); inngest: `onReviewCompleted` | F3.1.11 | rosy-tumbling-ladybug |
| M3.F12 | 敏感内容升级 | 高敏感自动升级人工审核 | ✅ 已实现 | action: `updateReviewStatus` (status=escalated); schema: `review_results.escalatedAt`, `escalationReason` | F3.1.12 | rosy-tumbling-ladybug |

### 3.1-C 数据分析

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M3.F13 | 全渠道数据聚合 | 汇聚 8 渠道数据到统一看板 | ✅ 已实现 | DAL: `getAnalyticsSummary`, `getChannelComparison`; page: `/analytics` | F3.1.13 | rosy-tumbling-ladybug |
| M3.F14 | 实时传播监控 | 阅读/互动/粉丝增长实时更新 | ✅ 已实现 | DAL: `getViewsTrend`; schema: `channel_metrics` | F3.1.14 | rosy-tumbling-ladybug |
| M3.F15 | 六维传播评估 | 广度/深度/共鸣/时效/精品率/涨粉雷达图 | ✅ 已实现 | DAL: `getSixDimensionScores`; page: `/analytics` (radar chart) | F3.1.15 | rosy-tumbling-ladybug |
| M3.F16 | 效果自动报告 | 日/周/月自动生成报告推送团队 | ✅ 已实现 | inngest: `weeklyAnalyticsReport` (每周一 9:00 cron); DAL: `getAnalyticsSummary` | F3.1.16 | rosy-tumbling-ladybug |
| M3.F17 | 异常数据预警 | 阅读暴跌/负面评论激增等预警 | ✅ 已实现 | DAL: `getAnomalyAlerts` (>50%跌幅/>40%互动下降/>200%峰值); inngest: `onAnomalyDetected` | F3.1.17 | rosy-tumbling-ladybug |
| M3.F18 | 内容效果评分 | 每条发布内容 0-100 综合效果评分 | ✅ 已实现 | DAL: `getTopContent` (engagement score 计算) | F3.1.18 | rosy-tumbling-ladybug |

### 3.2 AI 原生运营型旗舰 APP

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M3.F19 | AI 稿件解读 | 划词解释+背景补充+多角度观点 | ❌ 未实现 | — (C 端产品，独立项目) | F3.2.01 | rosy-tumbling-ladybug |
| M3.F20 | AI 互动问答 | 基于频道知识库回答用户提问 | ❌ 未实现 | — (C 端产品) | F3.2.02 | rosy-tumbling-ladybug |
| M3.F21 | AI 数字人主播 | 7x24h AI 新闻播报 | ❌ 未实现 | — (C 端产品) | F3.2.03 | rosy-tumbling-ladybug |
| M3.F22 | 个性化推荐 | 基于用户行为的 Feed 推荐 | ❌ 未实现 | — (C 端产品) | F3.2.04 | rosy-tumbling-ladybug |
| M3.F23 | 生态服务聚合 | 本地生活服务接入 | ❌ 未实现 | — (C 端产品) | F3.2.05 | rosy-tumbling-ladybug |

### 3.3 内容精品率提升系统

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M3.F24 | 竞品爆款学习 | 小数每周追踪竞品爆款 4 维度 | ✅ 已实现 | action: `addCompetitorHit`; DAL: `getCompetitorHits`; schema: `competitor_hits.successFactors` | F3.3.01 | rosy-tumbling-ladybug |
| M3.F25 | 优秀案例库 | 评分>=80 自动入库+成功要素标签 | ✅ 已实现 | action: `addToCaseLibrary`; DAL: `getCaseLibraryItems`; schema: `case_library`; page: `/case-library` | F3.3.02 | rosy-tumbling-ladybug |
| M3.F26 | 爆品指数预测 | 发布前 0-100 爆品指数评分 | ✅ 已实现 | action: `createHitPrediction`; DAL: `getHitPredictions`; schema: `hit_predictions.dimensions`; page: `/content-excellence` | F3.3.03 | rosy-tumbling-ladybug |
| M3.F27 | AI 改进建议 | 基于爆品模型对比给出改进建议 | ✅ 已实现 | schema: `hit_predictions.suggestions[]` (area + current + recommended + impact) | F3.3.04 | rosy-tumbling-ladybug |
| M3.F28 | 改进建议追踪 | 建议采纳后 7 天效果追踪 | 🔧 部分实现 | action: `updateHitPredictionActual`; schema: `hit_predictions.actualScore`; 自动追踪未实现 | F3.3.05 | rosy-tumbling-ladybug |
| M3.F29 | 效果激励看板 | 编辑个人积分排行榜 | ❌ 未实现 | — | F3.3.06 | rosy-tumbling-ladybug |

### 代码补充功能

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M3.F30 | 发布计划 CRUD | 发布计划创建/状态变更/删除/改期 | ✅ 已实现 | actions: `createPublishPlan`, `updatePublishPlanStatus`, `deletePublishPlan`, `reschedulePublishPlan` | 代码补充 | — |
| M3.F31 | 发布状态消息通知 | 发布成功/失败自动推送团队消息 | ✅ 已实现 | action: `updatePublishPlanStatus` (发送 teamMessage); inngest: `onPlanStatusChanged` | 代码补充 | — |
| M3.F32 | 渠道时段指标查询 | 按日期范围查询渠道指标 | ✅ 已实现 | DAL: `getChannelMetricsRange` | 代码补充 | — |

---

## M4 — AI团队引擎

> 来源：`docs/requirement/04-AI团队引擎.md`，功能编号 F4.x.xx
> 计划来源：`optimized-wobbling-emerson.md` (完整功能清单), `distributed-chasing-owl.md` (架构设计), `2026-03-06-module4-ai-team-engine.md` (关键缺口计划)

### 4.1 AI 员工管理

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F01 | 预设员工市场 | 9 名预设 AI 员工角色 (8 专员+1 顾问) | ✅ 已实现 | `src/lib/constants.ts:EMPLOYEE_META`; `src/db/seed.ts`; page: `/employee-marketplace` | F4.1.01 | F4.1.01 |
| M4.F02 | 自定义员工创建 | 基于角色模板+技能组合创建自定义员工 | ✅ 已实现 | action: `createEmployee`; dialog: `employee-create-dialog.tsx` | F4.1.02 | F4.1.02 |
| M4.F03 | 员工资料查看 | 查看基本信息/技能/绩效/偏好/知识库 | ✅ 已实现 | DAL: `getEmployeeFullProfile`; page: `/employee/[id]` | F4.1.03 | F4.1.03 |
| M4.F04 | 员工资料编辑 | 编辑名称/职称/座右铭/权限级别 | ✅ 已实现 | action: `updateEmployeeProfile` | F4.1.04 | F4.1.04 |
| M4.F05 | 员工克隆 | 快速复制现有员工（含技能绑定） | ✅ 已实现 | action: `cloneEmployee` | F4.1.07 | F4.1.05 |
| M4.F06 | 员工删除 | 删除自定义员工（预设员工不可删除） | ✅ 已实现 | action: `deleteEmployee` | — | F4.1.06 |
| M4.F07 | 员工禁用/启用 | 通过 disabled 标志禁用员工 | ✅ 已实现 | action: `toggleEmployeeDisabled`; schema: `ai_employees.disabled` | — | F4.1.07 |
| M4.F08 | 员工导出/导入 | 导出员工配置为 JSON / 跨组织导入 | ✅ 已实现 | actions: `exportEmployee`, `importEmployee` | — | F4.1.08 |
| M4.F09 | 员工版本历史 | 记录配置变更，支持回滚 | ❌ 未实现 | — | — | F4.1.09 |
| M4.F10 | 状态实时显示 | 显示 working/idle/learning/reviewing 状态 | ✅ 已实现 | schema: `ai_employees.status`, `currentTask`; page: `/team-hub` | F4.1.03 | F4.1.10 |
| M4.F11 | 手动状态更新 | 管理员可更新状态和任务描述 | ✅ 已实现 | action: `updateEmployeeStatus` | — | F4.1.11 |
| M4.F12 | 状态自动切换 | 工作流执行时自动切换 working/idle | ✅ 已实现 | inngest: `execute-workflow.ts` (activate: idle→working, save: →idle) | — | F4.1.12 |
| M4.F13 | 状态变更通知 | 状态变更通过团队消息推送 | ✅ 已实现 | action: `updateEmployeeStatus` (发送 teamMessages 到所有所属团队) | — | F4.1.13 |
| M4.F14 | 四级权限定义 | observer→advisor→executor→coordinator | ✅ 已实现 | schema: `ai_employees.authorityLevel`; enum: `authority_level` | F4.1.05 | F4.1.14 |
| M4.F15 | 权限级别配置 UI | 员工资料页调整权限级别 | ✅ 已实现 | action: `updateAuthorityLevel`; page: `/employee/[id]` | F4.1.05 | F4.1.15 |
| M4.F16 | 权限执行拦截 | observer/advisor 输出自动标记 needs_approval | ✅ 已实现 | agent: `execution.ts` (权限后处理) | F4.1.05 | F4.1.16 |
| M4.F17 | 自动执行操作列表 | 配置员工可自动执行的操作 | ✅ 已实现 | action: `updateAutoActions`; schema: `ai_employees.autoActions` | F4.1.05 | F4.1.17 |
| M4.F18 | 需审批操作列表 | 配置需人工审批的操作 | ✅ 已实现 | schema: `ai_employees.needApprovalActions`; action: `updateAutoActions` | F4.1.05 | F4.1.18 |
| M4.F19 | 动态权限调整 | 基于绩效和信任度自动升降级 | ❌ 未实现 | — | — | F4.1.19 |
| M4.F20 | 工作偏好配置 | 主动性/汇报频率/自治度/沟通风格/工作时段 | ✅ 已实现 | action: `updateWorkPreferences`; schema: `ai_employees.workPreferences` | F4.1.06 | F4.1.20-21 |
| M4.F21 | 偏好注入 Prompt | 工作偏好实际影响 Agent 系统提示词 | ✅ 已实现 | agent: `prompt-templates.ts` (Layer 5: Work Style) | F4.1.06 | F4.1.22 |
| M4.F22 | 偏好模板 | 预设模板（高自治/严格审批等） | ❌ 未实现 | — | — | F4.1.23 |
| M4.F23 | 绩效指标存储 | tasksCompleted/accuracy/avgResponseTime/satisfaction | ✅ 已实现 | schema: `ai_employees` (4 字段) | F4.1.08 | F4.1.24 |
| M4.F24 | 绩效看板 | 绩效 Tab 展示 4 指标卡片 | ✅ 已实现 | page: `/employee/[id]` (Performance Tab) | F4.1.08 | F4.1.25 |
| M4.F25 | 绩效自动更新 | 步骤完成后自动更新 tasksCompleted/avgResponseTime | ✅ 已实现 | inngest: `execute-workflow.ts` (save step: tasksCompleted++, avgResponseTime) | — | F4.1.26 |
| M4.F26 | 绩效趋势图 | 时间序列绩效变化可视化 | ❌ 未实现 | — | — | F4.1.27 |
| M4.F27 | 团队绩效对比 | 不同 AI 员工效率对比 | ❌ 未实现 | — | — | F4.1.28 |

### 4.1 技能管理

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F28 | 六大技能分类 | perception/analysis/generation/production/management/knowledge | ✅ 已实现 | schema: enum `skill_category`; DAL: `getSkills(category?)` | F4.1.20 | F4.1.30 |
| M4.F29 | 三种技能类型 | builtin/custom/plugin | ✅ 已实现 | schema: enum `skill_type` | F4.1.20 | F4.1.31 |
| M4.F30 | 技能库浏览 | 按分类浏览筛选 | ✅ 已实现 | DAL: `getSkills`; dialog: `skill-browser-dialog.tsx` | F4.1.20 | F4.1.32 |
| M4.F31 | 技能详情 | 输入/输出 Schema, 运行时配置, 兼容角色 | 🔧 部分实现 | schema: `skills.inputSchema`, `outputSchema`, `runtimeConfig`, `compatibleRoles`; UI 未完整展示 | F4.1.21 | F4.1.33 |
| M4.F32 | 技能在线测试 | 选择技能→输入参数→查看执行结果 | ❌ 未实现 | — | F4.1.21 | F4.1.34 |
| M4.F33 | 绑定技能 | 绑定技能到员工，默认熟练度 50 | ✅ 已实现 | action: `bindSkillToEmployee`; dialog: `skill-browser-dialog.tsx` | F4.1.04 | F4.1.35 |
| M4.F34 | 解绑技能 | 解除员工技能绑定 | ✅ 已实现 | action: `unbindSkillFromEmployee` | F4.1.04 | F4.1.36 |
| M4.F35 | 调整熟练度 | 滑块调整 0-100 熟练度 | ✅ 已实现 | action: `updateSkillLevel` | — | F4.1.37 |
| M4.F36 | 可绑定过滤 | 查询员工尚未绑定的技能 | ✅ 已实现 | DAL: `getSkillsNotBoundToEmployee` | — | F4.1.38 |
| M4.F37 | 兼容性校验 | 绑定时校验技能与员工角色兼容性 | ✅ 已实现 | action: `bindSkillToEmployee` (检查 compatibleRoles) | — | F4.1.39 |
| M4.F38 | 技能驱动工具集 | 员工绑定技能决定 Agent 可用工具 | ✅ 已实现 | agent: `assembly.ts` (resolveTools from skill names) | — | F4.1.40 |
| M4.F39 | 技能版本管理 | 版本迭代/灰度/回滚 | ❌ 未实现 | — | F4.1.22 | F4.1.41 |
| M4.F40 | 自定义技能集成 | 第三方通过 API 集成自定义技能 | ❌ 未实现 | — | F4.1.23 | F4.1.42 |
| M4.F41 | 技能组合 (Combo) | 多技能串联为复合技能 | ❌ 未实现 | — | F4.1.24 | F4.1.43 |
| M4.F42 | 自动熟练度提升 | 基于 qualityScore 自动调整: >=90 +2, >=80 +1, <60 -1 | ✅ 已实现 | inngest: `execute-workflow.ts:230-255` (update-skills step) | — | F4.1.44, agent-opt-design |

### 4.1 团队管理

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F43 | 三步创建向导 | 场景→成员选择/推荐→规则 | ✅ 已实现 | page: `/team-builder`; team-builder-client.tsx | F4.1.10 | F4.1.50 |
| M4.F44 | 四种预设场景 | breaking_news/deep_report/social_media/custom | ✅ 已实现 | page: `/team-builder` (teamScenarios) | F4.1.11 | F4.1.51 |
| M4.F45 | 智能成员推荐 | 自动推荐最佳 AI 员工组合 | 🔧 部分实现 | page: `/team-builder` (场景选择后有推荐逻辑); 推荐算法简单 | F4.1.10 | F4.1.52 |
| M4.F46 | 混合成员支持 | 团队可包含 AI 和人类成员 | ✅ 已实现 | schema: `team_members.memberType` (ai/human); dialog: `add-member-dialog.tsx` | F4.1.13 | F4.1.53 |
| M4.F47 | 团队模板库 | 预设模板一键创建 | 🔧 部分实现 | page: `/team-builder` (teamScenarios 有模板); 不可扩展 | F4.1.11 | F4.1.54 |
| M4.F48 | 审批必要性 | approvalRequired 控制审核步骤是否需审批 | ✅ 已实现 | schema: `teams.rules.approvalRequired`; inngest: `execute-workflow.ts` | F4.1.14 | F4.1.55 |
| M4.F49 | 汇报频率 | real-time/hourly/4-hourly/daily | ✅ 已实现 | schema: `teams.rules.reportFrequency` | F4.1.14 | F4.1.56 |
| M4.F50 | 敏感话题列表 | politics/military/law/ethics/disaster/vulgar | ✅ 已实现 | schema: `teams.rules.sensitiveTopics` | F4.1.14 | F4.1.57 |
| M4.F51 | 敏感话题执行 | 话题注入 Agent Prompt，影响审批严格度 | ✅ 已实现 | agent: `prompt-templates.ts` (Layer 3.5); inngest: `execute-workflow.ts` | — | F4.1.58 |
| M4.F52 | 升级策略 | 定义触发升级的条件（敏感度/质量阈值） | ✅ 已实现 | action: `updateEscalationPolicy`; schema: `teams.escalationPolicy` | F4.1.15 | F4.1.59 |
| M4.F53 | 多步审批配置 | 任意步骤设置审批门控 | ✅ 已实现 | schema: `teams.rules.approvalSteps`; page: `/team-builder/[id]` (审批配置 UI) | — | F4.1.60 |
| M4.F54 | 条件审批 | 基于敏感度/质量分动态决定审批需求 | 🔧 部分实现 | inngest: `execute-workflow.ts` (quality-based auto-escalation F4.A.05); 完整规则引擎未实现 | — | F4.1.61 |
| M4.F55 | 工作流模板关联 | 团队关联默认工作流模板 | ✅ 已实现 | schema: `teams.workflowTemplateId` | — | F4.1.62 |
| M4.F56 | 添加 AI 成员 | 添加 AI 员工到团队 | ✅ 已实现 | action: `addTeamMember`; dialog: `add-member-dialog.tsx` | F4.1.12 | F4.1.63 |
| M4.F57 | 添加人类成员 | 添加人类成员到团队 | ✅ 已实现 | action: `addTeamMember` (memberType='human') | F4.1.13 | F4.1.64 |
| M4.F58 | 移除成员 | 从团队移除成员 | ✅ 已实现 | action: `removeTeamMember` | F4.1.12 | F4.1.65 |
| M4.F59 | 调整成员角色 | 修改成员在团队中的职责 | ✅ 已实现 | action: `updateTeamMemberRole` | — | F4.1.66 |
| M4.F60 | 成员详情显示 | AI 成员显示技能/状态/绩效 | ✅ 已实现 | DAL: `getTeamWithMembers` (含 employee 全量数据); page: `/team-builder/[id]` | — | F4.1.67 |
| M4.F61 | 团队列表 | 查看组织所有团队 | ✅ 已实现 | DAL: `getTeams`; page: `/team-builder` | F4.1.16 | F4.1.68 |
| M4.F62 | 团队信息更新 | 修改团队名称/场景 | ✅ 已实现 | action: `updateTeam` | — | F4.1.69 |
| M4.F63 | 团队删除 | 删除团队（级联 team_members） | ✅ 已实现 | action: `deleteTeam` | — | F4.1.70 |
| M4.F64 | 团队详情页 | /team-builder/[id] 显示详情/成员/规则 | ✅ 已实现 | page: `/team-builder/[id]` (team-detail-client.tsx) | — | F4.1.71 |
| M4.F65 | 团队效率报告 | 团队级综合效率分析 | ❌ 未实现 | — | F4.1.17 | F4.1.72 |

### 4.1 工作流引擎

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F66 | 模板定义 | workflow_templates 表 + steps (JSONB) | ✅ 已实现 | schema: `workflow_templates`; DAL: `getWorkflowTemplates` | — | F4.1.80 |
| M4.F67 | 标准 8 步管线 | monitor→plan→material→create→produce→review→publish→analyze | ✅ 已实现 | `src/lib/constants.ts:WORKFLOW_STEPS` | — | F4.1.81 |
| M4.F68 | 模板查询 | 查询组织可用模板 | ✅ 已实现 | DAL: `getWorkflowTemplates` | — | F4.1.82 |
| M4.F69 | 自定义模板创建 | 用户创建模板选择步骤和负责人 | ✅ 已实现 | action: `createWorkflowTemplate` | — | F4.1.83 |
| M4.F70 | 模板编辑/删除 | 修改或删除模板 | ✅ 已实现 | actions: `updateWorkflowTemplate`, `deleteWorkflowTemplate` | — | F4.1.84 |
| M4.F71 | 创建实例 | 从模板创建工作流实例和步骤记录 | ✅ 已实现 | action: `startWorkflow` (workflow-engine.ts) | — | F4.1.85 |
| M4.F72 | 触发 Inngest 执行 | 发送 workflow/started 事件触发异步执行 | ✅ 已实现 | action: `startWorkflow`; inngest event: `workflow/started` | — | F4.1.86 |
| M4.F73 | 取消工作流 | 取消运行中的工作流 | ✅ 已实现 | action: `cancelWorkflow`; inngest: `cancelOn` | — | F4.1.87 |
| M4.F74 | 实例状态追踪 | active/completed/cancelled | ✅ 已实现 | schema: `workflow_instances.status`, `inngestRunId`, `currentStepKey` | — | F4.1.88-89 |
| M4.F75 | 工作流启动 UI | Team Hub "启动工作流" 按钮+表单 | ✅ 已实现 | dialog: `start-workflow-dialog.tsx`; page: `/team-hub` | — | F4.1.90 |
| M4.F76 | 顺序执行 | 步骤按 step_order 顺序执行 | ✅ 已实现 | inngest: `execute-workflow.ts` (for 循环) | — | F4.1.91 |
| M4.F77 | Agent 组装与执行 | 加载员工→组装 Agent→调用 LLM→解析输出 | ✅ 已实现 | agent: `assembly.ts`, `execution.ts` | — | F4.1.92 |
| M4.F78 | 步骤状态流转 | pending→active→completed/skipped/waiting_approval/failed | ✅ 已实现 | inngest: `execute-workflow.ts`; enum: `workflow_step_status` | — | F4.1.93 |
| M4.F79 | 输出持久化 | text→output, structured→structuredOutput (JSONB) | ✅ 已实现 | schema: `workflow_steps.output`, `structuredOutput` | — | F4.1.94 |
| M4.F80 | 上下文传递 | 前一步输出 (summary+artifacts) 自动传给下一步 | ✅ 已实现 | agent: `prompt-templates.ts:formatPreviousStepContext`, `buildPreviousStepDetailContext` | — | F4.1.95 |
| M4.F81 | 进度回调 | 实时进度更新 10%→30%...→100% | ✅ 已实现 | agent: `execution.ts` (onProgress callback) | — | F4.1.96 |
| M4.F82 | 无分配步骤跳过 | 未分配员工的步骤自动标记 skipped | ✅ 已实现 | inngest: `execute-workflow.ts` (skip check) | — | F4.1.97 |
| M4.F83 | 重试机制 | 失败时自动重试（Inngest retries: 1） | ✅ 已实现 | inngest: `execute-workflow.ts` (retries: 1) | — | F4.1.98 |
| M4.F84 | 并行步骤执行 | 多个独立步骤并行执行 | ❌ 未实现 | — | — | F4.1.99 |
| M4.F85 | 条件分支 | 基于输出条件走不同路径 | ❌ 未实现 | — | — | F4.1.100 |

### 4.1 审批门控系统

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F86 | 审批等待机制 | waitForEvent 等待 24h | ✅ 已实现 | inngest: `execute-workflow.ts` (step.waitForEvent) | — | F4.1.101 |
| M4.F87 | 审批操作 | 人工批准或驳回+反馈 | ✅ 已实现 | action: `approveWorkflowStep` | — | F4.1.102 |
| M4.F88 | 审批消息 | 发送 decision_request 消息+按钮 | ✅ 已实现 | inngest: `execute-workflow.ts` (approval message with action buttons) | — | F4.1.103 |
| M4.F89 | 驳回处理 | 驳回/超时→步骤失败+原因记录+工作流停止 | ✅ 已实现 | inngest: `execute-workflow.ts` (rejection logic) | — | F4.1.104 |
| M4.F90 | 审批 UI | Team Hub 消息按钮连接 approveWorkflowStep | ✅ 已实现 | component: `message-bubble.tsx` (approve/reject buttons) | — | F4.1.105 |
| M4.F91 | 驳回重做 | 驳回后退回指定步骤重新执行 | ✅ 已实现 | inngest: `execute-workflow.ts` (redo with feedback injection + retryCount) | — | F4.1.106-107 |
| M4.F92 | 批量审批 | 同时批准多个待审工作流步骤 | ✅ 已实现 | action: `batchApproveWorkflowSteps` | — | F4.S.05 |
| M4.F93 | 审批超时策略 | auto_approve/auto_reject/escalate | ✅ 已实现 | inngest: `execute-workflow.ts` (timeout strategy from escalationPolicy) | — | F4.S.07 |
| M4.F94 | 审批看板 | 集中待审批视图 | ❌ 未实现 | — | — | F4.S.06 |

### 4.1 Agent 系统

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F95 | 7 层系统提示词 | Identity→Skills→Authority→Knowledge→Work Style→Learning→Output Format | ✅ 已实现 | agent: `prompt-templates.ts` | — | F4.1.110 |
| M4.F96 | 技能→工具映射 | 技能名称→可执行工具函数 | ✅ 已实现 | agent: `tool-registry.ts:resolveTools` | — | F4.1.111 |
| M4.F97 | 知识库上下文注入 | 加载员工绑定 KB 描述注入 Prompt | ✅ 已实现 | agent: `assembly.ts` (knowledgeContext from employeeKnowledgeBases) | — | F4.1.112 |
| M4.F98 | 模型路由 | 按技能分类自动选择最优 LLM | ✅ 已实现 | agent: `model-router.ts` (6 category→model mappings) | — | F4.1.113 |
| M4.F99 | LLM 调用 | Vercel AI SDK generateText()，`stopWhen: stepCountIs(20)` 硬上限 20 次工具调用 | ✅ 已实现 | agent: `execution.ts:75` | — | F4.1.114, agent-opt-design |
| M4.F100 | 步骤专属指令 | 8 种步骤类型各有详细中文指令 | ✅ 已实现 | agent: `prompt-templates.ts:STEP_INSTRUCTIONS` | — | F4.1.115 |
| M4.F101 | 输出解析 | LLM 文本→结构化 StepOutput | ✅ 已实现 | agent: `step-io.ts:parseStepOutput` | — | F4.1.116 |
| M4.F102 | 权限后处理 | observer/advisor 自动标记 needs_approval | ✅ 已实现 | agent: `execution.ts` (authority check) | — | F4.1.117 |
| M4.F103 | 执行指标记录 | tokenUsed/durationMs/toolCallCount | ✅ 已实现 | agent: `execution.ts` (return metrics) | — | F4.1.118 |
| M4.F104 | web_search 工具 | 搜索互联网获取最新信息 | 🔧 部分实现 | agent: `tool-registry.ts` (Mock 实现) | — | F4.1.121 |
| M4.F105 | content_generate 工具 | 根据大纲生成内容文本 | 🔧 部分实现 | agent: `tool-registry.ts` (Mock 实现) | — | F4.1.122 |
| M4.F106 | fact_check 工具 | 事实核查 | 🔧 部分实现 | agent: `tool-registry.ts` (Mock 实现) | — | F4.1.123 |
| M4.F107 | 未映射技能存根 | 未注册技能自动创建存根工具 | ✅ 已实现 | agent: `tool-registry.ts:resolveTools` (stub for unmapped) | — | F4.1.124 |
| M4.F108 | 真实搜索 API | 接入 Serper/SerpAPI | ❌ 未实现 | — | — | F4.1.125 |
| M4.F109 | 媒资检索工具 | 从 media_assets 表检索素材 | ✅ 已实现 | agent: `tool-registry.ts:media_search` (DB 查询) | — | F4.1.126 |
| M4.F110 | 渠道 API 推送 | 对接平台 API 实际发布 | ❌ 未实现 | — | — | F4.1.127 |
| M4.F111 | 数据报告工具 | 聚合 channel_metrics 分析数据 | 🔧 部分实现 | agent: `tool-registry.ts:data_report` (框架完成，DAL 未接入) | — | F4.1.128 |

### 4.1 知识库与 RAG

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F112 | KB 存储 | knowledge_bases + knowledge_items 表 | ✅ 已实现 | schema: `knowledge-bases.ts` | — | F4.1.130 |
| M4.F113 | 向量化状态 | pending→processing→done→failed | ✅ 已实现 | schema: `knowledge_bases.vectorizationStatus` | — | F4.1.131 |
| M4.F114 | Embedding 存储 | knowledge_items.embedding JSONB | ✅ 已实现 | schema: `knowledge_items.embedding`, `embeddingModel` | — | F4.1.132 |
| M4.F115 | KB 绑定 | M:N employee ↔ knowledge base | ✅ 已实现 | schema: `employee_knowledge_bases`; DAL: `getEmployeeKnowledgeBases` | — | F4.1.133 |
| M4.F116 | RAG 检索 | Agent 执行时从绑定 KB 检索相关文档 | ❌ 未实现 | — (需 embedding 基础设施) | — | F4.1.134 |
| M4.F117 | 文档处理管线 | 上传→分块→嵌入→存储 | ❌ 未实现 | — (需 embedding 基础设施) | — | F4.1.135 |

### 4.1 团队消息

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F118 | 四种消息类型 | alert/decision_request/status_update/work_output | ✅ 已实现 | schema: enum `message_type`; component: `message-bubble.tsx` | — | F4.1.140 |
| M4.F119 | AI 自动消息 | 工作流执行时自动发送状态和输出消息 | ✅ 已实现 | inngest: `execute-workflow.ts`; DAL: `postTeamMessage` | — | F4.1.141 |
| M4.F120 | 人工消息 | 人类可发送团队消息 | ✅ 已实现 | action: `sendTeamMessage` (teams.ts); component: `employee-input-bar.tsx` | — | F4.1.142 |
| M4.F121 | 操作按钮 | 消息附带操作按钮（批准/驳回/查看） | ✅ 已实现 | schema: `team_messages.actions` (jsonb); component: `message-bubble.tsx` | — | F4.1.143 |
| M4.F122 | 附件支持 | 4 种附件: topic_card/draft_preview/chart/asset | ✅ 已实现 | schema: `team_messages.attachments` (jsonb) | — | F4.1.144 |
| M4.F123 | 活动流 | 按时间排序消息展示 | ✅ 已实现 | component: `activity-feed.tsx`; DAL: `getTeamMessages` | — | F4.1.145 |
| M4.F124 | 工作流关联 | 消息关联 workflow instance 和 step | ✅ 已实现 | schema: `team_messages.workflowInstanceId`, `workflowStepKey` | — | F4.1.146 |
| M4.F125 | 跨模块消息 | 审核完成/发布状态/数据异常等推送 | ✅ 已实现 | inngest: `onReviewCompleted`, `onPlanStatusChanged`, `onAnomalyDetected` | — | F4.1.147 |
| M4.F126 | 浏览器通知 | alert/decision_request 触发浏览器推送 | ❌ 未实现 | — | — | F4.1.148 |
| M4.F127 | 未读计数 | 显示未读消息数量 | ❌ 未实现 | — | — | F4.1.149 |
| M4.F128 | 已读标记 | 标记消息已读 | ❌ 未实现 | — | — | F4.1.150 |
| M4.F129 | @提及 | @提及特定员工或人类 | ❌ 未实现 | — | — | F4.1.151 |

### 4.1 自动化模式

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F130 | 全自动执行 | approvalRequired=false: 8 步自动执行 | ✅ 已实现 | inngest: `execute-workflow.ts` (skip approval gate) | — | F4.A.01 |
| M4.F131 | 热点自动触发 | 热度达阈值→自动创建并启动工作流 | ✅ 已实现 | inngest: `hotTopicAutoTrigger`; action: `updateTopicHeatScore` (发送 Inngest event) | — | F4.A.02 |
| M4.F132 | 定时调度 | cron 自动启动周期性内容生产 | 🔧 部分实现 | inngest: `weeklyAnalyticsReport` (周报 cron); 内容生产 cron 未实现 | — | F4.A.03 |
| M4.F133 | 自动数据反馈 | 发布数据自动更新员工绩效 | 🔧 部分实现 | inngest: `execute-workflow.ts` (tasksCompleted++); 发布效果→绩效反馈未实现 | — | F4.A.04 |
| M4.F134 | 自动异常升级 | 全自动遇异常自动切换半自动 | ✅ 已实现 | inngest: `execute-workflow.ts` (quality-based auto-escalation via escalationPolicy) | — | F4.A.05 |
| M4.F135 | 全自动场景模板 | "快讯自动推送"/"赛事速报"/"每日新闻简报" | ❌ 未实现 | — | — | F4.A.06 |
| M4.F136 | 审核步骤审批 | approvalRequired=true: 审核步骤等待审批 | ✅ 已实现 | inngest: `execute-workflow.ts` | — | F4.S.01 |

### 4.2 可视化团队编排 (Q4)

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F137 | 拖拽工作流画布 | React Flow 拖拽 AI 员工节点 | ❌ 未实现 | — | F4.2.01 | F4.2.01 |
| M4.F138 | 条件分支节点 | 基于热度/内容类型/敏感度分支 | ❌ 未实现 | — | F4.2.02 | F4.2.02 |
| M4.F139 | 并行处理节点 | 多员工并行执行独立步骤 | ❌ 未实现 | — | F4.2.03 | F4.2.03 |
| M4.F140 | 人机交互节点 | 关键节点插入人工审批检查点 | ❌ 未实现 | — | F4.2.04 | F4.2.04 |
| M4.F141 | 流程模板保存复用 | 保存画布设计为 workflow_templates | ❌ 未实现 | — | F4.2.05 | F4.2.05 |
| M4.F142 | 流程执行监控 | 实时可视化工作流运行状态 | 🔧 部分实现 | component: `workflow-pipeline.tsx` (非画布形态，管线视图) | F4.2.06 | F4.2.06 |

### 4.3 自学习进化基座 (Q4)

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F143 | 执行日志持久化 | 记录每次 Agent 执行的输入/输出/token/耗时 | ✅ 已实现 | inngest: `execute-workflow.ts` (log step); schema: `execution_logs` | F4.3.01 | F4.3.01 |
| M4.F144 | 用户反馈收集 | 记录用户采纳/拒绝/编辑行为 | ❌ 未实现 | — | F4.3.01 | F4.3.02 |
| M4.F145 | 审批行为日志 | 记录审批率/驳回原因/反馈 | 🔧 部分实现 | inngest: `execute-workflow.ts` (驳回反馈记录在 errorMessage); 独立日志未实现 | — | F4.3.03 |
| M4.F146 | 效果关联 | 发布数据回链到 AI 员工和工作流 | ❌ 未实现 | — | — | F4.3.04 |
| M4.F147 | 偏好模式发现 | 驳回反馈自动写入 learnedPatterns (Record<string, {source, count, lastSeen}>) | ✅ 已实现 | inngest: `execute-workflow.ts:424-457` (learn-from-rejection step); schema: `ai_employees.learnedPatterns` | F4.3.02 | F4.3.05, agent-opt-design |
| M4.F148 | 模式可视化 | 列出已学习模式和置信度 | ❌ 未实现 | — | F4.3.04 | F4.3.06 |
| M4.F149 | 人工纠正 | 用户可删除错误学习模式 | ❌ 未实现 | — | F4.3.05 | F4.3.07 |
| M4.F150 | 自动能力优化 | 基于模式自动调整 Prompt 策略 | ❌ 未实现 | — | F4.3.03 | F4.3.08 |
| M4.F151 | 进化曲线 | 员工能力趋势时间线 | ❌ 未实现 | — | F4.3.04 | F4.3.09 |
| M4.F152 | A/B 测试 | 对比不同策略效果 | ❌ 未实现 | — | — | F4.3.10 |

### 4.C 协同模式 (Q4)

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F153 | AI-人实时聊天 | AI 员工↔人类实时消息协作 | ❌ 未实现 | — | — | F4.C.01 |
| M4.F154 | AI 辅助编辑 | AI 在人工编辑时提供实时建议 | ❌ 未实现 | — | — | F4.C.02 |
| M4.F155 | 并行分工 | 同一内容: AI 初稿+人工选题 | ❌ 未实现 | — | — | F4.C.03 |
| M4.F156 | 共享创作会话 | creation_sessions 支持多 AI+人类 | 🔧 部分实现 | schema: `creation_sessions.teamId`; 实际多人协作未实现 | — | F4.C.04 |
| M4.F157 | 接力模式 | AI 60%→人工完成→AI 继续 | ❌ 未实现 | — | — | F4.C.05 |
| M4.F158 | AI 多方案 | AI 生成多方案→人工选最佳→AI 深化 | ❌ 未实现 | — | — | F4.C.06 |

### 4.M 模式切换 (Q4)

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F159 | 模式预设 | 团队创建时选择默认模式 | ❌ 未实现 | — | — | F4.M.01 |
| M4.F160 | 执行中切换 | 工作流运行中切换模式 | ❌ 未实现 | — | — | F4.M.02 |
| M4.F161 | 混合模式 | 不同步骤不同模式 | ❌ 未实现 | — | — | F4.M.03 |
| M4.F162 | 模式记忆 | 记录模式使用与效果 | ❌ 未实现 | — | — | F4.M.04 |

### 代码补充功能

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4.F163 | 管线步骤更新 | 更新工作流步骤状态/进度/输出 | ✅ 已实现 | action: `updatePipelineStep` (creation.ts) | 代码补充 | — |
| M4.F164 | 工作流实例 CRUD (旧) | createWorkflowInstance + updateWorkflowStepStatus | ✅ 已实现 | action: `workflows.ts` (保留兼容) | 代码补充 | — |
| M4.F165 | 团队规则更新 | 更新团队协作规则 | ✅ 已实现 | action: `updateTeamRules` | 代码补充 | — |
| M4.F166 | 员工 @ 提及交互 | 输入框中 @ 选择 AI 员工 | ✅ 已实现 | component: `employee-input-bar.tsx` | 代码补充 | — |

---

## M4-A — Agent 架构优化（10 项改进要求）

> 来源：用户 10 项改进要求 + `docs/plans/2026-03-07-agent-architecture-optimization-design.md`
> 对应优化设计文档的 7 个部分，涵盖意图拆解、技能体系、记忆系统、工件系统、质量判断、安全权限、技能学习。

### 改进要求 1：用户目标意图的拆解

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4A.F01 | 意图解析器 | LLM 驱动的用户输入分析，生成动态步骤列表（不固定 8 步） | ✅ 已实现 | `src/lib/agent/intent-parser.ts:parseUserIntent` | 改进要求 1 | agent-opt-design 第五部分 |
| M4A.F02 | 意图类型识别 | 6 种意图类型：breaking_news/deep_report/social_campaign/series/event_coverage/routine | ✅ 已实现 | `src/lib/agent/intent-parser.ts:IntentType` | 改进要求 1 | agent-opt-design |
| M4A.F03 | 步骤动态规划 | 按意图类型裁剪步骤：突发跳过视频，深度保留全部 | ✅ 已实现 | `src/lib/agent/intent-parser.ts` (prompt 规划要求) | 改进要求 1 | agent-opt-design |
| M4A.F04 | 意图降级回退 | LLM 失败或 slug 无效时回退到默认 8 步工作流 | ✅ 已实现 | `src/lib/agent/intent-parser.ts:116-126` (catch block + DEFAULT_STEPS) | 改进要求 1 | agent-opt-design |

### 改进要求 2：数字员工技能学习与进阶

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4A.F05 | 质量驱动技能升级 | qualityScore>=90 +2, >=80 +1, <60 -1，渐进式熟练度变化 | ✅ 已实现 | inngest: `execute-workflow.ts:230-255` (update-skills step) | 改进要求 2 | agent-opt-design 第七部分 |
| M4A.F06 | 驳回反馈学习 | 审批驳回时反馈写入 employee_memories(feedback) + learnedPatterns 计数 | ✅ 已实现 | inngest: `execute-workflow.ts:424-457` (learn-from-rejection step) | 改进要求 2 | agent-opt-design 第七部分 |
| M4A.F07 | 熟练度影响 Prompt | 平均 level 0-30 严格执行 / 31-70 适度发挥 / 71-100 自由创新 | ✅ 已实现 | agent: `prompt-templates.ts:84-91` (Layer 2 proficiency guidance) | 改进要求 2 | agent-opt-design 第七部分 |

### 改进要求 3/4：内置技能定义与员工创建时技能匹配

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4A.F08 | 28 个内置技能常量 | 6 类别共 28 个技能，slug 直接对应 tool-registry 工具名 | ✅ 已实现 | `src/lib/constants.ts:BUILTIN_SKILLS` (28 个 BuiltinSkillDef) | 改进要求 3/4 | agent-opt-design 第一部分 |
| M4A.F09 | 8 员工核心技能映射 | 每个员工 4 个 core 绑定技能，创建时自动绑定 | ✅ 已实现 | `src/lib/constants.ts:EMPLOYEE_CORE_SKILLS` (8 映射) | 改进要求 3 | agent-opt-design 第一部分 |
| M4A.F10 | 技能绑定类型 | core(不可解绑)/extended(可解绑)/knowledge(知识库来源) 三种类型 | ✅ 已实现 | schema: `employee_skills.bindingType`; enum: `skill_binding_type` | 改进要求 3/8 | agent-opt-design 第一部分 |
| M4A.F11 | Core 技能解绑保护 | binding_type=core 时拒绝解绑操作 | 🔧 部分实现 | action: `unbindSkillFromEmployee` (逻辑已设计，UI 标识待完善) | 改进要求 3 | agent-opt-design 第一部分 |

### 改进要求 5：数字员工间数据交换与协同

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4A.F12 | 工件持久化表 | workflow_artifacts 表：9 种工件类型 + 结构化/文本双存储 | ✅ 已实现 | schema: `src/db/schema/workflows.ts:91` (workflowArtifacts); enum: `artifact_type` | 改进要求 5 | agent-opt-design 第三部分 |
| M4A.F13 | 步骤间工件传递 | 每步产出写入 DB，下游步骤通过 formatArtifactContext() 消费 | ✅ 已实现 | inngest: `execute-workflow.ts:194-228` (persist-artifacts); agent: `prompt-templates.ts:225-241` (formatArtifactContext) | 改进要求 5 | agent-opt-design 第三部分 |

### 改进要求 6：执行结果判断与修正

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4A.F14 | Agent 质量自评 | Layer 7 要求输出 `【质量自评：XX/100】`，4 维评分标准 | ✅ 已实现 | agent: `prompt-templates.ts:153-164` (Layer 7 self-eval instruction) | 改进要求 6 | agent-opt-design 第四部分 |
| M4A.F15 | 质量分数提取 | 正则提取自评分数 `extractQualityScore()` | ✅ 已实现 | agent: `step-io.ts:20-27` (regex match `【质量自评：XX/100】`) | 改进要求 6 | agent-opt-design 第四部分 |
| M4A.F16 | 三层质量门控 | >=80 正常 / 60-80 按审批配置 / <60 强制人工审批 | ✅ 已实现 | inngest: `execute-workflow.ts:259-279` (quality gate logic) | 改进要求 6 | agent-opt-design 第四部分 |
| M4A.F17 | 人工中途干预 | 步骤执行前检查 team_messages(human+alert)，注入 userInstructions | ✅ 已实现 | inngest: `execute-workflow.ts:111-131` (check-intervention step) | 改进要求 6 | agent-opt-design 第四部分 |

### 改进要求 7：员工记忆系统

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4A.F18 | 记忆存储表 | employee_memories 表：3 种类型(feedback/pattern/preference) + 权重 + 组织隔离 | ✅ 已实现 | schema: `src/db/schema/employee-memories.ts`; enum: `memory_type` | 改进要求 7 | agent-opt-design 第二部分 |
| M4A.F19 | 记忆注入 Prompt | assembleAgent() 加载 top-10 高权重记忆 → Layer 6 经验记忆注入 | ✅ 已实现 | agent: `assembly.ts:74-90` (load memories); `prompt-templates.ts:143-151` (Layer 6) | 改进要求 7 | agent-opt-design 第二部分 |
| M4A.F20 | 记忆写入-驳回 | 驳回反馈写入 feedback 记忆 (importance=0.8) | ✅ 已实现 | inngest: `execute-workflow.ts:427-434` (insert employee_memories) | 改进要求 7 | agent-opt-design 第二部分 |
| M4A.F21 | 记忆写入-完成 | 工作流完成时写入 pattern 记忆 (importance=0.5) | ✅ 已实现 | inngest: `execute-workflow.ts:659-678` (learn-from-completion step) | 改进要求 7 | agent-opt-design 第二部分 |
| M4A.F22 | 记忆组织隔离 | organization_id 强制过滤，employee_id 员工间隔离 | ✅ 已实现 | schema: `employee_memories.organizationId` FK; `assembly.ts` 按 employee_id 查询 | 改进要求 7 | agent-opt-design 第二部分 |

### 改进要求 8：员工与技能的关系

> 已在改进要求 3/4 中覆盖（M4A.F08-F11），此处不重复。核心为 `skill_binding_type` 三级分类 + `EMPLOYEE_CORE_SKILLS` 映射。

### 改进要求 9：安全/权限保障

| 功能编号 | 功能名称 | 功能描述 | 实现状态 | 代码位置 | 需求来源 | 计划来源 |
|----------|----------|----------|----------|----------|----------|----------|
| M4A.F23 | 权限等级约束工具 | observer 无工具 / advisor 只读(14 个) / executor+coordinator 全部 | ✅ 已实现 | agent: `assembly.ts:100-114` (authority-based tool filtering) | 改进要求 9 | agent-opt-design 第六部分 |
| M4A.F24 | Token 预算管控 | workflow_instances.tokenBudget(默认 100000) + tokensUsed，超预算抛错 | ✅ 已实现 | schema: `workflows.ts:53-54`; inngest: `execute-workflow.ts:172-192` (token-budget step) | 改进要求 9 | agent-opt-design 第六部分 |
| M4A.F25 | 工具调用次数限制 | `stopWhen: stepCountIs(20)` 硬上限 20 次/步 | ✅ 已实现 | agent: `execution.ts:75` | 改进要求 9 | agent-opt-design 第六部分 |
| M4A.F26 | DAL 组织隔离 | getCurrentUserOrg() + withOrgScope 在查询中强制 organization_id 过滤 | 🔧 部分实现 | `src/lib/dal/auth.ts:getCurrentUserOrg`; 部分 DAL 仍缺少过滤 | 改进要求 9 | agent-opt-design 第六部分 |

### 改进要求 10：外部类似产品对标与影响

> 市场上类似产品对本系统功能清单的影响分析。

| 外部产品 | 核心特征 | 对 Vibetide 功能清单的影响 | 现状 |
|----------|----------|---------------------------|------|
| **Coze (字节跳动)** | 可视化 Agent 编排、Plugin 市场、Knowledge 集成 | 影响 M4.F137-142 可视化编排（Q4 规划中）；影响 M4.F40 自定义技能集成（未实现） | Q4 计划 |
| **Dify.ai** | RAG Pipeline、Prompt 模板市场、多模型路由 | 影响 M4.F116-117 RAG 集成（需 pgvector）；模型路由已实现 6 类别→3 模型 | RAG 待实施 |
| **FastGPT (LafYun)** | 知识库→工作流→发布一体化 | 影响 M4.F112-115 知识库已实现，RAG 检索待集成 | 部分匹配 |
| **AutoGen (Microsoft)** | 多 Agent 对话协作、自我反思 | 影响 M4A.F14-16 质量自评（已实现）；影响 M4.F153-158 协同模式（Q4） | 自评已实现 |
| **CrewAI** | 角色化 Agent 团队、任务委派、工具共享 | 与 Vibetide 架构高度相似（8 员工+技能+工作流）；影响工件传递（已实现 M4A.F12-13） | 高度匹配 |
| **Jasper AI** | AI 内容营销平台、品牌语音、多渠道适配 | 影响 M1.F17-20 频道顾问/风格约束（已实现）；影响 M3.F01 多渠道适配 | 部分匹配 |
| **新华智云 "媒体大脑"** | 热点监控、自动成稿、视频剪辑 | 与 M2 智创生产高度对标；直播流接入(M2.F38)、自动字幕(M2.F41)为差距项 | 差距存在 |
| **封面新闻 "小封"** | AI 写稿、数字人播报 | 数字人功能仅有静态配置(M2.F46)，实际生成未实现 | 差距存在 |

**外部对标结论：**
- Vibetide 的 **Agent 团队协作模式**（8 员工+技能+工作流）与 CrewAI 架构最为接近，已处于同类产品前列
- **质量自评 + 记忆系统 + 技能学习** 三大闭环形成差异化优势，多数竞品仅有其中 1-2 项
- 主要差距集中在：**RAG 集成**（M4.F116-117）、**可视化编排**（M4.F137-142）、**实际 API 对接**（渠道推送/搜索 API）
- 中国媒体行业竞品（新华智云/封面新闻）在 **直播流处理** 和 **视频合成** 方面更强，这是 Vibetide 需重点补齐的能力

---

## Gap 分析汇总

### 一、需求有但未实现的功能（按优先级排序）

#### P0 优先级
| 编号 | 功能 | 模块 | 说明 |
|------|------|------|------|
| M1.F05 | 小资对话检索 | M1 | F1.1.05 — 需要 Agent chat 界面集成 |

#### P1 优先级
| 编号 | 功能 | 模块 | 说明 |
|------|------|------|------|
| M2.F03 | AI 配图生成 | M2 | F2.1.03 — 需要图像生成 API |
| M2.F05 | AI 短视频制作 | M2 | F2.1.05 — 需要视频合成引擎 |
| M2.F11 | 实时合规检查 | M2 | F2.1.11 — 创作时实时检测 |
| M2.F18 | 改进建议追踪 | M2 | F2.2.06 — 需延迟任务 |
| M2.F19 | 竞品动态预警 | M2 | F2.2.07 — 需竞品监控调度 |
| M2.F33 | 批量审核看板 | M2 | F2.4.04 — 统一审核界面 |
| M2.F35 | 模板化生产 | M2 | F2.4.06 — 高频内容模板 |
| M2.F36 | 批量质检 | M2 | F2.4.07 — 批量合规检测 |
| M2.F38 | 直播流接入 | M2 | F2.5.02 — 需要流媒体对接 |
| M2.F41 | 自动解说字幕 | M2 | F2.5.05 — 需 TTS/字幕引擎 |
| M2.F43 | 快速分发 | M2 | F2.5.07 — 需渠道 API |
| M3.F02 | 适配版本预览 | M3 | F3.1.02 — 多渠道预览 UI |
| M3.F03 | 智能发布时间推荐 | M3 | F3.1.03 — 需历史数据模型 |
| M3.F06 | 发布日历 | M3 | F3.1.06 — 日历组件 |

#### P2 优先级
| 编号 | 功能 | 模块 | 说明 |
|------|------|------|------|
| M1.F08 | 标注体系配置 | M1 | F1.1.08 — 管理员配置 |
| M1.F22 | 多顾问对比测试 | M1 | F1.2.14 |
| M1.F24 | A/B 测试 | M1 | F1.2.16 |
| M2.F29 | 趋势预测 | M2 | F2.3.10 |
| M3.F29 | 效果激励看板 | M3 | F3.3.06 |
| M3.F19-23 | 旗舰 APP 全部 | M3 | F3.2.01-05 (独立 C 端项目) |
| M4.F137-142 | 可视化编排全部 | M4 | F4.2.01-06 (Q4 计划) |
| M4.F144-152 | 自学习进化大部分 | M4 | F4.3.01-10 (Q4 计划) |
| M4.F153-162 | 协同+模式切换 | M4 | F4.C/F4.M (Q4 计划) |

### 二、计划已规划但未实现的功能

| 计划来源 | 功能 ID | 功能名 | 说明 |
|----------|---------|--------|------|
| optimized-wobbling-emerson | F4.1.09 | 员工版本历史 | 配置变更记录+回滚 |
| optimized-wobbling-emerson | F4.1.19 | 动态权限调整 | 自动升降级 |
| optimized-wobbling-emerson | F4.1.23 | 偏好模板 | 预设工作偏好模板 |
| optimized-wobbling-emerson | F4.1.27-28 | 绩效趋势图/对比 | 可视化绩效 |
| optimized-wobbling-emerson | F4.1.34 | 技能在线测试 | 技能测试界面 |
| optimized-wobbling-emerson | F4.1.41-43 | 高级技能管理 | 版本/集成/组合（自动提升 F4.1.44 已实现） |
| optimized-wobbling-emerson | F4.1.99-100 | 并行步骤/条件分支 | 工作流高级流控 |
| optimized-wobbling-emerson | F4.1.125 | 真实搜索 API | 需 API Key |
| optimized-wobbling-emerson | F4.1.127 | 渠道 API 推送 | 需平台 API |
| optimized-wobbling-emerson | F4.1.134-135 | RAG 检索/处理管线 | 需 Embedding 基础设施 |
| optimized-wobbling-emerson | F4.1.148-151 | 通知增强 | 浏览器通知/未读/已读/@提及 |
| optimized-wobbling-emerson | F4.A.03 | 定时调度 | 内容生产 cron |
| optimized-wobbling-emerson | F4.A.06 | 全自动场景模板 | 预设自动化场景 |
| optimized-wobbling-emerson | F4.S.06 | 审批看板 | 集中待审批视图 |

### 三、代码中有但需求/计划未提及的功能

| 编号 | 功能名 | 模块 | 代码位置 |
|------|--------|------|----------|
| M1.F30 | 媒资库管理 CRUD | M1 | actions: assets.ts; page: /media-assets |
| M1.F31 | 国际化适配 | M1 | action: generateInternationalAdaptation; schema: international_adaptations |
| M1.F32 | 批量理解触发 | M1 | action: batchTriggerUnderstanding |
| M1.F33 | 盘活推荐响应 | M1 | action: respondToRecommendation |
| M1.F34 | 场景分布统计 | M1 | DAL: getScenarioDistribution |
| M1.F35 | 分类管理 CRUD | M1 | actions/DAL/page: categories |
| M1.F36 | 文章管理 CRUD | M1 | actions/DAL/page: articles |
| M2.F45 | 横竖屏转换任务 | M2 | actions: batch.ts (conversionTasks) |
| M2.F46 | 数字人配置 | M2 | DAL: getDigitalHumans |
| M2.F47 | 精品内容制作 | M2 | page: /premium-content |
| M2.F48 | 爆款模板应用 | M2 | action: applyHitTemplate |
| M3.F30 | 发布计划 CRUD | M3 | actions: publishing.ts (7 个函数) |
| M3.F31 | 发布状态消息通知 | M3 | inngest: onPlanStatusChanged |
| M3.F32 | 渠道时段指标查询 | M3 | DAL: getChannelMetricsRange |
| M4.F163 | 管线步骤更新 | M4 | action: updatePipelineStep |
| M4.F164 | 工作流实例旧 CRUD | M4 | actions: workflows.ts |
| M4.F165 | 团队规则更新 | M4 | action: updateTeamRules |
| M4.F166 | 员工@提及交互 | M4 | component: employee-input-bar.tsx |
| M0.F21 | 旧路由重定向 | M0 | 3 个 redirect 页面 |

---

## 附录：数据层统计

| 层级 | 文件数 | 函数/表数 |
|------|--------|-----------|
| 数据库 Schema | 27 files | **60 tables, 37 enums** |
| DAL 查询 | 22 files | 79 functions |
| Server Actions | 19 files | 123 functions |
| Dashboard 页面 | 30 pages | 25 client components |
| 共享组件 | 22 components | — |
| Agent 系统 | **8 files** | 5 tools + stub, 7-layer prompt, intent parser, quality extractor |
| Inngest 函数 | 6 functions | 8 event types |

### v2.0 新增数据层

| 新增项 | 说明 |
|--------|------|
| `employee_memories` 表 | 员工记忆存储（3 类型 + 权重 + 组织隔离） |
| `workflow_artifacts` 表 | 工件持久化（9 种类型 + 结构化/文本双存储） |
| `skill_binding_type` 枚举 | core/extended/knowledge 三级绑定类型 |
| `memory_type` 枚举 | feedback/pattern/preference |
| `artifact_type` 枚举 | 9 种工件类型 |
| `workflow_instances.tokenBudget/tokensUsed` | Token 预算管控字段 |
| `employee_skills.bindingType` | 技能绑定类型字段 |
| `src/lib/agent/intent-parser.ts` | 用户意图解析模块 |
| `src/lib/constants.ts:BUILTIN_SKILLS` | 28 个内置技能定义 |
| `src/lib/constants.ts:EMPLOYEE_CORE_SKILLS` | 8 员工核心技能映射 |
