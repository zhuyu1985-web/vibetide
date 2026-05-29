# CMS 文稿入库发布栏目参数化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `cms_publish` skill 在每个 workflow_template 上独立指定 CMS 推送栏目，消除 3 处硬编码 `81/1768/10210`，旧场景零破坏。

**Architecture:**
- env 层：3 个新 `CMS_DEFAULT_*` env + `CmsConfig` 扩展 `defaultSiteId/AppId/CatalogId`。
- 工具层：`cms_publish` inputSchema 加 `catalogId/appId/siteId` 三个 optional 参数；execute 聚合为 `target` 传给 `publishArticleToCms`。
- 核心层：`publishArticleToCms` 接受 `target`；`loadMapperContext` 签名扩展；`target` 持久化到 `cms_publications.requestPayload._target` 让重试可还原。
- UI 层：`/settings/cms-mapping` 横幅从 server-side 读 config，不再嵌硬编码常量。

**Tech Stack:** TypeScript / Vitest / Next.js 16 App Router / Drizzle ORM / Inngest

**Spec:** [docs/superpowers/specs/2026-05-29-cms-publish-catalog-selector-design.md](../specs/2026-05-29-cms-publish-catalog-selector-design.md)

---

## File Structure

**修改的文件（共 7 个）：**

| 文件 | 责任 | 改动量 |
|------|------|--------|
| `src/lib/cms/feature-flags.ts` | env → CmsConfig；新增 3 字段 | ~10 行新增 |
| `src/lib/cms/article-mapper/index.ts` | 删 3 个 HARDCODED_ 常量；`loadMapperContext` 接 target 参数 | ~15 行改 |
| `src/lib/cms/publish/publish-article.ts` | `PublishInput.target`；持久化 `_target` 进 `requestPayload`；透传给 mapper | ~15 行改 |
| `src/inngest/functions/cms-publish-retry.ts` | 从 publication.requestPayload._target 还原 target | ~10 行改 |
| `src/lib/agent/tool-registry.ts:1319-1495` | inputSchema 3 字段；execute 聚合 target；dryRun/meta 回显真实值；description 改写 | ~25 行改 |
| `src/app/(dashboard)/settings/cms-mapping/page.tsx` | server-side 读 config，作为 prop 传递 | ~5 行新增 |
| `src/app/(dashboard)/settings/cms-mapping/cms-mapping-client.tsx` | 删 HARDCODED_TARGET；改用 prop；横幅文案 | ~10 行改 |

**新建的测试文件（共 1 个，其余在现有测试文件追加）：**

| 测试文件 | 测试责任 |
|---------|---------|
| `src/lib/cms/__tests__/article-mapper/load-mapper-context.test.ts` | loadMapperContext 的 target override 行为 |
| `src/lib/cms/__tests__/feature-flags.test.ts`（已存在，追加） | requireCmsConfig 读 CMS_DEFAULT_* / fallback 行为 |
| `src/lib/cms/__tests__/publish/publish-article.test.ts`（已存在，追加） | target 透传 + 持久化进 requestPayload._target |
| `src/lib/cms/__tests__/publish/request-hash.test.ts`（已存在，追加） | _target 进入哈希；catalogId 变化 → 哈希变化 |
| `src/lib/agent/__tests__/cms-publish-tool.test.ts`（新建） | cms_publish 工具 dryRun 回显真实 target；execute 聚合 target |
| `src/inngest/functions/__tests__/cms-publish-retry.test.ts`（新建，如不存在） | retry 时从 publication 读 _target 透传给 publishArticleToCms |

**Env file（手动改）：**
- `.env.example` 加注释 + 3 个新 key（不阻塞实施，最后一步加）
- `.env.local` 用户/部署侧自己加（spec §8 上线步骤）

---

## Phase 1: env 配置层（CmsConfig 扩展）

**Scope:** 只改 `feature-flags.ts` + 其单测；零行为变化（fallback 等同原硬编码）。

### Task 1.1: 给 CmsConfig 加 defaultSiteId/AppId/CatalogId 字段（TDD）

**Files:**
- Modify: `src/lib/cms/__tests__/feature-flags.test.ts`
- Modify: `src/lib/cms/feature-flags.ts`

- [ ] **Step 1: 写失败测试**

在 `src/lib/cms/__tests__/feature-flags.test.ts` 文件末尾追加 describe 块：

```ts
describe("requireCmsConfig — default target (CMS_DEFAULT_*)", () => {
  const ORIGINAL_ENV = { ...process.env };

  function setRequired() {
    process.env.CMS_HOST = "https://cms.test";
    process.env.CMS_LOGIN_CMC_ID = "id";
    process.env.CMS_LOGIN_CMC_TID = "tid";
    process.env.CMS_TENANT_ID = "t";
    process.env.CMS_USERNAME = "u";
  }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CMS_DEFAULT_SITE_ID;
    delete process.env.CMS_DEFAULT_APP_ID;
    delete process.env.CMS_DEFAULT_CATALOG_ID;
    setRequired();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("读取 CMS_DEFAULT_* env 并解析为 number", () => {
    process.env.CMS_DEFAULT_SITE_ID = "100";
    process.env.CMS_DEFAULT_APP_ID = "2000";
    process.env.CMS_DEFAULT_CATALOG_ID = "30000";
    const cfg = requireCmsConfig();
    expect(cfg.defaultSiteId).toBe(100);
    expect(cfg.defaultAppId).toBe(2000);
    expect(cfg.defaultCatalogId).toBe(30000);
  });

  it("env 缺失时回退到代码内默认 81 / 1768 / 10210", () => {
    const cfg = requireCmsConfig();
    expect(cfg.defaultSiteId).toBe(81);
    expect(cfg.defaultAppId).toBe(1768);
    expect(cfg.defaultCatalogId).toBe(10210);
  });
});
```

