# A1 Collection Hub 升级 Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 Collection Hub 增加多类型内容承载（图文/视频/短视频/图集/音频）+ 媒体身份识别（5 级分级 + 区域 + 区县）+ 媒体字典维护后台，让 Layer 3 消费者（研究 / 同题漏题 / 灵感池 / 知识库）共享统一的"采集 + 媒体识别"基础设施。

**Architecture:** Path C 推倒重建——先**清理 v1 outlet 系统**（删 3 张表 + 137 行 matcher + 167 条 demo seed + 16 处旧引用），再**新建 `media_outlet_dictionary` 表**（org-scoped 全局基础设施，归属 Collection Hub）+ `collected_items` / `collection_sources` 字段扩展。Outlet Recognizer 集成进 Writer 同事务执行（4 优先级链：source 配置 → URL host → 公众号名 → default 兜底）。字典缓存用 version-stamp 失效机制（避免 TTL 延迟）。

**Tech Stack:** Next.js 16 App Router / TypeScript strict / Drizzle ORM 0.45 + postgres / Supabase PostgreSQL / Inngest / shadcn/ui + Radix / Tailwind v4 / Vitest / iron-session / sonner toast。

**关联 sub-spec:** `/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-05-a1-collection-hub-upgrade-design.md`

**关联 main spec:** `/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md` §4.1

**总工期：5-7 工作日**（Phase 0 清理 1 天 + Phase 1-6 实施 4-6 天）

---

## 全局约定

- **单分支约定**（CLAUDE.md）：所有 commit 直接落 `main`，不开 feature branch / worktree
- **Pre-commit hook**：husky 跑全套 vitest 含 flaky test，所有 commit 用 `--no-verify`（用户已授权本任务全程）；测试在 plan 内 step 单独跑
- **绝对路径**：所有文件引用使用绝对路径
- **设计系统**（CLAUDE.md "Design System Rules"）：所有按钮/输入/下拉用 vibetide 共享组件，不写裸 HTML，**所有可点击元素无边框**
- **toast 替代原生对话框**：vibetide 全栈用 `import { toast } from "sonner"`，禁用 `alert()` / `confirm()` / `window.location.reload()`；删除/确认走 shadcn AlertDialog 组件
- **路径错位修正**：sub-spec 个别处写 `src/lib/collection-hub/`，实际目录是 `src/lib/collection/`，plan 全部用后者
- **migration 命名**：现有 vibetide 用两种风格混用（`0034_xxx.sql` drizzle 自动生成 / `20260505xxxxxx_xxx.sql` 手工时间戳），**plan 一律用时间戳格式**避免编号冲突

---

## File Structure

### Phase 0 删除（10 个文件）

| 文件 | 删除原因 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/media-outlets.ts` | v1 outlet 系统，3 张表 schema |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/seed/research/media-outlets.ts` | 167 条 demo seed |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/outlet-matcher.ts` | 137 行旧 matcher |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/__tests__/outlet-matcher.test.ts` | 旧 matcher 测试 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/media-outlets.ts` | 旧 DAL |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/media-outlets.ts` | 旧 server actions |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/admin/media-outlets/page.tsx` | 旧管理页（被 `/data-collection/outlets` 取代） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/admin/media-outlets/media-outlets-client.tsx` | 同上 |

### Phase 0 stub 化（保留文件，处理引用）

| 文件 | stub 操作 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/news-articles.ts` | 删除指向 `mediaOutlets.id` 的 FK 字段（A3 阶段会删整表） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/enums.ts` | 删除 `mediaTierEnum` + `mediaOutletStatusEnum` |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/news-article-search.ts` | 移除 outlet join（暂返回 outlet 字段为 null） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/article-ingest.ts` | 移除 outlet matcher 调用（暂不识别 outlet） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/task-start.ts` | 移除 outlet 引用 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/whitelist-crawl.ts` | 移除 crawl_configs 引用（A3 阶段会重写） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/page.tsx` | 移除 outlet 数据加载 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-workbench-client.tsx` | outlet 字段相关 UI 隐藏（A4 阶段重做） |

### Phase 1-6 新建（17 个）

| 文件 | 责任 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/media-outlet-dictionary.ts` | 新表 schema |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/constants.ts` | OUTLET_TIER + CONTENT_TYPE 枚举 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/outlet-recognizer.ts` | recognizeOutlet + 字典 cache |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/outlet-recognizer.test.ts` | 单测 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/media-outlet-dictionary.ts` | 字典 CRUD + version bump |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/__tests__/media-outlet-dictionary.test.ts` | DAL 单测 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/seed/media-outlet-dictionary/{index,central,industry,chongqing-municipal,chongqing-district,chongqing-eco-gov}.ts` | 5 + 1 个 seed 文件 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/media-outlet-dictionary.ts` | server actions |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/outlets/{page,outlets-client,outlet-edit-dialog,outlet-delete-confirm-dialog}.tsx` | 字典管理 UI 4 文件 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/collection/outlet-batch-recognize.ts` | Inngest 批量回填 |

### Phase 1-6 修改（10 个）

| 文件 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/collection.ts` | collected_items + collection_sources 加字段 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/users.ts:38-49` | organizations 加 mediaOutletDictionaryVersion |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/writer.ts` | 集成 outlet-recognizer |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/types.ts` | NormalizedItem 加 contentType + attachments |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/writer.test.ts` | 加 recognizer 集成 cases |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/collection.ts` | listCollectedItems 加 outlet 筛选 + join 字典取 outletName |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/data-collection-tabs.tsx` | TABS 加第 4 项 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/content/content-client.tsx` | 加分级筛选 + 媒体名搜索 + 媒体列 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/content/item-detail-drawer.tsx` | 加识别信息 + 修正 outlet |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/sources/[id]/source-detail-client.tsx` | 加 outlet 配置字段 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/sources/new/new-source-wizard-client.tsx` | 同上 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/index.ts` | 注册 outletBatchRecognize |
| `/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/20260505XXXXXX_a1_*.sql` | 2 个新 migration（Phase 0 + Phase 1） |

---

## Phase 0：数据调研 + v1 outlet 系统清理（Day 0-1，约 1 天半）

### Task 0.1：调研区县融媒 + 生态环境局公众号名

**目标：** 实施 Phase 2 seed 时数据可直接录入，避免 Day 3 上午卡在调研。

- [ ] **Step 1：列出 40 区县融媒公众号**

照 sub-spec §4.4 的 40 个区县，到微信「搜一搜」逐个查"{区县名}发布"+"{区县名}融媒"+"{区县名}日报"，记录主公众号名 + 备用别名。

输出：填进 sub-spec §4.4 表格的 publicAccountNames 列。

- [ ] **Step 2：列出 40 区县生态环境局公众号**

照 sub-spec §4.5，逐个查"{区县名}生态环境"或"重庆{区县名}生态环境"。部分区县可能无独立公众号（接受空数组）。

输出：填进 sub-spec §4.5。

- [ ] **Step 3：列出区县融媒中心官网域名（可选）**

逐个查 baidu / 区县政府官网底部链接。无官网的区县留空数组。

输出：填进 sub-spec §4.4 的 domains 列。

**预估：** 0.5 天（80 个公众号 × 5 分钟 ≈ 6.7 小时）

**输出物：** 一份 markdown 表格（不入库，作为 Phase 2 seed 实施的输入）

---

### Task 0.2：删除 v1 outlet 系统的 schema 文件

**Files:**
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/media-outlets.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/enums.ts`（删 2 个 enum）
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/news-articles.ts`（删 outlet FK 字段）

- [ ] **Step 1：删除 media-outlets.ts**

```bash
rm /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/media-outlets.ts
```

- [ ] **Step 2：清理 enums.ts**

```bash
cat /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/enums.ts | grep -E "mediaTierEnum|mediaOutletStatusEnum"
```

删除上述 2 个 enum 定义（用 Edit 工具找到对应行删除）。其它 research enum 保持不动。

- [ ] **Step 3：清理 news-articles.ts**

```bash
grep -n "mediaOutlets\|mediaTierEnum\|outletId" /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/research/news-articles.ts
```

删除其中所有指向 `mediaOutlets.id` 的 FK 列定义和 import。news_articles 表本身保留（A3 阶段才删整表），只是失去 outlet 关联。

- [ ] **Step 4：tsc 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit 2>&1 | head -50
```

预期：会有大量 import 错误（其它文件 import 了被删除的符号）—— 这是预期，下一个 Task 处理。

---

### Task 0.3：删除 v1 outlet 的 lib / DAL / actions / seed

**Files:**
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/outlet-matcher.ts`
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/__tests__/outlet-matcher.test.ts`
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/media-outlets.ts`
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/media-outlets.ts`
- Delete: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/seed/research/media-outlets.ts`

- [ ] **Step 1：删除 5 个文件**

```bash
rm /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/outlet-matcher.ts \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/__tests__/outlet-matcher.test.ts \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/media-outlets.ts \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/media-outlets.ts \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/db/seed/research/media-outlets.ts
```

- [ ] **Step 2：tsc 看错误增量**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit 2>&1 | grep -E "Cannot find|has no exported member" | head -30
```

记录所有 import 错误的文件清单，准备下一个 Task stub 化。

---

### Task 0.4：stub 化研究模块对旧 outlet 的引用

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/news-article-search.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/article-ingest.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/task-start.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/research/whitelist-crawl.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/page.tsx`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-workbench-client.tsx`

- [ ] **Step 1：news-article-search.ts**

定位所有 `mediaOutlets` import 和 join，删除 join 子句；查询返回的 outlet 字段（如 outletName / tier / region）改为 `null` 或从 collected_items 的新 outlet_tier/outlet_region 字段读取（如果该测试场景已能命中新表的话——A1 阶段 collected_items 已有 outlet_tier 字段）。

```ts
// 修改前（示例）
.leftJoin(mediaOutlets, eq(newsArticles.mediaOutletId, mediaOutlets.id))
.select({ ..., outletName: mediaOutlets.name, outletTier: mediaOutlets.tier })

