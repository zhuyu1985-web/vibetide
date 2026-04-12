## ADDED Requirements

### Requirement: Knowledge Base Management Module Route

系统 SHALL 提供顶级路由 `/knowledge-bases` 作为知识库管理模块入口，独立于 `/channel-knowledge`（频道 DNA 看板）。

#### Scenario: 运营人员进入知识库管理模块

- **WHEN** 已登录用户在侧边栏点击"知识库管理"菜单项
- **THEN** 页面跳转到 `/knowledge-bases`，列出当前组织下所有知识库
- **AND** 列表展示每个 KB 的名称、描述、类型、文档数、向量化状态、绑定员工数和更新时间

#### Scenario: 未登录访问被拦截

- **WHEN** 未登录用户直接访问 `/knowledge-bases` 或 `/knowledge-bases/<id>`
- **THEN** 系统重定向到 `/login`

#### Scenario: 多租户隔离

- **WHEN** 用户切换到另一个组织上下文
- **THEN** `/knowledge-bases` 列表只展示当前组织的 KB，不泄漏跨租户数据

### Requirement: Knowledge Base CRUD

系统 SHALL 允许组织内用户创建、查看、编辑和删除知识库元数据。

#### Scenario: 创建知识库

- **WHEN** 用户点击 "新建知识库" 并输入名称、描述、类型
- **THEN** 系统创建一条 `knowledge_bases` 记录，`organization_id` 绑定当前组织
- **AND** 向 `knowledge_sync_logs` 写入一条 `action='created'` 日志
- **AND** 刷新列表后新 KB 立即可见

#### Scenario: 编辑知识库元数据

- **WHEN** 用户在详情页"设置" Tab 修改名称 / 描述 / 类型并保存
- **THEN** 系统更新该 KB 的相应字段和 `updated_at`
- **AND** 不影响已存在的 `knowledge_items` 和员工绑定

#### Scenario: 删除知识库

- **WHEN** 用户点击 "删除知识库" 并在确认对话框中再次确认
- **THEN** 系统删除该 KB 及其关联的 `knowledge_items`、`employee_knowledge_bases`、`knowledge_sync_logs`（通过级联外键）
- **AND** 绑定此 KB 的 AI 员工在下次 Agent assembly 时自动从上下文中移除该 KB

#### Scenario: 删除前展示影响范围

- **WHEN** 用户触发删除对话框
- **THEN** 对话框展示该 KB 关联的文档数和绑定员工数
- **AND** 用户必须明确点击确认才能执行删除

### Requirement: Knowledge Base Document Ingestion

系统 SHALL 支持 3 种单条文档摄入方式：手动粘贴、文件上传和 URL 爬取。批量 CSV/JSON 导入明确不在 V1 范围内。

#### Scenario: 手动粘贴文本

- **WHEN** 用户在 KB 详情页选择 "粘贴文本"，输入标题和正文并提交
- **THEN** 系统将正文按段落切分成多个 chunks，批量写入 `knowledge_items`
- **AND** 每条 chunk 的 `source_type='upload'`，`embedding=null`，`chunk_index` 从 0 递增
- **AND** 触发异步向量化事件 `kb.document.created`

#### Scenario: 上传 Markdown / 文本文件

- **WHEN** 用户选择一个或多个 `.md` / `.txt` 文件上传
- **THEN** 前端读取文件文本内容，对每个文件分别调用文档添加接口
- **AND** 每个文件作为独立 `source_document` 存储，chunks 按文件名分组

#### Scenario: URL 爬取

- **WHEN** 用户输入一个 URL 并提交
- **THEN** 系统调用 Jina Reader（`src/lib/web-fetch.ts`）抓取正文
- **AND** 成功后将正文作为文档存入 KB，`source_url` 记录原始 URL，`source_type='subscription'`
- **AND** 失败时写入 `knowledge_sync_logs` 一条错误记录，前端展示失败原因

