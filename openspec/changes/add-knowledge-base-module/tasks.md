# Tasks: Add Knowledge Base Management Module

## 1. Foundation (DB, DAL, Types)
- [x] 1.1 评估是否给 `knowledge_items` 增加 `metadata jsonb` 字段承载爬取元数据，若需要则更新 `src/db/schema/knowledge-bases.ts` 并生成 migration（评估结论：不需要新增字段。现有 `sourceDocument`、`sourceUrl`、`tags`、`sourceType` 已足够承载摄入元数据，避免新增 migration）
- [x] 1.2 在 `src/lib/types.ts` 新增前端类型：`KBSummary`, `KBDetail`, `KBItemRow`, `KBItemListResult`, `KBSyncLogRow`, `KBBindingRow`, `KBVectorizationStatus`, `KBType`
- [x] 1.3 扩展 `src/lib/dal/knowledge-bases.ts`：`listKnowledgeBaseSummariesByOrg`, `getKnowledgeBaseById`, `listKnowledgeItems`（分页 + 搜索 + 标签过滤）, `getKnowledgeBaseBindings`, `getKnowledgeBaseSyncLogs`, `loadEmbeddedKnowledgeItems`, `assertKnowledgeBaseOwnership`
- [x] 1.4 全部 DAL 读函数加 `organizationId` 过滤参数，拒绝跨租户查询（通过 `assertKnowledgeBaseOwnership` 在每次访问入口校验）

## 2. Server Actions (CRUD + 摄入)
- [x] 2.1 新建 `src/app/actions/knowledge-bases.ts`，使用 `requireAuth()` + `requireOrg()` 并在所有查询条件中强制带 `organizationId`
- [x] 2.2 `createKnowledgeBase(input)` — 新建 KB，写入 `knowledge_sync_logs` 一条 `created` 记录
- [x] 2.3 `updateKnowledgeBase(id, input)` — 编辑元数据
- [x] 2.4 `deleteKnowledgeBase(id)` — 删除 KB（依赖 `ON DELETE CASCADE`），写审计日志
- [x] 2.5 `addKnowledgeItem(kbId, {title, content, source?, tags?})` — 单条粘贴，先 chunking 再 upsert
- [x] 2.6 `crawlUrlIntoKB(kbId, url)` — 调用 `src/lib/web-fetch.ts` 的 Jina Reader 抓正文，失败写 sync_logs
- [x] 2.7 `updateKnowledgeItem(id, {title?, content?, tags?})` — 更新单条 chunk，清空 embedding 触发 re-vectorize
- [x] 2.8 `deleteKnowledgeItem(id)` — 删除单条 chunk
- [x] 2.9 `reindexKnowledgeBase(id)` — 全库清空 embedding + 触发 `kb/reindex-requested` 事件
- [x] 2.10 所有 action 在操作后 `revalidatePath('/knowledge-bases')` 或 `/knowledge-bases/[id]`

## 3. Chunking Utility
- [x] 3.1 新建 `src/lib/knowledge/chunking.ts`，实现段落切分 + 句号子切 + 字符数兜底策略（500-800 字符，50 字符 overlap），不依赖外部库；同时提供 `buildSnippet` 辅助
- [x] 3.2 单测：17 个用例全部通过（chunking.test.ts）。覆盖短文本不切分、段落切分、句号子切、硬切分、overlap 正确性、空输入、CRLF 处理、中英文混合、自定义选项、buildSnippet 截断和空格规范化。Vitest 框架已搭建，覆盖率 Lines 91.37%。

## 4. Embedding Pipeline (Inngest)
- [x] 4.1 新建 `src/lib/knowledge/embeddings.ts`：封装 Jina Embeddings API 调用（`generateEmbeddings` 批量 + `generateQueryEmbedding` 单条），批量请求最多 100 条，3 次重试 + 指数退避
- [x] 4.2 新建 `src/inngest/functions/knowledge-base-vectorize.ts`：订阅事件 `kb/document-created`, `kb/document-updated`, `kb/reindex-requested`
- [x] 4.3 函数逻辑：循环拉取 `embedding IS NULL AND knowledge_base_id = X` 的 chunks → 批量 embed → 写回 DB → 更新 `vectorization_status` 和 `chunk_count` → 写 sync_logs
- [x] 4.4 失败处理：单批失败重试 3 次（embeddings.ts 内）；最终失败 → KB 状态 `failed`，sync_logs 记录错误（vectorize 函数 finalize 步骤）
- [x] 4.5 在 `src/inngest/functions/index.ts` 注册新函数；在 `src/inngest/events.ts` 声明 3 个新事件类型
- [x] 4.6 在 `.env.example` 新增 `JINA_EMBEDDING_MODEL=jina-embeddings-v3`

## 5. Semantic Retrieval (Agent Tool)
- [x] 5.1 新建 `src/lib/knowledge/retrieval.ts`：实现 `searchKnowledgeBases(query, kbIds, topK)` —— query 生成 embedding、加载候选 chunks（DAL `loadEmbeddedKnowledgeItems`）、应用层余弦相似度打分、返回 top-K
- [x] 5.2 在 `src/lib/agent/tool-registry.ts` 新增 `createKnowledgeBaseTools(context)` 工厂，定义 `kb_search` 工具（inputSchema: query, kb_ids?, top_k?）
- [x] 5.3 工具调用时从 context 拿 `employeeKnowledgeBaseIds` → 与传入 `kb_ids` 取交集 → 调 `searchKnowledgeBases`
- [x] 5.4 只检索 `vectorization_status='done'` 的 KB，其他状态返回 `warnings` 提示信息
- [x] 5.5 在 `src/lib/agent/assembly.ts` 中：将 `knowledgeBaseIds` 写入 `AssembledAgent`、对 `observer` 以外授权层级的员工自动注入 `kb_search` 描述符；在 `src/lib/agent/execution.ts` 调用 `createKnowledgeBaseTools` 并通过 `toVercelTools` 第 4 个参数合并到 `vercelTools`

