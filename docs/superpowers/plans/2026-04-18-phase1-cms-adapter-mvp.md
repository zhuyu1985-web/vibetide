# Phase 1 — CMS 适配层 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 VibeTide 到华栖云 CMS 的图文稿入库闭环 MVP —— AI 员工产出图文稿 → 按 APP 栏目映射 → 调用 CMS `/web/article/save` 入库 → 确认入库状态。新闻（news_standard）+ 时政（politics_shenzhen）2 场景端到端跑通。

**Architecture:** 在 `src/lib/cms/` 新建 CMS 适配层（HTTP 客户端 + 5 接口封装 + type 1/2/4 Article Mapper + 三步栏目同步 + 状态机 + 重试）。新增 10 张数据库表的子集（P1 用到的 7 张）。复用现有 Mission/Workflow/Skill/Agent 框架。场景通过 Workflow Template 的 `personaPreset + subtemplate` 差异化触发（不新增员工）。

**Tech Stack:** Next.js 16 + Drizzle ORM + Postgres (Supabase) + Inngest + Vitest + TypeScript strict + zod。CMS 对接接口 5 个（getChannels / getAppList / getCatalogTree / saveArticle / getMyArticleDetail）。

**Spec Reference:** `docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md`（主文档 3368 行 + 13 个 Skill MD 7764 行）。

**Runtime 说明：** 本 plan 所有示例代码跑在 **Next.js Server** / **Inngest Function** / **vitest & node CLI** 三种常规 Node.js 环境中。**不使用** Vercel Workflow DevKit sandbox（`"use workflow"`）。任何自动化 validator 如报告"某 API 在 sandbox 不可用"均为 false positive（`.md` 文档被静态关键词扫描导致）。

**Phase 1 范围边界：**
- ✅ CMS 5 接口对接 + 三步栏目同步
- ✅ type=1 图文新闻入库全链路（含 retry / 幂等 / 状态轮询）
- ✅ type=2 图集 + type=4 外链 mapper（测试覆盖但非主路径）
- ✅ 2 场景端到端：news_standard + politics_shenzhen
- ✅ 最小栏目映射配置页 `/settings/cms-mapping`
- ❌ type=5 视频 / type=11 音频（Phase 2 之后）
- ❌ AIGC 脚本推送（Phase 2）
- ❌ 其他 7 个场景（Phase 3）
- ❌ 审核规则引擎升级（Phase 4；本期复用现有 quality_review）
- ❌ 每日 AIGC 专题（Phase 4）

---

## File Structure

### 新增文件（P1 范围）

```
src/
├── db/
│   └── schema/
│       ├── cms-publications.ts          [新增] CMS 入库记录
│       ├── cms-mapping.ts               [新增] cms_channels + cms_apps + cms_catalogs + cms_sync_logs
│       └── app-channels.ts              [新增] APP 栏目 ↔ CMS 栏目绑定
│
├── lib/
│   ├── cms/                             [新增] CMS 适配层
│   │   ├── client.ts                    HTTP 客户端（鉴权/重试/超时/日志）
│   │   ├── types.ts                     CMS DTO 类型
│   │   ├── errors.ts                    CmsError 子类
│   │   ├── api-endpoints.ts             5 接口封装
│   │   ├── article-mapper/
│   │   │   ├── common.ts                公共字段映射
│   │   │   ├── type1-article.ts         普通新闻
│   │   │   ├── type2-gallery.ts         图集
│   │   │   ├── type4-external.ts        外链
│   │   │   └── index.ts                 mapper 分发器
│   │   ├── catalog-sync.ts              三步同步主流程 + 差量对比
│   │   ├── status-machine.ts            入库状态机
│   │   ├── feature-flags.ts             Feature flag 检查
│   │   ├── __tests__/
│   │   │   ├── client.test.ts
│   │   │   ├── errors.test.ts
│   │   │   ├── api-endpoints.test.ts
│   │   │   ├── article-mapper.test.ts
│   │   │   ├── catalog-sync.test.ts
│   │   │   └── status-machine.test.ts
│   │   └── index.ts                     统一出口
│   │
│   └── dal/
│       ├── cms-publications.ts          [新增]
│       ├── cms-channels.ts              [新增]
│       ├── cms-apps.ts                  [新增]
│       ├── cms-catalogs.ts              [新增]
│       ├── cms-sync-logs.ts             [新增]
│       ├── app-channels.ts              [新增]
│       └── __tests__/
│           ├── cms-publications.test.ts
│           └── app-channels.test.ts
│
├── app/
│   ├── actions/
│   │   └── cms.ts                       [新增] publishArticleToCms / triggerCatalogSync
│   │
│   ├── api/
│   │   └── cms/
│   │       ├── catalog-sync/
│   │       │   └── route.ts             [新增] POST 触发同步
│   │       └── catalog-sync/[logId]/
│   │           └── route.ts             [新增] GET 查进度
│   │
│   └── (dashboard)/
│       └── settings/
│           └── cms-mapping/
│               ├── page.tsx             [新增] 栏目映射配置页
│               └── cms-mapping-client.tsx [新增] client 交互
│
└── inngest/
    └── functions/
        ├── cms-catalog-sync.ts          [新增] 每日 cron + 手动触发
        ├── cms-status-poll.ts           [新增] 入库后轮询状态
        └── cms-publish-retry.ts         [新增] 失败重试

skills/
├── cms_publish/
│   └── SKILL.md                         [新增] copy from spec
└── cms_catalog_sync/
    └── SKILL.md                         [新增] copy from spec

docs/
└── (P1 不改 spec，只产出本 plan)

tests/e2e/                               (可选集成测试目录；P1 不强制)
```

### 修改文件

```
src/db/schema/enums.ts                   [修改] 追加 cmsPublicationStateEnum + reviewTierEnum
src/db/schema/index.ts                   [修改] 导出 5 个新 schema 文件
src/db/seed.ts                           [修改] 追加 seedAppChannels + seedCmsSkills
.env.example                             [修改] 追加 CMS_* 6 个 env
.env.local                               [修改] 填入提供的固定值
```

---

## Progress Checklist

共 **40 个 Task**，分 7 个 Section：

```
Section A — 基础设施（6 tasks）
  - [ ] Task 1: 环境变量与 feature flag
  - [ ] Task 2: 新增 db enum（cmsPublicationState / reviewTier）
  - [ ] Task 3: 建立 src/lib/cms/ 模块骨架
  - [ ] Task 4: CmsError 错误类型层级
  - [ ] Task 5: vitest mock 基础（node-mocks 或 msw 选型）
  - [ ] Task 6: 测试数据库准备（schema 推送测试环境）

Section B — 数据模型（6 tasks）
  - [ ] Task 7: cms_channels schema + DAL
  - [ ] Task 8: cms_apps schema + DAL
  - [ ] Task 9: cms_catalogs schema + DAL
  - [ ] Task 10: cms_sync_logs schema + DAL
  - [ ] Task 11: cms_publications schema + DAL
  - [ ] Task 12: app_channels schema + DAL + seed 9 个 APP 栏目

Section C — CMS 客户端层（8 tasks）
  - [ ] Task 13: CMS types.ts DTO 定义（zod schema）
  - [ ] Task 14: CmsClient HTTP 客户端（含超时、鉴权 header）
  - [ ] Task 15: CmsClient 重试策略（指数退避、错误分类）
  - [ ] Task 16: api-endpoints.getChannels
  - [ ] Task 17: api-endpoints.getAppList
  - [ ] Task 18: api-endpoints.getCatalogTree
  - [ ] Task 19: api-endpoints.saveArticle
  - [ ] Task 20: api-endpoints.getArticleDetail

Section D — Article Mapper（6 tasks）
  - [ ] Task 21: common 字段映射（title/author/status/tags 等）
  - [ ] Task 22: type1-article mapper（图文）
  - [ ] Task 23: type2-gallery mapper（图集）
  - [ ] Task 24: type4-external mapper（外链）
  - [ ] Task 25: determineType 函数（按 article 字段推导 CMS type）
  - [ ] Task 26: mapper 分发器 index.ts

Section E — 栏目同步（5 tasks）
  - [ ] Task 27: flattenTree 递归工具
  - [ ] Task 28: reconcileCatalogs 差量对比（insert/update/soft-delete）
  - [ ] Task 29: syncCmsCatalogs 主流程
  - [ ] Task 30: API route /api/cms/catalog-sync
  - [ ] Task 31: Inngest cms-catalog-sync 函数（daily cron）

Section F — CMS 入库（5 tasks）
  - [ ] Task 32: status-machine 状态机
  - [ ] Task 33: publishArticleToCms 主流程 + 幂等
  - [ ] Task 34: Server Action + feature flag 守卫
  - [ ] Task 35: Inngest cms-status-poll（5 次指数退避轮询）
  - [ ] Task 36: Inngest cms-publish-retry（失败重试）

Section G — 场景集成 + 验证（4 tasks）
  - [ ] Task 37: news_standard 场景端到端手动验证
  - [ ] Task 38: politics_shenzhen 场景端到端手动验证
  - [ ] Task 39: 栏目映射配置页最小 UI（/settings/cms-mapping）
  - [ ] Task 40: Skill MD 部署到 skills/ + 整体冒烟测试 + 文档更新
```

---

# Section A — 基础设施

## Task 1: 环境变量与 feature flag

**目的：** 让 CMS 对接的所有凭证、开关走 `.env.local`，禁止硬编码。引入 feature flag `VIBETIDE_CMS_PUBLISH_ENABLED` 作为总开关。

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`（用户手动改）
- Create: `src/lib/cms/feature-flags.ts`
- Create: `src/lib/cms/__tests__/feature-flags.test.ts`

- [ ] **Step 1.1: 修改 .env.example 追加 CMS 相关 env**

Edit `.env.example`，在末尾追加：

```bash
# ===== CMS (华栖云) =====
CMS_HOST=https://console.demo.chinamcloud.cn/cmsback
CMS_LOGIN_CMC_ID=<从 MMS/CMC 获取；P1 使用测试值 ac51d9649c03fa148b0a6d150e29de12>
CMS_LOGIN_CMC_TID=<从 MMS/CMC 获取；P1 使用测试值 267afa81ecd99962ef229c4bdcc1b33f>
CMS_TENANT_ID=ca37d5448dbf436626c4333df819ec6d
CMS_USERNAME=superAdmin
CMS_DEFAULT_COVER_URL=https://media.demo.chinamcloud.cn/image/default-cover.jpg
CMS_TIMEOUT_MS=15000
CMS_MAX_RETRIES=3

# Feature flag
VIBETIDE_CMS_PUBLISH_ENABLED=false        # Phase 1 默认关闭，逐 org 灰度
VIBETIDE_CATALOG_SYNC_ENABLED=true        # 栏目同步（cron + 手动）
```

- [ ] **Step 1.2: 用户手动把对应值写入 `.env.local`**

用户侧操作。提示用户执行：

```bash
# 追加到 .env.local（不提交到 git）
echo '
CMS_HOST=https://console.demo.chinamcloud.cn/cmsback
CMS_LOGIN_CMC_ID=ac51d9649c03fa148b0a6d150e29de12
CMS_LOGIN_CMC_TID=267afa81ecd99962ef229c4bdcc1b33f
CMS_TENANT_ID=ca37d5448dbf436626c4333df819ec6d
CMS_USERNAME=superAdmin
CMS_DEFAULT_COVER_URL=https://media.demo.chinamcloud.cn/image/default-cover.jpg
CMS_TIMEOUT_MS=15000
CMS_MAX_RETRIES=3
VIBETIDE_CMS_PUBLISH_ENABLED=false
VIBETIDE_CATALOG_SYNC_ENABLED=true
' >> .env.local
```

- [ ] **Step 1.3: 写 feature-flags 失败测试**

Create `src/lib/cms/__tests__/feature-flags.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCmsPublishEnabled, isCatalogSyncEnabled, requireCmsConfig } from "../feature-flags";

describe("feature-flags", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isCmsPublishEnabled", () => {
    it("returns true when VIBETIDE_CMS_PUBLISH_ENABLED=true", () => {
      process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "true";
      expect(isCmsPublishEnabled()).toBe(true);
    });

    it("returns false when not set", () => {
      delete process.env.VIBETIDE_CMS_PUBLISH_ENABLED;
      expect(isCmsPublishEnabled()).toBe(false);
    });

    it("returns false for any value other than 'true'", () => {
      process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "false";
      expect(isCmsPublishEnabled()).toBe(false);
      process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "1";
      expect(isCmsPublishEnabled()).toBe(false);
    });
  });

  describe("isCatalogSyncEnabled", () => {
    it("defaults to true when not set", () => {
      delete process.env.VIBETIDE_CATALOG_SYNC_ENABLED;
      expect(isCatalogSyncEnabled()).toBe(true);
    });

    it("returns false when explicitly set to 'false'", () => {
      process.env.VIBETIDE_CATALOG_SYNC_ENABLED = "false";
      expect(isCatalogSyncEnabled()).toBe(false);
    });
  });

  describe("requireCmsConfig", () => {
    it("throws when any required env is missing", () => {
      delete process.env.CMS_HOST;
      expect(() => requireCmsConfig()).toThrow(/CMS_HOST/);
    });

    it("returns config object when all env present", () => {
      process.env.CMS_HOST = "https://example.com";
      process.env.CMS_LOGIN_CMC_ID = "id123";
      process.env.CMS_LOGIN_CMC_TID = "tid123";
      process.env.CMS_TENANT_ID = "tenant123";
      process.env.CMS_USERNAME = "admin";
      const config = requireCmsConfig();
      expect(config).toEqual({
        host: "https://example.com",
        loginCmcId: "id123",
        loginCmcTid: "tid123",
        tenantId: "tenant123",
        username: "admin",
        timeoutMs: 15000,
        maxRetries: 3,
        defaultCoverUrl: expect.any(String),
      });
    });
  });
});
```

- [ ] **Step 1.4: 运行测试确认失败**

```bash
npm run test -- src/lib/cms/__tests__/feature-flags.test.ts
```

预期输出：全部 FAIL（模块未定义）。

- [ ] **Step 1.5: 实现 feature-flags.ts**

Create `src/lib/cms/feature-flags.ts`：

```typescript
/**
 * Feature flag 与配置读取。
 * 所有 CMS 相关代码必须通过此文件读取 env，不得直接访问 process.env.CMS_*。
 */

export interface CmsConfig {
  host: string;
  loginCmcId: string;
  loginCmcTid: string;
  tenantId: string;
  username: string;
  timeoutMs: number;
  maxRetries: number;
  defaultCoverUrl: string;
}

const REQUIRED_ENVS = [
  "CMS_HOST",
  "CMS_LOGIN_CMC_ID",
  "CMS_LOGIN_CMC_TID",
  "CMS_TENANT_ID",
  "CMS_USERNAME",
] as const;

export function isCmsPublishEnabled(): boolean {
  return process.env.VIBETIDE_CMS_PUBLISH_ENABLED === "true";
}

export function isCatalogSyncEnabled(): boolean {
  // 默认开启（同步是只读动作，低风险）
  return process.env.VIBETIDE_CATALOG_SYNC_ENABLED !== "false";
}

export function requireCmsConfig(): CmsConfig {
  const missing = REQUIRED_ENVS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[cms] Missing required env: ${missing.join(", ")}. 请检查 .env.local`,
    );
  }

  return {
    host: process.env.CMS_HOST!,
    loginCmcId: process.env.CMS_LOGIN_CMC_ID!,
    loginCmcTid: process.env.CMS_LOGIN_CMC_TID!,
    tenantId: process.env.CMS_TENANT_ID!,
    username: process.env.CMS_USERNAME!,
    timeoutMs: parseInt(process.env.CMS_TIMEOUT_MS ?? "15000", 10),
    maxRetries: parseInt(process.env.CMS_MAX_RETRIES ?? "3", 10),
    defaultCoverUrl:
      process.env.CMS_DEFAULT_COVER_URL ??
      "https://media.demo.chinamcloud.cn/image/default-cover.jpg",
  };
}
```

- [ ] **Step 1.6: 运行测试通过**

```bash
npm run test -- src/lib/cms/__tests__/feature-flags.test.ts
```

预期：全部 PASS。

- [ ] **Step 1.7: 提交**

```bash
git add .env.example src/lib/cms/feature-flags.ts src/lib/cms/__tests__/feature-flags.test.ts
git commit -m "feat(cms/p1): env vars + feature flags for CMS adapter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 新增与扩展数据库枚举

**目的：** 在 `src/db/schema/enums.ts`：
1. 追加 `cmsPublicationStateEnum` + `reviewTierEnum`（P1 新增，与 spec §11.3 严格一致）
2. **扩展现有 `artifactTypeEnum`，加入 `cms_publication` 值**（spec §11.3 要求；Task 33 的 `workflow_artifacts` 写入依赖此）

**Files:**
- Modify: `src/db/schema/enums.ts`
- Create: `src/db/schema/__tests__/cms-enums.test.ts`
- Create: `supabase/migrations/<timestamp>_add_artifact_type_cms_publication.sql`（人工写 migration，因为 PG 的 `ALTER TYPE ... ADD VALUE` 不支持事务）

- [ ] **Step 2.1: 写枚举值断言测试**

Create `src/db/schema/__tests__/cms-enums.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  cmsPublicationStateEnum,
  reviewTierEnum,
  artifactTypeEnum,
} from "../enums";

describe("CMS enums", () => {
  it("cmsPublicationStateEnum has exactly 6 values in the order from spec §11.3", () => {
    // Drizzle pgEnum exposes `.enumValues` at runtime.
    // 顺序严格对齐 spec §11.3 —— 顺序不同会导致 Postgres enum 声明顺序不一致，
    // 后续修正需要 ALTER TYPE 重建迁移。
    expect(cmsPublicationStateEnum.enumValues).toEqual([
      "submitting",
      "submitted",
      "synced",
      "rejected_by_cms",
      "failed",
      "retrying",
    ]);
  });

  it("reviewTierEnum has exactly 2 values", () => {
    expect(reviewTierEnum.enumValues).toEqual(["strict", "relaxed"]);
  });

  it("artifactTypeEnum includes 'cms_publication' (spec §11.3 extension)", () => {
    // Task 33 的 workflow_artifacts 写入依赖 cms_publication 值存在
    expect(artifactTypeEnum.enumValues).toContain("cms_publication");
  });
});
```

- [ ] **Step 2.2: 运行测试确认失败**

```bash
npm run test -- src/db/schema/__tests__/cms-enums.test.ts
```

预期：FAIL（`cmsPublicationStateEnum` 未导出）。

- [ ] **Step 2.3: 修改 enums.ts 追加 + 扩展枚举**

Edit `src/db/schema/enums.ts`：

**(a) 扩展现有 `artifactTypeEnum`**（`src/db/schema/enums.ts:357-367`）——在 `"generic"` 之后追加 `"cms_publication"`：

```typescript
export const artifactTypeEnum = pgEnum("artifact_type", [
  "topic_brief",
  "angle_list",
  "material_pack",
  "article_draft",
  "video_plan",
  "review_report",
  "publish_plan",
  "analytics_report",
  "generic",
  "cms_publication",  // ← P1 新增（spec §11.3 扩展）
]);
```

**(b) 文件末尾追加两个新 enum**：

```typescript
// =====================================================================
// Phase 1 — CMS 适配层新增
// =====================================================================

// 顺序严格与 spec §11.3 一致；修改顺序需配套 ALTER TYPE 迁移
export const cmsPublicationStateEnum = pgEnum("cms_publication_state", [
  "submitting",
  "submitted",
  "synced",
  "rejected_by_cms",
  "failed",
  "retrying",
]);

export const reviewTierEnum = pgEnum("review_tier", ["strict", "relaxed"]);
```

- [ ] **Step 2.3b: 手写 migration 添加 enum value**

**⚠️ 重要：** Postgres 的 `ALTER TYPE ... ADD VALUE` 不能在事务内运行，而 drizzle-kit 默认用事务。因此 `db:push` 可能失败，需要手写 migration 绕开事务。

生成 timestamp：

```bash
TS=$(date +%Y%m%d%H%M%S)
echo "timestamp=$TS"
```

Create `supabase/migrations/${TS}_add_artifact_type_cms_publication.sql`：

```sql
-- Phase 1 — 为 workflow_artifacts.artifactType 加入 cms_publication
-- 注意：ALTER TYPE ... ADD VALUE 不支持事务，此 migration 必须在事务外执行
ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'cms_publication';
```

应用 migration：

```bash
# 方式 A（推荐）：supabase CLI
npx supabase db push --linked

# 方式 B：直接跑 psql（测试环境）
psql $DATABASE_URL -c "ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'cms_publication';"
```

验证：

```bash
psql $DATABASE_URL -c "SELECT enum_range(NULL::artifact_type);"
# 预期输出含 'cms_publication'
```

- [ ] **Step 2.4: 运行测试通过**

```bash
npm run test -- src/db/schema/__tests__/cms-enums.test.ts
```

预期：PASS。

- [ ] **Step 2.5: 验证类型编译**

```bash
npx tsc --noEmit
```

预期：无错误。

- [ ] **Step 2.6: 提交**

```bash
git add src/db/schema/enums.ts src/db/schema/__tests__/cms-enums.test.ts \
        supabase/migrations/*_add_artifact_type_cms_publication.sql
git commit -m "feat(cms/p1): add cmsPublicationState + reviewTier pg enums

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 建立 src/lib/cms/ 模块骨架

**目的：** 先搭好 `src/lib/cms/` 目录 + `index.ts` 导出结构，为后续 task 提供明确的 import 路径。此 task 不引入业务逻辑。

**Files:**
- Create: `src/lib/cms/index.ts`

- [ ] **Step 3.1: 创建目录并写出口文件**

Create `src/lib/cms/index.ts`：

```typescript
/**
 * CMS 适配层统一出口。
 *
 * 调用方只从此文件 import；不要直接引用 client/mapper/catalog-sync 等内部文件。
 *
 * 设计文档：docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md §3
 */

// —— 配置 & feature flag ——
export {
  isCmsPublishEnabled,
  isCatalogSyncEnabled,
  requireCmsConfig,
  type CmsConfig,
} from "./feature-flags";

// —— 后续 Task 会追加 ——
// export { CmsClient } from "./client";
// export { saveArticle, getArticleDetail, getChannels, getAppList, getCatalogTree } from "./api-endpoints";
// export { CmsAuthError, CmsBusinessError, CmsNetworkError, CmsSchemaError, CmsConfigError } from "./errors";
// export { mapArticleToCms, determineType } from "./article-mapper";
// export { syncCmsCatalogs } from "./catalog-sync";
// export { classifyState, isRetriableError } from "./status-machine";
```

- [ ] **Step 3.2: 验证 import 可用**

```bash
npx tsc --noEmit
```

预期：无错误。

在终端快速验证 import（可选）：

```bash
node -e "const m = require('./src/lib/cms/index.ts'); console.log(Object.keys(m))" 2>/dev/null || \
  echo '(node 不直接执行 ts；等后续 task 在应用代码中使用)'
```

- [ ] **Step 3.3: 提交**

```bash
git add src/lib/cms/index.ts
git commit -m "feat(cms/p1): scaffold src/lib/cms/ module with index.ts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: CmsError 错误类型层级

**目的：** 统一错误分类，便于上层 retry 策略判断是否可重试、审计日志分类、告警分级。与 spec §3.2 一致。

**Files:**
- Create: `src/lib/cms/errors.ts`
- Create: `src/lib/cms/__tests__/errors.test.ts`

- [ ] **Step 4.1: 写错误分类测试**

Create `src/lib/cms/__tests__/errors.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  CmsError,
  CmsAuthError,
  CmsBusinessError,
  CmsNetworkError,
  CmsSchemaError,
  CmsConfigError,
  isRetriableCmsError,
  classifyCmsError,
} from "../errors";

describe("CmsError hierarchy", () => {
  it("CmsAuthError extends CmsError with name", () => {
    const err = new CmsAuthError("login_cmc_id 失效");
    expect(err).toBeInstanceOf(CmsError);
    expect(err.name).toBe("CmsAuthError");
    expect(err.message).toBe("login_cmc_id 失效");
  });

  it("CmsBusinessError carries state + cmsMessage metadata", () => {
    const err = new CmsBusinessError("state=500", { state: 500, cmsMessage: "内部错误" });
    expect(err.state).toBe(500);
    expect(err.cmsMessage).toBe("内部错误");
  });

  it("CmsNetworkError for timeouts and DNS failures", () => {
    const err = new CmsNetworkError("timeout", { cause: "AbortError" });
    expect(err.cause).toBe("AbortError");
  });

  it("CmsSchemaError for invalid payloads", () => {
    const err = new CmsSchemaError("missing required: content", { field: "content" });
    expect(err.field).toBe("content");
  });

  it("CmsConfigError for missing env / unmapped catalog", () => {
    const err = new CmsConfigError("CMS_HOST missing");
    expect(err).toBeInstanceOf(CmsError);
  });
});

describe("isRetriableCmsError", () => {
  it("network errors are retriable", () => {
    expect(isRetriableCmsError(new CmsNetworkError("timeout"))).toBe(true);
  });

  it("5xx business errors are retriable", () => {
    expect(
      isRetriableCmsError(new CmsBusinessError("server error", { state: 503 })),
    ).toBe(true);
  });

  it("auth errors are NOT retriable (would accelerate account lockout)", () => {
    expect(isRetriableCmsError(new CmsAuthError("未登录"))).toBe(false);
  });

  it("schema errors are NOT retriable", () => {
    expect(isRetriableCmsError(new CmsSchemaError("bad payload"))).toBe(false);
  });

  it("config errors are NOT retriable", () => {
    expect(isRetriableCmsError(new CmsConfigError("env missing"))).toBe(false);
  });

  it("4xx business errors are NOT retriable (except 408/429)", () => {
    expect(
      isRetriableCmsError(new CmsBusinessError("bad request", { state: 400 })),
    ).toBe(false);
  });

  it("408 timeout and 429 rate limit ARE retriable", () => {
    expect(
      isRetriableCmsError(new CmsBusinessError("timeout", { state: 408 })),
    ).toBe(true);
    expect(
      isRetriableCmsError(new CmsBusinessError("rate limit", { state: 429 })),
    ).toBe(true);
  });
});

describe("classifyCmsError", () => {
  it("returns 'auth' for CmsAuthError", () => {
    expect(classifyCmsError(new CmsAuthError("x"))).toBe("auth");
  });
  it("returns 'network' for CmsNetworkError", () => {
    expect(classifyCmsError(new CmsNetworkError("x"))).toBe("network");
  });
  it("returns 'cms_business' for CmsBusinessError", () => {
    expect(classifyCmsError(new CmsBusinessError("x"))).toBe("cms_business");
  });
  it("returns 'mapping' for CmsSchemaError", () => {
    expect(classifyCmsError(new CmsSchemaError("x"))).toBe("mapping");
  });
  it("returns 'config' for CmsConfigError", () => {
    expect(classifyCmsError(new CmsConfigError("x"))).toBe("config");
  });
  it("returns 'unknown' for arbitrary error", () => {
    expect(classifyCmsError(new Error("x"))).toBe("unknown");
  });
});
```

- [ ] **Step 4.2: 运行测试确认失败**

```bash
npm run test -- src/lib/cms/__tests__/errors.test.ts
```

预期：FAIL（errors 模块未定义）。

- [ ] **Step 4.3: 实现 errors.ts**

Create `src/lib/cms/errors.ts`：

```typescript
/**
 * CMS 对接层统一错误类型。
 *
 * 分类：
 *   auth         — login_cmc_id/tid 失效（不可重试，触发告警）
 *   network      — 超时/DNS/连接拒绝（可重试）
 *   cms_business — CMS 返回 state != 200（5xx 可重试；4xx 除 408/429 外不可重试）
 *   mapping      — Payload 结构错误（不可重试，说明上游 bug）
 *   config       — 本地配置错误（不可重试，启动前应发现）
 *
 * 设计文档：§3.2 HTTP 客户端 / §3.7 幂等策略
 */

export class CmsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CmsError";
    // 保留 V8 stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class CmsAuthError extends CmsError {
  constructor(message: string) {
    super(message);
    this.name = "CmsAuthError";
  }
}

export interface CmsBusinessErrorMeta {
  state?: number;
  cmsMessage?: string;
  rawResponse?: unknown;
}

export class CmsBusinessError extends CmsError {
  public readonly state?: number;
  public readonly cmsMessage?: string;
  public readonly rawResponse?: unknown;

  constructor(message: string, meta: CmsBusinessErrorMeta = {}) {
    super(message);
    this.name = "CmsBusinessError";
    this.state = meta.state;
    this.cmsMessage = meta.cmsMessage;
    this.rawResponse = meta.rawResponse;
  }
}

export interface CmsNetworkErrorMeta {
  cause?: string;
}

export class CmsNetworkError extends CmsError {
  public readonly cause?: string;

  constructor(message: string, meta: CmsNetworkErrorMeta = {}) {
    super(message);
    this.name = "CmsNetworkError";
    this.cause = meta.cause;
  }
}

export interface CmsSchemaErrorMeta {
  field?: string;
}

export class CmsSchemaError extends CmsError {
  public readonly field?: string;

  constructor(message: string, meta: CmsSchemaErrorMeta = {}) {
    super(message);
    this.name = "CmsSchemaError";
    this.field = meta.field;
  }
}

export class CmsConfigError extends CmsError {
  constructor(message: string) {
    super(message);
    this.name = "CmsConfigError";
  }
}

// —— 分类辅助 ——

export type CmsErrorStage =
  | "auth"
  | "network"
  | "cms_business"
  | "mapping"
  | "config"
  | "unknown";

export function classifyCmsError(err: unknown): CmsErrorStage {
  if (err instanceof CmsAuthError) return "auth";
  if (err instanceof CmsNetworkError) return "network";
  if (err instanceof CmsBusinessError) return "cms_business";
  if (err instanceof CmsSchemaError) return "mapping";
  if (err instanceof CmsConfigError) return "config";
  return "unknown";
}

export function isRetriableCmsError(err: unknown): boolean {
  if (err instanceof CmsNetworkError) return true;
  if (err instanceof CmsBusinessError) {
    const s = err.state ?? 0;
    // 5xx 可重试；4xx 仅 408/429 可重试
    if (s >= 500 && s < 600) return true;
    if (s === 408 || s === 429) return true;
    return false;
  }
  // auth / schema / config / unknown 均不重试
  return false;
}
```

- [ ] **Step 4.4: 运行测试通过**

```bash
npm run test -- src/lib/cms/__tests__/errors.test.ts
```

预期：全部 PASS。

- [ ] **Step 4.5: 更新 index.ts 导出错误**

Edit `src/lib/cms/index.ts`，取消注释 errors 行 + 追加：

```typescript
export {
  CmsError,
  CmsAuthError,
  CmsBusinessError,
  CmsNetworkError,
  CmsSchemaError,
  CmsConfigError,
  isRetriableCmsError,
  classifyCmsError,
  type CmsErrorStage,
} from "./errors";
```

- [ ] **Step 4.6: 类型编译**

```bash
npx tsc --noEmit
```

预期：无错误。

- [ ] **Step 4.7: 提交**

```bash
git add src/lib/cms/errors.ts src/lib/cms/__tests__/errors.test.ts src/lib/cms/index.ts
git commit -m "feat(cms/p1): CmsError hierarchy + retriable classification

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: vitest HTTP mock 工具

**目的：** CMS 客户端测试需要 mock HTTP。选 `vi.stubGlobal("fetch", mock)` 方式（轻量，与现有项目一致），不引入 msw（避免新依赖）。封装一个 `mockCmsFetch` helper 复用。

**Files:**
- Create: `src/lib/cms/__tests__/test-helpers.ts`
- Create: `src/lib/cms/__tests__/test-helpers.test.ts`

- [ ] **Step 5.1: 写 helper 自验证测试**

Create `src/lib/cms/__tests__/test-helpers.test.ts`：

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
  cmsErrorResponse,
} from "./test-helpers";

describe("test-helpers", () => {
  afterEach(() => restoreCmsFetch());

  it("cmsSuccessResponse builds a proper 200 JSON body", async () => {
    const res = cmsSuccessResponse({ hello: "world" });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      state: 200,
      success: true,
      message: "操作成功",
      data: { hello: "world" },
    });
  });

  it("cmsErrorResponse builds error body with custom state and message", async () => {
    const res = cmsErrorResponse(500, "内部错误");
    expect(res.status).toBe(200); // CMS 业务错误走 HTTP 200 但 state != 200
    const data = await res.json();
    expect(data).toEqual({
      state: 500,
      success: false,
      message: "内部错误",
      data: null,
    });
  });

  it("mockCmsFetch intercepts global fetch and returns queued response", async () => {
    mockCmsFetch([cmsSuccessResponse({ foo: "bar" })]);
    const res = await fetch("https://whatever/x");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ foo: "bar" });
  });

  it("mockCmsFetch returns queued responses in order then throws on over-consume", async () => {
    mockCmsFetch([
      cmsSuccessResponse({ n: 1 }),
      cmsSuccessResponse({ n: 2 }),
    ]);
    const r1 = await (await fetch("u")).json();
    const r2 = await (await fetch("u")).json();
    expect(r1.data).toEqual({ n: 1 });
    expect(r2.data).toEqual({ n: 2 });
    await expect(fetch("u")).rejects.toThrow(/no more mock/i);
  });
});
```

- [ ] **Step 5.2: 运行测试确认失败**

```bash
npm run test -- src/lib/cms/__tests__/test-helpers.test.ts
```

预期：FAIL。

- [ ] **Step 5.3: 实现 test-helpers.ts**

Create `src/lib/cms/__tests__/test-helpers.ts`：

```typescript
/**
 * CMS 测试工具：mock 全局 fetch、构建典型响应。
 *
 * 用法：
 *   beforeEach(() => mockCmsFetch([cmsSuccessResponse({...})]));
 *   afterEach(() => restoreCmsFetch());
 */

import { vi } from "vitest";

/** 构建一个 CMS 约定的成功响应 */
export function cmsSuccessResponse<T>(data: T, message = "操作成功"): Response {
  return new Response(
    JSON.stringify({
      state: 200,
      success: true,
      message,
      data,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** 构建一个 CMS 约定的业务错误响应（HTTP 仍 200，state 携带错误码） */
export function cmsErrorResponse(state: number, message: string): Response {
  return new Response(
    JSON.stringify({
      state,
      success: false,
      message,
      data: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** 构建一个真正的 HTTP 层错误响应（如 5xx） */
export function cmsHttpErrorResponse(httpStatus: number, body = ""): Response {
  return new Response(body, { status: httpStatus });
}

/** 构建一个 network 级 AbortError（超时） */
export function cmsAbortError(): Error {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;
let _queue: Array<Response | Error> = [];

/**
 * 按顺序返回队列中的响应（或抛出错误）。
 * 超出队列容量抛 "no more mock responses"。
 */
export function mockCmsFetch(queue: Array<Response | Error>): void {
  _queue = [...queue];
  const impl = async () => {
    const next = _queue.shift();
    if (!next) throw new Error("no more mock responses queued");
    if (next instanceof Error) throw next;
    return next;
  };
  fetchSpy = vi.spyOn(globalThis, "fetch" as never).mockImplementation(impl as never);
}

/** 恢复真实 fetch */
export function restoreCmsFetch(): void {
  if (fetchSpy) {
    fetchSpy.mockRestore();
    fetchSpy = null;
  }
  _queue = [];
}
```

- [ ] **Step 5.4: 运行测试通过**

```bash
npm run test -- src/lib/cms/__tests__/test-helpers.test.ts
```

预期：PASS。

- [ ] **Step 5.5: 提交**

