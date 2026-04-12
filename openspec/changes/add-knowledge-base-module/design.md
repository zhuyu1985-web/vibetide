# Design: Knowledge Base Management Module

## Context

Vibetide 的 8 个 AI 数字员工在 Agent assembly 阶段会读取绑定的 KB 进入系统提示词，理论上可以用 KB 内容辅助决策。但目前 KB 层只有 schema、join 表和一份只读 DAL —— 没有任何 UI 能创建/编辑 KB，也没有任何 pipeline 在往 `knowledge_items` 里塞内容或生成 embedding。`knowledge_items.embedding` 字段形同虚设。

这次改动要一次性补齐三块：**管理 UI + 文档摄入 + 语义检索**。核心约束：

- **简单优先**：V1 不引入 pgvector，避免对 Supabase 实例做扩展升级（需要运维确认）；应用层余弦相似度对小规模数据（< 10k chunks）足够
- **复用存量基础设施**：Jina Reader 已在 `src/lib/web-fetch.ts:182` 接入 → URL 爬取不用写新代码；Inngest pipeline 模式已成熟 → 异步向量化直接套用
- **不破坏现有链路**：`employee_knowledge_bases` 绑定关系、`assembly.ts` 的 KB 注入逻辑保持不变
- **多租户强隔离**：所有操作按 `organization_id` 过滤，跨租户泄漏是最高级的故障

## Goals / Non-Goals

### Goals
- 运营人员能在 `/knowledge-bases` 独立完成 KB 生命周期管理（建、看、改、删、加文档、查绑定）
- 4 种文档摄入方式都能用：粘贴 / 上传 / URL / CSV·JSON
- 员工 Agent 通过 `kb_search` 工具语义检索到绑定 KB 的相关内容，返回 top-K 片段
- 所有变更可审计（`knowledge_sync_logs`）
- 向量化失败不阻塞文档保存，用户可见失败原因

### Non-Goals
- pgvector 集成和向量索引优化（V1 数据量不大，留作未来性能优化）
- 图片 / PDF / Office 文档解析（V1 只接 `.md` / `.txt` 文本）
- 定时同步或增量同步（V1 只手动触发）
- KB 粒度的 RBAC 权限（V1 组织内默认可见，未来再细化）
- 跨 KB 的全局搜索页面（V1 只做工具调用，用户侧只在 KB 详情页有本 KB 内搜索）
- Embedding 模型热切换 UI（V1 写死 `jina-embeddings-v3`）

## Decisions

### D1. 新建独立模块 `/knowledge-bases`，与 `/channel-knowledge` 解耦
- **Decision**: 新建 `src/app/(dashboard)/knowledge-bases/` 作为顶级模块，和现有 `/channel-knowledge` 并列挂在侧边栏"内容"分组下
- **Rationale**:
  - `/channel-knowledge` 的数据流走 `getKnowledgeSources / getChannelDNA` 这套 DAL，面向的是"频道内容源"和 DNA 分析看板，不是给 Agent 消费的 KB
  - 把两者合并会让两个正交概念互相污染，破坏现有页面
  - 独立模块也让路由结构自解释：`/knowledge-bases` 管理给 AI 员工用的知识库
- **Alternatives**:
  - 合并进 `/channel-knowledge`：❌ 两个概念混合，破坏现有看板
  - 作为员工详情页的子功能：❌ KB 本身是跨员工的共享资源，不应该挂在单个员工下
  - 挂在 `/ai-employees` 下做 Tab：❌ 主次关系不对，KB 应该是一级概念

### D2. 向量存储继续用 `jsonb`，应用层余弦相似度
- **Decision**: `knowledge_items.embedding` 保持 `jsonb number[]` 类型。检索时在 Node 层加载候选 chunks、计算余弦相似度、取 top-K
- **Rationale**:
  - 避免对 Supabase PostgreSQL 启用 `vector` 扩展（需要运维权限，且不是所有 Supabase plan 都支持）
  - V1 预期数据量：一个组织最多十几个 KB、每 KB 几百到几千 chunks，总量 < 10k。1024 维向量 × 10k 条 = 单次遍历约 10M 次乘加，Node 端几十毫秒可完成
  - 保留升级路径：当数据量上来后，只需做一次 migration 把 `jsonb` → `vector`，加 IVFFlat 索引，检索代码替换成 SQL `<->` 运算符
- **Alternatives**:
  - 直接上 pgvector：✅ 性能更好但需要 Supabase 扩展 + migration + 测试，拖慢交付
  - 外置向量库（Pinecone / Qdrant）：❌ 引入新外部依赖，多租户隔离复杂
- **Risks**:
  - 数据量超过 10k chunks 时检索延迟会到秒级 → 监控 `knowledge_items` 总量，超阈值触发 pgvector migration 提案
  - jsonb 比原生 `vector` 浪费约 3-4x 存储空间 → 可接受

### D3. Embedding 提供方选 Jina Embeddings v3（1024 维）
- **Decision**: `kb-vectorize` Inngest 函数调用 `https://api.jina.ai/v1/embeddings`，模型 `jina-embeddings-v3`，固定 1024 维
- **Rationale**:
  - `JINA_API_KEY` 已在环境变量中配置
  - Jina 既有 Reader（URL 爬取）又有 Embeddings，一套 key 走到底
  - 1024 维是性能 / 精度平衡点；后续要换到 512 或 768 维只需 re-embed
  - DeepSeek 的 OpenAI 兼容 API 不提供 embeddings，不适合
