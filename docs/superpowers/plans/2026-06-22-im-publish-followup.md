# Phase 1d-A：IM 发布 follow-up 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps 用 `- [ ]` 跟踪。

**Goal:** mission 出结果后用户回"把这篇发布到「新闻」"→ 发到华栖云 CMS 栏目。含 articleId 串联地基（发布/配图共用）。

**Architecture:** 结果交付反查 mission 产出的 articleId 存进 session.lastArticleId；gateway 识别发布意图 → 按栏目名解析 CMS catalog → 轻量确认（pendingPublish）→ 调无登录态 publishArticleToCms。不碰规划器。

**Tech Stack:** TS / Drizzle / Vitest。复用 `publishArticleToCms`(@/lib/cms)、confirming 态、recordSessionResult。

**Spec:** `docs/superpowers/specs/2026-06-22-im-publish-followup-design.md`

**分支：** `claude/im-publish-followup`（off main）。

**schema 落地：** 本期 schema 变更统一本地 `db:push`（per memory，本地 journal 空；TUI 卡用 `db.execute(ALTER/CREATE INDEX IF NOT EXISTS)` 临时脚本 + tsx，跑完删）。

---

### Task 1dA-T1: 地基 — schema + DAL（articleId 串联）

**Files:** `src/db/schema/channel-sessions.ts`、`src/db/schema/articles.ts`、`src/lib/dal/channel-sessions.ts`、`src/lib/dal/articles.ts`；Test: `src/lib/dal/__tests__/channel-sessions.test.ts`、`articles` DAL 测试（若有，否则在 channel-sessions.test 旁加）。

- [ ] **Step 1: schema**
  - `channel-sessions.ts` 加 `lastArticleId: uuid("last_article_id").references(() => missions... 不对，references articles.id)` — 实际：`import { articles }` 可能成循环；用 `uuid("last_article_id")` 不加 FK 引用（或软引用）。**核对 channel-sessions.ts 是否已 import 其它表做 FK**（activeMissionId references missions）。若 articles import 不成环就加 FK `references(()=>articles.id,{onDelete:"set null"})`，否则裸 uuid 列 + 注释。再加 `pendingPublish: jsonb("pending_publish").$type<{articleId:string;articleTitle:string;catalogName:string;target:{catalogId:number;appId:number;siteId:number}}>()`。
  - `articles.ts`：当前 `pgTable("articles", {...})` 只有两参，需 ① 从 `drizzle-orm/pg-core` import 补 `index`；② 改成三参回调形式加索引：
    ```ts
    import { pgTable, uuid, text, timestamp, integer, jsonb, index /* ...现有 */ } from "drizzle-orm/pg-core";
    export const articles = pgTable("articles", { /* ...现有列... */ }, (table) => [
      index("idx_articles_mission_id").on(table.missionId),
    ]);
    ```
    （若该表已有第二参回调/已 import index，则只追加这条 index）。
- [ ] **Step 2: push schema** — 改完跑本地 `npm run db:push`（卡则临时 ALTER/CREATE INDEX 脚本兜底）。
- [ ] **Step 3: DAL（先写测试）**
  - `getLatestArticleByMission(missionId, orgId): Promise<{id:string;title:string;status:string}|null>`（articles.ts，`and(eq(missionId),eq(orgId))` orderBy createdAt desc limit 1）。
  - `recordSessionResult` 入参加可选 `articleId?: string`，SET 里写 `lastArticleId: args.articleId ?? null`。
  - `updateSession` 白名单 += `lastArticleId`、`pendingPublish`。
  - `resetSession` + `getOrCreateSession` 过期分支 SET 里加 `lastArticleId: null, pendingPublish: null`。
  - 测试：getLatestArticleByMission（mock db 返回行/空）；recordSessionResult 带 articleId 写 lastArticleId；resetSession 清 lastArticleId/pendingPublish。
- [ ] **Step 4: tsc + 相关测试通过**
- [ ] **Step 5: commit** `feat(channel): 地基 articleId 串联——session.lastArticleId + getLatestArticleByMission + 索引`

---

### Task 1dA-T2: 渠道 resolver + 发布意图纯函数

**Files:** `src/lib/dal/cms-catalogs.ts`、`src/lib/channels/publish-intent.ts`（新）；Test: 对应 __tests__。

- [ ] **Step 1: 写测试**
  - `isPublishIntent(text)`：命中"发布到/发到/推送到/发布 X/上线到"，不命中普通写稿/检索句。
  - `extractPublishTarget(text)`：从"把这篇发布到新闻"提取 `"新闻"`；无目标返回 null。
  - `resolveCatalogByName(orgId, name)`：mock cms-catalogs 数据，精确名命中 / 包含匹配命中 / 无匹配返回 null。
- [ ] **Step 2: 实现**
  - `src/lib/channels/publish-intent.ts`：`isPublishIntent` + `extractPublishTarget`（正则纯函数）。
  - `resolveCatalogByName(orgId, name): Promise<{catalogId:number;appId:number;siteId:number;name:string}|null>`（cms-catalogs.ts，复用 `listAllActiveCmsCatalogs` 再在应用层 name 精确→includes 匹配；多命中取名字最短/最接近一条）。另导出 `listCatalogNames(orgId)` 或复用现成，给匹配失败列候选用。
- [ ] **Step 3: tsc + 测试通过**
- [ ] **Step 4: commit** `feat(channel): 发布意图识别纯函数 + resolveCatalogByName 栏目解析`

