# CMS 文稿入库发布 —— 栏目参数化设计

- **Date**: 2026-05-29
- **Owner**: zhuyu
- **Status**: Draft
- **Skill**: `cms_publish`
- **Related**: `skills/cms_publish/SKILL.md` · `src/lib/cms/publish/publish-article.ts` · `src/lib/cms/article-mapper/index.ts`

## 1. 背景与问题

当前 `cms_publish` 工具把推送目标的 `siteId / appId / catalogId` **硬编码**为 `81 / 1768 / 10210`（"演示环境指定"），所有调用都推到同一栏目。

硬编码常量散落在 3 个文件 4 处：

| 位置 | 内容 |
|---|---|
| `src/lib/cms/article-mapper/index.ts:71-73` | `HARDCODED_SITE_ID / APP_ID / CATALOG_ID` 三个常量 + `loadMapperContext()` 不接 target 参数 |
| `src/lib/agent/tool-registry.ts:1321,1388-1390,1466-1468,1488-1490` | `cms_publish` 工具描述、dryRun 回显、成功/失败 meta 字段都内嵌 `1768/10210/81` |
| `src/app/(dashboard)/settings/cms-mapping/cms-mapping-client.tsx:43` | UI 上的提示横幅 `HARDCODED_TARGET` |

**业务需求**：运营要把不同 workflow_template 推到不同 CMS 栏目。例如：

| 场景 | 频率 | 目标栏目 |
|---|---|---|
| 热点新闻 | 每 5 分钟 | 10127（置顶热点新闻） |
| AI 早晚报 | 7am | 10462（AI 日报） |
| AI 政策解读 | 按需 | 10138（政策问答-展会演示） |
| 时政要闻 | 按需 | 10230（新闻问答-展会演示） |
| 本地新闻 | 按需 | 10463（本地新闻） |

定时触发的场景占多数，所以"目标栏目"**天然属于 workflow_template 配置维度**，不属于运行时输入。

## 2. 目标 & 非目标

### Goals

- G1: 运营在 `/workflows/[id]/edit` 步骤面板的"参数配置 → 添加参数"里能选填 `catalogId`，配置一次后定时与手动触发都按此栏目入库。
- G2: 把散落的 `81 / 1768 / 10210` 三个常量统一收敛到 `.env.local`，消除 schema-drift 风险。
- G3: 旧 workflow_template 不传参数时继续走原硬编码值，零破坏。

### Non-Goals

- ❌ 不做"CMS 栏目搜索弹窗 / 树形选择器"UI —— 运营手填栏目数字 ID。
- ❌ 不打通 VibeTide `categories` ↔ CMS `cms_catalogs` 表（这俩是两个独立维度）。
- ❌ 不做运行时 mission-level 栏目 override —— 模板级配置即可，每次启动改栏目的需求不存在。
- ❌ 不修 `/settings/cms-mapping` "立即同步"实测同步未生效的 bug —— 那是独立问题，单独诊断。
- ❌ 不为 `cms_publications` 增加 `cmsAppId` 列做审计（同组织通常只有一个 app，价值低；需要时单独迁）。
- ❌ 不在 `/articles` 侧栏新增"同步 CMS 栏目"入口（与 mclaw 内部 categories 概念混淆）。

## 3. 设计

### 3.1 env 配置

**新增 3 个 env**（`.env.example` + `.env.local`）：

```
CMS_DEFAULT_SITE_ID=81
CMS_DEFAULT_APP_ID=1768
CMS_DEFAULT_CATALOG_ID=10210
```

**`requireCmsConfig()` 扩展**（`src/lib/cms/feature-flags.ts`）：

```ts
export interface CmsConfig {
  // ... 现有字段 ...
  defaultSiteId: number;
  defaultAppId: number;
  defaultCatalogId: number;
}

export function requireCmsConfig(): CmsConfig {
  // ... 现有 missing env 校验 ...
  return {
    // ... 现有字段 ...
    defaultSiteId: parseInt(process.env.CMS_DEFAULT_SITE_ID ?? "81", 10),
    defaultAppId: parseInt(process.env.CMS_DEFAULT_APP_ID ?? "1768", 10),
    defaultCatalogId: parseInt(process.env.CMS_DEFAULT_CATALOG_ID ?? "10210", 10),
  };
}
```

**注意**：这 3 个 env 不进 `REQUIRED_ENVS`（缺失时走代码内 fallback `81/1768/10210`），保证未更新 `.env.local` 的环境也能跑。

### 3.2 cms_publish 工具 inputSchema 扩展

