# 知识库模块测试用例文档

> 生成时间：2026-04-11
> 模块范围：知识库管理（Knowledge Base Module）
> 分支：feature/genspark-redesign-phase1
> 参考规格：openspec/changes/add-knowledge-base-module/specs/knowledge-bases/spec.md

---

## 总览

| 模块 | P0 | P1 | P2 | P3 | 合计 | 自动化率 |
|------|----|----|----|----|------|---------|
| 文本切分（chunking） | 1 | 4 | 2 | 3 | 10 | 100% |
| 向量嵌入（embeddings） | 1 | 3 | 1 | 2 | 7 | 85% |
| 语义检索（retrieval） | 2 | 3 | 1 | 2 | 8 | 100% |
| Server Actions（知识库 CRUD） | 4 | 8 | 3 | 2 | 17 | 90% |
| DAL 查询层 | 3 | 6 | 2 | 2 | 13 | 100% |
| Inngest 向量化管道 | 1 | 3 | 1 | 2 | 7 | 70% |
| Agent 集成（工具注册 + 装配 + 执行） | 2 | 5 | 2 | 2 | 11 | 85% |
| **合计** | **14** | **32** | **12** | **15** | **73** | **~90%** |

---

## Module: 文本切分（chunking.ts）

**文件路径：** `src/lib/knowledge/chunking.ts`
**导出函数：** `chunkText()`, `buildSnippet()`
**测试特点：** 纯函数，无外部依赖，100% 可单元测试

### 测试数据准备

- 短文本样本（<500 字符）：一段中文新闻摘要
- 中等文本样本（800-2000 字符）：含多段落的文章，段落间用 `\n\n` 分隔
- 长文本样本（>5000 字符）：完整的长文章，含超长段落（>800 字符）
- 边界文本：恰好 500 字符、恰好 800 字符
- 特殊文本：纯空白、全英文、中英混排、仅含句号无段落、`\r\n` 换行

### 测试用例

| # | 用例名称 | 优先级 | 类型 | 前置条件 | 输入 | 预期结果 | 自动化 |
|---|---------|-------|------|---------|------|---------|-------|
| TC-CHK-001 | 空文本返回空数组 | P0 | unit | 无 | `chunkText("")` | 返回 `[]` | ✅ |
| TC-CHK-002 | 短文本不切分 | P1 | unit | 无 | 长度 <500 字符的文本 | 返回包含 1 个元素的数组，内容为原文 trim 后的结果 | ✅ |
| TC-CHK-003 | 按段落切分正常文本 | P1 | unit | 无 | 含 `\n\n` 分隔的 1500 字符文本 | 返回多个 chunk，每个长度在 [500, 800] 区间内 | ✅ |
| TC-CHK-004 | 超长段落按句号二次切分 | P1 | unit | 无 | 单段落 >800 字符，含中文句号 | 段落被按 `。` 切分后再打包为 chunk | ✅ |
| TC-CHK-005 | 相邻 chunk 有 overlap | P1 | unit | 无 | 多段落长文本 | 后一个 chunk 的开头包含前一个 chunk 结尾约 50 字符 | ✅ |
| TC-CHK-006 | `\r\n` 被归一化为 `\n` | P2 | unit | 无 | 含 `\r\n` 的文本 | 输出中不含 `\r`，切分行为与 `\n` 一致 | ✅ |
| TC-CHK-007 | 纯空白文本返回空数组 | P2 | unit | 无 | `chunkText("   \n\n  ")` | 返回 `[]` | ✅ |
| TC-CHK-008 | 自定义 minChars/maxChars/overlap | P3 | unit | 无 | `chunkText(text, { minChars: 200, maxChars: 400, overlap: 30 })` | chunk 长度约束变为 [200, 400]，overlap 约 30 字符 | ✅ |
| TC-CHK-009 | 极端长文本（10 万字符） | P3 | unit | 无 | 100,000 字符连续中文文本 | 函数在合理时间内（<1s）返回，不超出内存 | ✅ |
| TC-CHK-010 | 无句号的超长段落硬切分 | P3 | unit | 无 | 单段落 >800 字符，不含任何句号 | 按 maxChars 硬切，不丢失字符 | ✅ |

#### buildSnippet() 用例

