# AI 员工对话中心设计文档

> 日期: 2026-03-22
> 状态: Approved
> 模块: AI 员工市场增强

## 概述

为 Vibetide 平台新增独立的"对话中心"页面，采用 IM 布局（左侧员工列表 + 右侧对话区），让用户可以直接与任意 AI 员工进行自由对话，同时支持通过场景快捷入口进入预定义工作流。为全部 8 个 AI 员工预置专属场景，并支持对话收藏功能。

## 需求决策

| 决策项 | 选择 |
|--------|------|
| 对话模式 | 自由对话 + 场景 |
| 页面形态 | 独立对话中心，IM 双栏布局 |
| 场景预置 | 为全部 8 个员工预置 3-5 个场景 |
| 对话持久化 | 可选持久化，收藏才入库 |
| 场景切换 | 场景作为快捷入口按钮（默认自由对话） |
| 响应式 | 仅桌面端 |
| 工作方式 | 并行 Agent Teams（PM + 全栈开发 + 测试） |

## 1. 路由与页面结构

### 新增路由

```
src/app/(dashboard)/chat/
├── page.tsx                    # Server Component — 加载员工列表
├── chat-center-client.tsx      # Client Component — IM 主布局
├── employee-list-panel.tsx     # 左侧员工列表面板
├── chat-panel.tsx              # 右侧对话面板
└── loading.tsx                 # 加载骨架屏
```

### URL 设计

- `/chat` — 对话中心首页，默认选中第一个员工
- `/chat?employee=xiaolei` — 直接打开与小雷的对话

使用 query param 而非动态路由 `/chat/[slug]`，切换员工时不触发页面级导航，保持 SPA 体验。

### 侧边栏导航

在 `AppSidebar` 中新增"对话中心"菜单项，使用 `MessageSquare` 图标，放在"AI员工市场"下方。

### 数据流

```
page.tsx (Server)
  → getEmployees()
  → 传递 props 给 ChatCenterClient

ChatCenterClient (Client)
  → 管理选中员工状态
  → 按需加载场景 (fetch /api/employees/[slug]/scenarios)
  → 管理对话消息 (本地 state)
  → 收藏时调用 Server Action 写库
```

## 2. 数据模型

### 新增表: `saved_conversations`

```sql
saved_conversations
├── id              UUID PK
├── organization_id UUID FK → organizations
├── user_id         UUID        -- 收藏者 (Supabase auth user)
├── employee_slug   text        -- 对话的员工
├── title           text        -- 对话标题 (自动从首条消息生成，可手动修改)
├── summary         text NULL   -- 可选摘要
├── messages        JSONB       -- 完整消息数组快照
├── scenario_id     UUID NULL   -- 如果从场景发起，关联场景
├── metadata        JSONB NULL  -- 扩展字段 (来源数、技能使用等)
├── created_at      timestamp
├── updated_at      timestamp
```

### messages JSONB 结构

```typescript
interface SavedMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
  durationMs?: number
  thinkingSteps?: { tool: string; label: string; skillName?: string }[]
  skillsUsed?: { tool: string; skillName: string }[]
  sources?: string[]
  referenceCount?: number
}
```

### 设计决策

- 不新增 `conversations` + `conversation_messages` 两张表：只有收藏才入库，JSONB 快照更简单
- `messages` 是快照：收藏时全量序列化，不做增量更新
- 按 `user_id` 隔离：每个用户只看到自己的收藏
- 收藏的对话是只读历史，不支持续接

## 3. API 层

### 3.1 自由对话 API (新增)

```
POST /api/chat/stream
```

**Request Body:**
```typescript
{
  employeeSlug: string
  message: string
  conversationHistory?: Array<{
    role: "user" | "assistant"
    content: string
  }>
}
```

**Response:** SSE 流，与 `/api/scenarios/execute` 格式一致 (thinking / source / text-delta / done / error)。

**实现逻辑:**
1. 认证 + 获取 organizationId
2. 通过 slug 查 employee DB ID
3. `assembleAgent(employeeDbId)` — 复用现有 7 层提示词装配
4. 不注入场景 systemInstruction，用员工自身系统提示词 + 用户消息
5. `streamText()` 流式输出

