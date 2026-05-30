# CMS 文稿入库发布步骤使用说明

本文说明在工作流场景中新增“CMS 文稿入库发布”步骤时，应该如何配置参数，以及常见报错的排查方式。

后续同类系统说明统一放在 `docs/system-guides/` 目录下。

## 适用技能

- 步骤显示名：`CMS 文稿入库发布`
- 技能 slug：`cms_publish`
- 作用：把一篇本地稿件发布到华栖云 CMS。

`cms_publish` 是真实写入/发布工具，不是普通文本生成步骤。它必须拿到明确的稿件来源，否则会报错。

## 推荐接入方式

推荐使用三段式链路：

1. `content_generate` 生成稿件。
2. `archive_to_drafts` 把稿件写入本地 `articles` 表。
3. `cms_publish` 使用上一步返回的 `articleId` 发布到 CMS。

### 示例步骤

假设第 4 步是写稿：

```json
{
  "skillSlug": "content_generate"
}
```

第 6 步先入库：

```json
{
  "skillSlug": "archive_to_drafts",
  "parameters": {
    "articles": "{{step4.articles}}",
    "initialStatus": "approved"
  }
}
```

第 7 步再发布到 CMS：

```json
{
  "skillSlug": "cms_publish",
  "parameters": {
    "articleId": "{{step6.firstArticleId}}",
    "catalogId": 10462
  }
}
```

其中：

- `step4` 是 `content_generate` 的实际步骤号。
- `step6` 是 `archive_to_drafts` 的实际步骤号。
- `catalogId` 是 CMS 目标栏目 ID，必须按实际栏目替换。

## 参数说明

### 必填来源参数

`cms_publish` 必须满足以下任一条件：

方式 A，推荐：传已入库文章 ID。

```json
{
  "articleId": "{{step6.firstArticleId}}"
}
```

方式 B，兼容旧链路：直接传标题和正文。

```json
{
  "title": "{{step4.articles.0.title}}",
  "body": "{{step4.articles.0.body}}"
}
```

推荐使用方式 A，因为它会先把稿件落到本地稿件库，后续排查、复用、补发都更清楚。

### CMS 目标参数

```json
{
  "catalogId": 10462,
  "appId": 1768,
  "siteId": 81
}
```

- `catalogId`：目标栏目 ID。常用必配。
- `appId`：CMS APP ID，不填时走环境变量默认值。
- `siteId`：CMS 站点 ID，不填时走环境变量默认值。

通常只需要配置 `catalogId`。

### 不需要手动配置的参数

以下参数由工作流执行器自动注入：

- `organizationId`
- `operatorId`

不要在工作流参数里手动写这两个字段。

## 常见错误配置

### 只配置 catalogId

错误：

```json
{
  "catalogId": 10462
}
```

原因：缺少稿件来源。`cms_publish` 不会自动读取上一步正文。

修正：

```json
{
  "articleId": "{{step6.firstArticleId}}",
  "catalogId": 10462
}
```

### 把文章数组传给 articleId

错误：

```json
{
  "articleId": "{{step4.articles}}",
  "catalogId": 10462
}
```

原因：`articleId` 必须是单个 UUID 字符串，不能是文章数组。

修正：先用 `archive_to_drafts` 入库，再传 `firstArticleId`。

```json
{
  "articleId": "{{step6.firstArticleId}}",
  "catalogId": 10462
}
```

### 指错步骤号

错误：

```json
{
  "articleId": "{{step4.firstArticleId}}",
  "catalogId": 10462
}
```

原因：`content_generate` 通常产出 `articles`，不会产出 `firstArticleId`。`firstArticleId` 来自 `archive_to_drafts`。

修正：确认 `archive_to_drafts` 是第几步，然后引用对应步骤。

## 新增工作流时的标准模板

单篇稿件发布建议使用：

```json
{
  "steps": [
    {
      "order": 4,
      "title": "稿件撰写",
      "skillSlug": "content_generate"
    },
    {
      "order": 5,
      "title": "稿件入库（不发布）",
      "skillSlug": "archive_to_drafts",
      "parameters": {
        "articles": "{{step4.articles}}",
        "initialStatus": "approved"
      }
    },
    {
      "order": 6,
      "title": "CMS 文稿入库发布",
      "skillSlug": "cms_publish",
      "parameters": {
        "articleId": "{{step5.firstArticleId}}",
        "catalogId": 10462
      }
    }
  ]
}
```

如果一个工作流会生成多篇稿件，应优先使用批量发布技能 `cms_batch_publish`，不要对 `cms_publish` 传文章数组。

## 环境前置条件

正式发布到 CMS 前，需要确认环境变量已配置：

```bash
CMS_HOST=...
CMS_LOGIN_CMC_ID=...
CMS_LOGIN_CMC_TID=...
CMS_TENANT_ID=...
VIBETIDE_CMS_PUBLISH_ENABLED=true
```

可选默认值：

```bash
CMS_DEFAULT_CATALOG_ID=10210
CMS_DEFAULT_APP_ID=1768
CMS_DEFAULT_SITE_ID=81
```

如果不传 `catalogId`，工具会使用 `CMS_DEFAULT_CATALOG_ID`。

## 排查清单

新增步骤后如果报错，按下面顺序检查：

1. `cms_publish` 是否配置了 `articleId`，或同时配置了 `title` 和 `body`。
2. `articleId` 是否引用 `archive_to_drafts` 的 `firstArticleId`。
3. `archive_to_drafts` 是否引用了 `content_generate` 的 `articles`。
4. `catalogId` 是否为数字，不要写成字符串。
5. CMS 环境变量是否完整，且 `VIBETIDE_CMS_PUBLISH_ENABLED=true`。
6. 上游 `content_generate` 是否真的产出了非空 `articles`。

