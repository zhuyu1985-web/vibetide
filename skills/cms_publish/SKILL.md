---
name: cms_publish
displayName: CMS 文稿入库发布
description: 把 VibeTide 审核通过的稿件（图文/图集/外链/视频/音频）通过华栖云 CMS `/web/article/save` 接口入库到指定 APP 栏目。支持 type=1/2/4/5/11 五种稿件类型，含字段映射、状态机、幂等、重试、入库状态追踪。当用户提及"入库""发稿""发布到 CMS""推送到 APP""draft 转发布"时调用。
version: 1.0.0
category: management
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
      - CMS_TENANT_ID
      - CMS_USERNAME
    dependencies:
      - cms_catalog_sync (栏目映射必须先同步过至少一次)
---

# CMS 文稿入库发布（cms_publish）

## Language

**严格要求**：本 skill 的所有执行过程、日志输出、报错信息均使用中文。输出给用户的 Completion Report 也用中文。

## When to Use

✅ **应调用场景**：
- 稿件已通过质量审核（`article.publishStatus == "approved"`）且指定了目标 APP 栏目
- 稿件需要从 draft → CMS 流转进入发布态
- 定时任务/每日专题触发的批量入库
- 用户在 VibeTide 稿件详情页点击「发布到 APP」

❌ **不应调用场景**：
- 稿件未通过审核（应先走 `quality_review` / `compliance_check`）
- 稿件目标是发社交媒体（应走 `publish_strategy` + 对应社媒 adapter）
- 视频稿件且视频尚未入 VMS（videoId 缺失时）
- `app_channels` 映射表未同步（首次使用前必须先跑 `cms_catalog_sync`）

## Input Schema

```typescript
import { z } from "zod";

export const CmsPublishInputSchema = z.object({
  articleId: z.string().uuid(),
  // ★ 与 §9.2 规范化 9 APP 栏目一致（来源：主文档 §2.1 / §9.2 / §11.5 seed）
  // 运行时通过 app_channels 表校验是否存在；此处枚举仅作为文档型约束
  appChannelSlug: z.enum([
    "app_home",
    "app_news",
    "app_politics",
    "app_sports",
    "app_variety",
    "app_livelihood_zhongcao",
    "app_livelihood_tandian",
    "app_livelihood_podcast",
    "app_drama",
  ]),
  // 可选：覆盖栏目默认 catalogId（多栏目场景）
  overrideCatalogId: z.string().optional(),
  // 目标状态；默认 pending（CMS 待发布）；如需直接上线传 published
  targetCmsStatus: z.enum(["draft", "pending", "published"]).default("pending"),
  // 幂等控制：是否允许覆盖 CMS 上已有稿件
  allowUpdate: z.boolean().default(true),
  // 操作者（留痕用，通常是 AI 员工 slug 或 user id）
  operatorId: z.string(),
  // 触发源（人工/定时/工作流）
  triggerSource: z.enum(["manual", "scheduled", "workflow", "daily_plan"]).default("workflow"),
});

export type CmsPublishInput = z.infer<typeof CmsPublishInputSchema>;
```

## Output Schema

```typescript
export const CmsPublishOutputSchema = z.object({
  success: z.boolean(),
  publicationId: z.string().uuid(),       // cms_publications.id
  cmsArticleId: z.string().optional(),    // 成功时返回
  // ★ 与 §3.6 状态机 + §11.3 cmsPublicationStateEnum 严格一致
  cmsState: z.enum([
    "submitting",
    "submitted",
    "synced",
    "retrying",
    "rejected_by_cms",
    "failed",
  ]),
  previewUrl: z.string().url().optional(),
  publishedUrl: z.string().url().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stage: z.enum(["mapping", "auth", "network", "cms_business", "polling"]),
    retriable: z.boolean(),
  }).optional(),
  timings: z.object({
    totalMs: z.number(),
    mappingMs: z.number(),
    httpMs: z.number(),
    pollingMs: z.number().optional(),
  }),
});
```

## Pre-flight Check

执行前必须通过以下 6 项环境与数据检查。**任一失败 → 立即停止并返回结构化错误**，不降级。