| # | 用例名称 | 优先级 | 类型 | 前置条件 | 输入 | 预期结果 | 自动化 |
|---|---------|-------|------|---------|------|---------|-------|
| TC-SNP-001 | 短文本原样返回 | P1 | unit | 无 | 长度 <200 的字符串 | 返回 trim + 空白合并后的原字符串 | ✅ |
| TC-SNP-002 | 长文本截断并加省略号 | P1 | unit | 无 | 长度 >200 的字符串 | 返回前 200 字符 + `…` | ✅ |
| TC-SNP-003 | 空白字符合并 | P2 | unit | 无 | 含多个连续空格和换行的文本 | 所有连续空白合并为单个空格 | ✅ |

---

## Module: 向量嵌入（embeddings.ts）

**文件路径：** `src/lib/knowledge/embeddings.ts`
**导出函数：** `generateEmbeddings()`, `generateQueryEmbedding()`, `getEmbeddingModel()`
**测试特点：** 依赖外部 Jina API，需 mock `fetch`；含指数退避重试逻辑

### 测试数据准备

- Mock Jina API 响应：正确格式的 `JinaEmbeddingResponse`（含 `data[].index`, `data[].embedding`）
- Mock 错误响应：HTTP 429 / 500 / 无效 JSON
- 环境变量：`JINA_API_KEY` mock 设置/清除

### 测试用例

| # | 用例名称 | 优先级 | 类型 | 前置条件 | 输入 | 预期结果 | 自动化 |
|---|---------|-------|------|---------|------|---------|-------|
| TC-EMB-001 | 缺少 JINA_API_KEY 时抛出错误 | P0 | unit | `JINA_API_KEY` 未设置 | `generateEmbeddings(["text"])` | 抛出 "JINA_API_KEY 未配置" | ✅ |
| TC-EMB-002 | 空输入返回空数组 | P1 | unit | API Key 已设置 | `generateEmbeddings([])` | 返回 `[]`，不调用 API | ✅ |
| TC-EMB-003 | 正常单批次嵌入生成 | P1 | unit | mock fetch 返回正确响应 | 10 条文本 | 返回 10 个 embedding 数组，按 index 排序 | ✅ |
| TC-EMB-004 | 超过 100 条自动分批 | P1 | unit | mock fetch | 150 条文本 | 调用 fetch 2 次（100+50），返回 150 个 embedding | ✅ |
| TC-EMB-005 | API 失败后指数退避重试 | P2 | unit | mock fetch 前 2 次失败，第 3 次成功 | 10 条文本 | 第 3 次成功后正常返回，总计 fetch 被调 3 次 | ✅ |
| TC-EMB-006 | 3 次重试全部失败抛出错误 | P3 | unit | mock fetch 始终返回 500 | 10 条文本 | 抛出 "已重试 3 次" 的错误 | ✅ |
| TC-EMB-007 | generateQueryEmbedding 使用 retrieval.query task | P3 | unit | mock fetch | 单条 query | 请求体中 `task` 字段为 `"retrieval.query"`（区别于 passage） | ❌ |

---

## Module: 语义检索（retrieval.ts）

**文件路径：** `src/lib/knowledge/retrieval.ts`
**导出函数：** `searchKnowledgeBases()`
**内部函数：** `cosineSimilarity()`（需通过集成间接测试或提取为 exportable）
**测试特点：** 依赖 `loadEmbeddedKnowledgeItems`（DAL）和 `generateQueryEmbedding`（API），均需 mock

### 测试数据准备

- Mock `loadEmbeddedKnowledgeItems`：返回含预计算 embedding 的 candidate 列表
- Mock `generateQueryEmbedding`：返回固定向量
- 余弦相似度验证向量对：
  - 相同方向向量 → similarity ≈ 1.0
  - 正交向量 → similarity ≈ 0.0
  - 反向向量 → similarity ≈ -1.0

### 测试用例