若文件没有 `beforeEach/afterEach` import，确保从 `"vitest"` 引入。

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npx vitest run src/lib/cms/__tests__/feature-flags.test.ts -t "default target"
```
Expected: 2 个 case 都失败（`cfg.defaultSiteId` undefined）。

- [ ] **Step 3a: 先同步更新现有 toEqual 断言（防 break 老 case）**

`src/lib/cms/__tests__/feature-flags.test.ts` 第 57-66 行原有 `it("returns config object when all env present", ...)` 用了**严格**的 `toEqual({...})` 整体相等比对。给 `CmsConfig` 加 3 个新字段会让这个老 case 立刻 FAIL（多余 key）。改两选一：

**方案 A（推荐）**：在 `toEqual` 对象里追加 3 个字段：

```ts
expect(config).toEqual({
  host: "https://example.com",
  loginCmcId: "id123",
  loginCmcTid: "tid123",
  tenantId: "tenant123",
  username: "admin",
  timeoutMs: 15000,
  maxRetries: 3,
  defaultCoverUrl: expect.any(String),
  defaultSiteId: 81,        // ← 新增
  defaultAppId: 1768,       // ← 新增
  defaultCatalogId: 10210,  // ← 新增
});
```

**方案 B**：改 `toEqual` 为 `expect.objectContaining`，未来增减字段都不破坏。本计划用方案 A，更明确。

- [ ] **Step 3b: 实现 CmsConfig 扩展**

修改 `src/lib/cms/feature-flags.ts`：

```ts
export interface CmsConfig {
  host: string;
  loginCmcId: string;
  loginCmcTid: string;
  tenantId: string;
  username: string;
  timeoutMs: number;
  maxRetries: number;
  defaultCoverUrl: string;
  // === 新增 ===
  defaultSiteId: number;
  defaultAppId: number;
  defaultCatalogId: number;
}
```

在 `requireCmsConfig()` 返回对象末尾追加：

```ts
defaultSiteId: parseInt(process.env.CMS_DEFAULT_SITE_ID ?? "81", 10),
defaultAppId: parseInt(process.env.CMS_DEFAULT_APP_ID ?? "1768", 10),
defaultCatalogId: parseInt(process.env.CMS_DEFAULT_CATALOG_ID ?? "10210", 10),
```

**不要**把这 3 个 key 加进 `REQUIRED_ENVS`（必须保留 optional 语义）。

- [ ] **Step 4: 跑测试确认 PASS**

```bash
npx vitest run src/lib/cms/__tests__/feature-flags.test.ts
```
Expected: 全部 PASS（含原有 case + 2 个新 case）。

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

```bash
git add src/lib/cms/feature-flags.ts src/lib/cms/__tests__/feature-flags.test.ts
git commit -m "feat(cms): CmsConfig 增加 defaultSiteId/AppId/CatalogId 字段"
```

---

## Phase 2: loadMapperContext 接受 target override

**Scope:** 改 `article-mapper/index.ts` —— 删 3 个 `HARDCODED_*` 常量，`loadMapperContext` 签名扩展接 target；新建测试文件。

### Task 2.1: loadMapperContext 测试（TDD）

**Files:**
- Create: `src/lib/cms/__tests__/article-mapper/load-mapper-context.test.ts`

- [ ] **Step 1: 写测试文件**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadMapperContext } from "@/lib/cms/article-mapper";

const ORIGINAL_ENV = { ...process.env };

function setRequiredEnv() {
  process.env.CMS_HOST = "https://cms.test";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "t";
  process.env.CMS_USERNAME = "u";
}

describe("loadMapperContext — target override", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CMS_DEFAULT_SITE_ID;
    delete process.env.CMS_DEFAULT_APP_ID;
    delete process.env.CMS_DEFAULT_CATALOG_ID;
    setRequiredEnv();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("不传 target → siteId/appId/catalogId 全部走 env 默认 81/1768/10210", () => {
    const ctx = loadMapperContext({ brandName: "Demo" });
    expect(ctx.siteId).toBe(81);
    expect(ctx.appId).toBe(1768);
    expect(ctx.catalogId).toBe(10210);
  });

  it("传 { catalogId: 10462 } → 只 override catalogId，appId/siteId 仍走默认", () => {
    const ctx = loadMapperContext({ brandName: "Demo" }, { catalogId: 10462 });
    expect(ctx.catalogId).toBe(10462);
    expect(ctx.appId).toBe(1768);
    expect(ctx.siteId).toBe(81);
  });

  it("传完整 target → 三字段全部 override", () => {
    const ctx = loadMapperContext(
      { brandName: "Demo" },
      { catalogId: 10127, appId: 9999, siteId: 99 },
    );
    expect(ctx.catalogId).toBe(10127);
    expect(ctx.appId).toBe(9999);
    expect(ctx.siteId).toBe(99);
  });

  it("env 自定义 + target undefined → 走 env 值", () => {
    process.env.CMS_DEFAULT_CATALOG_ID = "55555";
    const ctx = loadMapperContext({ brandName: "Demo" });
    expect(ctx.catalogId).toBe(55555);
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npx vitest run src/lib/cms/__tests__/article-mapper/load-mapper-context.test.ts
```
Expected: 4 个 case 中 3 个 FAIL（"传 target" 类 case 应失败 —— 当前 `loadMapperContext` 不接 target 参数；唯一 PASS 可能是第一个 case 因为 hardcoded 巧合等于 81/1768/10210，**这是预期的**）。

