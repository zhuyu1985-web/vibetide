# Change: Add Knowledge Base Management Module

## Why

系统数据库里已经有完整的 `knowledge_bases` / `knowledge_items` / `knowledge_sync_logs` / `employee_knowledge_bases` 四张表，Agent assembly 也已经通过员工绑定读取 KB 写入 7 层系统提示词（`src/lib/agent/assembly.ts:51-58`），但前端**根本没有一个地方可以创建、编辑、删除知识库，也没有办法往 KB 里添加文档**。目前的链路是断的：

- 员工资料页的 "知识库" Tab 只能从 `KBBrowserDialog` 里选**已存在**的 KB 进行绑定
- 那些 "已存在" 的 KB 只能靠 seed 脚本或直接写库产生
- `/channel-knowledge` 是"频道 DNA 分析看板"，不是 KB 管理入口，且数据源和 `knowledge_bases` 表是两套概念
- `knowledge_items` 有 `embedding` 字段但没有任何代码在写入或检索它 — 检索能力停留在 schema 层

这次改动要把这条链路补齐，让运营人员能在界面上管理 KB + 文档，并让 Agent 能真正通过语义检索消费 KB 内容。

## What Changes

### 新增顶级模块 `/knowledge-bases`
- 列表页：展示组织下所有 KB（名称、类型、文档数、chunk 数、向量化状态、绑定员工数、更新时间）
- 详情页：KB 基础信息 + 文档管理 + 绑定员工列表 + 同步日志
- 创建/编辑对话框：名称、描述、类型（general / channel_style / sensitive_topics / domain_specific）
- 删除确认（级联清理 `knowledge_items` 和 `employee_knowledge_bases`）
- 侧边栏新增入口，挂在"内容"分组下，和 `/channel-knowledge` 并列

### 文档摄入 3 种方式
1. **手动粘贴文本**：对话框里输入标题 + 内容，直接存为一条 `knowledge_item`
2. **上传 .md / .txt 文件**：单文件或多文件上传，前端读文本存库
3. **URL 爬取**：输入 URL，通过已有的 Jina Reader（`src/lib/web-fetch.ts`）抓正文存库

### 文档管理
- KB 详情页列出所有 `knowledge_items`（分页）
- 单条查看 / 编辑 / 删除
- 重新向量化按钮（触发异步 pipeline 重新生成 embedding）
- 标签筛选和全文搜索（应用层 `ILIKE`）

### 异步向量化 Pipeline
- 新增 Inngest 函数 `knowledge-base-vectorize`：监听 `kb.document.created` / `kb.document.updated` 事件
- 对文档做 chunking（按段落切，约 500-800 字符，50 字符 overlap）
- 调用 Jina Embeddings API（`jina-embeddings-v3`，1024 维）生成向量
- 写入 `knowledge_items.embedding` (jsonb)，更新 `knowledge_bases.vectorization_status` 和 `chunk_count`
- 失败写入 `knowledge_sync_logs`
- KB 级别 "重建索引" 按钮触发全库重向量化

### 语义检索 Agent Tool
- 新增工具 `kb_search` 到 `src/lib/agent/tool-registry.ts`
- 输入：`query: string, kb_ids?: string[], top_k?: number (default 5)`
- 实现：应用层余弦相似度（pgvector 留作未来优化）
  1. 生成 query embedding
  2. 加载候选 `knowledge_items`（限定在 employee 绑定的 KB 或显式 kb_ids 内）
  3. 计算余弦相似度、取 top-K、返回 title+snippet+relevance
- 在员工 assembly 时自动注入，按权限过滤

### Server Actions + DAL 扩展
- 新增 `src/app/actions/knowledge-bases.ts`：`createKnowledgeBase`, `updateKnowledgeBase`, `deleteKnowledgeBase`, `addKnowledgeItem`, `updateKnowledgeItem`, `deleteKnowledgeItem`, `reindexKnowledgeBase`, `crawlUrlIntoKB`
- 扩展 `src/lib/dal/knowledge-bases.ts`：`getKnowledgeBaseById`, `listKnowledgeItems`, `getKnowledgeBaseBindings`, `getSyncLogs`
- 所有操作通过 `requireAuth()` + organizationId 多租户隔离

### 员工资料页 KB Tab 小改
- `KBBrowserDialog` 顶部新增 "创建新知识库" 快捷入口（可选），打开创建对话框后自动绑定

## Impact

### Affected specs
- 新增 capability: `knowledge-bases`（含 10 条 requirements，覆盖 UI 模块、CRUD、摄入、向量化、检索、Agent 集成）

### Affected code
- **DB schema**：`src/db/schema/knowledge-bases.ts`（可能需要给 `knowledge_items` 加 `metadata jsonb` 字段，看 design 决策）
- **DAL**：`src/lib/dal/knowledge-bases.ts`（扩展读函数）
- **Server Actions**：`src/app/actions/knowledge-bases.ts`（新增文件）
- **UI 路由**：`src/app/(dashboard)/knowledge-bases/` 目录（新增 `page.tsx` + `[id]/page.tsx` + client 组件）
- **侧边栏**：`src/components/layout/app-sidebar.tsx`（新增菜单项）
- **员工资料页**：`src/app/(dashboard)/employee/[id]/employee-profile-client.tsx`（KBBrowserDialog 可选加"新建"入口）
- **Inngest**：`src/inngest/functions/knowledge-base-vectorize.ts`（新增文件）+ `src/inngest/functions/index.ts`（注册）
- **Agent 工具**：`src/lib/agent/tool-registry.ts`（新增 `kb_search` 工具）
- **环境变量**：`.env.example` 可能需要新增 `JINA_EMBEDDING_MODEL`（默认 `jina-embeddings-v3`）

### BREAKING
无。纯新增 + 扩展，不破坏现有绑定关系或 Agent 行为。已有的员工-KB 绑定继续有效；未向量化的旧 KB 保持 `vectorization_status='pending'`，`kb_search` 工具遇到无 embedding 的 KB 会自动跳过并给出提示。

### Out of scope (留给后续迭代)
- pgvector 扩展 + IVFFlat / HNSW 索引（V1 用 jsonb + 应用层余弦相似度，数据量小时够用）
- 多模态 KB（图片/视频）
- KB 权限细分（V1 默认组织内可见）
- 定时同步 / 增量同步（V1 只做手动触发）
- 跨 KB 的全局检索 UI
- **批量 CSV / JSON 导入**：V1 明确剔除，优先保证"粘贴 / 上传 / URL 爬取"三种单条摄入路径的质量，批量导入需求留待有真实数据批次时再规划