| # | 用例名称 | 优先级 | 类型 | 前置条件 | 输入 | 预期结果 | 自动化 |
|---|---------|-------|------|---------|------|---------|-------|
| TC-RET-001 | 空 kbIds 返回空数组 | P0 | unit | 无 | `searchKnowledgeBases("query", [])` | 返回 `[]`，不调用 API | ✅ |
| TC-RET-002 | 空 query 返回空数组 | P0 | unit | 无 | `searchKnowledgeBases("", ["kb1"])` | 返回 `[]`，不调用 API | ✅ |
| TC-RET-003 | 正常检索返回 top-K 结果 | P1 | unit | mock 返回 10 个 candidate | query, ["kb1"], topK=5 | 返回 5 条结果，按 relevance 降序排列 | ✅ |
| TC-RET-004 | 候选列表为空时返回空数组 | P1 | unit | mock 返回 0 candidate | 有效 query 和 kbIds | 返回 `[]` | ✅ |
| TC-RET-005 | 余弦相似度计算正确性 | P1 | unit | mock 已知向量 | 与已知相似度最高 candidate 的 query | 结果第一条的 id 为预期的最相似 candidate | ✅ |
| TC-RET-006 | topK 边界：请求 > 50 被限制 | P2 | unit | mock | topK=100 | 实际返回不超过 50 条 | ✅ |
| TC-RET-007 | 零向量的 cosine similarity 返回 0 | P3 | unit | mock candidate embedding 为全零 | 任意 query | 该 candidate 的 relevance 为 0 | ✅ |
| TC-RET-008 | 长度不等向量的 cosine similarity 返回 0 | P3 | unit | mock candidate embedding 长度与 query 不一致 | 任意 query | 该 candidate 的 relevance 为 0 | ✅ |

---

## Module: Server Actions（knowledge-bases.ts）

**文件路径：** `src/app/actions/knowledge-bases.ts`
**导出函数：** `createKnowledgeBase`, `updateKnowledgeBase`, `deleteKnowledgeBase`, `addKnowledgeItem`, `crawlUrlIntoKB`, `updateKnowledgeItem`, `deleteKnowledgeItem`, `reindexKnowledgeBase`
**测试特点：** 需 mock DB（Drizzle）、auth（Supabase）、Inngest、revalidatePath；多租户安全性是测试重点

### 测试数据准备

- Mock `requireAuth()` / `requireOrg()`：模拟已认证用户和组织 ID
- Mock `assertKnowledgeBaseOwnership()`：模拟所有权验证通过/失败
- Mock `db.insert/update/delete/query`：Drizzle ORM 操作
- Mock `inngest.send()`：事件发送
- Mock `fetchViaJinaReader()`：URL 爬取
- 测试知识库记录：`{ id: "kb-1", organizationId: "org-1", name: "测试知识库" }`
- 测试文档输入：`{ title: "测试文档", content: "长度超过500字符的内容..." }`

### 测试用例