### 3.2 员工场景查询 API (新增)

```
GET /api/employees/[slug]/scenarios
```

按需加载某员工的场景列表，返回 `ScenarioCardData[]`。

### 3.3 收藏对话 Server Actions (新增)

```typescript
// src/app/actions/conversations.ts

saveConversation(data: {
  employeeSlug: string
  title: string
  messages: SavedMessage[]
  scenarioId?: string
  metadata?: Record<string, unknown>
}) → { id: string }

getSavedConversations(employeeSlug?: string) → SavedConversation[]

deleteSavedConversation(id: string) → void

updateConversationTitle(id: string, title: string) → void
```

### 3.4 现有 API 复用

- `/api/scenarios/execute` — 场景模式对话，不改动
- `getEmployees()` DAL — 员工列表，不改动

## 4. 组件架构

```
ChatCenterClient
├── EmployeeListPanel (左侧 ~280px)
│   ├── SearchInput
│   ├── TabSwitch [员工 | 收藏]
│   ├── EmployeeListItem × N
│   └── SavedConversationItem × N
│
├── ChatPanel (右侧)
│   ├── ChatHeader              -- 员工信息 + 收藏按钮 + 新对话按钮
│   ├── ScenarioBar             -- 场景快捷按钮栏 (横向滚动)
│   │   └── ScenarioChip × N
│   ├── ScenarioFormSheet       -- 场景参数表单 (Sheet)
│   ├── MessageList             -- 消息列表区
│   │   └── ChatMessage × N
│   │       ├── ThinkingSteps
│   │       ├── MarkdownContent
│   │       ├── SourceBadges
│   │       └── SkillBadges
│   └── ChatInput               -- 输入区 (Textarea + SendButton)
│
└── EmptyState                   -- 未选择员工时的空状态
```

### 关键复用

| 现有组件/逻辑 | 复用方式 |
|-------------|---------|
| SSE 流式解析 (parseSSE) | 从 scenario-chat-sheet.tsx 提取为共享 util |
| Markdown 渲染 + 折叠 | 从 collapsible-markdown.tsx 直接引用 |
| 思考步骤/来源/技能展示 | 从 scenario-chat-sheet.tsx 提取为独立组件 |
| 员工头像 + 状态 | 复用 employee-avatar.tsx |
| GlassCard 样式 | 复用 glass-card.tsx |
| 输入框动画边框 | 从 scenario-chat-sheet.tsx 提取复用 |

### 交互细节

- 切换员工: 清空当前对话 (未收藏的提示确认)，加载新员工场景
- 场景快捷按钮: 点击后弹出 Sheet 填写参数，提交后以"场景卡片"形式出现在对话区
- 收藏: 点击顶部收藏按钮，自动取首条用户消息前 20 字作标题
- 新对话: 清空消息区重新开始
- 收藏 Tab: 左侧切换到收藏视图，点击打开只读历史

## 5. 场景预置

为全部 8 个员工共预置 27 个场景。

### 小雷 (热点猎手)
| 场景 | 描述 | 工具 |
|------|------|------|
| 突发热点监控 | 实时搜索特定领域的最新热点话题 | web_search, trending_topics |
| 竞品动态追踪 | 监控竞品的最新动向和内容策略 | web_search, web_deep_read |
| 热点深度解读 | 对某个热点进行多源深挖和分析 | web_search, web_deep_read, trending_topics |

### 小策 (选题策划师)
| 场景 | 描述 | 工具 |
|------|------|------|
| 选题策划 | 根据热点/方向生成内容选题方案 | web_search, trending_topics |
| 受众分析 | 分析目标受众画像和内容偏好 | web_search, web_deep_read |
| 内容日历规划 | 规划一周/一月的内容发布计划 | web_search, trending_topics |

### 小资 (素材管家)
| 场景 | 描述 | 工具 |
|------|------|------|
| 素材搜集 | 根据主题搜集图文视频素材 | media_search, web_search |
| 案例参考 | 搜索行业优秀内容案例 | web_search, web_deep_read |
| 资料整理 | 对某话题进行资料汇编整理 | web_search, web_deep_read, media_search |