### Task 2.2: 实现 loadMapperContext target 参数

**Files:**
- Modify: `src/lib/cms/article-mapper/index.ts`

- [ ] **Step 3: 改 loadMapperContext + 删 HARDCODED_*`

完整替换 `src/lib/cms/article-mapper/index.ts` 第 65-105 行：

```ts
/**
 * 从 env 加载 MapperContext，可选 target 覆盖推送目标。
 *
 * - `target.{catalogId,appId,siteId}` 任一字段提供则 override
 * - 未提供则走 `requireCmsConfig().default*`（来自 env，缺失时代码内 fallback 81/1768/10210）
 *
 * @param org { brandName: string } 组织信息（作为 source 字段兜底）
 * @param target 可选推送目标 override
 */
export function loadMapperContext(
  org: { brandName: string },
  target?: { catalogId?: number; appId?: number; siteId?: number },
): MapperContext {
  const config = requireCmsConfig();

  return {
    siteId: target?.siteId ?? config.defaultSiteId,
    appId: target?.appId ?? config.defaultAppId,
    catalogId: target?.catalogId ?? config.defaultCatalogId,
    tenantId: config.tenantId,
    loginId: config.loginCmcId,
    loginTid: config.loginCmcTid,
    username: config.username,
    source: org.brandName || "智媒编辑部",
    author: "智媒编辑部",
    listStyleDefault: {
      imageUrlList: [],
      listStyleName: "默认",
      listStyleType: "0",
    },
    coverImageDefault: config.defaultCoverUrl,
  };
}
```

同时**删除**第 71-73 行的 `HARDCODED_SITE_ID / HARDCODED_APP_ID / HARDCODED_CATALOG_ID` 三个 const 声明（如果它们的注释也指向硬编码，一并清理）。

- [ ] **Step 4: 跑测试确认 PASS**

```bash
npx vitest run src/lib/cms/__tests__/article-mapper/load-mapper-context.test.ts
```
Expected: 4 个 case 全部 PASS。

```bash
npx vitest run src/lib/cms/__tests__/article-mapper/
```
Expected: 不破坏其他 mapper 测试（type1/type2/type4/determine-type/common 都 PASS）。

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
```
Expected: 0 errors（如果 publish-article.ts 或 tool-registry.ts 报"loadMapperContext 用法不变"那就是误判，仍是 0 —— 签名向后兼容）。

```bash
git add src/lib/cms/article-mapper/index.ts \
        src/lib/cms/__tests__/article-mapper/load-mapper-context.test.ts
git commit -m "feat(cms): loadMapperContext 接受 target override，删除硬编码常量"
```

---

## Phase 3: publishArticleToCms target 透传 + 重试持久化

**Scope:** `publishArticleToCms` 入参加 target，传给 mapper；持久化 `_target` 进 `cms_publications.requestPayload`；retry 函数从 publication 还原。

### Task 3.1: publishArticleToCms.target 测试（TDD）

**Files:**
- Modify: `src/lib/cms/__tests__/publish/publish-article.test.ts`

- [ ] **Step 1: 在测试文件末尾追加 target 透传 describe 块**

**重要：不要写自己的 `beforeEach`/`afterEach`。** 该文件的**外层** `beforeEach`（约第 92-115 行）已经统一 mock 了 `getArticleById / getOrganizationById / loadMapperContext / createPublication / findLatestSuccessByArticle` 和 env，并配置了 `mockCmsFetch`。新 describe 块只需直接在 `it` 内 trigger CMS 响应 + 检查 mock 调用参数。重复写 mock 容易因执行顺序漏 `createPublication` 等关键 mock 导致 publishArticleToCms 内部解构失败（reviewer 标记的真实陷阱）。

在 `publish-article.test.ts` 末尾追加：

```ts
describe("publishArticleToCms — target override", () => {
  // 复用外层 beforeEach 设置的所有 mock（DAL/mapper/env/CMS fetch）。
  // 内部 it 只关心调用参数，外层 mock 返回值不影响断言。

  it("传 target → 透传给 loadMapperContext 第二个参数", async () => {
    await publishArticleToCms({
      articleId: "art-1",
      operatorId: "op-1",
      triggerSource: "workflow",
      target: { catalogId: 10462, appId: 1768, siteId: 81 },
    });

    expect(loadMapperContext as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ brandName: expect.any(String) }),
      { catalogId: 10462, appId: 1768, siteId: 81 },
    );
  });

  it("不传 target → loadMapperContext 第二个参数为 undefined", async () => {
    await publishArticleToCms({
      articleId: "art-1",
      operatorId: "op-1",
      triggerSource: "workflow",
    });
    expect(loadMapperContext as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({ brandName: expect.any(String) }),
      undefined,
    );
  });

  it("传 target → createPublication 的 requestPayload._target 含正确 catalogId", async () => {
    await publishArticleToCms({
      articleId: "art-1",
      operatorId: "op-1",
      triggerSource: "workflow",
      target: { catalogId: 10462 },
    });

    expect(createPublication as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      expect.objectContaining({
        requestPayload: expect.objectContaining({
          _target: { catalogId: 10462 },
        }),
      }),
    );
  });

  it("不传 target → requestPayload 没有 _target 字段", async () => {
    await publishArticleToCms({
      articleId: "art-1",
      operatorId: "op-1",
      triggerSource: "workflow",
    });
    const call = (createPublication as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(call?.requestPayload).not.toHaveProperty("_target");
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npx vitest run src/lib/cms/__tests__/publish/publish-article.test.ts -t "target override"
```
Expected: 4 个新 case 全失败（publishArticleToCms 还不接 target 参数）。