### Requirement: Knowledge Item Management

系统 SHALL 允许用户在 KB 详情页查看、编辑和删除单条 `knowledge_items`。

#### Scenario: 分页浏览 KB 内文档

- **WHEN** 用户进入 KB 详情页的 "文档" Tab
- **THEN** 系统以分页形式展示该 KB 下所有 `knowledge_items`，每页 20 条
- **AND** 支持按 `title` 或 `snippet` 进行应用层 `ILIKE` 搜索
- **AND** 支持按 `tags` 过滤

#### Scenario: 编辑单条文档

- **WHEN** 用户修改一条 `knowledge_item` 的 `title` 或 `content` 并保存
- **THEN** 系统更新该记录，同时清空其 `embedding`
- **AND** 触发 `kb.document.updated` 事件重新向量化该条 chunk

#### Scenario: 删除单条文档

- **WHEN** 用户删除一条 chunk
- **THEN** 系统物理删除该 `knowledge_items` 记录
- **AND** 更新所属 KB 的 `document_count` 和 `chunk_count`

### Requirement: Text Chunking

系统 SHALL 提供确定性的文本 chunking 算法，将长文档切分为语义完整的片段。

#### Scenario: 短文本不切分

- **WHEN** 输入文本长度少于 500 字符
- **THEN** 算法返回单个 chunk，内容即为原文

#### Scenario: 按段落切分

- **WHEN** 输入文本含有段落分隔（`\n\n`）
- **THEN** 算法优先按段落切分
- **AND** 单个 chunk 累积长度保持在 500-800 字符之间

#### Scenario: 长段落按句号切分

- **WHEN** 单个段落超过 800 字符
- **THEN** 算法按句号（中文 `。` 或英文 `.`）二次切分
- **AND** 切分边界不在单词中间

#### Scenario: Chunks 之间保留 overlap

- **WHEN** 生成相邻两个 chunks
- **THEN** 后一个 chunk 的开头包含前一个 chunk 结尾的约 50 个字符
- **AND** 确保句子跨块时语义不丢失

### Requirement: Asynchronous Vectorization Pipeline

系统 SHALL 使用 Inngest 异步生成文档向量，确保 UI 写入不被 embedding 生成阻塞。

#### Scenario: 文档添加后状态流转

- **WHEN** 用户成功添加一条或多条文档
- **THEN** 服务端立即返回成功，新增 chunks 的 `embedding=null`
- **AND** KB 的 `vectorization_status` 变为 `pending` 或 `processing`
- **AND** Inngest 函数 `knowledge-base-vectorize` 被触发

#### Scenario: Embedding 成功生成

- **WHEN** Inngest 函数成功批量调用 Jina Embeddings API
- **THEN** 将返回的向量写入对应 `knowledge_items.embedding`，`embedding_model='jina-embeddings-v3'`
- **AND** 全部 chunks 完成后 KB 的 `vectorization_status` 置为 `done`
- **AND** 向 `knowledge_sync_logs` 写入 `action='vectorize', status='success'` 记录

#### Scenario: Embedding 生成失败

- **WHEN** Jina API 调用连续失败超过 3 次
- **THEN** KB 的 `vectorization_status` 置为 `failed`
- **AND** 向 `knowledge_sync_logs` 写入 `status='error'` 和错误详情
- **AND** 原始 `knowledge_items` 记录保留，不被删除

#### Scenario: 手动触发重建索引

- **WHEN** 用户在 KB 设置页点击 "重建索引"
- **THEN** 系统清空该 KB 下所有 chunks 的 `embedding`
- **AND** 触发 `kb.kb.reindex` 事件重新批量向量化

### Requirement: Semantic Retrieval Agent Tool

系统 SHALL 为 AI 员工提供 `kb_search` 工具，按语义相似度返回绑定 KB 中的相关片段。

#### Scenario: 工具对有绑定 KB 的员工自动可用