```bash
# Check 1: 环境变量齐全
node -e "['CMS_HOST','CMS_LOGIN_CMC_ID','CMS_LOGIN_CMC_TID','CMS_TENANT_ID','CMS_USERNAME'].forEach(k=>{if(!process.env[k])throw new Error('缺失 '+k)})"

# Check 2: CMS host 可达
curl -s -o /dev/null -w "%{http_code}" "${CMS_HOST}/web/catalog/getChannels" -X POST \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" \
  -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" \
  -d '{"appAndWeb":1}' --max-time 5

# Check 3: 栏目映射表有数据
psql $DATABASE_URL -c "SELECT COUNT(*) FROM cms_catalogs WHERE organization_id = '$ORG_ID';"
# 预期 > 0；若为 0 → 提示先跑 cms_catalog_sync

# Check 4: app_channels 映射已配置
psql $DATABASE_URL -c "SELECT slug FROM app_channels WHERE organization_id = '$ORG_ID';"

# Check 5: 稿件存在且状态合法
# article.publishStatus ∈ {approved, publishing, published}（后两者支持重发）

# Check 6: 稿件封面图 URL 可访问（type=1/2/5/11 都需要 logo）
curl -I "$article.coverImageUrl" --max-time 3
```

### Pre-flight 失败处理表

| Check | 失败 | 处理 |
|-------|------|------|
| 1 | env 缺失 | `throw CmsConfigError("CMS env not configured")`；Mission 进 failed；写 audit |
| 2 | host 不可达 | `throw CmsNetworkError("CMS unreachable")`；进 retry（最多 3 次） |
| 3 | 栏目映射为空 | 自动触发 `cms_catalog_sync`；同步完成后继续；若同步仍失败则 failed |
| 4 | app_channels 无对应 slug | `throw CmsConfigError("app_channel_not_mapped")`；提示运营在 `/settings/cms-mapping` 配置 |
| 5 | 稿件状态不合法 | `throw InvalidStateError("article not approved")`；不重试 |
| 6 | 封面图不可访问 | 使用 env `CMS_DEFAULT_COVER_URL` 兜底，写 warning；不中断 |

## Workflow Checklist

执行时按顺序完成以下 9 步。**每步完成后更新 `cms_publications` 记录**，失败在对应步骤抛错。

```
CMS 发布进度：
- [ ] Step 0: 加载配置与映射
- [ ] Step 1: 识别稿件类型（type=1/2/4/5/11）
- [ ] Step 2: 解析栏目上下文（siteId/appId/catalogId/listStyleDto）
- [ ] Step 3: 字段映射（VibeTide article → CmsArticleSaveDTO）
- [ ] Step 4: 校验 required 字段
- [ ] Step 5: 幂等检查（是否已入库过）
- [ ] Step 6: 调用 POST /web/article/save
- [ ] Step 7: 解析响应，落 cms_publications 记录
- [ ] Step 8: 轮询 getMyArticleDetail 确认状态
- [ ] Step 9: 通知 mission / SSE 更新任务中心
```

### Step 0: 加载配置与映射

```typescript
const config = {
  host: process.env.CMS_HOST!,
  loginCmcId: process.env.CMS_LOGIN_CMC_ID!,
  loginCmcTid: process.env.CMS_LOGIN_CMC_TID!,
  tenantId: process.env.CMS_TENANT_ID!,
  username: process.env.CMS_USERNAME!,
  defaultCover: process.env.CMS_DEFAULT_COVER_URL ?? DEFAULT_COVER_FALLBACK,
};

const channel = await getAppChannelBySlug(input.appChannelSlug, input.organizationId);
if (!channel) throw new CmsConfigError(`app_channel_not_mapped: ${input.appChannelSlug}`);

const catalog = input.overrideCatalogId
  ? await getCmsCatalogById(input.overrideCatalogId)
  : await getCmsCatalogById(channel.defaultCatalogId);

if (!catalog) throw new CmsConfigError(`catalog_not_found: ${input.overrideCatalogId ?? channel.defaultCatalogId}`);
```

### Step 1: 识别稿件类型

判断规则（优先级从高到低）：

| 条件 | CMS type | 说明 |
|------|---------|------|
| `article.audioId` 存在 | `11` | 点播音频 |
| `article.videoId` 存在 | `5` | 视频新闻 |
| `article.externalUrl` 存在 && `article.body` 为空 | `4` | 外链新闻 |
| `article.galleryImages.length >= 3` && `article.mediaType === "gallery"` | `2` | 图集 |
| 其他 | `1` | 普通图文新闻（默认） |

