---
name: cms_publish
displayName: CMS 文稿入库发布
description: 把 VibeTide 审核通过的稿件（图文/图集/外链/视频/音频）通过华栖云 CMS `/web/article/save` 接口入库到指定 APP 栏目。支持 type=1/2/4/5/11 五种稿件类型，含字段映射、状态机、幂等、重试、入库状态追踪。当用户提及"入库""发稿""发布到 CMS""推送到 APP""draft 转发布"时调用。
version: 1.0.0
category: distribution

metadata:
  skill_kind: action  # DB enum 只有 6 个 category，action 作为 management 下的细分 kind
  scenario_tags: [news, politics, sports, variety, livelihood, podcast, drama, daily_brief]
  compatibleEmployees: [xiaofa, xiaoshen, leader]
  runtime:
    type: api_call
    avgLatencyMs: 2500
    maxConcurrency: 10
    timeoutMs: 20000
  requires:
    env:
      - CMS_HOST
      - CMS_LOGIN_CMC_ID
      - CMS_LOGIN_CMC_TID
      - VIBETIDE_CMS_PUBLISH_ENABLED
    dependencies: []
  implementation:
    scriptPath: src/lib/cms/publish/publish-article.ts
    testPath: src/lib/cms/__tests__/publish/
  openclaw:
    schemaPath: src/lib/cms/types.ts#CmsArticleSaveDTO
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# CMS 文稿入库发布（cms_publish）

## 使用条件

✅ **应调用场景**：
- 稿件已通过质量审核（`article.publishStatus == "approved"`）且指定了目标 APP 栏目
- 稿件需要从 draft → CMS 流转进入发布态
- 定时任务 / 每日专题触发的批量入库
- 用户在 VibeTide 稿件详情页点击「发布到 APP」

❌ **不应调用场景**：
- 稿件未通过审核（应先走 `quality_review` / `compliance_check`）
- 稿件目标是发社交媒体（应走 `publish_strategy` + 对应社媒 adapter）
- 视频稿件且视频尚未入 VMS（videoId 缺失时）

**前置依赖**：`CMS_HOST` / `CMS_LOGIN_CMC_ID` / `CMS_LOGIN_CMC_TID` env 必填；feature flag `VIBETIDE_CMS_PUBLISH_ENABLED=true`（按 org 灰度）。可选：`CMS_DEFAULT_SITE_ID/APP_ID/CATALOG_ID`（不配走代码 fallback 81/1768/10210）。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| articleId | uuid | ✗* | 已存在的 article ID。提供时跳过新建，直接推送（与 archive_to_drafts 串联用） |
| title | string | ✗* | 稿件标题（articleId 未提供时必填） |
| body | string | ✗* | 稿件正文（articleId 未提供时必填；纯文本/Markdown，mapper 会转 CMS content blocks） |
| summary | string | ✗ | 摘要（50-120 字） |
| authorName | string | ✗ | 作者，默认 "AI 编辑部" |
| coverImageUrl | string | ✗ | 封面图 URL |
| tags | string[] | ✗ | 标签数组 |
| catalogId | number | ✗ | 目标 CMS 栏目 ID。不填走 env `CMS_DEFAULT_CATALOG_ID`（默认 10210） |
| appId | number | ✗ | CMS APP 应用 ID。不填走 env `CMS_DEFAULT_APP_ID`（默认 1768） |
| siteId | number | ✗ | CMS 站点 ID。不填走 env `CMS_DEFAULT_SITE_ID`（默认 81） |
| dryRun | boolean | ✗ | dry-run 模式，不写 DB 不调 CMS，用于 skill 测试入口 |
| organizationId | string | (注入) | 由 workflow 执行器自动注入 |
| operatorId | string | (注入) | 由 workflow 执行器自动注入 |

**\*** `articleId` 或 (`title` + `body`) 二选一必填。两种使用模式：
- **A. 推送已存在稿件**：传 `articleId`，跳过新建直接推送。与 `archive_to_drafts` 串联：`articleId = {{stepN.created.0.articleId}}`
- **B. 一步创建并推送**：传 `title + body`，新建 articles 行后推送（旧路径）