// 修改后（注：本 Phase 0 进行时 collected_items.outletTier 字段还没加，
// stub 期间 outlet 字段全部返 NULL；A3/A4 阶段重做研究模块检索 UI 时再接 collected_items 真字段）
import { sql } from "drizzle-orm";
.select({
  ...,
  outletTier: sql<string | null>`NULL`,
  outletRegion: sql<string | null>`NULL`,
  outletName: sql<string | null>`NULL`,
})
```

- [ ] **Step 2：article-ingest.ts**

删除 `outletMatcher` import 和调用。新文章入库时不再做 outlet 识别（这块功能 A1 后会通过 Collection Hub Writer 的 recognizer 在统一池层面做）。

- [ ] **Step 3：task-start.ts / whitelist-crawl.ts**

删除所有 outlet 相关 import 和读写逻辑。`whitelist-crawl.ts` 当前依赖 `mediaOutletCrawlConfigs` 子表的 list_url_template / scheduleCron——A3 阶段会重写这部分（迁到 Collection Hub list_scraper Adapter）。本 A1 阶段把整个 Inngest 函数 body 暂时改为：

```ts
// A1 阶段研究模块的 whitelist crawler 暂时停用，A3 阶段迁到 Collection Hub list_scraper Adapter
console.warn("research/whitelist-crawl is stubbed; will be migrated to collection-hub Adapter in A3");
return { skipped: true };
```

- [ ] **Step 4：research/page.tsx + search-workbench-client.tsx**

删除 outlet 数据加载相关的代码块（DAL 调用、UI 显示）。整页保留可访问，但 outlet 相关 UI 区块隐藏（A4 阶段重做检索 UI 时会补回）。

- [ ] **Step 5：删除旧管理页**

```bash
rm /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/research/admin/media-outlets/page.tsx \
   /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/research/admin/media-outlets/media-outlets-client.tsx
```

如果整个 `/research/admin/media-outlets/` 目录空了，删除目录：

```bash
rmdir /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/research/admin/media-outlets/ 2>/dev/null || true
```

- [ ] **Step 6：tsc 完全通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

预期：**Step 1-5 中间态可以有 import 错（red）；Step 6 即所有 stub 化完成后**才要求零错。如还有错误，回去逐个 stub 化未处理的引用。

- [ ] **Step 7：build 验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run build
```

预期：通过。研究模块部分页面会加载但 outlet 相关 UI 缺失——这是预期，A3-A4 阶段重做。

---

### Task 0.5：创建 Phase 0 migration（DROP 表 + DROP enums）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/20260505000001_a1_drop_v1_outlet_system.sql`

- [ ] **Step 0：探查实际 FK 列名**

drizzle schema 字段名（驼峰）和 DB 列名（蛇形）映射关系不直接，且 v1 设计时可能用 `media_outlet_id` 或 `outlet_id`。先确认：

```bash
psql "$DATABASE_URL" -c "\d research_news_articles" 2>&1 | grep -i "outlet\|fk"
# 或：
psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='research_news_articles' AND column_name ILIKE '%outlet%';"
```

记录实际列名（变量名 `<FK_COL>`），Step 1 SQL 里替换 `<FK_COL>`。

- [ ] **Step 1：手工创建 migration**

```sql
-- 20260505000001_a1_drop_v1_outlet_system.sql
-- A1 Path C: 删除 v1 outlet 系统（research_media_outlets 三张表 + 2 个 enum）

-- 先删依赖
DROP TABLE IF EXISTS research_media_outlet_crawl_configs CASCADE;
DROP TABLE IF EXISTS research_media_outlet_aliases CASCADE;

-- 删 news_articles 中指向 outlet 的 FK 列（把 <FK_COL> 替换为 Step 0 查到的列名）
ALTER TABLE research_news_articles DROP COLUMN IF EXISTS <FK_COL> CASCADE;

-- 主表
DROP TABLE IF EXISTS research_media_outlets CASCADE;

-- 删 enums
DROP TYPE IF EXISTS media_tier CASCADE;
DROP TYPE IF EXISTS media_outlet_status CASCADE;
```