```typescript
function determineType(article: Article): CmsType {
  if (article.audioId) return "11";
  if (article.videoId) return "5";
  if (article.externalUrl && !article.body?.trim()) return "4";
  if (article.mediaType === "gallery" && (article.galleryImages?.length ?? 0) >= 3) return "2";
  return "1";
}
```

### Step 2: 解析栏目上下文

从 `app_channels` + `cms_catalogs` 查到的栏目记录中提取：

```typescript
interface MapperContext {
  siteId: number;               // 来自 cms_apps.site_id
  appId: number;                // 来自 cms_apps.cms_app_id
  catalogId: number;            // 来自 cms_catalogs.cms_catalog_id
  tenantId: string;             // env
  loginId: string;              // env
  loginTid: string;             // env
  username: string;             // env
  source: string;               // organization.brandName
  listStyleDefault: CmsListStyleDto;  // 从 app_channels.list_style_config
  coverImageDefault: string;    // env 或 channel 配置
}
```

### Step 3: 字段映射（分发到对应 Mapper）

```typescript
const dto = await mapArticleToCms(article, ctx, type);
// 内部 switch(type):
//   case "1":  mapToType1(article, ctx)   // body → content + articleContentDto.htmlContent
//   case "2":  mapToType2(article, ctx)   // galleryImages → articleContentDto.imageDtoList + images[]
//   case "4":  mapToType4(article, ctx)   // externalUrl → redirectUrl
//   case "5":  mapToType5(article, ctx)   // videoId → articleContentDto.videoDtoList
//   case "11": mapToType11(article, ctx)  // audioId → articleContentDto.audioDtoList
```

**字段映射关键规则**（详见第 3 章 §3.4 主设计文档）：

| VibeTide | CMS | 处理 |
|---------|-----|------|
| `article.title` | `title` / `listTitle` | 超过 80 字截断 |
| `article.shortTitle` ?? 前 20 字 | `shortTitle` | - |
| `article.authorName` ?? "智媒编辑部" | `author` | - |
| env `CMS_USERNAME` | `username` | 固定 |
| `article.summary` | `summary` | ≤ 200 字 |
| `article.tags.join(",")` | `keyword` / `tags` | 取前 10 |
| `article.body` (HTML) | `content` + `articleContentDto.htmlContent` | type=1 时必传；自动包装 `<div id="editWrap">` |
| `article.coverImageUrl` ?? default | `logo` | 必填 |
| `article.publishStatus` 映射 | `status` | draft=0/pending=20/published=30/rejected=60 |
| `article.publishedAt?.getTime()` | `publishDate` | 毫秒时间戳 |
| `Date.now()` | `addTime` | - |
| `9` | `referType` | 固定（智媒 AI 自产） |
| env `CMS_TENANT_ID` | `tenantId` | - |
| `"cms2"` | `version` | 固定 |
| `"1"` | `commentFlag` / `tagsFlag` / `showReadingCountFlag` | 默认 |

### Step 4: 校验 required 字段

按 type 校验必填字段，不通过不发 HTTP：

| type | required | 校验失败处理 |
|------|---------|-------------|
| 1 | title, author, username, content | `throw CmsSchemaError("missing_required: content")` |
| 2 | title, author, username, images[].image, images[].note | - |
| 4 | title, author, username, redirectUrl | - |
| 5 | title, author, username, videoId | - |
| 11 | title, author, username, audioId | - |

### Step 5: 幂等检查

```typescript
// 查是否已入过
const existing = await db.query.cmsPublications.findFirst({
  where: eq(cmsPublications.articleId, article.id),
  orderBy: desc(cmsPublications.createdAt),
});

if (existing && existing.cmsState === "synced" && !input.allowUpdate) {
  return {
    success: true,
    publicationId: existing.id,
    cmsArticleId: existing.cmsArticleId,
    cmsState: "synced",
    publishedUrl: existing.publishedUrl,
    timings: { totalMs: 0, mappingMs: 0, httpMs: 0 },
  };
}

// 若已入过且允许更新 → DTO 带上 articleId 走 CMS 修改路径
if (existing && existing.cmsArticleId && input.allowUpdate) {
  dto.articleId = Number(existing.cmsArticleId);
}

// 生成 request hash 用于重试判重
const reqHash = hashRequest(dto);
```