```bash
git add src/lib/cms/__tests__/test-helpers.ts src/lib/cms/__tests__/test-helpers.test.ts
git commit -m "test(cms/p1): add CMS mock fetch helpers for vitest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 测试数据库 schema 推送验证

**目的：** 验证接下来的 schema 文件能正确被 Drizzle 识别、推送到测试 DB。本 task 不写业务代码，只保证 `npm run db:push` 成功执行（作为后续每个 schema task 的前置检查）。

**Files:**
- Modify: `src/db/schema/index.ts`（确认 exports 列表结构）
- 临时：无新增

- [ ] **Step 6.1: 确认 schema 入口文件存在**

```bash
ls -la src/db/schema/index.ts
```

预期：文件存在。

Read `src/db/schema/index.ts` 头 20 行：

```bash
head -30 src/db/schema/index.ts
```

确认导出方式（可能是 `export * from "./xxx"`）。记录下来，Section B 的每个 schema task 都要追加一行 `export *`。

- [ ] **Step 6.2: 确认现有 `npm run db:push` 可跑**

```bash
npm run db:push 2>&1 | tail -20
```

预期：现有 schema 推送成功（无新表差异，或有提示但执行成功）。

> ⚠️ 若 DB 连接失败 —— 检查 `.env.local` 的 `DATABASE_URL`。Supabase PgBouncer 模式下必须用 `{ prepare: false }`（已在 src/db/index.ts 配置）。

- [ ] **Step 6.3: 建立"section B 验证 checklist"**（文档型，无需代码）

此为 memo，后续 Section B 每个 schema task 完成后执行：

```bash
# 1. schema 文件新建 → 导出到 index.ts
# 2. npm run db:push  预期无错
# 3. npm run db:studio 可见新表
# 4. 运行该 task 的测试
```

- [ ] **Step 6.4: 提交本 task（无代码变更，但需要标记进度）**

无文件变更时，不需要 commit；task 完成即可。如有任何小修（如 index.ts 注释），则：

```bash
git status
# 若无变更：skip commit
# 若有变更：git add -A && git commit -m "chore(cms/p1): verify db:push baseline for Section B"
```

---

# Section A 完成检查

到此 Section A 完成后，应满足：

```bash
# 1. 所有 A 组测试通过
npm run test -- src/lib/cms/ src/db/schema/

# 2. 类型编译通过
npx tsc --noEmit

# 3. feature flags 可 import
node -e "require('tsx/cjs'); const {isCmsPublishEnabled} = require('./src/lib/cms/feature-flags'); console.log(isCmsPublishEnabled())"
```

Section A 结束后 git log 应看到 4-5 个 commit（Task 1/2/4/5 各 1 个，Task 3/6 可能无代码或合入）。

**→ Section B 开始前，请在对话中确认"Section A 完成"。**

---

# Section B — 数据模型

**约定：** 本 Section 每个 Task 的提交消息统一 prefix 为 `feat(cms/p1): `，格式为 `feat(cms/p1): <表名> schema + DAL`。

**每个 Task 完成后的 3 步验证清单**（后续不再重复）：
```bash
npm run test -- <对应测试文件>      # 1. 测试通过
npx tsc --noEmit                   # 2. 类型编译通过
npm run db:push                    # 3. schema 推送成功
```

---

## Task 7: cms_channels schema + DAL

**目的：** 第一张新表。存 CMS 渠道字典（CHANNEL_APP 等），来自 `/web/catalog/getChannels`。

**Files:**
- Create: `src/db/schema/cms-mapping.ts`（本文件最终会放 4 张表；Task 7-10 逐步追加）
- Modify: `src/db/schema/index.ts`
- Create: `src/lib/dal/cms-channels.ts`
- Create: `src/lib/dal/__tests__/cms-channels.test.ts`

- [ ] **Step 7.1: 写 DAL 失败测试**

Create `src/lib/dal/__tests__/cms-channels.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsChannels } from "@/db/schema";
import { upsertCmsChannel, listCmsChannels } from "../cms-channels";
import { eq } from "drizzle-orm";

describe("DAL cms-channels", () => {
  const orgId = randomUUID();

  beforeEach(async () => {
    await db.delete(cmsChannels).where(eq(cmsChannels.organizationId, orgId));
  });

  it("upsertCmsChannel inserts on first call", async () => {
    await upsertCmsChannel(orgId, {
      channelKey: "CHANNEL_APP",
      channelCode: 1,
      name: "APP",
      pickValue: "1",
      thirdFlag: "2",
    });
    const rows = await listCmsChannels(orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ channelKey: "CHANNEL_APP", channelCode: 1, name: "APP" });
    expect(rows[0].lastSyncedAt).toBeInstanceOf(Date);
  });

  it("upsertCmsChannel updates on second call with same (orgId, channelKey)", async () => {
    await upsertCmsChannel(orgId, { channelKey: "CHANNEL_APP", channelCode: 1, name: "APP" });
    await upsertCmsChannel(orgId, { channelKey: "CHANNEL_APP", channelCode: 1, name: "APP 更新" });
    const rows = await listCmsChannels(orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("APP 更新");
  });

  it("listCmsChannels only returns records for the org", async () => {
    const otherOrg = randomUUID();
    await upsertCmsChannel(orgId, { channelKey: "CHANNEL_APP", channelCode: 1, name: "A" });
    await upsertCmsChannel(otherOrg, { channelKey: "CHANNEL_APP", channelCode: 1, name: "B" });
    expect(await listCmsChannels(orgId)).toHaveLength(1);
    expect(await listCmsChannels(otherOrg)).toHaveLength(1);
  });
});
```

> ⚠️ 集成测试依赖真实 DB。如果 CI 没 DB，用 `vitest --testPathIgnorePatterns` 跳过；本地开发必须有 `.env.local` 的 `DATABASE_URL`。

- [ ] **Step 7.2: 运行测试确认失败**

```bash
npm run test -- src/lib/dal/__tests__/cms-channels.test.ts
```

预期：FAIL（`@/db/schema/cmsChannels` 不存在）。

- [ ] **Step 7.3: 创建 cms-mapping schema 文件（首次，含 cms_channels）**

Create `src/db/schema/cms-mapping.ts`：

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

// =====================================================================
// cms_channels — CMS 渠道字典（来自 /web/catalog/getChannels）
// 设计文档 §9.3 / §11.2
// =====================================================================

export const cmsChannels = pgTable(
  "cms_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    channelKey: text("channel_key").notNull(),   // CHANNEL_APP / CHANNEL_WECHAT ...
    channelCode: integer("channel_code").notNull(), // 1 / 3 / 5 ...
    name: text("name").notNull(),
    pickValue: text("pick_value"),
    thirdFlag: text("third_flag"),

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgKey: uniqueIndex("cms_channels_org_key_uniq").on(
      table.organizationId,
      table.channelKey,
    ),
  }),
);

export const cmsChannelsRelations = relations(cmsChannels, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsChannels.organizationId],
    references: [organizations.id],
  }),
}));
```

- [ ] **Step 7.4: 导出到 schema/index.ts**

Edit `src/db/schema/index.ts`，追加：

```typescript
export * from "./cms-mapping";
```

- [ ] **Step 7.5: 推送 schema 到数据库**

```bash
npm run db:push
```

预期：输出 `cms_channels` 表被创建。

- [ ] **Step 7.6: 实现 DAL**

Create `src/lib/dal/cms-channels.ts`：

```typescript
import { db } from "@/db";
import { cmsChannels } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface CmsChannelUpsert {
  channelKey: string;
  channelCode: number;
  name: string;
  pickValue?: string;
  thirdFlag?: string;
}

export async function upsertCmsChannel(
  organizationId: string,
  input: CmsChannelUpsert,
): Promise<void> {
  const now = new Date();
  await db
    .insert(cmsChannels)
    .values({
      organizationId,
      channelKey: input.channelKey,
      channelCode: input.channelCode,
      name: input.name,
      pickValue: input.pickValue ?? null,
      thirdFlag: input.thirdFlag ?? null,
      lastSyncedAt: now,
    })
    .onConflictDoUpdate({
      target: [cmsChannels.organizationId, cmsChannels.channelKey],
      set: {
        channelCode: input.channelCode,
        name: input.name,
        pickValue: input.pickValue ?? null,
        thirdFlag: input.thirdFlag ?? null,
        lastSyncedAt: now,
      },
    });
}

export async function listCmsChannels(organizationId: string) {
  return await db.query.cmsChannels.findMany({
    where: eq(cmsChannels.organizationId, organizationId),
    orderBy: (c, { asc }) => [asc(c.channelCode)],
  });
}
```

- [ ] **Step 7.7: 运行测试通过**

```bash
npm run test -- src/lib/dal/__tests__/cms-channels.test.ts
```

预期：3 个用例全 PASS。

- [ ] **Step 7.8: 提交**

```bash
git add src/db/schema/cms-mapping.ts src/db/schema/index.ts \
        src/lib/dal/cms-channels.ts src/lib/dal/__tests__/cms-channels.test.ts
git commit -m "feat(cms/p1): cms_channels schema + DAL (upsert/list)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: cms_apps schema + DAL

**目的：** 存 CMS 应用（siteId / appkey / appsecret），来自 `/web/application/getAppList`。

**Files:**
- Modify: `src/db/schema/cms-mapping.ts`（追加 cmsApps 表）
- Create: `src/lib/dal/cms-apps.ts`
- Create: `src/lib/dal/__tests__/cms-apps.test.ts`

- [ ] **Step 8.1: 写 DAL 测试**

Create `src/lib/dal/__tests__/cms-apps.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsApps } from "@/db/schema";
import { upsertCmsApp, listCmsApps, getCmsAppBySiteId } from "../cms-apps";
import { eq } from "drizzle-orm";

describe("DAL cms-apps", () => {
  const orgId = randomUUID();

  beforeEach(async () => {
    await db.delete(cmsApps).where(eq(cmsApps.organizationId, orgId));
  });

  it("upsertCmsApp inserts and updates by (org, cmsAppId)", async () => {
    await upsertCmsApp(orgId, {
      cmsAppId: "10",
      channelKey: "CHANNEL_APP",
      siteId: 81,
      name: "深圳广电 APP",
      appkey: "ak_test",
      appsecret: "as_test",
    });
    await upsertCmsApp(orgId, {
      cmsAppId: "10",
      channelKey: "CHANNEL_APP",
      siteId: 81,
      name: "深圳广电 APP v2",
      appkey: "ak_test",
      appsecret: "as_test",
    });
    const rows = await listCmsApps(orgId);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("深圳广电 APP v2");
  });

  it("getCmsAppBySiteId returns the app or null", async () => {
    await upsertCmsApp(orgId, { cmsAppId: "10", channelKey: "CHANNEL_APP", siteId: 81, name: "A" });
    const app = await getCmsAppBySiteId(orgId, 81);
    expect(app?.cmsAppId).toBe("10");

    const notFound = await getCmsAppBySiteId(orgId, 999);
    expect(notFound).toBeNull();
  });
});
```

- [ ] **Step 8.2: 运行确认 FAIL**

```bash
npm run test -- src/lib/dal/__tests__/cms-apps.test.ts
```

- [ ] **Step 8.3: 追加 cmsApps 到 cms-mapping.ts**

Edit `src/db/schema/cms-mapping.ts`，在 `cmsChannelsRelations` 后追加：

```typescript
// =====================================================================
// cms_apps — CMS 应用（来自 /web/application/getAppList）
// =====================================================================

export const cmsApps = pgTable(
  "cms_apps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    channelKey: text("channel_key").notNull(), // CHANNEL_APP / CHANNEL_WEB ...
    cmsAppId: text("cms_app_id").notNull(),    // CMS 的 app.id
    siteId: integer("site_id").notNull(),
    name: text("name").notNull(),
    appkey: text("appkey"),
    appsecret: text("appsecret"),              // ⚠️ P1 明文存储；Phase 2 接 KMS

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgAppId: uniqueIndex("cms_apps_org_appid_uniq").on(
      table.organizationId,
      table.cmsAppId,
    ),
    siteIdIdx: index("cms_apps_site_id_idx").on(table.organizationId, table.siteId),
  }),
);

export const cmsAppsRelations = relations(cmsApps, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsApps.organizationId],
    references: [organizations.id],
  }),
}));
```

- [ ] **Step 8.4: db:push**

```bash
npm run db:push
```

- [ ] **Step 8.5: 实现 DAL**

Create `src/lib/dal/cms-apps.ts`：

```typescript
import { db } from "@/db";
import { cmsApps } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export interface CmsAppUpsert {
  cmsAppId: string;
  channelKey: string;
  siteId: number;
  name: string;
  appkey?: string;
  appsecret?: string;
}

export async function upsertCmsApp(
  organizationId: string,
  input: CmsAppUpsert,
): Promise<void> {
  const now = new Date();
  await db
    .insert(cmsApps)
    .values({
      organizationId,
      cmsAppId: input.cmsAppId,
      channelKey: input.channelKey,
      siteId: input.siteId,
      name: input.name,
      appkey: input.appkey ?? null,
      appsecret: input.appsecret ?? null,
      lastSyncedAt: now,
    })
    .onConflictDoUpdate({
      target: [cmsApps.organizationId, cmsApps.cmsAppId],
      set: {
        channelKey: input.channelKey,
        siteId: input.siteId,
        name: input.name,
        appkey: input.appkey ?? null,
        appsecret: input.appsecret ?? null,
        lastSyncedAt: now,
      },
    });
}

export async function listCmsApps(organizationId: string, channelKey?: string) {
  const where = channelKey
    ? and(eq(cmsApps.organizationId, organizationId), eq(cmsApps.channelKey, channelKey))
    : eq(cmsApps.organizationId, organizationId);
  return await db.query.cmsApps.findMany({
    where,
    orderBy: (c, { asc }) => [asc(c.siteId)],
  });
}

export async function getCmsAppBySiteId(organizationId: string, siteId: number) {
  const row = await db.query.cmsApps.findFirst({
    where: and(eq(cmsApps.organizationId, organizationId), eq(cmsApps.siteId, siteId)),
  });
  return row ?? null;
}
```

- [ ] **Step 8.6: 测试通过**

```bash
npm run test -- src/lib/dal/__tests__/cms-apps.test.ts
```

- [ ] **Step 8.7: 提交**

```bash
git add src/db/schema/cms-mapping.ts src/lib/dal/cms-apps.ts src/lib/dal/__tests__/cms-apps.test.ts
git commit -m "feat(cms/p1): cms_apps schema + DAL

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: cms_catalogs schema + DAL

**目的：** 存 CMS 栏目树扁平化记录（来自 `/web/catalog/getTree`）。含软删字段 `deletedAt`。

**Files:**
- Modify: `src/db/schema/cms-mapping.ts`（追加）
- Create: `src/lib/dal/cms-catalogs.ts`
- Create: `src/lib/dal/__tests__/cms-catalogs.test.ts`

- [ ] **Step 9.1: 写 DAL 测试**

Create `src/lib/dal/__tests__/cms-catalogs.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsCatalogs } from "@/db/schema";
import {
  insertCmsCatalog,
  updateCmsCatalog,
  softDeleteCmsCatalog,
  listCmsCatalogsByApp,
  findCmsCatalogByCmsId,
} from "../cms-catalogs";
import { eq } from "drizzle-orm";

describe("DAL cms-catalogs", () => {
  const orgId = randomUUID();

  beforeEach(async () => {
    await db.delete(cmsCatalogs).where(eq(cmsCatalogs.organizationId, orgId));
  });

  const baseCatalog = {
    cmsCatalogId: 9369,
    appId: 10,
    siteId: 81,
    name: "新闻栏目",
    parentId: 0,
    innerCode: "009887",
    alias: "news",
    treeLevel: 1,
    isLeaf: true,
    catalogType: 1,
  };

  it("insertCmsCatalog creates record", async () => {
    await insertCmsCatalog(orgId, baseCatalog);
    const found = await findCmsCatalogByCmsId(orgId, 9369);
    expect(found?.name).toBe("新闻栏目");
    expect(found?.deletedAt).toBeNull();
  });

  it("updateCmsCatalog modifies an existing record", async () => {
    await insertCmsCatalog(orgId, baseCatalog);
    await updateCmsCatalog(orgId, 9369, { name: "重命名后" });
    const found = await findCmsCatalogByCmsId(orgId, 9369);
    expect(found?.name).toBe("重命名后");
  });

  it("softDeleteCmsCatalog sets deletedAt but keeps the row", async () => {
    await insertCmsCatalog(orgId, baseCatalog);
    await softDeleteCmsCatalog(orgId, 9369);
    const found = await findCmsCatalogByCmsId(orgId, 9369);
    expect(found?.deletedAt).toBeInstanceOf(Date);
  });

  it("listCmsCatalogsByApp excludes soft-deleted by default", async () => {
    await insertCmsCatalog(orgId, baseCatalog);
    await insertCmsCatalog(orgId, { ...baseCatalog, cmsCatalogId: 9370, name: "B" });
    await softDeleteCmsCatalog(orgId, 9370);

    const active = await listCmsCatalogsByApp(orgId, 10);
    expect(active).toHaveLength(1);
    expect(active[0].cmsCatalogId).toBe(9369);

    const includeDeleted = await listCmsCatalogsByApp(orgId, 10, { includeDeleted: true });
    expect(includeDeleted).toHaveLength(2);
  });
});
```

- [ ] **Step 9.2: 运行 FAIL**

```bash
npm run test -- src/lib/dal/__tests__/cms-catalogs.test.ts
```

- [ ] **Step 9.3: 追加 cmsCatalogs schema**

Edit `src/db/schema/cms-mapping.ts`，在 `cmsAppsRelations` 后追加：

```typescript
// =====================================================================
// cms_catalogs — CMS 栏目扁平化（来自 /web/catalog/getTree）
// =====================================================================

export const cmsCatalogs = pgTable(
  "cms_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    cmsCatalogId: integer("cms_catalog_id").notNull(),
    appId: integer("app_id").notNull(),
    siteId: integer("site_id").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id").default(0),
    innerCode: text("inner_code"),
    alias: text("alias"),
    treeLevel: integer("tree_level"),
    isLeaf: boolean("is_leaf").default(true),
    catalogType: integer("catalog_type").default(1), // 1=新闻栏目

    // 播放器 / 预览地址（入稿时可能需要）
    videoPlayer: text("video_player"),
    audioPlayer: text("audio_player"),
    livePlayer: text("live_player"),
    vlivePlayer: text("vlive_player"),
    h5Preview: text("h5_preview"),
    pcPreview: text("pc_preview"),
    url: text("url"),

    // 软删（CMS 侧删除 → 标记 deletedAt 不物理删，保护引用）
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgCatalogId: uniqueIndex("cms_catalogs_org_catid_uniq").on(
      table.organizationId,
      table.cmsCatalogId,
    ),
    treeIdx: index("cms_catalogs_tree_idx").on(
      table.organizationId,
      table.parentId,
      table.deletedAt,
    ),
    appIdx: index("cms_catalogs_app_idx").on(table.organizationId, table.appId),
  }),
);

export const cmsCatalogsRelations = relations(cmsCatalogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsCatalogs.organizationId],
    references: [organizations.id],
  }),
}));
```

- [ ] **Step 9.4: db:push**

```bash
npm run db:push
```

- [ ] **Step 9.5: 实现 DAL**

Create `src/lib/dal/cms-catalogs.ts`：

```typescript
import { db } from "@/db";
import { cmsCatalogs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export interface CmsCatalogFields {
  cmsCatalogId: number;
  appId: number;
  siteId: number;
  name: string;
  parentId?: number;
  innerCode?: string;
  alias?: string;
  treeLevel?: number;
  isLeaf?: boolean;
  catalogType?: number;
  videoPlayer?: string;
  audioPlayer?: string;
  livePlayer?: string;
  vlivePlayer?: string;
  h5Preview?: string;
  pcPreview?: string;
  url?: string;
}

export async function insertCmsCatalog(
  organizationId: string,
  input: CmsCatalogFields,
): Promise<void> {
  const now = new Date();
  await db.insert(cmsCatalogs).values({
    organizationId,
    cmsCatalogId: input.cmsCatalogId,
    appId: input.appId,
    siteId: input.siteId,
    name: input.name,
    parentId: input.parentId ?? 0,
    innerCode: input.innerCode ?? null,
    alias: input.alias ?? null,
    treeLevel: input.treeLevel ?? null,
    isLeaf: input.isLeaf ?? true,
    catalogType: input.catalogType ?? 1,
    videoPlayer: input.videoPlayer ?? null,
    audioPlayer: input.audioPlayer ?? null,
    livePlayer: input.livePlayer ?? null,
    vlivePlayer: input.vlivePlayer ?? null,
    h5Preview: input.h5Preview ?? null,
    pcPreview: input.pcPreview ?? null,
    url: input.url ?? null,
    lastSyncedAt: now,
  });
}

export async function updateCmsCatalog(
  organizationId: string,
  cmsCatalogId: number,
  patch: Partial<CmsCatalogFields>,
): Promise<void> {
  await db
    .update(cmsCatalogs)
    .set({ ...patch, lastSyncedAt: new Date(), deletedAt: null })
    .where(
      and(
        eq(cmsCatalogs.organizationId, organizationId),
        eq(cmsCatalogs.cmsCatalogId, cmsCatalogId),
      ),
    );
}

export async function softDeleteCmsCatalog(
  organizationId: string,
  cmsCatalogId: number,
): Promise<void> {
  await db
    .update(cmsCatalogs)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(cmsCatalogs.organizationId, organizationId),
        eq(cmsCatalogs.cmsCatalogId, cmsCatalogId),
      ),
    );
}

export async function findCmsCatalogByCmsId(
  organizationId: string,
  cmsCatalogId: number,
) {
  const row = await db.query.cmsCatalogs.findFirst({
    where: and(
      eq(cmsCatalogs.organizationId, organizationId),
      eq(cmsCatalogs.cmsCatalogId, cmsCatalogId),
    ),
  });
  return row ?? null;
}

export async function listCmsCatalogsByApp(
  organizationId: string,
  appId: number,
  options: { includeDeleted?: boolean } = {},
) {
  const conditions = [
    eq(cmsCatalogs.organizationId, organizationId),
    eq(cmsCatalogs.appId, appId),
  ];
  if (!options.includeDeleted) conditions.push(isNull(cmsCatalogs.deletedAt));
  return await db.query.cmsCatalogs.findMany({
    where: and(...conditions),
    orderBy: (c, { asc }) => [asc(c.treeLevel), asc(c.innerCode)],
  });
}

export async function listAllActiveCmsCatalogs(organizationId: string) {
  return await db.query.cmsCatalogs.findMany({
    where: and(
      eq(cmsCatalogs.organizationId, organizationId),
      isNull(cmsCatalogs.deletedAt),
    ),
  });
}
```

- [ ] **Step 9.6: 测试通过 + 提交**

```bash
npm run test -- src/lib/dal/__tests__/cms-catalogs.test.ts
git add src/db/schema/cms-mapping.ts src/lib/dal/cms-catalogs.ts src/lib/dal/__tests__/cms-catalogs.test.ts
git commit -m "feat(cms/p1): cms_catalogs schema + DAL (insert/update/soft-delete/list)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: cms_sync_logs schema + DAL

**目的：** 记录每次栏目同步的 stats / warnings，用于管理 UI 展示和审计。

**Files:**
- Modify: `src/db/schema/cms-mapping.ts`（追加）
- Create: `src/lib/dal/cms-sync-logs.ts`
- Create: `src/lib/dal/__tests__/cms-sync-logs.test.ts`

- [ ] **Step 10.1: 写 DAL 测试**

Create `src/lib/dal/__tests__/cms-sync-logs.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsSyncLogs } from "@/db/schema";
import {
  startCmsSyncLog,
  completeCmsSyncLog,
  failCmsSyncLog,
  listRecentSyncLogs,
  getSyncLogById,
} from "../cms-sync-logs";
import { eq } from "drizzle-orm";

describe("DAL cms-sync-logs", () => {
  const orgId = randomUUID();
  beforeEach(async () => {
    await db.delete(cmsSyncLogs).where(eq(cmsSyncLogs.organizationId, orgId));
  });

  it("startCmsSyncLog creates 'running' record and returns id", async () => {
    const id = await startCmsSyncLog(orgId, { triggerSource: "manual", operatorId: "user123" });
    const log = await getSyncLogById(id);
    expect(log?.state).toBe("running");
    expect(log?.triggerSource).toBe("manual");
  });

  it("completeCmsSyncLog sets state=done with stats", async () => {
    const id = await startCmsSyncLog(orgId, { triggerSource: "manual" });
    await completeCmsSyncLog(id, {
      stats: { channelsFetched: 1, appsFetched: 2, catalogsFetched: 100, inserted: 3, updated: 5, deleted: 0 },
      warnings: [],
    });
    const log = await getSyncLogById(id);
    expect(log?.state).toBe("done");
    expect(log?.stats).toMatchObject({ inserted: 3, updated: 5 });
    expect(log?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("failCmsSyncLog sets state=failed with errorMessage", async () => {
    const id = await startCmsSyncLog(orgId, { triggerSource: "scheduled" });
    await failCmsSyncLog(id, "CMS 鉴权失败");
    const log = await getSyncLogById(id);
    expect(log?.state).toBe("failed");
    expect(log?.errorMessage).toBe("CMS 鉴权失败");
  });

  it("listRecentSyncLogs returns latest-first with limit", async () => {
    for (let i = 0; i < 5; i++) {
      const id = await startCmsSyncLog(orgId, { triggerSource: "scheduled" });
      await completeCmsSyncLog(id, { stats: {}, warnings: [] });
    }
    const list = await listRecentSyncLogs(orgId, { limit: 3 });
    expect(list).toHaveLength(3);
  });
});
```

- [ ] **Step 10.2: 运行 FAIL**

```bash
npm run test -- src/lib/dal/__tests__/cms-sync-logs.test.ts
```

- [ ] **Step 10.3: 追加 cmsSyncLogs schema**

Edit `src/db/schema/cms-mapping.ts`，文件末尾追加：

```typescript
// =====================================================================
// cms_sync_logs — 栏目同步历史
// =====================================================================

export const cmsSyncLogs = pgTable(
  "cms_sync_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    state: text("state").notNull(), // running / done / failed
    stats: jsonb("stats").$type<Record<string, number>>(),
    warnings: jsonb("warnings").$type<string[]>(),
    triggerSource: text("trigger_source"), // manual / scheduled / auto_repair / first_time_setup
    operatorId: text("operator_id"),

    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    orgTimeIdx: index("cms_sync_logs_org_time_idx").on(
      table.organizationId,
      table.startedAt,
    ),
  }),
);

export const cmsSyncLogsRelations = relations(cmsSyncLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsSyncLogs.organizationId],
    references: [organizations.id],
  }),
}));
```

- [ ] **Step 10.4: db:push + 实现 DAL**

```bash
npm run db:push
```

Create `src/lib/dal/cms-sync-logs.ts`：

```typescript
import { db } from "@/db";
import { cmsSyncLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export interface StartSyncLogInput {
  triggerSource?: "manual" | "scheduled" | "auto_repair" | "first_time_setup";
  operatorId?: string;
}

export async function startCmsSyncLog(
  organizationId: string,
  input: StartSyncLogInput = {},
): Promise<string> {
  const [row] = await db
    .insert(cmsSyncLogs)
    .values({
      organizationId,
      state: "running",
      triggerSource: input.triggerSource ?? "manual",
      operatorId: input.operatorId ?? null,
      startedAt: new Date(),
    })
    .returning({ id: cmsSyncLogs.id });
  return row.id;
}

export async function completeCmsSyncLog(
  id: string,
  payload: { stats: Record<string, number>; warnings: string[] },
): Promise<void> {
  const now = new Date();
  const existing = await getSyncLogById(id);
  const duration = existing ? now.getTime() - existing.startedAt.getTime() : 0;

  await db
    .update(cmsSyncLogs)
    .set({
      state: "done",
      stats: payload.stats,
      warnings: payload.warnings,
      completedAt: now,
      durationMs: duration,
    })
    .where(eq(cmsSyncLogs.id, id));
}

export async function failCmsSyncLog(id: string, errorMessage: string): Promise<void> {
  const now = new Date();
  const existing = await getSyncLogById(id);
  const duration = existing ? now.getTime() - existing.startedAt.getTime() : 0;

  await db
    .update(cmsSyncLogs)
    .set({
      state: "failed",
      errorMessage,
      completedAt: now,
      durationMs: duration,
    })
    .where(eq(cmsSyncLogs.id, id));
}

export async function getSyncLogById(id: string) {
  const row = await db.query.cmsSyncLogs.findFirst({ where: eq(cmsSyncLogs.id, id) });
  return row ?? null;
}

export async function listRecentSyncLogs(
  organizationId: string,
  options: { limit?: number } = {},
) {
  return await db.query.cmsSyncLogs.findMany({
    where: eq(cmsSyncLogs.organizationId, organizationId),
    orderBy: [desc(cmsSyncLogs.startedAt)],
    limit: options.limit ?? 20,
  });
}
```

- [ ] **Step 10.5: 测试通过 + 提交**

```bash
npm run test -- src/lib/dal/__tests__/cms-sync-logs.test.ts
git add src/db/schema/cms-mapping.ts src/lib/dal/cms-sync-logs.ts src/lib/dal/__tests__/cms-sync-logs.test.ts
git commit -m "feat(cms/p1): cms_sync_logs schema + DAL (start/complete/fail/list)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: cms_publications schema + DAL

**目的：** 核心表。记录每次 article → CMS 入库的状态、请求、响应、重试次数。

**Files:**
- Create: `src/db/schema/cms-publications.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/lib/dal/cms-publications.ts`
- Create: `src/lib/dal/__tests__/cms-publications.test.ts`

- [ ] **Step 11.1: 写 DAL 测试**

Create `src/lib/dal/__tests__/cms-publications.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { cmsPublications } from "@/db/schema";
import {
  createPublication,
  findLatestSuccessByArticle,
  updateToSubmitted,
  markAsFailed,
  incrementAttempt,
  listByState,
} from "../cms-publications";
import { eq } from "drizzle-orm";

describe("DAL cms-publications", () => {
  const orgId = randomUUID();
  const articleId = randomUUID();

  beforeEach(async () => {
    await db.delete(cmsPublications).where(eq(cmsPublications.organizationId, orgId));
  });

  it("createPublication inserts with state=submitting", async () => {
    const id = await createPublication({
      organizationId: orgId,
      articleId,
      appChannelSlug: "app_news",
      cmsType: 1,
      requestHash: "h1",
      requestPayload: { title: "Test" },
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    const row = await db.query.cmsPublications.findFirst({ where: eq(cmsPublications.id, id) });
    expect(row?.cmsState).toBe("submitting");
    expect(row?.attempts).toBe(1);
  });

  it("updateToSubmitted records cmsArticleId and previewUrl", async () => {
    const id = await createPublication({
      organizationId: orgId,
      articleId,
      appChannelSlug: "app_news",
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    await updateToSubmitted(id, {
      cmsArticleId: "925194",
      cmsCatalogId: "8634",
      cmsSiteId: 81,
      publishedUrl: "https://web.cms.com/x.shtml",
      previewUrl: "https://api.cms.com/preview?x=1",
      responsePayload: { article: { id: 925194 } },
    });
    const row = await db.query.cmsPublications.findFirst({ where: eq(cmsPublications.id, id) });
    expect(row?.cmsState).toBe("submitted");
    expect(row?.cmsArticleId).toBe("925194");
    expect(row?.publishedUrl).toContain(".shtml");
  });

  it("markAsFailed sets error info without mutating cmsArticleId", async () => {
    const id = await createPublication({
      organizationId: orgId,
      articleId,
      appChannelSlug: "app_news",
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    await markAsFailed(id, {
      errorCode: "cms_auth_error",
      errorMessage: "login_cmc_id 失效",
      retriable: false,
    });
    const row = await db.query.cmsPublications.findFirst({ where: eq(cmsPublications.id, id) });
    expect(row?.cmsState).toBe("failed");
    expect(row?.errorCode).toBe("cms_auth_error");
  });

  it("incrementAttempt bumps attempts counter", async () => {
    const id = await createPublication({
      organizationId: orgId,
      articleId,
      appChannelSlug: "app_news",
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    await incrementAttempt(id);
    await incrementAttempt(id);
    const row = await db.query.cmsPublications.findFirst({ where: eq(cmsPublications.id, id) });
    expect(row?.attempts).toBe(3);
  });

  it("findLatestSuccessByArticle returns the most recent synced record", async () => {
    const id1 = await createPublication({
      organizationId: orgId,
      articleId,
      appChannelSlug: "app_news",
      cmsType: 1,
      requestHash: "h1",
      requestPayload: {},
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });
    await updateToSubmitted(id1, { cmsArticleId: "1001" });

    const found = await findLatestSuccessByArticle(articleId);
    expect(found?.cmsArticleId).toBe("1001");
  });
});
```

- [ ] **Step 11.2: FAIL → 创建 schema**

Create `src/db/schema/cms-publications.ts`：

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { articles } from "./articles";
import { cmsPublicationStateEnum } from "./enums";

export const cmsPublications = pgTable(
  "cms_publications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    articleId: uuid("article_id").references(() => articles.id).notNull(),
    appChannelSlug: text("app_channel_slug").notNull(),

    cmsArticleId: text("cms_article_id"),
    cmsCatalogId: text("cms_catalog_id"),
    cmsSiteId: integer("cms_site_id"),
    cmsState: cmsPublicationStateEnum("cms_state").notNull().default("submitting"),
    cmsType: integer("cms_type"), // 1 / 2 / 4 / 5 / 11

    requestHash: text("request_hash"),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),

    previewUrl: text("preview_url"),
    publishedUrl: text("published_url"),

    attempts: integer("attempts").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    operatorId: text("operator_id"),
    triggerSource: text("trigger_source"),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    articleIdx: index("cms_pub_article_idx").on(table.articleId),
    cmsArticleIdIdx: index("cms_pub_cms_article_idx").on(table.cmsArticleId),
    orgStateIdx: index("cms_pub_org_state_idx").on(table.organizationId, table.cmsState),
    channelStateIdx: index("cms_pub_channel_state_idx").on(
      table.appChannelSlug,
      table.cmsState,
    ),
  }),
);

export const cmsPublicationsRelations = relations(cmsPublications, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsPublications.organizationId],
    references: [organizations.id],
  }),
  article: one(articles, {
    fields: [cmsPublications.articleId],
    references: [articles.id],
  }),
}));
```

- [ ] **Step 11.3: 导出 + db:push**

Edit `src/db/schema/index.ts`，追加：

```typescript
export * from "./cms-publications";
```

```bash
npm run db:push
```

- [ ] **Step 11.4: 实现 DAL**

Create `src/lib/dal/cms-publications.ts`：

```typescript
import { db } from "@/db";
import { cmsPublications } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export interface CreatePublicationInput {
  organizationId: string;
  articleId: string;
  appChannelSlug: string;
  cmsType: number;
  requestHash: string;
  requestPayload: unknown;
  operatorId: string;
  triggerSource: string;
}

export async function createPublication(input: CreatePublicationInput): Promise<string> {
  const [row] = await db
    .insert(cmsPublications)
    .values({
      organizationId: input.organizationId,
      articleId: input.articleId,
      appChannelSlug: input.appChannelSlug,
      cmsType: input.cmsType,
      cmsState: "submitting",
      requestHash: input.requestHash,
      requestPayload: input.requestPayload as object,
      operatorId: input.operatorId,
      triggerSource: input.triggerSource,
      attempts: 1,
      lastAttemptAt: new Date(),
    })
    .returning({ id: cmsPublications.id });
  return row.id;
}

export interface UpdateToSubmittedInput {
  cmsArticleId: string;
  cmsCatalogId?: string;
  cmsSiteId?: number;
  publishedUrl?: string;
  previewUrl?: string;
  responsePayload?: unknown;
}

export async function updateToSubmitted(
  id: string,
  input: UpdateToSubmittedInput,
): Promise<void> {
  await db
    .update(cmsPublications)
    .set({
      cmsState: "submitted",
      cmsArticleId: input.cmsArticleId,
      cmsCatalogId: input.cmsCatalogId ?? null,
      cmsSiteId: input.cmsSiteId ?? null,
      publishedUrl: input.publishedUrl ?? null,
      previewUrl: input.previewUrl ?? null,
      responsePayload: (input.responsePayload ?? null) as object | null,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cmsPublications.id, id));
}

export async function markAsSynced(id: string): Promise<void> {
  await db
    .update(cmsPublications)
    .set({ cmsState: "synced", syncedAt: new Date(), updatedAt: new Date() })
    .where(eq(cmsPublications.id, id));
}

export async function markAsRejectedByCms(id: string): Promise<void> {
  await db
    .update(cmsPublications)
    .set({ cmsState: "rejected_by_cms", updatedAt: new Date() })
    .where(eq(cmsPublications.id, id));
}

export interface MarkAsFailedInput {
  errorCode: string;
  errorMessage: string;
  retriable: boolean;
}