### Task 3.2: publishArticleToCms 实现 target

**Files:**
- Modify: `src/lib/cms/publish/publish-article.ts`

- [ ] **Step 3: 扩展 PublishInput + 实现 target**

修改 `src/lib/cms/publish/publish-article.ts`：

(a) `PublishInput` 接口（约第 95 行）追加字段：

```ts
export interface PublishInput {
  articleId: string;
  operatorId: string;
  triggerSource: "manual" | "workflow" | "scheduled" | "daily_plan";
  /** 是否允许覆盖 CMS 已有稿件（默认 true，走 CMS MODIFY） */
  allowUpdate?: boolean;
  /** 推送目标 override（catalogId/appId/siteId 任一字段未传走 env 默认） */
  target?: {
    catalogId?: number;
    appId?: number;
    siteId?: number;
  };
}
```

(b) 第 186-188 行 `loadMapperContext` 调用改为：

```ts
const ctx: MapperContext = loadMapperContext(
  { brandName: org.brandName ?? "智媒编辑部" },
  input.target,
);
```

(c) 第 223-232 行 `createPublication` 的 `requestPayload` 改为携带 `_target`：

```ts
const requestHash = hashRequestPayload(
  input.target ? { ...dto, _target: input.target } : dto,
);
const publicationId = await createPublication({
  organizationId: article.organizationId,
  articleId: input.articleId,
  cmsType,
  requestHash,
  requestPayload: input.target ? { ...dto, _target: input.target } : dto,
  operatorId: input.operatorId,
  triggerSource: input.triggerSource,
});
```

**注意**：必须把 `_target` 同时塞进 `requestHash` 和 `requestPayload`，确保 spec §3.7 说的"跨栏目重推 → 新 publication 记录"行为正确。

- [ ] **Step 4: 跑测试确认 PASS**

```bash
npx vitest run src/lib/cms/__tests__/publish/publish-article.test.ts
```
Expected: 新 4 个 case + 原有 case 全 PASS。

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
```

```bash
git add src/lib/cms/publish/publish-article.ts \
        src/lib/cms/__tests__/publish/publish-article.test.ts
git commit -m "feat(cms): publishArticleToCms 接受 target 并持久化进 requestPayload._target"
```

### Task 3.3: request-hash 稳定性测试

**Files:**
- Modify: `src/lib/cms/__tests__/publish/request-hash.test.ts`

- [ ] **Step 1: 追加 _target 稳定性测试**

文件末尾追加：

```ts
describe("hashRequestPayload — _target 字段", () => {
  const baseDto = { title: "t", body: "b", siteId: 81 } as const;

  it("相同 dto + 相同 _target → 哈希稳定", () => {
    const h1 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10462 } });
    const h2 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10462 } });
    expect(h1).toBe(h2);
  });

  it("_target.catalogId 变化 → 哈希变化（防止跨栏目重推命中旧 publication）", () => {
    const h1 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10462 } });
    const h2 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10127 } });
    expect(h1).not.toBe(h2);
  });

  it("有无 _target 字段 → 哈希不同", () => {
    const h1 = hashRequestPayload(baseDto);
    const h2 = hashRequestPayload({ ...baseDto, _target: { catalogId: 10462 } });
    expect(h1).not.toBe(h2);
  });
});
```

- [ ] **Step 2: 跑测试确认 PASS**

```bash
npx vitest run src/lib/cms/__tests__/publish/request-hash.test.ts
```
Expected: 3 个新 case + 原 case 全 PASS（hashRequestPayload 本身不需要改）。

- [ ] **Step 3: commit**

```bash
git add src/lib/cms/__tests__/publish/request-hash.test.ts
git commit -m "test(cms): hashRequestPayload 在 _target 存在时的稳定性测试"
```

### Task 3.4: cmsPublishRetry 从 publication 还原 target

**Files:**
- Modify: `src/inngest/functions/cms-publish-retry.ts`

- [ ] **Step 1: 写测试 —— 重试时透传 _target**

检查 `src/inngest/functions/__tests__/cms-publish-retry.test.ts` 是否存在：

```bash
ls src/inngest/functions/__tests__/cms-publish-retry.test.ts 2>/dev/null
```

如果不存在，创建：

```ts
// src/inngest/functions/__tests__/cms-publish-retry.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cms", () => ({
  publishArticleToCms: vi.fn().mockResolvedValue({
    success: true, publicationId: "pub-1", cmsState: "submitted",
    timings: { totalMs: 1, mappingMs: 1, httpMs: 1 },
  }),
}));
vi.mock("@/lib/dal/cms-publications", () => ({
  getPublicationById: vi.fn(),
  incrementAttempt: vi.fn(),
}));