- **Alternatives**:
  - OpenAI `text-embedding-3-small`：需要独立 OpenAI key + 国内出网
  - 自托管 BGE / M3E：额外运维成本
- **Config**:
  - 模型名称存入 env：`JINA_EMBEDDING_MODEL=jina-embeddings-v3`
  - 每个 `knowledge_item` 写入时同时记录 `embedding_model`（已有字段），便于未来迁移

### D4. 文档 chunking 策略：段落切分 + 字符数兜底
- **Decision**:
  1. 先按 `\n\n` 切段
  2. 单段 > 800 字符时按句号 `。` / `.` 切子句
  3. 累积拼接，每块 500-800 字符，相邻块 overlap 50 字符
  4. 每个 chunk 作为一条 `knowledge_items` 记录，`chunk_index` 递增
- **Rationale**: 保留语义边界，avoid 切断句子；overlap 保证边界 token 不丢失上下文
- **Alternatives**: 纯字符数切分（更简单但会割裂句子）、tiktoken 切分（引入新依赖）

### D5. 向量化异步化，解耦写入与成功标志
- **Decision**:
  - 用户添加文档的 server action 先同步写入原始 chunks 到 `knowledge_items`（`embedding=null, vectorization_status='pending'`），立即返回成功
  - 同步发送 Inngest 事件 `kb.document.created`
  - `knowledge-base-vectorize` 函数订阅事件，批量拉取该 KB 下 `embedding IS NULL` 的 chunks，调 Jina 生成 embedding，回写 DB
  - 失败时写 `knowledge_sync_logs` 记录错误，不影响原始文档
- **Rationale**:
  - UI 响应不被 embedding 生成阻塞
  - Jina API 抖动不会丢失文档
  - 失败可重试（通过重新触发事件或 "重建索引" 按钮）
- **Observability**: `vectorization_status` 字段（`pending` / `processing` / `done` / `failed`）作为 KB 级别状态；UI 轮询或 SSE 展示进度

### D6. `kb_search` 工具的过滤策略
- **Decision**:
  - 工具调用时默认从**当前员工绑定的所有 KB** 中检索
  - 如果显式传入 `kb_ids`，只检索这些 KB（但必须在员工绑定列表内，跨 KB 访问拒绝）
  - 只检索 `vectorization_status='done'` 的 KB；其他状态的 KB 附加一条提示返回
- **Rationale**: 最小权限原则 + 避免返回未就绪数据

### D7. 批量 CSV / JSON 导入从 V1 剔除
- **Decision**: V1 不做批量导入。摄入方式收敛到三条路径：手动粘贴、.md/.txt 文件上传、URL 爬取
- **Rationale**:
  - 前期没有真实数据批次驱动需求，过早引入批量导入容易写出抽象不匹配的 schema
  - 文件上传路径已经可以处理"一次拖多个 .md 文件"的场景，覆盖了大部分手动迁移需求
  - 批量导入需要额外的错误行反馈、校验提示和部分成功语义，UI 和后端成本高，推迟可让 V1 更专注在向量化和检索主干
- **Revisit trigger**: 当出现单次 > 50 条文档需要导入的真实场景时，重新评估并提新 change

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Jina Embeddings API 配额耗尽 / 限流 | Inngest 函数内置重试 + 指数退避；超额时降级为同步失败提示，UI 显示 "向量化暂停" |
| jsonb 向量在大数据量下检索慢 | 监控 KB chunk 总量，> 10k 时提 pgvector migration 提案 |
| URL 爬取失败 / 返回脏数据 | 复用 `src/lib/web-fetch.ts` 已有的错误处理；写入前对正文做长度检查（< 50 字符视为失败） |
| 多租户越权：用户访问其他组织的 KB | 所有 DAL 查询必须带 `organization_id` 过滤；server actions 使用 `requireAuth()` 拿到 user → 再查其 org 并强制 where 条件 |
| 删除 KB 时绑定员工的 Agent 上下文突然变小 | 删除前在对话框展示绑定的员工数量做二次确认；删除时 join 表 `ON DELETE CASCADE` 自动清理 |
| 文档编辑后旧 embedding 与新内容不匹配 | 编辑 server action 内将该 chunk 的 `embedding` 清空并触发 vectorize 事件 |
| 批量导入触发大量 Inngest 事件 | 单文档多 chunks 一次事件（事件 payload 带 KB ID），vectorize 函数内部分页处理 |

## Migration Plan

- 无 schema 破坏性变更。`knowledge_items` 可能新增一个 `metadata jsonb` 字段承载爬取源信息（decision during implementation；非必须）
- 已有的 seed 数据（如果有）继续可读；`vectorization_status='pending'` 的 KB 不会被 `kb_search` 命中但也不报错
- 回滚：新增模块和 Inngest 函数可以关闭或删除，不影响任何现有功能；数据库若新增字段，回滚 migration 即可

## Open Questions

1. **Chunk 去重**：同一 URL 爬取两次是覆盖还是追加？倾向按 `source_document` 字段 upsert（覆盖同源旧 chunks）
2. **权限**：组织内所有用户都能删除 KB 吗？还是只有创建者 / admin？V1 建议都能删，但删除操作要显式确认
3. **员工资料页的"快捷创建"入口**：V1 做还是留到 v1.1？倾向 V1 不做，保持最小可行实现