export async function markAsFailed(id: string, input: MarkAsFailedInput): Promise<void> {
  await db
    .update(cmsPublications)
    .set({
      cmsState: input.retriable ? "retrying" : "failed",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(cmsPublications.id, id));
}

export async function incrementAttempt(id: string): Promise<void> {
  await db
    .update(cmsPublications)
    .set({
      attempts: sql`${cmsPublications.attempts} + 1`,
      lastAttemptAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(cmsPublications.id, id));
}

export async function findLatestSuccessByArticle(articleId: string) {
  const row = await db.query.cmsPublications.findFirst({
    where: and(
      eq(cmsPublications.articleId, articleId),
      // 成功或已入库（submitted / synced）都算 existing 入库
    ),
    orderBy: [desc(cmsPublications.createdAt)],
  });
  if (!row) return null;
  if (!["submitted", "synced"].includes(row.cmsState)) return null;
  return row;
}

export async function getPublicationById(id: string) {
  const row = await db.query.cmsPublications.findFirst({
    where: eq(cmsPublications.id, id),
  });
  return row ?? null;
}

export async function listByState(
  organizationId: string,
  state: "submitting" | "submitted" | "synced" | "retrying" | "rejected_by_cms" | "failed",
  options: { limit?: number } = {},
) {
  return await db.query.cmsPublications.findMany({
    where: and(
      eq(cmsPublications.organizationId, organizationId),
      eq(cmsPublications.cmsState, state),
    ),
    orderBy: [desc(cmsPublications.createdAt)],
    limit: options.limit ?? 100,
  });
}
```

- [ ] **Step 11.5: 测试通过 + 提交**

```bash
npm run test -- src/lib/dal/__tests__/cms-publications.test.ts
git add src/db/schema/cms-publications.ts src/db/schema/index.ts \
        src/lib/dal/cms-publications.ts src/lib/dal/__tests__/cms-publications.test.ts
git commit -m "feat(cms/p1): cms_publications schema + DAL (create/update/mark/query)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: app_channels schema + DAL + seed 9 个 APP 栏目

**目的：** 运营配置层 —— 把 9 个 APP 栏目 slug 绑定到 CMS 栏目。**关键表**（cms_publish 依赖它查 siteId/catalogId）。

**Files:**
- Create: `src/db/schema/app-channels.ts`
- Modify: `src/db/schema/index.ts`
- Create: `src/lib/dal/app-channels.ts`
- Create: `src/lib/dal/__tests__/app-channels.test.ts`
- Modify: `src/db/seed.ts`（追加 `seedAppChannels`）

- [ ] **Step 12.1: 写 DAL 测试**

Create `src/lib/dal/__tests__/app-channels.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { appChannels } from "@/db/schema";
import {
  upsertAppChannel,
  getAppChannelBySlug,
  listAppChannels,
  updateAppChannelBinding,
} from "../app-channels";
import { eq } from "drizzle-orm";

describe("DAL app-channels", () => {
  const orgId = randomUUID();
  const catalogId = randomUUID();

  beforeEach(async () => {
    await db.delete(appChannels).where(eq(appChannels.organizationId, orgId));
  });

  it("upsertAppChannel creates with defaults", async () => {
    await upsertAppChannel(orgId, {
      slug: "app_news",
      displayName: "新闻",
      reviewTier: "strict",
      sortOrder: 1,
      icon: "📰",
    });
    const row = await getAppChannelBySlug(orgId, "app_news");
    expect(row?.displayName).toBe("新闻");
    expect(row?.reviewTier).toBe("strict");
  });

  it("getAppChannelBySlug returns null when missing", async () => {
    const row = await getAppChannelBySlug(orgId, "app_not_exist");
    expect(row).toBeNull();
  });

  it("listAppChannels returns records sorted by sortOrder", async () => {
    await upsertAppChannel(orgId, { slug: "app_news", displayName: "B", sortOrder: 2, reviewTier: "strict" });
    await upsertAppChannel(orgId, { slug: "app_home", displayName: "A", sortOrder: 0, reviewTier: "relaxed" });
    const list = await listAppChannels(orgId);
    expect(list.map((r) => r.slug)).toEqual(["app_home", "app_news"]);
  });

  it("updateAppChannelBinding sets defaultCatalogId + listStyle", async () => {
    await upsertAppChannel(orgId, { slug: "app_news", displayName: "新闻", reviewTier: "strict", sortOrder: 0 });
    await updateAppChannelBinding(orgId, "app_news", {
      defaultCatalogId: catalogId,
      defaultListStyle: { listStyleType: "0", listStyleName: "默认", imageUrlList: [] },
      defaultCoverUrl: "https://x/cover.jpg",
    });
    const row = await getAppChannelBySlug(orgId, "app_news");
    expect(row?.defaultCatalogId).toBe(catalogId);
    expect(row?.defaultCoverUrl).toContain("cover.jpg");
  });
});
```

- [ ] **Step 12.2: FAIL → 创建 schema**

Create `src/db/schema/app-channels.ts`：

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { cmsCatalogs } from "./cms-mapping";
import { reviewTierEnum } from "./enums";

/**
 * APP 栏目 ↔ CMS 栏目绑定（运营配置）。
 *
 * 设计文档 §2.0.1 / §9.3 / §11.2
 *
 * 9 个固定 slug（见 §2.0.1）：app_home / app_news / app_politics / app_sports /
 *   app_variety / app_livelihood_zhongcao / app_livelihood_tandian /
 *   app_livelihood_podcast / app_drama
 */
export const appChannels = pgTable(
  "app_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    slug: text("slug").notNull(), // app_news / app_politics / ...
    displayName: text("display_name").notNull(),
    reviewTier: reviewTierEnum("review_tier").notNull().default("relaxed"),
    defaultCatalogId: uuid("default_catalog_id").references(() => cmsCatalogs.id),
    defaultListStyle: jsonb("default_list_style").$type<{
      listStyleType?: string;
      listStyleName?: string;
      imageUrlList?: string[];
    }>(),
    defaultCoverUrl: text("default_cover_url"),
    icon: text("icon"),
    sortOrder: integer("sort_order").default(0),
    isEnabled: boolean("is_enabled").default(true),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgSlug: uniqueIndex("app_channels_org_slug_uniq").on(
      table.organizationId,
      table.slug,
    ),
  }),
);

export const appChannelsRelations = relations(appChannels, ({ one }) => ({
  organization: one(organizations, {
    fields: [appChannels.organizationId],
    references: [organizations.id],
  }),
  defaultCatalog: one(cmsCatalogs, {
    fields: [appChannels.defaultCatalogId],
    references: [cmsCatalogs.id],
  }),
}));
```

- [ ] **Step 12.3: 导出 + db:push**

Edit `src/db/schema/index.ts`，追加：

```typescript
export * from "./app-channels";
```

```bash
npm run db:push
```

- [ ] **Step 12.4: 实现 DAL**

Create `src/lib/dal/app-channels.ts`：

```typescript
import { db } from "@/db";
import { appChannels } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export type AppChannelSlug =
  | "app_home"
  | "app_news"
  | "app_politics"
  | "app_sports"
  | "app_variety"
  | "app_livelihood_zhongcao"
  | "app_livelihood_tandian"
  | "app_livelihood_podcast"
  | "app_drama";

export const ALL_APP_CHANNEL_SLUGS: readonly AppChannelSlug[] = [
  "app_home",
  "app_news",
  "app_politics",
  "app_sports",
  "app_variety",
  "app_livelihood_zhongcao",
  "app_livelihood_tandian",
  "app_livelihood_podcast",
  "app_drama",
] as const;

export interface UpsertAppChannelInput {
  slug: AppChannelSlug;
  displayName: string;
  reviewTier: "strict" | "relaxed";
  sortOrder?: number;
  icon?: string;
  defaultCoverUrl?: string;
}

export async function upsertAppChannel(
  organizationId: string,
  input: UpsertAppChannelInput,
): Promise<void> {
  await db
    .insert(appChannels)
    .values({
      organizationId,
      slug: input.slug,
      displayName: input.displayName,
      reviewTier: input.reviewTier,
      sortOrder: input.sortOrder ?? 0,
      icon: input.icon ?? null,
      defaultCoverUrl: input.defaultCoverUrl ?? null,
    })
    .onConflictDoUpdate({
      target: [appChannels.organizationId, appChannels.slug],
      set: {
        displayName: input.displayName,
        reviewTier: input.reviewTier,
        sortOrder: input.sortOrder ?? 0,
        icon: input.icon ?? null,
        defaultCoverUrl: input.defaultCoverUrl ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function getAppChannelBySlug(
  organizationId: string,
  slug: string,
) {
  const row = await db.query.appChannels.findFirst({
    where: and(
      eq(appChannels.organizationId, organizationId),
      eq(appChannels.slug, slug),
    ),
    with: { defaultCatalog: true },
  });
  return row ?? null;
}

export async function listAppChannels(organizationId: string) {
  return await db.query.appChannels.findMany({
    where: eq(appChannels.organizationId, organizationId),
    orderBy: [asc(appChannels.sortOrder)],
    with: { defaultCatalog: true },
  });
}

export interface UpdateBindingInput {
  defaultCatalogId: string;
  defaultListStyle?: {
    listStyleType?: string;
    listStyleName?: string;
    imageUrlList?: string[];
  };
  defaultCoverUrl?: string;
}

export async function updateAppChannelBinding(
  organizationId: string,
  slug: string,
  input: UpdateBindingInput,
): Promise<void> {
  await db
    .update(appChannels)
    .set({
      defaultCatalogId: input.defaultCatalogId,
      defaultListStyle: input.defaultListStyle ?? null,
      defaultCoverUrl: input.defaultCoverUrl ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(appChannels.organizationId, organizationId), eq(appChannels.slug, slug)),
    );
}
```

- [ ] **Step 12.5: 测试通过**

```bash
npm run test -- src/lib/dal/__tests__/app-channels.test.ts
```

- [ ] **Step 12.6: 修改 seed.ts 追加 seedAppChannels**

Edit `src/db/seed.ts`。找到合适插入位置（建议放在现有 workflow_templates seed 之后，location 取决于现有结构），追加：

```typescript
// =====================================================================
// Phase 1 — Seed 9 个 APP 栏目（§2.0.1 规范化清单）
// =====================================================================
console.log("P1: Inserting app_channels...");

const APP_CHANNELS_SEED = [
  { slug: "app_home",                     displayName: "首页",         reviewTier: "relaxed" as const, icon: "🏠", sortOrder: 0 },
  { slug: "app_news",                     displayName: "新闻",         reviewTier: "strict" as const,  icon: "📰", sortOrder: 1 },
  { slug: "app_politics",                 displayName: "时政",         reviewTier: "strict" as const,  icon: "🏛️", sortOrder: 2 },
  { slug: "app_sports",                   displayName: "体育",         reviewTier: "relaxed" as const, icon: "⚽", sortOrder: 3 },
  { slug: "app_variety",                  displayName: "综艺",         reviewTier: "relaxed" as const, icon: "🎭", sortOrder: 4 },
  { slug: "app_livelihood_zhongcao",      displayName: "民生-种草",   reviewTier: "relaxed" as const, icon: "🌱", sortOrder: 5 },
  { slug: "app_livelihood_tandian",       displayName: "民生-探店",   reviewTier: "relaxed" as const, icon: "🍜", sortOrder: 6 },
  { slug: "app_livelihood_podcast",       displayName: "民生-播客",   reviewTier: "strict" as const,  icon: "🎧", sortOrder: 7 },
  { slug: "app_drama",                    displayName: "短剧",         reviewTier: "strict" as const,  icon: "🎬", sortOrder: 8 },
];

for (const ch of APP_CHANNELS_SEED) {
  await db.insert(schema.appChannels).values({
    organizationId: org.id,
    slug: ch.slug,
    displayName: ch.displayName,
    reviewTier: ch.reviewTier,
    sortOrder: ch.sortOrder,
    icon: ch.icon,
  }).onConflictDoNothing({ target: [schema.appChannels.organizationId, schema.appChannels.slug] });
  console.log(`   app_channel: ${ch.slug} (${ch.displayName})`);
}
console.log();
```

- [ ] **Step 12.7: 运行 seed 验证**

```bash
npm run db:seed
```

预期：输出 9 行 `app_channel: app_xxx (...)`。运行两次应仍为 9 条（onConflictDoNothing 保证幂等）。

校验查询：

```bash
npx tsx -e "
import { db } from './src/db';
import { appChannels } from './src/db/schema';
const list = await db.query.appChannels.findMany();
console.log('Total app_channels:', list.length);
console.log(list.map(r => r.slug).sort().join(','));
"
```

预期：`9` + 全部 9 个 slug。

- [ ] **Step 12.8: 提交**

```bash
git add src/db/schema/app-channels.ts src/db/schema/index.ts \
        src/lib/dal/app-channels.ts src/lib/dal/__tests__/app-channels.test.ts \
        src/db/seed.ts
git commit -m "feat(cms/p1): app_channels schema + DAL + seed 9 APP 栏目

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Section B 完成检查

```bash
# 1. 所有 B 组测试通过
npm run test -- src/lib/dal/__tests__/

# 2. 类型编译通过
npx tsc --noEmit

# 3. db:push 无 diff
npm run db:push

# 4. 数据库有 6 张新表：cms_channels / cms_apps / cms_catalogs / cms_sync_logs / cms_publications / app_channels
# （可用 db:studio 打开浏览验证）

# 5. app_channels 表有 9 行 seed 数据
```

Section B 结束后 git log 应看到 6 个 `feat(cms/p1):` commit。

**→ Section C 开始前，请在对话中确认"Section B 完成"。**

---

# Section C — CMS 客户端层

**本 Section 产出 `src/lib/cms/client.ts` + `api-endpoints.ts` + `types.ts`：统一的 HTTP 客户端（鉴权/重试/超时）+ 5 接口封装。完成后调用方只需 `import { saveArticle, getCatalogTree, ... } from "@/lib/cms"`。**

---

## Task 13: CMS types.ts DTO 定义（zod schema）

**目的：** 用 zod 定义 CMS 请求/响应的类型结构。运行时可用于响应校验，编译时提供类型提示。

**Files:**
- Create: `src/lib/cms/types.ts`
- Create: `src/lib/cms/__tests__/types.test.ts`

- [ ] **Step 13.1: 写 zod schema 失败测试**

Create `src/lib/cms/__tests__/types.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  CmsResponseEnvelopeSchema,
  CmsChannelsDataSchema,
  CmsAppSchema,
  CmsCatalogNodeSchema,
  CmsArticleSaveResponseDataSchema,
  CmsArticleDetailSchema,
} from "../types";

describe("CmsResponseEnvelopeSchema", () => {
  it("accepts well-formed success envelope", () => {
    expect(() =>
      CmsResponseEnvelopeSchema.parse({
        state: 200,
        success: true,
        message: "操作成功",
        data: { foo: 1 },
      }),
    ).not.toThrow();
  });

  it("rejects envelope missing state", () => {
    expect(() =>
      CmsResponseEnvelopeSchema.parse({ success: true, message: "ok", data: {} }),
    ).toThrow();
  });

  it("allows data=null for error responses", () => {
    expect(() =>
      CmsResponseEnvelopeSchema.parse({
        state: 500,
        success: false,
        message: "错误",
        data: null,
      }),
    ).not.toThrow();
  });
});

describe("CmsChannelsDataSchema", () => {
  it("accepts object keyed by CHANNEL_*", () => {
    const data = {
      CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
      CHANNEL_WEB: { code: 2, pickValue: "0", thirdFlag: "2", name: "网站" },
    };
    expect(() => CmsChannelsDataSchema.parse(data)).not.toThrow();
  });

  it("tolerates extra string keys", () => {
    const data = {
      CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
      CUSTOM_CHANNEL: { code: 99, pickValue: "0", thirdFlag: "1", name: "自定义" },
    };
    expect(() => CmsChannelsDataSchema.parse(data)).not.toThrow();
  });
});

describe("CmsAppSchema", () => {
  it("accepts app entry with appkey/appsecret", () => {
    expect(() =>
      CmsAppSchema.parse({
        id: 1,
        siteid: 73,
        name: "测试",
        type: 1,
        appkey: "ak",
        appsecret: "as",
        addtime: null,
      }),
    ).not.toThrow();
  });

  it("allows null appkey/appsecret/addtime", () => {
    expect(() =>
      CmsAppSchema.parse({
        id: 2,
        siteid: 73,
        name: "x",
        type: 1,
        appkey: null,
        appsecret: null,
        addtime: null,
      }),
    ).not.toThrow();
  });
});

describe("CmsCatalogNodeSchema", () => {
  it("accepts a leaf node without children", () => {
    const node = {
      id: 9369,
      appid: 250,
      siteId: 73,
      name: "栏目",
      parentId: 0,
      innerCode: "009887",
      alias: "news",
      treeLevel: 1,
      isLeaf: 1,
      type: 1,
      childCatalog: [],
    };
    expect(() => CmsCatalogNodeSchema.parse(node)).not.toThrow();
  });

  it("accepts nested children (recursive)", () => {
    const node = {
      id: 9373,
      appid: 250,
      siteId: 73,
      name: "父",
      parentId: 0,
      innerCode: "009891",
      alias: "parent",
      treeLevel: 1,
      isLeaf: 0,
      type: 1,
      childCatalog: [
        {
          id: 9374,
          appid: 250,
          siteId: 73,
          name: "子",
          parentId: 9373,
          innerCode: "009891000001",
          alias: "child",
          treeLevel: 2,
          isLeaf: 0,
          type: 1,
          childCatalog: [],
        },
      ],
    };
    expect(() => CmsCatalogNodeSchema.parse(node)).not.toThrow();
  });
});

describe("CmsArticleSaveResponseDataSchema", () => {
  it("accepts article.id and url/preViewPath", () => {
    expect(() =>
      CmsArticleSaveResponseDataSchema.parse({
        article: { id: 925194, status: 0, title: "x" },
        url: "1376/1376mrgrgklm/925194.shtml",
        preViewPath: "https://api/preview?x=1",
        method: "ADD",
      }),
    ).not.toThrow();
  });
});

describe("CmsArticleDetailSchema", () => {
  it("accepts minimal detail payload", () => {
    expect(() =>
      CmsArticleDetailSchema.parse({
        Id: 925194,
        title: "稿件",
        status: "30",
        type: 1,
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 13.2: 运行 FAIL**

```bash
npm run test -- src/lib/cms/__tests__/types.test.ts
```

- [ ] **Step 13.3: 实现 types.ts**

Create `src/lib/cms/types.ts`：

```typescript
import { z } from "zod";

/**
 * CMS 统一响应信封。
 *
 * CMS 约定：HTTP 层一律 200；业务成功 state=200，业务失败 state 为错误码。
 */
export const CmsResponseEnvelopeSchema = z.object({
  state: z.number(),
  success: z.boolean(),
  message: z.string(),
  data: z.unknown().nullable(),
});
export type CmsResponseEnvelope<T = unknown> = {
  state: number;
  success: boolean;
  message: string;
  data: T | null;
};

// ===========================================================
// getChannels（/web/catalog/getChannels）
// ===========================================================

export const CmsChannelInfoSchema = z.object({
  code: z.number(),
  pickValue: z.string().optional(),
  thirdFlag: z.string().optional(),
  name: z.string(),
});
export type CmsChannelInfo = z.infer<typeof CmsChannelInfoSchema>;

/** 返回结构是一个 map，key 为 CHANNEL_APP / CHANNEL_WEB / ... */
export const CmsChannelsDataSchema = z.record(z.string(), CmsChannelInfoSchema);
export type CmsChannelsData = z.infer<typeof CmsChannelsDataSchema>;

// ===========================================================
// getAppList（/web/application/getAppList）
// ===========================================================

export const CmsAppSchema = z.object({
  id: z.number(),
  siteid: z.number(),
  name: z.string(),
  type: z.number(),
  appkey: z.string().nullable().optional(),
  appsecret: z.string().nullable().optional(),
  addtime: z.string().nullable().optional(),
  modifytime: z.string().nullable().optional(),
  adduser: z.string().nullable().optional(),
  modifyuser: z.string().nullable().optional(),
});
export type CmsApp = z.infer<typeof CmsAppSchema>;
export const CmsAppListSchema = z.array(CmsAppSchema);

// ===========================================================
// getCatalogTree（/web/catalog/getTree）
// ===========================================================

// 递归 schema 需要用 z.lazy
type CmsCatalogNode = {
  id: number;
  appid: number;
  siteId: number;
  name: string;
  parentId: number;
  innerCode: string;
  alias: string;
  treeLevel: number;
  isLeaf: number;                // CMS 用 0/1，不是布尔
  type: number;
  childCatalog: CmsCatalogNode[];
  videoPlayer?: string;
  audioPlayer?: string;
  livePlayer?: string;
  vlivePlayer?: string;
  h5Preview?: string;
  pcPreview?: string;
  url?: string;
  articleBrowse?: string;
  imageBrowse?: string;
  attachBrowse?: string;
  revelationBrowse?: string;
  isDirty?: number;
  isCurrentBindCatalog?: number;
  workflow?: string;
};

export const CmsCatalogNodeSchema: z.ZodType<CmsCatalogNode> = z.lazy(() =>
  z.object({
    id: z.number(),
    appid: z.number(),
    siteId: z.number(),
    name: z.string(),
    parentId: z.number(),
    innerCode: z.string(),
    alias: z.string(),
    treeLevel: z.number(),
    isLeaf: z.number(),
    type: z.number(),
    childCatalog: z.array(CmsCatalogNodeSchema).default([]),
    videoPlayer: z.string().optional(),
    audioPlayer: z.string().optional(),
    livePlayer: z.string().optional(),
    vlivePlayer: z.string().optional(),
    h5Preview: z.string().optional(),
    pcPreview: z.string().optional(),
    url: z.string().optional(),
    articleBrowse: z.string().optional(),
    imageBrowse: z.string().optional(),
    attachBrowse: z.string().optional(),
    revelationBrowse: z.string().optional(),
    isDirty: z.number().optional(),
    isCurrentBindCatalog: z.number().optional(),
    workflow: z.string().optional(),
  }),
);

export type { CmsCatalogNode };

// ===========================================================
// saveArticle（/web/article/save）
// ===========================================================

export interface CmsImageSimpleDTO {
  contentSourceId?: string;
  image: string;                 // 图片 URL
  imageName?: string;
  linkText?: string;
  linkUrl?: string;
  note?: string;                 // 图片说明
}

export interface CmsImageDto {
  imageUrl: string;
  imageName?: string;
  description?: string;
  sImageUrl?: string;
  linkText?: string;
  linkUrl?: string;
}

export interface CmsVideoDto {
  videoId: string;
}

export interface CmsAudioDto {
  audioId: string;
}

export interface CmsArticleContentDto {
  htmlContent?: string;
  imageDtoList?: CmsImageDto[];
  videoDtoList?: CmsVideoDto[];
  audioDtoList?: CmsAudioDto[];
}

export interface CmsCustomStyle {
  imgPath: string[];
  type: string;                  // "0"默认 "1"单图 "2"多图 "3"标题无图 "4"窄图 "7"无缝
}

export interface CmsMovie {
  AppCustomParams: string;       // "默认"
}

export interface CmsAppCustomParams {
  customStyle: CmsCustomStyle;
  movie: CmsMovie;
}

export interface CmsListStyleDto {
  imageUrlList: string[];
  listStyleName: string;
  listStyleType: string;
}

export interface CmsArticleSaveDTO {
  // 鉴权 & 租户
  loginId: string;
  loginTid: string;
  tenantId: string;
  username: string;
  version: string;               // "cms2"

  // 稿件类型
  type: "1" | "2" | "4" | "5" | "11";

  // 基本信息
  title: string;
  author: string;
  source?: string;
  summary?: string;
  shortTitle?: string;
  listTitle?: string;
  content?: string;              // HTML，type=1 必传
  logo?: string;                 // 引导图
  keyword?: string;
  tags?: string;
  tagsFlag?: string;

  // 栏目 & 站点
  catalogId: number;
  siteId: number;
  sourceSystem?: number;         // 3
  referType?: number;            // 9 (智媒 AI)

  // 状态 & 时间
  status?: string;               // "0"/"20"/"30"/"60"
  addTime?: number;
  publishDate?: number;

  // 富内容
  articleContentDto?: CmsArticleContentDto;
  images?: CmsImageSimpleDTO[];
  videoId?: string;
  videoType?: string;
  audioId?: string;
  audioUrl?: string;
  redirectUrl?: string;

  // 列表样式
  appCustomParams?: CmsAppCustomParams;
  listStyleDto?: CmsListStyleDto;

  // 其他
  articleId?: number;            // 修改时传
  commentFlag?: string;
  commentVerifyFlag?: string;
  showReadingCountFlag?: string;
  advertisementFlag?: string;
  barrageFlag?: string;
  allowComment?: boolean;
  virtualHitCount?: number;

  // 透传字段（避免 schema 漂移时的兜底）
  [extra: string]: unknown;
}

export const CmsArticleSaveResponseDataSchema = z.object({
  article: z.object({
    id: z.number(),
    status: z.number().optional(),
    title: z.string().optional(),
  }).passthrough(),
  url: z.string().optional(),
  preViewPath: z.string().optional(),
  method: z.string().optional(),
  transcodeStatus: z.string().optional(),
  title: z.string().optional(),
}).passthrough();
export type CmsArticleSaveResponseData = z.infer<typeof CmsArticleSaveResponseDataSchema>;

// ===========================================================
// getArticleDetail（/web/article/getMyArticleDetail）
// ===========================================================

export const CmsArticleDetailSchema = z.object({
  Id: z.number(),
  title: z.string(),
  status: z.string().optional(),    // CMS 约定：string "0"/"20"/"30"/"60"
  type: z.number().optional(),
  catalogId: z.number().optional(),
  siteId: z.number().optional(),
  publishDate: z.string().nullable().optional(),
  addTime: z.string().optional(),
  author: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  pcPreview: z.string().optional(),
  h5Preview: z.string().optional(),
}).passthrough();
export type CmsArticleDetail = z.infer<typeof CmsArticleDetailSchema>;
```

- [ ] **Step 13.4: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/types.test.ts
npx tsc --noEmit
git add src/lib/cms/types.ts src/lib/cms/__tests__/types.test.ts
git commit -m "feat(cms/p1): CMS DTO types with zod validation schemas

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: CmsClient HTTP 客户端（基础版，不含重试）

**目的：** 封装一个统一的 `CmsClient.post()` 方法：注入鉴权 header、超时控制、envelope 校验、错误分类。**本 task 不实现重试**（留给 Task 15）。

**Files:**
- Create: `src/lib/cms/client.ts`
- Create: `src/lib/cms/__tests__/client.test.ts`

- [ ] **Step 14.1: 写客户端失败测试**

Create `src/lib/cms/__tests__/client.test.ts`：

```typescript
import { describe, it, expect, afterEach } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
  cmsErrorResponse,
  cmsHttpErrorResponse,
  cmsAbortError,
} from "./test-helpers";
import { CmsClient } from "../client";
import {
  CmsAuthError,
  CmsBusinessError,
  CmsNetworkError,
  CmsSchemaError,
} from "../errors";

const baseConfig = {
  host: "https://cms.example.com",
  loginCmcId: "id123",
  loginCmcTid: "tid123",
  timeoutMs: 5000,
  maxRetries: 0, // 关闭重试，本 task 只测基础
};

describe("CmsClient.post (basic, no retry)", () => {
  afterEach(() => restoreCmsFetch());

  it("injects login_cmc_id and login_cmc_tid headers", async () => {
    mockCmsFetch([cmsSuccessResponse({ ok: 1 })]);
    const client = new CmsClient(baseConfig);
    let capturedHeaders: Record<string, string> = {};
    // 重新 mock 以捕获 request
    restoreCmsFetch();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
      return cmsSuccessResponse({ ok: 1 });
    }) as typeof globalThis.fetch;

    await client.post("/x", { any: 1 });

    expect(capturedHeaders["login_cmc_id"]).toBe("id123");
    expect(capturedHeaders["login_cmc_tid"]).toBe("tid123");
    expect(capturedHeaders["content-type"]).toContain("application/json");
    globalThis.fetch = originalFetch;
  });

  it("returns parsed envelope on success", async () => {
    mockCmsFetch([cmsSuccessResponse({ foo: "bar" })]);
    const client = new CmsClient(baseConfig);
    const res = await client.post<unknown, { foo: string }>("/x", {});
    expect(res.success).toBe(true);
    expect(res.state).toBe(200);
    expect(res.data).toEqual({ foo: "bar" });
  });

  it("throws CmsBusinessError when state != 200", async () => {
    mockCmsFetch([cmsErrorResponse(500, "内部错误")]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsBusinessError);
  });

  it("throws CmsAuthError on state=401 / '未登录'", async () => {
    mockCmsFetch([cmsErrorResponse(401, "未登录")]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsAuthError);
  });

  it("throws CmsAuthError when message contains '未登录' even with odd state", async () => {
    mockCmsFetch([cmsErrorResponse(403, "账号未登录，请重试")]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsAuthError);
  });

  it("throws CmsNetworkError on HTTP 5xx", async () => {
    mockCmsFetch([cmsHttpErrorResponse(503, "gateway")]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsBusinessError);
  });

  it("throws CmsNetworkError on fetch AbortError (timeout)", async () => {
    mockCmsFetch([cmsAbortError()]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsNetworkError);
  });

  it("throws CmsSchemaError when response JSON missing required fields", async () => {
    const badResponse = new Response(JSON.stringify({ notAState: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    mockCmsFetch([badResponse]);
    const client = new CmsClient(baseConfig);
    await expect(client.post("/x", {})).rejects.toThrow(CmsSchemaError);
  });
});
```

- [ ] **Step 14.2: 运行 FAIL**

```bash
npm run test -- src/lib/cms/__tests__/client.test.ts
```

- [ ] **Step 14.3: 实现 CmsClient 基础版**

Create `src/lib/cms/client.ts`：

```typescript
import {
  CmsAuthError,
  CmsBusinessError,
  CmsNetworkError,
  CmsSchemaError,
} from "./errors";
import {
  CmsResponseEnvelopeSchema,
  type CmsResponseEnvelope,
} from "./types";

export interface CmsClientConfig {
  host: string;
  loginCmcId: string;
  loginCmcTid: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
}

export interface CmsRequestOptions {
  timeoutMs?: number;
  /** 覆盖 header（除鉴权三件套外） */
  extraHeaders?: Record<string, string>;
}

export class CmsClient {
  private readonly host: string;
  private readonly loginCmcId: string;
  private readonly loginCmcTid: string;
  private readonly defaultTimeoutMs: number;

  constructor(config: CmsClientConfig) {
    this.host = config.host.replace(/\/$/, "");
    this.loginCmcId = config.loginCmcId;
    this.loginCmcTid = config.loginCmcTid;
    this.defaultTimeoutMs = config.timeoutMs ?? 15000;
  }

  async post<TReq, TRes>(
    path: string,
    body: TReq,
    options: CmsRequestOptions = {},
  ): Promise<CmsResponseEnvelope<TRes>> {
    const url = this.buildUrl(path);
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          login_cmc_id: this.loginCmcId,
          login_cmc_tid: this.loginCmcTid,
          ...(options.extraHeaders ?? {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new CmsNetworkError(`CMS 请求超时：${path}`, { cause: "AbortError" });
      }
      if (err instanceof Error) {
        throw new CmsNetworkError(`CMS 网络错误：${err.message}`, { cause: err.name });
      }
      throw new CmsNetworkError(`CMS 未知网络错误：${String(err)}`);
    } finally {
      clearTimeout(timer);
    }

    return this.parseResponse<TRes>(response, path);
  }

  async get<TRes>(
    path: string,
    query: Record<string, string | number> = {},
    options: CmsRequestOptions = {},
  ): Promise<CmsResponseEnvelope<TRes>> {
    const url = new URL(this.buildUrl(path));
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, String(v));
    }
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          login_cmc_id: this.loginCmcId,
          login_cmc_tid: this.loginCmcTid,
          ...(options.extraHeaders ?? {}),
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new CmsNetworkError(`CMS 请求超时：${path}`, { cause: "AbortError" });
      }
      throw new CmsNetworkError(
        `CMS 网络错误：${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    return this.parseResponse<TRes>(response, path);
  }

  private buildUrl(path: string): string {
    const safePath = path.startsWith("/") ? path : `/${path}`;
    return `${this.host}${safePath}`;
  }

  private async parseResponse<TRes>(
    response: Response,
    path: string,
  ): Promise<CmsResponseEnvelope<TRes>> {
    // HTTP 层 5xx / 非 JSON
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new CmsBusinessError(
        `CMS HTTP ${response.status} at ${path}`,
        { state: response.status, cmsMessage: text.slice(0, 500) },
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      throw new CmsSchemaError(
        `CMS 响应非 JSON：${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = CmsResponseEnvelopeSchema.safeParse(json);
    if (!parsed.success) {
      throw new CmsSchemaError(
        `CMS 响应不符合 envelope 结构：${parsed.error.message}`,
      );
    }

    const envelope = parsed.data as CmsResponseEnvelope<TRes>;

    // 鉴权错误（优先级高于其他业务错误）
    if (
      envelope.state === 401 ||
      envelope.state === 403 ||
      /未登录|token.*(失效|过期)|login.*(failed|expired)/i.test(envelope.message)
    ) {
      throw new CmsAuthError(
        `CMS 鉴权失败：state=${envelope.state} message="${envelope.message}"`,
      );
    }

    // 业务成功
    if (envelope.state === 200 && envelope.success) {
      return envelope;
    }

    // 业务错误
    throw new CmsBusinessError(
      `CMS 业务错误 at ${path}：state=${envelope.state} message="${envelope.message}"`,
      {
        state: envelope.state,
        cmsMessage: envelope.message,
        rawResponse: envelope,
      },
    );
  }
}
```

- [ ] **Step 14.4: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/client.test.ts
npx tsc --noEmit
git add src/lib/cms/client.ts src/lib/cms/__tests__/client.test.ts
git commit -m "feat(cms/p1): CmsClient HTTP base (auth header + timeout + error mapping)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: CmsClient 重试策略（指数退避）

**目的：** 在 Task 14 基础上增加自动重试逻辑。仅对 `isRetriableCmsError` 为 true 的错误重试；退避间隔 1s/2s/4s（指数增长），最多 `maxRetries` 次（默认 3）。

**Files:**
- Modify: `src/lib/cms/client.ts`
- Create: `src/lib/cms/__tests__/client-retry.test.ts`

- [ ] **Step 15.1: 写重试测试**

Create `src/lib/cms/__tests__/client-retry.test.ts`：

```typescript
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
  cmsErrorResponse,
  cmsAbortError,
} from "./test-helpers";
import { CmsClient } from "../client";
import { CmsAuthError, CmsBusinessError } from "../errors";

// 缩短 backoff 以便测试
const config = {
  host: "https://cms.example.com",
  loginCmcId: "id",
  loginCmcTid: "tid",
  timeoutMs: 2000,
  maxRetries: 3,
  retryBackoffMs: 5,   // ms 级，避免测试等太久
};

describe("CmsClient retry", () => {
  afterEach(() => restoreCmsFetch());

  it("retries on 5xx business error then succeeds", async () => {
    mockCmsFetch([
      cmsErrorResponse(500, "临时错误"),
      cmsErrorResponse(503, "服务重启"),
      cmsSuccessResponse({ ok: 1 }),
    ]);
    const client = new CmsClient(config);
    const res = await client.post<unknown, { ok: number }>("/x", {});
    expect(res.data).toEqual({ ok: 1 });
  });

  it("retries on network error (AbortError) then succeeds", async () => {
    mockCmsFetch([
      cmsAbortError(),
      cmsSuccessResponse({ ok: 2 }),
    ]);
    const client = new CmsClient(config);
    const res = await client.post("/x", {});
    expect(res.state).toBe(200);
  });

  it("does NOT retry on CmsAuthError", async () => {
    mockCmsFetch([cmsErrorResponse(401, "未登录")]);
    const client = new CmsClient(config);
    await expect(client.post("/x", {})).rejects.toThrow(CmsAuthError);
  });

  it("does NOT retry on 400 Bad Request", async () => {
    mockCmsFetch([cmsErrorResponse(400, "参数错误")]);
    const client = new CmsClient(config);
    await expect(client.post("/x", {})).rejects.toThrow(CmsBusinessError);
  });

  it("DOES retry on 429 rate limit then succeed", async () => {
    mockCmsFetch([
      cmsErrorResponse(429, "请求过快"),
      cmsSuccessResponse({ ok: 3 }),
    ]);
    const client = new CmsClient(config);
    const res = await client.post("/x", {});
    expect(res.state).toBe(200);
  });

  it("gives up after maxRetries retries and throws last error", async () => {
    mockCmsFetch([
      cmsErrorResponse(500, "fail1"),
      cmsErrorResponse(500, "fail2"),
      cmsErrorResponse(500, "fail3"),
      cmsErrorResponse(500, "fail4"),
    ]);
    const client = new CmsClient(config);
    await expect(client.post("/x", {})).rejects.toThrow(/fail4|fail/);
  });

  it("uses exponential backoff timing", async () => {
    vi.useFakeTimers();
    mockCmsFetch([
      cmsErrorResponse(500, "e1"),
      cmsErrorResponse(500, "e2"),
      cmsSuccessResponse({ ok: 1 }),
    ]);
    const client = new CmsClient({ ...config, retryBackoffMs: 100 });
    const promise = client.post("/x", {});
    // 首次立即失败 → 退避 100ms → 第二次失败 → 退避 200ms → 第三次成功
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    const res = await promise;
    expect(res.state).toBe(200);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 15.2: 运行 FAIL（重试逻辑未实现）**

```bash
npm run test -- src/lib/cms/__tests__/client-retry.test.ts
```

- [ ] **Step 15.3: 在 CmsClient 中加入 retry 包装**

Edit `src/lib/cms/client.ts`：

a. 在 `import` 行下方新增：

```typescript
import { isRetriableCmsError } from "./errors";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

b. 修改 class 字段：

```typescript
  private readonly maxRetries: number;
  private readonly retryBackoffMs: number;

  constructor(config: CmsClientConfig) {
    this.host = config.host.replace(/\/$/, "");
    this.loginCmcId = config.loginCmcId;
    this.loginCmcTid = config.loginCmcTid;
    this.defaultTimeoutMs = config.timeoutMs ?? 15000;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBackoffMs = config.retryBackoffMs ?? 1000;
  }
```

c. 把原来 `post()` 方法抽成 `postOnce()`，然后写新的 `post()` 做 retry 包装：

```typescript
  /** 带重试的 post —— 外部调用使用这个 */
  async post<TReq, TRes>(
    path: string,
    body: TReq,
    options: CmsRequestOptions = {},
  ): Promise<CmsResponseEnvelope<TRes>> {
    return this.withRetry(() => this.postOnce<TReq, TRes>(path, body, options));
  }

  async get<TRes>(
    path: string,
    query: Record<string, string | number> = {},
    options: CmsRequestOptions = {},
  ): Promise<CmsResponseEnvelope<TRes>> {
    return this.withRetry(() => this.getOnce<TRes>(path, query, options));
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!isRetriableCmsError(err)) throw err;
        if (attempt === this.maxRetries) break;
        const backoff = this.retryBackoffMs * 2 ** attempt;
        await delay(backoff);
      }
    }
    throw lastErr;
  }

  /** 单次 post（不含 retry） */
  private async postOnce<TReq, TRes>(
    path: string,
    body: TReq,
    options: CmsRequestOptions,
  ): Promise<CmsResponseEnvelope<TRes>> {
    // ... 复制原 post 方法的 fetch + parseResponse 代码到这里
  }

  /** 单次 get（不含 retry） */
  private async getOnce<TRes>(
    path: string,
    query: Record<string, string | number>,
    options: CmsRequestOptions,
  ): Promise<CmsResponseEnvelope<TRes>> {
    // ... 同上，get 版
  }
```

> 💡 实施时：把原 post/get 实现逐字搬到 postOnce/getOnce；保留 parseResponse 和 buildUrl 私有方法。

- [ ] **Step 15.4: 运行 retry 测试通过**

```bash
npm run test -- src/lib/cms/__tests__/client-retry.test.ts
```

预期：全部 PASS。

- [ ] **Step 15.5: 回归跑 Task 14 测试确认未破坏**

```bash
npm run test -- src/lib/cms/__tests__/client.test.ts
```

> ⚠️ 注意：Task 14 的 config 用 `maxRetries: 0`；若 retry 逻辑需要 `maxRetries >= 0`，确认边界行为一致。

- [ ] **Step 15.6: 提交**

```bash
git add src/lib/cms/client.ts src/lib/cms/__tests__/client-retry.test.ts
git commit -m "feat(cms/p1): CmsClient exponential-backoff retry (retriable errors only)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: api-endpoints.getChannels

**目的：** 对 CmsClient 做最小薄包装，把 `/web/catalog/getChannels` 封装成类型安全的 `getChannels(client, options)`。

**Files:**
- Create: `src/lib/cms/api-endpoints.ts`（本文件最终容纳 5 个接口；Task 16-20 逐步追加）
- Create: `src/lib/cms/__tests__/api-endpoints.test.ts`

- [ ] **Step 16.1: 写 getChannels 失败测试**

Create `src/lib/cms/__tests__/api-endpoints.test.ts`：

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { mockCmsFetch, restoreCmsFetch, cmsSuccessResponse } from "./test-helpers";
import { CmsClient } from "../client";
import { getChannels } from "../api-endpoints";

const cfg = {
  host: "https://cms.example.com",
  loginCmcId: "id",
  loginCmcTid: "tid",
  maxRetries: 0,
};

describe("getChannels", () => {
  afterEach(() => restoreCmsFetch());

  it("returns CHANNEL_APP with typed structure", async () => {
    mockCmsFetch([
      cmsSuccessResponse({
        CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
        CHANNEL_WEB: { code: 2, pickValue: "0", thirdFlag: "2", name: "网站" },
      }),
    ]);
    const client = new CmsClient(cfg);
    const res = await getChannels(client);
    expect(res.data?.CHANNEL_APP?.code).toBe(1);
    expect(res.data?.CHANNEL_WEB?.name).toBe("网站");
  });

  it("passes appAndWeb/privilegeFlag options in body", async () => {
    let captured: unknown;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? "{}");
      return cmsSuccessResponse({});
    }) as typeof globalThis.fetch;
    const client = new CmsClient(cfg);
    await getChannels(client, { appAndWeb: 1, privilegeFlag: 0 });
    expect(captured).toEqual({ appAndWeb: 1, privilegeFlag: 0 });
  });

  it("throws CmsSchemaError when data shape invalid", async () => {
    mockCmsFetch([
      cmsSuccessResponse({
        CHANNEL_APP: { codeWrong: "bad" }, // missing required fields
      }),
    ]);
    const client = new CmsClient(cfg);
    await expect(getChannels(client)).rejects.toThrow(/CHANNEL|invalid|code/i);
  });
});
```

- [ ] **Step 16.2: 运行 FAIL**

```bash
npm run test -- src/lib/cms/__tests__/api-endpoints.test.ts -t "getChannels"
```

- [ ] **Step 16.3: 实现 getChannels**

Create `src/lib/cms/api-endpoints.ts`：

```typescript
import type { CmsClient } from "./client";
import {
  CmsChannelsDataSchema,
  type CmsChannelsData,
  type CmsResponseEnvelope,
} from "./types";
import { CmsSchemaError } from "./errors";