import { publishArticleToCms } from "@/lib/cms";
import { getPublicationById } from "@/lib/dal/cms-publications";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cmsPublishRetry — target 还原", () => {
  it("从 publication.requestPayload._target 还原 target 传给 publishArticleToCms", async () => {
    vi.mocked(getPublicationById).mockResolvedValue({
      id: "pub-1",
      articleId: "art-1",
      operatorId: "op-1",
      cmsState: "retrying",
      attempts: 1,
      requestPayload: { title: "t", _target: { catalogId: 10462 } },
    } as never);

    // 直接调内部 helper（待 Phase 实现后导出）或调 Inngest event handler。
    // 实施时可把 retry 内部 republish 逻辑拆成 exported async function 便于测试，
    // 不强制 export 整个 inngest function。
    const { republishWithRestoredTarget } = await import(
      "@/inngest/functions/cms-publish-retry"
    );
    await republishWithRestoredTarget("pub-1");

    expect(vi.mocked(publishArticleToCms)).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { catalogId: 10462 },
      }),
    );
  });

  it("publication 无 _target → target 为 undefined", async () => {
    vi.mocked(getPublicationById).mockResolvedValue({
      id: "pub-1",
      articleId: "art-1",
      operatorId: "op-1",
      cmsState: "retrying",
      attempts: 1,
      requestPayload: { title: "t" },
    } as never);

    const { republishWithRestoredTarget } = await import(
      "@/inngest/functions/cms-publish-retry"
    );
    await republishWithRestoredTarget("pub-1");

    expect(vi.mocked(publishArticleToCms)).toHaveBeenCalledWith(
      expect.objectContaining({ target: undefined }),
    );
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npx vitest run src/inngest/functions/__tests__/cms-publish-retry.test.ts
```
Expected: 2 个 case FAIL（`republishWithRestoredTarget` 还没导出）。

- [ ] **Step 3: 改 cms-publish-retry.ts**

把 `src/inngest/functions/cms-publish-retry.ts` 当前 `step.run("republish", async () => { ... try { publishArticleToCms({...}) } catch {...} })` 块抽成独立 exported 函数：

在文件顶部（imports 之后）加：

```ts
/**
 * Republish 单步逻辑（独立 export 便于单测）。
 * 从 publication.requestPayload._target 还原 target，缺失则走默认。
 */
export async function republishWithRestoredTarget(
  publicationId: string,
): Promise<{ success: boolean; cmsState?: string; error?: string }> {
  const pub = await getPublicationById(publicationId);
  if (!pub) return { success: false, error: "publication not found" };

  const payload = pub.requestPayload as { _target?: { catalogId?: number; appId?: number; siteId?: number } } | null;
  const target = payload?._target;

  try {
    const result = await publishArticleToCms({
      articleId: pub.articleId,
      operatorId: pub.operatorId ?? "system",
      triggerSource: "scheduled",
      allowUpdate: true,
      target,
    });
    return { success: true, cmsState: result.cmsState };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
```

然后修改 Inngest 函数内部 `step.run("republish", ...)` 调用 `republishWithRestoredTarget(publicationId)`，删掉原 try/catch 块（保留 logger 调用）：

```ts
return await step.run("republish", async () => {
  const result = await republishWithRestoredTarget(publicationId);
  if (result.success) {
    logger.info(
      `retry: publication ${publicationId} re-published, cmsState=${result.cmsState}`,
    );
  } else {
    logger.warn(
      `retry: publication ${publicationId} failed again: ${result.error}`,
    );
  }
  return result;
});
```

- [ ] **Step 4: 跑测试确认 PASS**

```bash
npx vitest run src/inngest/functions/__tests__/cms-publish-retry.test.ts
```
Expected: 2 个 case PASS。

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
```

```bash
git add src/inngest/functions/cms-publish-retry.ts \
        src/inngest/functions/__tests__/cms-publish-retry.test.ts
git commit -m "feat(cms): retry 时从 publication.requestPayload._target 还原 target"
```

---

## Phase 4: cms_publish 工具 inputSchema + execute

**Scope:** `tool-registry.ts` 的 `cms_publish` 工具加 3 个参数、聚合 target、dryRun 回显真实值、meta 回显真实值；新建工具单测。

### Task 4.1: cms_publish 工具单测（TDD）

**Files:**
- Create: `src/lib/agent/__tests__/cms-publish-tool.test.ts`

- [ ] **Step 1: 写测试文件**

参考 `archive-to-drafts.test.ts` 的 mock 套路。**重要**：`invokeToolDirectly` 返回 wrapper `{ ok: true, toolName, params, result }`（参考 `tool-registry.ts:1768-1771` 和 `archive-to-drafts.test.ts:49-53` 的解包方式）。**断言时必须先解开 wrapper 拿 `res.result`，不要直接 assert `res`**。完整内容：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const publishArticleToCmsMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms", () => ({
  publishArticleToCms: publishArticleToCmsMock,
}));
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: insertMock })),
    })),
  },
}));
vi.mock("@/db/schema/articles", () => ({ articles: {} }));

import { invokeToolDirectly } from "../tool-registry";

beforeEach(() => {
  process.env.CMS_HOST = "https://cms.test";
  process.env.CMS_LOGIN_CMC_ID = "id";
  process.env.CMS_LOGIN_CMC_TID = "tid";
  process.env.CMS_TENANT_ID = "t";
  process.env.CMS_USERNAME = "u";
  process.env.VIBETIDE_CMS_PUBLISH_ENABLED = "true";
  delete process.env.CMS_DEFAULT_SITE_ID;
  delete process.env.CMS_DEFAULT_APP_ID;
  delete process.env.CMS_DEFAULT_CATALOG_ID;

  publishArticleToCmsMock.mockReset();
  insertMock.mockReset();
  insertMock.mockResolvedValue([{ id: "art-1" }]);
  publishArticleToCmsMock.mockResolvedValue({
    success: true,
    publicationId: "pub-1",
    cmsArticleId: "9999",
    cmsState: "submitted",
    publishedUrl: "https://web/article/9999",
    previewUrl: "https://preview/9999",
    timings: { totalMs: 100, mappingMs: 10, httpMs: 90 },
  });
});