### Step 6: 调用 POST /web/article/save

```typescript
const publication = await db.insert(cmsPublications).values({
  articleId: article.id,
  appChannelSlug: input.appChannelSlug,
  cmsState: "submitting",
  requestHash: reqHash,
  requestPayload: dto,
  attempts: (existing?.attempts ?? 0) + 1,
  operatorId: input.operatorId,
  triggerSource: input.triggerSource,
}).returning().then(r => r[0]);

try {
  const res = await cmsClient.post<CmsArticleSaveDTO, CmsArticleSaveResponseData>(
    "/web/article/save",
    dto,
    { timeoutMs: 20000 }
  );

  if (!res.success || res.state !== 200) {
    throw new CmsBusinessError(`CMS save failed: state=${res.state}, message=${res.message}`);
  }
  // 继续 Step 7
} catch (err) {
  await db.update(cmsPublications).set({
    cmsState: classifyError(err) === "retriable" ? "retrying" : "failed",
    errorCode: extractErrorCode(err),
    errorMessage: String(err),
    lastAttemptAt: new Date(),
  }).where(eq(cmsPublications.id, publication.id));

  if (classifyError(err) === "retriable") {
    await scheduleRetry(publication.id);  // Inngest event
  }
  throw err;
}
```

### Step 7: 解析响应，落库

```typescript
const cmsArticleId = String(res.data.article.id);
const publishedUrl = res.data.url
  ? `${CMS_WEB_BASE}${res.data.url}`
  : undefined;
const previewUrl = res.data.preViewPath;

await db.update(cmsPublications).set({
  cmsState: "submitted",
  cmsArticleId,
  responsePayload: res.data,
  publishedUrl,
  previewUrl,
  submittedAt: new Date(),
}).where(eq(cmsPublications.id, publication.id));
```

### Step 8: 轮询 getMyArticleDetail 确认状态（可选但推荐）

```typescript
// 异步触发 Inngest 函数 cms-status-poll（避免阻塞主线程）
await inngest.send({
  name: "cms/publication.submitted",
  data: { publicationId: publication.id, cmsArticleId },
});

// cms-status-poll 函数内部：
//   1. 等 5 秒（首次）
//   2. GET /web/article/getMyArticleDetail?articleId=<cmsArticleId>
//   3. 解析 article.status：
//      - "30" 发布 → 更新 cmsState=synced
//      - "60" 重新编辑 → 更新 cmsState=rejected_by_cms + 回推 VibeTide 审核台
//      - "20" 待发布 → 继续轮询（最多 5 次，间隔 10s/20s/40s/60s/120s）
//      - "0"  初稿 → 同上
```

### Step 9: 通知 Mission / SSE

```typescript
// 关联 Mission
await db.insert(workflowArtifacts).values({
  missionId: article.missionId,
  artifactType: "cms_publication",
  title: `CMS 入库：${article.title}`,
  content: { publicationId: publication.id, cmsArticleId, publishedUrl, previewUrl },
  producerEmployeeId: input.operatorId,
});

// 推 SSE 到任务中心前端
await notifyMissionChannel(article.missionId, {
  type: "cms_publication_completed",
  publicationId: publication.id,
  cmsArticleId,
  previewUrl,
});
```

## Decision Table（关键分支决策）

| 场景 | 条件 | 动作 |
|------|------|------|
| CMS 凭证过期 | `state=401` 或 message 含 "未登录" | 抛 `CmsAuthError`；发告警；暂停整个入库队列 |
| 栏目不存在 | `state` 返回栏目无效 | 抛 `CmsConfigError`；提示运营重新同步栏目 |
| 图片 URL 无效 | logo 不可访问 | 用 `CMS_DEFAULT_COVER_URL` 兜底，写 warning，不中断 |
| 文章已存在（`articleId` 传入） | CMS 返回 `method=MODIFY` | 正常走修改路径，`cms_publications.attempts++` |
| 网络超时 | `AbortError` 或 `ETIMEDOUT` | 进 `retrying`；退避 1s/2s/4s；3 次后 failed |
| CMS 返回 5xx | `state >= 500` | 同上，retriable |
| CMS 返回 4xx（业务错误） | `state 400-499` 且非 401 | 不重试；直接 failed；记录错误明细 |
| 轮询 5 次仍未 synced | 最后仍为 "20" | 标记 `cmsState=submitted`（终态），任务中心显示"待 CMS 人工发布" |