- [ ] **Step 2：drizzle generate 同步元数据 + 二选一（避免双份 DROP）**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:generate
```

drizzle-kit 看到 schema 已删 → 自动生成 DROP migration。**不要并存两份**，按以下规则二选一：

```bash
# 比较两份内容
ls -t /Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/*.sql | head -3
DRIZZLE_FILE=$(ls -t /Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/*.sql | head -1)
diff "$DRIZZLE_FILE" /Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/20260505000001_a1_drop_v1_outlet_system.sql
```

**判断**：
- 如果 drizzle 输出**完整覆盖** Step 1 手工写的所有内容（含 DROP COLUMN）→ 删除手工写的；rename drizzle 文件为 `20260505000001_a1_drop_v1_outlet_system.sql`；同步 journal（参照 Task 1.5 Step 2 jq 命令模板）
- 如果 drizzle 输出**缺失** `ALTER TABLE research_news_articles DROP COLUMN` 那一句（drizzle 看不到那是要删的）→ 保留手工写的；删除 drizzle 自动生成的 .sql 文件 + 同步删除 `_journal.json` 里对应 entry：

```bash
# 删除 drizzle 自动生成的 entry（DRIZZLE_NAME 是它的 basename 不带 .sql）
DRIZZLE_NAME=$(basename "$DRIZZLE_FILE" .sql)
JOURNAL=/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/meta/_journal.json
jq --arg name "$DRIZZLE_NAME" '.entries |= map(select(.tag != $name))' "$JOURNAL" > "$JOURNAL.tmp" && mv "$JOURNAL.tmp" "$JOURNAL"
rm "$DRIZZLE_FILE"
```

最终 supabase/migrations/ 下应该只有 1 个新 migration 文件。

- [ ] **Step 3：应用迁移到 dev DB**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:migrate
```

预期：成功。无报错。

- [ ] **Step 4：手工 SQL 验证**

```bash
psql "$DATABASE_URL" -c "\\d research_media_outlets" 2>&1 | head -3
# 预期：error: relation does not exist
psql "$DATABASE_URL" -c "SELECT typname FROM pg_type WHERE typname IN ('media_tier', 'media_outlet_status');"
# 预期：返回 0 行
```

---

### Task 0.6：Phase 0 commit

- [ ] **Step 1：commit**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add -A src/db/schema/research/ \
        src/db/seed/research/ \
        src/lib/research/ \
        src/lib/dal/research/ \
        src/app/actions/research/ \
        src/app/\(dashboard\)/research/ \
        src/inngest/functions/research/ \
        supabase/migrations/20260505000001_a1_drop_v1_outlet_system.sql && \
git commit --no-verify -m "$(cat <<'EOF'
chore(a1): 清理 v1 outlet 系统 — Path C 推倒重建

- 删 research_media_outlets / aliases / crawl_configs 三张表 + 2 个 enum
- 删 137 行 outlet-matcher / 167 条 demo seed / 旧 DAL+actions / 旧管理页
- stub 化 research 模块对旧 outlet 的 16 处引用
- 研究模块部分功能 A1 阶段暂不可用，A3 阶段重新接通新设计

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2：状态验证**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && git status && \
grep -rln "researchMediaOutlets\|outletMatcher\|outlet-matcher\|research/media-outlets\|mediaTierEnum\|mediaOutletStatusEnum\|mediaOutletAliases\|mediaOutletCrawlConfigs" src/ --include="*.ts" --include="*.tsx" 2>/dev/null
```

预期：grep 返回 0 行，working tree clean。

---

## Phase 1：Schema 基础设施（Day 1 后半-Day 2，约 1.5 天）

### Task 1.1：定义枚举常量

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/constants.ts`

- [ ] **Step 1：写 constants.ts**

```ts
export const OUTLET_TIER_VALUES = [
  "central",
  "provincial_municipal",
  "industry",
  "district_media",
  "government_self_media",
] as const;
export type OutletTier = (typeof OUTLET_TIER_VALUES)[number];

export const OUTLET_TIER_LABELS: Record<OutletTier, string> = {
  central: "央级媒体",
  provincial_municipal: "省/市级媒体",
  industry: "行业媒体",
  district_media: "区县融媒",
  government_self_media: "政务新媒体",
};

export const CONTENT_TYPE_VALUES = [
  "image_text", "video", "short_video", "image_set", "audio", "live",
] as const;
export type ContentType = (typeof CONTENT_TYPE_VALUES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  image_text: "图文",
  video: "视频",
  short_video: "短视频",
  image_set: "图集",
  audio: "音频",
  live: "直播",
};
```

- [ ] **Step 2：tsc 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

---

### Task 1.2：media_outlet_dictionary schema

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/media-outlet-dictionary.ts`

- [ ] **Step 1：写 schema 文件**

```ts
import { sql } from "drizzle-orm";
import {
  boolean, index, pgTable, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";

export const mediaOutletDictionary = pgTable(
  "media_outlet_dictionary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    outletName: text("outlet_name").notNull(),
    outletTier: text("outlet_tier").notNull(),
    outletRegion: text("outlet_region"),
    outletDistrict: text("outlet_district"),
    industryTag: text("industry_tag"),
    domains: text("domains").array(),
    publicAccountNames: text("public_account_names").array(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueOrgName: unique("media_outlet_dictionary_org_name_unique").on(t.organizationId, t.outletName),
    tierIdx: index("media_outlet_dictionary_tier_idx").on(t.organizationId, t.outletTier, t.isActive),
    regionIdx: index("media_outlet_dictionary_region_idx").on(t.organizationId, t.outletRegion),
    domainsGin: index("media_outlet_dictionary_domains_gin").using("gin", t.domains),
    publicAccountsGin: index("media_outlet_dictionary_pa_gin").using("gin", t.publicAccountNames),
  }),
);

export type MediaOutletRow = typeof mediaOutletDictionary.$inferSelect;
export type MediaOutletInsert = typeof mediaOutletDictionary.$inferInsert;
```

- [ ] **Step 2：barrel export 检查**

```bash
ls /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/index.ts 2>/dev/null && cat /Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/index.ts | head -20
```

如有 barrel，append：

```ts
export * from "./media-outlet-dictionary";
```

- [ ] **Step 3：tsc 通过**

---

### Task 1.3：collection.ts 字段扩展

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/collection.ts`

- [ ] **Step 1：collected_items 加 5 字段**

在表定义末尾（`updatedAt` 之后）追加：

```ts
contentType: text("content_type").notNull().default("image_text"),
attachments: jsonb("attachments")
  .$type<Array<{
    kind: "video" | "image" | "audio" | "thumbnail";
    url: string;
    thumbnailUrl?: string;
    mimeType?: string;
    durationMs?: number;
    width?: number;
    height?: number;
    fileSizeBytes?: number;
    extra?: Record<string, unknown>;
  }>>()
  .notNull()
  .default(sql`'[]'::jsonb`),
outletId: uuid("outlet_id"),
outletTier: text("outlet_tier"),
outletRegion: text("outlet_region"),
```

注意 `outletId` **不**写 `.references()` 避免循环依赖，FK 由 SQL migration 单独 ADD CONSTRAINT。

- [ ] **Step 2：collected_items 加 3 个索引**

在 `(t) => ({ ... })` 块追加：

```ts
contentTypeIdx: index("collected_items_content_type_idx").on(t.organizationId, t.contentType),
outletTierIdx: index("collected_items_outlet_tier_idx").on(t.organizationId, t.outletTier),
outletIdIdx: index("collected_items_outlet_id_idx").on(t.outletId),
```

- [ ] **Step 3：collection_sources 加 3 字段**

```ts
outletId: uuid("outlet_id"),
defaultOutletTier: text("default_outlet_tier"),
defaultOutletRegion: text("default_outlet_region"),
```

- [ ] **Step 4：tsc 通过**

---

### Task 1.4：organizations 加 version 字段

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/schema/users.ts:38-49`（organizations 表定义）

- [ ] **Step 1：加字段**

在 `updatedAt` 之前插入：

```ts
mediaOutletDictionaryVersion: integer("media_outlet_dictionary_version").notNull().default(0),
```

`integer` 已在 import 列表里？看现有 `import { ... } from "drizzle-orm/pg-core"`，没有的话加上。

- [ ] **Step 2：tsc 通过**

---

### Task 1.5：生成 + 应用 migration（含手工 FK）

**Files:**
- Generate: `/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/20260505000002_a1_collection_hub_upgrade.sql`

- [ ] **Step 1：drizzle-kit generate**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:generate
```

记录新生成的文件名（drizzle 命名风格 `00XX_xxx.sql`）。

- [ ] **Step 2：rename 为时间戳格式 + 同步 journal**

```bash
# 找出刚生成的文件 + 替换为时间戳命名
DRIZZLE_FILE=$(ls -t /Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/*.sql | head -1)
DRIZZLE_NAME=$(basename "$DRIZZLE_FILE" .sql)
NEW_NAME="20260505000002_a1_collection_hub_upgrade"
mv "$DRIZZLE_FILE" "/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/${NEW_NAME}.sql"

# 同步 _journal.json：tag 字段精确替换（journal entry 结构: { idx, version, when, tag, breakpoints }）
JOURNAL=/Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/meta/_journal.json
jq --arg old "$DRIZZLE_NAME" --arg new "$NEW_NAME" \
  '.entries |= map(if .tag == $old then .tag = $new else . end)' \
  "$JOURNAL" > "$JOURNAL.tmp" && mv "$JOURNAL.tmp" "$JOURNAL"

# 验证：新名应找到 1 条，旧名应 0 条
grep -c "\"$NEW_NAME\"" "$JOURNAL"
grep -c "\"$DRIZZLE_NAME\"" "$JOURNAL"
```

- [ ] **Step 3：检查生成 SQL**

```bash
cat /Users/zhuyu/dev/chinamcloud/vibetide/supabase/migrations/20260505000002_a1_collection_hub_upgrade.sql
```

确认包含：
- `CREATE TABLE media_outlet_dictionary` + 5 索引 + unique
- `ALTER TABLE collected_items ADD COLUMN content_type / attachments / outlet_id / outlet_tier / outlet_region` + 3 索引
- `ALTER TABLE collection_sources ADD COLUMN outlet_id / default_outlet_tier / default_outlet_region`
- `ALTER TABLE organizations ADD COLUMN media_outlet_dictionary_version`

- [ ] **Step 4：手工追加 FK 到同一 migration**

drizzle 因为我们没写 `.references()` 不会生成 FK。手工追加到 migration 文件**末尾**：

```sql

-- A1 手工追加：outletId 外键（schema 故意省略 .references() 避免循环依赖）
ALTER TABLE collected_items
  ADD CONSTRAINT collected_items_outlet_id_fk
  FOREIGN KEY (outlet_id) REFERENCES media_outlet_dictionary(id) ON DELETE SET NULL;

ALTER TABLE collection_sources
  ADD CONSTRAINT collection_sources_outlet_id_fk
  FOREIGN KEY (outlet_id) REFERENCES media_outlet_dictionary(id) ON DELETE SET NULL;
```

- [ ] **Step 5：应用迁移**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run db:migrate
```

预期：成功。

- [ ] **Step 6：手工 SQL 验证**

```bash
psql "$DATABASE_URL" <<'SQL'
\d media_outlet_dictionary
\d collected_items
\d collection_sources
\d organizations
SQL
```

确认字段、索引、外键都到位。重点看：
- `media_outlet_dictionary` 5 个索引 + unique
- `collected_items` 有 `outlet_id` 列 + 外键 `collected_items_outlet_id_fk`
- `collection_sources` 同上
- `organizations` 有 `media_outlet_dictionary_version` 列且默认 0

---

### Task 1.6：DAL — media-outlet-dictionary（含完整测试）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/media-outlet-dictionary.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/__tests__/media-outlet-dictionary.test.ts`

- [ ] **Step 1：写完整测试（TDD 红灯）**

```ts
// /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/__tests__/media-outlet-dictionary.test.ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { organizations } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import {
  listOutletsByOrg, getOutletById, searchOutletsByName,
  bumpDictionaryVersion, getDictionaryVersion,
} from "../media-outlet-dictionary";

let orgA: string;
let orgB: string;

beforeAll(async () => {
  const [a] = await db.insert(organizations).values({ name: "Test Org A", slug: "test-a-" + Date.now() }).returning();
  const [b] = await db.insert(organizations).values({ name: "Test Org B", slug: "test-b-" + Date.now() }).returning();
  orgA = a!.id;
  orgB = b!.id;

  // orgA 灌 3 条
  await db.insert(mediaOutletDictionary).values([
    { organizationId: orgA, outletName: "新华社", outletTier: "central", outletRegion: "全国", domains: ["xinhuanet.com"], publicAccountNames: ["新华社"] },
    { organizationId: orgA, outletName: "重庆日报", outletTier: "provincial_municipal", outletRegion: "重庆", domains: ["cqrb.cn"], publicAccountNames: ["重庆日报"] },
    { organizationId: orgA, outletName: "涪陵发布", outletTier: "district_media", outletRegion: "重庆", outletDistrict: "涪陵区", publicAccountNames: ["涪陵发布"] },
  ]);
  // orgB 灌 1 条
  await db.insert(mediaOutletDictionary).values({
    organizationId: orgB, outletName: "人民日报", outletTier: "central", outletRegion: "全国",
  });
});

afterAll(async () => {
  await db.delete(organizations).where(eq(organizations.id, orgA));
  await db.delete(organizations).where(eq(organizations.id, orgB));
});

describe("listOutletsByOrg", () => {
  it("默认按 tier 升序 + outletName 升序", async () => {
    const rows = await listOutletsByOrg(orgA);
    expect(rows.length).toBe(3);
    expect(rows[0]!.outletTier).toBe("central");
  });

  it("按 tier 过滤", async () => {
    const rows = await listOutletsByOrg(orgA, { tier: "district_media" });
    expect(rows.length).toBe(1);
    expect(rows[0]!.outletName).toBe("涪陵发布");
  });

  it("按 region 过滤", async () => {
    const rows = await listOutletsByOrg(orgA, { region: "重庆" });
    expect(rows.length).toBe(2);
  });

  it("按 search 关键词命中 outletName / publicAccountNames / domains", async () => {
    const a = await listOutletsByOrg(orgA, { search: "重庆" });
    expect(a.length).toBe(1); // 只命中 outletName
    const b = await listOutletsByOrg(orgA, { search: "xinhuanet" });
    expect(b.length).toBe(1); // 命中 domains
    const c = await listOutletsByOrg(orgA, { search: "涪陵发布" });
    expect(c.length).toBe(1); // 命中 publicAccountNames
  });

  it("跨 org 隔离 — orgB 看不到 orgA 数据", async () => {
    const rows = await listOutletsByOrg(orgB);
    expect(rows.length).toBe(1);
    expect(rows[0]!.outletName).toBe("人民日报");
  });
});

describe("getOutletById", () => {
  it("跨 org 返回 null", async () => {
    const orgARows = await listOutletsByOrg(orgA);
    const result = await getOutletById(orgARows[0]!.id, orgB);
    expect(result).toBeNull();
  });
});

describe("bumpDictionaryVersion", () => {
  it("version +1，返回新 version", async () => {
    const before = await getDictionaryVersion(orgA);
    const newVersion = await bumpDictionaryVersion(orgA);
    expect(newVersion).toBe(before + 1);
    const after = await getDictionaryVersion(orgA);
    expect(after).toBe(newVersion);
  });
});

describe("createOutlet 唯一约束", () => {
  it("同 org 重名报错", async () => {
    await expect(db.insert(mediaOutletDictionary).values({
      organizationId: orgA, outletName: "新华社", outletTier: "central",
    })).rejects.toThrow();
  });
});
```

- [ ] **Step 2：跑测试预期失败**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/dal/__tests__/media-outlet-dictionary.test.ts 2>&1 | tail -30
```

预期：所有 it 都失败（DAL 还没写）。

- [ ] **Step 3：实现 DAL**

```ts
// /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/media-outlet-dictionary.ts
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { mediaOutletDictionary, type MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { organizations } from "@/db/schema/users";

export interface ListOutletsFilter {
  tier?: string;
  region?: string;
  search?: string;
  includeInactive?: boolean;
}

export async function listOutletsByOrg(
  orgId: string,
  filter: ListOutletsFilter = {},
): Promise<MediaOutletRow[]> {
  const conditions = [eq(mediaOutletDictionary.organizationId, orgId)];
  if (!filter.includeInactive) {
    conditions.push(eq(mediaOutletDictionary.isActive, true));
  }
  if (filter.tier) {
    conditions.push(eq(mediaOutletDictionary.outletTier, filter.tier));
  }
  if (filter.region) {
    conditions.push(eq(mediaOutletDictionary.outletRegion, filter.region));
  }
  if (filter.search) {
    const q = `%${filter.search}%`;
    const searchExpr = or(
      ilike(mediaOutletDictionary.outletName, q),
      sql`EXISTS (SELECT 1 FROM unnest(${mediaOutletDictionary.publicAccountNames}) x WHERE x ILIKE ${q})`,
      sql`EXISTS (SELECT 1 FROM unnest(${mediaOutletDictionary.domains}) x WHERE x ILIKE ${q})`,
    );
    if (searchExpr) conditions.push(searchExpr);
  }
  return await db.select().from(mediaOutletDictionary)
    .where(and(...conditions))
    .orderBy(asc(mediaOutletDictionary.outletTier), asc(mediaOutletDictionary.outletName));
}

export async function getOutletById(id: string, orgId: string): Promise<MediaOutletRow | null> {
  const rows = await db.select().from(mediaOutletDictionary)
    .where(and(eq(mediaOutletDictionary.id, id), eq(mediaOutletDictionary.organizationId, orgId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function searchOutletsByName(
  orgId: string, query: string, limit = 20,
): Promise<MediaOutletRow[]> {
  const rows = await listOutletsByOrg(orgId, { search: query });
  return rows.slice(0, limit);
}

export async function bumpDictionaryVersion(orgId: string): Promise<number> {
  const result = await db.update(organizations).set({
    mediaOutletDictionaryVersion: sql`${organizations.mediaOutletDictionaryVersion} + 1`,
    updatedAt: new Date(),
  }).where(eq(organizations.id, orgId))
    .returning({ version: organizations.mediaOutletDictionaryVersion });
  return result[0]!.version;
}

export async function getDictionaryVersion(orgId: string): Promise<number> {
  const rows = await db.select({ version: organizations.mediaOutletDictionaryVersion })
    .from(organizations).where(eq(organizations.id, orgId)).limit(1);
  return rows[0]?.version ?? 0;
}
```

- [ ] **Step 4：跑测试预期全过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/dal/__tests__/media-outlet-dictionary.test.ts
```

预期：8/8 pass。

- [ ] **Step 5：tsc 通过**

---

### Task 1.7：Phase 1 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/db/schema/media-outlet-dictionary.ts \
        src/db/schema/collection.ts \
        src/db/schema/users.ts \
        src/db/schema/index.ts \
        src/lib/collection/constants.ts \
        src/lib/dal/media-outlet-dictionary.ts \
        src/lib/dal/__tests__/media-outlet-dictionary.test.ts \
        supabase/migrations/20260505000002_a1_collection_hub_upgrade.sql \
        supabase/migrations/meta/ && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a1): Collection Hub schema 升级 — media_outlet_dictionary 表 + collected_items 多类型 + outlet 字段 + version-stamp 缓存基建 + DAL 完整测试

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2：Seed + Recognizer（Day 3，约 1 天）

### Task 2.1：5 个 seed 文件

**Files:**
- Create: 5 个 seed 文件 + 1 个 index.ts

- [ ] **Step 1：写央级 seed**（参考 sub-spec §4.1 完整 12 条表）

填进 `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/seed/media-outlet-dictionary/central.ts`

- [ ] **Step 2：写行业 seed**（sub-spec §4.2 12 条）

- [ ] **Step 3：写重庆省市级 seed**（sub-spec §4.3 8 条）

- [ ] **Step 4：写区县融媒 seed**（sub-spec §4.4 + Phase 0 Task 0.1 调研结果 40 条）

- [ ] **Step 5：写生态环境系统 seed（按 cqDistricts 字典生成）**

```ts
import type { MediaOutletInsert } from "@/db/schema/media-outlet-dictionary";
import { CQ_DISTRICTS } from "../research/cq-districts";

const MUNICIPAL: Omit<MediaOutletInsert, "id" | "organizationId" | "createdAt" | "updatedAt"> = {
  outletName: "重庆市生态环境局",
  outletTier: "government_self_media",
  outletRegion: "重庆",
  industryTag: "环境",
  publicAccountNames: ["重庆生态环境"],
  description: "重庆市生态环境局政务新媒体",
};

// CQ_DISTRICTS 的具体 export 名根据 src/db/seed/research/cq-districts.ts 实际导出调整
export const CHONGQING_ECO_GOV_OUTLETS = [
  MUNICIPAL,
  ...CQ_DISTRICTS.map((d) => ({
    outletName: `${d.name}生态环境局`,
    outletTier: "government_self_media" as const,
    outletRegion: "重庆",
    outletDistrict: d.name,
    industryTag: "环境",
    publicAccountNames: [],  // Day 0 调研填
    description: `${d.name}生态环境局政务新媒体`,
  })),
];
```

- [ ] **Step 6：写 index.ts**

```ts
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { CENTRAL_OUTLETS } from "./central";
import { INDUSTRY_OUTLETS } from "./industry";
import { CHONGQING_MUNICIPAL_OUTLETS } from "./chongqing-municipal";
import { CHONGQING_DISTRICT_OUTLETS } from "./chongqing-district";
import { CHONGQING_ECO_GOV_OUTLETS } from "./chongqing-eco-gov";

export const ALL_DEFAULT_OUTLETS = [
  ...CENTRAL_OUTLETS, ...INDUSTRY_OUTLETS,
  ...CHONGQING_MUNICIPAL_OUTLETS, ...CHONGQING_DISTRICT_OUTLETS,
  ...CHONGQING_ECO_GOV_OUTLETS,
];

export async function seedMediaOutletDictionary(orgId: string) {
  let inserted = 0;
  let skipped = 0;
  for (const outlet of ALL_DEFAULT_OUTLETS) {
    const result = await db.insert(mediaOutletDictionary)
      .values({ ...outlet, organizationId: orgId })
      .onConflictDoNothing({
        target: [mediaOutletDictionary.organizationId, mediaOutletDictionary.outletName],
      })
      .returning({ id: mediaOutletDictionary.id });
    if (result.length > 0) inserted++;
    else skipped++;
  }
  return { inserted, skipped, total: ALL_DEFAULT_OUTLETS.length };
}
```

- [ ] **Step 7：tsc 通过**

---

### Task 2.2：seed 灌库验证

- [ ] **Step 1：写一次性 dev script**

```bash
mkdir -p /Users/zhuyu/dev/chinamcloud/vibetide/scripts
cat > /Users/zhuyu/dev/chinamcloud/vibetide/scripts/dev-seed-outlets.ts <<'EOF'
import "dotenv/config";
import { seedMediaOutletDictionary } from "@/db/seed/media-outlet-dictionary";

const orgId = process.argv[2];
if (!orgId) { console.error("usage: tsx scripts/dev-seed-outlets.ts <orgId>"); process.exit(1); }
seedMediaOutletDictionary(orgId).then(console.log).catch((e) => { console.error(e); process.exit(1); });
EOF
```

- [ ] **Step 2：执行**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
ORG_ID=$(psql "$DATABASE_URL" -t -A -c "SELECT id FROM organizations LIMIT 1") && \
npx tsx scripts/dev-seed-outlets.ts "$ORG_ID"
```

预期输出：`{ inserted: 113, skipped: 0, total: 113 }`

- [ ] **Step 3：DB 验证**

```bash
psql "$DATABASE_URL" -c "SELECT outlet_tier, COUNT(*) FROM media_outlet_dictionary GROUP BY outlet_tier ORDER BY outlet_tier;"
```

预期：
- central: 12
- district_media: 40
- government_self_media: 41
- industry: 12
- provincial_municipal: 8

- [ ] **Step 4：删除一次性 dev script**

```bash
rm /Users/zhuyu/dev/chinamcloud/vibetide/scripts/dev-seed-outlets.ts
rmdir /Users/zhuyu/dev/chinamcloud/vibetide/scripts 2>/dev/null || true
```

---

### Task 2.3：outlet-recognizer 算法（含完整测试）

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/outlet-recognizer.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/outlet-recognizer.test.ts`

- [ ] **Step 1：写测试（TDD 红灯）**

```ts
import { describe, expect, it } from "vitest";
import { recognizeOutlet } from "../outlet-recognizer";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

const dict: MediaOutletRow[] = [
  { id: "11111111-1111-1111-1111-111111111111", organizationId: "org-a", outletName: "人民日报", outletTier: "central", outletRegion: "全国", outletDistrict: null, industryTag: null, domains: ["people.com.cn", "paper.people.com.cn"], publicAccountNames: ["人民日报"], description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() } as MediaOutletRow,
  { id: "22222222-2222-2222-2222-222222222222", organizationId: "org-a", outletName: "中国环境报", outletTier: "industry", outletRegion: null, outletDistrict: null, industryTag: "环境", domains: ["cenews.com.cn"], publicAccountNames: ["中国环境"], description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() } as MediaOutletRow,
  { id: "33333333-3333-3333-3333-333333333333", organizationId: "org-a", outletName: "重庆日报", outletTier: "provincial_municipal", outletRegion: "重庆", outletDistrict: null, industryTag: null, domains: ["cqrb.cn"], publicAccountNames: ["重庆日报"], description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() } as MediaOutletRow,
  { id: "44444444-4444-4444-4444-444444444444", organizationId: "org-a", outletName: "涪陵发布", outletTier: "district_media", outletRegion: "重庆", outletDistrict: "涪陵区", industryTag: null, domains: [], publicAccountNames: ["涪陵发布"], description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() } as MediaOutletRow,
];

describe("recognizeOutlet 优先级链", () => {
  it("优先级 1：source.outletId 已配置 → 直接用", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://anything-else.com/article" },
      { outletId: dict[0]!.id, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[0]!.id);
    expect(r?.outletTier).toBe("central");
    expect(r?.outletRegion).toBe("全国");
  });

  it("优先级 2：URL host 命中 dict.domains（精确）", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://people.com.cn/article/2025" },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[0]!.id);
  });

  it("优先级 2：URL host 命中 dict.domains（子域名）", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://paper.people.com.cn/rmrb/2025-12-01.html" },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[0]!.id);
  });

  it("优先级 3：rawMetadata.publicAccountName 命中", () => {
    const r = recognizeOutlet(
      { canonicalUrl: null, rawMetadata: { publicAccountName: "涪陵发布" } },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[3]!.id);
    expect(r?.outletTier).toBe("district_media");
  });

  it("优先级 3：rawMetadata.author 也命中（fallback）", () => {
    const r = recognizeOutlet(
      { canonicalUrl: null, rawMetadata: { author: "中国环境" } },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r?.outletId).toBe(dict[1]!.id);
  });

  it("优先级 4：都不命中 + source.default_* 兜底", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://unknown-site.com" },
      { outletId: null, defaultOutletTier: "central", defaultOutletRegion: "全国" },
      dict,
    );
    expect(r?.outletId).toBeNull();
    expect(r?.outletTier).toBe("central");
    expect(r?.outletRegion).toBe("全国");
  });

  it("优先级 5：全部不命中 → null", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "https://unknown-site.com" },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r).toBeNull();
  });

  it("无效 URL 不抛异常", () => {
    const r = recognizeOutlet(
      { canonicalUrl: "not-a-url" },
      { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
      dict,
    );
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2：跑测试预期全失败**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/__tests__/outlet-recognizer.test.ts
```

- [ ] **Step 3：实现 recognizer**

```ts
// /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/outlet-recognizer.ts
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

export interface RecognizableItem {
  canonicalUrl?: string | null;
  rawMetadata?: Record<string, unknown> | null;
}

export interface RecognizableSource {
  outletId: string | null;
  defaultOutletTier: string | null;
  defaultOutletRegion: string | null;
}

export interface RecognizedOutlet {
  outletId: string | null;
  outletTier: string | null;
  outletRegion: string | null;
}

export function recognizeOutlet(
  item: RecognizableItem,
  source: RecognizableSource,
  dict: MediaOutletRow[],
): RecognizedOutlet | null {
  // 1. source.outletId 已配置
  if (source.outletId) {
    const outlet = dict.find((o) => o.id === source.outletId);
    if (outlet) {
      return { outletId: outlet.id, outletTier: outlet.outletTier, outletRegion: outlet.outletRegion };
    }
  }

  // 2. URL host 匹配 dict.domains
  if (item.canonicalUrl) {
    try {
      const host = new URL(item.canonicalUrl).hostname.toLowerCase();
      const matched = dict.find((o) =>
        (o.domains ?? []).some((d) => {
          const lower = d.toLowerCase();
          return host === lower || host.endsWith("." + lower);
        }),
      );
      if (matched) {
        return { outletId: matched.id, outletTier: matched.outletTier, outletRegion: matched.outletRegion };
      }
    } catch {
      // invalid URL, fall through
    }
  }

  // 3. publicAccountName 命中
  const meta = item.rawMetadata ?? {};
  const accountName =
    (meta as { publicAccountName?: string }).publicAccountName ??
    (meta as { author?: string }).author;
  if (accountName) {
    const matched = dict.find((o) => (o.publicAccountNames ?? []).includes(accountName));
    if (matched) {
      return { outletId: matched.id, outletTier: matched.outletTier, outletRegion: matched.outletRegion };
    }
  }

  // 4. source.default_* 兜底
  if (source.defaultOutletTier || source.defaultOutletRegion) {
    return { outletId: null, outletTier: source.defaultOutletTier, outletRegion: source.defaultOutletRegion };
  }

  // 5. 不命中
  return null;
}
```

- [ ] **Step 4：跑测试预期全过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/__tests__/outlet-recognizer.test.ts
```

预期：8/8 pass。

---

### Task 2.4：Phase 2 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/db/seed/media-outlet-dictionary/ \
        src/lib/collection/outlet-recognizer.ts \
        src/lib/collection/__tests__/outlet-recognizer.test.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a1): 媒体字典 V1 seed 113 条 + outlet-recognizer 算法（4 优先级链）+ 完整单测

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3：Recognizer 集成 Writer（Day 4 前半，约 0.5 天）

### Task 3.1：types.ts 加 contentType / attachments

- [ ] **Step 1：read 当前 types.ts**

```bash
cat /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/types.ts
```

- [ ] **Step 2：在 NormalizedItem 加字段**

```ts
contentType?: "image_text" | "video" | "short_video" | "image_set" | "audio" | "live";
attachments?: Array<{
  kind: "video" | "image" | "audio" | "thumbnail";
  url: string;
  thumbnailUrl?: string;
  mimeType?: string;
  durationMs?: number;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  extra?: Record<string, unknown>;
}>;
```

- [ ] **Step 3：tsc 通过**

---

### Task 3.2：writer.ts 集成 recognizer + 字典缓存

- [ ] **Step 1：在 writer.ts 顶部加 import + cache**

```ts
import { recognizeOutlet } from "./outlet-recognizer";
import { getDictionaryVersion, listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

const dictCache = new Map<string, { version: number; outlets: MediaOutletRow[] }>();

async function loadOutletDictionaryCached(orgId: string): Promise<MediaOutletRow[]> {
  const currentVersion = await getDictionaryVersion(orgId);
  const cached = dictCache.get(orgId);
  if (cached && cached.version === currentVersion) return cached.outlets;
  const outlets = await listOutletsByOrg(orgId, { includeInactive: false });
  dictCache.set(orgId, { version: currentVersion, outlets });
  return outlets;
}
```

- [ ] **Step 2：在 writer 的写入逻辑前加 recognizer 调用**

定位 writer 中 `db.insert(collectedItems)` 的代码，在 `.values({...})` 之前插入：

```ts
const dict = await loadOutletDictionaryCached(input.organizationId);
const recognized = recognizeOutlet(
  { canonicalUrl: input.canonicalUrl, rawMetadata: input.rawMetadata },
  {
    outletId: source.outletId ?? null,
    defaultOutletTier: source.defaultOutletTier ?? null,
    defaultOutletRegion: source.defaultOutletRegion ?? null,
  },
  dict,
);
```

把识别结果加到 insert values：

```ts
.values({
  ...,
  contentType: input.contentType ?? "image_text",
  attachments: input.attachments ?? [],
  outletId: recognized?.outletId ?? null,
  outletTier: recognized?.outletTier ?? null,
  outletRegion: recognized?.outletRegion ?? null,
})
```

- [ ] **Step 3：tsc 通过**

---

### Task 3.3：writer 集成测试（完整代码）

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/writer.test.ts`

- [ ] **Step 1：探查 writer.test.ts 现有 setup**

```bash
cat /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/collection/__tests__/writer.test.ts | head -100
```

**记录**（下面的测试模板按这些信息适配）：
- 测试 setup 用的 hook：`beforeAll` / `beforeEach` / 自定义 fixture
- org id 变量命名：可能是 `orgA` / `testOrgId` / `orgIds.a` / `setUpTestOrgs()` 返回值 / 等
- writer 调用接口：`writeCollectedItem(...)` / `writer.write(...)` / 别的导出名
- writer 单参数还是多参数：传 `(item, source)` 还是 `({ item, source })`

下面 Step 2 的测试代码假设 `testOrgId` / `writeCollectedItem(input, source)` 这套命名 — 如实际不同则相应调整变量名和调用语法。

- [ ] **Step 2：append 集成测试 describe 块**

```ts
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { collectedItems } from "@/db/schema/collection";
import { collectionSources } from "@/db/schema/collection";
import { bumpDictionaryVersion } from "@/lib/dal/media-outlet-dictionary";
import { eq, and } from "drizzle-orm";

describe("writer + outlet-recognizer 集成", () => {
  let testOrgId: string;
  let outletPeople: string;  // 人民日报 outlet id
  let outletCqrb: string;    // 重庆日报 outlet id

  beforeAll(async () => {
    // 借用现有测试 setup 的 orgA（参考文件顶部的 setUpTestOrgs / beforeAll）
    testOrgId = orgA;  // 假设现有 setup 提供
    const [a] = await db.insert(mediaOutletDictionary).values({
      organizationId: testOrgId, outletName: "TEST_人民日报", outletTier: "central",
      outletRegion: "全国", domains: ["test-people.com.cn"], publicAccountNames: ["TEST_人民日报"],
    }).returning();
    outletPeople = a!.id;
    const [b] = await db.insert(mediaOutletDictionary).values({
      organizationId: testOrgId, outletName: "TEST_重庆日报", outletTier: "provincial_municipal",
      outletRegion: "重庆", domains: ["test-cqrb.cn"], publicAccountNames: ["TEST_重庆日报"],
    }).returning();
    outletCqrb = b!.id;
    await bumpDictionaryVersion(testOrgId);
  });

  it("source.outletId 已配置 → 写入时直接采用", async () => {
    const [src] = await db.insert(collectionSources).values({
      organizationId: testOrgId, name: "test-src-1", sourceType: "tavily",
      config: {}, firstSeenChannel: "tavily", outletId: outletPeople,
    }).returning();
    // 调用 writer 写一条采集项（具体调用方式依现有 writer 接口）
    const writtenId = await writeCollectedItem({
      organizationId: testOrgId,
      title: "test article 1",
      canonicalUrl: "https://anything.com",
      firstSeenChannel: "tavily",
      contentFingerprint: "fp-test-1",
    }, src!);
    const [item] = await db.select().from(collectedItems).where(eq(collectedItems.id, writtenId));
    expect(item!.outletId).toBe(outletPeople);
    expect(item!.outletTier).toBe("central");
  });

  it("URL host 命中字典 → 自动填 outlet_tier", async () => {
    const [src] = await db.insert(collectionSources).values({
      organizationId: testOrgId, name: "test-src-2", sourceType: "tavily", config: {}, firstSeenChannel: "tavily",
    }).returning();
    const writtenId = await writeCollectedItem({
      organizationId: testOrgId,
      title: "test article 2",
      canonicalUrl: "https://test-cqrb.cn/article/123",
      firstSeenChannel: "tavily",
      contentFingerprint: "fp-test-2",
    }, src!);
    const [item] = await db.select().from(collectedItems).where(eq(collectedItems.id, writtenId));
    expect(item!.outletTier).toBe("provincial_municipal");
    expect(item!.outletRegion).toBe("重庆");
  });

  it("公众号名命中 → 自动填", async () => {
    const [src] = await db.insert(collectionSources).values({
      organizationId: testOrgId, name: "test-src-3", sourceType: "list_scraper", config: {}, firstSeenChannel: "list_scraper",
    }).returning();
    const writtenId = await writeCollectedItem({
      organizationId: testOrgId,
      title: "test article 3",
      canonicalUrl: null,
      rawMetadata: { publicAccountName: "TEST_人民日报" },
      firstSeenChannel: "list_scraper",
      contentFingerprint: "fp-test-3",
    }, src!);
    const [item] = await db.select().from(collectedItems).where(eq(collectedItems.id, writtenId));
    expect(item!.outletTier).toBe("central");
  });

  it("不命中 + source.default_outlet_tier 兜底", async () => {
    const [src] = await db.insert(collectionSources).values({
      organizationId: testOrgId, name: "test-src-4", sourceType: "tavily", config: {}, firstSeenChannel: "tavily",
      defaultOutletTier: "central", defaultOutletRegion: "全国",
    }).returning();
    const writtenId = await writeCollectedItem({
      organizationId: testOrgId,
      title: "test article 4",
      canonicalUrl: "https://unknown.com",
      firstSeenChannel: "tavily",
      contentFingerprint: "fp-test-4",
    }, src!);
    const [item] = await db.select().from(collectedItems).where(eq(collectedItems.id, writtenId));
    expect(item!.outletId).toBeNull();
    expect(item!.outletTier).toBe("central");
  });

  it("version-stamp：outlet 修改后下一条写入用上新字典", async () => {
    // 1. 写第一条（用旧 version）
    const [src] = await db.insert(collectionSources).values({
      organizationId: testOrgId, name: "test-src-5", sourceType: "tavily", config: {}, firstSeenChannel: "tavily",
    }).returning();
    const id1 = await writeCollectedItem({
      organizationId: testOrgId,
      title: "test article 5a",
      canonicalUrl: "https://test-people.com.cn/x",
      firstSeenChannel: "tavily",
      contentFingerprint: "fp-test-5a",
    }, src!);
    const [it1] = await db.select().from(collectedItems).where(eq(collectedItems.id, id1));
    expect(it1!.outletTier).toBe("central");

    // 2. 修改字典：把 TEST_人民日报 的 tier 改为 industry，bump version
    await db.update(mediaOutletDictionary).set({ outletTier: "industry" })
      .where(eq(mediaOutletDictionary.id, outletPeople));
    await bumpDictionaryVersion(testOrgId);

    // 3. 写第二条（应该用新 version）
    const id2 = await writeCollectedItem({
      organizationId: testOrgId,
      title: "test article 5b",
      canonicalUrl: "https://test-people.com.cn/y",
      firstSeenChannel: "tavily",
      contentFingerprint: "fp-test-5b",
    }, src!);
    const [it2] = await db.select().from(collectedItems).where(eq(collectedItems.id, id2));
    expect(it2!.outletTier).toBe("industry");
  });
});
```

注意：`writeCollectedItem` 的调用签名按 vibetide 现有 writer.ts 实际接口调整。如果现有 writer 是 `writeCollectedItem({ ... })` 单参数风格则照写；如果是其它风格则适配。

- [ ] **Step 3：跑测试预期全过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/collection/__tests__/writer.test.ts
```

---

### Task 3.4：Phase 3 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/lib/collection/writer.ts \
        src/lib/collection/types.ts \
        src/lib/collection/__tests__/writer.test.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a1): writer 集成 outlet-recognizer + version-stamp 字典缓存 + 5 个集成测试

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4：字典管理 UI（Day 4 后半-Day 5，约 1.5 天）

### Task 4.1：data-collection-tabs 加第 4 个 tab

- [ ] **Step 1：编辑 TABS 数组**

在 `monitoring` 后追加：

```ts
{
  href: "/data-collection/outlets",
  label: "媒体字典",
  matchPrefixes: ["/data-collection/outlets"],
},
```

- [ ] **Step 2：tsc + 浏览器手动**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit && npm run dev
# 浏览器打开 /data-collection/sources，看顶部应有 4 个 tab
```

---

### Task 4.2：server actions

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/media-outlet-dictionary.ts`

- [ ] **Step 1：写 server actions**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { collectedItems } from "@/db/schema/collection";
import { requireAuth } from "@/lib/auth";
import { OUTLET_TIER_VALUES } from "@/lib/collection/constants";
import { bumpDictionaryVersion } from "@/lib/dal/media-outlet-dictionary";
import { seedMediaOutletDictionary } from "@/db/seed/media-outlet-dictionary";
import { inngest } from "@/inngest/client";

const outletInputSchema = z.object({
  outletName: z.string().min(1).max(100),
  outletTier: z.enum(OUTLET_TIER_VALUES),
  outletRegion: z.string().nullable().optional(),
  outletDistrict: z.string().nullable().optional(),
  industryTag: z.string().nullable().optional(),
  domains: z.array(z.string()).default([]),
  publicAccountNames: z.array(z.string()).default([]),
  description: z.string().nullable().optional(),
});

export async function createOutlet(input: z.infer<typeof outletInputSchema>) {
  const user = await requireAuth();
  const data = outletInputSchema.parse(input);
  const [row] = await db.insert(mediaOutletDictionary).values({
    ...data, organizationId: user.organizationId!,
  }).returning();
  await bumpDictionaryVersion(user.organizationId!);
  revalidatePath("/data-collection/outlets");
  return row;
}

export async function updateOutlet(id: string, input: z.infer<typeof outletInputSchema>) {
  const user = await requireAuth();
  const data = outletInputSchema.parse(input);
  await db.update(mediaOutletDictionary).set({ ...data, updatedAt: new Date() })
    .where(and(
      eq(mediaOutletDictionary.id, id),
      eq(mediaOutletDictionary.organizationId, user.organizationId!),
    ));
  await bumpDictionaryVersion(user.organizationId!);
  revalidatePath("/data-collection/outlets");
}

export async function softDeleteOutlet(id: string) {
  const user = await requireAuth();
  await db.update(mediaOutletDictionary).set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(mediaOutletDictionary.id, id),
      eq(mediaOutletDictionary.organizationId, user.organizationId!),
    ));
  await bumpDictionaryVersion(user.organizationId!);
  revalidatePath("/data-collection/outlets");
}

export async function reseedDictionary() {
  const user = await requireAuth();
  if (!user.isSuperAdmin && user.role !== "admin") throw new Error("权限不足");
  const result = await seedMediaOutletDictionary(user.organizationId!);
  await bumpDictionaryVersion(user.organizationId!);
  revalidatePath("/data-collection/outlets");
  return result;
}

export async function correctItemOutlet(itemId: string, outletId: string | null) {
  const user = await requireAuth();
  let outletTier: string | null = null;
  let outletRegion: string | null = null;
  if (outletId) {
    const [outlet] = await db.select().from(mediaOutletDictionary)
      .where(and(
        eq(mediaOutletDictionary.id, outletId),
        eq(mediaOutletDictionary.organizationId, user.organizationId!),
      )).limit(1);
    if (!outlet) throw new Error("outlet 不存在或跨 org");
    outletTier = outlet.outletTier;
    outletRegion = outlet.outletRegion;
  }
  await db.update(collectedItems).set({ outletId, outletTier, outletRegion, updatedAt: new Date() })
    .where(and(
      eq(collectedItems.id, itemId),
      eq(collectedItems.organizationId, user.organizationId!),
    ));
  revalidatePath("/data-collection/content");
}

export async function batchRecognizeOutlets() {
  const user = await requireAuth();
  if (!user.isSuperAdmin && user.role !== "admin") throw new Error("权限不足");
  await inngest.send({
    name: "collection/outlet-batch-recognize.requested",
    data: { organizationId: user.organizationId! },
  });
}
```

- [ ] **Step 2：tsc 通过**

---

### Task 4.3：outlets 列表页 + client（用 toast 不用 alert）

**Files:**
- Create: page.tsx + outlets-client.tsx + outlet-edit-dialog.tsx + outlet-delete-confirm-dialog.tsx

- [ ] **Step 1：写 page.tsx（server component）**

```tsx
import { requireAuth } from "@/lib/auth";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { OutletsClient } from "./outlets-client";

export const dynamic = "force-dynamic";

export default async function OutletsPage() {
  const user = await requireAuth();
  const initialOutlets = await listOutletsByOrg(user.organizationId!, { includeInactive: true });
  const isAdmin = user.isSuperAdmin || user.role === "admin";
  return <OutletsClient initialOutlets={initialOutlets} isAdmin={isAdmin} />;
}
```

- [ ] **Step 2：写 outlets-client.tsx（client component，用 toast）**

```tsx
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PageHeader } from "@/components/shared/page-header";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { OutletEditDialog } from "./outlet-edit-dialog";
import { OutletDeleteConfirmDialog } from "./outlet-delete-confirm-dialog";
import { reseedDictionary, batchRecognizeOutlets } from "@/app/actions/media-outlet-dictionary";

interface Props {
  initialOutlets: MediaOutletRow[];
  isAdmin: boolean;
}

export function OutletsClient({ initialOutlets, isAdmin }: Props) {
  const [outlets] = useState(initialOutlets);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<OutletTier | "all">("all");
  const [editing, setEditing] = useState<MediaOutletRow | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = outlets.filter((o) => {
    if (tierFilter !== "all" && o.outletTier !== tierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hit =
        o.outletName.toLowerCase().includes(q) ||
        (o.publicAccountNames ?? []).some((n) => n.toLowerCase().includes(q)) ||
        (o.domains ?? []).some((d) => d.toLowerCase().includes(q));
      if (!hit) return false;
    }
    return true;
  });

  const emptyHint = "字典为空，点击右上角「重新初始化字典」灌入默认 113 条";

  return (
    <>
      <PageHeader title="媒体字典" description="维护采集源的媒体身份字典，用于自动识别采集项的媒体分级" />

      <div className="mt-4 flex items-center gap-2">
        <SearchInput
          className="w-64"
          placeholder="搜索媒体名 / 公众号 / 域名"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as OutletTier | "all")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分级</SelectItem>
            {OUTLET_TIER_VALUES.map((t) => (
              <SelectItem key={t} value={t}>{OUTLET_TIER_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          {isAdmin && (
            <>
              <Button variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
                try {
                  const r = await reseedDictionary();
                  toast.success(`字典初始化完成：新增 ${r.inserted} 条 / 跳过 ${r.skipped} 条`);
                  router.refresh();
                } catch (e) {
                  toast.error(`失败：${(e as Error).message}`);
                }
              })}>重新初始化字典</Button>
              <Button variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
                try {
                  await batchRecognizeOutlets();
                  toast.success("批量回填已触发，去 Inngest 监控查看进度");
                } catch (e) {
                  toast.error(`失败：${(e as Error).message}`);
                }
              })}>批量回填历史采集项</Button>
            </>
          )}
          <Button onClick={() => setCreatingNew(true)}>+ 新增媒体</Button>
        </div>
      </div>

      <DataTable
        rows={filtered}
        rowKey={(r) => r.id}
        className="mt-4"
        columns={[
          { key: "outletName", header: "媒体名", render: (r) => r.outletName },
          { key: "outletTier", header: "分级", width: "w-32", render: (r) => OUTLET_TIER_LABELS[r.outletTier as OutletTier] ?? r.outletTier },
          { key: "outletRegion", header: "区域", width: "w-24", render: (r) => r.outletRegion ?? "-" },
          { key: "outletDistrict", header: "区县", width: "w-24", render: (r) => r.outletDistrict ?? "-" },
          { key: "industryTag", header: "行业", width: "w-24", render: (r) => r.industryTag ?? "-" },
          { key: "domains", header: "域名", render: (r) => {
            const arr = r.domains ?? [];
            const head = arr.slice(0, 2).join(", ");
            return arr.length > 2 ? `${head}...` : head || "-";
          }},
          { key: "publicAccountNames", header: "公众号", render: (r) => {
            const arr = r.publicAccountNames ?? [];
            const head = arr.slice(0, 2).join(", ");
            return arr.length > 2 ? `${head}...` : head || "-";
          }},
          { key: "isActive", header: "状态", width: "w-20", render: (r) => r.isActive ? "启用" : "停用" },
          {
            key: "actions", header: "操作", width: "w-32",
            render: (r) => (
              <div className="flex gap-1">
                <Button variant="ghost" onClick={() => setEditing(r)}>编辑</Button>
                <Button variant="ghost" onClick={() => setDeletingId(r.id)}>停用</Button>
              </div>
            ),
          },
        ]}
        emptyMessage={emptyHint}
      />

      {(editing || creatingNew) && (
        <OutletEditDialog
          outlet={editing}
          onClose={() => { setEditing(null); setCreatingNew(false); }}
          onSaved={() => {
            setEditing(null);
            setCreatingNew(false);
            toast.success("保存成功");
            router.refresh();
          }}
        />
      )}

      {deletingId && (
        <OutletDeleteConfirmDialog
          outletId={deletingId}
          outletName={outlets.find((o) => o.id === deletingId)?.outletName ?? ""}
          onClose={() => setDeletingId(null)}
          onDeleted={() => {
            setDeletingId(null);
            toast.success("已停用");
            router.refresh();
          }}
        />
      )}
    </>
  );
}
```

注意：`emptyMessage` 用变量 `emptyHint` 避免在 JSX 属性里嵌套引号。

- [ ] **Step 3：tsc + 浏览器手动**

---

### Task 4.4：outlet-edit-dialog

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/outlets/outlet-edit-dialog.tsx`

- [ ] **Step 1：写 dialog（用 sonner toast，不用 alert）**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import { createOutlet, updateOutlet } from "@/app/actions/media-outlet-dictionary";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

interface Props {
  outlet: MediaOutletRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function OutletEditDialog({ outlet, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    outletName: outlet?.outletName ?? "",
    outletTier: (outlet?.outletTier as OutletTier) ?? "central",
    outletRegion: outlet?.outletRegion ?? "",
    outletDistrict: outlet?.outletDistrict ?? "",
    industryTag: outlet?.industryTag ?? "",
    domains: (outlet?.domains ?? []).join(", "),
    publicAccountNames: (outlet?.publicAccountNames ?? []).join(", "),
    description: outlet?.description ?? "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      const payload = {
        outletName: form.outletName.trim(),
        outletTier: form.outletTier,
        outletRegion: form.outletRegion.trim() || null,
        outletDistrict: form.outletDistrict.trim() || null,
        industryTag: form.industryTag.trim() || null,
        domains: form.domains.split(",").map((s) => s.trim()).filter(Boolean),
        publicAccountNames: form.publicAccountNames.split(",").map((s) => s.trim()).filter(Boolean),
        description: form.description.trim() || null,
      };
      if (outlet) {
        await updateOutlet(outlet.id, payload);
      } else {
        await createOutlet(payload);
      }
      onSaved();
    } catch (e) {
      toast.error(`保存失败：${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  const isDistrictTier = form.outletTier === "district_media" || form.outletTier === "government_self_media";
  const isIndustryTier = form.outletTier === "industry";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{outlet ? `编辑 ${outlet.outletName}` : "新增媒体"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm">媒体名 *</label>
            <Input value={form.outletName} onChange={(e) => setForm({ ...form, outletName: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">分级 *</label>
            <Select value={form.outletTier} onValueChange={(v) => setForm({ ...form, outletTier: v as OutletTier })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTLET_TIER_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>{OUTLET_TIER_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm">区域</label>
            <Input value={form.outletRegion} onChange={(e) => setForm({ ...form, outletRegion: e.target.value })} placeholder="重庆 / 全国 / 江苏" />
          </div>
          {isDistrictTier && (
            <div>
              <label className="text-sm">区县</label>
              <Input value={form.outletDistrict} onChange={(e) => setForm({ ...form, outletDistrict: e.target.value })} placeholder="涪陵区 / 北碚区" />
            </div>
          )}
          {isIndustryTier && (
            <div>
              <label className="text-sm">行业标签</label>
              <Input value={form.industryTag} onChange={(e) => setForm({ ...form, industryTag: e.target.value })} placeholder="环境 / 经济 / 健康" />
            </div>
          )}
          <div>
            <label className="text-sm">域名（逗号分隔）</label>
            <Input value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} placeholder="people.com.cn, paper.people.com.cn" />
          </div>
          <div>
            <label className="text-sm">公众号（逗号分隔）</label>
            <Input value={form.publicAccountNames} onChange={(e) => setForm({ ...form, publicAccountNames: e.target.value })} />
          </div>
          <div>
            <label className="text-sm">描述</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} disabled={submitting || !form.outletName.trim()}>
            {submitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2：写 outlet-delete-confirm-dialog.tsx**

```tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { softDeleteOutlet } from "@/app/actions/media-outlet-dictionary";

interface Props {
  outletId: string;
  outletName: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function OutletDeleteConfirmDialog({ outletId, outletName, onClose, onDeleted }: Props) {
  const [submitting, setSubmitting] = useState(false);
  async function handleConfirm() {
    setSubmitting(true);
    try {
      await softDeleteOutlet(outletId);
      onDeleted();
    } catch (e) {
      toast.error(`停用失败：${(e as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>停用 {outletName}？</AlertDialogTitle>
          <AlertDialogDescription>
            停用后该媒体不参与新采集项的自动识别（已识别的历史项不变）。可以在筛选器选「停用」状态查看，或编辑后恢复启用。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "处理中..." : "确认停用"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

如果项目无 `<AlertDialog>` 组件，先 `npx shadcn add alert-dialog` 安装。

- [ ] **Step 3：浏览器手动**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run dev
# 浏览器访问 /data-collection/outlets
# 验证：列表加载 / 搜索 / 筛选 / 新增 / 编辑 / 停用
# 验证：所有按钮无边框；无 alert/confirm/window.reload 弹出（toast 替代）
```

---

### Task 4.5：Phase 4 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/app/actions/media-outlet-dictionary.ts \
        src/app/\(dashboard\)/data-collection/data-collection-tabs.tsx \
        src/app/\(dashboard\)/data-collection/outlets/ && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a1): 媒体字典管理后台 — /data-collection/outlets 列表 / 编辑 / AlertDialog 停用 / sonner toast 替代 alert

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5：内容浏览 + 源配置 UI（Day 6，约 1 天）

### Task 5.1：DAL listCollectedItems 加 outlet join + 筛选（独立 task）

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/collection.ts`

- [ ] **Step 1：找到 listCollectedItems**

```bash
grep -n "listCollectedItems\|export async function list" /Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/collection.ts
```

- [ ] **Step 2：filter 接口加 outlet 字段**

```ts
export interface ListCollectedItemsFilter {
  // ... 现有字段
  outletTier?: string | "unclassified";
  outletId?: string;
  outletRegion?: string;
}
```

- [ ] **Step 3：query 加 join + where 条件**

```ts
import { isNull } from "drizzle-orm";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";

// query 改为 leftJoin 字典取 outletName
const query = db.select({
  // 原有字段
  ...,
  outletId: collectedItems.outletId,
  outletTier: collectedItems.outletTier,
  outletRegion: collectedItems.outletRegion,
  outletName: mediaOutletDictionary.outletName,
}).from(collectedItems)
  .leftJoin(mediaOutletDictionary, eq(collectedItems.outletId, mediaOutletDictionary.id));

// where 条件
if (filter.outletTier === "unclassified") {
  conditions.push(isNull(collectedItems.outletTier));
} else if (filter.outletTier) {
  conditions.push(eq(collectedItems.outletTier, filter.outletTier));
}
if (filter.outletId) conditions.push(eq(collectedItems.outletId, filter.outletId));
if (filter.outletRegion) conditions.push(eq(collectedItems.outletRegion, filter.outletRegion));
```

- [ ] **Step 4：跑现有 collection.test.ts 验证回归**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/dal/__tests__/collection.test.ts
```

预期：现有所有测试 pass（join 是 LEFT JOIN，不影响原有数据）。

- [ ] **Step 5：性能验证（EXPLAIN ANALYZE）**

```bash
psql "$DATABASE_URL" <<'SQL'
EXPLAIN ANALYZE
SELECT ci.id, ci.title, ci.outlet_tier, mod.outlet_name
FROM collected_items ci
LEFT JOIN media_outlet_dictionary mod ON ci.outlet_id = mod.id
WHERE ci.organization_id = (SELECT id FROM organizations LIMIT 1)
  AND ci.outlet_tier = 'central'
ORDER BY ci.published_at DESC
LIMIT 50;
SQL
```

预期：能命中 `collected_items_outlet_tier_idx` 索引，total time < 100ms（10 万级数据规模时）。

如果未命中索引或时间 > 500ms，加复合索引：

```sql
CREATE INDEX collected_items_org_outlet_pub_idx
  ON collected_items (organization_id, outlet_tier, published_at DESC)
  WHERE outlet_tier IS NOT NULL;
```

并把 CREATE INDEX 加进 migration 20260505000002（或单独 migration 20260505000003）。

---

### Task 5.2：content-client 加分级筛选 + 媒体列

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/content/content-client.tsx`

- [ ] **Step 1：filter state 加字段 + UI**

```tsx
const [outletTier, setOutletTier] = useState<string>("all");
const [outletRegion, setOutletRegion] = useState<string>("all");

<Select value={outletTier} onValueChange={setOutletTier}>
  <SelectTrigger className="w-32"><SelectValue placeholder="媒体分级" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="all">全部分级</SelectItem>
    {OUTLET_TIER_VALUES.map((t) => (
      <SelectItem key={t} value={t}>{OUTLET_TIER_LABELS[t]}</SelectItem>
    ))}
    <SelectItem value="unclassified">未分类</SelectItem>
  </SelectContent>
</Select>

<Select value={outletRegion} onValueChange={setOutletRegion}>
  <SelectTrigger className="w-28"><SelectValue placeholder="区域" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="all">全部区域</SelectItem>
    <SelectItem value="重庆">重庆</SelectItem>
    <SelectItem value="全国">全国</SelectItem>
  </SelectContent>
</Select>
```

把 `outletTier` / `outletRegion` 传给 listCollectedItems 调用（修改 server action / fetch 调用）。

- [ ] **Step 2：DataTable 加"媒体"列**

```tsx
{
  key: "outlet",
  header: "媒体",
  width: "w-40",
  render: (r) => (
    <div className="flex flex-col">
      <span className="text-sm">{r.outletName ?? "未分类"}</span>
      {r.outletTier && (
        <span className="text-xs text-muted-foreground">
          {OUTLET_TIER_LABELS[r.outletTier as OutletTier]}
        </span>
      )}
    </div>
  ),
},
```

- [ ] **Step 3：tsc + 浏览器手动**

---

### Task 5.3：sources 详情/新建加 outlet 字段

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/sources/[id]/source-detail-client.tsx`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/sources/new/new-source-wizard-client.tsx`

- [ ] **Step 1：source 详情页加 3 字段（基本信息区块）**

```tsx
// 加 SearchInput 联想选 outlet（用 searchOutletsByName DAL）
// 加 Select 5 选项默认分级
// 加 Input 默认区域

<div>
  <label className="text-sm">绑定媒体（可选）</label>
  <OutletSearchSelect value={form.outletId} onChange={(v) => setForm({ ...form, outletId: v })} />
</div>
<div>
  <label className="text-sm">默认分级（兜底，未绑媒体时用）</label>
  <Select value={form.defaultOutletTier ?? "none"} onValueChange={...}>...</Select>
</div>
<div>
  <label className="text-sm">默认区域</label>
  <Input value={form.defaultOutletRegion ?? ""} onChange={...} />
</div>
```

`OutletSearchSelect` 是一个轻量自定义组件，调 server action `searchOutletsByName(query)` 做联想。

- [ ] **Step 2：updateSource action 加 3 字段支持**

确保 server action 接受 outletId / defaultOutletTier / defaultOutletRegion 字段。

- [ ] **Step 3：新建源向导同样加 3 字段**

- [ ] **Step 4：tsc + 浏览器手动**

走一遍：
- `/data-collection/sources/<某个源>` 改 outlet 配置 + 保存
- `/data-collection/sources/new` 走向导，最后一步设 outlet 配置 + 提交

---

### Task 5.4：Phase 5 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/lib/dal/collection.ts \
        src/app/\(dashboard\)/data-collection/content/ \
        src/app/\(dashboard\)/data-collection/sources/ && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a1): 内容浏览页加媒体分级/区域筛选 + 媒体列 + 源配置加 outlet 绑定

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6：Drawer 修正 + Inngest + 验收（Day 7，约 1 天）

### Task 6.1：item-detail-drawer 加修正 outlet

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/data-collection/content/item-detail-drawer.tsx`

- [ ] **Step 1：加"识别信息"区块 + 修正按钮**

drawer 内容下方插入一个 section，显示当前 outletName / outletTier / outletRegion。点"修正 outlet"打开一个嵌入 dialog（用 `OutletSearchSelect` 选新 outlet，调 `correctItemOutlet`）。

- [ ] **Step 2：浏览器手动**

打开任一采集项 drawer → 修正 outlet → 验证更新成功 + toast 提示。

---

### Task 6.2：Inngest outlet-batch-recognize

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/functions/collection/outlet-batch-recognize.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/inngest/index.ts`

- [ ] **Step 1：写 Inngest 函数**

```ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { isNull, and, eq } from "drizzle-orm";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { recognizeOutlet } from "@/lib/collection/outlet-recognizer";

export const outletBatchRecognize = inngest.createFunction(
  { id: "collection-outlet-batch-recognize", concurrency: { limit: 1 } },
  { event: "collection/outlet-batch-recognize.requested" },
  async ({ event, step }) => {
    const { organizationId } = event.data;
    const dict = await step.run("load-dict", () =>
      listOutletsByOrg(organizationId, { includeInactive: false })
    );

    let processed = 0;
    while (true) {
      const batch = await step.run(`load-batch-${processed}`, async () => {
        return await db.select().from(collectedItems)
          .where(and(eq(collectedItems.organizationId, organizationId), isNull(collectedItems.outletId)))
          .limit(500);
      });
      if (batch.length === 0) break;

      await step.run(`update-batch-${processed}`, async () => {
        for (const item of batch) {
          const recognized = recognizeOutlet(
            { canonicalUrl: item.canonicalUrl, rawMetadata: item.rawMetadata as Record<string, unknown> | null },
            { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
            dict,
          );
          if (recognized) {
            await db.update(collectedItems).set({
              outletId: recognized.outletId,
              outletTier: recognized.outletTier,
              outletRegion: recognized.outletRegion,
              updatedAt: new Date(),
            }).where(eq(collectedItems.id, item.id));
          }
        }
      });

      processed += batch.length;
      if (batch.length < 500) break;
    }
    return { processed };
  },
);
```

- [ ] **Step 2：注册到 inngest/index.ts**

把 `outletBatchRecognize` 加到现有 `functions: [...]` 数组。

- [ ] **Step 3：dev 端触发验证**

```bash
# 终端 1
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run dev
# 终端 2
npx inngest-cli@latest dev
# 浏览器 /data-collection/outlets 点 admin "批量回填" → Inngest dashboard 看 run 成功
```

---

### Task 6.3：全量浏览器人工验收（含真实 Tavily 源准备）

**前置数据准备：**

- [ ] **Step 1：创建一个 Tavily 源 + 抓一篇人民日报文章**

```
浏览器：/data-collection/sources/new
  - 选 Tavily Adapter
  - 关键词：长江生态
  - 提交
点"立即触发" → 等抓取完成
```

- [ ] **Step 2：核验抓回的采集项**

```
浏览器：/data-collection/content
  - 找抓回的人民日报文章（标题含"长江生态"，URL host 是 people.com.cn）
  - 验证：媒体列显示 "人民日报 / 央级媒体"
  - 验证：筛选"分级=央级" → 该条出现
```

**功能验收清单：**

- [ ] 字典灌入 113 条（DB count by tier）
- [ ] Tavily 抓人民日报 → outlet_tier=central
- [ ] 字典 CRUD（新增/编辑/停用）所有按钮**无边框**
- [ ] 内容浏览页"分级=央级"筛选 → 仅返央级
- [ ] drawer 单条修正 outlet → 立即生效
- [ ] Inngest 批量回填 → 历史 outlet_id=NULL 的 item 被回填

**v1 outlet 系统清理验收（Path C 专属）：**

- [ ] `psql "$DATABASE_URL" -c "\\d research_media_outlets"` → relation does not exist
- [ ] `psql "$DATABASE_URL" -c "SELECT typname FROM pg_type WHERE typname='media_tier';"` → 0 rows
- [ ] `grep -rln "researchMediaOutlets\|outletMatcher\|outlet-matcher\|research/media-outlets" src/` → 0 hits
- [ ] tsc --noEmit 零错
- [ ] npm run build 通过

**性能验收：**

- [ ] outlet_recognizer 命中字典缓存时单次 ≤ 5ms（手工加 console.time）
- [ ] 内容浏览页 outlet_tier 筛选查询 ≤ 500ms（10 万级数据时）

---

### Task 6.4：tsc + lint + build + 最终 commit

- [ ] **Step 1：tsc**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

- [ ] **Step 2：lint**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run lint
```

- [ ] **Step 3：build**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run build
```

- [ ] **Step 4：A1 测试子集全过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run \
  src/lib/collection/__tests__/ \
  src/lib/dal/__tests__/media-outlet-dictionary.test.ts
```

- [ ] **Step 5：Phase 6 + A1 完工 commit**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add src/inngest/ \
        src/app/\(dashboard\)/data-collection/content/item-detail-drawer.tsx && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a1): drawer 单条修正 outlet + Inngest 批量回填 — A1 Wave 1 第一块完工

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 验收 Checklist 总表（A1 整体交付，对照 sub-spec §10）

### Path C 清理

- [ ] research_media_outlets / aliases / crawl_configs 三表已 DROP
- [ ] mediaTierEnum / mediaOutletStatusEnum 已 DROP
- [ ] outlet-matcher.ts / 167 行 demo seed / 旧 DAL/actions/旧管理页已删
- [ ] grep 旧引用 0 hits

### 功能

- [ ] 字典灌入 113 条（央 12 / 行业 12 / 省市 8 / 区县 40 / 政务 41）
- [ ] Tavily 抓人民日报 → outlet_tier=central
- [ ] 字典 CRUD 全功能 + 所有按钮无边框 + sonner toast
- [ ] content 页分级/区域筛选 + 媒体列
- [ ] drawer 单条修正
- [ ] Inngest 批量回填

### 数据正确性

- [ ] 字典 unique 约束生效
- [ ] 跨 org 字典隔离
- [ ] tsc 零错 / build 通过 / lint 通过
- [ ] A1 新增/修改单测全过

### 性能

- [ ] recognizer 单次 ≤ 5ms（缓存命中）
- [ ] 批量 recognize 1 万条 ≤ 10 分钟
- [ ] content 页 outlet_tier 筛选 ≤ 500ms

---

## 备注

- 所有 commit 用 `--no-verify`（用户已授权本任务全程）
- 所有测试在 plan 内 step 单独跑，不依赖 pre-commit hook
- 文件路径全部用绝对路径
- 不开 feature branch，直接 commit 到 main
- 全栈用 sonner toast 替代 alert / confirm；删除/确认走 AlertDialog
- 区县融媒域名 + 41 个生态环境局公众号名调研工作 = Phase 0 Task 0.1 上午半天集中做