`src/lib/agent/tool-registry.ts` 的 `cms_publish.inputSchema` 新增 3 个**选填**字段：

```ts
catalogId: z.number().int().optional()
  .describe("目标 CMS 栏目 ID（不填走 env CMS_DEFAULT_CATALOG_ID）"),
appId: z.number().int().optional()
  .describe("CMS APP 应用 ID（不填走 env CMS_DEFAULT_APP_ID=1768）"),
siteId: z.number().int().optional()
  .describe("CMS 站点 ID（不填走 env CMS_DEFAULT_SITE_ID=81）"),
```

**为什么 optional 而非 required**：
- 旧 workflow_template 没配栏目 → 自动吃 env 兜底，零破坏。
- 运营在"添加参数"下拉里按需勾选 —— 不勾就走默认。

**工具 description 改写**：把现在硬编码 `"appId / catalogId 已硬编码为 1768 / 10210"` 改为 `"目标栏目支持运行时参数化：传入 catalogId 即推到指定栏目；不传走 env 默认值。"`

### 3.3 执行链路

```
workflow_template.steps[i].config.parameters.{catalogId,appId,siteId}
    ↓ workflow 执行器透传到工具 execute()
cms_publish.execute({ catalogId, appId, siteId, title, body, ... })
    ↓ 工具内部聚合成 target
publishArticleToCms({
  articleId, operatorId, triggerSource, allowUpdate,
  target?: { catalogId?: number; appId?: number; siteId?: number }   ← 新增
})
    ↓
loadMapperContext(org, target?)                                       ← 签名变
    ↓ target 缺字段就 fallback 到 config.defaultXxx
ctx = {
  siteId: target?.siteId ?? config.defaultSiteId,
  appId: target?.appId ?? config.defaultAppId,
  catalogId: target?.catalogId ?? config.defaultCatalogId,
  ...
}
```

#### `publishArticleToCms` 入参扩展

```ts
export interface PublishInput {
  articleId: string;
  operatorId: string;
  triggerSource: "manual" | "workflow" | "scheduled" | "daily_plan";
  allowUpdate?: boolean;
  /** 自定义推送目标，未传或字段缺失走 env 默认值 */
  target?: {
    catalogId?: number;
    appId?: number;
    siteId?: number;
  };
}
```

`publishArticleToCms` 把 `input.target` 直接透传给 `loadMapperContext`。

#### `loadMapperContext` 签名扩展

```ts
export function loadMapperContext(
  org: { brandName: string },
  target?: { catalogId?: number; appId?: number; siteId?: number },
): MapperContext {
  const config = requireCmsConfig();
  return {
    siteId: target?.siteId ?? config.defaultSiteId,
    appId: target?.appId ?? config.defaultAppId,
    catalogId: target?.catalogId ?? config.defaultCatalogId,
    // ... 其余字段不变 ...
  };
}
```

**删除常量**：`HARDCODED_SITE_ID / HARDCODED_APP_ID / HARDCODED_CATALOG_ID` 三个常量从 `article-mapper/index.ts` 移除。

#### `cms_publish` 工具 execute 改造

把 `catalogId / appId / siteId` 三个新参数聚合成 `target`，传给 `publishArticleToCms`：

```ts
execute: async ({ title, body, ..., catalogId, appId, siteId, ... }) => {
  const target = (catalogId != null || appId != null || siteId != null)
    ? { catalogId, appId, siteId }
    : undefined;

  // dryRun 改造（见 §3.4）
  if (dryRun) { ... }

  // ... insert articles ...

  const pubResult = await publishArticleToCms({
    articleId: created.id,
    operatorId, triggerSource, allowUpdate,
    target,                                  // ← 新增
  });

  // meta 也回显真实使用的 target
  return {
    ...pubResult,
    meta: {
      title,
      catalogId: target?.catalogId ?? config.defaultCatalogId,
      appId: target?.appId ?? config.defaultAppId,
      siteId: target?.siteId ?? config.defaultSiteId,
      ...
    },
  };
}
```

### 3.4 dryRun 回显真实参数

`cms_publish.execute` 的 dryRun 短路块当前硬编码 `wouldPublish.{appId: 1768, catalogId: 10210, siteId: 81}`，改成读取实际 target / config：

```ts
if (dryRun) {
  const config = requireCmsConfig();
  return {
    success: true,
    dryRun: true,
    wouldInsert: { ... },
    wouldPublish: {
      catalogId: catalogId ?? config.defaultCatalogId,
      appId: appId ?? config.defaultAppId,
      siteId: siteId ?? config.defaultSiteId,
      authorName: authorName ?? "AI 编辑部",
    },
    note: "dry-run: ...",
  };
}
```