### 小文 (内容创作师)
| 场景 | 描述 | 工具 |
|------|------|------|
| 文章创作 | 根据选题和素材撰写完整文章 | content_generate, web_search |
| 标题生成 | 为已有内容生成多组标题方案 | content_generate |
| 脚本创作 | 撰写短视频/直播脚本 | content_generate, web_search |
| 内容改写 | 对已有内容进行风格改写 | content_generate |

### 小剪 (视频制片人)
| 场景 | 描述 | 工具 |
|------|------|------|
| 视频策划 | 根据内容生成视频分镜和制作方案 | content_generate, media_search |
| 封面设计建议 | 根据内容提供封面设计方向 | web_search, media_search |
| 音频方案 | 规划配音、配乐和音效方案 | content_generate |

### 小审 (质量审核官)
| 场景 | 描述 | 工具 |
|------|------|------|
| 内容审核 | 对文章/视频脚本进行质量审核 | fact_check, web_search |
| 合规检查 | 检查内容是否符合平台规范和法规 | fact_check, web_deep_read |
| 事实核查 | 对内容中的事实性陈述进行验证 | fact_check, web_search, web_deep_read |

### 小发 (渠道运营专家)
| 场景 | 描述 | 工具 |
|------|------|------|
| 发布策略 | 制定多渠道发布方案和最佳时间 | web_search, data_report |
| 渠道分析 | 分析各渠道的内容表现和受众特征 | web_search, data_report |
| 推广方案 | 针对特定内容制定推广策略 | web_search |

### 小树 (数据分析师)
| 场景 | 描述 | 工具 |
|------|------|------|
| 数据报告 | 生成内容运营数据分析报告 | data_report, web_search |
| 趋势分析 | 分析行业/话题的数据趋势 | web_search, trending_topics, data_report |
| 效果复盘 | 对已发布内容的效果进行复盘分析 | data_report |

每个场景配置完整的 systemInstruction 模板、inputFields 表单字段和 toolsHint，通过 seed 脚本写入 employee_scenarios 表。

## 6. 交互流程

### 流程一: 自由对话

```
用户进入 /chat
  → 左侧加载员工列表 (默认选中小雷)
  → 右侧加载小雷的场景快捷按钮
  → 用户输入消息
  → POST /api/chat/stream
  → SSE 流式响应: thinking → source → text-delta → done
  → 消息渲染到对话区
  → 用户可继续追问 (前端自动带上 conversationHistory)
```

### 流程二: 场景模式对话

```
用户点击场景快捷按钮
  → 弹出 ScenarioFormSheet 填写参数
  → 提交后对话区出现"场景卡片"消息
  → 自动发起 POST /api/scenarios/execute
  → 后续追问自动切换为 /api/chat/stream (带完整 history)
```

### 流程三: 收藏对话

```
用户点击顶部收藏按钮
  → 自动取首条用户消息前 20 字作为标题
  → Toast 确认 "已收藏对话"
  → 调用 saveConversation() Server Action
  → 左侧"收藏"Tab 出现新条目
```

### 流程四: 查看收藏

```
用户切换到左侧"收藏"Tab
  → 加载收藏列表
  → 点击某条打开只读对话历史
  → 顶部显示"收藏对话 · 只读"标识
```

### 流程五: 切换员工

```
用户点击其他员工
  → 未收藏对话: 提示"当前对话未收藏，是否丢弃？"
  → 清空对话区，加载新员工场景
```

### 流程六: 从员工市场跳转

```
员工市场卡片增加"对话"快捷按钮
  → 点击跳转 /chat?employee=xiaolei
```

## 7. 实施方式

使用并行 Agent Teams:
- **PM Agent**: 验证需求完整性，审查设计与代码是否一致
- **全栈开发 Agent**: 实现 schema、DAL、API、前端组件、seed 脚本
- **测试 Agent**: 类型检查、构建验证、功能完整性检查

## 8. 员工市场页面增强

在现有 `/employee-marketplace` 页面的员工卡片上增加"对话"快捷按钮:
- 按钮使用 MessageSquare 图标
- 点击跳转到 `/chat?employee={slug}`
- 不改变现有卡片其他功能