## HTTP 接口签名速查

```bash
# 入稿
curl -X POST "${CMS_HOST}/web/article/save" \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" \
  -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" \
  -d @dto.json

# 查询详情
curl -X GET "${CMS_HOST}/web/article/getMyArticleDetail?articleId=925194" \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" \
  -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}"
```

**响应结构速查**（成功）：

```json
{
  "state": 200,
  "success": true,
  "message": "操作成功",
  "data": {
    "article": { "id": 925194, "status": 0, "title": "..." },
    "url": "1376/1376mrgrgklm/925194.shtml",
    "preViewPath": "https://api.../cms/client/article/previewAll?articleID=925194&...",
    "method": "ADD"
  }
}
```

## 幂等性 & 重试策略

### 幂等原则

1. **同一 article 多次入库**：通过 `cms_publications.article_id` 查最后一条成功记录；已入 → 带 `articleId` 走 CMS MODIFY 路径
2. **重试判重**：`request_hash`（DTO 的稳定哈希）相同，跳过；不同则视为变更重发
3. **Worker 并发**：入 `cms_publications` 前获取 `article_id` 行锁 `SELECT FOR UPDATE SKIP LOCKED`

### 重试退避

| 次数 | 间隔 | 累积耗时 |
|------|------|---------|
| 第 1 次 | 立即 | 0s |
| 第 2 次 | 1s | 1s |
| 第 3 次 | 2s | 3s |
| 第 4 次 | 4s | 7s |
| 第 5+ 次 | 进 dead-letter 队列 + 告警 | - |

**仅对以下错误重试**：
- `CmsNetworkError`（timeout / DNS / 连接拒绝）
- `CmsBusinessError` 且 HTTP status ≥ 500
- `CmsBusinessError` 且 state 明确可重试（如 "系统繁忙"）

**不重试**：
- `CmsAuthError`（重试只会加速封号）
- `CmsSchemaError`（payload 不合法，重试无意义）
- `CmsBusinessError` 且 HTTP status 4xx（除 408/429 外）

## EXTEND.md 用户配置（可选）

支持按组织/项目级配置入库偏好：

```bash
# 优先级查找路径
.vibetide-skills/cms_publish/EXTEND.md          # 项目级
$HOME/.config/vibetide-skills/cms_publish/EXTEND.md  # XDG
$HOME/.vibetide-skills/cms_publish/EXTEND.md    # 用户级
```

### 支持的配置项

```yaml
# .vibetide-skills/cms_publish/EXTEND.md
default_author: "深圳广电编辑部"
default_source: "深圳广电"
default_cover_url: "https://your-cdn.com/default-cover.jpg"
default_comment_flag: 1               # 允许评论
default_tags_flag: 1                  # 展示标签
polling_enabled: true                 # 是否轮询确认入库状态
polling_max_attempts: 5
polling_intervals_sec: [5, 10, 20, 40, 60]

# 分栏目策略覆盖
channel_overrides:
  app_politics:
    default_author: "深圳时政编辑部"
    polling_max_attempts: 8            # 时政稿需更久确认
  app_sports:
    default_author: "川超报道团"
```

### 值优先级

1. 函数参数（`input.*`）
2. 稿件 frontmatter（`article.metadata.*`）
3. EXTEND.md channel_overrides（按 `appChannelSlug` 匹配）
4. EXTEND.md 全局
5. Skill 默认值（代码内常量）

## Completion Report