/**
 * Helper：解开 invokeToolDirectly 的 wrapper { ok, result } 拿到工具自身的返回值。
 */
type ToolResult = Record<string, unknown>;
function unwrap(res: Awaited<ReturnType<typeof invokeToolDirectly>>): ToolResult {
  if (!res.ok) throw new Error(`invokeToolDirectly failed: ${res.error}`);
  return res.result as ToolResult;
}

describe("cms_publish tool — dryRun 回显真实 target", () => {
  it("不传栏目 → wouldPublish.{catalogId,appId,siteId} 走 env 默认 81/1768/10210", async () => {
    const res = await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", dryRun: true },
      { organizationId: "org-1" },
    );
    const result = unwrap(res);
    expect(result).toMatchObject({
      success: true,
      dryRun: true,
      wouldPublish: { catalogId: 10210, appId: 1768, siteId: 81 },
    });
  });

  it("传 catalogId=10462 → wouldPublish.catalogId === 10462", async () => {
    const res = await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", dryRun: true, catalogId: 10462 },
      { organizationId: "org-1" },
    );
    const result = unwrap(res);
    expect(result).toMatchObject({
      dryRun: true,
      wouldPublish: { catalogId: 10462, appId: 1768, siteId: 81 },
    });
  });

  it("env 设了 CMS_DEFAULT_CATALOG_ID=55555 → 不传时走 55555", async () => {
    process.env.CMS_DEFAULT_CATALOG_ID = "55555";
    const res = await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", dryRun: true },
      { organizationId: "org-1" },
    );
    const result = unwrap(res);
    expect(result).toMatchObject({
      dryRun: true,
      wouldPublish: { catalogId: 55555 },
    });
  });
});

describe("cms_publish tool — execute 聚合 target 传给 publishArticleToCms", () => {
  it("传 {catalogId,appId,siteId} → target 完整传下去", async () => {
    await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", catalogId: 10462, appId: 1768, siteId: 81 },
      { organizationId: "org-1" },
    );

    expect(publishArticleToCmsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "art-1",
        target: { catalogId: 10462, appId: 1768, siteId: 81 },
      }),
    );
  });

  it("全 undefined → target=undefined 不污染参数", async () => {
    await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B" },
      { organizationId: "org-1" },
    );
    expect(publishArticleToCmsMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: undefined }),
    );
  });

  it("meta 回显真实使用的 target/默认值", async () => {
    const res = await invokeToolDirectly(
      "cms_publish",
      { title: "T", body: "B", catalogId: 10462 },
      { organizationId: "org-1" },
    );
    const result = unwrap(res);
    expect(result).toMatchObject({
      meta: {
        catalogId: 10462,
        appId: 1768,
        siteId: 81,
      },
    });
  });
});
```

- [ ] **Step 2: 跑测试确认 FAIL**

```bash
npx vitest run src/lib/agent/__tests__/cms-publish-tool.test.ts
```
Expected: 多个 case FAIL（catalogId/appId/siteId 还不在 inputSchema 里，meta/wouldPublish 还硬编码 10210）。

### Task 4.2: cms_publish 实现

**Files:**
- Modify: `src/lib/agent/tool-registry.ts:1319-1495`

- [ ] **Step 3: 改 inputSchema、execute、dryRun、meta**

修改 `src/lib/agent/tool-registry.ts:1319-1495`：

(a) **description**（约 1320-1328 行）改成：

```ts
description:
  "把一篇稿件真实入库到华栖云 CMS。目标栏目支持运行时参数化：传入 catalogId 即推到指定栏目；" +
  "不传走 env `CMS_DEFAULT_CATALOG_ID`（默认 10210）。appId/siteId 同理（默认 1768/81）。" +
  "流程：1) 新建 articles 行（status=approved）；2) 调 publishArticleToCms 9 步主流程；" +
  "3) 返回 CMS 侧 articleId / publishedUrl / previewUrl。" +
  "前置：env 里 CMS_HOST / CMS_LOGIN_CMC_ID / CMS_LOGIN_CMC_TID / CMS_TENANT_ID + " +
  "VIBETIDE_CMS_PUBLISH_ENABLED=true。",
```

(b) **inputSchema** 在 `tags` 字段之后、`dryRun` 之前插入 3 个 optional 字段（约 1340 行后）：

```ts
catalogId: z
  .number()
  .int()
  .optional()
  .describe("目标 CMS 栏目 ID。不填走 env CMS_DEFAULT_CATALOG_ID（默认 10210）"),
appId: z
  .number()
  .int()
  .optional()
  .describe("CMS APP 应用 ID。不填走 env CMS_DEFAULT_APP_ID（默认 1768）"),
siteId: z
  .number()
  .int()
  .optional()
  .describe("CMS 站点 ID。不填走 env CMS_DEFAULT_SITE_ID（默认 81）"),