**目标栏目配置方式**：在 workflow_template 的 cms_publish 步骤"参数配置"里加 `catalogId = <CMS 栏目数字 ID>` 即可推到指定栏目。同一组织通常 `appId/siteId` 共用 env 默认（1768/81），跨 app 才填。

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功 |
| publicationId | uuid | `cms_publications.id`（审计与轮询追踪用） |
| cmsArticleId | string | CMS 侧稿件 ID（成功时返回） |
| cmsState | enum | `submitting` / `submitted` / `synced` / `retrying` / `rejected_by_cms` / `failed` |
| previewUrl / publishedUrl | string | CMS 预览 / 正式地址 |
| error | object | `{code, message, stage, retriable}`；stage ∈ `mapping/auth/network/cms_business/polling` |
| timings | object | `{totalMs, mappingMs, httpMs, pollingMs?}` |

完整 DTO 结构（`CmsArticleSaveDTO` / `MapperContext` / `CmsPublicationState` 等）见 [src/lib/cms/types.ts](../../src/lib/cms/types.ts) 与 [src/lib/cms/publish/publish-article.ts](../../src/lib/cms/publish/publish-article.ts)。

## 工作流 Checklist

执行时按顺序完成以下 9 步，失败在对应步骤抛错并落 `cms_publications` 记录。

- [ ] Step 1: Feature flag `isCmsPublishEnabled()` + `requireCmsConfig()`（env 全）
- [ ] Step 2: `getArticleById(articleId)` 加载稿件；不存在抛 `CmsConfigError`
- [ ] Step 3: 状态合法性检查（`publishStatus ∈ {approved, publishing, published}`）
- [ ] Step 4: `loadMapperContext(org, target?)` 取 siteId/appId/catalogId（target 来自工具入参聚合的 `{catalogId,appId,siteId}`，未传走 env 默认）
- [ ] Step 5: 幂等检查 — 查 `cmsPublications` 最近记录；`synced` 且 `!allowUpdate` → 直接返回；`allowUpdate` → DTO 附 `articleId` 走 MODIFY
- [ ] Step 6: `mapArticleToCms(article, ctx)` → 按 type=1/2/4/5/11 分发 mapper → 生成 `CmsArticleSaveDTO`
- [ ] Step 7: `createPublication({state:"submitting", requestHash, requestPayload, attempts})`
- [ ] Step 8: `cmsClient.saveArticle(dto)` → 解析响应 → `updateToSubmitted({cmsArticleId, publishedUrl, previewUrl})`
- [ ] Step 9: 并发触发 — `notifyMissionChannelSafely`（落 `workflow_artifacts` + SSE）+ Inngest `cms/publication.submitted` 启动 `cmsStatusPoll` 轮询 synced

**失败分支**：`markAsFailed` 写 `errorCode/errorMessage`；若 `classifyError === "retriable"` 发 `cms/publication.retry` 进 `cmsPublishRetry`（退避 1s/2s/4s，3 次后 dead-letter）。

## 5 种 type 映射摘要

mapper 路由在 `Step 6` 内部执行，判定优先级从上到下：

| 判定条件 | CMS type | 名称 | 必填字段（除 title/author/username/logo） | 示例栏目（catalogId） |
|---------|---------|------|-----------------------------------------|---------|
| `article.audioId` 存在 | `11` | 音频 | `articleContentDto.audioDtoList[]`（含 audioId） | `10462`（AI 日报，音频可用）/ 音频专属栏目 |
| `article.videoId` 存在 | `5` | 视频 | `articleContentDto.videoDtoList[]`（含 videoId） | `10127`（置顶热点新闻）/ `10230`（时政要闻）等视频允收栏目 |
| `article.externalUrl` && `!body` | `4` | 外链 | `redirectUrl` | `10127`（置顶热点新闻）/ `10462`（AI 日报）等图文/外链栏目 |
| `mediaType=gallery` && `images.length≥3` | `2` | 图集 | `images[]`（≥3 张，含 image+note）+ `articleContentDto.imageDtoList` + `appCustomParams.customStyle.imgPath`（前 3 图 URL） | `10127`（置顶热点新闻）/ `10463`（本地新闻）等支持图集的栏目 |
| 其他（默认） | `1` | 图文 | `content` + `articleContentDto.htmlContent`（自动包 `<div id="editWrap">`） | 所有栏目 |

**公共字段映射**（所有 type）：`title`/`listTitle` ≤ 80 字 · `shortTitle` fallback 取前 20 字 · `author` fallback "智媒编辑部" · `username` 取 env `CMS_USERNAME` · `keyword/tags` 取前 10 · `logo` 必填（`coverImageUrl` fallback `CMS_DEFAULT_COVER_URL`）· `status` 由 VibeTide `publishStatus` 映射（draft=0/pending=20/published=30/rejected=60）· `referType=9`（AI 自产）· `version="cms2"` 固定 · `tenantId` 取 env。