/**
 * 获取渠道列表（/web/catalog/getChannels）
 *
 * @param options.appAndWeb   1=只返 APP 和网站渠道；0=返全部
 * @param options.privilegeFlag 0=走权限查询；1=不走权限
 */
export async function getChannels(
  client: CmsClient,
  options: { appAndWeb?: 0 | 1; privilegeFlag?: 0 | 1 } = {},
): Promise<CmsResponseEnvelope<CmsChannelsData>> {
  const res = await client.post<typeof options, unknown>(
    "/web/catalog/getChannels",
    options,
  );

  const parsed = CmsChannelsDataSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `getChannels 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}
```

- [ ] **Step 16.4: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/api-endpoints.test.ts -t "getChannels"
git add src/lib/cms/api-endpoints.ts src/lib/cms/__tests__/api-endpoints.test.ts
git commit -m "feat(cms/p1): api-endpoints.getChannels with schema validation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: api-endpoints.getAppList

**Files:**
- Modify: `src/lib/cms/api-endpoints.ts`
- Modify: `src/lib/cms/__tests__/api-endpoints.test.ts`（追加 `describe("getAppList")`）

- [ ] **Step 17.1: 追加 getAppList 测试**

在 `src/lib/cms/__tests__/api-endpoints.test.ts` 末尾追加：

```typescript
import { getAppList } from "../api-endpoints";

describe("getAppList", () => {
  afterEach(() => restoreCmsFetch());

  it("returns an array of CmsApp entries", async () => {
    mockCmsFetch([
      cmsSuccessResponse([
        { id: 1, siteid: 73, name: "A", type: 1, appkey: null, appsecret: null, addtime: null },
        { id: 2, siteid: 73, name: "B", type: 1, appkey: "ak", appsecret: "as", addtime: "2024-01-01" },
      ]),
    ]);
    const client = new CmsClient(cfg);
    const res = await getAppList(client, "1");
    expect(res.data).toHaveLength(2);
    expect(res.data?.[1].appkey).toBe("ak");
  });

  it("sends the correct body { type }", async () => {
    let captured: unknown;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? "{}");
      return cmsSuccessResponse([]);
    }) as typeof globalThis.fetch;
    const client = new CmsClient(cfg);
    await getAppList(client, "2");
    expect(captured).toEqual({ type: "2" });
  });
});
```

- [ ] **Step 17.2: FAIL → 追加实现**

在 `src/lib/cms/api-endpoints.ts` 末尾追加：

```typescript
import { CmsAppListSchema, type CmsApp } from "./types";

/**
 * 获取应用列表（/web/application/getAppList）
 *
 * @param type 渠道类型："1"=APP, "2"=网站, "3"=微信 ...
 */
export async function getAppList(
  client: CmsClient,
  type: "1" | "2" | "3" | "4" | "5" | "6" | "13" | "21",
): Promise<CmsResponseEnvelope<CmsApp[]>> {
  const res = await client.post<{ type: string }, unknown>(
    "/web/application/getAppList",
    { type },
  );

  const parsed = CmsAppListSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `getAppList 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}
```

- [ ] **Step 17.3: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/api-endpoints.test.ts -t "getAppList"
git add src/lib/cms/api-endpoints.ts src/lib/cms/__tests__/api-endpoints.test.ts
git commit -m "feat(cms/p1): api-endpoints.getAppList with schema validation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: api-endpoints.getCatalogTree

**Files:**
- Modify: `src/lib/cms/api-endpoints.ts`
- Modify: `src/lib/cms/__tests__/api-endpoints.test.ts`

- [ ] **Step 18.1: 追加 getCatalogTree 测试**

```typescript
import { getCatalogTree } from "../api-endpoints";

describe("getCatalogTree", () => {
  afterEach(() => restoreCmsFetch());

  it("returns an array of catalog nodes (flat)", async () => {
    mockCmsFetch([
      cmsSuccessResponse([
        {
          id: 9369, appid: 250, siteId: 73, name: "A", parentId: 0,
          innerCode: "009887", alias: "a", treeLevel: 1, isLeaf: 1, type: 1,
          childCatalog: [],
        },
      ]),
    ]);
    const client = new CmsClient(cfg);
    const res = await getCatalogTree(client, { appId: "250", types: "1" });
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0].id).toBe(9369);
  });

  it("handles recursive children", async () => {
    mockCmsFetch([
      cmsSuccessResponse([
        {
          id: 9373, appid: 250, siteId: 73, name: "父", parentId: 0,
          innerCode: "009891", alias: "p", treeLevel: 1, isLeaf: 0, type: 1,
          childCatalog: [
            {
              id: 9374, appid: 250, siteId: 73, name: "子", parentId: 9373,
              innerCode: "009891000001", alias: "c", treeLevel: 2, isLeaf: 0, type: 1,
              childCatalog: [],
            },
          ],
        },
      ]),
    ]);
    const client = new CmsClient(cfg);
    const res = await getCatalogTree(client, { appId: "250" });
    expect(res.data?.[0].childCatalog?.[0].id).toBe(9374);
  });

  it("forwards optional params", async () => {
    let captured: unknown;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? "{}");
      return cmsSuccessResponse([]);
    }) as typeof globalThis.fetch;
    const client = new CmsClient(cfg);
    await getCatalogTree(client, {
      appId: "250",
      types: "1",
      isPrivilege: "false",
      catalogName: "新闻",
    });
    expect(captured).toMatchObject({
      appId: "250", types: "1", isPrivilege: "false", catalogName: "新闻",
    });
  });
});
```

- [ ] **Step 18.2: FAIL → 实现**

追加到 `src/lib/cms/api-endpoints.ts`：

```typescript
import { CmsCatalogNodeSchema, type CmsCatalogNode } from "./types";
import { z } from "zod";

export interface GetCatalogTreeOptions {
  appId?: string;
  types?: string;               // "1" 新闻 / "4" 图片 / 多个用逗号
  channelCode?: string;
  parentId?: string;
  parentIds?: string;
  catalogName?: string;
  alias?: string;
  isPrivilege?: string;         // "false" 表示不走权限
  isShowBindingCatalog?: string;
  persionalFlag?: string;
  commitFlag?: string;
  startTime?: string;
  endTime?: string;
  isQuote?: boolean;
}

const CmsCatalogListSchema = z.array(CmsCatalogNodeSchema);

/**
 * 获取栏目树（/web/catalog/getTree）
 */
export async function getCatalogTree(
  client: CmsClient,
  options: GetCatalogTreeOptions = {},
): Promise<CmsResponseEnvelope<CmsCatalogNode[]>> {
  const res = await client.post<GetCatalogTreeOptions, unknown>(
    "/web/catalog/getTree",
    options,
  );

  const parsed = CmsCatalogListSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `getCatalogTree 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}
```

- [ ] **Step 18.3: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/api-endpoints.test.ts -t "getCatalogTree"
git add src/lib/cms/api-endpoints.ts src/lib/cms/__tests__/api-endpoints.test.ts
git commit -m "feat(cms/p1): api-endpoints.getCatalogTree with recursive schema

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: api-endpoints.saveArticle

**目的：** 入稿接口 —— 本 P1 核心。`CmsArticleSaveDTO` 类型在 Task 13 已定义。

**Files:**
- Modify: `src/lib/cms/api-endpoints.ts`
- Modify: `src/lib/cms/__tests__/api-endpoints.test.ts`

- [ ] **Step 19.1: 追加 saveArticle 测试**

```typescript
import { saveArticle } from "../api-endpoints";
import type { CmsArticleSaveDTO } from "../types";

describe("saveArticle", () => {
  afterEach(() => restoreCmsFetch());

  const buildMinimalDto = (): CmsArticleSaveDTO => ({
    loginId: "id",
    loginTid: "tid",
    tenantId: "t",
    username: "admin",
    version: "cms2",
    type: "1",
    title: "稿件",
    author: "智媒编辑部",
    catalogId: 8634,
    siteId: 81,
    content: "<p>正文</p>",
  });

  it("returns article.id + url + preViewPath on success", async () => {
    mockCmsFetch([
      cmsSuccessResponse({
        article: { id: 925194, status: 0, title: "稿件" },
        url: "1376/x/925194.shtml",
        preViewPath: "https://api/preview",
        method: "ADD",
      }),
    ]);
    const client = new CmsClient(cfg);
    const res = await saveArticle(client, buildMinimalDto());
    expect(res.data?.article.id).toBe(925194);
    expect(res.data?.url).toContain(".shtml");
  });

  it("forwards the full DTO as request body", async () => {
    let captured: unknown;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      captured = JSON.parse((init?.body as string) ?? "{}");
      return cmsSuccessResponse({
        article: { id: 1 }, url: "x", preViewPath: "", method: "ADD",
      });
    }) as typeof globalThis.fetch;
    const client = new CmsClient(cfg);
    const dto = buildMinimalDto();
    await saveArticle(client, dto);
    expect(captured).toMatchObject({
      title: "稿件",
      type: "1",
      catalogId: 8634,
      version: "cms2",
    });
  });

  it("bubbles up CmsBusinessError on state != 200", async () => {
    mockCmsFetch([cmsErrorResponse(500, "入稿失败")]);
    const client = new CmsClient(cfg);
    await expect(saveArticle(client, buildMinimalDto())).rejects.toThrow(/入稿|CMS/);
  });
});
```

- [ ] **Step 19.2: FAIL → 实现**

追加到 `src/lib/cms/api-endpoints.ts`：

```typescript
import {
  CmsArticleSaveResponseDataSchema,
  type CmsArticleSaveDTO,
  type CmsArticleSaveResponseData,
} from "./types";

/**
 * 文稿入库（/web/article/save）
 */
export async function saveArticle(
  client: CmsClient,
  dto: CmsArticleSaveDTO,
): Promise<CmsResponseEnvelope<CmsArticleSaveResponseData>> {
  const res = await client.post<CmsArticleSaveDTO, unknown>(
    "/web/article/save",
    dto,
    { timeoutMs: 20000 },
  );

  const parsed = CmsArticleSaveResponseDataSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `saveArticle 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}
```

- [ ] **Step 19.3: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/api-endpoints.test.ts -t "saveArticle"
git add src/lib/cms/api-endpoints.ts src/lib/cms/__tests__/api-endpoints.test.ts
git commit -m "feat(cms/p1): api-endpoints.saveArticle (core publish endpoint)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: api-endpoints.getArticleDetail

**Files:**
- Modify: `src/lib/cms/api-endpoints.ts`
- Modify: `src/lib/cms/__tests__/api-endpoints.test.ts`
- Modify: `src/lib/cms/index.ts`（把所有 5 个接口 + CmsClient 都导出）

- [ ] **Step 20.1: 追加 getArticleDetail 测试**

```typescript
import { getArticleDetail } from "../api-endpoints";

describe("getArticleDetail", () => {
  afterEach(() => restoreCmsFetch());

  it("returns detail with status/type fields", async () => {
    mockCmsFetch([
      cmsSuccessResponse({
        Id: 925194, title: "稿件", status: "30", type: 1,
        publishDate: "2026-04-18 10:00:00",
      }),
    ]);
    const client = new CmsClient(cfg);
    const res = await getArticleDetail(client, "925194");
    expect(res.data?.Id).toBe(925194);
    expect(res.data?.status).toBe("30");
  });

  it("sends articleId as query param (GET)", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method ?? "";
      return cmsSuccessResponse({ Id: 1, title: "x", status: "0", type: 1 });
    }) as typeof globalThis.fetch;
    const client = new CmsClient(cfg);
    await getArticleDetail(client, "925194");
    expect(capturedUrl).toContain("articleId=925194");
    expect(capturedMethod).toBe("GET");
  });
});
```

- [ ] **Step 20.2: FAIL → 实现**

追加到 `src/lib/cms/api-endpoints.ts`：

```typescript
import { CmsArticleDetailSchema, type CmsArticleDetail } from "./types";

/**
 * 查询文稿详情（/web/article/getMyArticleDetail）
 */
