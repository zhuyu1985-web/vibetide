# Phase 1d-A：IM 发布 follow-up（地基 + 发布到 CMS 栏目）Design

## Summary

让用户在 mission 出结果后，回一句"把这篇发布到「新闻」"就能把刚生成的稿件发到华栖云 CMS 指定栏目。

两部分：
1. **地基（articleId 串联）**：1c 的 `recordSessionResult` 只写了文本摘要，丢了机器可读句柄。本期让会话**记住上次 mission 产出的 articleId**，供发布（及将来的配图 1d-B）锚定"这篇"。
2. **发布**：gateway 识别"发布到XX"意图 → 按栏目名解析 CMS catalog → 轻量确认 → 调**现成无登录态** `publishArticleToCms` → 回执 publishedUrl。

**复用现成**：`publishArticleToCms`（不调 requireAuth，operatorId 字符串 + org 由 article 决定，Inngest/agent 已这么用）、confirming 态机制（1a）、`recordSessionResult`（1c）、cms_catalogs 同步数据。

**不碰规划器**：发布意图在 gateway 直接判，不走 clarifyOrPlan（发布不是"规划写稿"，是对已有 article 的动作）。

## Scope

In scope：
- 地基：`channel_sessions` 加 `lastArticleId`；结果交付时反查并记录；过期/复位清理。
- 发布：渠道名→catalog resolver、gateway 发布意图分支、轻量确认（pendingPublish）、调 publishArticleToCms。

Out of scope（1d-B 独立 spec）：
- 文生图/视频/播客（kie.ai 接入，见 [[aigc-provider-kie-ai]]）。
- 精确"加配图"到已有 article。
- 发布意图走规划器/多渠道批量发布。

## Schema

`channel_sessions` 加两列（均 nullable）：
- `last_article_id uuid`（references articles.id, onDelete set null）——上次 mission 产出的稿件句柄（发布/配图 follow-up 锚点）。
- `pending_publish jsonb`——待确认的发布意图 `{ articleId, articleTitle, catalogName, target: { catalogId, appId, siteId } }`；非 confirming-publish 态为 null。

`articles` 加索引 `idx_articles_mission_id` on `articles.mission_id`（反查锚点，避免全表扫）。

> 注：`articles.missionId` 列已存在（articles.ts:59，FK→missions），只缺索引。

**schema 落地方式（统一，per [[local-db-push-prod-migrate]]）**：改完 `*.ts` schema 后，本期所有变更（channel_sessions 两列 + articles 索引）统一走**本地 `db:push`**（本地 127.0.0.1:5433 journal 空，用 push 维护，**不在本地跑 migrate**）；若 push 交互 TUI 卡住，用一次性 `db.execute(sql\`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...\` / \`CREATE INDEX IF NOT EXISTS ...\`)` 临时脚本 + `npx tsx --env-file=.env.local` 兜底，跑完删脚本。进生产时再按 CLAUDE.md 用 `db:generate` 产 migration。

## 数据流

**地基（结果交付记 articleId）**：
```
mission 成功 → sendChannelResult(ctx, missionId)
  → getLatestArticleByMission(missionId, orgId)  // 新 DAL，按 articles.missionId 反查最近一篇
  → recordSessionResult(key, { instruction, resultSummary, articleId })  // articleId 可空
       → 落 contextTurns（1c 既有）+ lastArticleId（新）+ 30min 窗口
  // mission 没产 article（纯检索/纯 LLM）→ articleId=null，follow-up 自然降级
```

**发布意图（gateway 自由消息分支，idle/有 lastArticleId）**：
```
handleFreeFormMessage:
  running 拦截 → confirming 分流 → [新] 发布意图分支 → clarifyOrPlan(既有)

发布意图分支：session.lastArticleId 存在 && isPublishIntent(text)
  → 解析渠道名（extractPublishTarget：发布/发到/推送...到? <栏目名>）
  → resolveCatalogByName(orgId, 栏目名)  // 新 DAL，cms_catalogs 按 name 匹配
     ├─ 匹配不到 → 回"没找到「XX」栏目，可发布到：<列几个候选>"
     └─ 命中 → updateSession(status:confirming, pendingPublish:{articleId,articleTitle,catalogName,target}, expiresAt:+30min)
              → 回"📋 将把《<标题>》发布到「<栏目>」，回复 确认 发布，或 取消。"

confirming 态收到消息（handleConfirmingMessage 扩展：按 pendingPublish vs pendingPlan 分流）：
  pendingPublish 存在时：
    isCancel → idle + 清 pendingPublish → "已取消发布。"
    isConfirm → 确保 article 置 approved → publishArticleToCms({
                  articleId, operatorId:"channel_system", triggerSource:"manual",
                  target: pendingPublish.target, allowUpdate:true })
                → 成功：idle + 清 → "✅ 已发布到「<栏目>」：<publishedUrl>"
                → CmsConfigError（org 未开 flag）→ "该组织未开启发布功能。"
                → 其它错误 → "发布失败：<msg>，可稍后重试。"
    其它 → "回复 确认 发布，或 取消。"
```

> ⚠️ **不双 pending**：pendingPublish 与 pendingPlan 互斥（一个会话要么在确认计划、要么在确认发布）。handleConfirmingMessage 先判 pendingPublish，再判 pendingPlan（既有逻辑）。

## Components