```
CMS 入库完成！

📤 稿件信息
   • 标题：{article.title}
   • 类型：{typeLabel(type)} (type={type})
   • 字数：{article.wordCount ?? "-"}
   • 作者：{mappedAuthor}
   • 封面：{coverSource}  [使用/兜底]

📍 目标栏目
   • APP 栏目：{input.appChannelSlug}
   • CMS 栏目：{catalog.name} (id={catalog.cmsCatalogId})
   • 所属应用：{app.name} (siteId={app.siteId})

📊 入库结果
   ✓ CMS 文稿 ID：{cmsArticleId}
   ✓ 状态：{cmsState}
   ✓ 用时：{timings.totalMs}ms (映射 {timings.mappingMs}ms / HTTP {timings.httpMs}ms / 轮询 {timings.pollingMs ?? 0}ms)
   ✓ 尝试次数：{publication.attempts}

🔗 访问链接
   • 预览：{previewUrl}
   • 正式地址：{publishedUrl}

📝 后续步骤
   → 稿件已进入 CMS 待发布状态（status=20），可在 CMS 后台发布
   → 或等待 CMS 审核流程自动推送
   → 任务中心已更新：Mission {missionId} → Artifact {artifactId}
```

**失败场景 Report**：

```
CMS 入库失败

❌ 错误阶段：{error.stage}  ({mapping|auth|network|cms_business|polling})
❌ 错误代码：{error.code}
❌ 错误信息：{error.message}
❌ 可重试：{error.retriable ? "是，已进入重试队列" : "否，需人工处理"}

📋 尝试次数：{attempts}/{maxRetries}

🛠  建议处理
   {根据 error.code 提供对应建议，见 Troubleshooting 表}

📞 技术联系
   → 查看 audit log：/settings/audit-logs?skill=cms_publish&publicationId={id}
   → 重新触发：/api/actions/retry-cms-publication?id={id}
```

## Feature Comparison（5 种 type 能力矩阵）

| 特性 | type=1 图文 | type=2 图集 | type=4 外链 | type=5 视频 | type=11 音频 |
|------|-----------|-----------|-----------|-----------|------------|
| 必填 `content` | ✓ | ✗ | ✗ | ✗ | ✗ |
| 必填 `images[]` | ✗ | ✓ (≥3) | ✗ | ✗ | ✗ |
| 必填 `redirectUrl` | ✗ | ✗ | ✓ | ✗ | ✗ |
| 必填 `videoId` (VMS) | ✗ | ✗ | ✗ | ✓ | ✗ |
| 必填 `audioId` (VMS) | ✗ | ✗ | ✗ | ✗ | ✓ |
| 必填 `logo` 封面 | ✓ | ✓ | 可选 | ✓ | ✓ |
| 列表样式 listStyleType | 0/1/4 | 2 | 3 | 0 | 0 |
| 评论支持 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 适用 APP 栏目 | 全部 | 新闻/民生 | 首页/新闻 | 新闻/体育/综艺 | 民生播客 |
| 本期 VibeTide 主要落地 | ✓✓✓ 主流 | ✓ 图集专题 | ✓ 转载 | AIGC 侧 | ✓ 播客 |

## Troubleshooting

| Issue | 原因排查 | Fix |
|-------|---------|-----|
| `CmsAuthError: 未登录` | `login_cmc_id` / `login_cmc_tid` 过期 | 1) 手动刷新 env；2) 后续 Phase 2 接入 MMS/CMC 自动鉴权；3) 暂停整个队列避免封号 |
| `CmsBusinessError: 栏目不存在` | `catalogId` 无效或已被删除 | 跑 `cms_catalog_sync` 更新映射表；检查 `app_channels.defaultCatalogId` |
| `CmsBusinessError: 站点不存在` | `siteId` 错误 | 检查 `cms_apps.site_id` 是否正确同步 |
| `CmsSchemaError: missing_required: content` | type=1 但 article.body 为空 | 稿件内容未生成；检查上游 `content_generate` skill 是否失败 |
| `Network timeout` | CMS 响应慢 或网络问题 | 1) 增加 timeout（改 env `CMS_TIMEOUT_MS`）；2) 检查 CMS 健康度 |
| 入稿成功但轮询 status 一直 20 | CMS 侧需人工发布 | 1) 正常现象；2) 任务中心显示"待 CMS 人工发布"；3) 如需自动发布，改 `targetCmsStatus=published` |
| 封面图 CMS 侧显示破图 | URL 不可访问或被 CMS CDN 拒 | 1) 确保图片已上传到 CMS 媒资（推荐用 ftp://xxx 或 CMS 内图库 URL）；2) 用本地兜底图 |
| 图集稿（type=2）首图异常 | `appCustomParams.customStyle.imgPath` 未正确填 | 检查 mapper：imgPath 应为前 3 张图片 URL |
| 视频稿（type=5）VMS 未入库 | `videoId` 不存在于 CMS VMS | 本期 VibeTide 不直接发 type=5；由华栖云 AIGC 负责 |
| `prop4` 时长返回异常 | VMS 侧未转码完成 | 这是 CMS 显示问题，不影响入库成功 |
| 并发入库同一 article 被处理两次 | 行锁未生效 | 确保 `SELECT FOR UPDATE SKIP LOCKED` 已开启 |