| # | 用例名称 | 优先级 | 类型 | 前置条件 | 输入 | 预期结果 | 自动化 |
|---|---------|-------|------|---------|------|---------|-------|
| **创建知识库** | | | | | | | |
| TC-ACT-001 | 未认证用户创建知识库被拒 | P0 | unit | `requireAuth()` 抛出 Unauthorized | `createKnowledgeBase({ name: "test" })` | 抛出 "Unauthorized" 错误 | ✅ |
| TC-ACT-002 | 无组织信息创建知识库被拒 | P0 | unit | `requireOrg()` 抛出 | `createKnowledgeBase({ name: "test" })` | 抛出 "无法获取组织信息" 错误 | ✅ |
| TC-ACT-003 | 正常创建知识库 | P1 | unit | 已认证，orgId="org-1" | `{ name: "新闻素材库", description: "...", type: "general" }` | DB insert 被调用，返回 created 记录；sync log 写入 `action='created'`；revalidatePath 被调用 | ✅ |
| TC-ACT-004 | 空名称被拒绝 | P1 | unit | 已认证 | `{ name: "   " }` | 抛出 "知识库名称不能为空" | ✅ |
| TC-ACT-005 | 名称超 100 字符被拒绝 | P1 | unit | 已认证 | name 长度 101 | 抛出 "知识库名称过长" | ✅ |
| **更新知识库** | | | | | | | |
| TC-ACT-006 | 跨租户更新被拒绝 | P0 | unit | `assertKnowledgeBaseOwnership` 抛出 | `updateKnowledgeBase("kb-other", { name: "x" })` | 抛出 "知识库不存在或无权访问" | ✅ |
| TC-ACT-007 | 正常更新知识库名称 | P1 | unit | 已认证，ownership 通过 | `updateKnowledgeBase("kb-1", { name: "新名称" })` | DB update 被调用，name 和 updatedAt 更新 | ✅ |
| TC-ACT-008 | 更新时空名称被拒 | P1 | unit | 已认证 | `{ name: "" }` | 抛出 "知识库名称不能为空" | ✅ |
| **删除知识库** | | | | | | | |
| TC-ACT-009 | 跨租户删除被拒绝 | P0 | unit | ownership 验证失败 | `deleteKnowledgeBase("kb-other")` | 抛出越权错误 | ✅ |
| TC-ACT-010 | 正常删除知识库（级联） | P1 | unit | 已认证，ownership 通过 | `deleteKnowledgeBase("kb-1")` | DB delete 被调用；revalidatePath 被调用 | ✅ |
| **添加文档** | | | | | | | |
| TC-ACT-011 | 正常添加文档并触发向量化 | P1 | unit | ownership 通过，mock chunkText 返回 3 chunks | `addKnowledgeItem("kb-1", { title: "文档1", content: "..." })` | DB insert 3 条 items；inngest.send `kb/document-created`；sync log `action='ingest'` | ✅ |
| TC-ACT-012 | 文档内容太短被拒 | P1 | unit | ownership 通过 | `{ title: "x", content: "短" }` | 抛出 "文档内容太短" | ✅ |
| TC-ACT-013 | 文档标题为空被拒 | P1 | unit | ownership 通过 | `{ title: "", content: "长内容..." }` | 抛出 "文档标题不能为空" | ✅ |
| TC-ACT-014 | 添加失败写入错误 sync log | P2 | unit | DB insert 抛出异常 | 合法输入 | sync log 写入 `status='error'`；原始错误被 re-throw | ✅ |
| **URL 爬取** | | | | | | | |
| TC-ACT-015 | 正常 URL 爬取并入库 | P1 | unit | mock fetchViaJinaReader 返回内容 | `crawlUrlIntoKB("kb-1", "https://example.com/article")` | Jina Reader 被调用；文档被 ingest；sourceType='subscription' | ✅ |
| TC-ACT-016 | 无效 URL 被拒绝 | P2 | unit | ownership 通过 | `"not-a-url"` | 抛出 "URL 格式无效" | ✅ |
| TC-ACT-017 | Jina Reader 返回空内容 | P2 | unit | mock 返回空 content | 合法 URL | 抛出 "正文为空或过短"；error sync log 被写入 | ✅ |
| **文档编辑/删除** | | | | | | | |
| TC-ACT-018 | 编辑文档内容后 embedding 被清空 | P1 | unit | item 存在且 ownership 通过 | `updateKnowledgeItem(itemId, { content: "新内容" })` | embedding 和 embeddingModel 被置 null；inngest 发送 `kb/document-updated` | ✅ |
| TC-ACT-019 | 编辑不存在的文档被拒 | P2 | unit | DB 查无此 item | `updateKnowledgeItem("fake-id", { title: "x" })` | 抛出 "文档不存在" | ✅ |
| TC-ACT-020 | 删除文档后更新 KB chunkCount | P1 | unit | item 存在 | `deleteKnowledgeItem(itemId)` | item 被物理删除；KB chunkCount 被重新计算 | ✅ |
| **重建索引** | | | | | | | |
| TC-ACT-021 | 重建索引清空所有 embedding | P1 | unit | KB 有多条 items | `reindexKnowledgeBase("kb-1")` | 所有 items 的 embedding 置 null；KB status='pending'；inngest 发送 `kb/reindex-requested` | ✅ |
| TC-ACT-022 | 重建索引写入 sync log | P3 | unit | 同上 | 同上 | sync log `action='reindex', status='success'` | ✅ |

---

## Module: DAL 查询层（dal/knowledge-bases.ts）

**文件路径：** `src/lib/dal/knowledge-bases.ts`
**导出函数：** `listKnowledgeBaseSummariesByOrg`, `getKnowledgeBaseById`, `listKnowledgeItems`, `getKnowledgeBaseBindings`, `getKnowledgeBaseSyncLogs`, `loadEmbeddedKnowledgeItems`, `assertKnowledgeBaseOwnership`
**测试特点：** 需 mock Drizzle DB；多租户隔离是 P0 验证重点

### 测试数据准备