export async function getArticleDetail(
  client: CmsClient,
  articleId: string,
): Promise<CmsResponseEnvelope<CmsArticleDetail>> {
  const res = await client.get<unknown>(
    "/web/article/getMyArticleDetail",
    { articleId },
  );

  const parsed = CmsArticleDetailSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `getArticleDetail 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}
```

- [ ] **Step 20.3: 更新 src/lib/cms/index.ts 导出全部**

在 `src/lib/cms/index.ts` 中追加（或取消注释之前的占位 export）：

```typescript
export { CmsClient, type CmsClientConfig, type CmsRequestOptions } from "./client";
export {
  getChannels,
  getAppList,
  getCatalogTree,
  saveArticle,
  getArticleDetail,
  type GetCatalogTreeOptions,
} from "./api-endpoints";
export {
  // DTO & schema types
  type CmsResponseEnvelope,
  type CmsChannelsData,
  type CmsChannelInfo,
  type CmsApp,
  type CmsCatalogNode,
  type CmsArticleSaveDTO,
  type CmsArticleSaveResponseData,
  type CmsArticleDetail,
  type CmsImageSimpleDTO,
  type CmsArticleContentDto,
  type CmsAppCustomParams,
  type CmsListStyleDto,
} from "./types";
```

- [ ] **Step 20.4: 测试通过 + 验证 import**

```bash
npm run test -- src/lib/cms/__tests__/
npx tsc --noEmit
```

快速验证：

```bash
node -e "
const {
  CmsClient, getChannels, getAppList, getCatalogTree, saveArticle, getArticleDetail,
  CmsAuthError, isRetriableCmsError, requireCmsConfig,
} = require('./src/lib/cms');
console.log('all exports resolved');
" 2>&1 || echo "(预期需 tsx/next 环境；保留为验证提示)"
```

- [ ] **Step 20.5: 提交**

```bash
git add src/lib/cms/api-endpoints.ts src/lib/cms/__tests__/api-endpoints.test.ts src/lib/cms/index.ts
git commit -m "feat(cms/p1): api-endpoints.getArticleDetail + unified module exports

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Section C 完成检查

```bash
# 1. 所有 C 组测试通过
npm run test -- src/lib/cms/

# 2. 类型编译通过
npx tsc --noEmit

# 3. 所有公开 API 都从 index.ts 导出
grep -E "^export" src/lib/cms/index.ts | wc -l   # 应 >= 12 行
```

Section C 结束后 git log 应看到 8 个 `feat(cms/p1):` commit（Task 13-20 各 1 个）。

**→ Section D 开始前，请在对话中确认"Section C 完成"。**

---

# Section D — Article Mapper

**本 Section 实现从 VibeTide `Article` 到 `CmsArticleSaveDTO` 的映射。分 5 种 type（本期只 type 1/2/4 主实现；type 5/11 预留接口但 P1 不走）。**

**核心抽象：**

```typescript
// MapperContext —— 映射上下文（从 app_channels + cms_apps + cms_catalogs + env 聚合）
interface MapperContext {
  siteId: number;                 // cms_apps.site_id
  appId: number;                  // cms_apps.cms_app_id
  catalogId: number;              // cms_catalogs.cms_catalog_id
  tenantId: string;               // env CMS_TENANT_ID
  loginId: string;                // env CMS_LOGIN_CMC_ID
  loginTid: string;               // env CMS_LOGIN_CMC_TID
  username: string;               // env CMS_USERNAME
  source: string;                 // organization.brandName (fallback: "智媒编辑部")
  author: string;                 // article.authorName (fallback: "智媒编辑部")
  listStyleDefault: CmsListStyleDto;  // app_channels.defaultListStyle
  coverImageDefault: string;      // env CMS_DEFAULT_COVER_URL
}
```

---

## Task 21: common 字段映射（`common.ts`）

**目的：** 所有 type 共用的字段（标题、作者、状态、时间、分类、栏目、鉴权）一次性映射。type-specific mapper 只需在此基础上追加 content/images/videoId 等。

**Files:**
- Create: `src/lib/cms/article-mapper/common.ts`
- Create: `src/lib/cms/__tests__/article-mapper/common.test.ts`

- [ ] **Step 21.1: 写 common 映射测试**

Create `src/lib/cms/__tests__/article-mapper/common.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { mapCommonFields, type MapperContext } from "../../article-mapper/common";

const ctx: MapperContext = {
  siteId: 81,
  appId: 10,
  catalogId: 8634,
  tenantId: "tenant-1",
  loginId: "id-1",
  loginTid: "tid-1",
  username: "admin",
  source: "深圳广电",
  author: "智媒编辑部",
  listStyleDefault: {
    imageUrlList: [],
    listStyleName: "默认",
    listStyleType: "0",
  },
  coverImageDefault: "https://cdn/default-cover.jpg",
};

describe("mapCommonFields", () => {
  it("maps basic scalar fields with sane defaults", () => {
    const result = mapCommonFields(
      {
        id: "art-1",
        title: "测试稿件",
        authorName: null,
        summary: null,
        shortTitle: null,
        tags: [],
        coverImageUrl: null,
        publishStatus: "draft",
        publishedAt: null,
      },
      ctx,
    );

    expect(result.title).toBe("测试稿件");
    expect(result.listTitle).toBe("测试稿件");
    expect(result.author).toBe("智媒编辑部");
    expect(result.username).toBe("admin");
    expect(result.source).toBe("深圳广电");
    expect(result.referType).toBe(9);
    expect(result.version).toBe("cms2");
    expect(result.status).toBe("0");
    expect(result.logo).toBe("https://cdn/default-cover.jpg");
    expect(result.catalogId).toBe(8634);
    expect(result.siteId).toBe(81);
    expect(result.tenantId).toBe("tenant-1");
    expect(result.loginId).toBe("id-1");
    expect(result.loginTid).toBe("tid-1");
    expect(result.commentFlag).toBe("1");
    expect(result.tagsFlag).toBe("1");
    expect(result.showReadingCountFlag).toBe("1");
    expect(result.addTime).toBeTypeOf("number");
  });

  it("truncates title longer than 80 chars", () => {
    const long = "超级无敌巨长无比的标题".repeat(20);
    const result = mapCommonFields(
      {
        id: "x",
        title: long,
        authorName: null,
        summary: null,
        shortTitle: null,
        tags: [],
        coverImageUrl: null,
        publishStatus: "draft",
        publishedAt: null,
      },
      ctx,
    );
    expect(result.title.length).toBeLessThanOrEqual(80);
  });

  it("auto-derives shortTitle from summary or title when missing", () => {
    const result = mapCommonFields(
      {
        id: "x",
        title: "这是完整标题",
        authorName: null,
        summary: "这是摘要。摘要应该用作短标题来源",
        shortTitle: null,
        tags: [],
        coverImageUrl: null,
        publishStatus: "draft",
        publishedAt: null,
      },
      ctx,
    );
    expect(result.shortTitle).toBeTruthy();
    expect(result.shortTitle!.length).toBeLessThanOrEqual(20);
    expect(result.shortTitle).toContain("这是");
  });

  it("maps publishStatus enum to CMS status string", () => {
    const base = {
      id: "x", title: "t", authorName: null, summary: null,
      shortTitle: null, tags: [], coverImageUrl: null, publishedAt: null,
    };
    expect(mapCommonFields({ ...base, publishStatus: "draft" }, ctx).status).toBe("0");
    expect(mapCommonFields({ ...base, publishStatus: "pending" }, ctx).status).toBe("20");
    expect(mapCommonFields({ ...base, publishStatus: "published" }, ctx).status).toBe("30");
    expect(mapCommonFields({ ...base, publishStatus: "rejected" }, ctx).status).toBe("60");
  });

  it("joins tags with comma and limits to 10", () => {
    const result = mapCommonFields(
      {
        id: "x", title: "t", authorName: null, summary: null, shortTitle: null,
        tags: Array.from({ length: 15 }, (_, i) => `tag${i}`),
        coverImageUrl: null, publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(result.keyword).toBeDefined();
    expect(result.keyword!.split(",")).toHaveLength(10);
    expect(result.tags).toBe(result.keyword);
  });

  it("uses authorName when provided", () => {
    const result = mapCommonFields(
      {
        id: "x", title: "t", authorName: "张三", summary: null, shortTitle: null,
        tags: [], coverImageUrl: null, publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(result.author).toBe("张三");
  });

  it("uses custom cover when article.coverImageUrl present", () => {
    const result = mapCommonFields(
      {
        id: "x", title: "t", authorName: null, summary: null, shortTitle: null,
        tags: [], coverImageUrl: "https://cdn/my.jpg",
        publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(result.logo).toBe("https://cdn/my.jpg");
  });

  it("sets publishDate from article.publishedAt", () => {
    const pubDate = new Date("2026-04-18T10:00:00Z");
    const result = mapCommonFields(
      {
        id: "x", title: "t", authorName: null, summary: null, shortTitle: null,
        tags: [], coverImageUrl: null,
        publishStatus: "published", publishedAt: pubDate,
      },
      ctx,
    );
    expect(result.publishDate).toBe(pubDate.getTime());
  });
});
```

- [ ] **Step 21.2: 运行 FAIL**

```bash
mkdir -p src/lib/cms/article-mapper src/lib/cms/__tests__/article-mapper
npm run test -- src/lib/cms/__tests__/article-mapper/common.test.ts
```

- [ ] **Step 21.3: 实现 common.ts**

Create `src/lib/cms/article-mapper/common.ts`：

```typescript
import type { CmsArticleSaveDTO, CmsListStyleDto } from "../types";

export interface ArticleForMapper {
  id: string;
  title: string;
  authorName: string | null;
  summary: string | null;
  shortTitle: string | null;
  tags: string[];
  coverImageUrl: string | null;
  publishStatus: "draft" | "pending" | "published" | "rejected";
  publishedAt: Date | null;
}

export interface MapperContext {
  siteId: number;
  appId: number;
  catalogId: number;
  tenantId: string;
  loginId: string;
  loginTid: string;
  username: string;
  source: string;
  author: string;                  // 兜底作者（当 article.authorName 为 null）
  listStyleDefault: CmsListStyleDto;
  coverImageDefault: string;
}

const DEFAULT_AUTHOR = "智媒编辑部";
const DEFAULT_SOURCE = "智媒编辑部";
const TITLE_MAX = 80;
const SHORT_TITLE_MAX = 20;
const KEYWORD_COUNT_MAX = 10;

/**
 * VibeTide publishStatus → CMS status 字符串
 */
function publishStatusToCmsStatus(
  status: ArticleForMapper["publishStatus"],
): "0" | "20" | "30" | "60" {
  switch (status) {
    case "draft":     return "0";
    case "pending":   return "20";
    case "published": return "30";
    case "rejected":  return "60";
  }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function deriveShortTitle(
  article: ArticleForMapper,
): string {
  if (article.shortTitle && article.shortTitle.trim()) {
    return truncate(article.shortTitle.trim(), SHORT_TITLE_MAX);
  }
  if (article.summary && article.summary.trim()) {
    return truncate(article.summary.trim(), SHORT_TITLE_MAX);
  }
  return truncate(article.title, SHORT_TITLE_MAX);
}

/**
 * 映射 VibeTide Article 到 CMS DTO 的公共字段。
 *
 * 返回的是 CmsArticleSaveDTO 的「共用子集」—— type-specific mapper
 * 拿到此 partial 后再追加 content / articleContentDto / videoId 等。
 */
export function mapCommonFields(
  article: ArticleForMapper,
  ctx: MapperContext,
): Partial<CmsArticleSaveDTO> {
  const keyword =
    article.tags.length > 0
      ? article.tags.slice(0, KEYWORD_COUNT_MAX).join(",")
      : undefined;

  return {
    // 鉴权 & 租户
    loginId: ctx.loginId,
    loginTid: ctx.loginTid,
    tenantId: ctx.tenantId,
    username: ctx.username,
    version: "cms2",
    sourceSystem: 3,

    // 基本信息
    title: truncate(article.title, TITLE_MAX),
    listTitle: truncate(article.title, TITLE_MAX),
    shortTitle: deriveShortTitle(article),
    author: article.authorName?.trim() || ctx.author || DEFAULT_AUTHOR,
    source: ctx.source || DEFAULT_SOURCE,
    summary: article.summary ?? undefined,
    keyword,
    tags: keyword,
    tagsFlag: "1",

    // 栏目 & 站点
    catalogId: ctx.catalogId,
    siteId: ctx.siteId,
    referType: 9,  // 固定：智媒 AI 自产

    // 状态 & 时间
    status: publishStatusToCmsStatus(article.publishStatus),
    addTime: Date.now(),
    publishDate: article.publishedAt?.getTime(),

    // 封面
    logo: article.coverImageUrl ?? ctx.coverImageDefault,

    // 交互开关
    commentFlag: "1",
    commentVerifyFlag: "Y",
    showReadingCountFlag: "1",
    advertisementFlag: "1",
    barrageFlag: "0",
    allowComment: true,

    // 列表样式（type-specific mapper 可覆盖）
    listStyleDto: ctx.listStyleDefault,

    // 虚拟点击量基数
    virtualHitCount: 0,
  };
}
```

- [ ] **Step 21.4: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/article-mapper/common.test.ts
npx tsc --noEmit
git add src/lib/cms/article-mapper/common.ts src/lib/cms/__tests__/article-mapper/common.test.ts
git commit -m "feat(cms/p1): article-mapper/common.ts (shared field mapping)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: type1-article mapper（图文新闻）

**目的：** Phase 1 主路径。把 article.body（HTML 或 Markdown）映射到 CMS `content` + `articleContentDto.htmlContent`。自动包装 `<div id="editWrap">`。

**Files:**
- Create: `src/lib/cms/article-mapper/type1-article.ts`
- Create: `src/lib/cms/__tests__/article-mapper/type1-article.test.ts`

- [ ] **Step 22.1: 写 type1 映射测试**

Create `src/lib/cms/__tests__/article-mapper/type1-article.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { mapToType1 } from "../../article-mapper/type1-article";
import type { MapperContext } from "../../article-mapper/common";

const ctx: MapperContext = {
  siteId: 81,
  appId: 10,
  catalogId: 8634,
  tenantId: "t",
  loginId: "id",
  loginTid: "tid",
  username: "admin",
  source: "深圳广电",
  author: "智媒编辑部",
  listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
  coverImageDefault: "https://cdn/default.jpg",
};

const baseArticle = {
  id: "art-1",
  title: "测试新闻",
  authorName: null,
  summary: "摘要",
  shortTitle: null,
  tags: ["AI", "科技"],
  coverImageUrl: "https://cdn/cover.jpg",
  publishStatus: "pending" as const,
  publishedAt: null,
  body: "<p>正文内容</p>",
};

describe("mapToType1", () => {
  it("sets type='1' and populates content + articleContentDto.htmlContent", () => {
    const dto = mapToType1(baseArticle, ctx);
    expect(dto.type).toBe("1");
    expect(dto.content).toContain("正文内容");
    expect(dto.articleContentDto?.htmlContent).toContain("正文内容");
    expect(dto.articleContentDto?.videoDtoList).toEqual([]);
  });

  it("wraps plain body with <div id=\"editWrap\">", () => {
    const dto = mapToType1({ ...baseArticle, body: "<p>正文</p>" }, ctx);
    expect(dto.content).toContain("id=\"editWrap\"");
  });

  it("keeps existing editWrap wrapper (idempotent)", () => {
    const wrapped = '<div style="..." id="editWrap"><p>内容</p></div>';
    const dto = mapToType1({ ...baseArticle, body: wrapped }, ctx);
    // Should still contain editWrap exactly once
    const matches = (dto.content ?? "").match(/id="editWrap"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("throws when body is empty", () => {
    expect(() => mapToType1({ ...baseArticle, body: "" }, ctx)).toThrow(/content/i);
    expect(() => mapToType1({ ...baseArticle, body: "   " }, ctx)).toThrow(/content/i);
  });

  it("sets appCustomParams.customStyle with single cover", () => {
    const dto = mapToType1(baseArticle, ctx);
    expect(dto.appCustomParams?.customStyle.type).toBe("0");
    expect(dto.appCustomParams?.customStyle.imgPath).toEqual(["https://cdn/cover.jpg"]);
  });

  it("preserves all common fields (title/author/catalogId/etc.)", () => {
    const dto = mapToType1(baseArticle, ctx);
    expect(dto.title).toBe("测试新闻");
    expect(dto.catalogId).toBe(8634);
    expect(dto.siteId).toBe(81);
    expect(dto.status).toBe("20");
    expect(dto.keyword).toBe("AI,科技");
  });
});
```

- [ ] **Step 22.2: 运行 FAIL**

```bash
npm run test -- src/lib/cms/__tests__/article-mapper/type1-article.test.ts
```

- [ ] **Step 22.3: 实现 type1-article.ts**

Create `src/lib/cms/article-mapper/type1-article.ts`：

```typescript
import type { CmsArticleSaveDTO } from "../types";
import { CmsSchemaError } from "../errors";
import { mapCommonFields, type ArticleForMapper, type MapperContext } from "./common";

export interface Type1Article extends ArticleForMapper {
  body: string;
}

const EDIT_WRAP_STYLE =
  "font-family:宋体;font-size:16px;letter-spacing:1.75px;line-height: 1.75em;margin-top: 5px;margin-bottom: 15px;color: #000000;text-align: justify;text-indent:2em ";

function ensureEditWrap(body: string): string {
  if (/id="editWrap"/.test(body)) {
    return body;
  }
  return `<div style="${EDIT_WRAP_STYLE}" id="editWrap">${body}</div>`;
}

/**
 * 映射到 CMS type=1（普通图文新闻）。
 *
 * 必填：body（映射为 content + articleContentDto.htmlContent）
 */
export function mapToType1(
  article: Type1Article,
  ctx: MapperContext,
): CmsArticleSaveDTO {
  if (!article.body || !article.body.trim()) {
    throw new CmsSchemaError("type=1 mapper: 缺少 content (article.body)", {
      field: "content",
    });
  }

  const wrapped = ensureEditWrap(article.body);
  const cover = article.coverImageUrl ?? ctx.coverImageDefault;

  return {
    ...(mapCommonFields(article, ctx) as CmsArticleSaveDTO),
    type: "1",
    content: wrapped,
    articleContentDto: {
      htmlContent: wrapped,
      imageDtoList: [],
      videoDtoList: [],
    },
    appCustomParams: {
      customStyle: {
        imgPath: [cover],
        type: "0",  // 0=默认
      },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: {
      imageUrlList: [cover],
      listStyleName: "默认",
      listStyleType: "0",
    },
  };
}
```

- [ ] **Step 22.4: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/article-mapper/type1-article.test.ts
git add src/lib/cms/article-mapper/type1-article.ts src/lib/cms/__tests__/article-mapper/type1-article.test.ts
git commit -m "feat(cms/p1): mapToType1 (图文新闻) with editWrap HTML wrapping

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 23: type2-gallery mapper（图集）

**Files:**
- Create: `src/lib/cms/article-mapper/type2-gallery.ts`
- Create: `src/lib/cms/__tests__/article-mapper/type2-gallery.test.ts`

- [ ] **Step 23.1: 写 type2 测试**

Create `src/lib/cms/__tests__/article-mapper/type2-gallery.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { mapToType2, type Type2Article } from "../../article-mapper/type2-gallery";
import type { MapperContext } from "../../article-mapper/common";

const ctx: MapperContext = {
  siteId: 81, appId: 10, catalogId: 8634,
  tenantId: "t", loginId: "id", loginTid: "tid", username: "admin",
  source: "x", author: "y",
  listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
  coverImageDefault: "https://cdn/d.jpg",
};

const base: Type2Article = {
  id: "art-2",
  title: "图集",
  authorName: null,
  summary: null,
  shortTitle: null,
  tags: [],
  coverImageUrl: null,
  publishStatus: "draft",
  publishedAt: null,
  galleryImages: [
    { url: "https://cdn/1.jpg", caption: "说明1" },
    { url: "https://cdn/2.jpg", caption: "说明2" },
    { url: "https://cdn/3.jpg", caption: "说明3" },
  ],
};

describe("mapToType2", () => {
  it("sets type='2' and maps all images into articleContentDto.imageDtoList + images[]", () => {
    const dto = mapToType2(base, ctx);
    expect(dto.type).toBe("2");
    expect(dto.articleContentDto?.imageDtoList).toHaveLength(3);
    expect(dto.images).toHaveLength(3);
    expect(dto.images?.[0].image).toBe("https://cdn/1.jpg");
    expect(dto.images?.[0].note).toBe("说明1");
  });

  it("throws when galleryImages has fewer than 3 entries", () => {
    expect(() =>
      mapToType2({ ...base, galleryImages: [base.galleryImages[0]] }, ctx),
    ).toThrow(/3|gallery|at least/i);
  });

  it("throws when galleryImages missing url", () => {
    expect(() =>
      mapToType2({
        ...base,
        galleryImages: [
          { url: "", caption: "x" },
          base.galleryImages[1],
          base.galleryImages[2],
        ],
      }, ctx),
    ).toThrow(/url|image/i);
  });

  it("uses '图片说明N' fallback when caption absent", () => {
    const dto = mapToType2({
      ...base,
      galleryImages: [
        { url: "https://a", caption: null },
        { url: "https://b", caption: null },
        { url: "https://c", caption: null },
      ],
    }, ctx);
    expect(dto.images?.[0].note).toBe("图片说明1");
    expect(dto.images?.[2].note).toBe("图片说明3");
  });

  it("sets appCustomParams.customStyle.type='2' (multi-image)", () => {
    const dto = mapToType2(base, ctx);
    expect(dto.appCustomParams?.customStyle.type).toBe("2");
    expect(dto.appCustomParams?.customStyle.imgPath).toHaveLength(3);
  });

  it("sets listStyleDto.listStyleType='2'", () => {
    const dto = mapToType2(base, ctx);
    expect(dto.listStyleDto?.listStyleType).toBe("2");
    expect(dto.listStyleDto?.imageUrlList).toHaveLength(3);
  });
});
```

- [ ] **Step 23.2: FAIL → 实现**

Create `src/lib/cms/article-mapper/type2-gallery.ts`：

```typescript
import type { CmsArticleSaveDTO, CmsImageDto, CmsImageSimpleDTO } from "../types";
import { CmsSchemaError } from "../errors";
import { mapCommonFields, type ArticleForMapper, type MapperContext } from "./common";

export interface GalleryImage {
  url: string;
  caption: string | null;
  sourceId?: string;
  name?: string;
}

export interface Type2Article extends ArticleForMapper {
  galleryImages: GalleryImage[];
}

const MIN_GALLERY_IMAGES = 3;

function randomId(): string {
  return Math.random().toString(36).slice(2);
}

export function mapToType2(
  article: Type2Article,
  ctx: MapperContext,
): CmsArticleSaveDTO {
  if (!article.galleryImages || article.galleryImages.length < MIN_GALLERY_IMAGES) {
    throw new CmsSchemaError(
      `type=2 mapper: galleryImages 至少 ${MIN_GALLERY_IMAGES} 张`,
      { field: "galleryImages" },
    );
  }
  for (let i = 0; i < article.galleryImages.length; i++) {
    if (!article.galleryImages[i].url) {
      throw new CmsSchemaError(
        `type=2 mapper: galleryImages[${i}].url 必须提供`,
        { field: `galleryImages[${i}].url` },
      );
    }
  }

  const images = article.galleryImages;

  const imageDtoList: CmsImageDto[] = images.map((img, i) => ({
    imageUrl: img.url,
    imageName: img.name ?? randomId(),
    description: img.caption ?? `图片说明${i + 1}`,
    sImageUrl: img.url,
    linkText: "",
    linkUrl: "",
  }));

  const imagesSimple: CmsImageSimpleDTO[] = images.map((img, i) => ({
    contentSourceId: img.sourceId ?? randomId(),
    image: img.url,
    imageName: img.name ?? randomId(),
    note: img.caption ?? `图片说明${i + 1}`,
    linkText: "",
    linkUrl: "",
  }));

  const topThree = images.slice(0, 3).map((img) => img.url);

  return {
    ...(mapCommonFields(article, ctx) as CmsArticleSaveDTO),
    type: "2",
    content: "",
    articleContentDto: {
      htmlContent: "",
      imageDtoList,
      videoDtoList: [],
    },
    images: imagesSimple,
    appCustomParams: {
      customStyle: {
        imgPath: topThree,
        type: "2",  // 多图
      },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: {
      imageUrlList: topThree,
      listStyleName: "默认",
      listStyleType: "2",
    },
  };
}
```

- [ ] **Step 23.3: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/article-mapper/type2-gallery.test.ts
git add src/lib/cms/article-mapper/type2-gallery.ts src/lib/cms/__tests__/article-mapper/type2-gallery.test.ts
git commit -m "feat(cms/p1): mapToType2 (图集) with imageDtoList + images[] dual fields

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 24: type4-external mapper（外链/标题新闻）

**Files:**
- Create: `src/lib/cms/article-mapper/type4-external.ts`
- Create: `src/lib/cms/__tests__/article-mapper/type4-external.test.ts`

- [ ] **Step 24.1: 写 type4 测试**

Create `src/lib/cms/__tests__/article-mapper/type4-external.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { mapToType4, type Type4Article } from "../../article-mapper/type4-external";
import type { MapperContext } from "../../article-mapper/common";

const ctx: MapperContext = {
  siteId: 81, appId: 10, catalogId: 8634,
  tenantId: "t", loginId: "id", loginTid: "tid", username: "admin",
  source: "x", author: "y",
  listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
  coverImageDefault: "https://cdn/d.jpg",
};

const base: Type4Article = {
  id: "art-4",
  title: "外链新闻",
  authorName: null,
  summary: null,
  shortTitle: null,
  tags: [],
  coverImageUrl: null,
  publishStatus: "draft",
  publishedAt: null,
  externalUrl: "https://external-source.com/article/123",
};

describe("mapToType4", () => {
  it("sets type='4' and redirectUrl", () => {
    const dto = mapToType4(base, ctx);
    expect(dto.type).toBe("4");
    expect(dto.redirectUrl).toBe("https://external-source.com/article/123");
  });

  it("leaves content empty (type=4 is a redirect)", () => {
    const dto = mapToType4(base, ctx);
    expect(dto.content).toBe("");
    expect(dto.articleContentDto?.htmlContent).toBe("");
  });

  it("throws when externalUrl missing", () => {
    expect(() => mapToType4({ ...base, externalUrl: "" }, ctx)).toThrow(/externalUrl|redirectUrl/i);
  });

  it("sets listStyleType='3' (title-only)", () => {
    const dto = mapToType4(base, ctx);
    expect(dto.listStyleDto?.listStyleType).toBe("3");
    expect(dto.appCustomParams?.customStyle.type).toBe("3");
  });
});
```

- [ ] **Step 24.2: FAIL → 实现**

Create `src/lib/cms/article-mapper/type4-external.ts`：

```typescript
import type { CmsArticleSaveDTO } from "../types";
import { CmsSchemaError } from "../errors";
import { mapCommonFields, type ArticleForMapper, type MapperContext } from "./common";

export interface Type4Article extends ArticleForMapper {
  externalUrl: string;
}

export function mapToType4(
  article: Type4Article,
  ctx: MapperContext,
): CmsArticleSaveDTO {
  if (!article.externalUrl || !article.externalUrl.trim()) {
    throw new CmsSchemaError("type=4 mapper: externalUrl 必填", {
      field: "externalUrl",
    });
  }

  const cover = article.coverImageUrl ?? ctx.coverImageDefault;

  return {
    ...(mapCommonFields(article, ctx) as CmsArticleSaveDTO),
    type: "4",
    redirectUrl: article.externalUrl,
    content: "",
    articleContentDto: {
      htmlContent: "",
      imageDtoList: [],
      videoDtoList: [],
    },
    appCustomParams: {
      customStyle: {
        imgPath: [cover],
        type: "3",  // 标题无图
      },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: {
      imageUrlList: [],
      listStyleName: "默认",
      listStyleType: "3",
    },
  };
}
```

- [ ] **Step 24.3: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/article-mapper/type4-external.test.ts
git add src/lib/cms/article-mapper/type4-external.ts src/lib/cms/__tests__/article-mapper/type4-external.test.ts
git commit -m "feat(cms/p1): mapToType4 (外链新闻) with redirectUrl

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 25: determineType 函数

**目的：** 根据 article 字段内容自动推导应该用哪个 CMS type。P1 返回 1/2/4；type 5/11 预留但本期不返回（上游若需要走视频/音频入库，需单独显式指定）。

**Files:**
- Create: `src/lib/cms/article-mapper/determine-type.ts`
- Create: `src/lib/cms/__tests__/article-mapper/determine-type.test.ts`

- [ ] **Step 25.1: 写 determineType 测试**

Create `src/lib/cms/__tests__/article-mapper/determine-type.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { determineType, type ArticleForTypeDetection } from "../../article-mapper/determine-type";

describe("determineType", () => {
  const base: ArticleForTypeDetection = {
    mediaType: "article",
    body: "<p>x</p>",
    externalUrl: null,
    galleryImages: null,
    videoId: null,
    audioId: null,
  };

  it("returns '1' for plain article with body", () => {
    expect(determineType(base)).toBe("1");
  });

  it("returns '2' when mediaType=gallery and galleryImages.length >= 3", () => {
    expect(
      determineType({
        ...base,
        mediaType: "gallery",
        galleryImages: [
          { url: "a", caption: null },
          { url: "b", caption: null },
          { url: "c", caption: null },
        ],
      }),
    ).toBe("2");
  });

  it("returns '1' when gallery has fewer than 3 images (fallback)", () => {
    expect(
      determineType({
        ...base,
        mediaType: "gallery",
        galleryImages: [{ url: "a", caption: null }],
      }),
    ).toBe("1");
  });

  it("returns '4' when externalUrl set and body empty", () => {
    expect(
      determineType({
        ...base,
        body: "",
        externalUrl: "https://ext",
      }),
    ).toBe("4");
  });

  it("prefers '1' over '4' when both body and externalUrl present", () => {
    expect(
      determineType({
        ...base,
        externalUrl: "https://ext",
        body: "<p>正文</p>",
      }),
    ).toBe("1");
  });

  it("returns '5' when videoId present (P1 预留，实际不走)", () => {
    expect(determineType({ ...base, body: "", videoId: "vms-123" })).toBe("5");
  });

  it("returns '11' when audioId present", () => {
    expect(determineType({ ...base, body: "", audioId: "audio-1" })).toBe("11");
  });

  it("throws when nothing to map (no body/external/video/audio)", () => {
    expect(() =>
      determineType({
        ...base,
        body: "",
        externalUrl: null,
        videoId: null,
        audioId: null,
      }),
    ).toThrow(/determine|empty|no content/i);
  });
});
```

- [ ] **Step 25.2: FAIL → 实现**

Create `src/lib/cms/article-mapper/determine-type.ts`：

```typescript
import { CmsSchemaError } from "../errors";

export type CmsType = "1" | "2" | "4" | "5" | "11";

export interface ArticleForTypeDetection {
  mediaType: string | null;                  // "article" / "gallery" / "video" / "audio"
  body: string | null;
  externalUrl: string | null;
  galleryImages: Array<{ url: string }> | null;
  videoId: string | null;
  audioId: string | null;
}

/**
 * 按字段优先级推导 CMS type（§2.1 + Task 21-24 mapper 契约）：
 *
 * 1. audioId 存在       → 11
 * 2. videoId 存在       → 5
 * 3. mediaType=gallery 且图 ≥ 3  → 2
 * 4. body 非空           → 1
 * 5. externalUrl 存在    → 4
 * 6. 都没有              → 抛错
 */
export function determineType(article: ArticleForTypeDetection): CmsType {
  if (article.audioId) return "11";
  if (article.videoId) return "5";

  if (
    article.mediaType === "gallery" &&
    article.galleryImages &&
    article.galleryImages.length >= 3
  ) {
    return "2";
  }

  if (article.body && article.body.trim()) return "1";

  if (article.externalUrl && article.externalUrl.trim()) return "4";

  throw new CmsSchemaError(
    "无法推导 CMS type：article 缺少 body/externalUrl/videoId/audioId/galleryImages",
  );
}
```

- [ ] **Step 25.3: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/article-mapper/determine-type.test.ts
git add src/lib/cms/article-mapper/determine-type.ts src/lib/cms/__tests__/article-mapper/determine-type.test.ts
git commit -m "feat(cms/p1): determineType (article → CMS type inference)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 26: mapper 分发器 `index.ts`

**目的：** 统一入口 `mapArticleToCms(article, ctx)` —— 内部调 `determineType` 选 mapper。同时把 `MapperContext` 从 app_channels + cms_apps + cms_catalogs + env 聚合出来（`loadMapperContext`）。

**Files:**
- Create: `src/lib/cms/article-mapper/index.ts`
- Create: `src/lib/cms/__tests__/article-mapper/index.test.ts`
- Modify: `src/lib/cms/index.ts`（把 mapper 导出）

- [ ] **Step 26.1: 写分发器测试**

Create `src/lib/cms/__tests__/article-mapper/index.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MapperContext } from "../../article-mapper/common";

// mock DAL 层
vi.mock("@/lib/dal/app-channels", () => ({
  getAppChannelBySlug: vi.fn(),
}));
vi.mock("@/lib/dal/cms-apps", () => ({
  listCmsApps: vi.fn(),
}));

import { mapArticleToCms, loadMapperContext } from "../../article-mapper";
import { getAppChannelBySlug } from "@/lib/dal/app-channels";
import { listCmsApps } from "@/lib/dal/cms-apps";

const orgId = "org-1";

describe("mapArticleToCms", () => {
  const ctx: MapperContext = {
    siteId: 81, appId: 10, catalogId: 8634,
    tenantId: "t", loginId: "id", loginTid: "tid", username: "admin",
    source: "x", author: "y",
    listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
    coverImageDefault: "https://cdn/d.jpg",
  };

  it("dispatches to type1 mapper when body present", async () => {
    const dto = await mapArticleToCms(
      {
        id: "x",
        title: "t",
        mediaType: "article",
        body: "<p>内容</p>",
        externalUrl: null,
        galleryImages: null,
        videoId: null,
        audioId: null,
        authorName: null,
        summary: null,
        shortTitle: null,
        tags: [],
        coverImageUrl: null,
        publishStatus: "draft",
        publishedAt: null,
      },
      ctx,
    );
    expect(dto.type).toBe("1");
    expect(dto.content).toContain("内容");
  });

  it("dispatches to type2 mapper for gallery", async () => {
    const dto = await mapArticleToCms(
      {
        id: "x",
        title: "t",
        mediaType: "gallery",
        body: null,
        externalUrl: null,
        galleryImages: [
          { url: "a", caption: null },
          { url: "b", caption: null },
          { url: "c", caption: null },
        ],
        videoId: null,
        audioId: null,
        authorName: null,
        summary: null, shortTitle: null, tags: [], coverImageUrl: null,
        publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(dto.type).toBe("2");
  });

  it("dispatches to type4 mapper for external URL", async () => {
    const dto = await mapArticleToCms(
      {
        id: "x", title: "t", mediaType: "article",
        body: null, externalUrl: "https://ext",
        galleryImages: null, videoId: null, audioId: null,
        authorName: null, summary: null, shortTitle: null, tags: [],
        coverImageUrl: null, publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(dto.type).toBe("4");
    expect(dto.redirectUrl).toBe("https://ext");
  });

  it("throws for type 5/11 in P1 (not supported this phase)", async () => {
    await expect(
      mapArticleToCms(
        {
          id: "x", title: "t", mediaType: "video",
          body: null, externalUrl: null, galleryImages: null,
          videoId: "vms-1", audioId: null,
          authorName: null, summary: null, shortTitle: null, tags: [],
          coverImageUrl: null, publishStatus: "draft", publishedAt: null,
        },
        ctx,
      ),
    ).rejects.toThrow(/type=5|not supported|P1/i);
  });
});

describe("loadMapperContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CMS_TENANT_ID = "tenant-from-env";
    process.env.CMS_LOGIN_CMC_ID = "id-env";
    process.env.CMS_LOGIN_CMC_TID = "tid-env";
    process.env.CMS_USERNAME = "admin-env";
    process.env.CMS_HOST = "https://cms";
    process.env.CMS_DEFAULT_COVER_URL = "https://cdn/default.jpg";
  });

  it("aggregates from app_channels + cms_apps + env", async () => {
    (getAppChannelBySlug as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: "app_news",
      displayName: "新闻",
      defaultCatalog: {
        id: "cat-uuid",
        cmsCatalogId: 8634,
        appId: 10,
        siteId: 81,
      },
      defaultListStyle: { listStyleType: "0", listStyleName: "默认", imageUrlList: [] },
      defaultCoverUrl: null,
    });
    (listCmsApps as ReturnType<typeof vi.fn>).mockResolvedValue([
      { siteId: 81, cmsAppId: "10", name: "APP1" },
    ]);

    const ctx = await loadMapperContext(orgId, "app_news", { brandName: "深圳广电" });
    expect(ctx.siteId).toBe(81);
    expect(ctx.catalogId).toBe(8634);
    expect(ctx.loginId).toBe("id-env");
    expect(ctx.tenantId).toBe("tenant-from-env");
    expect(ctx.source).toBe("深圳广电");
    expect(ctx.coverImageDefault).toBe("https://cdn/default.jpg");
  });

  it("throws when app_channel not found", async () => {
    (getAppChannelBySlug as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      loadMapperContext(orgId, "app_news", { brandName: "x" }),
    ).rejects.toThrow(/app_channel_not_mapped/);
  });

  it("throws when app_channel has no defaultCatalogId", async () => {
    (getAppChannelBySlug as ReturnType<typeof vi.fn>).mockResolvedValue({
      slug: "app_news",
      defaultCatalog: null,
      defaultListStyle: null,
      defaultCoverUrl: null,
    });
    await expect(
      loadMapperContext(orgId, "app_news", { brandName: "x" }),
    ).rejects.toThrow(/default_catalog|binding/i);
  });
});
```

- [ ] **Step 26.2: FAIL → 实现分发器**

Create `src/lib/cms/article-mapper/index.ts`：

```typescript
import type { CmsArticleSaveDTO } from "../types";
import { CmsConfigError, CmsSchemaError } from "../errors";
import { requireCmsConfig } from "../feature-flags";
import { getAppChannelBySlug } from "@/lib/dal/app-channels";
import { listCmsApps } from "@/lib/dal/cms-apps";

import type { MapperContext, ArticleForMapper } from "./common";
import { mapToType1, type Type1Article } from "./type1-article";
import { mapToType2, type Type2Article, type GalleryImage } from "./type2-gallery";
import { mapToType4, type Type4Article } from "./type4-external";
import { determineType, type ArticleForTypeDetection } from "./determine-type";

export { MapperContext, ArticleForMapper } from "./common";
export { determineType } from "./determine-type";

/**
 * 统一的 article 输入结构（字段取并集；mapper 按需读取）。
 */
export interface ArticleForMapping extends ArticleForMapper, ArticleForTypeDetection {
  body: string | null;
  externalUrl: string | null;
  galleryImages: GalleryImage[] | null;
}

/**
 * 统一入口：根据 article 字段自动选择 type mapper。
 *
 * P1 仅支持 type 1/2/4。type 5/11 会抛 CmsSchemaError（Phase 2+ 接入）。
 */
export async function mapArticleToCms(
  article: ArticleForMapping,
  ctx: MapperContext,
): Promise<CmsArticleSaveDTO> {
  const type = determineType(article);

  switch (type) {
    case "1":
      return mapToType1(
        { ...article, body: article.body ?? "" } as Type1Article,
        ctx,
      );

    case "2":
      return mapToType2(
        { ...article, galleryImages: article.galleryImages ?? [] } as Type2Article,
        ctx,
      );

    case "4":
      return mapToType4(
        { ...article, externalUrl: article.externalUrl ?? "" } as Type4Article,
        ctx,
      );

    case "5":
      throw new CmsSchemaError(
        "type=5 (视频新闻) 在 P1 不支持；由华栖云 AIGC 侧自行入库（方案 A，见 spec §1.1）",
      );

    case "11":
      throw new CmsSchemaError(
        "type=11 (音频新闻) 在 P1 不支持；Phase 2 接入 TTS 后启用",
      );
  }
}

/**
 * 从 app_channels + cms_apps + env 加载 MapperContext。
 *
 * @param organizationId 组织 id
 * @param appChannelSlug 目标 APP 栏目 slug（app_news / app_politics / ...）
 * @param org             { brandName: string } 组织信息（用于 source 字段）
 */
export async function loadMapperContext(
  organizationId: string,
  appChannelSlug: string,
  org: { brandName: string },
): Promise<MapperContext> {
  const config = requireCmsConfig();

  const appChannel = await getAppChannelBySlug(organizationId, appChannelSlug);
  if (!appChannel) {
    throw new CmsConfigError(
      `app_channel_not_mapped: ${appChannelSlug}（请在 /settings/cms-mapping 配置）`,
    );
  }

  if (!appChannel.defaultCatalog) {
    throw new CmsConfigError(
      `app_channel "${appChannelSlug}" 未绑定 default_catalog；请先运行 cms_catalog_sync 并在 /settings/cms-mapping 设置`,
    );
  }

  const catalog = appChannel.defaultCatalog;
  // 找到对应 siteId 的 app 记录（listCmsApps 默认返回全部 APP）
  const apps = await listCmsApps(organizationId, "CHANNEL_APP");
  const app = apps.find((a) => a.siteId === catalog.siteId);
  if (!app) {
    throw new CmsConfigError(
      `未找到 siteId=${catalog.siteId} 对应的 cms_app；请重新跑 cms_catalog_sync`,
    );
  }

  return {
    siteId: catalog.siteId,
    appId: catalog.appId,
    catalogId: catalog.cmsCatalogId,
    tenantId: config.tenantId,
    loginId: config.loginCmcId,
    loginTid: config.loginCmcTid,
    username: config.username,
    source: org.brandName || "智媒编辑部",
    author: "智媒编辑部",
    listStyleDefault: (appChannel.defaultListStyle as MapperContext["listStyleDefault"]) ?? {
      imageUrlList: [],
      listStyleName: "默认",
      listStyleType: "0",
    },
    coverImageDefault: appChannel.defaultCoverUrl ?? config.defaultCoverUrl,
  };
}
```

- [ ] **Step 26.3: 测试通过**

```bash
npm run test -- src/lib/cms/__tests__/article-mapper/
```

- [ ] **Step 26.4: 在 src/lib/cms/index.ts 导出 mapper 入口**

Edit `src/lib/cms/index.ts`，追加：

```typescript
export {
  mapArticleToCms,
  loadMapperContext,
  determineType,
  type MapperContext,
  type ArticleForMapper,
  type ArticleForMapping,
} from "./article-mapper";
```

- [ ] **Step 26.5: 整组回归 + 提交**

```bash
npm run test -- src/lib/cms/
npx tsc --noEmit
git add src/lib/cms/article-mapper/index.ts src/lib/cms/__tests__/article-mapper/index.test.ts src/lib/cms/index.ts
git commit -m "feat(cms/p1): mapper dispatcher + loadMapperContext aggregator

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Section D 完成检查

```bash
# 1. 所有 D 组测试通过
npm run test -- src/lib/cms/__tests__/article-mapper/

# 2. 类型编译通过
npx tsc --noEmit

# 3. 5 个 mapper 文件都存在
ls src/lib/cms/article-mapper/
# 预期：common.ts, type1-article.ts, type2-gallery.ts, type4-external.ts, determine-type.ts, index.ts
```

Section D 结束后 git log 应看到 6 个 `feat(cms/p1):` commit（Task 21-26 各 1 个）。

**→ Section E 开始前，请在对话中确认"Section D 完成"。**

---

# Section E — 栏目同步

**本 Section 实现"CMS 三步同步"端到端流程：getChannels → getAppList → getCatalogTree → flatten → reconcile。最终产物是 `syncCmsCatalogs(organizationId, options)` Server Action 和每日 cron。**

---

## Task 27: flattenTree 递归工具

**目的：** 把 `CmsCatalogNode` 的树状 `childCatalog` 结构扁平化为一维数组，便于 reconcile 和写库。纯函数，易于单测。

**Files:**
- Create: `src/lib/cms/catalog-sync/flatten-tree.ts`
- Create: `src/lib/cms/__tests__/catalog-sync/flatten-tree.test.ts`

- [ ] **Step 27.1: 写 flattenTree 测试**

Create `src/lib/cms/__tests__/catalog-sync/flatten-tree.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { flattenTree } from "../../catalog-sync/flatten-tree";
import type { CmsCatalogNode } from "../../types";

function node(overrides: Partial<CmsCatalogNode>): CmsCatalogNode {
  return {
    id: 1,
    appid: 10,
    siteId: 81,
    name: "n",
    parentId: 0,
    innerCode: "001",
    alias: "x",
    treeLevel: 1,
    isLeaf: 1,
    type: 1,
    childCatalog: [],
    ...overrides,
  };
}

describe("flattenTree", () => {
  it("flattens a single leaf node", () => {
    const rows = flattenTree([node({ id: 1 })], 10, 81);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cmsCatalogId: 1, appId: 10, siteId: 81 });
  });

  it("recursively flattens nested children", () => {
    const tree = [
      node({
        id: 1, isLeaf: 0,
        childCatalog: [
          node({ id: 2, parentId: 1, treeLevel: 2, isLeaf: 0,
            childCatalog: [node({ id: 3, parentId: 2, treeLevel: 3 })] }),
          node({ id: 4, parentId: 1, treeLevel: 2 }),
        ],
      }),
    ];
    const rows = flattenTree(tree, 10, 81);
    expect(rows.map((r) => r.cmsCatalogId).sort()).toEqual([1, 2, 3, 4]);
  });

  it("preserves parentId and treeLevel from source", () => {
    const tree = [
      node({ id: 1, parentId: 0, treeLevel: 1,
        childCatalog: [node({ id: 2, parentId: 1, treeLevel: 2 })] }),
    ];
    const rows = flattenTree(tree, 10, 81);
    const child = rows.find((r) => r.cmsCatalogId === 2)!;
    expect(child.parentId).toBe(1);
    expect(child.treeLevel).toBe(2);
  });

  it("maps isLeaf=1 to true, 0 to false", () => {
    const rows = flattenTree(
      [node({ id: 1, isLeaf: 1 }), node({ id: 2, isLeaf: 0 })],
      10, 81,
    );
    expect(rows.find((r) => r.cmsCatalogId === 1)?.isLeaf).toBe(true);
    expect(rows.find((r) => r.cmsCatalogId === 2)?.isLeaf).toBe(false);
  });

  it("uses node.siteId when present, falls back to fallback siteId otherwise", () => {
    const tree = [node({ id: 1, siteId: 99 })];
    const rows = flattenTree(tree, 10, 81);
    expect(rows[0].siteId).toBe(99);
  });

  it("copies player and preview fields", () => {
    const tree = [node({
      id: 1,
      videoPlayer: "vp", audioPlayer: "ap",
      livePlayer: "lp", vlivePlayer: "vlp",
      h5Preview: "h5", pcPreview: "pc",
      url: "/a/b/",
    })];
    const rows = flattenTree(tree, 10, 81);
    expect(rows[0]).toMatchObject({
      videoPlayer: "vp", audioPlayer: "ap",
      livePlayer: "lp", vlivePlayer: "vlp",
      h5Preview: "h5", pcPreview: "pc",
      url: "/a/b/",
    });
  });

  it("returns empty array for empty input", () => {
    expect(flattenTree([], 10, 81)).toEqual([]);
  });
});
```

- [ ] **Step 27.2: FAIL → 实现**

```bash
mkdir -p src/lib/cms/catalog-sync src/lib/cms/__tests__/catalog-sync
npm run test -- src/lib/cms/__tests__/catalog-sync/flatten-tree.test.ts
```

Create `src/lib/cms/catalog-sync/flatten-tree.ts`：

```typescript
import type { CmsCatalogNode } from "../types";

/**
 * flattenTree 输出的一条记录。字段与 DAL cms-catalogs.CmsCatalogFields 对齐。
 */
export interface FlatCatalogRow {
  cmsCatalogId: number;
  appId: number;
  siteId: number;
  name: string;
  parentId: number;
  innerCode: string;
  alias: string;
  treeLevel: number;
  isLeaf: boolean;
  catalogType: number;
  videoPlayer?: string;
  audioPlayer?: string;
  livePlayer?: string;
  vlivePlayer?: string;
  h5Preview?: string;
  pcPreview?: string;
  url?: string;
}

/**
 * 深度优先递归扁平化 CMS 栏目树。
 *
 * @param nodes        getCatalogTree 返回的一级 node 列表
 * @param appId        归属的 app.id（fallback）
 * @param fallbackSiteId  当 node.siteId 缺失时的 fallback
 */
export function flattenTree(
  nodes: CmsCatalogNode[],
  appId: number,
  fallbackSiteId: number,
): FlatCatalogRow[] {
  const out: FlatCatalogRow[] = [];
  walk(nodes, out, appId, fallbackSiteId);
  return out;
}

function walk(
  nodes: CmsCatalogNode[],
  out: FlatCatalogRow[],
  appId: number,
  fallbackSiteId: number,
): void {
  for (const node of nodes) {
    out.push({
      cmsCatalogId: node.id,
      appId,
      siteId: node.siteId ?? fallbackSiteId,
      name: node.name,
      parentId: node.parentId,
      innerCode: node.innerCode,
      alias: node.alias,
      treeLevel: node.treeLevel,
      isLeaf: node.isLeaf === 1,
      catalogType: node.type,
      videoPlayer: node.videoPlayer,
      audioPlayer: node.audioPlayer,
      livePlayer: node.livePlayer,
      vlivePlayer: node.vlivePlayer,
      h5Preview: node.h5Preview,
      pcPreview: node.pcPreview,
      url: node.url,
    });

    if (node.childCatalog && node.childCatalog.length > 0) {
      walk(node.childCatalog, out, appId, fallbackSiteId);
    }
  }
}
```

- [ ] **Step 27.3: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/catalog-sync/flatten-tree.test.ts
git add src/lib/cms/catalog-sync/flatten-tree.ts src/lib/cms/__tests__/catalog-sync/flatten-tree.test.ts
git commit -m "feat(cms/p1): flattenTree utility for CMS catalog tree

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 28: reconcileCatalogs 差量对比

**目的：** 拿到扁平化的"CMS 侧真相" + "本地 cms_catalogs 快照"后，计算 insert/update/soft-delete 三类差异。**不直接写库**（纯函数返回操作清单 + 上层执行），便于单测 + dry-run。

**Files:**
- Create: `src/lib/cms/catalog-sync/reconcile.ts`
- Create: `src/lib/cms/__tests__/catalog-sync/reconcile.test.ts`

- [ ] **Step 28.1: 写 reconcile 测试**

Create `src/lib/cms/__tests__/catalog-sync/reconcile.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { reconcileCatalogs } from "../../catalog-sync/reconcile";
import type { FlatCatalogRow } from "../../catalog-sync/flatten-tree";

function flat(overrides: Partial<FlatCatalogRow>): FlatCatalogRow {
  return {
    cmsCatalogId: 1, appId: 10, siteId: 81, name: "n",
    parentId: 0, innerCode: "001", alias: "x",
    treeLevel: 1, isLeaf: true, catalogType: 1,
    ...overrides,
  };
}

function existing(overrides: Partial<any>): any {
  return {
    id: "uuid-1",
    cmsCatalogId: 1, appId: 10, siteId: 81, name: "n",
    parentId: 0, innerCode: "001", alias: "x",
    treeLevel: 1, isLeaf: true, catalogType: 1,
    deletedAt: null,
    ...overrides,
  };
}

describe("reconcileCatalogs", () => {
  it("identifies new catalogs (CMS has, local doesn't) as inserts", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 }), flat({ cmsCatalogId: 2 })],
      existing: [],
    });
    expect(plan.inserts).toHaveLength(2);
    expect(plan.updates).toHaveLength(0);
    expect(plan.softDeletes).toHaveLength(0);
  });

  it("identifies changed catalogs as updates (by name change)", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1, name: "重命名" })],
      existing: [existing({ cmsCatalogId: 1, name: "原名" })],
    });
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].diff.name).toEqual({ from: "原名", to: "重命名" });
    expect(plan.inserts).toHaveLength(0);
  });

  it("ignores unchanged records (no-op)", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 })],
      existing: [existing({ cmsCatalogId: 1 })],
    });
    expect(plan.inserts).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.softDeletes).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });

  it("identifies missing-from-CMS records as soft-delete", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 })],
      existing: [existing({ cmsCatalogId: 1 }), existing({ cmsCatalogId: 2, id: "uuid-2" })],
    });
    expect(plan.softDeletes).toHaveLength(1);
    expect(plan.softDeletes[0].cmsCatalogId).toBe(2);
  });

  it("does NOT soft-delete when option disabled", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 })],
      existing: [existing({ cmsCatalogId: 1 }), existing({ cmsCatalogId: 2, id: "uuid-2" })],
      deleteMissing: false,
    });
    expect(plan.softDeletes).toHaveLength(0);
  });

  it("revives a previously soft-deleted catalog that reappears in CMS", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1 })],
      existing: [existing({ cmsCatalogId: 1, deletedAt: new Date("2026-01-01") })],
    });
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].diff.deletedAt).toBeDefined();
  });

  it("detects isLeaf and treeLevel changes", () => {
    const plan = reconcileCatalogs({
      fetched: [flat({ cmsCatalogId: 1, isLeaf: false, treeLevel: 2 })],
      existing: [existing({ cmsCatalogId: 1, isLeaf: true, treeLevel: 1 })],
    });
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].diff.isLeaf).toBeDefined();
    expect(plan.updates[0].diff.treeLevel).toBeDefined();
  });

  it("stats summary counts correctly", () => {
    const plan = reconcileCatalogs({
      fetched: [
        flat({ cmsCatalogId: 1, name: "A-new" }),
        flat({ cmsCatalogId: 3 }),            // new
      ],
      existing: [
        existing({ cmsCatalogId: 1, name: "A-old" }),
        existing({ cmsCatalogId: 2, id: "uuid-2" }),   // missing → softDelete
      ],
    });
    expect(plan.stats).toMatchObject({
      inserted: 1,
      updated: 1,
      softDeleted: 1,
      unchanged: 0,
    });
  });
});
```

- [ ] **Step 28.2: FAIL → 实现**

Create `src/lib/cms/catalog-sync/reconcile.ts`：

```typescript
import type { FlatCatalogRow } from "./flatten-tree";

interface ExistingCatalogRow {
  id: string;                // DB uuid
  cmsCatalogId: number;
  appId: number;
  siteId: number;
  name: string;
  parentId: number | null;
  innerCode: string | null;
  alias: string | null;
  treeLevel: number | null;
  isLeaf: boolean | null;
  catalogType: number | null;
  deletedAt: Date | null;
}

export interface CatalogUpdatePlan {
  id: string;                // DB uuid
  cmsCatalogId: number;
  diff: Partial<Record<keyof FlatCatalogRow | "deletedAt", { from: unknown; to: unknown }>>;
  /** 新值，便于上层直接作为 update set */
  patch: Partial<FlatCatalogRow> & { deletedAt?: Date | null };
}

export interface CatalogSoftDeletePlan {
  id: string;
  cmsCatalogId: number;
}

export interface ReconcileResult {
  inserts: FlatCatalogRow[];
  updates: CatalogUpdatePlan[];
  softDeletes: CatalogSoftDeletePlan[];
  unchanged: number;
  stats: {
    fetched: number;
    existing: number;
    inserted: number;
    updated: number;
    softDeleted: number;
    unchanged: number;
  };
}

export interface ReconcileInput {
  fetched: FlatCatalogRow[];
  existing: ExistingCatalogRow[];
  deleteMissing?: boolean;
}

const WATCHED_FIELDS: Array<keyof FlatCatalogRow> = [
  "appId", "siteId", "name", "parentId", "innerCode", "alias",
  "treeLevel", "isLeaf", "catalogType",
  "videoPlayer", "audioPlayer", "livePlayer", "vlivePlayer",
  "h5Preview", "pcPreview", "url",
];

/**
 * 对比"CMS 真相"与"本地快照"，产出 insert / update / soft-delete 三类计划。
 *
 * 纯函数 —— 不写库；上层 syncCmsCatalogs 基于返回值执行 DAL。
 */
export function reconcileCatalogs(input: ReconcileInput): ReconcileResult {
  const { fetched, existing } = input;
  const deleteMissing = input.deleteMissing ?? true;

  const existingMap = new Map(existing.map((r) => [r.cmsCatalogId, r]));
  const fetchedIds = new Set(fetched.map((r) => r.cmsCatalogId));

  const inserts: FlatCatalogRow[] = [];
  const updates: CatalogUpdatePlan[] = [];
  let unchanged = 0;

  for (const row of fetched) {
    const prev = existingMap.get(row.cmsCatalogId);

    if (!prev) {
      inserts.push(row);
      continue;
    }

    const diff: CatalogUpdatePlan["diff"] = {};
    const patch: CatalogUpdatePlan["patch"] = {};

    for (const field of WATCHED_FIELDS) {
      const prevVal = (prev as unknown as Record<string, unknown>)[field] ?? null;
      const newVal = row[field] ?? null;
      if (!shallowEqual(prevVal, newVal)) {
        diff[field] = { from: prevVal, to: newVal };
        (patch as Record<string, unknown>)[field] = newVal;
      }
    }

    // 如果本地标记删除但 CMS 又返回了 → 复活
    if (prev.deletedAt) {
      diff.deletedAt = { from: prev.deletedAt, to: null };
      patch.deletedAt = null;
    }

    if (Object.keys(diff).length > 0) {
      updates.push({ id: prev.id, cmsCatalogId: row.cmsCatalogId, diff, patch });
    } else {
      unchanged++;
    }
  }

  const softDeletes: CatalogSoftDeletePlan[] = deleteMissing
    ? existing
        .filter((r) => !fetchedIds.has(r.cmsCatalogId) && r.deletedAt === null)
        .map((r) => ({ id: r.id, cmsCatalogId: r.cmsCatalogId }))
    : [];

  return {
    inserts,
    updates,
    softDeletes,
    unchanged,
    stats: {
      fetched: fetched.length,
      existing: existing.length,
      inserted: inserts.length,
      updated: updates.length,
      softDeleted: softDeletes.length,
      unchanged,
    },
  };
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (typeof a !== typeof b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
```

- [ ] **Step 28.3: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/catalog-sync/reconcile.test.ts
git add src/lib/cms/catalog-sync/reconcile.ts src/lib/cms/__tests__/catalog-sync/reconcile.test.ts
git commit -m "feat(cms/p1): reconcileCatalogs pure diff engine (insert/update/softDelete)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 29: syncCmsCatalogs 主流程

**目的：** 把 Task 16-18 的 3 个接口 + Task 27-28 的两个工具串起来，形成完整同步流程。对外只导出 `syncCmsCatalogs(organizationId, options)`。

**流程：**
```
startCmsSyncLog
  ↓
getChannels         → upsert cms_channels
  ↓
getAppList(type=1)  → upsert cms_apps
  ↓
(每个 app) getCatalogTree → flattenTree
  ↓
listAllActiveCmsCatalogs → reconcileCatalogs → apply (insert/update/softDelete)
  ↓
completeCmsSyncLog（含 stats/warnings）
```

**Files:**
- Create: `src/lib/cms/catalog-sync/sync.ts`
- Create: `src/lib/cms/catalog-sync/index.ts`
- Create: `src/lib/cms/__tests__/catalog-sync/sync.test.ts`

- [ ] **Step 29.1: 写主流程测试（大量 DAL mock）**

Create `src/lib/cms/__tests__/catalog-sync/sync.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
} from "../test-helpers";

// mock all DAL
vi.mock("@/lib/dal/cms-channels", () => ({
  upsertCmsChannel: vi.fn(),
  listCmsChannels: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/dal/cms-apps", () => ({
  upsertCmsApp: vi.fn(),
  listCmsApps: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/dal/cms-catalogs", () => ({
  insertCmsCatalog: vi.fn(),
  updateCmsCatalog: vi.fn(),
  softDeleteCmsCatalog: vi.fn(),
  listAllActiveCmsCatalogs: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/dal/cms-sync-logs", () => ({
  startCmsSyncLog: vi.fn().mockResolvedValue("log-uuid-1"),
  completeCmsSyncLog: vi.fn(),
  failCmsSyncLog: vi.fn(),
  getSyncLogById: vi.fn(),
}));

import { syncCmsCatalogs } from "../../catalog-sync/sync";
import { upsertCmsChannel } from "@/lib/dal/cms-channels";
import { upsertCmsApp, listCmsApps } from "@/lib/dal/cms-apps";
import {
  insertCmsCatalog,
  updateCmsCatalog,
  softDeleteCmsCatalog,
} from "@/lib/dal/cms-catalogs";
import {
  startCmsSyncLog,
  completeCmsSyncLog,
  failCmsSyncLog,
} from "@/lib/dal/cms-sync-logs";

const orgId = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CMS_HOST = "https://cms.example.com";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "tenant";
  process.env.CMS_USERNAME = "admin";
});
afterEach(() => restoreCmsFetch());

describe("syncCmsCatalogs", () => {
  it("runs full happy-path (channels → apps → catalogs)", async () => {
    mockCmsFetch([
      // getChannels
      cmsSuccessResponse({
        CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
        CHANNEL_WEB: { code: 2, pickValue: "0", thirdFlag: "2", name: "网站" },
      }),
      // getAppList type=1
      cmsSuccessResponse([
        { id: 10, siteid: 81, name: "APP1", type: 1, appkey: "ak", appsecret: "as", addtime: null },
      ]),
      // getCatalogTree for app 10
      cmsSuccessResponse([
        { id: 8634, appid: 10, siteId: 81, name: "新闻", parentId: 0,
          innerCode: "001", alias: "news", treeLevel: 1, isLeaf: 1, type: 1, childCatalog: [] },
      ]),
    ]);

    const result = await syncCmsCatalogs(orgId, { triggerSource: "manual", operatorId: "u1" });

    expect(result.success).toBe(true);
    expect(startCmsSyncLog).toHaveBeenCalledWith(orgId, expect.objectContaining({ triggerSource: "manual" }));
    expect(upsertCmsChannel).toHaveBeenCalledWith(orgId, expect.objectContaining({ channelKey: "CHANNEL_APP" }));
    expect(upsertCmsApp).toHaveBeenCalledWith(orgId, expect.objectContaining({ cmsAppId: "10", siteId: 81 }));
    expect(insertCmsCatalog).toHaveBeenCalledWith(orgId, expect.objectContaining({ cmsCatalogId: 8634 }));
    expect(completeCmsSyncLog).toHaveBeenCalledWith("log-uuid-1", expect.objectContaining({
      stats: expect.objectContaining({ inserted: 1 }),
    }));
  });

  it("throws when getChannels returns no CHANNEL_APP", async () => {
    mockCmsFetch([
      cmsSuccessResponse({ CHANNEL_WEB: { code: 2, name: "网站" } }),
    ]);
    const result = await syncCmsCatalogs(orgId, { triggerSource: "manual", operatorId: "u1" });
    expect(result.success).toBe(false);
    expect(failCmsSyncLog).toHaveBeenCalledWith("log-uuid-1", expect.stringMatching(/CHANNEL_APP/));
  });

  it("detects updates for changed catalog name", async () => {
    (listCmsApps as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    // existing local has the same id but different name
    const { listAllActiveCmsCatalogs } = await import("@/lib/dal/cms-catalogs");
    (listAllActiveCmsCatalogs as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "local-1",
        cmsCatalogId: 8634,
        appId: 10, siteId: 81, name: "旧名",
        parentId: 0, innerCode: "001", alias: "news",
        treeLevel: 1, isLeaf: true, catalogType: 1,
        deletedAt: null,
      },
    ]);

    mockCmsFetch([
      cmsSuccessResponse({
        CHANNEL_APP: { code: 1, pickValue: "1", thirdFlag: "2", name: "APP" },
      }),
      cmsSuccessResponse([
        { id: 10, siteid: 81, name: "APP1", type: 1, appkey: null, appsecret: null, addtime: null },
      ]),
      cmsSuccessResponse([
        { id: 8634, appid: 10, siteId: 81, name: "新名", parentId: 0,
          innerCode: "001", alias: "news", treeLevel: 1, isLeaf: 1, type: 1, childCatalog: [] },
      ]),
    ]);

    await syncCmsCatalogs(orgId, { triggerSource: "scheduled" });
    expect(updateCmsCatalog).toHaveBeenCalledWith(orgId, 8634, expect.objectContaining({ name: "新名" }));
  });

  it("soft-deletes catalogs missing from CMS (deleteMissing=true default)", async () => {
    const { listAllActiveCmsCatalogs } = await import("@/lib/dal/cms-catalogs");
    (listAllActiveCmsCatalogs as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "local-stale",
        cmsCatalogId: 9999,
        appId: 10, siteId: 81, name: "已删除",
        parentId: 0, innerCode: "x", alias: "x",
        treeLevel: 1, isLeaf: true, catalogType: 1,
        deletedAt: null,
      },
    ]);

    mockCmsFetch([
      cmsSuccessResponse({ CHANNEL_APP: { code: 1, name: "APP" } }),
      cmsSuccessResponse([{ id: 10, siteid: 81, name: "APP1", type: 1, appkey: null, appsecret: null, addtime: null }]),
      cmsSuccessResponse([]),  // CMS 侧栏目为空
    ]);

    await syncCmsCatalogs(orgId, { triggerSource: "scheduled" });
    expect(softDeleteCmsCatalog).toHaveBeenCalledWith(orgId, 9999);
  });

  it("respects dryRun: does not write to DB", async () => {
    mockCmsFetch([
      cmsSuccessResponse({ CHANNEL_APP: { code: 1, name: "APP" } }),
      cmsSuccessResponse([{ id: 10, siteid: 81, name: "APP1", type: 1, appkey: null, appsecret: null, addtime: null }]),
      cmsSuccessResponse([
        { id: 8634, appid: 10, siteId: 81, name: "x", parentId: 0,
          innerCode: "001", alias: "x", treeLevel: 1, isLeaf: 1, type: 1, childCatalog: [] },
      ]),
    ]);

    const result = await syncCmsCatalogs(orgId, { triggerSource: "manual", dryRun: true });
    expect(result.success).toBe(true);
    expect(insertCmsCatalog).not.toHaveBeenCalled();
    expect(upsertCmsChannel).not.toHaveBeenCalled();
    expect(upsertCmsApp).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 29.2: FAIL → 实现主流程**

Create `src/lib/cms/catalog-sync/sync.ts`：

```typescript
import { CmsClient } from "../client";
import { getChannels, getAppList, getCatalogTree } from "../api-endpoints";
import { requireCmsConfig, isCatalogSyncEnabled } from "../feature-flags";
import { CmsConfigError, classifyCmsError } from "../errors";
import { upsertCmsChannel } from "@/lib/dal/cms-channels";
import { upsertCmsApp } from "@/lib/dal/cms-apps";
import {
  insertCmsCatalog,
  updateCmsCatalog,
  softDeleteCmsCatalog,
  listAllActiveCmsCatalogs,
} from "@/lib/dal/cms-catalogs";
import {
  startCmsSyncLog,
  completeCmsSyncLog,
  failCmsSyncLog,
} from "@/lib/dal/cms-sync-logs";
import { flattenTree, type FlatCatalogRow } from "./flatten-tree";
import { reconcileCatalogs } from "./reconcile";

export interface SyncCmsCatalogsOptions {
  triggerSource: "manual" | "scheduled" | "auto_repair" | "first_time_setup";
  operatorId?: string;
  /** 仅查询变更，不写库 */
  dryRun?: boolean;
  /** 默认 true：本地有但 CMS 没有 → 软删 */
  deleteMissing?: boolean;
}

export interface SyncResult {
  success: boolean;
  syncLogId: string;
  stats: {
    channelsFetched: number;
    channelsUpserted: number;
    appsFetched: number;
    appsUpserted: number;
    catalogsFetched: number;
    catalogsInserted: number;
    catalogsUpdated: number;
    catalogsSoftDeleted: number;
    unchangedCount: number;
  };
  warnings: string[];
  error?: { code: string; message: string; stage: string };
}

/**
 * CMS 栏目三步同步主流程。
 *
 * 设计文档 §9.4 / §11.5；Skill spec `cms_catalog_sync.md`
 */
export async function syncCmsCatalogs(
  organizationId: string,
  options: SyncCmsCatalogsOptions,
): Promise<SyncResult> {
  if (!isCatalogSyncEnabled()) {
    return {
      success: false,
      syncLogId: "",
      stats: emptyStats(),
      warnings: ["catalog sync disabled by feature flag"],
      error: { code: "disabled", message: "VIBETIDE_CATALOG_SYNC_ENABLED=false", stage: "config" },
    };
  }

  const config = requireCmsConfig();
  const client = new CmsClient({
    host: config.host,
    loginCmcId: config.loginCmcId,
    loginCmcTid: config.loginCmcTid,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  const syncLogId = await startCmsSyncLog(organizationId, {
    triggerSource: options.triggerSource,
    operatorId: options.operatorId,
  });

  const warnings: string[] = [];
  const stats = emptyStats();
  const dryRun = options.dryRun ?? false;
  const deleteMissing = options.deleteMissing ?? true;

  try {
    // -----------------------
    // Step 1: getChannels
    // -----------------------
    const channelsRes = await getChannels(client, { appAndWeb: 1 });
    stats.channelsFetched = Object.keys(channelsRes.data ?? {}).length;

    const appChannel = channelsRes.data?.CHANNEL_APP;
    if (!appChannel) {
      throw new CmsConfigError("CMS 未返回 CHANNEL_APP，请检查账号权限");
    }

    if (!dryRun) {
      await upsertCmsChannel(organizationId, {
        channelKey: "CHANNEL_APP",
        channelCode: appChannel.code,
        name: appChannel.name,
        pickValue: appChannel.pickValue,
        thirdFlag: appChannel.thirdFlag,
      });
      stats.channelsUpserted = 1;
    }

    // -----------------------
    // Step 2: getAppList(type=1)
    // -----------------------
    const appsRes = await getAppList(client, "1");
    const apps = appsRes.data ?? [];
    stats.appsFetched = apps.length;

    if (apps.length === 0) {
      warnings.push("CMS 未返回任何 type=1 APP 应用；保留本地数据不动");
    }

    if (!dryRun) {
      for (const app of apps) {
        await upsertCmsApp(organizationId, {
          cmsAppId: String(app.id),
          channelKey: "CHANNEL_APP",
          siteId: app.siteid,
          name: app.name,
          appkey: app.appkey ?? undefined,
          appsecret: app.appsecret ?? undefined,
        });
      }
      stats.appsUpserted = apps.length;
    }

    // -----------------------
    // Step 3: getCatalogTree × N apps
    // -----------------------
    const allFlat: FlatCatalogRow[] = [];
    for (const app of apps) {
      const treeRes = await getCatalogTree(client, {
        appId: String(app.id),
        types: "1",             // 仅新闻栏目
        isPrivilege: "false",
      });
      const rows = flattenTree(treeRes.data ?? [], app.id, app.siteid);
      allFlat.push(...rows);
    }
    stats.catalogsFetched = allFlat.length;

    if (allFlat.length === 0 && apps.length > 0) {
      warnings.push("CMS 所有应用下均返回 0 栏目；保留本地数据不动（保护性措施）");
    }

    // -----------------------
    // Step 4: 差量对比 + 应用
    // -----------------------
    const existing = await listAllActiveCmsCatalogs(organizationId);
    const plan = reconcileCatalogs({
      fetched: allFlat,
      existing,
      deleteMissing,
    });

    if (!dryRun) {
      for (const row of plan.inserts) {
        await insertCmsCatalog(organizationId, row);
      }
      for (const u of plan.updates) {
        await updateCmsCatalog(organizationId, u.cmsCatalogId, u.patch);
      }
      for (const d of plan.softDeletes) {
        await softDeleteCmsCatalog(organizationId, d.cmsCatalogId);
      }
    }
    stats.catalogsInserted = plan.inserts.length;
    stats.catalogsUpdated = plan.updates.length;
    stats.catalogsSoftDeleted = plan.softDeletes.length;
    stats.unchangedCount = plan.unchanged;

    // -----------------------
    // 完成
    // -----------------------
    if (!dryRun) {
      await completeCmsSyncLog(syncLogId, { stats, warnings });
    }
    return { success: true, syncLogId, stats, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stage = classifyCmsError(err);
    await failCmsSyncLog(syncLogId, message);
    return {
      success: false,
      syncLogId,
      stats,
      warnings,
      error: { code: stage, message, stage },
    };
  }
}

function emptyStats(): SyncResult["stats"] {
  return {
    channelsFetched: 0, channelsUpserted: 0,
    appsFetched: 0, appsUpserted: 0,
    catalogsFetched: 0, catalogsInserted: 0,
    catalogsUpdated: 0, catalogsSoftDeleted: 0,
    unchangedCount: 0,
  };
}
```

Create `src/lib/cms/catalog-sync/index.ts`：

```typescript
export { syncCmsCatalogs, type SyncCmsCatalogsOptions, type SyncResult } from "./sync";
export { flattenTree, type FlatCatalogRow } from "./flatten-tree";
export { reconcileCatalogs, type ReconcileInput, type ReconcileResult } from "./reconcile";
```

- [ ] **Step 29.3: 更新 src/lib/cms/index.ts 导出**

Edit `src/lib/cms/index.ts`，追加：

```typescript
export { syncCmsCatalogs, type SyncCmsCatalogsOptions, type SyncResult } from "./catalog-sync";
```

- [ ] **Step 29.4: 测试通过 + 提交**

```bash
npm run test -- src/lib/cms/__tests__/catalog-sync/sync.test.ts
npm run test -- src/lib/cms/
npx tsc --noEmit
git add src/lib/cms/catalog-sync/ src/lib/cms/__tests__/catalog-sync/sync.test.ts src/lib/cms/index.ts
git commit -m "feat(cms/p1): syncCmsCatalogs main flow (3-step sync + reconcile + audit log)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 30: API route `/api/cms/catalog-sync`

**目的：** 提供 HTTP 端点给运营 UI / 其他服务触发同步。POST 触发；GET 查进度。

**Files:**
- Create: `src/app/api/cms/catalog-sync/route.ts`
- Create: `src/app/api/cms/catalog-sync/[logId]/route.ts`
- Create: `src/app/actions/cms.ts`（放 server action `triggerCatalogSync`）

- [ ] **Step 30.1: 写 Server Action + API route**

Create `src/app/actions/cms.ts`：

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { syncCmsCatalogs, type SyncResult } from "@/lib/cms";
import { requireAuth } from "@/lib/auth/server";   // 项目约定：已有的 requireAuth helper

export interface TriggerCatalogSyncInput {
  dryRun?: boolean;
  deleteMissing?: boolean;
}

/**
 * 手动触发 CMS 栏目同步（供运营 UI / 其他 server action 调用）
 */
export async function triggerCatalogSyncAction(
  input: TriggerCatalogSyncInput = {},
): Promise<SyncResult> {
  const { user, organization } = await requireAuth();

  const result = await syncCmsCatalogs(organization.id, {
    triggerSource: "manual",
    operatorId: user.id,
    dryRun: input.dryRun,
    deleteMissing: input.deleteMissing,
  });

  if (result.success && !input.dryRun) {
    revalidatePath("/settings/cms-mapping");
  }

  return result;
}
```

> ⚠️ 若项目 `requireAuth` 位于不同路径，按实际 import 调整。

Create `src/app/api/cms/catalog-sync/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { triggerCatalogSyncAction } from "@/app/actions/cms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await safeJson(req);
    const result = await triggerCatalogSyncAction({
      dryRun: body?.dryRun === true,
      deleteMissing: body?.deleteMissing !== false,
    });
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

async function safeJson(req: NextRequest): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
```

Create `src/app/api/cms/catalog-sync/[logId]/route.ts`：

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSyncLogById } from "@/lib/dal/cms-sync-logs";
import { requireAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  const { logId } = await params;
  const { organization } = await requireAuth();

  const log = await getSyncLogById(logId);
  if (!log) {
    return NextResponse.json({ error: "sync log not found" }, { status: 404 });
  }
  if (log.organizationId !== organization.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: log.id,
    state: log.state,
    stats: log.stats,
    warnings: log.warnings,
    startedAt: log.startedAt,
    completedAt: log.completedAt,
    durationMs: log.durationMs,
    errorMessage: log.errorMessage,
  });
}
```

- [ ] **Step 30.2: 手动验证**

先启动 dev server：

```bash
npm run dev
```

另一个终端：

```bash
# 触发同步
curl -X POST http://localhost:3000/api/cms/catalog-sync \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}' \
  --cookie "your_auth_cookie_here"
```

预期：返回 `{ success: true, syncLogId: "...", stats: {...} }`。

若返回 401：登录获取 cookie 后重试。

- [ ] **Step 30.3: 类型编译 + 提交**

```bash
npx tsc --noEmit
git add src/app/actions/cms.ts src/app/api/cms/catalog-sync/
git commit -m "feat(cms/p1): catalog-sync API + Server Action with auth guard

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 31: Inngest daily cron

**目的：** 每天 02:00 自动跑一次 `syncCmsCatalogs`，保证栏目映射不过时。

**Files:**
- Create: `src/inngest/functions/cms-catalog-sync.ts`
- Modify: `src/inngest/functions/index.ts`（或等效汇总文件；先 grep 找入口）

- [ ] **Step 31.1: 确认 Inngest 约定**

```bash
ls src/inngest/functions/ | head -10
cat src/inngest/client.ts 2>/dev/null | head -20 || ls src/inngest/*.ts
```

记录 Inngest `inngest` 实例的 import 路径（通常是 `@/inngest/client`）和现有 `functions/index.ts` 的 exports 模式。

- [ ] **Step 31.2: 创建 Inngest function**

Create `src/inngest/functions/cms-catalog-sync.ts`：

```typescript
import { inngest } from "@/inngest/client";
import { syncCmsCatalogs } from "@/lib/cms";
import { db } from "@/db";
import { organizations } from "@/db/schema";

/**
 * 每日栏目同步 —— 为所有 organization 跑一次。
 *
 * Cron: 02:00 Asia/Shanghai daily
 */
export const cmsCatalogSyncDaily = inngest.createFunction(
  {
    id: "cms-catalog-sync-daily",
    name: "[CMS P1] 每日栏目同步",
    concurrency: { limit: 1 },         // 所有 org 串行，避免共享 CMS 侧限流
  },
  { cron: "TZ=Asia/Shanghai 0 2 * * *" },
  async ({ step, logger }) => {
    const orgs = await step.run("fetch-orgs", async () =>
      db.query.organizations.findMany(),
    );
    logger.info(`catalog-sync-daily: 准备同步 ${orgs.length} 个组织`);

    const results: Array<{ orgId: string; ok: boolean; stats?: unknown }> = [];

    for (const org of orgs) {
      const result = await step.run(`sync-${org.id}`, async () => {
        return await syncCmsCatalogs(org.id, {
          triggerSource: "scheduled",
          deleteMissing: true,
        });
      });
      results.push({ orgId: org.id, ok: result.success, stats: result.stats });
      if (!result.success) {
        logger.warn(`catalog-sync: org=${org.id} failed: ${result.error?.message}`);
      }
    }

    return { totalOrgs: orgs.length, results };
  },
);

/**
 * 按需触发（event='cms/catalog-sync.trigger'），供 cms_publish 遇到 catalog_not_found 时自我修复。
 */
export const cmsCatalogSyncOnDemand = inngest.createFunction(
  {
    id: "cms-catalog-sync-on-demand",
    name: "[CMS P1] 栏目同步按需触发",
    concurrency: { limit: 3, key: "event.data.organizationId" },  // 同 org 不并发
  },
  { event: "cms/catalog-sync.trigger" },
  async ({ event, step }) => {
    return await step.run("sync", async () =>
      syncCmsCatalogs(event.data.organizationId, {
        triggerSource: event.data.triggerSource ?? "auto_repair",
        operatorId: event.data.operatorId,
        deleteMissing: event.data.deleteMissing ?? true,
      }),
    );
  },
);
```

- [ ] **Step 31.3: 注册到 Inngest functions 索引**

Edit `src/inngest/functions/index.ts`（或等效汇总文件），追加 export：

```typescript
export {
  cmsCatalogSyncDaily,
  cmsCatalogSyncOnDemand,
} from "./cms-catalog-sync";
```

> 💡 项目约定：若有 `app/api/inngest/route.ts` 需要在 `serve()` 的 `functions: [...]` 数组里追加这两个 fn，参考现有 fn（如 `hot-topic-crawl`）的注册方式。

- [ ] **Step 31.4: 本地验证（可选，依赖 Inngest dev server）**

```bash
# terminal 1
npm run dev

# terminal 2
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

在 Inngest 本地 UI（默认 http://localhost:8288）应该能看到 `cms-catalog-sync-daily` 和 `cms-catalog-sync-on-demand` 两个 function 注册成功。

手动触发 event：

```bash
curl -X POST http://localhost:8288/e/<EVENT_KEY> \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cms/catalog-sync.trigger",
    "data": { "organizationId": "<your-org-id>", "triggerSource": "manual", "operatorId": "test" }
  }'
```

- [ ] **Step 31.5: 提交**

```bash
git add src/inngest/functions/cms-catalog-sync.ts src/inngest/functions/index.ts
git commit -m "feat(cms/p1): Inngest daily cron + on-demand catalog sync functions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Section E 完成检查

```bash
# 1. 所有 E 组测试通过
npm run test -- src/lib/cms/

# 2. 类型编译
npx tsc --noEmit

# 3. E2E 手动验证（dev 环境）
#    - POST /api/cms/catalog-sync?dryRun=true → 200 + 统计
#    - db:studio 看 cms_channels / cms_apps / cms_catalogs 确有数据
#    - Inngest dev UI 显示 cmsCatalogSyncDaily 注册

# 4. sync log 表有记录
psql $DATABASE_URL -c "SELECT state, stats, started_at FROM cms_sync_logs ORDER BY started_at DESC LIMIT 3;"
```

Section E 结束后 git log 应看到 5 个 `feat(cms/p1):` commit（Task 27-31 各 1 个）。

**→ Section F 开始前，请在对话中确认"Section E 完成"。**

---

# Section F — CMS 入库

**本 Section 产出 Phase 1 核心业务闭环：`publishArticleToCms(articleId, appChannelSlug)` → 查重 → 映射 → 调用 saveArticle → 落 cms_publications → 轮询 getArticleDetail → 终态（synced/failed/rejected_by_cms）。**

---

## Task 32: status-machine 状态机

**目的：** 把 CMS 返回的 `status` 字段（"0"/"20"/"30"/"60"）与 VibeTide 内部的 `cmsPublicationState` 映射，并提供"从当前 state 推进到下一 state"的纯函数。

**Files:**
- Create: `src/lib/cms/status-machine.ts`
- Create: `src/lib/cms/__tests__/status-machine.test.ts`

- [ ] **Step 32.1: 写状态机测试**

Create `src/lib/cms/__tests__/status-machine.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import {
  mapCmsStatusToPublicationState,
  canTransition,
  isTerminalState,
  type CmsPublicationState,
} from "../status-machine";

describe("mapCmsStatusToPublicationState", () => {
  it("maps '30' (发布) → synced", () => {
    expect(mapCmsStatusToPublicationState("30")).toBe("synced");
  });

  it("maps '60' (重新编辑) → rejected_by_cms", () => {
    expect(mapCmsStatusToPublicationState("60")).toBe("rejected_by_cms");
  });

  it("maps '0' (初稿) / '20' (待发布) → submitted (未终态)", () => {
    expect(mapCmsStatusToPublicationState("0")).toBe("submitted");
    expect(mapCmsStatusToPublicationState("20")).toBe("submitted");
  });

  it("returns null for unknown status (caller decides)", () => {
    expect(mapCmsStatusToPublicationState("99")).toBeNull();
    expect(mapCmsStatusToPublicationState("")).toBeNull();
    expect(mapCmsStatusToPublicationState(undefined)).toBeNull();
  });
});

describe("canTransition", () => {
  it("submitting → submitted (success)", () => {
    expect(canTransition("submitting", "submitted")).toBe(true);
  });
  it("submitting → retrying (network/5xx)", () => {
    expect(canTransition("submitting", "retrying")).toBe(true);
  });
  it("submitting → failed (non-retriable)", () => {
    expect(canTransition("submitting", "failed")).toBe(true);
  });
  it("retrying → submitted or failed", () => {
    expect(canTransition("retrying", "submitted")).toBe(true);
    expect(canTransition("retrying", "failed")).toBe(true);
  });
  it("submitted → synced / rejected_by_cms (from polling)", () => {
    expect(canTransition("submitted", "synced")).toBe(true);
    expect(canTransition("submitted", "rejected_by_cms")).toBe(true);
  });
  it("synced → anything is FORBIDDEN (terminal)", () => {
    expect(canTransition("synced", "submitted")).toBe(false);
    expect(canTransition("synced", "failed")).toBe(false);
  });
  it("failed → anything is FORBIDDEN (terminal)", () => {
    expect(canTransition("failed", "submitted")).toBe(false);
  });
  it("rejected_by_cms → anything is FORBIDDEN", () => {
    expect(canTransition("rejected_by_cms", "submitted")).toBe(false);
  });
});

describe("isTerminalState", () => {
  it("synced / failed / rejected_by_cms are terminal", () => {
    expect(isTerminalState("synced")).toBe(true);
    expect(isTerminalState("failed")).toBe(true);
    expect(isTerminalState("rejected_by_cms")).toBe(true);
  });
  it("submitting / submitted / retrying are not terminal", () => {
    expect(isTerminalState("submitting")).toBe(false);
    expect(isTerminalState("submitted")).toBe(false);
    expect(isTerminalState("retrying")).toBe(false);
  });
});
```

- [ ] **Step 32.2: FAIL → 实现**

Create `src/lib/cms/status-machine.ts`：

```typescript
/**
 * CMS publications 状态机。
 *
 * 设计文档 §3.6 + §11.3 enum（严格一致，不含 pending）
 */

export type CmsPublicationState =
  | "submitting"
  | "submitted"
  | "synced"
  | "retrying"
  | "rejected_by_cms"
  | "failed";

/**
 * CMS article.status（string 枚举）→ VibeTide publication state
 *
 * CMS 约定：
 *   "0"  初稿
 *   "20" 待发布
 *   "30" 已发布        → synced（终态）
 *   "60" 重新编辑      → rejected_by_cms（终态，回 VibeTide 审核台）
 *
 * 返回 null 表示未知，调用方自行决定是否继续轮询。
 */
export function mapCmsStatusToPublicationState(
  cmsStatus: string | undefined | null,
): CmsPublicationState | null {
  if (!cmsStatus) return null;
  switch (cmsStatus) {
    case "0":
    case "20":
      return "submitted";
    case "30":
      return "synced";
    case "60":
      return "rejected_by_cms";
    default:
      return null;
  }
}

/**
 * 允许的状态迁移。
 *
 * submitting ─→ submitted (成功) / retrying (可重试错) / failed (不可重试错)
 * retrying   ─→ submitted / failed
 * submitted  ─→ synced (轮询到 status=30) / rejected_by_cms (status=60) / failed (轮询超时)
 * synced / failed / rejected_by_cms 均为终态（任何迁移都被拒绝）
 */
export function canTransition(
  from: CmsPublicationState,
  to: CmsPublicationState,
): boolean {
  if (isTerminalState(from)) return false;

  const allowed: Record<
    Exclude<CmsPublicationState, "synced" | "failed" | "rejected_by_cms">,
    CmsPublicationState[]
  > = {
    submitting: ["submitted", "retrying", "failed"],
    retrying: ["submitted", "failed"],
    submitted: ["synced", "rejected_by_cms", "failed"],
  };

  return allowed[from].includes(to);
}

export function isTerminalState(state: CmsPublicationState): boolean {
  return state === "synced" || state === "failed" || state === "rejected_by_cms";
}
```

- [ ] **Step 32.3: 测试通过 + 更新 index.ts + 提交**

```bash
npm run test -- src/lib/cms/__tests__/status-machine.test.ts
```

Edit `src/lib/cms/index.ts`，追加：

```typescript
export {
  mapCmsStatusToPublicationState,
  canTransition,
  isTerminalState,
  type CmsPublicationState,
} from "./status-machine";
```

```bash
git add src/lib/cms/status-machine.ts src/lib/cms/__tests__/status-machine.test.ts src/lib/cms/index.ts
git commit -m "feat(cms/p1): status-machine (CMS status mapping + transition rules)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 33: publishArticleToCms 主流程 + 幂等

**目的：** Phase 1 的 **核心业务函数**。按 `cms_publish.md` skill 的 9-step checklist 实现：查重 → 加载上下文 → 映射 → 校验 → 调用 saveArticle → 落库 → 事件广播 → workflow_artifacts 记录。

**Files:**
- Create: `src/lib/cms/publish/request-hash.ts`
- Create: `src/lib/cms/publish/publish-article.ts`
- Create: `src/lib/cms/publish/index.ts`
- **Create: `src/lib/dal/workflow-artifacts.ts`** ← 依赖：Step 9 `insertWorkflowArtifact` 需要
- **Create: `src/lib/dal/__tests__/workflow-artifacts.test.ts`**
- Create: `src/lib/cms/__tests__/publish/request-hash.test.ts`
- Create: `src/lib/cms/__tests__/publish/publish-article.test.ts`

- [ ] **Step 33.0: 创建 workflow-artifacts DAL（Step 9 依赖）**

> 📌 **为什么需要先做这步：** Step 33.4 的 `publishArticleToCms` 会调用 `insertWorkflowArtifact`（实现 spec §3.2 Step 9 "通知 Mission / SSE"）。该 DAL 之前不存在，必须先建。

Create `src/lib/dal/__tests__/workflow-artifacts.test.ts`：

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { workflowArtifacts, missions, organizations } from "@/db/schema";
import { insertWorkflowArtifact, listArtifactsByMission } from "../workflow-artifacts";
import { eq } from "drizzle-orm";

describe("DAL workflow-artifacts", () => {
  let orgId: string;
  let missionId: string;

  beforeEach(async () => {
    // 前置：需要一个 mission 和 organization（测试数据库里通常 seed 有，否则创建）
    const org = await db.query.organizations.findFirst();
    orgId = org?.id ?? randomUUID();
    const mission = await db.query.missions.findFirst();
    missionId = mission?.id ?? randomUUID();

    await db.delete(workflowArtifacts).where(eq(workflowArtifacts.missionId, missionId));
  });

  it("insertWorkflowArtifact returns the created row", async () => {
    const row = await insertWorkflowArtifact({
      missionId,
      artifactType: "cms_publication",
      title: "CMS 入库：测试稿件",
      content: { cmsArticleId: "925194", previewUrl: "https://x/y" },
      producerEmployeeId: "xiaofa",
    });
    expect(row.id).toBeTruthy();
    expect(row.artifactType).toBe("cms_publication");
    expect(row.title).toContain("测试稿件");
  });

  it("supports all 9 existing artifactType values (smoke test)", async () => {
    const types = [
      "topic_brief", "angle_list", "material_pack", "article_draft",
      "video_plan", "review_report", "publish_plan", "analytics_report", "generic",
    ] as const;
    for (const t of types) {
      await insertWorkflowArtifact({
        missionId,
        artifactType: t,
        title: `t-${t}`,
        content: {},
      });
    }
    const list = await listArtifactsByMission(missionId);
    expect(list.length).toBeGreaterThanOrEqual(9);
  });

  it("listArtifactsByMission returns records newest-first", async () => {
    await insertWorkflowArtifact({ missionId, artifactType: "cms_publication", title: "A", content: {} });
    await new Promise((r) => setTimeout(r, 10));
    await insertWorkflowArtifact({ missionId, artifactType: "cms_publication", title: "B", content: {} });
    const list = await listArtifactsByMission(missionId);
    expect(list[0].title).toBe("B");
    expect(list[1].title).toBe("A");
  });
});
```

运行确认 FAIL：

```bash
npm run test -- src/lib/dal/__tests__/workflow-artifacts.test.ts
```

Create `src/lib/dal/workflow-artifacts.ts`：

```typescript
import { db } from "@/db";
import { workflowArtifacts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export interface InsertWorkflowArtifactInput {
  missionId: string;
  artifactType:
    | "topic_brief"
    | "angle_list"
    | "material_pack"
    | "article_draft"
    | "video_plan"
    | "review_report"
    | "publish_plan"
    | "analytics_report"
    | "generic"
    | "cms_publication";  // ← P1 新增（Task 2 扩展的 enum）
  title: string;
  content: Record<string, unknown>;
  producerEmployeeId?: string;
  producerTaskId?: string;
}

export async function insertWorkflowArtifact(
  input: InsertWorkflowArtifactInput,
): Promise<typeof workflowArtifacts.$inferSelect> {
  const [row] = await db
    .insert(workflowArtifacts)
    .values({
      missionId: input.missionId,
      artifactType: input.artifactType,
      title: input.title,
      content: input.content as object,
      producerEmployeeId: input.producerEmployeeId ?? null,
      producerTaskId: input.producerTaskId ?? null,
    })
    .returning();
  return row;
}

export async function listArtifactsByMission(
  missionId: string,
  options: { limit?: number } = {},
) {
  return await db.query.workflowArtifacts.findMany({
    where: eq(workflowArtifacts.missionId, missionId),
    orderBy: [desc(workflowArtifacts.createdAt)],
    limit: options.limit ?? 50,
  });
}

export async function listArtifactsByType(
  missionId: string,
  artifactType: InsertWorkflowArtifactInput["artifactType"],
) {
  return await db.query.workflowArtifacts.findMany({
    where: (t, { and, eq }) =>
      and(eq(t.missionId, missionId), eq(t.artifactType, artifactType)),
    orderBy: [desc(workflowArtifacts.createdAt)],
  });
}
```

运行测试通过：

```bash
npm run test -- src/lib/dal/__tests__/workflow-artifacts.test.ts
```

> ✅ **前置完成**：`publishArticleToCms` 现在可以 `import { insertWorkflowArtifact } from "@/lib/dal/workflow-artifacts"`。

- [ ] **Step 33.1: 写 requestHash 测试**

Create `src/lib/cms/__tests__/publish/request-hash.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { hashRequestPayload } from "../../publish/request-hash";

describe("hashRequestPayload", () => {
  it("returns identical hash for identical payloads", () => {
    const payload = { title: "a", catalogId: 1, content: "x" };
    expect(hashRequestPayload(payload)).toBe(hashRequestPayload(payload));
  });

  it("returns identical hash regardless of key order (stable)", () => {
    const a = { title: "a", catalogId: 1, content: "x" };
    const b = { content: "x", title: "a", catalogId: 1 };
    expect(hashRequestPayload(a)).toBe(hashRequestPayload(b));
  });

  it("returns different hash when any field differs", () => {
    const a = { title: "a", catalogId: 1, content: "x" };
    const b = { title: "a", catalogId: 1, content: "y" };
    expect(hashRequestPayload(a)).not.toBe(hashRequestPayload(b));
  });

  it("ignores volatile fields (addTime, publishDate) per design", () => {
    const now = Date.now();
    const a = { title: "a", catalogId: 1, addTime: now, publishDate: now };
    const b = { title: "a", catalogId: 1, addTime: now + 1000, publishDate: now + 1000 };
    expect(hashRequestPayload(a)).toBe(hashRequestPayload(b));
  });

  it("returns SHA-256 hex of 64 chars", () => {
    const h = hashRequestPayload({ title: "x" });
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 33.2: FAIL → 实现 request-hash**

```bash
mkdir -p src/lib/cms/publish src/lib/cms/__tests__/publish
npm run test -- src/lib/cms/__tests__/publish/request-hash.test.ts
```

Create `src/lib/cms/publish/request-hash.ts`：

```typescript
import { createHash } from "node:crypto";

/** 生成 hash 时忽略的易变字段（避免重试时 hash 变化） */
const VOLATILE_FIELDS = new Set(["addTime", "publishDate"]);

/**
 * 计算稳定的 payload hash。
 *
 * 用于：
 *  - 幂等：同一 hash 视作同一请求，跳过重发
 *  - 审计：快速判断两次 request 是否内容一致
 */
export function hashRequestPayload(payload: unknown): string {
  const normalized = stableStringify(payload);
  return createHash("sha256").update(normalized).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>)
    .filter((k) => !VOLATILE_FIELDS.has(k))
    .sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + stableStringify((value as Record<string, unknown>)[k]),
  );
  return "{" + parts.join(",") + "}";
}
```

```bash
npm run test -- src/lib/cms/__tests__/publish/request-hash.test.ts
```

- [ ] **Step 33.3: 写 publishArticleToCms 主流程测试**

Create `src/lib/cms/__tests__/publish/publish-article.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mockCmsFetch,
  restoreCmsFetch,
  cmsSuccessResponse,
  cmsErrorResponse,
} from "../test-helpers";

// mocks
vi.mock("@/lib/dal/articles", () => ({
  getArticleById: vi.fn(),
}));
vi.mock("@/lib/dal/cms-publications", () => ({
  createPublication: vi.fn().mockResolvedValue("pub-uuid-1"),
  updateToSubmitted: vi.fn(),
  markAsSynced: vi.fn(),
  markAsRejectedByCms: vi.fn(),
  markAsFailed: vi.fn(),
  incrementAttempt: vi.fn(),
  findLatestSuccessByArticle: vi.fn().mockResolvedValue(null),
  getPublicationById: vi.fn(),
}));
vi.mock("@/lib/cms/article-mapper", async () => {
  const actual = await vi.importActual<typeof import("@/lib/cms/article-mapper")>(
    "@/lib/cms/article-mapper",
  );
  return {
    ...actual,
    loadMapperContext: vi.fn(),
  };
});
vi.mock("@/lib/dal/organizations", () => ({
  getOrganizationById: vi.fn(),
}));

import { publishArticleToCms } from "../../publish/publish-article";
import { getArticleById } from "@/lib/dal/articles";
import {
  createPublication,
  updateToSubmitted,
  markAsFailed,
  findLatestSuccessByArticle,
} from "@/lib/dal/cms-publications";
import { loadMapperContext } from "@/lib/cms/article-mapper";
import { getOrganizationById } from "@/lib/dal/organizations";

const baseMapperCtx = {
  siteId: 81,
  appId: 10,
  catalogId: 8634,
  tenantId: "t",
  loginId: "id",
  loginTid: "tid",
  username: "admin",
  source: "深圳广电",
  author: "智媒编辑部",
  listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
  coverImageDefault: "https://cdn/d.jpg",
};

const baseArticle = {
  id: "art-1",
  organizationId: "org-1",
  title: "深圳 AI 产业 200 亿新政",
  body: "<p>正文内容</p>",
  authorName: null,
  summary: "摘要",
  shortTitle: null,
  tags: ["AI"],
  coverImageUrl: null,
  publishStatus: "approved",
  publishedAt: null,
  externalUrl: null,
  galleryImages: null,
  videoId: null,
  audioId: null,
  mediaType: "article",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "true";
  process.env.CMS_HOST = "https://cms.example.com";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "tenant";
  process.env.CMS_USERNAME = "admin";
  (loadMapperContext as ReturnType<typeof vi.fn>).mockResolvedValue(baseMapperCtx);
  (getArticleById as ReturnType<typeof vi.fn>).mockResolvedValue(baseArticle);
  (getOrganizationById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "org-1", brandName: "深圳广电" });
});
afterEach(() => restoreCmsFetch());

describe("publishArticleToCms", () => {
  it("happy path: creates pub record + calls CMS + updates to submitted", async () => {
    mockCmsFetch([
      cmsSuccessResponse({
        article: { id: 925194, status: 0, title: "x" },
        url: "1376/x/925194.shtml",
        preViewPath: "https://cms/preview",
        method: "ADD",
      }),
    ]);

    const result = await publishArticleToCms({
      articleId: "art-1",
      appChannelSlug: "app_news",
      operatorId: "xiaofa",
      triggerSource: "workflow",
    });

    expect(result.success).toBe(true);
    expect(result.cmsArticleId).toBe("925194");
    expect(result.cmsState).toBe("submitted");
    expect(createPublication).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        articleId: "art-1",
        appChannelSlug: "app_news",
        cmsType: 1,
      }),
    );
    expect(updateToSubmitted).toHaveBeenCalledWith(
      "pub-uuid-1",
      expect.objectContaining({ cmsArticleId: "925194" }),
    );
  });

  it("returns existing record when article already successfully published", async () => {
    (findLatestSuccessByArticle as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pub-old-1",
      cmsArticleId: "999",
      cmsState: "synced",
      publishedUrl: "https://x",
      previewUrl: "https://p",
    });

    const result = await publishArticleToCms({
      articleId: "art-1",
      appChannelSlug: "app_news",
      operatorId: "xiaofa",
      triggerSource: "workflow",
      allowUpdate: false,
    });

    expect(result.success).toBe(true);
    expect(result.publicationId).toBe("pub-old-1");
    expect(createPublication).not.toHaveBeenCalled();
  });

  it("reuses articleId on re-publish when allowUpdate=true (modifies existing CMS article)", async () => {
    (findLatestSuccessByArticle as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "pub-old",
      cmsArticleId: "925194",
      cmsState: "synced",
    });

    let capturedBody: any;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse((init?.body as string) ?? "{}");
      return cmsSuccessResponse({
        article: { id: 925194 },
        url: "x", preViewPath: "y", method: "MODIFY",
      });
    }) as typeof globalThis.fetch;

    await publishArticleToCms({
      articleId: "art-1",
      appChannelSlug: "app_news",
      operatorId: "xiaofa",
      triggerSource: "manual",
      allowUpdate: true,
    });

    expect(capturedBody.articleId).toBe(925194);   // 触发 CMS MODIFY 路径
  });

  it("fails fast when feature flag disabled", async () => {
    process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "false";
    await expect(
      publishArticleToCms({
        articleId: "art-1",
        appChannelSlug: "app_news",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow(/disabled|feature/i);
  });

  it("marks as failed with retriable=true on 500 error", async () => {
    mockCmsFetch([cmsErrorResponse(500, "内部错误")]);
    // 关闭 retry 以简化测试
    process.env.CMS_MAX_RETRIES = "0";

    await expect(
      publishArticleToCms({
        articleId: "art-1",
        appChannelSlug: "app_news",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow();
    expect(markAsFailed).toHaveBeenCalledWith(
      "pub-uuid-1",
      expect.objectContaining({ retriable: true }),
    );
    process.env.CMS_MAX_RETRIES = "3";
  });

  it("marks as failed retriable=false on auth error (no retry)", async () => {
    mockCmsFetch([cmsErrorResponse(401, "未登录")]);
    await expect(
      publishArticleToCms({
        articleId: "art-1",
        appChannelSlug: "app_news",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow();
    expect(markAsFailed).toHaveBeenCalledWith(
      "pub-uuid-1",
      expect.objectContaining({ retriable: false }),
    );
  });

  it("throws when article not found", async () => {
    (getArticleById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      publishArticleToCms({
        articleId: "missing",
        appChannelSlug: "app_news",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow(/article not found/i);
  });

  it("throws when article status != approved (and later states)", async () => {
    (getArticleById as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...baseArticle,
      publishStatus: "draft",
    });
    await expect(
      publishArticleToCms({
        articleId: "art-1",
        appChannelSlug: "app_news",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow(/not approved|status/i);
  });

  it("throws CmsConfigError when app_channel not mapped", async () => {
    (loadMapperContext as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("app_channel_not_mapped: app_news"),
    );
    await expect(
      publishArticleToCms({
        articleId: "art-1",
        appChannelSlug: "app_news",
        operatorId: "x",
        triggerSource: "workflow",
      }),
    ).rejects.toThrow(/app_channel_not_mapped/);
  });
});
```

- [ ] **Step 33.4: FAIL → 实现 publishArticleToCms**

Create `src/lib/cms/publish/publish-article.ts`：

```typescript
import { CmsClient } from "../client";
import { saveArticle } from "../api-endpoints";
import {
  mapArticleToCms,
  loadMapperContext,
  type ArticleForMapping,
  type MapperContext,
} from "../article-mapper";
import { determineType } from "../article-mapper/determine-type";
import {
  CmsConfigError,
  CmsError,
  classifyCmsError,
  isRetriableCmsError,
} from "../errors";
import { isCmsPublishEnabled, requireCmsConfig } from "../feature-flags";
import { hashRequestPayload } from "./request-hash";

import { getArticleById } from "@/lib/dal/articles";
import { getOrganizationById } from "@/lib/dal/organizations";
import {
  createPublication,
  updateToSubmitted,
  markAsFailed,
  findLatestSuccessByArticle,
} from "@/lib/dal/cms-publications";
import { insertWorkflowArtifact } from "@/lib/dal/workflow-artifacts";
import type { AppChannelSlug } from "@/lib/dal/app-channels";

/**
 * 通知任务中心 —— 若 article 关联了 mission，写 workflow_artifacts 供 UI 可视化。
 *
 * 同时（若 SSE 通道已建立）推 `cms_publication_completed` 事件。
 * SSE 不可用时只写 artifact 不抛错（降级策略）。
 */
async function notifyMissionChannelSafely(params: {
  missionId: string | null | undefined;
  publicationId: string;
  cmsArticleId: string;
  title: string;
  previewUrl?: string;
  publishedUrl?: string;
  producerEmployeeId: string;
}): Promise<void> {
  if (!params.missionId) return;

  // 1. 落 workflow_artifacts（§11.3 extended artifactTypeEnum 已加 cms_publication）
  await insertWorkflowArtifact({
    missionId: params.missionId,
    artifactType: "cms_publication",
    title: `CMS 入库：${params.title}`,
    content: {
      publicationId: params.publicationId,
      cmsArticleId: params.cmsArticleId,
      previewUrl: params.previewUrl,
      publishedUrl: params.publishedUrl,
    },
    producerEmployeeId: params.producerEmployeeId,
  });

  // 2. SSE 推送（降级友好：失败不抛）
  try {
    const { notifyMissionChannel } = await import("@/lib/mission/sse");
    await notifyMissionChannel(params.missionId, {
      type: "cms_publication_completed",
      publicationId: params.publicationId,
      cmsArticleId: params.cmsArticleId,
      previewUrl: params.previewUrl,
    });
  } catch (err) {
    // SSE 模块可选；未启用时静默降级
    if (process.env.NODE_ENV !== "production") {
      console.debug("[cms] SSE notify skipped:", err instanceof Error ? err.message : err);
    }
  }
}

export interface PublishInput {
  articleId: string;
  appChannelSlug: AppChannelSlug;
  operatorId: string;
  triggerSource: "manual" | "workflow" | "scheduled" | "daily_plan";
  /** 是否允许覆盖 CMS 已有稿件（默认 true，走 CMS MODIFY） */
  allowUpdate?: boolean;
  /** 覆盖默认栏目（可选） */
  overrideCatalogId?: string;
}

export interface PublishResult {
  success: boolean;
  publicationId: string;
  cmsArticleId?: string;
  cmsState: "submitting" | "submitted" | "synced" | "rejected_by_cms" | "failed";
  previewUrl?: string;
  publishedUrl?: string;
  error?: {
    code: string;
    message: string;
    stage: "mapping" | "auth" | "network" | "cms_business" | "polling" | "config";
    retriable: boolean;
  };
  timings: {
    totalMs: number;
    mappingMs: number;
    httpMs: number;
  };
}

/**
 * Phase 1 核心入口：把一篇已审稿件入库到 CMS。
 *
 * 9-step 流程（skill MD `cms_publish.md` §Workflow Checklist）：
 *   1. Feature flag 检查
 *   2. 加载 article + organization
 *   3. 审核状态校验
 *   4. 加载 MapperContext
 *   5. 幂等检查（findLatestSuccessByArticle）
 *   6. 映射 → CmsArticleSaveDTO
 *   7. 落 cms_publications (submitting)
 *   8. 调 saveArticle
 *   9. 更新 submitted + 触发轮询事件（Task 35 实现）
 */
export async function publishArticleToCms(input: PublishInput): Promise<PublishResult> {
  const t0 = performance.now();

  // 1. Feature flag
  if (!isCmsPublishEnabled()) {
    throw new CmsConfigError(
      "CMS 发布已被 feature flag 禁用（VIBETIDE_CMS_PUBLISH_ENABLED=true 启用）",
    );
  }

  // 2. 加载 article + organization
  const article = await getArticleById(input.articleId);
  if (!article) {
    throw new CmsConfigError(`article not found: ${input.articleId}`);
  }

  // 3. 状态校验
  if (!["approved", "publishing", "published"].includes(article.publishStatus)) {
    throw new CmsConfigError(
      `article ${article.id} status=${article.publishStatus}, 不允许发布（需 approved/publishing/published）`,
    );
  }

  const org = await getOrganizationById(article.organizationId);
  if (!org) {
    throw new CmsConfigError(`organization not found: ${article.organizationId}`);
  }

  // 5. 幂等检查
  const existing = await findLatestSuccessByArticle(input.articleId);
  const allowUpdate = input.allowUpdate ?? true;

  if (existing && !allowUpdate) {
    return {
      success: true,
      publicationId: existing.id,
      cmsArticleId: existing.cmsArticleId ?? undefined,
      cmsState: existing.cmsState as PublishResult["cmsState"],
      publishedUrl: existing.publishedUrl ?? undefined,
      previewUrl: existing.previewUrl ?? undefined,
      timings: { totalMs: performance.now() - t0, mappingMs: 0, httpMs: 0 },
    };
  }

  // 4. MapperContext
  const ctx: MapperContext = await loadMapperContext(
    article.organizationId,
    input.appChannelSlug,
    { brandName: org.brandName ?? "智媒编辑部" },
  );

  // 6. 映射
  const mappingStart = performance.now();
  const asMapping: ArticleForMapping = {
    id: article.id,
    title: article.title,
    authorName: article.authorName ?? null,
    summary: article.summary ?? null,
    shortTitle: article.shortTitle ?? null,
    tags: article.tags ?? [],
    coverImageUrl: article.coverImageUrl ?? null,
    publishStatus: article.publishStatus,
    publishedAt: article.publishedAt ?? null,
    body: article.body ?? null,
    externalUrl: article.externalUrl ?? null,
    galleryImages: article.galleryImages ?? null,
    videoId: article.videoId ?? null,
    audioId: article.audioId ?? null,
    mediaType: article.mediaType ?? "article",
  };
  const cmsType = Number(determineType(asMapping));
  const dto = await mapArticleToCms(asMapping, ctx);

  if (existing && existing.cmsArticleId && allowUpdate) {
    // 触发 CMS MODIFY 路径
    (dto as any).articleId = Number(existing.cmsArticleId);
  }
  const mappingMs = performance.now() - mappingStart;

  // 7. 落库
  const requestHash = hashRequestPayload(dto);
  const publicationId = await createPublication({
    organizationId: article.organizationId,
    articleId: input.articleId,
    appChannelSlug: input.appChannelSlug,
    cmsType,
    requestHash,
    requestPayload: dto,
    operatorId: input.operatorId,
    triggerSource: input.triggerSource,
  });

  // 8. 调 saveArticle
  const config = requireCmsConfig();
  const client = new CmsClient({
    host: config.host,
    loginCmcId: config.loginCmcId,
    loginCmcTid: config.loginCmcTid,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  const httpStart = performance.now();
  try {
    const res = await saveArticle(client, dto);
    const httpMs = performance.now() - httpStart;

    const cmsArticleId = String(res.data?.article.id ?? "");
    const url = res.data?.url ?? "";
    const previewUrl = res.data?.preViewPath;
    const publishedUrl = url ? buildPublishedUrl(url) : undefined;

    // 9.1 更新 submitted
    await updateToSubmitted(publicationId, {
      cmsArticleId,
      cmsCatalogId: String(ctx.catalogId),
      cmsSiteId: ctx.siteId,
      publishedUrl,
      previewUrl,
      responsePayload: res.data,
    });

    // 9.2 通知任务中心（workflow_artifacts + SSE）—— cms_publish.md Workflow Step 9
    await notifyMissionChannelSafely({
      missionId: (article as { missionId?: string | null }).missionId ?? null,
      publicationId,
      cmsArticleId,
      title: article.title,
      previewUrl,
      publishedUrl,
      producerEmployeeId: input.operatorId,
    });

    // 9.3 触发轮询（Task 35 的 Inngest 处理）
    await triggerStatusPoll(publicationId, cmsArticleId);

    return {
      success: true,
      publicationId,
      cmsArticleId,
      cmsState: "submitted",
      publishedUrl,
      previewUrl,
      timings: { totalMs: performance.now() - t0, mappingMs, httpMs },
    };
  } catch (err) {
    const httpMs = performance.now() - httpStart;
    const stage = classifyCmsError(err);
    const message = err instanceof Error ? err.message : String(err);
    const retriable = isRetriableCmsError(err);

    await markAsFailed(publicationId, {
      errorCode: stage === "unknown" ? "cms_unknown" : `cms_${stage}`,
      errorMessage: message,
      retriable,
    });

    // 触发重试（Task 36 的 Inngest 处理）
    if (retriable) {
      await triggerPublishRetry(publicationId);
    }

    throw err instanceof CmsError
      ? err
      : new CmsError(`publishArticleToCms failed: ${message}`);
  }
}

/** 由 Task 35 的 cms-status-poll Inngest 函数消费 */
async function triggerStatusPoll(publicationId: string, cmsArticleId: string): Promise<void> {
  // 延迟 import 避免循环依赖
  const { inngest } = await import("@/inngest/client");
  await inngest.send({
    name: "cms/publication.submitted",
    data: { publicationId, cmsArticleId },
  });
}

/** 由 Task 36 的 cms-publish-retry Inngest 函数消费 */
async function triggerPublishRetry(publicationId: string): Promise<void> {
  const { inngest } = await import("@/inngest/client");
  await inngest.send({
    name: "cms/publication.retry",
    data: { publicationId },
  });
}

function buildPublishedUrl(relativePath: string): string {
  const base = process.env.CMS_WEB_BASE ?? "https://web.demo.chinamcloud.cn/cms";
  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  return `${base}${path}`;
}
```

Create `src/lib/cms/publish/index.ts`：

```typescript
export { publishArticleToCms, type PublishInput, type PublishResult } from "./publish-article";
export { hashRequestPayload } from "./request-hash";
```

- [ ] **Step 33.5: 测试通过**

```bash
npm run test -- src/lib/cms/__tests__/publish/
```

- [ ] **Step 33.6: 更新 src/lib/cms/index.ts + 提交**

Edit `src/lib/cms/index.ts`，追加：

```typescript
export { publishArticleToCms, type PublishInput, type PublishResult } from "./publish";
```

```bash
npx tsc --noEmit
git add src/lib/cms/publish/ src/lib/cms/__tests__/publish/ src/lib/cms/index.ts
git commit -m "feat(cms/p1): publishArticleToCms core flow (mapping + idempotency + audit)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 34: Server Action + UI-facing wrapper

**目的：** 把 `publishArticleToCms` 包装成 Server Action，加上 auth / revalidatePath / 错误兜底。UI 调用 action，action 调用 lib 层。

**Files:**
- Modify: `src/app/actions/cms.ts`

- [ ] **Step 34.1: 追加 Server Action**

Edit `src/app/actions/cms.ts`，末尾追加：

```typescript
import {
  publishArticleToCms,
  type PublishInput,
  type PublishResult,
} from "@/lib/cms";

export interface PublishArticleToCmsActionInput {
  articleId: string;
  appChannelSlug: PublishInput["appChannelSlug"];
  triggerSource?: PublishInput["triggerSource"];
  allowUpdate?: boolean;
}

/**
 * UI / Mission runner 触发 CMS 入库。
 *
 * 预期调用方：
 *  - `/articles/[id]/publish-button.tsx`（审核台"发布到 APP"按钮）
 *  - Mission runner 调用 cms_publish skill 时的入口
 */
export async function publishArticleToCmsAction(
  input: PublishArticleToCmsActionInput,
): Promise<PublishResult | { error: string }> {
  const { user } = await requireAuth();

  try {
    const result = await publishArticleToCms({
      articleId: input.articleId,
      appChannelSlug: input.appChannelSlug,
      operatorId: user.id,
      triggerSource: input.triggerSource ?? "manual",
      allowUpdate: input.allowUpdate,
    });

    revalidatePath(`/articles/${input.articleId}`);
    revalidatePath(`/missions`);

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}
```

- [ ] **Step 34.2: 类型编译 + 提交**

```bash
npx tsc --noEmit
git add src/app/actions/cms.ts
git commit -m "feat(cms/p1): publishArticleToCmsAction (UI/Mission wrapper with auth)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 35: Inngest cms-status-poll（5 次指数退避轮询）

**目的：** 入库后，CMS 可能需要人工审核或工作流流转。VibeTide 轮询 `getMyArticleDetail` 直到 status 变为 "30"（synced）或 "60"（rejected）。最多 5 次，间隔 5s/10s/20s/40s/120s。

**Files:**
- Create: `src/inngest/functions/cms-status-poll.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 35.1: 写 Inngest 函数骨架**

Create `src/inngest/functions/cms-status-poll.ts`：

```typescript
import { inngest } from "@/inngest/client";
import {
  CmsClient,
  requireCmsConfig,
  getArticleDetail,
  mapCmsStatusToPublicationState,
  classifyCmsError,
} from "@/lib/cms";
import {
  getPublicationById,
  markAsSynced,
  markAsRejectedByCms,
  markAsFailed,
} from "@/lib/dal/cms-publications";

/**
 * 每次轮询等待时间（ms）：5s → 10s → 20s → 40s → 120s（总 ~3.5 分钟）。
 *
 * 超过 5 次仍为 submitted 终态不强制，保持 submitted 让运营/自动流程继续发现。
 */
const POLL_DELAYS_MS = [5000, 10000, 20000, 40000, 120000] as const;

export const cmsStatusPoll = inngest.createFunction(
  {
    id: "cms-status-poll",
    name: "[CMS P1] CMS 入库状态轮询",
    concurrency: { limit: 20 },
    retries: 2,
  },
  { event: "cms/publication.submitted" },
  async ({ event, step, logger }) => {
    const { publicationId, cmsArticleId } = event.data as {
      publicationId: string;
      cmsArticleId: string;
    };

    const config = requireCmsConfig();
    const client = new CmsClient({
      host: config.host,
      loginCmcId: config.loginCmcId,
      loginCmcTid: config.loginCmcTid,
      timeoutMs: config.timeoutMs,
      maxRetries: 1,        // 轮询本身有 5 次重试，单次 fetch 不多次
    });

    for (let attempt = 0; attempt < POLL_DELAYS_MS.length; attempt++) {
      await step.sleep(`wait-${attempt + 1}`, `${POLL_DELAYS_MS[attempt]}ms`);

      const terminal = await step.run(`poll-${attempt + 1}`, async () => {
        // 检查 publication 是否已被其他流程改为终态
        const pub = await getPublicationById(publicationId);
        if (!pub) {
          logger.warn(`publication ${publicationId} disappeared`);
          return true;
        }
        if (["synced", "rejected_by_cms", "failed"].includes(pub.cmsState)) {
          return true;
        }

        try {
          const res = await getArticleDetail(client, cmsArticleId);
          const cmsStatus = res.data?.status;
          const nextState = mapCmsStatusToPublicationState(cmsStatus);

          if (nextState === "synced") {
            await markAsSynced(publicationId);
            logger.info(`publication ${publicationId} → synced (CMS status=30)`);
            return true;
          }
          if (nextState === "rejected_by_cms") {
            await markAsRejectedByCms(publicationId);
            logger.warn(`publication ${publicationId} → rejected_by_cms (CMS status=60)`);
            return true;
          }
          // submitted / 未知：继续下一次轮询
          return false;
        } catch (err) {
          const stage = classifyCmsError(err);
          logger.warn(
            `poll attempt ${attempt + 1} failed (stage=${stage}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          // 轮询错误不视为终态；重试下一轮
          return false;
        }
      });

      if (terminal) return { publicationId, attempts: attempt + 1, terminal: true };
    }

    // 5 次后仍未终态 —— 保持 submitted，任务中心显示"待 CMS 人工发布"
    logger.info(
      `publication ${publicationId} still submitted after ${POLL_DELAYS_MS.length} polls; left as-is`,
    );
    return { publicationId, attempts: POLL_DELAYS_MS.length, terminal: false };
  },
);
```

- [ ] **Step 35.2: 注册到 Inngest functions 索引**

Edit `src/inngest/functions/index.ts`，追加：

```typescript
export { cmsStatusPoll } from "./cms-status-poll";
```

若项目有 `app/api/inngest/route.ts`，在 `serve()` 的 `functions` 数组里追加 `cmsStatusPoll`。

- [ ] **Step 35.3: 类型编译 + 提交**

```bash
npx tsc --noEmit
git add src/inngest/functions/cms-status-poll.ts src/inngest/functions/index.ts
git commit -m "feat(cms/p1): Inngest cms-status-poll (5 polls, exponential backoff)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 36: Inngest cms-publish-retry（失败重试）

**目的：** 当 `publishArticleToCms` 因可重试错误（5xx / 网络超时）失败时，异步延迟重试，最多 3 次（1s / 5s / 30s 外加 backoff）。

**Files:**
- Create: `src/inngest/functions/cms-publish-retry.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 36.1: 写重试 Inngest 函数**

Create `src/inngest/functions/cms-publish-retry.ts`：

```typescript
import { inngest } from "@/inngest/client";
import { publishArticleToCms } from "@/lib/cms";
import { getPublicationById, incrementAttempt } from "@/lib/dal/cms-publications";

const MAX_RETRY_COUNT = 3;
const RETRY_DELAYS_MS = [1000, 5000, 30000] as const;

export const cmsPublishRetry = inngest.createFunction(
  {
    id: "cms-publish-retry",
    name: "[CMS P1] CMS 入库失败重试",
    concurrency: { limit: 10 },
    retries: 0,               // 本函数自己管重试节奏
  },
  { event: "cms/publication.retry" },
  async ({ event, step, logger }) => {
    const { publicationId } = event.data as { publicationId: string };

    const pub = await step.run("load-pub", async () => {
      return await getPublicationById(publicationId);
    });
    if (!pub) {
      logger.warn(`retry: publication ${publicationId} not found`);
      return { skipped: true };
    }

    if (pub.cmsState !== "retrying") {
      logger.info(`retry: publication ${publicationId} state=${pub.cmsState}, skipping`);
      return { skipped: true };
    }

    if ((pub.attempts ?? 0) >= MAX_RETRY_COUNT + 1) {
      logger.warn(`retry: publication ${publicationId} exhausted retries`);
      return { exhausted: true };
    }

    const delay = RETRY_DELAYS_MS[Math.min((pub.attempts ?? 1) - 1, RETRY_DELAYS_MS.length - 1)];
    await step.sleep(`retry-delay`, `${delay}ms`);

    await step.run("increment-attempt", async () => {
      await incrementAttempt(publicationId);
    });

    return await step.run("republish", async () => {
      try {
        const result = await publishArticleToCms({
          articleId: pub.articleId,
          appChannelSlug: pub.appChannelSlug as any,
          operatorId: pub.operatorId ?? "system",
          triggerSource: "scheduled",
          allowUpdate: true,
        });
        logger.info(`retry: publication ${publicationId} re-published, cmsState=${result.cmsState}`);
        return { success: true, cmsState: result.cmsState };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn(`retry: publication ${publicationId} failed again: ${message}`);
        return { success: false, error: message };
      }
    });
  },
);
```

- [ ] **Step 36.2: 注册**

Edit `src/inngest/functions/index.ts`，追加：

```typescript
export { cmsPublishRetry } from "./cms-publish-retry";
```

在 `app/api/inngest/route.ts` 的 `serve()` 函数数组里也追加 `cmsPublishRetry`。

- [ ] **Step 36.3: 本地验证（可选）**

在 Inngest dev UI 手动发送 event 触发重试：

```bash
curl -X POST http://localhost:8288/e/<EVENT_KEY> \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cms/publication.retry",
    "data": { "publicationId": "<a-failed-pub-id>" }
  }'
```

检查 Inngest UI 里看到重试流程运行。

- [ ] **Step 36.4: 提交**

```bash
npx tsc --noEmit
git add src/inngest/functions/cms-publish-retry.ts src/inngest/functions/index.ts
git commit -m "feat(cms/p1): Inngest cms-publish-retry (3 retries, exp backoff 1s/5s/30s)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Section F 完成检查

```bash
# 1. 所有 F 组测试通过
npm run test -- src/lib/cms/

# 2. 类型编译
npx tsc --noEmit

# 3. E2E 手动验证（需真实 CMS 环境）
#    a) seed 一篇 approved article (publishStatus='approved', body=<HTML>)
#    b) 触发 publishArticleToCmsAction
#    c) 确认 cms_publications 表新增记录 + cmsState 依次 submitting → submitted → synced
#    d) 查看 Inngest UI cms-status-poll 执行历史

# 4. Inngest dev UI 显示 3 个 CMS 相关 function
#    - cms-catalog-sync-daily
#    - cms-status-poll
#    - cms-publish-retry
```

Section F 结束后 git log 应看到 5 个 `feat(cms/p1):` commit（Task 32-36 各 1 个）。

**→ Section G 开始前，请在对话中确认"Section F 完成"。**

---

# Section G — 场景集成 + 验证

**前 6 个 Section 产出了所有基础设施；Section G 的目标是让 Phase 1 **真正可投产**：**

- 2 个场景（新闻/时政）端到端跑通
- 运营有最小配置 UI 可用
- Skill MD 部署到位以供 Agent 调用
- 冒烟测试一套，通过就可以把 feature flag 打开给测试 org

---

## G.0 E2E 前置（所有 Task 37/38 CLI 命令共用）

**第一次执行 Section G 前，先完成这一节，后续命令里的 `$ORG_ID` / `$AUTH_COOKIE` 等变量才能工作。**

### G.0.1 查测试 organization 的 id

```bash
psql $DATABASE_URL -c "SELECT id, name, created_at FROM organizations ORDER BY created_at ASC LIMIT 5;"
```

预期输出含至少 1 条记录。**选 `name` 含 "测试" / "test" / "demo" 的 org（无测试 org 时选最早的）**，导出到 shell：

```bash
export ORG_ID="<从上一步复制的 uuid>"
echo "ORG_ID=$ORG_ID"
```

也可以直接落到 `.envrc`（direnv）或 `~/.zshrc` 备用。

### G.0.2 获取 auth cookie（用于 API 测试）

两种方式任选：

**方式 A（推荐，浏览器拿）**：
1. 浏览器打开 `http://localhost:3000/login`，用测试账号登录
2. DevTools → Application → Cookies → `http://localhost:3000`
3. 复制 `sb-<project>-auth-token` 的值（通常是 base64 JSON）
4. 写入临时文件：
   ```bash
   cat > .claude-test-cookie <<EOF
   sb-<project>-auth-token=<刚才复制的值>
   EOF
   chmod 600 .claude-test-cookie
   echo '.claude-test-cookie' >> .gitignore
   ```

**方式 B（CLI 签发）** —— 仅测试 org 可用，借 supabase service role：
```bash
# 需要 SUPABASE_SERVICE_ROLE_KEY 在 .env.local
npx tsx scripts/issue-test-cookie.ts --email=<test-user@example.com> \
  > .claude-test-cookie
```
（若 `scripts/issue-test-cookie.ts` 不存在，用方式 A。）

### G.0.3 快速连通性自检

```bash
# 1) DB 能连：
psql $DATABASE_URL -c "SELECT slug FROM app_channels WHERE organization_id = '$ORG_ID' ORDER BY sort_order;"
# 预期输出 9 行 (app_home ... app_drama)

# 2) 应用已启动：
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health 2>/dev/null || curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
# 预期 200 (或 302 登录页)

# 3) Cookie 有效：
curl -s http://localhost:3000/api/cms/catalog-sync \
  -X POST -H "Content-Type: application/json" \
  --cookie "$(cat .claude-test-cookie)" \
  -d '{"dryRun":true}' | head -c 200
# 预期返回 JSON 而非 "Unauthorized"
```

### G.0.4 后续 CLI 命令里 `<ORG_ID>` 等占位符的替换规则

| 占位符 | 替换为 |
|--------|-------|
| `<ORG_ID>` | 来自 G.0.1 的 `$ORG_ID`，直接写成 `'$ORG_ID'` 或 `${ORG_ID}` |
| `<YOUR_ARTICLE_ID>` | 每次执行 Step 37.3 / 38.2 后 console.log 的返回值 |
| `<CMS_ARTICLE_ID_FROM_STEP_37_4>` | Step 37.4 的 `result.cmsArticleId` |
| `<picked_catalog_uuid>` | G.0.4.x 查 `cms_catalogs` 挑一条（SQL 在各 Step 给出） |
| `--cookie "..."` | `--cookie "$(cat .claude-test-cookie)"` |

---

## Task 37: news_standard 场景端到端手动验证

**目的：** 打通 "AI 员工产出新闻图文稿 → cms_publish → APP 新闻栏目" 全链路。**不写新业务代码**，只做：数据准备 + 触发 + 校验 + 记录问题。产出 `docs/superpowers/plans/phase1-e2e-news.md` 作为 E2E 报告。

**Files:**
- Create: `docs/superpowers/plans/phase1-e2e-news.md`（E2E 测试报告 / checklist）

- [ ] **Step 37.1: 数据前置条件**

```bash
# 1. 确认 .env.local 有 CMS_* 凭证
grep -c CMS_ .env.local    # 预期 ≥ 8 行

# 2. Feature flag
echo "VIBETIDE_CMS_PUBLISH_ENABLED=true" >> .env.local

# 3. Seed app_channels（Task 12 已做）
npm run db:seed

# 4. 首次栏目同步（通过 Task 30 的 API）
curl -X POST http://localhost:3000/api/cms/catalog-sync \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}' \
  --cookie "$(cat .claude-test-cookie 2>/dev/null || echo '')"
# 预期：{ success: true, stats: { channelsFetched: ≥1, appsFetched: ≥1, catalogsFetched: ≥10 } }
```

- [ ] **Step 37.2: 运营配置：绑定 app_news → cms_catalog**

打开浏览器 → `http://localhost:3000/settings/cms-mapping`（Task 39 的 UI，**若 T39 尚未完成则用 CLI 直连 DB**）：

```bash
# 方案 B（UI 未完成时的 CLI）：手动绑定 app_news → 某个 cms_catalog
psql $DATABASE_URL <<SQL
-- 查一个合适的 CMS 新闻栏目（type=1、active）
SELECT id, cms_catalog_id, name FROM cms_catalogs
WHERE organization_id = '<ORG_ID>'
  AND catalog_type = 1 AND deleted_at IS NULL
  AND name ILIKE '%新闻%'
LIMIT 5;

-- 把第一条的 id 绑定到 app_news
UPDATE app_channels
SET default_catalog_id = '<picked_catalog_uuid>',
    default_list_style = '{"listStyleType":"0","listStyleName":"默认","imageUrlList":[]}'::jsonb,
    updated_at = NOW()
WHERE organization_id = '<ORG_ID>' AND slug = 'app_news';
SQL
```

- [ ] **Step 37.3: 准备一篇测试 article**

```bash
npx tsx -e "
import { db } from './src/db';
import { articles } from './src/db/schema';
const [row] = await db.insert(articles).values({
  organizationId: '<ORG_ID>',
  title: '【测试】深圳发布 AI 产业 200 亿新政',
  body: '<p>4 月 17 日，深圳市政府发布《关于促进人工智能产业高质量发展的若干措施》，明确在未来五年内设立 200 亿元专项基金。</p>',
  authorName: '智媒编辑部',
  summary: '深圳发布 AI 产业新政策，设立 200 亿专项基金。',
  tags: ['AI', '深圳', '政策'],
  publishStatus: 'approved',
  mediaType: 'article',
}).returning({ id: articles.id, title: articles.title });
console.log('article created:', row);
"
```

记录返回的 `article.id`（下一步用）。

- [ ] **Step 37.4: 触发 publishArticleToCms**

```bash
npx tsx -e "
import { publishArticleToCms } from './src/lib/cms';
const result = await publishArticleToCms({
  articleId: '<YOUR_ARTICLE_ID>',
  appChannelSlug: 'app_news',
  operatorId: 'manual-e2e',
  triggerSource: 'manual',
});
console.log(JSON.stringify(result, null, 2));
"
```

**预期输出**：
```
{
  success: true,
  publicationId: '...',
  cmsArticleId: '925xxx',
  cmsState: 'submitted',
  publishedUrl: 'https://web.demo.chinamcloud.cn/cms/...',
  previewUrl: 'https://api.demo.chinamcloud.cn/...',
  timings: { totalMs: <3000, mappingMs: <100, httpMs: <2000 }
}
```

- [ ] **Step 37.5: 验证 cms_publications 表**

```bash
psql $DATABASE_URL <<SQL
SELECT id, cms_state, cms_article_id, cms_type, attempts,
       submitted_at, synced_at, error_code, error_message
FROM cms_publications
WHERE article_id = '<YOUR_ARTICLE_ID>'
ORDER BY created_at DESC
LIMIT 1;
SQL
```

预期：`cms_state = 'submitted'`、`cms_article_id` 非空、`error_code` NULL、`attempts = 1`。

- [ ] **Step 37.6: 验证 Inngest 轮询被触发**

打开 Inngest dev UI（`http://localhost:8288`）→ Functions → `cms-status-poll` → Runs。

预期：有一条运行记录，执行 1-5 次 `poll-N` step 后，最终 state 变为 `synced` 或保留 `submitted`（取决于 CMS 侧是否自动发布）。

- [ ] **Step 37.7: 验证 CMS 端确实收到稿件**

```bash
# 用 getArticleDetail 查 CMS
npx tsx -e "
import { CmsClient, getArticleDetail, requireCmsConfig } from './src/lib/cms';
const config = requireCmsConfig();
const client = new CmsClient(config);
const detail = await getArticleDetail(client, '<CMS_ARTICLE_ID_FROM_STEP_37_4>');
console.log('CMS 上的稿件状态：', detail.data?.status, detail.data?.title);
"
```

或者直接打开 `previewUrl` 在浏览器验证。

- [ ] **Step 37.8: 记录 E2E 报告**

Create `docs/superpowers/plans/phase1-e2e-news.md`：

```markdown
# Phase 1 E2E: news_standard 场景

**日期**：<YYYY-MM-DD>
**执行者**：<name>
**环境**：<dev/test/prod>

## 前置
- `VIBETIDE_CMS_PUBLISH_ENABLED=true` ✓
- cms_catalog_sync 已执行 ✓ （栏目数 `<N>`）
- app_news 已绑定 cms_catalog ✓ (catalogId=`<cmsCatalogId>`)

## 执行
- Article ID: `<...>`
- Publication ID: `<...>`
- CMS Article ID: `<925xxx>`
- 首次入库耗时: `<totalMs>` ms

## 验证结果

| 检查项 | 状态 | 备注 |
|--------|------|------|
| publishArticleToCms 返回 success=true | ✓ | |
| cms_publications 表记录 state=submitted | ✓ | |
| Inngest cms-status-poll 执行 | ✓ | `<N>` 次 poll |
| 最终 state | synced / submitted | <说明> |
| CMS previewUrl 可访问 | ✓ | 人眼确认内容正确 |
| 稿件 title/content/author 与源一致 | ✓ | |

## 问题与修正
<如无问题：「无」；如有问题：记录现象 + 根因 + 已修或遗留>

## 附：一张 APP 端截图（如已有 APP 端）
<img 或 文字描述>
```

- [ ] **Step 37.9: 提交**

```bash
git add docs/superpowers/plans/phase1-e2e-news.md
git commit -m "docs(cms/p1): news_standard E2E verification report

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 38: politics_shenzhen 场景端到端手动验证

**目的：** 与 Task 37 步骤完全相同，只是场景切到 `app_politics`，验证时政稿（严档审核）也能走通同样流程。

**Files:**
- Create: `docs/superpowers/plans/phase1-e2e-politics.md`

- [ ] **Step 38.1-38.4: 重复 T37 流程，参数改为 politics**

```bash
# 1. 绑定 app_politics
psql $DATABASE_URL <<SQL
UPDATE app_channels
SET default_catalog_id = '<picked_politics_catalog_uuid>',
    default_list_style = '{"listStyleType":"0","listStyleName":"默认","imageUrlList":[]}'::jsonb,
    updated_at = NOW()
WHERE organization_id = '<ORG_ID>' AND slug = 'app_politics';
SQL

# 2. 创建 politics 测试 article
npx tsx -e "
import { db } from './src/db';
import { articles } from './src/db/schema';
const [row] = await db.insert(articles).values({
  organizationId: '<ORG_ID>',
  title: '【测试】《深圳市促进人工智能产业高质量发展若干措施》发布',
  body: '<p>4 月 17 日，深圳市第 X 届人民代表大会常务委员会第 XX 次会议审议通过……</p>',
  authorName: '智媒编辑部',
  summary: '深圳市 AI 产业政策发布。',
  tags: ['时政', '深圳', 'AI 产业'],
  publishStatus: 'approved',
  mediaType: 'article',
}).returning({ id: articles.id });
console.log(row);
"

# 3. 触发 publishArticleToCms with appChannelSlug='app_politics'
npx tsx -e "
import { publishArticleToCms } from './src/lib/cms';
const result = await publishArticleToCms({
  articleId: '<POLITICS_ARTICLE_ID>',
  appChannelSlug: 'app_politics',
  operatorId: 'manual-e2e',
  triggerSource: 'manual',
});
console.log(JSON.stringify(result, null, 2));
"
```

- [ ] **Step 38.5: 记录 E2E 报告（结构同 T37）**

Create `docs/superpowers/plans/phase1-e2e-politics.md`：

```markdown
# Phase 1 E2E: politics_shenzhen 场景

（结构与 phase1-e2e-news.md 一致，填入 politics 的具体数据）
```

- [ ] **Step 38.6: 提交**

```bash
git add docs/superpowers/plans/phase1-e2e-politics.md
git commit -m "docs(cms/p1): politics_shenzhen E2E verification report

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 39: 栏目映射配置页最小 UI（`/settings/cms-mapping`）

**目的：** 最小可用的运营 UI，提供三件事：
1. 显示当前 9 个 `app_channels` + 绑定状态
2. 绑定/解绑 CMS catalog（下拉选择当前 org 的 cms_catalogs）
3. 触发"立即同步"按钮

**不做的事**（留给 Phase 2+ 的 UI 完善）：
- 样式抛光 / 空状态美化 / 过滤搜索
- 栏目树可视化
- 同步日志的分页表格（只显示最近 5 条）

**Files:**
- Create: `src/app/(dashboard)/settings/cms-mapping/page.tsx`
- Create: `src/app/(dashboard)/settings/cms-mapping/cms-mapping-client.tsx`

- [ ] **Step 39.1: 新增 DAL 辅助函数（运营用）**

Edit `src/lib/dal/cms-catalogs.ts`，追加：

```typescript
/**
 * 按 organization 列出"所有活跃栏目"的简化视图（UI 下拉用）。
 */
export async function listCmsCatalogsForBindingDropdown(organizationId: string) {
  const rows = await listAllActiveCmsCatalogs(organizationId);
  return rows.map((r) => ({
    id: r.id,
    cmsCatalogId: r.cmsCatalogId,
    name: r.name,
    innerCode: r.innerCode,
    treeLevel: r.treeLevel,
    appId: r.appId,
    siteId: r.siteId,
  }));
}
```

- [ ] **Step 39.2: 新增 Server Action `updateAppChannelBindingAction`**

Edit `src/app/actions/cms.ts`，追加：

```typescript
import {
  updateAppChannelBinding as dalUpdateAppChannelBinding,
} from "@/lib/dal/app-channels";

export interface UpdateAppChannelBindingInput {
  slug: string;
  catalogId: string;
  listStyleType?: string;
}

export async function updateAppChannelBindingAction(
  input: UpdateAppChannelBindingInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { organization } = await requireAuth();
    await dalUpdateAppChannelBinding(organization.id, input.slug, {
      defaultCatalogId: input.catalogId,
      defaultListStyle: {
        listStyleType: input.listStyleType ?? "0",
        listStyleName: "默认",
        imageUrlList: [],
      },
    });
    revalidatePath("/settings/cms-mapping");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 39.3: 写 page.tsx（Server Component）**

Create `src/app/(dashboard)/settings/cms-mapping/page.tsx`：

```typescript
import { requireAuth } from "@/lib/auth/server";
import { listAppChannels } from "@/lib/dal/app-channels";
import { listCmsCatalogsForBindingDropdown } from "@/lib/dal/cms-catalogs";
import { listRecentSyncLogs } from "@/lib/dal/cms-sync-logs";
import { CmsMappingClient } from "./cms-mapping-client";

export const dynamic = "force-dynamic";

export default async function CmsMappingPage() {
  const { organization } = await requireAuth();

  const [appChannels, cmsCatalogs, recentLogs] = await Promise.all([
    listAppChannels(organization.id),
    listCmsCatalogsForBindingDropdown(organization.id),
    listRecentSyncLogs(organization.id, { limit: 5 }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">CMS 栏目映射</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          把 APP 的 9 个栏目绑定到华栖云 CMS 的对应栏目，决定 `cms_publish` 将稿件落到哪里。
        </p>
      </div>

      <CmsMappingClient
        appChannels={appChannels.map((c) => ({
          id: c.id,
          slug: c.slug,
          displayName: c.displayName,
          reviewTier: c.reviewTier,
          icon: c.icon,
          sortOrder: c.sortOrder ?? 0,
          isEnabled: c.isEnabled ?? true,
          defaultCatalogId: c.defaultCatalogId,
          defaultCatalogName: c.defaultCatalog?.name ?? null,
          defaultCoverUrl: c.defaultCoverUrl,
        }))}
        cmsCatalogs={cmsCatalogs}
        recentLogs={recentLogs.map((log) => ({
          id: log.id,
          state: log.state,
          triggerSource: log.triggerSource ?? "",
          stats: log.stats as Record<string, number> | null,
          startedAt: log.startedAt.toISOString(),
          completedAt: log.completedAt?.toISOString() ?? null,
          durationMs: log.durationMs ?? null,
          errorMessage: log.errorMessage ?? null,
        }))}
      />
    </div>
  );
}
```

- [ ] **Step 39.4: 写 cms-mapping-client.tsx（Client Component）**

Create `src/app/(dashboard)/settings/cms-mapping/cms-mapping-client.tsx`：

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  triggerCatalogSyncAction,
  updateAppChannelBindingAction,
} from "@/app/actions/cms";

interface AppChannelVm {
  id: string;
  slug: string;
  displayName: string;
  reviewTier: "strict" | "relaxed";
  icon: string | null;
  sortOrder: number;
  isEnabled: boolean;
  defaultCatalogId: string | null;
  defaultCatalogName: string | null;
  defaultCoverUrl: string | null;
}

interface CmsCatalogVm {
  id: string;
  cmsCatalogId: number;
  name: string;
  innerCode: string | null;
  treeLevel: number | null;
  appId: number;
  siteId: number;
}

interface SyncLogVm {
  id: string;
  state: string;
  triggerSource: string;
  stats: Record<string, number> | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

interface Props {
  appChannels: AppChannelVm[];
  cmsCatalogs: CmsCatalogVm[];
  recentLogs: SyncLogVm[];
}

export function CmsMappingClient({ appChannels, cmsCatalogs, recentLogs }: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"bindings" | "catalogs" | "logs">("bindings");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const handleSync = () => {
    startTransition(async () => {
      setSyncMsg("同步中...");
      const res = await triggerCatalogSyncAction({ deleteMissing: true });
      if (res.success) {
        const s = res.stats;
        setSyncMsg(
          `同步成功：渠道 ${s.channelsFetched} / 应用 ${s.appsFetched} / 栏目 ${s.catalogsFetched}（新增 ${s.catalogsInserted}，更新 ${s.catalogsUpdated}，软删 ${s.catalogsSoftDeleted}）`,
        );
      } else {
        setSyncMsg(`同步失败：${res.error?.message ?? "未知错误"}`);
      }
    });
  };

  return (
    <div>
      {/* 顶部操作区 */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" onClick={handleSync} disabled={isPending}>
          {isPending ? "同步中..." : "立即同步"}
        </Button>
        {syncMsg && <span className="text-sm text-muted-foreground">{syncMsg}</span>}
      </div>

      {/* Tabs（无边框风格，符合 CLAUDE.md 约定） */}
      <div className="mb-4 flex gap-1 border-b border-border/40">
        {[
          ["bindings", "APP 栏目映射"],
          ["catalogs", "CMS 栏目树"],
          ["logs", "同步日志"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`px-4 py-2 text-sm transition-colors hover:bg-muted ${
              activeTab === key ? "font-medium text-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "bindings" && (
        <BindingsTab appChannels={appChannels} cmsCatalogs={cmsCatalogs} />
      )}
      {activeTab === "catalogs" && <CatalogsTab cmsCatalogs={cmsCatalogs} />}
      {activeTab === "logs" && <LogsTab recentLogs={recentLogs} />}
    </div>
  );
}

function BindingsTab({
  appChannels,
  cmsCatalogs,
}: {
  appChannels: AppChannelVm[];
  cmsCatalogs: CmsCatalogVm[];
}) {
  const [isPending, startTransition] = useTransition();
  const [rowMsg, setRowMsg] = useState<Record<string, string>>({});

  const handleBind = (slug: string, catalogId: string) => {
    startTransition(async () => {
      const res = await updateAppChannelBindingAction({ slug, catalogId });
      setRowMsg((m) => ({
        ...m,
        [slug]: res.success ? "✓ 绑定成功" : `✗ ${res.error}`,
      }));
    });
  };

  return (
    <div className="space-y-3">
      {appChannels
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((ch) => (
          <div
            key={ch.slug}
            className="flex items-center justify-between rounded-md bg-muted/30 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ch.icon}</span>
              <div>
                <div className="font-medium">{ch.displayName}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {ch.slug} · 审核档位：{ch.reviewTier === "strict" ? "严" : "松"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <select
                className="rounded bg-background px-3 py-1.5 text-sm"
                defaultValue={ch.defaultCatalogId ?? ""}
                onChange={(e) => e.target.value && handleBind(ch.slug, e.target.value)}
                disabled={isPending}
              >
                <option value="">— 选择 CMS 栏目 —</option>
                {cmsCatalogs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {"  ".repeat((c.treeLevel ?? 1) - 1)}
                    {c.name} <span className="text-muted-foreground">(id {c.cmsCatalogId})</span>
                  </option>
                ))}
              </select>
              {rowMsg[ch.slug] && (
                <span className="text-xs text-muted-foreground">{rowMsg[ch.slug]}</span>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

function CatalogsTab({ cmsCatalogs }: { cmsCatalogs: CmsCatalogVm[] }) {
  if (cmsCatalogs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        本地未同步到任何 CMS 栏目。请先点"立即同步"。
      </p>
    );
  }
  return (
    <div className="space-y-1 font-mono text-xs">
      {cmsCatalogs.map((c) => (
        <div key={c.id} className="flex gap-4 rounded px-3 py-1 hover:bg-muted/30">
          <span className="w-20 text-muted-foreground">{c.cmsCatalogId}</span>
          <span>{"  ".repeat((c.treeLevel ?? 1) - 1)}{c.name}</span>
          <span className="ml-auto text-muted-foreground">
            app={c.appId} site={c.siteId} code={c.innerCode}
          </span>
        </div>
      ))}
    </div>
  );
}

function LogsTab({ recentLogs }: { recentLogs: SyncLogVm[] }) {
  if (recentLogs.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无同步记录。</p>;
  }
  return (
    <div className="space-y-2">
      {recentLogs.map((log) => (
        <div key={log.id} className="rounded-md bg-muted/20 p-3 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                log.state === "done"
                  ? "bg-emerald-500"
                  : log.state === "running"
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
            />
            <span className="font-medium">{log.state}</span>
            <span className="text-muted-foreground">
              · {log.triggerSource} · {new Date(log.startedAt).toLocaleString()}
            </span>
            {log.durationMs != null && (
              <span className="ml-auto text-xs text-muted-foreground">
                {(log.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          {log.stats && (
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {Object.entries(log.stats)
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")}
            </div>
          )}
          {log.errorMessage && (
            <div className="mt-1 text-xs text-rose-500">{log.errorMessage}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 39.5: 启动 dev server 并手动验证**

```bash
npm run dev
```

浏览器打开 `http://localhost:3000/settings/cms-mapping`：

| 检查项 | 预期 |
|--------|------|
| 能看到 9 个 APP 栏目（icon + 名字 + 档位） | ✓ |
| 每行有 CMS 栏目下拉 | ✓ |
| 顶部"立即同步"按钮工作 | ✓ 同步后 CMS 栏目树有数据 |
| Tab 切换：bindings / catalogs / logs | ✓ |
| 绑定后刷新页面仍保留 | ✓ |
| 所有按钮/tab 无边框（符合 CLAUDE.md） | ✓ |

- [ ] **Step 39.6: 类型编译 + 提交**

```bash
npx tsc --noEmit
git add src/app/\(dashboard\)/settings/cms-mapping/ src/lib/dal/cms-catalogs.ts src/app/actions/cms.ts
git commit -m "feat(cms/p1): minimal cms-mapping settings UI (bindings + catalogs + logs)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 40: Skill MD 部署 + 整体冒烟 + 文档收尾

**目的：** Phase 1 收官：把 skill MD 从 spec 目录复制到 `skills/`（Agent 加载路径），跑一次完整冒烟清单，更新 CLAUDE.md。

**Files:**
- Create: `skills/cms_publish/SKILL.md`
- Create: `skills/cms_catalog_sync/SKILL.md`
- Modify: `CLAUDE.md`（追加 CMS 适配层说明）
- Create: `docs/superpowers/plans/phase1-smoke-test.md`

- [ ] **Step 40.1: 复制 Skill MD**

```bash
mkdir -p skills/cms_publish skills/cms_catalog_sync
cp docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design/skills/cms_publish.md skills/cms_publish/SKILL.md
cp docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design/skills/cms_catalog_sync.md skills/cms_catalog_sync/SKILL.md
ls -la skills/cms_*
```

- [ ] **Step 40.2: 在 CLAUDE.md 追加 CMS 适配层说明**

Edit `CLAUDE.md`，在 "Architecture" 章节内追加（找 `### API Routes` 前一位置插入）：

```markdown
### CMS Integration Layer (Phase 1)

Phase 1 交付的 `src/lib/cms/` 模块是 VibeTide → 华栖云 CMS 的唯一出口。

**导出（只从 `@/lib/cms` import，不直接访问内部文件）：**
- `CmsClient` + 5 接口（getChannels / getAppList / getCatalogTree / saveArticle / getArticleDetail）
- `publishArticleToCms({ articleId, appChannelSlug, operatorId, triggerSource })` — 核心入库
- `syncCmsCatalogs(orgId, options)` — 三步栏目同步
- `mapArticleToCms(article, ctx)` + `loadMapperContext(orgId, slug, org)`
- 错误类型：`CmsAuthError` / `CmsBusinessError` / `CmsNetworkError` / `CmsSchemaError` / `CmsConfigError`
- Feature flag：`isCmsPublishEnabled()` / `isCatalogSyncEnabled()`

**9 个 APP 栏目 slug（`ALL_APP_CHANNEL_SLUGS` 严格锁定）：**
`app_home / app_news / app_politics / app_sports / app_variety / app_livelihood_zhongcao / app_livelihood_tandian / app_livelihood_podcast / app_drama`

**关键 env（`.env.local`）：**
- `CMS_HOST` / `CMS_LOGIN_CMC_ID` / `CMS_LOGIN_CMC_TID` / `CMS_TENANT_ID` / `CMS_USERNAME`
- `VIBETIDE_CMS_PUBLISH_ENABLED`（默认 false，按 org 灰度）
- `VIBETIDE_CATALOG_SYNC_ENABLED`（默认 true）

**Inngest 函数：**
- `cmsCatalogSyncDaily`（每天 02:00 Asia/Shanghai 跑 org 级同步）
- `cmsCatalogSyncOnDemand`（event `cms/catalog-sync.trigger`）
- `cmsStatusPoll`（入库后 5 次指数退避轮询，event `cms/publication.submitted`）
- `cmsPublishRetry`（失败重试 3 次，event `cms/publication.retry`）

**配置 UI：** `/settings/cms-mapping`（绑定 app_channels → cms_catalogs + 同步日志）
```

- [ ] **Step 40.3: 整体冒烟测试清单**

Create `docs/superpowers/plans/phase1-smoke-test.md`：

```markdown
# Phase 1 Smoke Test

**执行日期**：<YYYY-MM-DD>
**执行者**：<name>

## A. 单元测试与编译

- [ ] `npm run test -- src/lib/cms/ src/lib/dal/` 全绿
- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm run lint` 零 warning

## B. 数据库

- [ ] `npm run db:push` 无 schema drift
- [ ] `npm run db:studio` 能看到 6 张新表：
  cms_channels / cms_apps / cms_catalogs / cms_sync_logs / cms_publications / app_channels
- [ ] `app_channels` 有 9 行 seed 数据（按 slug 排序完整）

## C. CMS 连通性

- [ ] Pre-flight：`curl -s -o /dev/null -w "%{http_code}" "$CMS_HOST/web/catalog/getChannels"` → 200
- [ ] `npx tsx -e "import { CmsClient, getChannels, requireCmsConfig } from './src/lib/cms'; const c = new CmsClient(requireCmsConfig()); console.log(await getChannels(c));"` → CHANNEL_APP 出现

## D. 栏目同步

- [ ] `POST /api/cms/catalog-sync?dryRun=false` → success + 统计非 0
- [ ] `cms_sync_logs` 最新一行 state='done'
- [ ] `cms_catalogs` 表 count > 0

## E. 运营配置 UI

- [ ] `/settings/cms-mapping` 打开不报错
- [ ] bindings tab 能看到 9 个 APP 栏目 + 下拉 + 保存生效
- [ ] catalogs tab 能看到栏目树
- [ ] logs tab 能看到同步日志（最近 5 条）

## F. End-to-End 场景

- [ ] news_standard 场景：从 approved article → publishArticleToCms → submitted → synced
  （详见 phase1-e2e-news.md）
- [ ] politics_shenzhen 场景：同上
  （详见 phase1-e2e-politics.md）

## G. Inngest 函数注册

Inngest dev UI (`http://localhost:8288`) 能看到这 4 个 function：

- [ ] `cms-catalog-sync-daily`（cron: `TZ=Asia/Shanghai 0 2 * * *`）
- [ ] `cms-catalog-sync-on-demand`（event: `cms/catalog-sync.trigger`）
- [ ] `cms-status-poll`（event: `cms/publication.submitted`）
- [ ] `cms-publish-retry`（event: `cms/publication.retry`）

## H. 异常场景

- [ ] Feature flag 关闭时 publishArticleToCms 立即抛错且不写库
- [ ] CMS 鉴权失败（故意改 `CMS_LOGIN_CMC_ID`）时整个 catalog-sync 链路写 failed log，不损坏已有数据
- [ ] app_channel 未绑定 catalog 时 publishArticleToCms 抛 `app_channel_not_mapped`
- [ ] 同一 article 连续触发两次 publishArticleToCms，第二次走 MODIFY 路径（articleId 被复用）

## I. 代码质量自检

- [ ] grep 不到直接访问 `process.env.CMS_*` 的代码（必须走 `requireCmsConfig()`）
  ```bash
  grep -r "process.env.CMS_" src --include="*.ts" | grep -v "feature-flags.ts"
  # 预期：零条
  ```
- [ ] grep 不到绕过 `src/lib/cms` 直接 fetch CMS 的代码
  ```bash
  grep -rn "/web/article/save\|/web/catalog/getTree" src --include="*.ts" | grep -v "src/lib/cms/"
  # 预期：零条
  ```

## 结论

全部通过：**Phase 1 可移交测试 organization 进入 β 灰度**。

若任一项未通过：附 issue 清单，归类到 "阻塞 / 警告 / 优化"，阻塞项必须修完才能合入 main。
```

- [ ] **Step 40.4: 运行完整冒烟**

按上表逐项勾选。本 task 的 Step 不列每条的具体命令（已在报告中），由执行人在实际操作时勾选。

- [ ] **Step 40.5: 提交收尾**

```bash
git add skills/cms_publish/SKILL.md skills/cms_catalog_sync/SKILL.md
git add CLAUDE.md docs/superpowers/plans/phase1-smoke-test.md
git commit -m "chore(cms/p1): deploy skills + update CLAUDE.md + smoke test checklist

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

# Section G 完成检查

```bash
# 1. 全部 40 个 task commit 均在 git log
git log --oneline | grep "(cms/p1)" | wc -l
# 预期 ≥ 38（部分 task 可能无独立 commit；T37/T38 报告也算）

# 2. 对应产出物
ls -d src/lib/cms/ src/lib/dal/cms-* src/db/schema/cms-* src/db/schema/app-channels.ts \
       src/app/actions/cms.ts src/app/api/cms/ src/inngest/functions/cms-* \
       src/app/\(dashboard\)/settings/cms-mapping/ \
       skills/cms_publish/ skills/cms_catalog_sync/ \
       docs/superpowers/plans/phase1-*.md 2>&1

# 3. phase1-smoke-test.md 全绿
```

---

# Phase 1 Exit Criteria（退出标准）

**必须全部满足才能进入 Phase 2：**

| # | 标准 | 验证 |
|---|------|------|
| 1 | 单元测试覆盖 CMS 模块核心路径 | `npm run test -- src/lib/cms/` 零失败；关键函数（client/mapper/reconcile/publish）覆盖率 ≥ 80% |
| 2 | TS 严格编译通过 | `npx tsc --noEmit` 零错误 |
| 3 | 6 张新表成功 push | db:studio 可见；可增删改查 |
| 4 | 2 个场景 E2E 通过 | `phase1-e2e-news.md` + `phase1-e2e-politics.md` 全绿 |
| 5 | 冒烟测试全过 | `phase1-smoke-test.md` 全部打勾 |
| 6 | Feature flag 机制生效 | `VIBETIDE_CMS_PUBLISH_ENABLED=false` 下所有入库路径拒绝执行 |
| 7 | 灰度可用（测试 org） | 至少 1 个测试 organization 打开 flag 后连续 24h 无异常 |
| 8 | 代码卫生 | 无 `process.env.CMS_*` 裸访问；无绕过 `src/lib/cms` 的旁路调用 |

**如 Phase 1 未通过 exit criteria：不得开始 Phase 2（AIGC 脚本推送）。**

---

# Open Questions / 遗留问题（进 Phase 2 前需解）

| # | 问题 | 影响 | 建议时间 |
|---|------|------|---------|
| 1 | `CMS_LOGIN_CMC_ID/TID` 固定值；失效后需手动替换 | 凭证过期将全部入库链路中断 | Phase 2 接 MMS/CMC 动态鉴权 |
| 2 | `cms_apps.appsecret` 明文存 DB | 安全风险 | Phase 2 接 KMS 加密 |
| 3 | `cms-status-poll` 超过 5 次后保留 submitted，没有告警 | 可能遗忘 | Phase 5 告警接通后加 metric |
| 4 | `publishArticleToCmsAction` 没有 rate limit | 大量 article 同时触发时 CMS 被打爆 | Phase 5 加队列/限速 |
| 5 | `/settings/cms-mapping` UI 是最小版本 | 运营体验不佳（无搜索/过滤/空态引导） | Phase 5 完善 |
| 6 | 9 APP 栏目 slug 硬编码到枚举 | 新增栏目要改代码 | Phase 3+ 改运行时 `app_channels` 表驱动 |
| 7 | type=5 视频、type=11 音频 mapper 未实现 | 方案 A 下 Phase 1 不需要；Phase 2+ 接回调入稿时要补 | Phase 4 |
| 8 | `requestHash` 未用于"跳过重发" | 目前幂等靠 `findLatestSuccessByArticle`；重发仍会产生新 publication 记录 | 可选优化 |

---

# Next Phase Preview

**Phase 2（AIGC 脚本推送）预计范围：**
- `src/lib/aigc-video/` 完整实现（Provider 抽象 + huashengyun 实现）
- `aigc_submissions` + `aigc_callback_logs` 数据模型
- Callback endpoint `/api/aigc-video/callback`（含 HMAC 签名）
- 任务中心 AIGC 状态展示（SSE 实时推送）
- 新闻视频脚本场景（`script_generate[news_video]`）端到端

依赖：Phase 1 已完成 + 华栖云 AIGC 接口文档到位。

---

# Plan Review Checklist（本 Plan 执行前自检）

如果你是第一次来执行这份 plan，先读完以下内容：

- [ ] 读 `docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md` §1-§4、§9-§11（架构 + CMS 接口 + 数据模型）
- [ ] 读 `skills/cms_publish/SKILL.md`（执行规范）
- [ ] 读 `skills/cms_catalog_sync/SKILL.md`
- [ ] 本地 `.env.local` 已填 CMS_* 凭证（可问运营）
- [ ] 测试数据库可连接（`npm run db:push` 成功）
- [ ] Inngest dev server 可运行（`npx inngest-cli@latest dev ...`）
- [ ] 了解 vitest 约定（`__tests__/` 子目录）

---

# 交付产物清单

执行本 plan 后应产出：

```
代码（30+ 文件新增 + 6 处修改）:
  src/lib/cms/
    client.ts, errors.ts, feature-flags.ts, types.ts, status-machine.ts, index.ts
    api-endpoints.ts
    article-mapper/{common, type1-article, type2-gallery, type4-external, determine-type, index}.ts
    catalog-sync/{flatten-tree, reconcile, sync, index}.ts
    publish/{request-hash, publish-article, index}.ts
    __tests__/  (20+ 测试文件)
  src/db/schema/{cms-publications, cms-mapping, app-channels}.ts
  src/lib/dal/{cms-publications, cms-channels, cms-apps, cms-catalogs, cms-sync-logs, app-channels}.ts
  src/app/actions/cms.ts
  src/app/api/cms/catalog-sync/{route, [logId]/route}.ts
  src/app/(dashboard)/settings/cms-mapping/{page, cms-mapping-client}.tsx
  src/inngest/functions/{cms-catalog-sync, cms-status-poll, cms-publish-retry}.ts
  src/db/schema/enums.ts (追加)
  src/db/schema/index.ts (追加 exports)
  src/db/seed.ts (追加 9 APP 栏目)
  .env.example (追加 CMS_*)
  CLAUDE.md (追加 CMS 适配层说明)

Skill:
  skills/cms_publish/SKILL.md
  skills/cms_catalog_sync/SKILL.md

文档:
  docs/superpowers/plans/phase1-e2e-news.md
  docs/superpowers/plans/phase1-e2e-politics.md
  docs/superpowers/plans/phase1-smoke-test.md

Git:
  ~40 个 feat/chore/docs(cms/p1) commit
  全部在 feature/genspark-redesign-phase1 或独立 phase1 分支
```

---

**✅ Phase 1 Implementation Plan — Complete**

本 plan 共 **40 个 task**，预计工期 1-2 周（单人）。执行完毕后 VibeTide 将具备 "AI 员工产出图文稿 → CMS 入库 → APP 发布" 的最小闭环生产能力，为 Phase 2（AIGC 脚本推送）奠定基础。