## 6. UI: `/knowledge-bases` 列表页
- [x] 6.1 新建 `src/app/(dashboard)/knowledge-bases/page.tsx` —— server 组件，`export const dynamic = 'force-dynamic'`
- [x] 6.2 新建 `src/app/(dashboard)/knowledge-bases/knowledge-bases-client.tsx` —— 列表卡片 + 新建按钮 + 搜索 + 状态筛选
- [x] 6.3 卡片内容：名称、描述、类型 badge、文档数、chunk 数、向量化状态、绑定员工数、相对更新时间
- [x] 6.4 "新建知识库" 对话框：名称、描述、类型四选一
- [x] 6.5 点击卡片跳转到详情页 `/knowledge-bases/[id]`

## 7. UI: `/knowledge-bases/[id]` 详情页
- [x] 7.1 新建 `src/app/(dashboard)/knowledge-bases/[id]/page.tsx`
- [x] 7.2 新建 `src/app/(dashboard)/knowledge-bases/[id]/kb-detail-client.tsx` —— Tabs 布局：文档 / 绑定员工 / 同步日志 / 设置
- [x] 7.3 "文档" Tab：列表 + "添加文档"下拉菜单 3 项（粘贴 / 上传 / URL）+ 单条删除（编辑入口预留，V1 暂未实现单条编辑 UI——可通过删除后重新添加完成；server action 已就绪）
- [x] 7.4 "添加文档" 各弹窗：
  - [x] 7.4.1 粘贴对话框（textarea + title 输入）
  - [x] 7.4.2 文件上传（接受 `.md, .txt, .markdown`，多文件，前端 FileReader 读文本）
  - [x] 7.4.3 URL 输入框（单个 URL，调 `crawlUrlIntoKB`）
- [x] 7.5 "绑定员工" Tab：只读列表展示哪些 AI 员工绑定了本 KB + 指向员工资料页的链接
- [x] 7.6 "同步日志" Tab：按时间倒序列出 `knowledge_sync_logs`，显示 status / action / detail / 计数
- [x] 7.7 "设置" Tab：编辑元数据 + "重建索引" 按钮 + "删除知识库" 危险区（双重确认对话框）
- [x] 7.8 向量化状态实时刷新：5 秒轮询（status 为 pending/processing 时启用，否则停止）

## 8. 侧边栏导航
- [x] 8.1 在 `src/components/layout/app-sidebar.tsx` "内容" 分组下新增菜单项 "知识库管理"，路径 `/knowledge-bases`，图标 `BookMarked`
- [x] 8.2 验证现有 `/channel-knowledge` 菜单项保持不变

## 9. 员工资料页联动
- [x] 9.1 `src/components/shared/kb-browser-dialog.tsx` 在标题下方新增 "前往知识库管理" 链接，跳到 `/knowledge-bases`

## 10. 验证 (Verification)
- [x] 10.1 `npx tsc --noEmit` 类型检查通过
- [x] 10.2 `npm run lint` 通过（仅在新文件中：原有的两处 lint 错误已修复；剩余项目级 errors/warnings 均为本 change 之外的预存在问题）
- [x] 10.3 `npm run build` 生产构建通过（`/knowledge-bases` 和 `/knowledge-bases/[id]` 路由出现在 build manifest 中）
- [ ] 10.4 手工验证流程 — **待用户运行时验证**：本地起 `npm run dev` 后逐项点击：
  - [ ] 10.4.1 新建 KB → 粘贴文档 → 观察 `vectorization_status` 从 pending → processing → done
  - [ ] 10.4.2 上传 .md 文件 → chunks 正确生成 → embedding 写入
  - [ ] 10.4.3 URL 爬取 → Jina 返回正文 → 正确存储
  - [ ] 10.4.4 在员工资料页绑定该 KB → 在 Chat Center 与该员工对话 → 触发 `kb_search` 工具 → 返回相关片段
  - [ ] 10.4.5 删除 KB → 级联清理 `knowledge_items` + `employee_knowledge_bases` + sync_logs
  - [ ] 10.4.6 多租户隔离：切换组织后只能看到本组织 KB
  - [ ] 10.4.7 "重建索引" 能清空并重新生成所有 embedding
- [x] 10.5 单测：`src/lib/knowledge/*` 总覆盖率 Stmts 93.19% / Lines 94.35%（39 个用例全通过，Vitest + v8 coverage）
- [ ] 10.6 性能冒烟：KB 含 1000 条 chunks 时，`kb_search` 单次查询 < 500ms（本地 Node）— **待用户在有真实数据时验证**

## 11. 文档
- [x] 11.1 更新 `CLAUDE.md` 记录新模块路径、DAL/Action 函数清单、Inngest 函数计数从 15→16、Agent 集成方式
- [x] 11.2 更新 `.env.example` 加入 `JINA_EMBEDDING_MODEL=jina-embeddings-v3`
- [ ] 11.3 为本 change 在 `openspec archive add-knowledge-base-module` 前确认所有 task 都已打勾 — 待手工验证（10.4）和测试基础设施（3.2/10.5）补齐后再 archive