- Mock DB 数据集：2 个组织，各 2 个知识库，每个 KB 含 25 条 items（支持分页测试）
- Mock employee_knowledge_bases 绑定：部分员工绑定了 KB
- Mock knowledge_sync_logs：各类 action/status 的日志记录
- Mock items 含/不含 embedding

### 测试用例

| # | 用例名称 | 优先级 | 类型 | 前置条件 | 输入 | 预期结果 | 自动化 |
|---|---------|-------|------|---------|------|---------|-------|
| **assertKnowledgeBaseOwnership** | | | | | | | |
| TC-DAL-001 | 本组织 KB 验证通过 | P0 | unit | KB 属于 org-1 | `assertKnowledgeBaseOwnership("org-1", "kb-1")` | 不抛出异常 | ✅ |
| TC-DAL-002 | 跨组织 KB 验证失败 | P0 | unit | KB 属于 org-1 | `assertKnowledgeBaseOwnership("org-2", "kb-1")` | 抛出 "知识库不存在或无权访问" | ✅ |
| TC-DAL-003 | 不存在的 KB 验证失败 | P0 | unit | 无此 KB | `assertKnowledgeBaseOwnership("org-1", "nonexistent")` | 抛出 "知识库不存在或无权访问" | ✅ |
| **listKnowledgeBaseSummariesByOrg** | | | | | | | |
| TC-DAL-004 | 只返回本组织 KB | P1 | unit | org-1 有 2 KB，org-2 有 2 KB | `listKnowledgeBaseSummariesByOrg("org-1")` | 返回 2 条记录，均属于 org-1 | ✅ |
| TC-DAL-005 | 返回字段完整性 | P1 | unit | 同上 | 同上 | 每条记录含 id, name, description, type, documentCount, chunkCount, vectorizationStatus, boundEmployeeCount, lastSyncAt, updatedAt, createdAt | ✅ |
| TC-DAL-006 | 按 updatedAt 降序排列 | P2 | unit | KB 有不同 updatedAt | 同上 | 返回列表第一条的 updatedAt 最大 | ✅ |
| **getKnowledgeBaseById** | | | | | | | |
| TC-DAL-007 | 查询本组织已存在 KB | P1 | unit | KB 存在于 org-1 | `getKnowledgeBaseById("org-1", "kb-1")` | 返回非 null 的 KBDetail，含 sourceType/sourceUrl | ✅ |
| TC-DAL-008 | 跨组织查询返回 null | P1 | unit | KB 属于 org-1 | `getKnowledgeBaseById("org-2", "kb-1")` | 返回 `null` | ✅ |
| TC-DAL-009 | 不存在的 KB 返回 null | P2 | unit | 无此 KB | `getKnowledgeBaseById("org-1", "nonexistent")` | 返回 `null` | ✅ |
| **listKnowledgeItems** | | | | | | | |
| TC-DAL-010 | 分页返回第 1 页 | P1 | unit | KB 有 25 条 items | `listKnowledgeItems("org-1", "kb-1", { page: 1, pageSize: 20 })` | 返回 20 条 items，total=25，page=1，pageSize=20 | ✅ |
| TC-DAL-011 | 分页返回第 2 页 | P1 | unit | 同上 | `{ page: 2, pageSize: 20 }` | 返回 5 条 items，total=25 | ✅ |
| TC-DAL-012 | 搜索关键词过滤（ILIKE） | P1 | unit | KB 含不同 title 的 items | `{ search: "人工智能" }` | 只返回 title 或 snippet 含该关键词的 items | ✅ |
| TC-DAL-013 | tag 过滤 | P2 | unit | items 含不同 tags | `{ tag: "科技" }` | 只返回 tags 包含 "科技" 的 items | ✅ |
| TC-DAL-014 | pageSize 边界：超过 100 被限制 | P3 | unit | 无 | `{ pageSize: 200 }` | 实际 pageSize 被限制为 100 | ✅ |
| TC-DAL-015 | page 边界：负数被修正 | P3 | unit | 无 | `{ page: -1 }` | page 被修正为 1 | ✅ |
| **loadEmbeddedKnowledgeItems** | | | | | | | |
| TC-DAL-016 | 空 kbIds 返回空数组 | P1 | unit | 无 | `loadEmbeddedKnowledgeItems([])` | 返回 `[]` | ✅ |
| TC-DAL-017 | 只返回有 embedding 的 items | P1 | unit | KB 含 5 条有 embedding + 3 条无 embedding | 有效 kbIds | 返回 5 条 | ✅ |
| TC-DAL-018 | 过滤空数组 embedding | P2 | unit | 某 item 的 embedding 为 `[]` | 有效 kbIds | 该 item 不在返回结果中 | ✅ |