## Prerequisites

### 基础设施
- ✅ PostgreSQL 数据库（存 `cms_publications` / `cms_channels` / `cms_apps` / `cms_catalogs` / `app_channels`）
- ✅ Inngest 运行（触发异步轮询和重试）
- ✅ 可访问华栖云 CMS 内网/公网

### 凭证
- ✅ `login_cmc_id` + `login_cmc_tid`（测试值已提供）
- ✅ `tenantId`（租户 ID，已提供示例值）
- ✅ `username`（账号名，默认 `superAdmin`）

### 数据准备
- ✅ `cms_catalog_sync` 至少跑过一次（栏目映射表非空）
- ✅ `app_channels` 表已配置 9 个 APP 栏目的映射（见 §9.2 规范化清单）
- ✅ 稿件已通过审核（`publishStatus ≥ approved`）

### 稿件内容准备
- type=1：HTML body，含段落标签 `<p>`
- type=2：galleryImages 数组，至少 3 张，每张有 URL + note
- type=5：videoId（来自华栖云 VMS）
- type=11：audioId + audioUrl

## Quality Self-Eval Checklist（执行后自检）

执行完毕，skill 必须对自己的执行结果进行自检，结果写入 `cms_publications.self_eval`：

| 检查点 | 通过条件 | 未通过动作 |
|-------|---------|----------|
| 响应结构符合 CmsArticleSaveResponse | zod 校验通过 | 写 warning，不中断 |
| cmsArticleId 是正整数 | `/^\d+$/` | 抛 `CmsSchemaError` |
| previewUrl 可访问（HEAD 200） | 3s 内返回 | 写 warning |
| timings.httpMs ≤ 10000 | 正常延迟 | 写 info，性能监控追踪 |
| 字段映射无缺失（log warning 数为 0） | - | 记录但不阻断 |
| 轮询终态符合预期 | synced 或主动停 | 停在 submitted 是可接受的 |

## 上下游协作

### 上游 Skills（输入来源）
- `quality_review`：产生已审稿件（publishStatus=approved）
- `compliance_check`：确保合规后才触发发布
- `cms_catalog_sync`：准备栏目映射数据

### 下游 Skills / 事件
- `aigc_script_push`：如稿件配套视频脚本，并行推送（不依赖 cms_publish 完成）
- 任务中心 SSE：`cms_publication_completed` / `cms_publication_failed`
- Mission 状态机：cms_publish 成功则 mission 进 complete
- 数据分析：`data_report` 下游读 `cms_publications` 统计发布情况

### 与其他员工协作
- **发起者**：小发（xiaofa 渠道运营师）/ leader
- **审核者**：小神（xiaoshen 质量审核官）上游确认
- **观察者**：所有员工可在任务中心看到状态

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 1.0.0 | 2026-04-18 | 初版：支持 type=1/2/4/5/11，含幂等/重试/轮询/EXTEND.md |

## 开放问题

- Q1：CMS 凭证刷新机制（本期固定值；后续接入 MMS/CMC）
- Q2：批量入库性能（本期单条一次；未来可加 bulk API）
- Q3：CMS 侧栏目被删/重命名后的影响处理
- Q4：跨 organization 共享稿件的入库策略

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/cms-publish.ts` |
| DAL | `src/lib/dal/cms-publications.ts` |
| Mapper | `src/lib/cms/article-mapper/*.ts` |
| Inngest Poll | `src/inngest/functions/cms-status-poll.ts` |
| Inngest Retry | `src/inngest/functions/cms-publish-retry.ts` |
| Server Action | `src/app/actions/cms.ts#publishArticleToCms` |
| API Route | `src/app/api/cms-publish/route.ts` |