新建 DAL：
- `getLatestArticleByMission(missionId, orgId): Promise<{id,title,status}|null>`（`src/lib/dal/articles.ts`，按 `eq(articles.missionId)+eq(orgId)` 取最近一篇）。
- `resolveCatalogByName(orgId, name): Promise<{catalogId,appId,siteId,name}|null>`（`src/lib/dal/cms-catalogs.ts`，在 active cms_catalogs 里按 name 精确→包含匹配；多命中取最像的一条；附带列候选名用于匹配失败提示）。

改动：
- `src/db/schema/channel-sessions.ts`：加 lastArticleId + pendingPublish。
- `src/db/schema/articles.ts`：加 idx_articles_mission_id。
- `src/lib/dal/channel-sessions.ts`：`updateSession` 白名单 += lastArticleId, pendingPublish；`recordSessionResult` 入参 += articleId（写 lastArticleId）；`resetSession` + `getOrCreateSession` 过期分支清 lastArticleId + pendingPublish。
- `src/lib/channels/channel-result-notify.ts`：成功路径先 `getLatestArticleByMission` 反查 → 传 articleId 给 recordSessionResult。
- `src/lib/channels/gateway.ts`：新增 `isPublishIntent` + `extractPublishTarget`（纯函数，可单测）+ 发布意图分支 + `handlePublishIntent`；`handleConfirmingMessage` 扩展 pendingPublish 分流。
- `src/lib/channels/publish-followup.ts`（新）：`handlePublishConfirm(session, channelCtx)` 封装 publishArticleToCms 调用 + 状态置 approved + 错误归类（保持 gateway 瘦）。

> ⚠️ **置 approved 必须直接 `db.update(articles)`，不能用 `updateArticleStatus`**：该 Server Action（`src/app/actions/articles.ts`）第一行 `requireAuth()`，IM gateway 无登录态会抛 redirect。在 publish-followup.ts 里直接 `db.update(articles).set({ status: "approved" }).where(and(eq(articles.id, articleId), eq(articles.organizationId, orgId)))`（无 auth、org 限定），仅当当前状态 ∈ {draft,reviewing} 时置（已 approved/published 不动）。

复用：`publishArticleToCms`（`@/lib/cms`）、`isConfirm`/`isCancel`、confirming 态、`recordSessionResult`。

## Error Handling

- `lastArticleId` 为空（上次没产 article / 已过期）→ 发布意图分支不触发，落 clarifyOrPlan（会当普通请求澄清/规划）；或显式回"没有可发布的稿件，请先生成或发链接收稿"（择一，倾向后者更明确——当 isPublishIntent 命中但无 lastArticleId 时回提示）。
- 栏目名匹配不到 → 回提示 + 候选栏目名（resolveCatalogByName 返回 null 时，gateway 拉 listAllActiveCmsCatalogs 取前几个名字）。
- article 当前状态 draft/reviewing → 确认发布时置 approved（用户明确要发=批准意图）。已 published → publishArticleToCms 幂等（allowUpdate / findLatestSuccessByArticle）。
- org 未开 `VIBETIDE_CMS_PUBLISH_ENABLED` → publishArticleToCms 抛 CmsConfigError → 回"该组织未开启发布功能"。
- publishArticleToCms 网络/业务错误 → 归类回执，不崩 gateway。
- operatorId 用固定 `"channel_system"`（IM 无真实登录用户；cms_publications 审计记此值）。

## Verification

- 单测纯函数 `isPublishIntent` / `extractPublishTarget`（命中"发布到X/发到X/推送到X"，提取栏目名；非发布句不命中）。
- 单测 DAL `getLatestArticleByMission`（mock db）、`resolveCatalogByName`（精确/包含/无匹配）、`recordSessionResult`（带 articleId 写 lastArticleId）。
- 单测 gateway：有 lastArticleId + 发布意图 + 解析到栏目 → 进 confirming(pendingPublish) 回确认卡，不调 publishArticleToCms；confirming+pendingPublish+确认 → 调 publishArticleToCms + 回 URL；+取消 → idle 不发布；lastArticleId 空 + 发布意图 → 回"没有可发布的稿件"。
- 单测 `handlePublishConfirm`（mock publishArticleToCms）：置 approved + 调用参数正确；CmsConfigError → 对应文案。
- 回归：现有 channel-result-notify / gateway / channel-sessions 测试不破（recordSessionResult 签名加可选 articleId，旧调用兼容）。
- `tsc --noEmit` + `build` + `npm test` 全过。
- 端到端手测：起任务出稿 → 回"把这篇发布到「<真实栏目>」"→ 确认卡 → 确认 → 群里收到 publishedUrl；CMS 后台见该稿。

## Rollout

1. schema（lastArticleId + pendingPublish + articles.mission_id 索引）+ DAL（getLatestArticleByMission / resolveCatalogByName / recordSessionResult 扩参 / 白名单 / 过期清理）。
2. channel-result-notify 反查 articleId。
3. gateway 发布意图分支 + extract/intent 纯函数 + publish-followup helper + confirming pendingPublish 分流。
4. 全量验证 + 终审。
5. 端到端手测（需目标 org 开 VIBETIDE_CMS_PUBLISH_ENABLED + cms_catalogs 已同步）。
6. 合并 main。

## Future（1d-B / 后续）

- 配图/配视频/配播客（kie.ai，[[aigc-provider-kie-ai]]）——同样锚定 lastArticleId，出字节→TOS→写回 article。
- 发布支持多栏目/批量、定时发布。
- 发布意图纳入规划器（与写稿计划合并，一句话"写完发到X"端到端）。