---

## Module: Inngest 向量化管道（knowledge-base-vectorize.ts）

**文件路径：** `src/inngest/functions/knowledge-base-vectorize.ts`
**函数名：** `knowledgeBaseVectorize`
**触发事件：** `kb/document-created`, `kb/document-updated`, `kb/reindex-requested`
**测试特点：** 需 Inngest 测试工具 mock `step.run`；涉及 DB 和 Jina API 的集成

### 测试数据准备

- Mock `step.run`：Inngest step runner 的 mock 实现
- Mock DB 数据：KB 下有若干 `embedding=null` 的 items
- Mock `generateEmbeddings`：返回固定维度向量
- Mock 失败场景：`generateEmbeddings` 抛出异常

### 测试用例

| # | 用例名称 | 优先级 | 类型 | 前置条件 | 输入 | 预期结果 | 自动化 |
|---|---------|-------|------|---------|------|---------|-------|
| TC-ING-001 | 正常向量化流程完整执行 | P1 | integration | KB 有 10 条 pending items | `kb/document-created` 事件 | status 从 pending → processing → done；10 条 items 获得 embedding；sync log `action='vectorize', status='success'` | ✅ |
| TC-ING-002 | 批次处理：超过 50 条分批 | P1 | integration | KB 有 80 条 pending items | 同上 | 至少执行 2 轮 load-pending + embed + write | ✅ |
| TC-ING-003 | 嵌入失败标记 KB 为 failed | P0 | integration | `generateEmbeddings` 始终抛出 | 同上 | KB status='failed'；sync log `status='error'`；原始 items 未被删除 | ✅ |
| TC-ING-004 | 0 条 pending items 直接完成 | P1 | unit | 所有 items 都已有 embedding | 同上 | 0 条处理；KB status='done' | ✅ |
| TC-ING-005 | reindex 事件清空后重新向量化 | P2 | integration | KB 已 done 状态 | `kb/reindex-requested` 事件 | 先清空 embedding，再全量重新生成 | ❌ |
| TC-ING-006 | 并发限制生效 | P3 | integration | 同时触发 3 个向量化事件 | 并行事件 | 最多 2 个并发执行（concurrency limit=2） | ❌ |
| TC-ING-007 | chunkCount 最终一致 | P3 | integration | 过程中有 items 被删除 | 完整流程 | finalize 步骤重新 COUNT 确保 chunkCount 准确 | ✅ |

---

## Module: Agent 集成（tool-registry + assembly + execution）

**文件路径：**
- `src/lib/agent/tool-registry.ts` — `createKnowledgeBaseTools()`
- `src/lib/agent/assembly.ts` — `assembleAgent()`
- `src/lib/agent/execution.ts` — `executeAgent()`

**测试特点：** 需 mock DB、Jina API、LLM 调用；验证 KB 工具的注入、过滤和执行

### 测试数据准备

- Mock employee 数据：含 `employee_knowledge_bases` 绑定
- Mock KB 状态：部分 `done`，部分 `pending`/`failed`
- Mock `searchKnowledgeBases` 返回固定结果
- Mock DB 查询：`knowledgeBases` 状态查询
- 无 KB 绑定的 employee 数据

### 测试用例