**目的**：skill 详情页"测试入口"传 `catalogId=10462` 时，dryRun 输出 `wouldPublish.catalogId = 10462`，让运营测试时能直接看到自己填的栏目是否生效，不再被旧的 `10210` 硬编码误导。

### 3.5 cms-mapping-client.tsx UI 文案更新

当前提示横幅：
> 当前阶段：CMS 推送目标在 article-mapper 中硬编码 — siteId=81 · appId=1768 · catalogId=10210。所有稿件统一推送到此目标。

改为：
> 当前默认推送目标：siteId={config.defaultSiteId} · appId={config.defaultAppId} · catalogId={config.defaultCatalogId}（来自 env `CMS_DEFAULT_*`）。workflow_template 可在 `cms_publish` 步骤参数中覆盖 `catalogId / appId / siteId` 推到指定栏目。

`HARDCODED_TARGET` 常量删除，数据从 server page 读 `requireCmsConfig()` 后作为 prop 传入。

### 3.6 调用方影响清单

`publishArticleToCms` 现有调用方梳理（grep `publishArticleToCms` 命中 4 处生产代码）：

| 调用方 | 文件 | 当前是否传 target | 改造动作 |
|---|---|---|---|
| `cms_publish` 工具 | `src/lib/agent/tool-registry.ts:1448` | 否 | ✅ 透传 target（§3.3） |
| `cmsPublishRetry` Inngest | `src/inngest/functions/cms-publish-retry.ts:73` | 否 | ✅ 从 `cms_publications.requestPayload` 读已存 target（或新增 `target_override` 列，详见 §3.7） |
| `leader-consolidate` Inngest | `src/inngest/functions/leader-consolidate.ts:221` | 否 | ❌ 不改（默认走 env，保持当前行为；待后续 leader 编排有栏目策略再扩） |
| `publishArticleToCmsAction` server action | `src/app/actions/cms.ts:105` | 否 | ❌ 不改（手动入口走默认即可；如果手动触发也要选栏目，未来单独 spec） |
| `hot-topics.ts` 内调用 | `src/app/actions/hot-topics.ts:1400` | 否 | ❌ 不改（同上） |

### 3.7 失败重试链路 —— target 持久化

`cmsPublishRetry`（`src/inngest/functions/cms-publish-retry.ts`）在 publish 失败时重新调 `publishArticleToCms`。**问题**：第一次执行的 target 必须能在重试时还原，否则失败重试会跑到默认栏目，产生数据漂移。

**方案**：第一次执行时把 target 持久化到 `cms_publications.request_payload`（jsonb，已存在）的根字段，retry 时读取还原。

实施细节：
- `publishArticleToCms` 在 `createPublication({ requestPayload: dto, ... })` 时把 `target` 一并存到 jsonb：`{ ...dto, _target: target }`（用下划线前缀避免污染 CMS DTO 真实字段名空间）。
- `cmsPublishRetry` 读 `publication.requestPayload._target` 还原后传给 `publishArticleToCms`。
- 兼容老数据：`_target` 缺失就走默认（即旧的硬编码 10210，对应旧记录的真实推送目标，行为一致）。

## 4. 数据 / Schema 影响

- ❌ **不改 schema**。`cms_publications` 表保持现状，不加 `cms_app_id` 列。
- ❌ **不改 workflow_templates 表**。栏目参数走通用的 `steps[i].config.parameters` jsonb 槽位，无需单列。
- ✅ **3 个新 env**：`CMS_DEFAULT_SITE_ID / CMS_DEFAULT_APP_ID / CMS_DEFAULT_CATALOG_ID`，可选。

## 5. 错误处理

| 场景 | 处理 |
|---|---|
| 运营填了一个不存在的 catalogId（如 99999） | CMS 接口返回 4xx "栏目不存在"，被现有 `classifyCmsError` → `cms_business` 标记为不可重试 `failed`。错误信息原样回显到任务中心。 |
| 运营填了非数字字符串 | zod `z.number().int()` 在 inputSchema 层拒绝，UI 报参数校验失败。 |
| `.env.local` 未更新缺 `CMS_DEFAULT_*` | `parseInt(undefined ?? "81")` → fallback 到代码内 `81/1768/10210`，行为等同改造前。 |
| 调用方不传 target | 走 env 默认，行为等同改造前。 |
| 重试时 `cms_publications.requestPayload._target` 缺失（老数据） | 走 env 默认，对应旧行为，无数据漂移。 |