- **WHEN** Agent assembly 阶段为员工构建工具列表
- **AND** 该员工存在 `employee_knowledge_bases` 绑定
- **THEN** `kb_search` 工具被注入该员工的可用工具列表

#### Scenario: 默认检索员工全部绑定 KB

- **WHEN** 员工 Agent 调用 `kb_search({query})` 不传 `kb_ids`
- **THEN** 系统检索该员工所有绑定且 `vectorization_status='done'` 的 KB
- **AND** 对 query 生成 embedding，与候选 chunks 计算余弦相似度
- **AND** 返回相似度最高的 top 5 条（`top_k` 默认 5），每条含 `title`、`snippet`、`relevance`

#### Scenario: 显式 kb_ids 按交集过滤

- **WHEN** 调用 `kb_search({query, kb_ids: [...]})`
- **THEN** 系统将 `kb_ids` 与员工绑定的 KB 列表取交集再检索
- **AND** 非交集的 KB 被静默忽略，不产生跨 KB 越权

#### Scenario: 未就绪 KB 的提示

- **WHEN** 员工绑定的 KB 中存在 `vectorization_status != 'done'` 的项
- **THEN** 工具返回结果同时附加一条提示 "KB <name> 未完成向量化，已跳过"

#### Scenario: 跨租户访问被拒绝

- **WHEN** 调用时传入的 `kb_ids` 包含不属于当前组织的 KB
- **THEN** 系统过滤掉这些 ID，只检索本组织的 KB

### Requirement: Multi-Tenant Isolation

系统 SHALL 在所有 KB 相关的 DAL、Server Action 和工具调用中强制使用 `organization_id` 过滤。

#### Scenario: DAL 函数必须接受 organizationId

- **WHEN** 任意 `src/lib/dal/knowledge-bases.ts` 的读函数被调用
- **THEN** 函数签名必须接受 `organizationId` 参数并在 SQL where 子句中使用

#### Scenario: Server Action 从 session 推导租户

- **WHEN** 任意 `src/app/actions/knowledge-bases.ts` 的 action 被调用
- **THEN** action 通过 `requireAuth()` 拿到当前用户，查询其所属 organization_id
- **AND** 所有读写操作都使用该 organization_id 作为过滤条件或写入值

### Requirement: Sync Log Audit Trail

系统 SHALL 为所有 KB 变更和向量化操作写入 `knowledge_sync_logs`，供用户在 UI 中查看。

#### Scenario: KB 创建记录

- **WHEN** 用户创建一个新 KB
- **THEN** 写入一条 `action='created', status='success'` 日志

#### Scenario: 文档添加记录

- **WHEN** 用户通过任意摄入方式添加文档
- **THEN** 写入一条 `action='ingest', status='success'` 日志，`documents_processed` 记录文档数

#### Scenario: 向量化结果记录

- **WHEN** Inngest 函数完成一次批量向量化
- **THEN** 写入一条 `action='vectorize'` 日志，`chunks_generated` 记录处理的 chunk 数
- **AND** 成功 `status='success'`，失败 `status='error'` 并在 `detail` 字段记录错误

#### Scenario: 用户查看日志

- **WHEN** 用户进入 KB 详情页 "同步日志" Tab
- **THEN** 展示该 KB 的所有同步日志，按 `created_at desc` 排序

### Requirement: Sidebar Navigation Entry

系统 SHALL 在主侧边栏的 "内容" 分组下展示 "知识库管理" 菜单项。

#### Scenario: 菜单项位置

- **WHEN** 已登录用户加载任意 dashboard 页面
- **THEN** 侧边栏 "内容" 分组下出现 "知识库管理" 菜单项，指向 `/knowledge-bases`
- **AND** 现有 "知识库"（指向 `/channel-knowledge`）菜单项保持不变

#### Scenario: 菜单项高亮

- **WHEN** 当前路由以 `/knowledge-bases` 开头
- **THEN** "知识库管理" 菜单项显示 active 样式