| # | 用例名称 | 优先级 | 类型 | 前置条件 | 输入 | 预期结果 | 自动化 |
|---|---------|-------|------|---------|------|---------|-------|
| **createKnowledgeBaseTools** | | | | | | | |
| TC-AGT-001 | 无绑定 KB 返回空 ToolSet | P1 | unit | 空 kbIds | `createKnowledgeBaseTools({ employeeKnowledgeBaseIds: [] })` | 返回 `{}`，无 kb_search 工具 | ✅ |
| TC-AGT-002 | 有绑定 KB 注册 kb_search 工具 | P1 | unit | kbIds=["kb-1","kb-2"] | `createKnowledgeBaseTools({ employeeKnowledgeBaseIds: ["kb-1","kb-2"] })` | 返回含 `kb_search` 的 ToolSet | ✅ |
| TC-AGT-003 | kb_search 执行：默认检索所有绑定 KB | P1 | unit | mock searchKnowledgeBases | 调用 kb_search，不传 kb_ids | searchKnowledgeBases 被调用，传入全部绑定 ID | ✅ |
| TC-AGT-004 | kb_search 执行：显式 kb_ids 交集过滤 | P0 | unit | 绑定 kb-1, kb-2 | 调用 kb_search，传 kb_ids=["kb-1","kb-3"] | 仅 kb-1 被检索，kb-3 被过滤 | ✅ |
| TC-AGT-005 | kb_search 执行：跳过未就绪 KB 并附警告 | P1 | unit | kb-1 status=done, kb-2 status=pending | 调用 kb_search，不传 kb_ids | 仅 kb-1 被检索；返回 warnings 含 kb-2 跳过信息 | ✅ |
| TC-AGT-006 | kb_search 执行：全部 KB 未就绪返回空 + 警告 | P0 | unit | 所有 KB status=pending | 调用 kb_search | hits=[]，warnings 列出所有跳过的 KB | ✅ |
| TC-AGT-007 | kb_search 执行：检索失败返回 error 字段 | P2 | unit | searchKnowledgeBases 抛出异常 | 调用 kb_search | 返回 hits=[]，error 字段含错误信息 | ✅ |
| **assembleAgent（KB 相关）** | | | | | | | |
| TC-AGT-008 | 有 KB 绑定时注入 kb_search 到 tools | P1 | integration | employee 有 KB 绑定 | `assembleAgent(employeeId)` | 返回的 agent.tools 含 name="kb_search" 的描述 | ✅ |
| TC-AGT-009 | 无 KB 绑定时不注入 kb_search | P1 | integration | employee 无 KB 绑定 | `assembleAgent(employeeId)` | agent.tools 不含 kb_search | ✅ |
| TC-AGT-010 | observer 权限不注入 kb_search | P1 | integration | employee 有 KB 绑定，authorityLevel="observer" | `assembleAgent(employeeId)` | agent.tools 不含 kb_search | ✅ |
| TC-AGT-011 | knowledgeBaseIds 正确传递 | P2 | integration | employee 绑定 2 个 KB | `assembleAgent(employeeId)` | agent.knowledgeBaseIds 为 2 个 KB 的 id 数组 | ✅ |
| **executeAgent（KB 相关）** | | | | | | | |
| TC-AGT-012 | 执行时 KB tools 被合并到 vercelTools | P1 | integration | agent.knowledgeBaseIds 非空 | `executeAgent(agent, input)` | toVercelTools 被调用时 knowledgeBaseTools 参数非 undefined | ❌ |
| TC-AGT-013 | 无 knowledgeBaseIds 时不创建 KB tools | P2 | integration | agent.knowledgeBaseIds 未定义 | `executeAgent(agent, input)` | createKnowledgeBaseTools 未被调用 | ❌ |

---

## 缺口分析（Gap Analysis）

### 1. 未覆盖的场景

| 缺口 | 严重度 | 说明 | 建议 |
|------|-------|------|------|
| **文件上传前端读取** | 中 | spec 提到上传 `.md/.txt` 文件，但 Server Action 层只接收文本内容，前端文件读取逻辑需额外 E2E 测试 | 补充 Playwright E2E 测试 |
| **并发写入竞争** | 中 | 多用户同时向同一 KB 添加文档时 `chunkIndex` 的连续性和 `documentCount` 的准确性 | 补充并发集成测试 |
| **级联删除验证** | 高 | `deleteKnowledgeBase` 依赖数据库外键级联删除，但单元测试中 mock 无法验证级联行为 | 补充真实 DB 集成测试 |
| **Inngest 端到端** | 中 | Inngest 函数的 step 编排需要 Inngest Dev Server 才能真实验证事件链 | 使用 `inngest/test` 工具包或集成测试 |
| **UI 交互流程** | 低 | 删除确认对话框的二次确认、菜单高亮等 UI 行为 | Playwright E2E |
| **侧边栏菜单项** | 低 | spec 要求 "知识库管理" 菜单项在侧边栏可见并正确高亮 | Playwright E2E |
| **getEmbeddingModel 环境变量覆盖** | 低 | `JINA_EMBEDDING_MODEL` 环境变量覆盖默认模型名的测试 | 补充 unit test |
| **revalidatePath 调用验证** | 低 | Server Actions 中 Next.js 缓存失效路径的正确性 | Mock 验证 |