## 质量把关

**自检阈值表（执行后写入 `cms_publications.self_eval`）：**

| # | 检查点 | 通过条件 | 未通过 |
|---|-------|---------|-------|
| 1 | Response zod 校验 | `CmsArticleSaveResponse` 通过 | 写 warning，不中断 |
| 2 | cmsArticleId 形态 | `/^\d+$/` 正整数 | 抛 `CmsSchemaError` |
| 3 | required 字段完整 | 按 type 校验表（见上） | 抛 `CmsSchemaError`，不重试 |
| 4 | logo URL 可访问 | HEAD 200 | 用 `CMS_DEFAULT_COVER_URL` 兜底，写 warning |
| 5 | timings.httpMs | ≤ 10000ms | 写 info，监控追踪 |
| 6 | 轮询终态 | `synced` 或主动停 | 停在 `submitted` 可接受（CMS 侧人工发布） |

**决策表（关键分支）：**

| 场景 | 条件 | 动作 |
|------|------|------|
| 凭证失效 | `state=401` / message 含 "未登录" | 抛 `CmsAuthError`；告警；暂停队列避免封号 |
| 栏目不存在 | CMS 返回栏目无效 | 抛 `CmsBusinessError`；运营修正 workflow_template 步骤的 `catalogId` 参数（或检查 env `CMS_DEFAULT_CATALOG_ID`） |
| 图片 URL 无效 | logo HEAD 失败 | `CMS_DEFAULT_COVER_URL` 兜底，继续 |
| 已入过（有 cmsArticleId） | `existing.cmsState==="synced"` | `allowUpdate=true` 走 MODIFY；`false` 直接返回 |
| 网络超时 / 5xx | `AbortError` / `state≥500` | `retrying`，退避 1s/2s/4s，3 次后 `failed` |
| 4xx 业务错误（非 401/408/429） | `state 400-499` | 不重试，直接 `failed` |
| 轮询 5 次仍 "20" | CMS 侧需人工发布 | 终态 `submitted`，任务中心显示"待 CMS 发布" |

## 输出模板

```
CMS 入库完成！

📤 稿件信息
   • 标题：{article.title}
   • 类型：{typeLabel(type)} (type={type})
   • 作者：{mappedAuthor}
   • 封面：{coverSource} [使用/兜底]

📍 目标栏目
   • CMS 栏目 ID：{ctx.catalogId}（来源：步骤参数 / env 默认）
   • APP 应用：{ctx.appId} · 站点：{ctx.siteId}

📊 入库结果
   ✓ CMS 文稿 ID：{cmsArticleId}
   ✓ 状态：{cmsState}
   ✓ 用时：{timings.totalMs}ms (映射 {timings.mappingMs}ms / HTTP {timings.httpMs}ms)
   ✓ 尝试次数：{publication.attempts}

🔗 访问链接
   • 预览：{previewUrl}
   • 正式地址：{publishedUrl}

📝 后续步骤
   → 已进入 CMS 待发布（status=20），等待人工发布或自动推送
   → 任务中心：Mission {missionId} → Artifact {artifactId}
```

失败模板替换入库结果段为 `❌ 错误阶段 {stage} / 代码 {code} / 可重试 {retriable}`，并附建议处理 hint。

## EXTEND.md 示例

支持按组织/项目级配置入库偏好，查找路径：`.vibetide-skills/cms_publish/EXTEND.md` → `$HOME/.config/vibetide-skills/cms_publish/EXTEND.md` → `$HOME/.vibetide-skills/cms_publish/EXTEND.md`。

```yaml
# .vibetide-skills/cms_publish/EXTEND.md
default_author: "深圳广电编辑部"
default_source: "深圳广电"
default_cover_url: "https://your-cdn.com/default-cover.jpg"
default_comment_flag: 1
default_tags_flag: 1

polling_enabled: true
polling_max_attempts: 5
polling_intervals_sec: [5, 10, 20, 40, 60]

# 按目标栏目 ID 策略覆盖
catalog_overrides:
  10230:                  # 时政要闻
    default_author: "时政编辑部"
    polling_max_attempts: 8         # 时政稿需更久确认
  10127:                  # 置顶热点新闻
    default_author: "热点报道团"
```

**值优先级**：函数参数 → 稿件 `article.metadata.*` → EXTEND `catalog_overrides.<catalogId>` → EXTEND 全局 → Skill 代码默认。

## 上下游协作