## 6. 测试计划

### 单元测试

- `requireCmsConfig` 读取 `CMS_DEFAULT_*` env；缺失走 fallback。
- `loadMapperContext`：
  - 不传 target → 字段全部来自 config。
  - 传 `{ catalogId: 10462 }` → 仅 catalogId override，appId/siteId 走 config。
  - 传完整 `{ catalogId, appId, siteId }` → 三字段全部 override。
- `publishArticleToCms`：
  - 不传 target → mapper ctx 全部 default。
  - 传 `target` → mapper ctx 受影响、`cms_publications.cmsCatalogId / cmsSiteId` 写入正确。
  - 创建 publication 时 `requestPayload._target` 正确持久化。
- `cmsPublishRetry`：从 `_target` 还原后传给 `publishArticleToCms`。
- `cms_publish` 工具 dryRun：传 `catalogId=10462` → `wouldPublish.catalogId === 10462`。
- `cms_publish` 工具 execute：transform `{catalogId,appId,siteId}` → `target` 正确（包括全 undefined → target=undefined）。

### 集成测试

- `/workflows/[id]/edit` 给 cms_publish 步骤添加 `catalogId=10462` 参数后保存 → `workflow_templates.steps[i].config.parameters.catalogId === 10462`。
- 手动触发该 workflow_template → cms_publications 一条新记录的 `cmsCatalogId === '10462'`。

### 手动验收（在 demo 环境）

- 新建一个测试 workflow_template，步骤 6 配 `catalogId=10462`。
- 跑测试运行，在华栖云 CMS 后台确认稿件落到 "AI 日报" 栏目（10462）下，不再落到 "10210"。
- 重试场景：人为构造一次重试，确认重试也推到 10462 而不是默认值。

## 7. 5 个新场景配置一览

运营在 `/workflows/[id]/edit` 步骤 6 "参数配置 → 添加参数" 给每个场景填一行：

| 场景 | workflow_template 名 | 步骤 6 参数 |
|---|---|---|
| 热点新闻（每 5 min） | "热点新闻" | `catalogId = 10127` |
| AI 早晚报（7am） | "AI 早晚报" | `catalogId = 10462` |
| AI 政策解读 | "AI 政策解读" | `catalogId = 10138` |
| 时政要闻 | "时政要闻" | `catalogId = 10230` |
| 本地新闻 | "本地新闻" | `catalogId = 10463` |

`appId / siteId` 全部留空，吃 env 默认 `1768 / 81`。

## 8. 上线步骤

1. 部署改动到测试环境。
2. 部署后跑一遍现有 workflow_template 的测试运行（不传 catalogId 的旧场景）→ 确认仍推到 10210，旧行为不变。
3. 给 demo 环境的 `.env.local` 加 `CMS_DEFAULT_*`（值与代码内 fallback 一致）。
4. 在 `/workflows/[id]/edit` 配 5 个新 workflow_template 的 `catalogId` 参数。
5. 手动触发每个 workflow_template，确认 CMS 端落到正确栏目。
6. 把 5 个 workflow_template 的定时器在 `scheduled_jobs` 表里启用。

## 9. 后续 follow-up（不在本次范围）

- `/settings/cms-mapping` "立即同步" 实测失败的 bug 诊断与修复（独立 spec）。
- 如果运营反馈"填数字 ID 易错"，再做 CMS 栏目搜索弹窗 UI（依赖 sync 修好或者实时调 `getCatalogTree`）。
- 如果出现跨 app 的栏目需求，给 cms_publications 加 `cms_app_id` 列做审计。
- 如果手动触发也需要选栏目（`publishArticleToCmsAction` / 稿件详情页"发布到 APP"按钮），再做运行时 override（mission-level 参数）。

## 10. 风险

| 风险 | 缓解 |
|---|---|
| 运营填了错误的 catalogId 导致稿件推到错的栏目 | CMS 后端校验栏目存在 + 任务中心展示失败原因；运营自测可见。 |
| dryRun 与真实执行行为不一致 | dryRun 严格按 target / config 回显，与真实路径同源 fallback 逻辑。 |
| 重试时 target 丢失推到默认栏目 | §3.7 持久化到 `cms_publications.requestPayload._target`。 |
| `.env.local` 上线时漏改 → 表面看着没事其实走代码 fallback | 代码 fallback 值等于现有硬编码值，行为一致；上线日志会打 config 完整值便于核对。 |