### 2. 安全性专项

| 检查项 | 覆盖状态 | 说明 |
|--------|---------|------|
| 未认证访问所有 Action | ✅ TC-ACT-001 | requireAuth 抛出 |
| 跨租户 CRUD | ✅ TC-ACT-006, TC-ACT-009, TC-DAL-002 | assertOwnership 抛出 |
| kb_search 跨 KB 越权 | ✅ TC-AGT-004 | 交集过滤 |
| observer 权限工具限制 | ✅ TC-AGT-010 | 不注入 kb_search |
| SQL 注入（search 参数） | ❌ 缺失 | listKnowledgeItems 的 search 参数使用 ILIKE，需确认 Drizzle ORM 自动参数化 |
| 超大 payload（内容 >1MB） | ❌ 缺失 | addKnowledgeItem 未限制内容长度上限 |

### 3. 性能专项

| 检查项 | 覆盖状态 | 说明 |
|--------|---------|------|
| chunking 10 万字符性能 | ✅ TC-CHK-009 | <1s |
| loadEmbeddedKnowledgeItems 大数据量 | ❌ 缺失 | 当 chunks >10k 时内存和响应时间 |
| cosine similarity 高维向量计算 | ❌ 缺失 | 1024 维 x 10000 条的计算耗时 |
| Jina API 批次 100 条的响应时间 | ❌ 缺失 | 网络延迟基准 |

---

## 测试框架建议

### 单元测试

- **框架：** Vitest（与 Next.js 生态兼容性最佳，支持 TypeScript、ESM、路径别名 `@/*`）
- **Mock 工具：** `vi.mock()` / `vi.spyOn()` 用于 mock DB、fetch、Inngest
- **配置：** 在 `vitest.config.ts` 中配置 path alias 与 `tsconfig.json` 一致

### 集成测试

- **数据库：** 推荐使用 Docker 起一个本地 PostgreSQL（或 Supabase local），配合 `npm run db:push` 初始化 schema
- **Inngest：** 使用 `@inngest/test` 包提供的 mock step runner，或启动 Inngest Dev Server 做真实事件触发测试

### E2E 测试

- **框架：** Playwright
- **覆盖范围：** 创建知识库 → 添加文档 → 浏览文档 → 删除知识库 的完整用户路径
- **注意：** 向量化为异步流程，E2E 需轮询等待 vectorizationStatus 变为 `done`

### 测试目录结构建议

```
src/
├── lib/
│   └── knowledge/
│       ├── __tests__/
│       │   ├── chunking.test.ts      ← 纯函数，最先实现
│       │   ├── embeddings.test.ts    ← mock fetch
│       │   └── retrieval.test.ts     ← mock DAL + embeddings
│   └── dal/
│       └── __tests__/
│           └── knowledge-bases.test.ts  ← mock DB
├── app/
│   └── actions/
│       └── __tests__/
│           └── knowledge-bases.test.ts  ← mock DB + auth + inngest
├── inngest/
│   └── functions/
│       └── __tests__/
│           └── knowledge-base-vectorize.test.ts  ← mock step + DB
└── lib/
    └── agent/
        └── __tests__/
            └── kb-tools.test.ts  ← mock searchKnowledgeBases + DB
```

### 执行优先级

1. **第一批（P0 + chunking 全部）：** TC-CHK-*, TC-SNP-*, TC-DAL-001~003, TC-ACT-001~002, TC-ACT-006, TC-ACT-009, TC-RET-001~002, TC-AGT-004, TC-AGT-006, TC-ING-003
2. **第二批（P1 核心流程）：** TC-ACT-003~005, TC-ACT-007~008, TC-ACT-010~013, TC-ACT-015, TC-ACT-018, TC-ACT-020~021, TC-DAL-004~005, TC-DAL-007~008, TC-DAL-010~012, TC-DAL-016~017, TC-EMB-002~004, TC-RET-003~005, TC-AGT-001~003, TC-AGT-005, TC-AGT-008~010, TC-ING-001~002, TC-ING-004
3. **第三批（P2 + P3）：** 其余全部用例