---

### Task 1dA-T3: 集成 — 结果反查 + gateway 发布分支 + 确认发布

**Files:** `src/lib/channels/channel-result-notify.ts`、`src/lib/channels/gateway.ts`、`src/lib/channels/publish-followup.ts`（新）；Test: `channel-result-notify.test.ts`、`gateway-clarify-loop.test.ts`、新 `publish-followup.test.ts`。

- [ ] **Step 1: 写测试（先红）**
  - channel-result-notify：成功 mission → 先 `getLatestArticleByMission` → recordSessionResult 收到 articleId（mock 反查返回 {id} → 断言 recordSessionResult 第二参含 articleId）。
  - gateway：①有 lastArticleId + 发布意图 + 解析到栏目 → updateSession(confirming, pendingPublish) + 回确认卡，不调 publishArticleToCms；②confirming+pendingPublish+确认 → 调 handlePublishConfirm/publishArticleToCms + 回 URL；③+取消 → idle 清 pendingPublish；④有发布意图但 lastArticleId 空 → 回"没有可发布的稿件"；⑤栏目匹配不到 → 回"没找到「X」栏目"。
  - publish-followup：handlePublishConfirm mock publishArticleToCms → 置 approved（mock db.update）+ 调用 target 正确 + 成功回 URL；**断言 db.update（置 approved）在 publishArticleToCms 之前调**（顺序反了真环境会被 CmsConfigError 拦，mock 下不报——用 vitest `invocationCallOrder` 或 mock.calls 时序校验）；CmsConfigError → "未开启发布"。
- [ ] **Step 2: 实现**
  - channel-result-notify 成功路径：`const art = await getLatestArticleByMission(missionId, mission.organizationId); await recordSessionResult(key, { instruction, resultSummary, articleId: art?.id });`
  - `publish-followup.ts`：`handlePublishConfirm(session, channelCtx): Promise<{reply:string}>`——读 session.pendingPublish；置 approved（直接 `db.update(articles).set({status:"approved"}).where(and(eq(id),eq(org)))` 仅当状态∈{draft,reviewing}）；`publishArticleToCms({articleId, operatorId:"channel_system", triggerSource:"manual", target, allowUpdate:true})`；成功回 `✅ 已发布到「${catalogName}」：${result.publishedUrl ?? result.previewUrl ?? "已提交"}`；catch CmsConfigError → "该组织未开启发布功能。"；其它 → "发布失败：<msg>，可稍后重试。"
  - gateway：import isPublishIntent/extractPublishTarget/resolveCatalogByName/handlePublishConfirm/db/articles。在 handleFreeFormMessage 的 confirming 分流之后、clarifyOrPlan 之前插发布意图分支：
    ```ts
    if (isPublishIntent(text)) {
      if (!session.lastArticleId) return { reply: "没有可发布的稿件，请先生成或发链接收稿。" };
      return handlePublishIntent(text, session, channelCtx);
    }
    ```
    `handlePublishIntent`：extractPublishTarget → 空则回"要发布到哪个栏目？"；resolveCatalogByName → 空则回"没找到「X」栏目，可发布到：<候选>"；命中 → 用 `getArticleById(session.lastArticleId)` 取 article（已返回 title + organizationId）；**校验 `article.organizationId === channelCtx.organizationId`**（防 articleId 跨 org 泄露），不符则当作无可发布稿件回提示 → updateSession(confirming, pendingPublish:{articleId,articleTitle:article.title,catalogName,target}, expiresAt) → 回确认卡。
  - `handleConfirmingMessage` 扩展：函数入口先判 `session.pendingPublish`：isCancel→idle清pendingPublish回"已取消发布"；isConfirm→`handlePublishConfirm`→idle清；其它→"回复 确认 发布，或 取消"。再走既有 pendingPlan 逻辑。
- [ ] **Step 3: tsc + 测试通过**
- [ ] **Step 4: commit** `feat(channel): IM 发布 follow-up——结果反查 articleId + 发布意图确认 + publishArticleToCms`

---

### Task 1dA-T4: 全量验证 + 终审 + 合并

- [ ] **Step 1:** `npx tsc --noEmit && npm run build && npx vitest run` 全过。
- [ ] **Step 2:** 终审 reviewer 审 diff（schema/DAL/gateway/publish-followup），按 spec 核对：无登录态发布、置 approved 用直接 db.update（非 Server Action）、pendingPublish/pendingPlan 互斥分流、lastArticleId 反查/清理、operatorId='channel_system'、feature flag 错误归类。
- [ ] **Step 3:** 端到端手测清单（需目标 org 开 VIBETIDE_CMS_PUBLISH_ENABLED + cms_catalogs 已同步）：起任务出稿 → "把这篇发布到「<真实栏目>」" → 确认卡 → 确认 → 收 publishedUrl。
- [ ] **Step 4:** finishing-a-development-branch ff-merge → main。

---

## Remember
- 置 approved **直接 db.update**，不用 updateArticleStatus（带 requireAuth 会崩）。
- pendingPublish 与 pendingPlan 互斥；handleConfirmingMessage 先判 pendingPublish。
- lastArticleId 为空（mission 没产 article / 过期）→ 发布意图回"没有可发布的稿件"，不崩。
- 发布不碰规划器；operatorId 固定 "channel_system"。
- schema 本地 db:push，不在本地 migrate。