```

(c) **execute 参数解构**（约 1355-1365 行）加入新字段：

```ts
execute: async ({
  title, body, summary, authorName, coverImageUrl, tags, dryRun,
  catalogId, appId, siteId,        // ← 新增
  organizationId, operatorId,
}) => {
  // 聚合 target —— 三个字段全 undefined 就传 undefined（不污染下游参数）
  const target =
    catalogId != null || appId != null || siteId != null
      ? { catalogId, appId, siteId }
      : undefined;

  // 用于 dryRun / meta 回显真实生效值
  const { requireCmsConfig } = await import("@/lib/cms/feature-flags");
  const config = requireCmsConfig();
  const effective = {
    catalogId: catalogId ?? config.defaultCatalogId,
    appId: appId ?? config.defaultAppId,
    siteId: siteId ?? config.defaultSiteId,
  };
```

(d) **dryRun 短路块**（约 1376-1395 行）改写：

```ts
if (dryRun) {
  return {
    success: true,
    dryRun: true,
    wouldInsert: {
      title, body, summary,
      organizationId,
      tags: tags ?? [],
    },
    wouldPublish: {
      catalogId: effective.catalogId,
      appId: effective.appId,
      siteId: effective.siteId,
      authorName: authorName ?? "AI 编辑部",
    },
    note: "dry-run: 实际跑会先 insert articles 行（status=approved）再调 publishArticleToCms 9 步流程",
  };
}
```

(e) **publishArticleToCms 调用**（约 1448-1453 行）传 target：

```ts
const pubResult = await publishArticleToCms({
  articleId: created.id,
  operatorId: operatorId ?? "workflow_system",
  triggerSource: "workflow",
  allowUpdate: true,
  target,           // ← 新增
});
```

(f) **成功 meta**（约 1463-1470 行）和**失败 meta**（约 1487-1492 行）的 appId/catalogId/siteId 都换成 `effective.*`：

```ts
meta: {
  title,
  catalogId: effective.catalogId,
  appId: effective.appId,
  siteId: effective.siteId,
  authorName: authorName ?? "AI 编辑部",
},
```

```ts
meta: {
  catalogId: effective.catalogId,
  appId: effective.appId,
  siteId: effective.siteId,
},
```

- [ ] **Step 4: 跑测试确认 PASS**

```bash
npx vitest run src/lib/agent/__tests__/cms-publish-tool.test.ts
```
Expected: 6 个 case 全 PASS。

```bash
npx vitest run src/lib/cms/ src/lib/agent/__tests__/
```
Expected: 整个 cms + agent 测试套件 PASS。

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
```

```bash
git add src/lib/agent/tool-registry.ts \
        src/lib/agent/__tests__/cms-publish-tool.test.ts
git commit -m "feat(cms): cms_publish 工具支持 catalogId/appId/siteId 参数化"
```

---

## Phase 5: UI 横幅清理硬编码

**Scope:** `/settings/cms-mapping` 页面横幅文案从 server-side 读 config，不再嵌 `HARDCODED_TARGET = { siteId: 81, appId: 1768, catalogId: 10210 }`。

### Task 5.1: page.tsx 读 config 传给 client

**Files:**
- Modify: `src/app/(dashboard)/settings/cms-mapping/page.tsx`

- [ ] **Step 1: 改 page.tsx 加载 config**

修改 `src/app/(dashboard)/settings/cms-mapping/page.tsx`：

在 import 区加：

```ts
import { requireCmsConfig } from "@/lib/cms/feature-flags";
```

在 `Promise.all` 之后构建 `defaultTarget`，传给 client：

```ts
// requireCmsConfig 缺 env 时会抛；用 try 兜底让 UI 不挂
let defaultTarget = { siteId: 81, appId: 1768, catalogId: 10210 };
try {
  const cfg = requireCmsConfig();
  defaultTarget = {
    siteId: cfg.defaultSiteId,
    appId: cfg.defaultAppId,
    catalogId: cfg.defaultCatalogId,
  };
} catch {
  // env 未配置时维持代码内默认值
}

return (
  <div className="mx-auto max-w-5xl px-6 py-8">
    <CmsMappingClient
      cmsCatalogs={cmsCatalogs}
      recentLogs={...}
      defaultTarget={defaultTarget}     // ← 新增
    />
  </div>
);
```

### Task 5.2: client 删 HARDCODED_TARGET 用 prop

**Files:**
- Modify: `src/app/(dashboard)/settings/cms-mapping/cms-mapping-client.tsx`

- [ ] **Step 2: 改 client 组件**

修改 `src/app/(dashboard)/settings/cms-mapping/cms-mapping-client.tsx`：

(a) 删除第 42-43 行 `// 当前阶段硬编码的推送目标 ...` 注释和 `HARDCODED_TARGET` 常量。

(b) `Props` 接口加字段：

```ts
interface Props {
  cmsCatalogs: CmsCatalogVm[];
  recentLogs: SyncLogVm[];
  defaultTarget: { siteId: number; appId: number; catalogId: number };  // ← 新增
}
```

(c) 函数签名解构加 prop：

```ts
export function CmsMappingClient({ cmsCatalogs, recentLogs, defaultTarget }: Props) {
```

(d) 第 82-92 行 GlassCard 横幅文案改为：

```tsx
<GlassCard variant="secondary" padding="sm" className="mb-4">
  <div className="text-xs text-muted-foreground">
    当前默认推送目标：
    <span className="font-mono text-foreground">
      {" "}siteId={defaultTarget.siteId} · appId={defaultTarget.appId} · catalogId={defaultTarget.catalogId}
    </span>
    （来自 env <span className="font-mono">CMS_DEFAULT_*</span>，缺失时回退代码默认）。
    workflow_template 在 cms_publish 步骤参数里覆盖 catalogId/appId/siteId 即可推到指定栏目。
  </div>
</GlassCard>
```

- [ ] **Step 3: 起 dev server 在浏览器验证**

```bash
npm run dev
```

打开 `http://localhost:3000/settings/cms-mapping`：
- 横幅显示 `siteId=81 · appId=1768 · catalogId=10210`（或 env 中配置的值）
- 文案有"workflow_template 在 cms_publish 步骤参数里覆盖..."

不需要点同步按钮（同步 bug 不在本次范围）。Ctrl+C 关 dev server。

- [ ] **Step 4: tsc + commit**

```bash
npx tsc --noEmit
```

```bash
git add src/app/(dashboard)/settings/cms-mapping/page.tsx \
        src/app/(dashboard)/settings/cms-mapping/cms-mapping-client.tsx
git commit -m "refactor(cms-mapping): UI 横幅改用 server-side config，去除硬编码常量"
```

---

## Phase 6: 收尾 —— env 模板 / 全量验证 / 文档

### Task 6.1: 更新 .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: 加 3 个 env key 到模板**

在 `.env.example` 的 CMS 配置区域（已有 `CMS_HOST / CMS_LOGIN_CMC_ID` 等）下方追加：

```
# CMS 默认推送目标（workflow_template 在 cms_publish 步骤可覆盖）
# 缺失时代码回退 81/1768/10210（与历史硬编码一致）
CMS_DEFAULT_SITE_ID=81
CMS_DEFAULT_APP_ID=1768
CMS_DEFAULT_CATALOG_ID=10210
```

- [ ] **Step 2: commit**

```bash
git add .env.example
git commit -m "docs(env): 增加 CMS_DEFAULT_SITE_ID/APP_ID/CATALOG_ID 模板"
```

### Task 6.2: 全量回归

- [ ] **Step 3: 完整测试套件**

```bash
npm run test
```
Expected: 全部 PASS（不应破坏任何现有测试）。

- [ ] **Step 4: 全量 tsc**

```bash
npx tsc --noEmit
```
Expected: 0 errors。

- [ ] **Step 5: 生产构建**

```bash
npm run build
```
Expected: 构建成功，无 error。

如有 warning 与本次改动无关可忽略；与 cms_publish / cms-mapping / feature-flags 相关的 error 必须修。

- [ ] **Step 6: 手动验收 checklist（dev 环境）**

```bash
npm run dev
```

(a) 打开 `/skills/cms_publish` 的"测试入口"（如果有），填 `catalogId=10462 + dryRun=true`，确认输出 `wouldPublish.catalogId === 10462`。

(b) 打开任意 workflow_template 编辑器 `/workflows/<某 id>/edit`，给一个 cms_publish 步骤"参数配置 → 添加参数"加 `catalogId = 10462`，保存。

(c) 检查 DB（用 `npm run db:studio` 或对应 workflow_template 行 jsonb），确认 `steps[N].config.parameters.catalogId === 10462`。

(d) 打开 `/settings/cms-mapping` 横幅确认显示新文案，无硬编码字样。

- [ ] **Step 7: 推送（如 worktree 流，先 merge 回 main）**

如果是 worktree：

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide
git checkout main
git merge --ff-only <worktree-branch-name>
git worktree remove .worktrees/<topic>
```

如果直接在 main 上做：

```bash
git push origin main
```

---

## 收尾 checklist

- [ ] Phase 1 完成：`CmsConfig` 加 3 字段 + feature-flags 测试通过
- [ ] Phase 2 完成：`loadMapperContext` 接 target + 删 HARDCODED_*
- [ ] Phase 3 完成：`publishArticleToCms` 接 target + `_target` 持久化 + retry 还原
- [ ] Phase 4 完成：`cms_publish` 工具 3 个新参数 + dryRun/meta 回显真实值
- [ ] Phase 5 完成：UI 横幅改用 server-side config
- [ ] Phase 6 完成：`.env.example` 模板 + 全量回归 + 手动验收
- [ ] 全部 phase 合计 commit 数 ≈ 9 个
- [ ] `npm run test` / `npx tsc --noEmit` / `npm run build` 三件套全绿

## 5 个新场景的运营配置（实施完成后做，不在本计划范围）

| 场景 | workflow_template | 步骤 6 加参数 |
|---|---|---|
| 热点新闻 | 热点新闻 | `catalogId = 10127` |
| AI 早晚报 | AI 早晚报 | `catalogId = 10462` |
| AI 政策解读 | AI 政策解读 | `catalogId = 10138` |
| 时政要闻 | 时政要闻 | `catalogId = 10230` |
| 本地新闻 | 本地新闻 | `catalogId = 10463` |

`appId/siteId` 全部留空，吃 env 默认 1768/81。

## 风险与回退

- **回退点 1**：任何 phase 出问题，`git revert HEAD~N..HEAD` 单独回滚该 phase 的几个 commit，不影响其他 phase。
- **回退点 2**：完整实施完成但生产出问题，整组 commit revert 后行为完全等同改造前（loadMapperContext 不传 target 时仍走 env，env 缺失走代码 fallback 81/1768/10210，与历史一致）。
- **数据兼容性**：老的 `cms_publications` 记录 `requestPayload` 没有 `_target` 字段；retry 时 `payload?._target` 为 undefined → 走默认，行为等同改造前。