- **上游触发**：`quality_review` / `compliance_check` 产出 approved 稿件 → 稿件详情页「发布到 APP」按钮 / 每日定时 / workflow step。目标栏目由 workflow_template 的 cms_publish 步骤参数 `catalogId` 指定（不指定走 env `CMS_DEFAULT_CATALOG_ID`）；不依赖 `cms_catalog_sync`。
- **下游消费**：
  - Inngest `cmsStatusPoll`（event `cms/publication.submitted`）— 5 次指数退避查 `getMyArticleDetail` 确认 `synced`
  - Inngest `cmsPublishRetry`（event `cms/publication.retry`）— 失败重试 3 次
  - `workflow_artifacts` — `artifactType=cms_publication`，关联 mission
  - 任务中心 SSE — `cms_publication_completed` / `cms_publication_failed`
  - `data_report` — 下游读 `cms_publications` 统计发布情况
- **协作员工**：发起者 `xiaofa`（渠道运营师）/ `leader`；上游审核 `xiaoshen`（质量审核官）；所有员工可在任务中心观察
- **并发保护**：按 `article_id` 行锁 `SELECT FOR UPDATE SKIP LOCKED`；`request_hash` 判重跳过重复 DTO

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `CmsAuthError: 未登录` | `login_cmc_id` / `login_cmc_tid` 过期 | 更新 env；Phase 2 接 MMS/CMC 自动鉴权；暂停队列 |
| `CmsBusinessError: 栏目不存在` | catalogId 失效 / 不在该 app 下 | 在华栖云 CMS 后台核对 catalogId 数字；更新 workflow_template 步骤参数 `catalogId` 或 env `CMS_DEFAULT_CATALOG_ID` |
| `CmsSchemaError: missing content` | type=1 但 article.body 空 | 检查上游 `content_generate` 是否失败 |
| 入稿成功但轮询一直 "20" | CMS 侧需人工发布 | 正常现象；如需自动上线，传 `targetCmsStatus=published` |
| 封面图破图 | URL 不可访问或被 CDN 拒 | 上传到 CMS 媒资库；或用 `CMS_DEFAULT_COVER_URL` 兜底 |
| 图集首图异常 | `appCustomParams.customStyle.imgPath` 未填 | 检查 mapper，需为前 3 张图 URL |
| 视频稿 videoId 不存在 | 未入 VMS | 本期由华栖云 AIGC 侧负责；VibeTide 不直发 type=5 |
| 并发同一 article 被处理两次 | 行锁未生效 | 确认 `FOR UPDATE SKIP LOCKED` 已开启 |

## 参考资料

- 主入口：[src/lib/cms/publish/publish-article.ts](../../src/lib/cms/publish/publish-article.ts)（`publishArticleToCms` 9 步主流程）
- Mapper：[src/lib/cms/article-mapper.ts](../../src/lib/cms/article-mapper.ts)（5 种 type 分发）+ `mappers/type-1.ts` ~ `type-11.ts`
- Schema 类型：[src/lib/cms/types.ts](../../src/lib/cms/types.ts)（`CmsArticleSaveDTO` / `MapperContext` / `CmsPublicationState`）
- HTTP 客户端：[src/lib/cms/client.ts](../../src/lib/cms/client.ts) + [src/lib/cms/api-endpoints.ts](../../src/lib/cms/api-endpoints.ts)（`saveArticle` / `getArticleDetail`）
- DAL：`src/lib/dal/cms-publications.ts`（`createPublication` / `updateToSubmitted` / `markAsFailed` / `findLatestByArticle`）
- Feature flag：[src/lib/cms/feature-flags.ts](../../src/lib/cms/feature-flags.ts)（`isCmsPublishEnabled` / `requireCmsConfig`）
- Inngest：`src/inngest/functions/cms-status-poll.ts`（轮询） · `cms-publish-retry.ts`（重试）
- Server Action：`src/app/actions/cms.ts#publishArticleToCms`
- 测试：[src/lib/cms/__tests__/publish/](../../src/lib/cms/__tests__/publish/)（`publish-article.test.ts` / `request-hash.test.ts`）
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md)
- 参考 Spec（栏目参数化）：[docs/superpowers/specs/2026-05-29-cms-publish-catalog-selector-design.md](../../docs/superpowers/specs/2026-05-29-cms-publish-catalog-selector-design.md)

- **媒体行业专业标准（共享）**：[../../docs/skills/media-industry-standards.md](../../docs/skills/media-industry-standards.md)

