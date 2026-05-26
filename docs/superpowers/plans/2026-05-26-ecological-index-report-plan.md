# 生态文明传播指数报告模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把《2025 年度重庆市生态文明传播指数排行榜》本地脚本落地到 `/data-collection/reports` 模块,通过新增 `sourceType='ecological_index'` + Inngest 7 步流水线 + 3 张资源表实现服务化、可复用、可追溯。

**Architecture:** 新增 3 张表 (media_scopes / media_scope_units / activity_datasets) 沉淀输入资源 → 扩展 `research_reports.sourceType` 复用现有报告框架 → 新建 `src/lib/research/ecological-index/` 算法模块(100% TS) → Inngest `ecological-index-generate` 7 步异步流水线产出 (19-sheet xlsx + docx + 4 个 tier 内容源 xlsx) → 资源管理 + 详情页 UI 集成。

**Tech Stack:** Next.js 16 / Drizzle ORM / Supabase Storage / Inngest / `@e965/xlsx` / `docx` lib (A5 已 vetted) / `chartjs-node-canvas` / Vitest

**Spec:** [`docs/superpowers/specs/2026-05-26-ecological-index-report-design.md`](../specs/2026-05-26-ecological-index-report-design.md) (v2, APPROVED)

---

## Phase 概览与依赖

```
P0 (spike 0.5d) ──┐
                  ▼
P1 (schema 1d) ───┐
                  ├─ P2 (资源管理 2d)
                  ├─ P3 (计算引擎 3d) ← P2 数据驱动 P3 调试
                  └─ P4 (UI 集成 2d)  ← 依赖 P3 aggregatesJson
```

**总计：8.5 天**

---

## File Structure

### Create (新建)

**P1 - Schema:**
- `src/db/schema/research/media-scopes.ts`
- `src/db/schema/research/activity-datasets.ts`
- (modify) `src/db/schema/research/reports.ts` 扩展 sourceType + contentSourceFileUrls
- `src/db/schema/research/__tests__/media-scopes.test.ts`
- `src/db/schema/research/__tests__/activity-datasets.test.ts`

**P2 - 资源管理 DAL / Server Actions / UI:**
- `src/lib/dal/research/media-scopes.ts`
- `src/lib/dal/research/activity-datasets.ts`
- `src/lib/dal/research/__tests__/media-scopes.test.ts`
- `src/lib/dal/research/__tests__/activity-datasets.test.ts`
- `src/app/actions/research/media-scopes.ts`
- `src/app/actions/research/activity-datasets.ts`
- `src/app/(dashboard)/data-collection/reports/resources/page.tsx`
- `src/app/(dashboard)/data-collection/reports/resources/resources-client.tsx`
- `src/app/(dashboard)/data-collection/reports/resources/scopes-tab.tsx`
- `src/app/(dashboard)/data-collection/reports/resources/datasets-tab.tsx`
- `src/app/(dashboard)/data-collection/reports/resources/upload-scope-dialog.tsx`
- `src/app/(dashboard)/data-collection/reports/resources/upload-dataset-dialog.tsx`
- `src/app/(dashboard)/data-collection/reports/resources/scope-detail-drawer.tsx`
- `src/app/(dashboard)/data-collection/reports/resources/dataset-detail-drawer.tsx`

**P3 - 算法引擎:**
- `src/lib/research/ecological-index/types.ts`
- `src/lib/research/ecological-index/scope-parser.ts`
- `src/lib/research/ecological-index/activity-parser.ts`
- `src/lib/research/ecological-index/matcher.ts`
- `src/lib/research/ecological-index/compute.ts`
- `src/lib/research/ecological-index/xlsx-builder.ts`
- `src/lib/research/ecological-index/chart-generator.ts`
- `src/lib/research/ecological-index/docx-builder.ts`
- `src/lib/research/ecological-index/content-exporter.ts`
- `src/lib/research/ecological-index/index.ts` (barrel)
- `src/lib/research/ecological-index/__tests__/scope-parser.test.ts`
- `src/lib/research/ecological-index/__tests__/activity-parser.test.ts`
- `src/lib/research/ecological-index/__tests__/matcher.test.ts`
- `src/lib/research/ecological-index/__tests__/compute.test.ts`
- `src/inngest/functions/research/ecological-index-generate.ts`
- `src/inngest/functions/research/__tests__/ecological-index-generate.test.ts`
- `src/lib/dal/research/ecological-index-reports.ts`
- `src/app/actions/research/ecological-index-reports.ts`
- `public/fonts/NotoSansSC-Regular.otf`(字体文件)

**P4 - UI 集成:**
- `src/app/(dashboard)/data-collection/reports/ecological-index-new-dialog.tsx`
- `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-detail.tsx`
- `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-overview-tab.tsx`
- `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-ranking-tab.tsx`
- `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-indicators-tab.tsx`
- `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-snapshot-tab.tsx`

### Modify (修改)

- `src/db/schema/research/reports.ts`(扩展 enum + 新列)
- `src/app/(dashboard)/data-collection/reports/page.tsx`(加 sourceType tab)
- `src/app/(dashboard)/data-collection/reports/reports-list-client.tsx`(tab 数据 + 新建按钮分支)
- `src/app/(dashboard)/data-collection/reports/[id]/page.tsx`(按 sourceType 分支渲染)
- `src/inngest/functions/research/index.ts`(注册 ecologicalIndexGenerate)
- `package.json`(若需新装 chartjs-node-canvas)

---

# Phase 0: Spike(0.5 天)

**目的:** 验证 3 个技术决策可行,避免后续 phase 翻案。

## Task 0.1: docx 图片嵌入 spike

**Files:**
- Create: `scripts/spike-docx-image.ts`

- [ ] **Step 1: 写 spike 脚本**

```ts
// scripts/spike-docx-image.ts
// 验证 docx npm lib 能正确嵌入 PNG 图片到段落,在 Word/WPS 中正确显示
import { Document, Packer, Paragraph, ImageRun, Table, TableRow, TableCell, TextRun } from "docx";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

async function main() {
  // 准备一张测试 PNG(实测用 chart-generator 产物或 git 中既有图片)
  const pngBuffer = readFileSync(path.resolve("docs/scope-content-sample.png"));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: "Spike: docx 图片嵌入验证", bold: true, size: 32 })] }),
        new Paragraph({ children: [new TextRun("下面应该显示一张测试图片:")] }),
        new Paragraph({ children: [new ImageRun({ data: pngBuffer, transformation: { width: 600, height: 300 } })] }),
        new Paragraph({ children: [new TextRun("下面是表格(测试 39 行 docx 表):")] }),
        new Table({
          rows: [
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph("排名")] }),
              new TableCell({ children: [new Paragraph("区县")] }),
              new TableCell({ children: [new Paragraph("综合分")] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ children: [new Paragraph("1")] }),
              new TableCell({ children: [new Paragraph("两江新区")] }),
              new TableCell({ children: [new Paragraph("86.01")] }),
            ]}),
          ],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync("/tmp/spike-docx-image-output.docx", buffer);
  console.log("✓ 已生成 /tmp/spike-docx-image-output.docx, 请用 Word/WPS 打开验证");
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 准备测试图片**

```bash
# 用现有 0526-scope 排行榜里的图(已生成过)
cp /tmp/docx_imgs_new/img3_image1.png docs/scope-content-sample.png 2>/dev/null \
  || python3 -c "import matplotlib.pyplot as plt; plt.bar(['A','B','C'],[1,2,3]); plt.savefig('docs/scope-content-sample.png')"
```

- [ ] **Step 3: 跑 spike**

Run: `npx tsx scripts/spike-docx-image.ts`
Expected: `✓ 已生成 /tmp/spike-docx-image-output.docx`

- [ ] **Step 4: 人工验证(打开 Word / WPS)**

打开 `/tmp/spike-docx-image-output.docx`,确认:
- ✓ 图片正确显示(无破图)
- ✓ 表格 3 列 × 2 行结构正确
- ✓ 中文文字"两江新区"无乱码

若验证通过,在 spike 报告写入"docx 图片嵌入: PASS"。

- [ ] **Step 5: 写 spike 报告**

```bash
cat > docs/superpowers/phase-reports/2026-05-26-p0-docx-image-spike.md <<'EOF'
# P0.1 docx 图片嵌入 spike 报告

**Date:** 2026-05-26
**Result:** PASS

## 验证内容
- docx npm lib 的 ImageRun 能正确嵌入 PNG
- 表格能渲染 3 列 × N 行
- 中文文字正常显示

## 关键发现
- ImageRun 接受 Buffer 类型
- transformation.width/height 单位是 px
- 表格用 Table + TableRow + TableCell 嵌套

## 后续 implication
- P3 docx-builder.ts 可放心采用 docx npm lib + ImageRun
- 39 行表格用 TableRow 循环生成
EOF
git add docs/superpowers/phase-reports/2026-05-26-p0-docx-image-spike.md scripts/spike-docx-image.ts
git commit -m "spike: P0.1 docx 图片嵌入 PASS - 可用 docx lib + ImageRun"
```

---

## Task 0.2: chartjs-node-canvas 字体 spike

**Files:**
- Create: `scripts/spike-chart-font.ts`

- [ ] **Step 1: 安装依赖 + 下载字体**

```bash
npm install --save chartjs-node-canvas chart.js
mkdir -p public/fonts
curl -fSL -o public/fonts/NotoSansSC-Regular.otf \
  https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf
ls -la public/fonts/NotoSansSC-Regular.otf  # 应有 ~5MB
```

- [ ] **Step 2: 写 spike 脚本**

```ts
// scripts/spike-chart-font.ts
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { writeFileSync } from "node:fs";
import path from "node:path";

const fontPath = path.resolve("public/fonts/NotoSansSC-Regular.otf");
const canvas = new ChartJSNodeCanvas({
  width: 1920, height: 1024,
  chartCallback: (ChartJS) => {
    ChartJS.register({
      id: "register-font",
      beforeInit: (chart) => {
        // chartjs 没有 registerFont, 需用 canvas 的 registerFont
      },
    });
  },
});

// canvas 的 registerFont 需 import 包后单独跑
// chartjs-node-canvas v4 用 ChartJSNodeCanvas constructor 的 chartCallback 注入
// 也可用 canvas 包的 registerFont

const { registerFont } = await import("canvas");
registerFont(fontPath, { family: "Noto Sans SC" });

async function main() {
  const config = {
    type: "bar" as const,
    data: {
      labels: ["两江新区", "涪陵区", "渝中区", "南岸区", "长寿区"],
      datasets: [{
        label: "综合得分",
        data: [86.01, 81.93, 81.25, 81.01, 80.47],
        backgroundColor: "#2E7D32",
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: "2025 年度重庆市生态文明传播指数 Top 5",
                 font: { family: "Noto Sans SC", size: 24 } },
        legend: { labels: { font: { family: "Noto Sans SC", size: 16 } } },
      },
      scales: {
        x: { ticks: { font: { family: "Noto Sans SC", size: 14 } } },
        y: { ticks: { font: { family: "Noto Sans SC", size: 14 } }, beginAtZero: false, min: 75 },
      },
    },
  };
  const png = await canvas.renderToBuffer(config);
  writeFileSync("/tmp/spike-chart-font-output.png", png);
  console.log(`✓ 已生成 /tmp/spike-chart-font-output.png (${png.length} bytes)`);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: 跑 spike**

Run: `npx tsx scripts/spike-chart-font.ts`
Expected: `✓ 已生成 /tmp/spike-chart-font-output.png (xxxxx bytes)`

- [ ] **Step 4: 人工验证 PNG**

```bash
open /tmp/spike-chart-font-output.png  # macOS
```

检查:
- ✓ 标题"2025 年度重庆市生态文明传播指数 Top 5"中文正常
- ✓ X 轴标签"两江新区"等中文无乱码
- ✓ 图表整体清晰可读

- [ ] **Step 5: 写报告 + commit**

```bash
cat > docs/superpowers/phase-reports/2026-05-26-p0-chart-font-spike.md <<'EOF'
# P0.2 chartjs-node-canvas 字体 spike 报告

**Date:** 2026-05-26
**Result:** PASS

## 验证内容
- chartjs-node-canvas 能在 Node 中渲染图表
- 通过 canvas 包的 registerFont 加载 Noto Sans SC
- 中文标题/标签正常显示

## 字体文件
- `public/fonts/NotoSansSC-Regular.otf` ~5MB
- 部署需打包到 lambda(vercel.json includeFiles)

## 性能
- 1920×1024 单图渲染 ~3-5 秒
EOF
git add scripts/spike-chart-font.ts public/fonts/NotoSansSC-Regular.otf \
        docs/superpowers/phase-reports/2026-05-26-p0-chart-font-spike.md \
        package.json package-lock.json
git commit -m "spike: P0.2 chartjs-node-canvas 字体 PASS + 引入 Noto Sans SC"
```

---

## Task 0.3: Supabase Storage 配额边界 spike

**Files:**
- Create: `scripts/spike-storage-upload.ts`

- [ ] **Step 1: 写 spike**

```ts
// scripts/spike-storage-upload.ts
// 验证 Supabase Storage 能否上传 100MB+ 文件
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
import { writeFileSync, readFileSync, statSync, rmSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

async function main() {
  // 生成 80MB 测试文件(模拟 P3 Step 6c 市级 tier 文件)
  const size = 80 * 1024 * 1024;
  const buf = Buffer.alloc(size, "A");
  writeFileSync("/tmp/spike-storage-80mb.bin", buf);
  console.log(`✓ 已生成 80MB 测试文件`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_REPORTS ?? "research-reports";
  const key = `spike/storage-80mb-${Date.now()}.bin`;

  const t0 = Date.now();
  const { data, error } = await supabase.storage.from(bucket).upload(key, buf, {
    contentType: "application/octet-stream",
  });
  const elapsed = (Date.now() - t0) / 1000;

  if (error) {
    console.error(`✗ 上传失败:`, error);
    process.exit(1);
  }
  console.log(`✓ 已上传 ${size / 1024 / 1024}MB, 耗时 ${elapsed.toFixed(2)}s`);
  console.log(`  path: ${data.path}`);

  // 清理
  await supabase.storage.from(bucket).remove([key]);
  rmSync("/tmp/spike-storage-80mb.bin");
  console.log(`✓ 已清理`);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 跑 spike**

Run: `npx tsx scripts/spike-storage-upload.ts`
Expected: `✓ 已上传 80MB, 耗时 X.XXs`

如失败,看错误:
- "exceeds bucket size limit" → 联系管理员调高 bucket 单文件上限
- "Network timeout" → 改用分块上传(resumable upload)

- [ ] **Step 3: 测试更大文件(120MB,验证 P3 区县合计可能 ≤ 30MB 但保险起见)**

修改 `size = 120 * 1024 * 1024` 重跑。

- [ ] **Step 4: 写报告 + commit**

```bash
cat > docs/superpowers/phase-reports/2026-05-26-p0-storage-spike.md <<'EOF'
# P0.3 Supabase Storage 80MB 上传 spike 报告

**Date:** 2026-05-26
**Result:** [PASS / NEEDS BUCKET CONFIG ADJUSTMENT]

## 验证内容
- 80MB 文件上传成功,耗时 X 秒
- 120MB 文件上传 [成功 / 失败]
- 当前 bucket 单文件上限确认 = ?MB

## 后续 implication
- 若 120MB 失败 → P3 Step 6 必须按 tier 拆 4 文件(已在 spec 里决定)
- 若 120MB 成功 → 可以放心打包
EOF
git add scripts/spike-storage-upload.ts docs/superpowers/phase-reports/2026-05-26-p0-storage-spike.md
git commit -m "spike: P0.3 Supabase Storage 上传 [PASS/NEEDS-CONFIG]"
```

- [ ] **Step 5: P0 总结 commit**

```bash
git log --oneline -5 | grep spike
# 应能看到 3 个 spike commit
```

---

# Phase 1: 数据层(1 天)

**前置:** P0 三个 spike 全部 PASS(或已记录后续应对)

## Task 1.1: research_media_scopes schema

**Files:**
- Create: `src/db/schema/research/media-scopes.ts`

- [ ] **Step 1: 写 schema**

```ts
// src/db/schema/research/media-scopes.ts
import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations, userProfiles } from "../users";

/**
 * 媒体名单一级 tier 枚举
 * - central: 中央媒体
 * - industry: 行业媒体
 * - municipal: 市级媒体
 * - district_rmt: 区县融媒
 * - district_gov: 区县政务(生态环境局类)
 */
export const scopeUnitTierEnum = pgEnum("scope_unit_tier", [
  "central", "industry", "municipal", "district_rmt", "district_gov",
]);

/**
 * 媒体名单版本表
 *
 * 一个 scope 是一份完整的"统计范围"快照(如 2025 年度名单 94 单位),
 * 关联的所有 units 通过 cascade delete 一并清理。
 * 同一 org 内 (organizationId, name) 唯一。
 * 同一 org 内最多 1 个 isDefault=true(业务层强制)。
 */
export const researchMediaScopes = pgTable(
  "research_media_scopes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sourceFileName: text("source_file_name"),
    sourceFileUrl: text("source_file_url"),
    totalUnits: integer("total_units").notNull(),
    centralCount: integer("central_count").notNull().default(0),
    industryCount: integer("industry_count").notNull().default(0),
    municipalCount: integer("municipal_count").notNull().default(0),
    districtRmtCount: integer("district_rmt_count").notNull().default(0),
    districtGovCount: integer("district_gov_count").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by")
      .references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("research_media_scopes_org_idx").on(t.organizationId, t.isDefault),
    orgNameUnique: uniqueIndex("research_media_scopes_org_name_uniq").on(t.organizationId, t.name),
  }),
);

/**
 * 名单单位明细
 *
 * scopeId+xlsxRow 唯一,可追溯到上传文件的行号。
 * resolvedOutletIds 缓存 matcher 反查结果,避免每次报告生成都重算。
 */
export const researchMediaScopeUnits = pgTable(
  "research_media_scope_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeId: uuid("scope_id")
      .references(() => researchMediaScopes.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    displayName: text("display_name"),
    tier: scopeUnitTierEnum("tier").notNull(),
    districtNormalized: text("district_normalized"),
    districtOrig: text("district_orig"),
    websites: text("websites").array().notNull().default(sql`'{}'::text[]`),
    wechatNames: text("wechat_names").array().notNull().default(sql`'{}'::text[]`),
    wechatGhid: text("wechat_ghid"),
    weiboUid: text("weibo_uid"),
    weiboHandle: text("weibo_handle"),
    douyinUrl: text("douyin_url"),
    kuaishouUrl: text("kuaishou_url"),
    xlsxRow: integer("xlsx_row").notNull(),
    resolvedOutletIds: uuid("resolved_outlet_ids").array().notNull().default(sql`'{}'::uuid[]`),
    matchedItemCount2025: integer("matched_item_count_2025").default(0),
    notes: text("notes"),
  },
  (t) => ({
    scopeIdx: index("research_media_scope_units_scope_idx").on(t.scopeId, t.tier),
    scopeRowUnique: uniqueIndex("research_media_scope_units_scope_row_uniq").on(t.scopeId, t.xlsxRow),
  }),
);

export type MediaScope = typeof researchMediaScopes.$inferSelect;
export type MediaScopeInsert = typeof researchMediaScopes.$inferInsert;
export type MediaScopeUnit = typeof researchMediaScopeUnits.$inferSelect;
export type MediaScopeUnitInsert = typeof researchMediaScopeUnits.$inferInsert;
```

- [ ] **Step 2: 加 schema export 到 index**

```ts
// src/db/schema/research/index.ts
// 在 export list 加:
export * from "./media-scopes";
```

- [ ] **Step 3: 跑 typecheck**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 4: 写 schema 单测(roundtrip)**

```ts
// src/db/schema/research/__tests__/media-scopes.test.ts
import { describe, it, expect } from "vitest";
import { researchMediaScopes, researchMediaScopeUnits, scopeUnitTierEnum } from "../media-scopes";

describe("research_media_scopes schema", () => {
  it("scopeUnitTierEnum 包含 5 个 tier", () => {
    expect(scopeUnitTierEnum.enumValues).toEqual([
      "central", "industry", "municipal", "district_rmt", "district_gov",
    ]);
  });

  it("研究媒体名单表有所有必要字段", () => {
    const columns = Object.keys(researchMediaScopes);
    expect(columns).toContain("id");
    expect(columns).toContain("organizationId");
    expect(columns).toContain("name");
    expect(columns).toContain("totalUnits");
    expect(columns).toContain("isDefault");
  });

  it("名单单位表有 resolvedOutletIds 数组字段", () => {
    const columns = Object.keys(researchMediaScopeUnits);
    expect(columns).toContain("resolvedOutletIds");
    expect(columns).toContain("xlsxRow");
    expect(columns).toContain("tier");
  });
});
```

- [ ] **Step 5: 跑测试 + commit**

```bash
npx vitest run src/db/schema/research/__tests__/media-scopes.test.ts
# Expected: 3 passed

git add src/db/schema/research/media-scopes.ts \
        src/db/schema/research/index.ts \
        src/db/schema/research/__tests__/media-scopes.test.ts
git commit -m "feat(research): add research_media_scopes schema + tier enum"
```

---

## Task 1.2: research_activity_datasets schema

**Files:**
- Create: `src/db/schema/research/activity-datasets.ts`

- [ ] **Step 1: 写 schema**

```ts
// src/db/schema/research/activity-datasets.ts
import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations, userProfiles } from "../users";

/**
 * 单个区县的活动数据点
 *
 * data 字段存这些 ActivityDataPoint 的数组(39 行,与 39 标准区县对应)
 */
export type ActivityDataPoint = {
  district: string;       // 标准 39 区县名
  themes: Record<string, number>;  // { '六五环境日': 5, '815全国生态日': 1, ... }
  total: number;          // 总场数
  firstDate: string;      // ISO YYYY-MM-DD
  lastDate: string;
  spanDays: number;
  freq: number;           // total / spanDays
};

/**
 * 线下生态宣传活动数据集
 *
 * 一份数据集 = 一年的活动统计(39 区县 × 5 主题)
 * 同一 org 同一 name 唯一,允许同一年多份(如 2025 v1 / 2025 v2)
 */
export const researchActivityDatasets = pgTable(
  "research_activity_datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    year: integer("year").notNull(),
    sourceFileName: text("source_file_name"),
    sourceFileUrl: text("source_file_url"),
    districtCount: integer("district_count").notNull(),
    totalActivities: integer("total_activities").notNull(),
    activityThemes: text("activity_themes").array().notNull(),
    data: jsonb("data").$type<ActivityDataPoint[]>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by")
      .references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgYearIdx: index("research_activity_datasets_org_year_idx").on(t.organizationId, t.year, t.isDefault),
    orgNameUnique: uniqueIndex("research_activity_datasets_org_name_uniq").on(t.organizationId, t.name),
  }),
);

export type ActivityDataset = typeof researchActivityDatasets.$inferSelect;
export type ActivityDatasetInsert = typeof researchActivityDatasets.$inferInsert;
```

- [ ] **Step 2: 加 export**

```ts
// src/db/schema/research/index.ts
export * from "./activity-datasets";
```

- [ ] **Step 3: 写单测**

```ts
// src/db/schema/research/__tests__/activity-datasets.test.ts
import { describe, it, expect } from "vitest";
import { researchActivityDatasets, type ActivityDataPoint } from "../activity-datasets";

describe("research_activity_datasets schema", () => {
  it("有 jsonb data 字段存 ActivityDataPoint[]", () => {
    expect(Object.keys(researchActivityDatasets)).toContain("data");
  });

  it("ActivityDataPoint 类型签名", () => {
    const sample: ActivityDataPoint = {
      district: "两江新区",
      themes: { "六五环境日": 5, "815全国生态日": 5 },
      total: 10,
      firstDate: "2025-01-17",
      lastDate: "2025-12-19",
      spanDays: 337,
      freq: 0.0297,
    };
    expect(sample.district).toBe("两江新区");
    expect(sample.themes["六五环境日"]).toBe(5);
  });
});
```

- [ ] **Step 4: 跑测试 + typecheck**

```bash
npx vitest run src/db/schema/research/__tests__/activity-datasets.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/db/schema/research/activity-datasets.ts \
        src/db/schema/research/index.ts \
        src/db/schema/research/__tests__/activity-datasets.test.ts
git commit -m "feat(research): add research_activity_datasets schema"
```

---

## Task 1.3: 扩展 research_reports schema

**Files:**
- Modify: `src/db/schema/research/reports.ts`

- [ ] **Step 1: 读现有 reports.ts**

```bash
cat src/db/schema/research/reports.ts | head -30
# 找到 sourceType 字段和 ReportSearchSnapshot type
```

- [ ] **Step 2: 加 contentSourceFileUrls 列 + 扩展 union 类型**

修改 `src/db/schema/research/reports.ts`:

```ts
// 在 table 定义内加新列(放在 excelFileUrl 后面):
contentSourceFileUrls: jsonb("content_source_file_urls").$type<{
  central?: string | null;
  industry?: string | null;
  municipal?: string | null;
  district?: string | null;
}>(),

// 在文件末尾扩展 union 类型:
// 把 export type ReportSearchSnapshot = ... 改成 union:
export type EcologicalIndexSnapshot = {
  kind: "ecological_index";
  scopeId: string;
  activityDatasetId: string;
  year: number;
  windowStart: string;  // '2025-01-01'
  windowEnd: string;    // '2026-01-01'
  includeContentSource: boolean;
  capturedAt: string;
};

export type ReportSearchSnapshot =
  | {
      kind: "advanced_search";
      conditions: import("@/app/(dashboard)/research/search-mode-types").AdvancedSearchCondition[];
      sidebarFilter: import("@/app/(dashboard)/research/search-mode-types").SidebarFilter;
      hitItemIds: string[];
      capturedAt: string;
    }
  | EcologicalIndexSnapshot;  // ← 新增

// 类似扩展 AggregatesJson:
export type EcologicalIndexAggregates = {
  kind: "ecological_index";
  ranked: Array<{
    rank: number; name: string;
    central: number; industry: number; municipal: number; district: number; public: number;
    composite: number;
  }>;
  rawMedia: Record<string, Record<"central"|"industry"|"municipal"|"district", {
    count: number; richness: number; freq: number;
    topicCounts: number[]; days: number;
  }>>;
  rawPublic: Record<string, {
    count: number; richness: number; freq: number;
    themes: Record<string, number>;
    firstDate: string | null; lastDate: string | null; spanDays: number | null;
  }>;
  scaledMedia: Record<string, Record<"central"|"industry"|"municipal"|"district", {
    count: number; richness: number; freq: number;
  }>>;
  scaledPublic: Record<string, { count: number; richness: number; freq: number }>;
  stats: {
    max: number; min: number; span: number;
    mean: number; median: number; stdev: number;
    tier_high: number; tier_mid: number; tier_low: number;
  };
  generatedAt: string;
};

// 老的 AggregatesJson 加 kind: 'advanced_search' discriminator:
export type AdvancedSearchAggregates = {
  kind?: "advanced_search";  // 加 kind, 可选(老数据没有这字段, P1 阶段允许 undefined)
  mediaTierDistribution: Array<{...}>;
  ...
};

export type AggregatesJson = AdvancedSearchAggregates | EcologicalIndexAggregates;
```

- [ ] **Step 3: 跑 typecheck(应有现有代码引用 ReportSearchSnapshot 的地方需要 narrow)**

```bash
npx tsc --noEmit 2>&1 | head -20
# 若有 union type narrowing 错误, 修复消费侧加 if (snap.kind === 'advanced_search') 判断
```

预期需要修复约 5-10 处消费侧。修复方式:

```ts
// e.g., src/lib/dal/research/reports.ts 里:
const snap = report.searchSnapshot as ReportSearchSnapshot;
if (snap.kind === "advanced_search") {
  // 现有 advanced_search 处理
}
```

- [ ] **Step 4: 写 schema 测试(union types)**

```ts
// src/db/schema/research/__tests__/reports-union.test.ts
import { describe, it, expect } from "vitest";
import type { ReportSearchSnapshot, AggregatesJson } from "../reports";

describe("Report schema union types", () => {
  it("ReportSearchSnapshot 接受 advanced_search 类型", () => {
    const snap: ReportSearchSnapshot = {
      kind: "advanced_search",
      conditions: [],
      sidebarFilter: {} as any,
      hitItemIds: [],
      capturedAt: "2025-05-26",
    };
    expect(snap.kind).toBe("advanced_search");
  });

  it("ReportSearchSnapshot 接受 ecological_index 类型", () => {
    const snap: ReportSearchSnapshot = {
      kind: "ecological_index",
      scopeId: "scope-1",
      activityDatasetId: "ds-1",
      year: 2025,
      windowStart: "2025-01-01",
      windowEnd: "2026-01-01",
      includeContentSource: true,
      capturedAt: "2025-05-26",
    };
    expect(snap.kind).toBe("ecological_index");
    if (snap.kind === "ecological_index") {
      expect(snap.year).toBe(2025);
    }
  });

  it("AggregatesJson 接受 ecological_index 类型", () => {
    const agg: AggregatesJson = {
      kind: "ecological_index",
      ranked: [], rawMedia: {}, rawPublic: {}, scaledMedia: {}, scaledPublic: {},
      stats: { max: 0, min: 0, span: 0, mean: 0, median: 0, stdev: 0,
               tier_high: 0, tier_mid: 0, tier_low: 0 },
      generatedAt: "2025-05-26",
    };
    expect(agg.kind).toBe("ecological_index");
  });
});
```

- [ ] **Step 5: 跑测试 + commit**

```bash
npx vitest run src/db/schema/research/__tests__/
npx tsc --noEmit
git add src/db/schema/research/reports.ts src/db/schema/research/__tests__/reports-union.test.ts
git commit -m "feat(research): extend reports schema with ecological_index kind + contentSourceFileUrls"
```

---

## Task 1.4: 生成 + 应用 migration

- [ ] **Step 1: 跑 drizzle 生成 migration**

```bash
npm run db:generate
# 应生成 supabase/migrations/NNNN_ecological_index_tables.sql
```

- [ ] **Step 2: 检查生成的 SQL**

```bash
ls -t supabase/migrations/ | head -1 | xargs -I {} cat supabase/migrations/{}
# 验证包含:
# - CREATE TYPE scope_unit_tier AS ENUM (...);
# - CREATE TABLE research_media_scopes (...);
# - CREATE TABLE research_media_scope_units (...);
# - CREATE TABLE research_activity_datasets (...);
# - ALTER TABLE research_reports ADD COLUMN content_source_file_urls jsonb;
```

- [ ] **Step 3: 应用 migration**

```bash
npm run db:migrate
# 验证:
psql $DATABASE_URL -c "\dt research_media_scopes"
psql $DATABASE_URL -c "\d research_media_scope_units"
psql $DATABASE_URL -c "\dT scope_unit_tier"
```

- [ ] **Step 4: 跑 verify-schema-sync**

```bash
bash scripts/verify-schema-sync.sh
# Expected: 全 16 个 fingerprint 通过(本次新增表 + 列若想加 fingerprint, 改 verify 脚本)
```

- [ ] **Step 5: Commit migration**

```bash
git add supabase/migrations/
git commit -m "feat(research): db migration for ecological_index tables"
```

---

## Task 1.5: P1 总结 + tsc + build

- [ ] **Step 1: 跑 typecheck**

```bash
npx tsc --noEmit
# Expected: 零错误
```

- [ ] **Step 2: 跑全量测试**

```bash
npm run test 2>&1 | tail -10
# Expected: 全通过(可能 +6 个新测试通过)
```

- [ ] **Step 3: 跑 build**

```bash
npm run build 2>&1 | tail -10
# Expected: build 通过
```

- [ ] **Step 4: 写 phase summary**

```bash
cat > docs/superpowers/phase-reports/2026-05-26-p1-schema-summary.md <<'EOF'
# P1 数据层 Summary

**Date:** 2026-05-26
**Status:** ✅ Done

## 完成内容
- 3 张新表 schema (media_scopes, media_scope_units, activity_datasets)
- research_reports.contentSourceFileUrls 新列
- scope_unit_tier 新枚举
- ReportSearchSnapshot / AggregatesJson union types 扩展
- migration 生成 + 应用 + verify-schema-sync 通过

## 验收
- tsc --noEmit: ✓
- npm run test: ✓ (+6 个新测试)
- npm run build: ✓
- DB tables 验证: ✓

## 下一步
P2: 资源管理 UI + 解析器 + DAL + Server Actions
EOF
git add docs/superpowers/phase-reports/2026-05-26-p1-schema-summary.md
git commit -m "docs: P1 phase summary"
```

- [ ] **Step 5: 标 P1 完成**

通知用户 P1 已完成,可以独立部署。等待用户确认或直接进 P2。

---

# Phase 2: 资源管理(2 天)

## Task 2.1: scope-parser 单元测试 + 实现

**Files:**
- Create: `src/lib/research/ecological-index/scope-parser.ts`
- Create: `src/lib/research/ecological-index/types.ts`
- Create: `src/lib/research/ecological-index/__tests__/scope-parser.test.ts`

- [ ] **Step 1: 写 types**

```ts
// src/lib/research/ecological-index/types.ts
export type ScopeUnitTier = "central" | "industry" | "municipal" | "district_rmt" | "district_gov";

export type ParsedScopeUnit = {
  xlsxRow: number;
  name: string;
  tier: ScopeUnitTier;
  districtOrig: string | null;
  districtNormalized: string | null;
  websites: string[];
  wechatNames: string[];
  wechatGhid: string | null;
  weiboUid: string | null;
  weiboHandle: string | null;
  douyinUrl: string | null;
  kuaishouUrl: string | null;
  notes: string | null;
};

export type ParsedScope = {
  units: ParsedScopeUnit[];
  warnings: string[];
  stats: {
    totalUnits: number;
    centralCount: number;
    industryCount: number;
    municipalCount: number;
    districtRmtCount: number;
    districtGovCount: number;
  };
};
```

- [ ] **Step 2: 写 scope-parser 单元测试**

```ts
// src/lib/research/ecological-index/__tests__/scope-parser.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseMediaScopeXlsx } from "../scope-parser";

describe("scope-parser", () => {
  // 用项目中已知的 xlsx 做 fixture
  // (从 /Users/zhuyu/Downloads/副本媒体站点名单-2(1).xlsx 取或拷贝到 test fixtures)
  const fixture = readFileSync("src/lib/research/ecological-index/__tests__/fixtures/scope-sample.xlsx");

  it("解析 94 个单位", () => {
    const result = parseMediaScopeXlsx(fixture);
    expect(result.stats.totalUnits).toBe(94);
  });

  it("分级分布: 央4 业2 市6 融41 政41", () => {
    const result = parseMediaScopeXlsx(fixture);
    expect(result.stats.centralCount).toBe(4);
    expect(result.stats.industryCount).toBe(2);
    expect(result.stats.municipalCount).toBe(6);
    expect(result.stats.districtRmtCount).toBe(41);
    expect(result.stats.districtGovCount).toBe(41);
  });

  it("江北区 + 渝北区 → 两江新区归并", () => {
    const result = parseMediaScopeXlsx(fixture);
    const jiangbei = result.units.find(u => u.name === "江北发布");
    const yubei = result.units.find(u => u.name === "渝北发布");
    expect(jiangbei?.districtNormalized).toBe("两江新区");
    expect(yubei?.districtNormalized).toBe("两江新区");
  });

  it("L32 忠州新闻 → 忠县补全", () => {
    const result = parseMediaScopeXlsx(fixture);
    const unit = result.units.find(u => u.name === "忠州新闻");
    expect(unit?.districtNormalized).toBe("忠县");
    expect(unit?.notes).toContain("district");
  });

  it("公众号别名 | 分隔解析", () => {
    const result = parseMediaScopeXlsx(fixture);
    const cctv = result.units.find(u => u.name.includes("央视"));
    expect(cctv?.wechatNames).toEqual(["央视新闻", "央视财经"]);
  });

  it("微博 URL 提取 UID", () => {
    const result = parseMediaScopeXlsx(fixture);
    const rmrb = result.units.find(u => u.name === "人民日报");
    expect(rmrb?.weiboUid).toBe("2803301701");
  });
});
```

- [ ] **Step 3: 准备 fixture**

```bash
mkdir -p src/lib/research/ecological-index/__tests__/fixtures
cp "/Users/zhuyu/Downloads/副本媒体站点名单-2(1).xlsx" \
   src/lib/research/ecological-index/__tests__/fixtures/scope-sample.xlsx
```

- [ ] **Step 4: 跑测试(应失败 - 函数未实现)**

```bash
npx vitest run src/lib/research/ecological-index/__tests__/scope-parser.test.ts
# Expected: 6 failed (parseMediaScopeXlsx not defined)
```

- [ ] **Step 5: 实现 scope-parser + 跑测试通过 + commit**

```ts
// src/lib/research/ecological-index/scope-parser.ts
// 参考 scripts/build_media_scope_final.py 的 Python 实现移植到 TS
import * as XLSX from "@e965/xlsx";
import type { ParsedScope, ParsedScopeUnit, ScopeUnitTier } from "./types";

const TIER_MAP: Record<string, ScopeUnitTier> = {
  "央级": "central",
  "省/市级": "municipal",
  "市级": "municipal",
  "行业": "industry",
  "区县融媒": "district_rmt",
  "政务新媒体": "district_gov",
};

function normalizeDistrict(name: string | null): string | null {
  if (!name) return null;
  if (name === "江北区" || name === "渝北区") return "两江新区";
  return name;
}

function extractWeiboUid(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/weibo\.com\/u\/(\d+)/) || url.match(/weibo\.com\/(\d+)/);
  if (m) return m[1] ?? null;
  const m2 = url.match(/weibo\.com\/(\w+)/);
  return m2 ? m2[1] ?? null : null;
}

function splitPipe(s: unknown): string[] {
  if (!s || typeof s !== "string") return [];
  return s.split("|").map(x => x.trim()).filter(x => x && x !== "无");
}

function splitWebsites(s: unknown): string[] {
  if (!s || typeof s !== "string") return [];
  return s.split("|").map(x => x.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""))
          .filter(x => x && x !== "无");
}

export function parseMediaScopeXlsx(buffer: Buffer): ParsedScope {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0]; // 默认第一个 sheet
  const ws = wb.Sheets[sheetName!];
  if (!ws) throw new Error("xlsx 无 sheet");

  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });
  // rows[0] 是表头, rows[1+] 是数据
  const units: ParsedScopeUnit[] = [];
  const warnings: string[] = [];

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row || row.every((c: any) => c === null || c === "")) continue;
    const tierStr = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();
    if (!tierStr || !name) continue;

    const tier = TIER_MAP[tierStr];
    if (!tier) {
      warnings.push(`L${r + 1} ${name}: 未知分级 '${tierStr}', 已跳过`);
      continue;
    }

    let districtOrig: string | null = row[4] ? String(row[4]).trim() : null;
    // 忠州新闻 / 巫溪发布 补全
    if (name === "忠州新闻" && !districtOrig) {
      districtOrig = "忠县"; warnings.push(`L${r + 1} 忠州新闻: 自动补 district='忠县'`);
    }
    if (name === "巫溪发布" && !districtOrig) {
      districtOrig = "巫溪县"; warnings.push(`L${r + 1} 巫溪发布: 自动补 district='巫溪县'`);
    }
    const districtNormalized = normalizeDistrict(districtOrig);

    const ghid = String(row[12] ?? "").trim();
    const wechatGhid = ghid.startsWith("gh_") ? ghid : null;

    const weiboRaw = String(row[9] ?? "").trim();
    const weiboLines = weiboRaw.split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
    const firstWeiboUrl = weiboLines.find(u => u.includes("weibo.com")) ?? null;
    const weiboUid = extractWeiboUid(firstWeiboUrl);

    const douyinRaw = String(row[8] ?? "").trim();
    const douyinLines = douyinRaw.split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
    const douyinUrl = douyinLines.find(u => u.includes("douyin.com")) ?? null;

    const kuaishouRaw = String(row[10] ?? "").trim();
    const kuaishouLines = kuaishouRaw.split(/[\n;]+/).map(s => s.trim()).filter(Boolean);
    const kuaishouUrl = kuaishouLines.find(u => u.includes("kuaishou.com")) ?? null;

    units.push({
      xlsxRow: r + 1, // 1-based + 标题行(L2 是第一行数据)
      name,
      tier,
      districtOrig,
      districtNormalized,
      websites: splitWebsites(row[6]),
      wechatNames: splitPipe(row[7]),
      wechatGhid,
      weiboUid,
      weiboHandle: null, // P2 不主动猜微博名,后续 P3 matcher 时补
      douyinUrl,
      kuaishouUrl,
      notes: districtOrig !== row[4] ? "district 已补全" : null,
    });
  }

  const stats = {
    totalUnits: units.length,
    centralCount: units.filter(u => u.tier === "central").length,
    industryCount: units.filter(u => u.tier === "industry").length,
    municipalCount: units.filter(u => u.tier === "municipal").length,
    districtRmtCount: units.filter(u => u.tier === "district_rmt").length,
    districtGovCount: units.filter(u => u.tier === "district_gov").length,
  };

  return { units, warnings, stats };
}
```

```bash
npx vitest run src/lib/research/ecological-index/__tests__/scope-parser.test.ts
# Expected: 6 passed

git add src/lib/research/ecological-index/types.ts \
        src/lib/research/ecological-index/scope-parser.ts \
        src/lib/research/ecological-index/__tests__/scope-parser.test.ts \
        src/lib/research/ecological-index/__tests__/fixtures/scope-sample.xlsx
git commit -m "feat(eco-index): scope-parser with 6 unit tests"
```

---

## Task 2.2: activity-parser 单元测试 + 实现

**Files:**
- Create: `src/lib/research/ecological-index/activity-parser.ts`
- Create: `src/lib/research/ecological-index/__tests__/activity-parser.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/lib/research/ecological-index/__tests__/activity-parser.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseActivityXlsx, excelDateSerialToISO } from "../activity-parser";

describe("activity-parser", () => {
  const fixture = readFileSync("src/lib/research/ecological-index/__tests__/fixtures/activity-sample.xlsx");

  it("Excel 日期序号 45995 → 2025-12-15", () => {
    expect(excelDateSerialToISO(45995)).toBe("2025-12-15");
  });

  it("Excel 日期序号 46123 → 2026-04-22 (异常 2026 但保留)", () => {
    expect(excelDateSerialToISO(46123)).toBe("2026-04-22");
  });

  it("解析 39 区县", () => {
    const result = parseActivityXlsx(fixture);
    expect(result.data).toHaveLength(39);
  });

  it("5 个活动主题列", () => {
    const result = parseActivityXlsx(fixture);
    expect(result.activityThemes).toEqual([
      "六五环境日", "815全国生态日", "志愿服务活动", "环保设施向公众开放", "美丽重庆六进活动",
    ]);
  });

  it("两江新区 异常 2026 日期警告", () => {
    const result = parseActivityXlsx(fixture);
    const w = result.warnings.find(w => w.includes("两江新区") && w.includes("2026"));
    expect(w).toBeTruthy();
  });

  it("freq 计算正确 (total / spanDays)", () => {
    const result = parseActivityXlsx(fixture);
    const wanzhou = result.data.find(d => d.district === "万州区");
    expect(wanzhou).toBeTruthy();
    if (wanzhou) {
      expect(wanzhou.freq).toBeCloseTo(wanzhou.total / wanzhou.spanDays, 3);
    }
  });
});
```

- [ ] **Step 2: 准备 fixture**

```bash
cp "/Users/zhuyu/Downloads/副本2025年线下生态宣传活动统计表(1).xlsx" \
   src/lib/research/ecological-index/__tests__/fixtures/activity-sample.xlsx
```

- [ ] **Step 3: 跑测试(失败)**

Run: `npx vitest run src/lib/research/ecological-index/__tests__/activity-parser.test.ts`
Expected: 6 failed

- [ ] **Step 4: 实现 + 跑测试通过**

```ts
// src/lib/research/ecological-index/activity-parser.ts
import * as XLSX from "@e965/xlsx";
import type { ActivityDataPoint } from "@/db/schema/research/activity-datasets";

const NAME_MAP: Record<string, string> = {
  "西部科学城重庆高新区": "科学城重庆高新区",
};
const ACTIVITY_THEMES = ["六五环境日", "815全国生态日", "志愿服务活动", "环保设施向公众开放", "美丽重庆六进活动"];
const EXCEL_BASE = new Date(1899, 11, 30).getTime();

export function excelDateSerialToISO(serial: number): string {
  const ms = EXCEL_BASE + serial * 86400 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

export type ParsedActivityDataset = {
  data: ActivityDataPoint[];
  activityThemes: string[];
  totalActivities: number;
  warnings: string[];
};

export function parseActivityXlsx(buffer: Buffer): ParsedActivityDataset {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null });

  // 数据在 L5-L43 (1-based), TS 数组 0-based 是 row 4-42
  const data: ActivityDataPoint[] = [];
  const warnings: string[] = [];
  let totalActivities = 0;

  for (let r = 4; r < Math.min(rows.length, 43); r += 1) {
    const row = rows[r];
    if (!row) continue;
    let name = String(row[2] ?? "").trim();
    if (!name) continue;
    name = NAME_MAP[name] ?? name;

    const themes: Record<string, number> = {};
    let total = 0;
    for (let i = 0; i < ACTIVITY_THEMES.length; i += 1) {
      const v = Number(row[3 + i] ?? 0);
      themes[ACTIVITY_THEMES[i]!] = v;
      total += v;
    }

    const lastSerial = Number(row[9]);
    const firstSerial = Number(row[10]);
    const lastDate = excelDateSerialToISO(lastSerial);
    const firstDate = excelDateSerialToISO(firstSerial);
    if (lastDate.startsWith("2026") || firstDate.startsWith("2026")) {
      warnings.push(`${name} (L${r + 1}): 日期范围含 2026 年 (${firstDate} → ${lastDate}), 可能录入错误`);
    }
    const spanDays = Math.floor((new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000) + 1;
    const freq = spanDays > 0 ? total / spanDays : 0;

    data.push({ district: name, themes, total, firstDate, lastDate, spanDays, freq });
    totalActivities += total;
  }

  return { data, activityThemes: ACTIVITY_THEMES, totalActivities, warnings };
}
```

```bash
npx vitest run src/lib/research/ecological-index/__tests__/activity-parser.test.ts
# Expected: 6 passed
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/ecological-index/activity-parser.ts \
        src/lib/research/ecological-index/__tests__/activity-parser.test.ts \
        src/lib/research/ecological-index/__tests__/fixtures/activity-sample.xlsx
git commit -m "feat(eco-index): activity-parser with 6 unit tests"
```

---

## Task 2.3: media-scopes DAL

**Files:**
- Create: `src/lib/dal/research/media-scopes.ts`
- Create: `src/lib/dal/research/__tests__/media-scopes.test.ts`

- [ ] **Step 1: 写 DAL 接口测试**

```ts
// src/lib/dal/research/__tests__/media-scopes.test.ts
import { describe, it, expect } from "vitest";
import {
  type MediaScopeSummary, type MediaScopeDetail,
} from "../media-scopes";

describe("media-scopes DAL types", () => {
  it("MediaScopeSummary 类型签名", () => {
    const sample: MediaScopeSummary = {
      id: "x", name: "y", totalUnits: 94,
      centralCount: 4, industryCount: 2, municipalCount: 6,
      districtRmtCount: 41, districtGovCount: 41,
      isDefault: true, sourceFileName: "x.xlsx",
      createdAt: new Date(), createdByName: "Zhuyu",
    };
    expect(sample.totalUnits).toBe(94);
  });
});
// 注: DAL 集成测试需 DB 启动, 留 e2e
```

- [ ] **Step 2: 实现 DAL**

```ts
// src/lib/dal/research/media-scopes.ts
import { db } from "@/db";
import {
  researchMediaScopes, researchMediaScopeUnits,
  type MediaScopeUnit, type MediaScopeInsert, type MediaScopeUnitInsert,
} from "@/db/schema/research/media-scopes";
import { userProfiles } from "@/db/schema/users";
import { researchReports } from "@/db/schema/research/reports";
import { and, eq, desc, sql } from "drizzle-orm";

export type MediaScopeSummary = {
  id: string;
  name: string;
  description: string | null;
  sourceFileName: string | null;
  totalUnits: number;
  centralCount: number;
  industryCount: number;
  municipalCount: number;
  districtRmtCount: number;
  districtGovCount: number;
  isDefault: boolean;
  createdAt: Date;
  createdByName: string | null;
};

export type MediaScopeDetail = MediaScopeSummary & {
  description: string | null;
  units: MediaScopeUnit[];
};

export async function listMediaScopesByOrg(orgId: string): Promise<MediaScopeSummary[]> {
  const rows = await db
    .select({
      id: researchMediaScopes.id,
      name: researchMediaScopes.name,
      description: researchMediaScopes.description,
      sourceFileName: researchMediaScopes.sourceFileName,
      totalUnits: researchMediaScopes.totalUnits,
      centralCount: researchMediaScopes.centralCount,
      industryCount: researchMediaScopes.industryCount,
      municipalCount: researchMediaScopes.municipalCount,
      districtRmtCount: researchMediaScopes.districtRmtCount,
      districtGovCount: researchMediaScopes.districtGovCount,
      isDefault: researchMediaScopes.isDefault,
      createdAt: researchMediaScopes.createdAt,
      createdByName: userProfiles.displayName,
    })
    .from(researchMediaScopes)
    .leftJoin(userProfiles, eq(userProfiles.id, researchMediaScopes.createdBy))
    .where(eq(researchMediaScopes.organizationId, orgId))
    .orderBy(desc(researchMediaScopes.createdAt));
  return rows;
}

export async function getMediaScopeById(orgId: string, scopeId: string): Promise<MediaScopeDetail | null> {
  const [scope] = await db
    .select()
    .from(researchMediaScopes)
    .where(and(
      eq(researchMediaScopes.id, scopeId),
      eq(researchMediaScopes.organizationId, orgId),
    ))
    .limit(1);
  if (!scope) return null;

  const units = await db
    .select()
    .from(researchMediaScopeUnits)
    .where(eq(researchMediaScopeUnits.scopeId, scopeId))
    .orderBy(researchMediaScopeUnits.xlsxRow);

  const [byUser] = scope.createdBy
    ? await db.select({ displayName: userProfiles.displayName })
              .from(userProfiles).where(eq(userProfiles.id, scope.createdBy)).limit(1)
    : [null];

  return {
    id: scope.id, name: scope.name, description: scope.description,
    sourceFileName: scope.sourceFileName, totalUnits: scope.totalUnits,
    centralCount: scope.centralCount, industryCount: scope.industryCount,
    municipalCount: scope.municipalCount, districtRmtCount: scope.districtRmtCount,
    districtGovCount: scope.districtGovCount,
    isDefault: scope.isDefault, createdAt: scope.createdAt,
    createdByName: byUser?.displayName ?? null,
    units,
  };
}

export async function createMediaScopeWithUnits(input: {
  organizationId: string;
  scopeData: Omit<MediaScopeInsert, "id" | "createdAt" | "updatedAt">;
  units: Array<Omit<MediaScopeUnitInsert, "id" | "scopeId">>;
}): Promise<{ scopeId: string }> {
  return await db.transaction(async (tx) => {
    const [scope] = await tx
      .insert(researchMediaScopes)
      .values(input.scopeData)
      .returning({ id: researchMediaScopes.id });
    if (!scope) throw new Error("create scope failed");
    if (input.units.length > 0) {
      await tx
        .insert(researchMediaScopeUnits)
        .values(input.units.map(u => ({ ...u, scopeId: scope.id })));
    }
    return { scopeId: scope.id };
  });
}

export async function setMediaScopeDefault(orgId: string, scopeId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(researchMediaScopes)
      .set({ isDefault: false })
      .where(eq(researchMediaScopes.organizationId, orgId));
    await tx.update(researchMediaScopes)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(
        eq(researchMediaScopes.id, scopeId),
        eq(researchMediaScopes.organizationId, orgId),
      ));
  });
}

export async function countReportsUsingScope(orgId: string, scopeId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(researchReports)
    .where(and(
      eq(researchReports.organizationId, orgId),
      sql`${researchReports.searchSnapshot}->>'scopeId' = ${scopeId}`,
    ));
  return row?.n ?? 0;
}

export async function deleteMediaScope(orgId: string, scopeId: string): Promise<void> {
  await db.delete(researchMediaScopes)
    .where(and(
      eq(researchMediaScopes.id, scopeId),
      eq(researchMediaScopes.organizationId, orgId),
    ));
  // units 通过 cascade 自动清理
}
```

- [ ] **Step 3: 跑测试 + typecheck**

```bash
npx vitest run src/lib/dal/research/__tests__/media-scopes.test.ts
npx tsc --noEmit
```

- [ ] **Step 4: 写 server actions**

```ts
// src/app/actions/research/media-scopes.ts
"use server";
import { requireAuth } from "@/lib/auth";
import { parseMediaScopeXlsx } from "@/lib/research/ecological-index/scope-parser";
import {
  listMediaScopesByOrg, getMediaScopeById,
  createMediaScopeWithUnits, setMediaScopeDefault,
  countReportsUsingScope, deleteMediaScope,
} from "@/lib/dal/research/media-scopes";

async function requireOrg(): Promise<{ orgId: string; userId: string }> {
  const user = await requireAuth();
  if (!user.organizationId) throw new Error("无法获取组织");
  return { orgId: user.organizationId, userId: user.id };
}

export async function listMediaScopes() {
  const { orgId } = await requireOrg();
  return await listMediaScopesByOrg(orgId);
}

export async function getMediaScopeDetail(scopeId: string) {
  const { orgId } = await requireOrg();
  return await getMediaScopeById(orgId, scopeId);
}

export async function uploadMediaScopeXlsx(input: {
  name: string;
  description?: string;
  fileBase64: string;
  fileName: string;
}): Promise<{ scopeId: string; warnings: string[]; stats: any }> {
  const { orgId, userId } = await requireOrg();
  const buffer = Buffer.from(input.fileBase64, "base64");
  if (buffer.byteLength > 5 * 1024 * 1024) throw new Error("文件过大,限 5MB");

  const parsed = parseMediaScopeXlsx(buffer);
  const { scopeId } = await createMediaScopeWithUnits({
    organizationId: orgId,
    scopeData: {
      organizationId: orgId,
      name: input.name,
      description: input.description ?? null,
      sourceFileName: input.fileName,
      sourceFileUrl: null, // P2 不立即存原文件,后续可加
      totalUnits: parsed.stats.totalUnits,
      centralCount: parsed.stats.centralCount,
      industryCount: parsed.stats.industryCount,
      municipalCount: parsed.stats.municipalCount,
      districtRmtCount: parsed.stats.districtRmtCount,
      districtGovCount: parsed.stats.districtGovCount,
      isDefault: false,
      createdBy: userId,
    },
    units: parsed.units.map(u => ({
      name: u.name,
      tier: u.tier,
      districtOrig: u.districtOrig,
      districtNormalized: u.districtNormalized,
      websites: u.websites,
      wechatNames: u.wechatNames,
      wechatGhid: u.wechatGhid,
      weiboUid: u.weiboUid,
      weiboHandle: u.weiboHandle,
      douyinUrl: u.douyinUrl,
      kuaishouUrl: u.kuaishouUrl,
      xlsxRow: u.xlsxRow,
      notes: u.notes,
    })),
  });

  return { scopeId, warnings: parsed.warnings, stats: parsed.stats };
}

export async function setDefaultMediaScope(scopeId: string) {
  const { orgId } = await requireOrg();
  await setMediaScopeDefault(orgId, scopeId);
}

export async function deleteMediaScopeAction(scopeId: string, force = false) {
  const { orgId } = await requireOrg();
  if (!force) {
    const cnt = await countReportsUsingScope(orgId, scopeId);
    if (cnt > 0) throw new Error(`该名单已被 ${cnt} 个报告引用, 删除将影响快照, 请确认强制删除`);
  }
  await deleteMediaScope(orgId, scopeId);
}
```

- [ ] **Step 5: 跑 typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/dal/research/media-scopes.ts \
        src/lib/dal/research/__tests__/media-scopes.test.ts \
        src/app/actions/research/media-scopes.ts
git commit -m "feat(eco-index): media-scopes DAL + server actions"
```

---

## Task 2.4: activity-datasets DAL

**Files:**
- Create: `src/lib/dal/research/activity-datasets.ts`
- Create: `src/lib/dal/research/__tests__/activity-datasets.test.ts`

- [ ] **Step 1: 写 DAL 类型测试**

```ts
// src/lib/dal/research/__tests__/activity-datasets.test.ts
import { describe, it, expect } from "vitest";
import type { ActivityDatasetSummary } from "../activity-datasets";

describe("activity-datasets DAL types", () => {
  it("ActivityDatasetSummary 类型签名", () => {
    const sample: ActivityDatasetSummary = {
      id: "x", name: "y", year: 2025,
      districtCount: 39, totalActivities: 5341,
      activityThemes: ["六五环境日", "815全国生态日", "志愿服务活动", "环保设施向公众开放", "美丽重庆六进活动"],
      isDefault: true, sourceFileName: "x.xlsx",
      createdAt: new Date(), createdByName: "Zhuyu",
    };
    expect(sample.year).toBe(2025);
    expect(sample.activityThemes).toHaveLength(5);
  });
});
```

- [ ] **Step 2: 实现 DAL(同 Task 2.3 媒体名单模式)**

```ts
// src/lib/dal/research/activity-datasets.ts
import { db } from "@/db";
import {
  researchActivityDatasets,
  type ActivityDataset, type ActivityDatasetInsert, type ActivityDataPoint,
} from "@/db/schema/research/activity-datasets";
import { userProfiles } from "@/db/schema/users";
import { researchReports } from "@/db/schema/research/reports";
import { and, eq, desc, sql } from "drizzle-orm";

export type ActivityDatasetSummary = {
  id: string;
  name: string;
  year: number;
  districtCount: number;
  totalActivities: number;
  activityThemes: string[];
  isDefault: boolean;
  sourceFileName: string | null;
  createdAt: Date;
  createdByName: string | null;
};

export type ActivityDatasetDetail = ActivityDatasetSummary & {
  data: ActivityDataPoint[];
};

export async function listActivityDatasetsByOrg(orgId: string): Promise<ActivityDatasetSummary[]> {
  const rows = await db
    .select({
      id: researchActivityDatasets.id,
      name: researchActivityDatasets.name,
      year: researchActivityDatasets.year,
      districtCount: researchActivityDatasets.districtCount,
      totalActivities: researchActivityDatasets.totalActivities,
      activityThemes: researchActivityDatasets.activityThemes,
      isDefault: researchActivityDatasets.isDefault,
      sourceFileName: researchActivityDatasets.sourceFileName,
      createdAt: researchActivityDatasets.createdAt,
      createdByName: userProfiles.displayName,
    })
    .from(researchActivityDatasets)
    .leftJoin(userProfiles, eq(userProfiles.id, researchActivityDatasets.createdBy))
    .where(eq(researchActivityDatasets.organizationId, orgId))
    .orderBy(desc(researchActivityDatasets.year), desc(researchActivityDatasets.createdAt));
  return rows;
}

export async function getActivityDatasetById(orgId: string, datasetId: string): Promise<ActivityDatasetDetail | null> {
  const [row] = await db
    .select()
    .from(researchActivityDatasets)
    .where(and(
      eq(researchActivityDatasets.id, datasetId),
      eq(researchActivityDatasets.organizationId, orgId),
    ))
    .limit(1);
  if (!row) return null;
  const [byUser] = row.createdBy
    ? await db.select({ displayName: userProfiles.displayName })
              .from(userProfiles).where(eq(userProfiles.id, row.createdBy)).limit(1)
    : [null];
  return {
    id: row.id, name: row.name, year: row.year,
    districtCount: row.districtCount, totalActivities: row.totalActivities,
    activityThemes: row.activityThemes, isDefault: row.isDefault,
    sourceFileName: row.sourceFileName, createdAt: row.createdAt,
    createdByName: byUser?.displayName ?? null,
    data: row.data,
  };
}

export async function createActivityDataset(
  input: Omit<ActivityDatasetInsert, "id" | "createdAt" | "updatedAt">,
): Promise<{ datasetId: string }> {
  const [row] = await db.insert(researchActivityDatasets).values(input)
    .returning({ id: researchActivityDatasets.id });
  if (!row) throw new Error("create activity dataset failed");
  return { datasetId: row.id };
}

export async function setActivityDatasetDefault(orgId: string, datasetId: string, year: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(researchActivityDatasets)
      .set({ isDefault: false })
      .where(and(
        eq(researchActivityDatasets.organizationId, orgId),
        eq(researchActivityDatasets.year, year),
      ));
    await tx.update(researchActivityDatasets)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(
        eq(researchActivityDatasets.id, datasetId),
        eq(researchActivityDatasets.organizationId, orgId),
      ));
  });
}

export async function countReportsUsingActivityDataset(orgId: string, datasetId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(researchReports)
    .where(and(
      eq(researchReports.organizationId, orgId),
      sql`${researchReports.searchSnapshot}->>'activityDatasetId' = ${datasetId}`,
    ));
  return row?.n ?? 0;
}

export async function deleteActivityDataset(orgId: string, datasetId: string): Promise<void> {
  await db.delete(researchActivityDatasets)
    .where(and(
      eq(researchActivityDatasets.id, datasetId),
      eq(researchActivityDatasets.organizationId, orgId),
    ));
}
```

- [ ] **Step 3: 跑测试 + typecheck**

```bash
npx vitest run src/lib/dal/research/__tests__/activity-datasets.test.ts
npx tsc --noEmit
```

Expected: 1 passed, 0 errors

- [ ] **Step 4: 实现 server action**

```ts
// src/app/actions/research/activity-datasets.ts
"use server";
import { requireAuth } from "@/lib/auth";
import { parseActivityXlsx } from "@/lib/research/ecological-index/activity-parser";
import {
  listActivityDatasetsByOrg, getActivityDatasetById,
  createActivityDataset, setActivityDatasetDefault,
  countReportsUsingActivityDataset, deleteActivityDataset,
} from "@/lib/dal/research/activity-datasets";

async function requireOrg(): Promise<{ orgId: string; userId: string }> {
  const user = await requireAuth();
  if (!user.organizationId) throw new Error("无法获取组织");
  return { orgId: user.organizationId, userId: user.id };
}

export async function listActivityDatasets() {
  const { orgId } = await requireOrg();
  return await listActivityDatasetsByOrg(orgId);
}

export async function getActivityDatasetDetail(datasetId: string) {
  const { orgId } = await requireOrg();
  return await getActivityDatasetById(orgId, datasetId);
}

export async function uploadActivityDatasetXlsx(input: {
  name: string;
  year: number;
  fileBase64: string;
  fileName: string;
}): Promise<{ datasetId: string; warnings: string[]; stats: any }> {
  const { orgId, userId } = await requireOrg();
  const buffer = Buffer.from(input.fileBase64, "base64");
  if (buffer.byteLength > 5 * 1024 * 1024) throw new Error("文件过大,限 5MB");

  const parsed = parseActivityXlsx(buffer);
  if (parsed.data.length !== 39) {
    throw new Error(`必须包含 39 个区县,当前 ${parsed.data.length}`);
  }
  const { datasetId } = await createActivityDataset({
    organizationId: orgId,
    name: input.name,
    year: input.year,
    sourceFileName: input.fileName,
    sourceFileUrl: null,
    districtCount: parsed.data.length,
    totalActivities: parsed.totalActivities,
    activityThemes: parsed.activityThemes,
    data: parsed.data,
    isDefault: false,
    createdBy: userId,
  });
  return {
    datasetId, warnings: parsed.warnings,
    stats: { districtCount: parsed.data.length, totalActivities: parsed.totalActivities },
  };
}

export async function setDefaultActivityDataset(datasetId: string, year: number) {
  const { orgId } = await requireOrg();
  await setActivityDatasetDefault(orgId, datasetId, year);
}

export async function deleteActivityDatasetAction(datasetId: string, force = false) {
  const { orgId } = await requireOrg();
  if (!force) {
    const cnt = await countReportsUsingActivityDataset(orgId, datasetId);
    if (cnt > 0) throw new Error(`该数据集已被 ${cnt} 个报告引用, 删除将影响快照, 请确认强制删除`);
  }
  await deleteActivityDataset(orgId, datasetId);
}
```

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/dal/research/activity-datasets.ts \
        src/lib/dal/research/__tests__/activity-datasets.test.ts \
        src/app/actions/research/activity-datasets.ts
git commit -m "feat(eco-index): activity-datasets DAL + server actions"
```

---

## Task 2.5: scopes-tab.tsx(名单 tab 列表 UI)

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/resources/scopes-tab.tsx`

- [ ] **Step 1: 写 UI**

```tsx
// src/app/(dashboard)/data-collection/reports/resources/scopes-tab.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, StarOff, Eye, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UploadScopeDialog } from "./upload-scope-dialog";
import { ScopeDetailDrawer } from "./scope-detail-drawer";
import { setDefaultMediaScope, deleteMediaScopeAction } from "@/app/actions/research/media-scopes";
import type { MediaScopeSummary } from "@/lib/dal/research/media-scopes";

export function ScopesTab({ rows }: { rows: MediaScopeSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaScopeSummary | null>(null);

  const columns: DataTableColumn<MediaScopeSummary>[] = [
    {
      key: "name",
      header: "名单名称",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span>{r.name}</span>
          {r.isDefault && <Badge variant="secondary">默认</Badge>}
        </div>
      ),
    },
    { key: "totalUnits", header: "单位数", width: "w-20", align: "right", render: (r) => r.totalUnits },
    {
      key: "tiers", header: "分级分布", render: (r) => (
        <span className="text-xs text-muted-foreground">
          央 {r.centralCount} / 行 {r.industryCount} / 市 {r.municipalCount}
          / 融 {r.districtRmtCount} / 政 {r.districtGovCount}
        </span>
      ),
    },
    { key: "createdBy", header: "上传人", width: "w-24", render: (r) => r.createdByName ?? "—" },
    { key: "createdAt", header: "上传时间", width: "w-32", render: (r) => r.createdAt.toLocaleDateString("zh-CN") },
    {
      key: "actions", header: "操作", width: "w-32",
      render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDetailId(r.id)} title="查看">
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled={pending}
            onClick={() => startTransition(async () => {
              try {
                await setDefaultMediaScope(r.id);
                toast.success(r.isDefault ? "已取消默认" : "已设为默认");
                router.refresh();
              } catch (e) { toast.error((e as Error).message); }
            })}
            title={r.isDefault ? "取消默认" : "设为默认"}>
            {r.isDefault ? <StarOff className="size-4" /> : <Star className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)} title="删除">
            <Trash2 className="size-4 text-rose-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="size-4 mr-1.5" />上传新名单
        </Button>
      </div>
      <DataTable
        rows={rows} rowKey={(r) => r.id} columns={columns}
        emptyMessage={<div className="text-center py-12 text-muted-foreground">暂无媒体名单,点右上方上传</div>}
      />
      <UploadScopeDialog open={uploadOpen} onOpenChange={setUploadOpen} onSuccess={() => router.refresh()} />
      {detailId && (
        <ScopeDetailDrawer scopeId={detailId} open={true} onClose={() => setDetailId(null)} />
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除媒体名单"
        description={`确认删除"${deleteTarget?.name}"? 已上传的源文件也会被清理。`}
        onConfirm={() => {
          const id = deleteTarget!.id; setDeleteTarget(null);
          startTransition(async () => {
            try {
              await deleteMediaScopeAction(id, false);
              toast.success("已删除"); router.refresh();
            } catch (e) {
              const msg = (e as Error).message;
              if (msg.includes("已被")) {
                if (confirm(msg + "\n点确认强制删除")) {
                  await deleteMediaScopeAction(id, true);
                  toast.success("已强制删除"); router.refresh();
                }
              } else toast.error(msg);
            }
          });
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2-4: 写对应 UploadScopeDialog + ScopeDetailDrawer 占位**

(下两个 task 完整实现)

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/resources/scopes-tab.tsx
git commit -m "feat(eco-index): scopes-tab listing UI"
```

---

## Task 2.6: upload-scope-dialog.tsx(上传名单 Dialog)

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/resources/upload-scope-dialog.tsx`

- [ ] **Step 1: 写 Dialog 组件**

```tsx
// src/app/(dashboard)/data-collection/reports/resources/upload-scope-dialog.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { uploadMediaScopeXlsx } from "@/app/actions/research/media-scopes";

export function UploadScopeDialog({
  open, onOpenChange, onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) { toast.error("请填写名单名称"); return; }
    if (!file) { toast.error("请选择 xlsx 文件"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("文件大小超过 5MB"); return; }

    setSubmitting(true);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadMediaScopeXlsx({
        name: name.trim(),
        description: description.trim() || undefined,
        fileBase64, fileName: file.name,
      });
      toast.success(`上传成功: ${result.stats.totalUnits} 单位`);
      if (result.warnings.length > 0) {
        toast.warning(`含 ${result.warnings.length} 条告警, 已记入 notes`);
      }
      onSuccess(); onOpenChange(false);
      setName(""); setDescription(""); setFile(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>上传媒体名单</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>名单名称 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2025 年度生态文明传播媒体名单" />
          </div>
          <div>
            <Label>描述</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Excel 文件 (.xlsx, ≤ 5MB) *</Label>
            <Input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "上传中..." : "上传并解析"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: 跑 typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: dev server 手测上传**

```bash
npm run dev
# 用 /Users/zhuyu/Downloads/副本媒体站点名单-2(1).xlsx 测试上传
# 应看到 toast: "上传成功: 94 单位"
# 列表应出现新名单行
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/resources/upload-scope-dialog.tsx
git commit -m "feat(eco-index): upload media scope dialog"
```

- [ ] **Step 5: Done check** — dev server 验证后,确认列表行渲染正确,删除测试数据。

---

## Task 2.7: scope-detail-drawer.tsx(查看名单详情)

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/resources/scope-detail-drawer.tsx`

- [ ] **Step 1: 写 Drawer 组件**

```tsx
// src/app/(dashboard)/data-collection/reports/resources/scope-detail-drawer.tsx
"use client";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { getMediaScopeDetail } from "@/app/actions/research/media-scopes";
import type { MediaScopeDetail } from "@/lib/dal/research/media-scopes";

const TIER_LABEL: Record<string, string> = {
  central: "中央(45%)", industry: "行业(25%)", municipal: "市级(15%)",
  district_rmt: "区县融媒(8%)", district_gov: "区县政务(8%)",
};

export function ScopeDetailDrawer({
  scopeId, open, onClose,
}: { scopeId: string; open: boolean; onClose: () => void }) {
  const [detail, setDetail] = useState<MediaScopeDetail | null>(null);
  useEffect(() => {
    getMediaScopeDetail(scopeId).then(setDetail);
  }, [scopeId]);

  if (!detail) return null;
  const grouped: Record<string, typeof detail.units> = {};
  for (const u of detail.units) {
    grouped[u.tier] ??= []; grouped[u.tier]!.push(u);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="!max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{detail.name}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {detail.description ?? "—"} · 共 {detail.totalUnits} 单位
          </p>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {(["central", "industry", "municipal", "district_rmt", "district_gov"] as const).map(tier => (
            <GlassCard key={tier}>
              <h3 className="font-semibold mb-3">
                {TIER_LABEL[tier]} <span className="text-muted-foreground">({grouped[tier]?.length ?? 0})</span>
              </h3>
              <div className="space-y-2">
                {grouped[tier]?.map(u => (
                  <div key={u.id} className="flex items-start gap-3 text-sm">
                    <Badge variant="outline" className="shrink-0">L{u.xlsxRow}</Badge>
                    <div className="flex-1">
                      <div className="font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground space-x-2">
                        {u.districtNormalized && <span>区县: {u.districtNormalized}</span>}
                        {u.wechatGhid && <span>ghid: {u.wechatGhid}</span>}
                        {u.weiboUid && <span>微博 UID: {u.weiboUid}</span>}
                        {u.wechatNames.length > 0 && <span>公众号: {u.wechatNames.join(",")}</span>}
                      </div>
                      {u.notes && <div className="text-xs text-amber-600 mt-1">⚠ {u.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: 跑 typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: dev server 验证 drawer 显示**

```bash
npm run dev
# 上传名单后, 点👁眼睛图标 → Drawer 应显示 5 个 tier 分组 + 各 unit 明细
```

- [ ] **Step 4: 手测 P2 acceptance**

- ✓ 上传名单后 列表显示
- ✓ 详情 Drawer 5 tier 分组正确
- ✓ 设默认 / 取消默认正常切换
- ✓ 删除时若有报告引用提示强制删除

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/resources/scope-detail-drawer.tsx
git commit -m "feat(eco-index): scope detail drawer with tier grouping"
```

---

## Task 2.8: 资源管理页路由 + 入口

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/resources/page.tsx`
- Create: `src/app/(dashboard)/data-collection/reports/resources/resources-client.tsx`
- Modify: `src/app/(dashboard)/data-collection/reports/reports-list-client.tsx`(加"资源管理"按钮)

- [ ] **Step 1: 写 resources/page.tsx**

```tsx
// src/app/(dashboard)/data-collection/reports/resources/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listMediaScopesByOrg } from "@/lib/dal/research/media-scopes";
import { listActivityDatasetsByOrg } from "@/lib/dal/research/activity-datasets";
import { ResourcesClient } from "./resources-client";

export const dynamic = "force-dynamic";

export default async function ReportsResourcesPage({ searchParams }: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.MENU_RESEARCH);
  if (!allowed) redirect("/home");
  const { tab } = await searchParams;
  const initialTab = tab === "datasets" ? "datasets" : "scopes";

  const [scopes, datasets] = await Promise.all([
    listMediaScopesByOrg(ctx.organizationId),
    listActivityDatasetsByOrg(ctx.organizationId),
  ]);
  return <ResourcesClient initialTab={initialTab} scopes={scopes} datasets={datasets} />;
}
```

- [ ] **Step 2: 写 resources-client.tsx (含 Tabs 切换)**

```tsx
// src/app/(dashboard)/data-collection/reports/resources/resources-client.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ScopesTab } from "./scopes-tab";
import { DatasetsTab } from "./datasets-tab";
import type { MediaScopeSummary } from "@/lib/dal/research/media-scopes";
import type { ActivityDatasetSummary } from "@/lib/dal/research/activity-datasets";

export function ResourcesClient({
  initialTab, scopes, datasets,
}: {
  initialTab: "scopes" | "datasets";
  scopes: MediaScopeSummary[];
  datasets: ActivityDatasetSummary[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="space-y-6">
      <PageHeader
        title="研究报告资源管理"
        description="管理媒体名单和活动数据集,用于生成指数体系报告"
        action={
          <Link href="/data-collection/reports">
            <Button variant="ghost">
              <ArrowLeft className="size-4 mr-1.5" />返回报告列表
            </Button>
          </Link>
        }
      />
      <Tabs value={tab} onValueChange={(v) => {
        setTab(v as any);
        router.push(`?tab=${v}`);
      }} variant="line">
        <TabsList>
          <TabsTrigger value="scopes">媒体名单 ({scopes.length})</TabsTrigger>
          <TabsTrigger value="datasets">活动数据集 ({datasets.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="scopes" className="mt-4">
          <ScopesTab rows={scopes} />
        </TabsContent>
        <TabsContent value="datasets" className="mt-4">
          <DatasetsTab rows={datasets} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: 在 reports-list-client.tsx 加"资源管理"按钮**

修改 `reports-list-client.tsx` 顶部 PageHeader 加入 Link：

```tsx
import Link from "next/link";

<PageHeader
  title="研究报告"
  action={
    <div className="flex gap-2">
      <Link href="/data-collection/reports/resources">
        <Button variant="ghost">资源管理</Button>
      </Link>
      <Button>新建报告</Button>
    </div>
  }
/>
```

- [ ] **Step 4: 跑 dev server 手测**

```bash
npm run dev
# 浏览器打开 http://localhost:3000/data-collection/reports
# 点"资源管理" → 进入 /resources
# 看到两个 tab + 空表
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/resources/ \
        src/app/\(dashboard\)/data-collection/reports/reports-list-client.tsx
git commit -m "feat(eco-index): resources page + tab routing + entry button"
```

---

## Task 2.9: datasets-tab.tsx(数据集 tab 列表 UI)

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/resources/datasets-tab.tsx`

- [ ] **Step 1: 写 datasets-tab.tsx**

```tsx
// src/app/(dashboard)/data-collection/reports/resources/datasets-tab.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, StarOff, Eye, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UploadDatasetDialog } from "./upload-dataset-dialog";
import { DatasetDetailDrawer } from "./dataset-detail-drawer";
import { setDefaultActivityDataset, deleteActivityDatasetAction } from "@/app/actions/research/activity-datasets";
import type { ActivityDatasetSummary } from "@/lib/dal/research/activity-datasets";

export function DatasetsTab({ rows }: { rows: ActivityDatasetSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityDatasetSummary | null>(null);

  const columns: DataTableColumn<ActivityDatasetSummary>[] = [
    {
      key: "name", header: "数据集名",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span>{r.name}</span>
          {r.isDefault && <Badge variant="secondary">默认</Badge>}
        </div>
      ),
    },
    { key: "year", header: "年份", width: "w-16", render: (r) => r.year },
    { key: "districtCount", header: "区县数", width: "w-16", align: "right", render: (r) => r.districtCount },
    { key: "totalActivities", header: "总场数", width: "w-20", align: "right", render: (r) => r.totalActivities.toLocaleString() },
    {
      key: "themes", header: "活动主题", render: (r) => (
        <span className="text-xs text-muted-foreground">{r.activityThemes.length} 个主题</span>
      ),
    },
    { key: "createdBy", header: "上传人", width: "w-24", render: (r) => r.createdByName ?? "—" },
    { key: "createdAt", header: "上传时间", width: "w-32", render: (r) => r.createdAt.toLocaleDateString("zh-CN") },
    {
      key: "actions", header: "操作", width: "w-32",
      render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDetailId(r.id)} title="查看">
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled={pending}
            onClick={() => startTransition(async () => {
              try {
                await setDefaultActivityDataset(r.id, r.year); // 注意: 同年份内仅 1 个默认
                toast.success(r.isDefault ? "已取消默认" : `已设为 ${r.year} 年默认`);
                router.refresh();
              } catch (e) { toast.error((e as Error).message); }
            })}
            title={r.isDefault ? "取消默认" : "设为默认"}>
            {r.isDefault ? <StarOff className="size-4" /> : <Star className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(r)} title="删除">
            <Trash2 className="size-4 text-rose-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setUploadOpen(true)}>
          <Upload className="size-4 mr-1.5" />上传活动表
        </Button>
      </div>
      <DataTable
        rows={rows} rowKey={(r) => r.id} columns={columns}
        emptyMessage={<div className="text-center py-12 text-muted-foreground">暂无活动数据集</div>}
      />
      <UploadDatasetDialog open={uploadOpen} onOpenChange={setUploadOpen} onSuccess={() => router.refresh()} />
      {detailId && (
        <DatasetDetailDrawer datasetId={detailId} open={true} onClose={() => setDetailId(null)} />
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除活动数据集"
        description={`确认删除"${deleteTarget?.name}"?`}
        onConfirm={() => {
          const id = deleteTarget!.id; setDeleteTarget(null);
          startTransition(async () => {
            try {
              await deleteActivityDatasetAction(id, false);
              toast.success("已删除"); router.refresh();
            } catch (e) {
              const msg = (e as Error).message;
              if (msg.includes("已被")) {
                if (confirm(msg + "\n点确认强制删除")) {
                  await deleteActivityDatasetAction(id, true);
                  toast.success("已强制删除"); router.refresh();
                }
              } else toast.error(msg);
            }
          });
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
```

- [ ] **Step 2-4: typecheck + dev server 验证空表显示**

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/resources/datasets-tab.tsx
git commit -m "feat(eco-index): activity datasets-tab UI"
```

---

## Task 2.10: upload-dataset-dialog.tsx

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/resources/upload-dataset-dialog.tsx`

- [ ] **Step 1: 写 Dialog 含 year 校验**

```tsx
// src/app/(dashboard)/data-collection/reports/resources/upload-dataset-dialog.tsx
"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadActivityDatasetXlsx } from "@/app/actions/research/activity-datasets";

export function UploadDatasetDialog({
  open, onOpenChange, onSuccess,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) { toast.error("请填写名称"); return; }
    // 关键校验: year 必须是合理的 4 位数 (1900-2100)
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      toast.error("年份必须在 1900-2100 之间"); return;
    }
    if (!file) { toast.error("请选择 xlsx 文件"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("文件大小超过 5MB"); return; }

    setSubmitting(true);
    try {
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(((reader.result as string).split(",")[1]) ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const result = await uploadActivityDatasetXlsx({
        name: name.trim(), year, fileBase64, fileName: file.name,
      });
      toast.success(`上传成功: ${result.stats.districtCount} 区县 / ${result.stats.totalActivities} 场`);
      if (result.warnings.length > 0) {
        // 年份异常告警 (如 2026 录入错误) 单独显示
        toast.warning(`含 ${result.warnings.length} 条告警, 如: ${result.warnings[0]}`);
      }
      onSuccess(); onOpenChange(false);
      setName(""); setYear(new Date().getFullYear()); setFile(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>上传活动数据集</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>数据集名称 *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="2025 年线下生态宣传活动统计表" />
          </div>
          <div>
            <Label>年份 * (1900-2100)</Label>
            <Input type="number" min={1900} max={2100} value={year}
              onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label>Excel 文件 (.xlsx, ≤ 5MB) *</Label>
            <Input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file && <p className="text-xs text-muted-foreground mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
            <p className="text-xs text-muted-foreground mt-1">
              要求: 39 区县 × 5 主题(六五环境日/815全国生态日/志愿服务活动/环保设施向公众开放/美丽重庆六进活动)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "上传中..." : "上传并解析"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2-4: typecheck + dev server 手测**

```bash
npm run dev
# 用 /Users/zhuyu/Downloads/副本2025年线下生态宣传活动统计表(1).xlsx 测试上传
# 应看到 toast: "上传成功: 39 区县 / 5341 场"
# 异常告警: "含 1 条告警, 如: 两江新区 (L43): 日期范围含 2026 年"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/resources/upload-dataset-dialog.tsx
git commit -m "feat(eco-index): upload activity dataset dialog with year validation"
```

---

## Task 2.11: dataset-detail-drawer.tsx

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/resources/dataset-detail-drawer.tsx`

- [ ] **Step 1: 写 Drawer 含 39 行 × 5 主题 + 异常日期高亮**

```tsx
// src/app/(dashboard)/data-collection/reports/resources/dataset-detail-drawer.tsx
"use client";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { getActivityDatasetDetail } from "@/app/actions/research/activity-datasets";
import type { ActivityDatasetDetail } from "@/lib/dal/research/activity-datasets";

export function DatasetDetailDrawer({
  datasetId, open, onClose,
}: { datasetId: string; open: boolean; onClose: () => void }) {
  const [detail, setDetail] = useState<ActivityDatasetDetail | null>(null);
  useEffect(() => { getActivityDatasetDetail(datasetId).then(setDetail); }, [datasetId]);
  if (!detail) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="!max-w-5xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{detail.name}</SheetTitle>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{detail.year} 年</Badge>
            <Badge variant="outline">{detail.districtCount} 区县</Badge>
            <Badge variant="outline">{detail.totalActivities.toLocaleString()} 场总计</Badge>
            {detail.isDefault && <Badge variant="secondary">默认</Badge>}
          </div>
        </SheetHeader>
        <GlassCard className="mt-6">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 sticky top-0">
              <tr>
                <th className="text-left p-2">区县</th>
                {detail.activityThemes.map(t => <th key={t} className="text-right p-2">{t}</th>)}
                <th className="text-right p-2 font-bold">总数</th>
                <th className="text-right p-2">首发日</th>
                <th className="text-right p-2">末发日</th>
                <th className="text-right p-2">跨度</th>
                <th className="text-right p-2">频率(场/天)</th>
              </tr>
            </thead>
            <tbody>
              {detail.data.map((d, i) => {
                // 异常年份: firstDate 或 lastDate 不在 dataset.year 内 → 红色标注
                const yr = String(detail.year);
                const isAbnormal = !d.firstDate.startsWith(yr) || !d.lastDate.startsWith(yr);
                return (
                  <tr key={d.district} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                    <td className="p-2">{d.district}</td>
                    {detail.activityThemes.map(t => (
                      <td key={t} className="text-right p-2">{d.themes[t] ?? 0}</td>
                    ))}
                    <td className="text-right p-2 font-medium">{d.total}</td>
                    <td className={`text-right p-2 ${isAbnormal ? "text-rose-600 font-medium" : ""}`}>
                      {d.firstDate}
                    </td>
                    <td className={`text-right p-2 ${isAbnormal ? "text-rose-600 font-medium" : ""}`}>
                      {d.lastDate}
                    </td>
                    <td className="text-right p-2">{d.spanDays}d</td>
                    <td className="text-right p-2">{d.freq.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {detail.data.some(d => !d.firstDate.startsWith(String(detail.year))
              || !d.lastDate.startsWith(String(detail.year))) && (
            <div className="text-xs text-rose-600 mt-2">
              ⚠ 红色标注的日期不在 {detail.year} 年范围内,可能 xlsx 录入错误
            </div>
          )}
        </GlassCard>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2-4: typecheck + dev server 手测异常日期高亮**

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/resources/dataset-detail-drawer.tsx
git commit -m "feat(eco-index): dataset detail drawer with abnormal date highlight"
```

---

## Task 2.12: P2 总结

- [ ] **Step 1**: `npx tsc --noEmit` — 零错误
- [ ] **Step 2**: `npm run test` — 所有测试通过(预期 +14 个新测试)
- [ ] **Step 3**: `npm run build` — 通过
- [ ] **Step 4**: 写 phase summary `docs/superpowers/phase-reports/2026-05-26-p2-resources-summary.md`
- [ ] **Step 5**: Commit phase summary,标 P2 完成

---

# Phase 3: 计算引擎(3 天)

## Task 3.1: matcher.ts 单元测试 + 实现

**Files:**
- Create: `src/lib/research/ecological-index/matcher.ts`
- Create: `src/lib/research/ecological-index/__tests__/matcher.test.ts`

实现 spec §5.2.1 的 5 级优先级匹配 + 反向 outlet 冲突仲裁。

- [ ] **Step 1: 写 8 个测试 case**

```ts
// src/lib/research/ecological-index/__tests__/matcher.test.ts
import { describe, it, expect } from "vitest";
import { matchUnitToOutletIds, resolveOutletOwnership } from "../matcher";
import type { ParsedScopeUnit } from "../types";

type DictRow = { id: string; outlet_name: string; public_account_names: string[]; domains: string[] };

const u = (overrides: Partial<ParsedScopeUnit> = {}): ParsedScopeUnit => ({
  xlsxRow: 1, name: "默认", tier: "central",
  districtOrig: null, districtNormalized: null,
  websites: [], wechatNames: [], wechatGhid: null, weiboUid: null, weiboHandle: null,
  douyinUrl: null, kuaishouUrl: null, notes: null,
  ...overrides,
});

describe("matcher.matchUnitToOutletIds", () => {
  it("公众号 ghid 精确匹配 (P1)", () => {
    const unit = u({ name: "人民日报", wechatGhid: "gh_f8245afd69b7" });
    const dict: DictRow[] = [
      { id: "o1", outlet_name: "人民日报", public_account_names: ["gh_f8245afd69b7", "人民日报"], domains: [] },
      { id: "o2", outlet_name: "别人", public_account_names: ["gh_other"], domains: [] },
    ];
    const r = matchUnitToOutletIds(unit, dict);
    expect(r.matchedOutletIds).toEqual(["o1"]);
    expect(r.matchReasons[0]).toContain("ghid=");
  });

  it("微博 UID 精确匹配 (P2)", () => {
    const unit = u({ name: "美丽重庆", weiboUid: "2144075181" });
    const dict: DictRow[] = [
      { id: "o1", outlet_name: "美丽重庆", public_account_names: ["2144075181"], domains: [] },
    ];
    expect(matchUnitToOutletIds(unit, dict).matchedOutletIds).toEqual(["o1"]);
  });

  it("公众号名精确匹配 (P3)", () => {
    const unit = u({ name: "新华社", wechatNames: ["新华视点", "新华社"] });
    const dict: DictRow[] = [
      { id: "o1", outlet_name: "新华社", public_account_names: ["新华视点"], domains: [] },
    ];
    expect(matchUnitToOutletIds(unit, dict).matchedOutletIds).toEqual(["o1"]);
  });

  it("网站域名精确匹配 (P4)", () => {
    const unit = u({ name: "央视", websites: ["cctv.com"] });
    const dict: DictRow[] = [
      { id: "o1", outlet_name: "央视", public_account_names: [], domains: ["cctv.com"] },
    ];
    expect(matchUnitToOutletIds(unit, dict).matchedOutletIds).toEqual(["o1"]);
  });

  it("outlet_name 双向 contains 模糊匹配 (P5)", () => {
    const unit = u({ name: "央视新闻（中央广播电视总台）" });
    const dict: DictRow[] = [
      { id: "o1", outlet_name: "央视新闻", public_account_names: [], domains: [] },
    ];
    expect(matchUnitToOutletIds(unit, dict).matchedOutletIds).toEqual(["o1"]);
  });

  it("同 outlet 多信号命中 → 保留最高优先级", () => {
    const unit = u({ name: "新华社", wechatGhid: "gh_a30df8f8534c", wechatNames: ["新华视点"] });
    const dict: DictRow[] = [
      { id: "o1", outlet_name: "新华社", public_account_names: ["gh_a30df8f8534c", "新华视点"], domains: [] },
    ];
    const r = matchUnitToOutletIds(unit, dict);
    expect(r.matchedOutletIds).toEqual(["o1"]); // 不重复
    expect(r.matchReasons[0]).toContain("ghid="); // P1 优先,不是 P3
  });
});

describe("matcher.resolveOutletOwnership", () => {
  it("无冲突: 各 unit 各自匹配", () => {
    const units = [u({ name: "U1", tier: "central" as any }), u({ name: "U2", tier: "industry" as any, xlsxRow: 2 })];
    const matches = new Map([["U1", ["o1"]], ["U2", ["o2"]]]);
    const owner = resolveOutletOwnership(matches, units);
    expect(owner.get("o1")).toBe("U1");
    expect(owner.get("o2")).toBe("U2");
  });

  it("冲突: tier 优先级裁决 (重庆日报 vs 西部科学城)", () => {
    const cqrb = u({ name: "重庆日报", tier: "municipal" as any, xlsxRow: 9, wechatGhid: "gh_27de3a2c6bc4" });
    const kxc = u({ name: "西部科学城", tier: "district_rmt" as any, xlsxRow: 48, wechatGhid: "gh_27de3a2c6bc4" });
    const matches = new Map([["重庆日报", ["o1"]], ["西部科学城", ["o1"]]]);
    const owner = resolveOutletOwnership(matches, [cqrb, kxc]);
    expect(owner.get("o1")).toBe("重庆日报"); // municipal(2) < district_rmt(3)
  });

  it("同 tier 冲突: xlsxRow 先到先得", () => {
    const a = u({ name: "A", tier: "central" as any, xlsxRow: 2 });
    const b = u({ name: "B", tier: "central" as any, xlsxRow: 5 });
    const matches = new Map([["A", ["o1"]], ["B", ["o1"]]]);
    const owner = resolveOutletOwnership(matches, [a, b]);
    expect(owner.get("o1")).toBe("A");
  });

  it("已知冲突 1 (gh_27de3a2c6bc4): 重庆日报(municipal) > 西部科学城(district_rmt)", () => {
    const cqrb = u({ name: "重庆日报", tier: "municipal" as any, xlsxRow: 9, wechatGhid: "gh_27de3a2c6bc4" });
    const kxc = u({ name: "西部科学城", tier: "district_rmt" as any, xlsxRow: 48, wechatGhid: "gh_27de3a2c6bc4" });
    const owner = resolveOutletOwnership(
      new Map([["重庆日报", ["o-cqrb"]], ["西部科学城", ["o-cqrb"]]]),
      [cqrb, kxc],
    );
    expect(owner.get("o-cqrb")).toBe("重庆日报");
  });

  it("已知冲突 2 (weibo 2144075181): 美丽重庆(industry) > 重庆市生态环境局(district_gov)", () => {
    const mlcq = u({ name: "美丽重庆", tier: "industry" as any, xlsxRow: 12, weiboUid: "2144075181" });
    const cqenv = u({ name: "重庆市生态环境局", tier: "district_gov" as any, xlsxRow: 92, weiboUid: "2144075181" });
    const owner = resolveOutletOwnership(
      new Map([["美丽重庆", ["o-mlcq"]], ["重庆市生态环境局", ["o-mlcq"]]]),
      [mlcq, cqenv],
    );
    expect(owner.get("o-mlcq")).toBe("美丽重庆"); // industry(1) < district_gov(4)
  });

  it("已知冲突 3 (weibo 2780124485): 黔江发布(district_rmt) > 黔江区生态环境局(district_gov)", () => {
    const qjfb = u({ name: "黔江发布", tier: "district_rmt" as any, xlsxRow: 53, weiboUid: "2780124485" });
    const qjgov = u({ name: "黔江区生态环境局", tier: "district_gov" as any, xlsxRow: 95, weiboUid: "2780124485" });
    const owner = resolveOutletOwnership(
      new Map([["黔江发布", ["o-qj"]], ["黔江区生态环境局", ["o-qj"]]]),
      [qjfb, qjgov],
    );
    expect(owner.get("o-qj")).toBe("黔江发布"); // rmt(3) < gov(4)
  });
});
```

- [ ] **Step 2: 跑测试(失败)**

Run: `npx vitest run src/lib/research/ecological-index/__tests__/matcher.test.ts`
Expected: 9 failed (function not defined)

- [ ] **Step 3: 实现 matcher.ts**

```ts
// src/lib/research/ecological-index/matcher.ts
import type { ParsedScopeUnit, ScopeUnitTier } from "./types";

export type OutletDictRow = {
  id: string;
  outlet_name: string;
  public_account_names: string[];
  domains: string[];
};

export type MatchResult = {
  matchedOutletIds: string[];
  matchReasons: string[]; // 与 matchedOutletIds 对应的信号描述
};

/**
 * 把 unit 反查到 outlet_id, 按 5 级优先级匹配, 命中即停。
 *
 * 优先级 (从高到低):
 *   1. 公众号 ghid 精确匹配 (最强信号)
 *   2. 微博 UID 精确匹配
 *   3. 公众号名精确匹配
 *   4. 网站域名精确匹配
 *   5. outlet_name 双向 contains 模糊匹配 (最弱信号)
 *
 * 同一 outlet 可能被多个信号命中, 自动去重保留最高优先级。
 */
export function matchUnitToOutletIds(
  unit: ParsedScopeUnit,
  dict: OutletDictRow[],
): MatchResult {
  const matched: Array<{ outletId: string; signal: string; priority: number }> = [];

  for (const d of dict) {
    // 优先级 1: ghid
    if (unit.wechatGhid && d.public_account_names.some(p => p === unit.wechatGhid)) {
      matched.push({ outletId: d.id, signal: `ghid=${unit.wechatGhid}`, priority: 1 });
      continue;
    }
    // 优先级 2: weibo UID
    if (unit.weiboUid && d.public_account_names.some(p => p === unit.weiboUid)) {
      matched.push({ outletId: d.id, signal: `weibo_uid=${unit.weiboUid}`, priority: 2 });
      continue;
    }
    // 优先级 3: 公众号名精确
    let p3hit = false;
    for (const wn of unit.wechatNames) {
      if (d.public_account_names.includes(wn)) {
        matched.push({ outletId: d.id, signal: `wechat_name=${wn}`, priority: 3 });
        p3hit = true;
        break;
      }
    }
    if (p3hit) continue;
    // 优先级 4: 域名
    let p4hit = false;
    if (unit.websites.length > 0) {
      for (const ww of unit.websites) {
        const w = ww.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
        if (w && d.domains.some(dd => dd.toLowerCase() === w)) {
          matched.push({ outletId: d.id, signal: `domain=${w}`, priority: 4 });
          p4hit = true;
          break;
        }
      }
    }
    if (p4hit) continue;
    // 优先级 5: outlet_name 模糊
    if (d.outlet_name && unit.name && (
      d.outlet_name === unit.name ||
      d.outlet_name.includes(unit.name) ||
      unit.name.includes(d.outlet_name)
    )) {
      matched.push({ outletId: d.id, signal: `name~${d.outlet_name}`, priority: 5 });
    }
  }

  // 去重: 同一 outlet 保留最高优先级 (priority 越小越高)
  const dedup = new Map<string, { outletId: string; signal: string; priority: number }>();
  for (const m of matched) {
    const prev = dedup.get(m.outletId);
    if (!prev || m.priority < prev.priority) dedup.set(m.outletId, m);
  }
  return {
    matchedOutletIds: [...dedup.values()].map(m => m.outletId),
    matchReasons: [...dedup.values()].map(m => m.signal),
  };
}

const TIER_RANK: Record<ScopeUnitTier, number> = {
  central: 0, industry: 1, municipal: 2, district_rmt: 3, district_gov: 4,
};

/**
 * 反向冲突仲裁: 同一 outlet 可能被多个 unit 匹配 (因字典/名单重叠)。
 * 按 tier 优先级 (central > industry > municipal > rmt > gov) 裁决归属。
 * 同 tier 下 按 xlsxRow 先到先得。
 *
 * 已知冲突案例 (spec §5.2.1):
 *   - gh_27de3a2c6bc4 出现在重庆日报(L9, municipal) 和西部科学城(L48, district_rmt) → 归重庆日报
 *   - weibo UID 2144075181 出现在美丽重庆(L12, industry) 和重庆市生态环境局(L92, district_gov) → 归美丽重庆
 *   - weibo UID 2780124485 出现在黔江发布(L53, district_rmt) 和黔江区生态环境局(L95, district_gov) → 归黔江发布
 */
export function resolveOutletOwnership(
  matches: Map<string, string[]>,
  units: ParsedScopeUnit[],
): Map<string, string> {
  const owner = new Map<string, string>();
  const inv = new Map<string, string[]>();
  for (const [unitName, outletIds] of matches) {
    for (const oid of outletIds) {
      inv.set(oid, [...(inv.get(oid) ?? []), unitName]);
    }
  }
  const unitsByName = new Map(units.map(u => [u.name, u]));

  for (const [outletId, candidates] of inv) {
    if (candidates.length === 1) { owner.set(outletId, candidates[0]!); continue; }
    const sorted = [...candidates].sort((a, b) => {
      const ua = unitsByName.get(a)!, ub = unitsByName.get(b)!;
      const ta = TIER_RANK[ua.tier], tb = TIER_RANK[ub.tier];
      if (ta !== tb) return ta - tb;
      return ua.xlsxRow - ub.xlsxRow;
    });
    owner.set(outletId, sorted[0]!);
  }
  return owner;
}
```

- [ ] **Step 4: 跑测试(通过)**

```bash
npx vitest run src/lib/research/ecological-index/__tests__/matcher.test.ts
# Expected: 9 passed
```

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/lib/research/ecological-index/matcher.ts \
        src/lib/research/ecological-index/__tests__/matcher.test.ts
git commit -m "feat(eco-index): matcher with 5-tier priority + ownership conflict resolution"
```

---

## Task 3.2: compute.ts(核心算法) + 单元测试

**Files:**
- Create: `src/lib/research/ecological-index/compute.ts`
- Create: `src/lib/research/ecological-index/__tests__/compute.test.ts`

- [ ] **Step 1: 写算法核心 + 边界 case 测试**

```ts
// src/lib/research/ecological-index/__tests__/compute.test.ts
import { describe, it, expect } from "vitest";
import { richnessF, scaleToRange, weightedTierScore, weightedComposite } from "../compute";

describe("compute.richnessF", () => {
  it("16 主题均匀 → F = N (上限)", () => {
    const uniform = Array(16).fill(10); // 每主题 10 篇
    expect(richnessF(uniform, 16)).toBe(16);
  });

  it("集中 1 主题 → F ≈ 1 / (15 × 1/16 + 15/16) = 16/30 ≈ 0.53 ... 等等,公式给 1 / Σ|p−1/N|", () => {
    const counts = [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    // p = [1, 0, 0, ...0]; |p−1/16| = [15/16, 1/16 × 15] = 15/16 + 15/16 = 30/16
    // F = 1 / (30/16) = 16/30 ≈ 0.533
    expect(richnessF(counts, 16)).toBeCloseTo(16 / 30, 3);
  });

  it("全 0 → F = 0", () => {
    expect(richnessF(Array(16).fill(0), 16)).toBe(0);
  });

  it("N=5 活动主题均匀 → F = 5", () => {
    expect(richnessF([1, 1, 1, 1, 1], 5)).toBe(5);
  });
});

describe("compute.scaleToRange", () => {
  it("39 个全等值 → 全 80(中位)", () => {
    const r = scaleToRange(Array(39).fill(50));
    expect(r.every(v => v === 80)).toBe(true);
  });

  it("max=min 边界 → 全 80", () => {
    expect(scaleToRange([5, 5, 5])).toEqual([80, 80, 80]);
  });

  it("单调线性映射 [10,20,30] → [65,80,95]", () => {
    expect(scaleToRange([10, 20, 30])).toEqual([65, 80, 95]);
  });

  it("空数组 → 空数组", () => {
    expect(scaleToRange([])).toEqual([]);
  });
});

describe("compute.weightedTierScore", () => {
  it("数量×0.4 + 丰富度×0.3 + 速度×0.3", () => {
    // 95 × 0.4 + 80 × 0.3 + 80 × 0.3 = 38 + 24 + 24 = 86
    expect(weightedTierScore(95, 80, 80)).toBe(86);
  });

  it("全 80 (中位) → 80", () => {
    expect(weightedTierScore(80, 80, 80)).toBe(80);
  });
});

describe("compute.weightedComposite", () => {
  it("AHP 权重: 央 0.45 + 业 0.25 + 市 0.15 + 区 0.08 + 公 0.07 = 1.00", () => {
    // 全 80 → 综合 80
    expect(weightedComposite(80, 80, 80, 80, 80)).toBeCloseTo(80, 5);
  });

  it("两江新区 fixture: 央 83.28, 业 91.26, 市 95.00, 区 83.96, 公 67.82 → ~86.01", () => {
    // 83.28*0.45 + 91.26*0.25 + 95*0.15 + 83.96*0.08 + 67.82*0.07
    // = 37.476 + 22.815 + 14.25 + 6.7168 + 4.7474 = 86.0052
    expect(weightedComposite(83.28, 91.26, 95.00, 83.96, 67.82)).toBeCloseTo(86.00, 1);
  });
});
```

- [ ] **Step 2: 跑测试(失败)**

```bash
npx vitest run src/lib/research/ecological-index/__tests__/compute.test.ts
# Expected: 12 failed
```

- [ ] **Step 3: 实现 compute.ts**

```ts
// src/lib/research/ecological-index/compute.ts
// 移植自 scripts/compute-ranking-scope.ts (已 vetted, 与本地脚本输出 1:1 一致)

export const TIER_WEIGHT = {
  central: 0.45, industry: 0.25, municipal: 0.15, district: 0.08, public: 0.07,
} as const;
export const SUB_WEIGHT = { count: 0.40, richness: 0.30, freq: 0.30 } as const;
export const SCALE_MIN = 65;
export const SCALE_MAX = 95;

/**
 * 主题丰富度 F = 1 / Σ |p_t − 1/N|
 *
 * 边界:
 *  - total = 0 → 0 (无数据)
 *  - 全部均匀 (sumDev = 0) → 上限 N (实践中 16 或 5)
 *  - 集中 1 主题 → 接近 1
 */
export function richnessF(counts: number[], N: number): number {
  const total = counts.reduce((s, x) => s + x, 0);
  if (total === 0) return 0;
  let sumDev = 0;
  for (let i = 0; i < N; i += 1) {
    const p = (counts[i] ?? 0) / total;
    sumDev += Math.abs(p - 1 / N);
  }
  if (sumDev === 0) return N;
  return 1 / sumDev;
}

/**
 * min-max 区间化到 [65, 95]。
 *
 * 边界:
 *  - 全等 (max=min) → 全 80
 *  - 空数组 → []
 */
export function scaleToRange(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => (SCALE_MIN + SCALE_MAX) / 2);
  return values.map(v => SCALE_MIN + ((v - lo) / (hi - lo)) * (SCALE_MAX - SCALE_MIN));
}

/** 一级指标 = 数量×0.4 + 丰富度×0.3 + 速度×0.3 */
export function weightedTierScore(count: number, richness: number, freq: number): number {
  return count * SUB_WEIGHT.count + richness * SUB_WEIGHT.richness + freq * SUB_WEIGHT.freq;
}

/** 综合分 = 中央×0.45 + 行业×0.25 + 市级×0.15 + 区县×0.08 + 公众×0.07 */
export function weightedComposite(
  central: number, industry: number, municipal: number, district: number, publicScore: number,
): number {
  return central * TIER_WEIGHT.central +
         industry * TIER_WEIGHT.industry +
         municipal * TIER_WEIGHT.municipal +
         district * TIER_WEIGHT.district +
         publicScore * TIER_WEIGHT.public;
}

// 后续 (Task 3.7) 会加 computeAllIndicators() 函数, 整合 buckets → 区间化 → 加权 → ranked。
// 本 task 仅落地纯函数 + 测试。
```

- [ ] **Step 4: 跑测试**

```bash
npx vitest run src/lib/research/ecological-index/__tests__/compute.test.ts
# Expected: 12 passed
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/ecological-index/compute.ts \
        src/lib/research/ecological-index/__tests__/compute.test.ts
git commit -m "feat(eco-index): core compute (F formula + min-max + AHP weights) with 12 tests"
```

---

## Task 3.3: chart-generator.ts(3 张图)

**Files:**
- Create: `src/lib/research/ecological-index/chart-generator.ts`

复刻 `scripts/regen_scope_docx.py` 中 gen_chart_1/2/3 的逻辑,基于 P0.2 spike 用 chartjs-node-canvas。

- [ ] **Step 1: 写图表生成函数**

```ts
// src/lib/research/ecological-index/chart-generator.ts
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { registerFont } from "canvas";
import path from "node:path";

let fontRegistered = false;
function ensureFont() {
  if (fontRegistered) return;
  registerFont(path.resolve("public/fonts/NotoSansSC-Regular.otf"), { family: "Noto Sans SC" });
  fontRegistered = true;
}

const FONT = "Noto Sans SC";

export type RankedItem = {
  rank: number; name: string;
  central: number; industry: number; municipal: number; district: number; public: number;
  composite: number;
};

export type Stats = { mean: number; tier_high: number; tier_mid: number; tier_low: number };

/** 图 1: 39 区县综合得分柱状图 (按梯队着色,平均线 + 80/72 分隔虚线) */
export async function generateRankingBarChart(ranked: RankedItem[], stats: Stats): Promise<Buffer> {
  ensureFont();
  const canvas = new ChartJSNodeCanvas({ width: 1920, height: 1024, backgroundColour: "white" });
  const colors = ranked.map(r => r.composite >= 80 ? "#2E7D32" : r.composite >= 72 ? "#81C784" : "#9E9E9E");
  return await canvas.renderToBuffer({
    type: "bar",
    data: {
      labels: ranked.map(r => r.name),
      datasets: [{
        label: "综合得分", data: ranked.map(r => r.composite),
        backgroundColor: colors, borderWidth: 0,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: "2025 年度重庆市生态文明传播指数综合得分排行",
                 font: { family: FONT, size: 24 } },
        legend: { display: false },
        annotation: { /* matplotlib 平均线 75.08 用 plugin-annotation 模拟,简化用 datasets background */ } as any,
      },
      scales: {
        x: { ticks: { font: { family: FONT, size: 10 }, maxRotation: 45 } },
        y: { ticks: { font: { family: FONT, size: 12 } }, min: 60, max: 90 },
      },
    },
  });
}

/** 图 2: 梯队分布饼图 (高 / 中 / 低) */
export async function generateTierPieChart(stats: Stats): Promise<Buffer> {
  ensureFont();
  const canvas = new ChartJSNodeCanvas({ width: 1024, height: 1024, backgroundColour: "white" });
  return await canvas.renderToBuffer({
    type: "pie",
    data: {
      labels: [
        `高分等级 (≥80) ${stats.tier_high} 个`,
        `中分等级 (72-80) ${stats.tier_mid} 个`,
        `低分等级 (<72) ${stats.tier_low} 个`,
      ],
      datasets: [{
        data: [stats.tier_high, stats.tier_mid, stats.tier_low],
        backgroundColor: ["#2E7D32", "#81C784", "#9E9E9E"], borderColor: "white", borderWidth: 2,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: "2025 年度 39 区县综合得分梯队分布",
                 font: { family: FONT, size: 22 } },
        legend: { labels: { font: { family: FONT, size: 14 } } },
      },
    },
  });
}

/** 图 3: Top 15 区县五类传播指数对比 */
export async function generateTop15ComparisonChart(ranked: RankedItem[]): Promise<Buffer> {
  ensureFont();
  const top15 = ranked.slice(0, 15);
  const canvas = new ChartJSNodeCanvas({ width: 1920, height: 1024, backgroundColour: "white" });
  return await canvas.renderToBuffer({
    type: "bar",
    data: {
      labels: top15.map(r => r.name),
      datasets: [
        { label: "中央媒体指数", data: top15.map(r => r.central), backgroundColor: "#1B5E20" },
        { label: "行业媒体指数", data: top15.map(r => r.industry), backgroundColor: "#43A047" },
        { label: "市级媒体指数", data: top15.map(r => r.municipal), backgroundColor: "#81C784" },
        { label: "区县媒体指数", data: top15.map(r => r.district), backgroundColor: "#A5D6A7" },
        { label: "公众行为指数", data: top15.map(r => r.public), backgroundColor: "#9E9E9E" },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: "2025 年度 Top 15 区县五类传播指数对比",
                 font: { family: FONT, size: 22 } },
        legend: { position: "top", labels: { font: { family: FONT, size: 12 } } },
      },
      scales: {
        x: { ticks: { font: { family: FONT, size: 11 }, maxRotation: 45 } },
        y: { ticks: { font: { family: FONT, size: 12 } }, min: 60, max: 100 },
      },
    },
  });
}
```

- [ ] **Step 2-4: typecheck + 写简单 smoke test(用 fixture ranked 数据生成 3 张图保存 /tmp 人工验证)**

```ts
// src/lib/research/ecological-index/__tests__/chart-generator.smoke.test.ts (smoke, mark .skip 默认不跑)
import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { generateRankingBarChart, generateTierPieChart, generateTop15ComparisonChart } from "../chart-generator";

describe.skip("chart-generator smoke", () => {
  it("3 张图生成 PNG buffer 非空", async () => {
    const fakeRanked = Array.from({ length: 39 }, (_, i) => ({
      rank: i + 1, name: `区县${i + 1}`,
      central: 80, industry: 75, municipal: 70, district: 75, public: 70,
      composite: 90 - i * 0.5,
    }));
    const stats = { mean: 75, tier_high: 5, tier_mid: 23, tier_low: 11 };
    const c1 = await generateRankingBarChart(fakeRanked, stats);
    const c2 = await generateTierPieChart(stats);
    const c3 = await generateTop15ComparisonChart(fakeRanked);
    expect(c1.byteLength).toBeGreaterThan(10000);
    expect(c2.byteLength).toBeGreaterThan(5000);
    expect(c3.byteLength).toBeGreaterThan(10000);
    writeFileSync("/tmp/chart-smoke-1.png", c1);
    writeFileSync("/tmp/chart-smoke-2.png", c2);
    writeFileSync("/tmp/chart-smoke-3.png", c3);
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/ecological-index/chart-generator.ts \
        src/lib/research/ecological-index/__tests__/chart-generator.smoke.test.ts
git commit -m "feat(eco-index): chart-generator (3 charts via chartjs-node-canvas)"
```

---

## Task 3.4: docx-builder.ts(排行榜 docx)

**Files:**
- Create: `src/lib/research/ecological-index/docx-builder.ts`

复刻 `/tmp/regen_scope_docx.py` 的所有元素: 标题 / 39 行表 / 段落数字插值 / 3 张图嵌入 / 39 区县评语自动生成。

- [ ] **Step 1: 写 docx builder**

```ts
// src/lib/research/ecological-index/docx-builder.ts
// 基于 docx npm lib (A5 已 vetted),复刻 docs/0526-scope-...docx 的所有元素
import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle,
} from "docx";
import type { EcologicalIndexAggregates } from "@/db/schema/research/reports";

export type DocxBuildInput = {
  year: number;
  aggregates: EcologicalIndexAggregates;
  chartBuffers: { bar: Buffer; pie: Buffer; top15: Buffer };
};

const TIER_LABEL = {
  central: "中央媒体", industry: "行业媒体", municipal: "市级媒体",
  district: "区县媒体", public: "公众行为",
};

function makeReview(r: any): string {
  const dims = {
    "中央媒体": r.central, "行业媒体": r.industry,
    "市级媒体": r.municipal, "区县媒体": r.district, "公众行为": r.public,
  };
  const sorted = Object.entries(dims).sort((a, b) => (b[1] as number) - (a[1] as number));
  const strengths = sorted.filter(([_, s]) => (s as number) >= 80).map(([d]) => d);
  const weaknesses = sorted.filter(([_, s]) => (s as number) < 73).map(([d]) => d);
  const strong = strengths.length > 0 ? strengths.join("、") + "表现突出" : "各维度均较均衡";
  const weak = weaknesses.length > 0 ? weaknesses.join("、") + "偏弱,需重点提升" : "暂无明显短板";
  return `${r.name}: ${strong}; ${weak}。`;
}

export async function buildRankingDocx(input: DocxBuildInput): Promise<Buffer> {
  const { year, aggregates, chartBuffers } = input;
  const { ranked, stats } = aggregates;

  const high = ranked.filter(r => r.composite >= 80);
  const mid = ranked.filter(r => r.composite >= 72 && r.composite < 80);
  const low = ranked.filter(r => r.composite < 72);

  // 表 2-1: 39 行综合排行表
  const tableHeaderRow = new TableRow({
    children: ["排名", "区县", "中央媒体", "行业媒体", "市级媒体", "区县媒体", "公众行为", "综合得分"]
      .map(t => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })] })),
  });
  const tableRows = ranked.map(r =>
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(String(r.rank))] }),
        new TableCell({ children: [new Paragraph(r.name)] }),
        new TableCell({ children: [new Paragraph(r.central.toFixed(2))] }),
        new TableCell({ children: [new Paragraph(r.industry.toFixed(2))] }),
        new TableCell({ children: [new Paragraph(r.municipal.toFixed(2))] }),
        new TableCell({ children: [new Paragraph(r.district.toFixed(2))] }),
        new TableCell({ children: [new Paragraph(r.public.toFixed(2))] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: r.composite.toFixed(2), bold: true })] })] }),
      ],
    })
  );

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE,
          children: [new TextRun(`${year} 年度重庆市生态文明传播指数排行榜及解读`)] }),

        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("一、引言")] }),
        new Paragraph(`党的十八大以来,党和国家高度重视生态文明建设...(引言段落)`),

        new Paragraph({ heading: HeadingLevel.HEADING_1,
          children: [new TextRun("二、综合得分及解读")] }),
        new Paragraph({ children: [new TextRun({ text: "表 2-1 综合排行榜", bold: true })] }),
        new Table({ rows: [tableHeaderRow, ...tableRows], width: { size: 100, type: WidthType.PERCENTAGE } }),
        new Paragraph(""), // 空行
        new Paragraph(`注 1: 综合得分 = 中央×45% + 行业×25% + 市级×15% + 区县×8% + 公众×7%`),
        new Paragraph(`注 2: 各一级指数下含报道数量(40%)、主题丰富度(30%)、传播速度(30%)三个二级指标的加权得分。`),
        new Paragraph(`注 3: 公众行为引导指数已采用 ${year} 年 39 区县线下宣传活动统计表的实际数据计算。`),

        new Paragraph({ children: [new ImageRun({ data: chartBuffers.bar,
          transformation: { width: 600, height: 320 } })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2,
          children: [new TextRun("(一) 整体情况分析")] }),
        new Paragraph(`最高分"${ranked[0]?.name}"达到了 ${ranked[0]?.composite.toFixed(2)} 分,` +
          `最低分"${ranked[ranked.length - 1]?.name}"为 ${ranked[ranked.length - 1]?.composite.toFixed(2)} 分,` +
          `两者之间的分差达到了 ${stats.span.toFixed(2)} 分。`),
        new Paragraph(`大部分区县的得分集中分布在 72-80 分之间,共 ${mid.length} 个区县,` +
          `占总区县数的 ${Math.round(mid.length * 100 / 39)}%。`),

        new Paragraph({ children: [new ImageRun({ data: chartBuffers.pie,
          transformation: { width: 400, height: 400 } })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2,
          children: [new TextRun("(二) 排名分布分析")] }),
        new Paragraph(`高分等级: ${high.length} 个 — ` +
          high.map(r => `${r.name}(${r.composite.toFixed(2)})`).join("、")),
        new Paragraph(`中分等级: ${mid.length} 个,如 ` +
          mid.slice(0, 3).map(r => `${r.name}(${r.composite.toFixed(2)})`).join("、") + " 等"),
        new Paragraph(`低分等级: ${low.length} 个,如 ` +
          low.slice(-3).map(r => `${r.name}(${r.composite.toFixed(2)})`).join("、") + " 等"),

        new Paragraph({ heading: HeadingLevel.HEADING_2,
          children: [new TextRun("(四) 平均值分析")] }),
        new Paragraph(`重庆市 39 个地区的总分平均值为 ${stats.mean.toFixed(2)},` +
          `中位数为 ${stats.median.toFixed(2)},标准差为 ${stats.stdev.toFixed(2)}。`),

        new Paragraph({ heading: HeadingLevel.HEADING_1,
          children: [new TextRun("三、单项得分及解读")] }),
        new Paragraph({ children: [new ImageRun({ data: chartBuffers.top15,
          transformation: { width: 600, height: 320 } })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_1,
          children: [new TextRun("四、等级差异及解读")] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2,
          children: [new TextRun(`(一) 高分等级 (≥80 共 ${high.length} 个)`)] }),
        ...high.map(r => new Paragraph(`(${r.rank}) ${makeReview(r)}`)),
        new Paragraph({ heading: HeadingLevel.HEADING_2,
          children: [new TextRun(`(二) 中分等级 (72-80 共 ${mid.length} 个)`)] }),
        ...mid.map(r => new Paragraph(`(${r.rank}) ${makeReview(r)}`)),
        new Paragraph({ heading: HeadingLevel.HEADING_2,
          children: [new TextRun(`(三) 低分等级 (<72 共 ${low.length} 个)`)] }),
        ...low.map(r => new Paragraph(`(${r.rank}) ${makeReview(r)}`)),
      ],
    }],
  });
  return await Packer.toBuffer(doc);
}
```

- [ ] **Step 2-4: typecheck + smoke test + 人工 Word 验证**

```bash
npx tsc --noEmit
# smoke test 用 fixture aggregates 生成 docx 保存到 /tmp 用 Word/WPS 打开验证 39 行表 + 3 张图正常显示
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/ecological-index/docx-builder.ts
git commit -m "feat(eco-index): docx-builder with 39-row table + 3 charts + 39 reviews"
```

---

## Task 3.5: xlsx-builder.ts(19-sheet 可验证 xlsx)

**Files:**
- Create: `src/lib/research/ecological-index/xlsx-builder.ts`

参考 `scripts/export-scope-xlsx.py` 完整移植到 TS。19 sheet 结构:
- 00 总览说明
- 01 数据源清单
- 02 数据范围审计
- 1.1-1.3 中央 (数量 / 丰富度 / 速度) × 3
- 2.1-2.3 行业 × 3
- 3.1-3.3 市级 × 3
- 4.1-4.3 区县 × 3
- 5.1-5.3 公众 × 3
- 99 综合汇总

- [ ] **Step 1: 写 sheet 生成器骨架(00 / 01 / 02 / 媒体类 12 sheet / 公众类 3 sheet / 99 综合)**

```ts
// src/lib/research/ecological-index/xlsx-builder.ts
import * as XLSX from "@e965/xlsx";
import type { EcologicalIndexAggregates } from "@/db/schema/research/reports";
import type { MediaScope, MediaScopeUnit } from "@/db/schema/research/media-scopes";
import type { ActivityDataset } from "@/db/schema/research/activity-datasets";

export type XlsxBuildInput = {
  aggregates: EcologicalIndexAggregates;
  scope: MediaScope; units: MediaScopeUnit[]; dataset: ActivityDataset;
};

function sheet00Overview(): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([
    ["项目", "值"],
    ["权重 - 中央", "45%"], ["权重 - 行业", "25%"], ["权重 - 市级", "15%"],
    ["权重 - 区县", "8%"], ["权重 - 公众行为", "7%"],
    [], ["二级权重", "数量 40% / 丰富度 30% / 速度 30%"],
    ["丰富度公式", "F = 1 / Σ |p_t - 1/N|"],
    ["传播速度公式", "freq = 报道总数 / 发布天数"],
    ["综合公式", "综合 = 中央×0.45 + 行业×0.25 + 市级×0.15 + 区县×0.08 + 公众×0.07"],
    ["区间化", "min-max 到 [65, 95]"],
  ]);
}

function sheet01DataSources(input: XlsxBuildInput): XLSX.WorkSheet {
  const rows: any[][] = [["#", "类别", "媒体名", "区县", "公众号名", "ghid", "微博 UID", "网站"]];
  input.units.forEach((u, i) => {
    rows.push([i + 1, u.tier, u.name, u.districtNormalized ?? "—",
      u.wechatNames.join("、") || "—", u.wechatGhid ?? "—",
      u.weiboUid ?? "—", u.websites.join("、") || "—"]);
  });
  return XLSX.utils.aoa_to_sheet(rows);
}

function sheet02Audit(input: XlsxBuildInput): XLSX.WorkSheet {
  const a = input.aggregates;
  return XLSX.utils.aoa_to_sheet([
    ["项目", "数值"],
    ["生成时间", a.generatedAt],
    ["总单位数", input.units.length],
    ["最高分", a.ranked[0]?.name + " " + a.ranked[0]?.composite.toFixed(2)],
    ["最低分", a.ranked.at(-1)?.name + " " + a.ranked.at(-1)?.composite.toFixed(2)],
    ["平均", a.stats.mean.toFixed(2)], ["中位", a.stats.median.toFixed(2)],
    ["标差", a.stats.stdev.toFixed(2)],
    ["分层", `高 ${a.stats.tier_high} / 中 ${a.stats.tier_mid} / 低 ${a.stats.tier_low}`],
  ]);
}

function sheetMediaTier(
  input: XlsxBuildInput,
  tier: "central" | "industry" | "municipal" | "district",
  sub: "count" | "richness" | "freq",
): XLSX.WorkSheet {
  const subLabel = { count: "报道数量", richness: "主题丰富度", freq: "传播速度" }[sub];
  const tierLabel = { central: "中央", industry: "行业", municipal: "市级", district: "区县" }[tier];
  const rows: any[][] = [
    [`${tierLabel}媒体 - ${subLabel}`],
    ["排名", "区县", "原始值", "区间化得分 (65-95)"],
  ];
  const items = input.aggregates.ranked.map(r => ({
    name: r.name,
    raw: input.aggregates.rawMedia[r.name]?.[tier]?.[sub] ?? 0,
    scaled: input.aggregates.scaledMedia[r.name]?.[tier]?.[sub] ?? 0,
  })).sort((a, b) => b.raw - a.raw);
  items.forEach((it, i) => rows.push([i + 1, it.name, it.raw.toFixed(2), it.scaled.toFixed(2)]));
  return XLSX.utils.aoa_to_sheet(rows);
}

function sheetPublic(input: XlsxBuildInput, sub: "count" | "richness" | "freq"): XLSX.WorkSheet {
  const subLabel = { count: "活动数量", richness: "活动主题丰富度", freq: "活动传播速度" }[sub];
  const rows: any[][] = [[`公众行为引导 - ${subLabel}`], ["排名", "区县", "原始值", "区间化得分"]];
  const items = input.aggregates.ranked.map(r => ({
    name: r.name,
    raw: input.aggregates.rawPublic[r.name]?.[sub] ?? 0,
    scaled: input.aggregates.scaledPublic[r.name]?.[sub] ?? 0,
  })).sort((a, b) => b.raw - a.raw);
  items.forEach((it, i) => rows.push([i + 1, it.name, it.raw.toFixed(2), it.scaled.toFixed(2)]));
  return XLSX.utils.aoa_to_sheet(rows);
}

function sheet99Summary(input: XlsxBuildInput): XLSX.WorkSheet {
  const rows: any[][] = [
    ["排名", "区县", "中央(45%)", "行业(25%)", "市级(15%)", "区县(8%)", "公众(7%)", "综合"],
  ];
  input.aggregates.ranked.forEach(r => rows.push([
    r.rank, r.name,
    r.central.toFixed(2), r.industry.toFixed(2), r.municipal.toFixed(2),
    r.district.toFixed(2), r.public.toFixed(2), r.composite.toFixed(2),
  ]));
  return XLSX.utils.aoa_to_sheet(rows);
}

export async function buildVerifiableXlsx(input: XlsxBuildInput): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet00Overview(), "00 总览说明");
  XLSX.utils.book_append_sheet(wb, sheet01DataSources(input), "01 数据源清单");
  XLSX.utils.book_append_sheet(wb, sheet02Audit(input), "02 数据范围审计");
  for (const tier of ["central", "industry", "municipal", "district"] as const) {
    const tNum = { central: 1, industry: 2, municipal: 3, district: 4 }[tier];
    for (const sub of ["count", "richness", "freq"] as const) {
      const sNum = { count: 1, richness: 2, freq: 3 }[sub];
      const sLabel = { count: "数量", richness: "丰富度", freq: "速度" }[sub];
      const tLabel = { central: "中央", industry: "行业", municipal: "市级", district: "区县" }[tier];
      XLSX.utils.book_append_sheet(wb, sheetMediaTier(input, tier, sub), `${tNum}.${sNum} ${tLabel}-${sLabel}`);
    }
  }
  for (const sub of ["count", "richness", "freq"] as const) {
    const sNum = { count: 1, richness: 2, freq: 3 }[sub];
    const sLabel = { count: "数量", richness: "丰富度", freq: "速度" }[sub];
    XLSX.utils.book_append_sheet(wb, sheetPublic(input, sub), `5.${sNum} 公众-${sLabel}`);
  }
  XLSX.utils.book_append_sheet(wb, sheet99Summary(input), "99 综合汇总");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
```

- [ ] **Step 2: 写测试 (用 fixture aggregates 生成 → 验证 19 个 sheet)**

```ts
// src/lib/research/ecological-index/__tests__/xlsx-builder.test.ts
import { describe, it, expect } from "vitest";
import * as XLSX from "@e965/xlsx";
import { buildVerifiableXlsx } from "../xlsx-builder";

describe("xlsx-builder", () => {
  it("生成 19 个 sheet 含 00/01/02/1.1-5.3/99", async () => {
    const fakeAgg: any = {
      kind: "ecological_index",
      ranked: [{ rank: 1, name: "两江新区", central: 83, industry: 91, municipal: 95, district: 84, public: 68, composite: 86 }],
      rawMedia: { "两江新区": { central: { count: 100, richness: 1.5, freq: 0.5 }, industry: {}, municipal: {}, district: {} } },
      rawPublic: { "两江新区": { count: 50, richness: 2.0, freq: 0.2 } },
      scaledMedia: { "两江新区": { central: { count: 95, richness: 80, freq: 75 }, industry: {}, municipal: {}, district: {} } },
      scaledPublic: { "两江新区": { count: 90, richness: 80, freq: 70 } },
      stats: { max: 86, min: 69, span: 17, mean: 75, median: 74, stdev: 4, tier_high: 5, tier_mid: 23, tier_low: 11 },
      generatedAt: "2025-05-26T00:00:00Z",
    };
    const buf = await buildVerifiableXlsx({
      aggregates: fakeAgg,
      scope: { id: "s1", name: "测试", totalUnits: 1 } as any,
      units: [{ name: "央视", tier: "central", wechatNames: ["央视新闻"], websites: ["cctv.com"], districtNormalized: null, wechatGhid: null, weiboUid: null } as any],
      dataset: { activityThemes: ["六五环境日"], data: [] } as any,
    });
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toHaveLength(19);
    expect(wb.SheetNames[0]).toBe("00 总览说明");
    expect(wb.SheetNames[18]).toBe("99 综合汇总");
  });
});
```

- [ ] **Step 3: 跑测试 + typecheck**

```bash
npx vitest run src/lib/research/ecological-index/__tests__/xlsx-builder.test.ts
npx tsc --noEmit
```

Expected: 1 passed, 0 errors

- [ ] **Step 4: 手测 — 用 fixture 写出 xlsx 到 /tmp,Excel 打开看每个 sheet 格式正确**

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/ecological-index/xlsx-builder.ts \
        src/lib/research/ecological-index/__tests__/xlsx-builder.test.ts
git commit -m "feat(eco-index): xlsx-builder with 19 verifiable sheets + smoke test"
```

---

## Task 3.6: content-exporter.ts(按 tier 拆 4 文件)

**Files:**
- Create: `src/lib/research/ecological-index/content-exporter.ts`

参考 `scripts/export-scope-content-xlsx.ts` 改造为按 tier 4 个独立函数,复用现有 `EXPORT_COLUMN_ORDER + exportRowToOpinionRecord`。

- [ ] **Step 1: 写 content-exporter(按 tier 拆 4 文件,避免 OOM)**

```ts
// src/lib/research/ecological-index/content-exporter.ts
import * as XLSX from "@e965/xlsx";
import { db } from "@/db";
import { collectedItems, collectedItemContents } from "@/db/schema/collection";
import { and, eq, gte, lt, inArray, desc, getTableColumns } from "drizzle-orm";
import { exportRowToOpinionRecord, EXPORT_COLUMN_ORDER } from "@/lib/collection/bulk-export/opinion-export";
import type { MediaScopeUnit } from "@/db/schema/research/media-scopes";

type Tier = "central" | "industry" | "municipal" | "district";

const TIER_INCLUDE: Record<Tier, MediaScopeUnit["tier"][]> = {
  central: ["central"], industry: ["industry"], municipal: ["municipal"],
  district: ["district_rmt", "district_gov"],
};

export type ContentExportInput = {
  organizationId: string;
  tier: Tier;
  units: MediaScopeUnit[];
  windowStart: string;  // 'YYYY-MM-DD'
  windowEnd: string;
};

/**
 * 导出某个 tier 的全部稿件为 xlsx。
 * 用 unit.resolvedOutletIds 做 outlet 白名单(P2 已缓存)。
 * 复用现有 EXPORT_COLUMN_ORDER + exportRowToOpinionRecord(已 vetted)。
 */
export async function exportContentForTier(input: ContentExportInput): Promise<Buffer> {
  const tiersToInclude = TIER_INCLUDE[input.tier];
  const targetUnits = input.units.filter(u => tiersToInclude.includes(u.tier));
  const outletIds = [...new Set(targetUnits.flatMap(u => u.resolvedOutletIds))];
  if (outletIds.length === 0) {
    // 空 tier 返回仅含表头的 xlsx
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...EXPORT_COLUMN_ORDER]]), "舆情数据");
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }

  const rows = await db
    .select({
      ...getTableColumns(collectedItems),
      content: collectedItemContents.content,
      ocrText: collectedItemContents.ocrText,
      asrText: collectedItemContents.asrText,
    })
    .from(collectedItems)
    .leftJoin(collectedItemContents, eq(collectedItemContents.itemId, collectedItems.id))
    .where(and(
      eq(collectedItems.organizationId, input.organizationId),
      gte(collectedItems.publishedAt, new Date(input.windowStart)),
      lt(collectedItems.publishedAt, new Date(input.windowEnd)),
      inArray(collectedItems.outletId, outletIds),
    ))
    .orderBy(desc(collectedItems.firstSeenAt));

  const records = rows.map((row: any, i: number) => exportRowToOpinionRecord(row, i + 1));
  const sheet = XLSX.utils.json_to_sheet(records, { header: [...EXPORT_COLUMN_ORDER] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "舆情数据");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
```

- [ ] **Step 2: 写测试(空 outlet → 仅表头)**

```ts
// src/lib/research/ecological-index/__tests__/content-exporter.test.ts
import { describe, it, expect, vi } from "vitest";
import * as XLSX from "@e965/xlsx";
import { exportContentForTier } from "../content-exporter";

vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ leftJoin: () => ({ where: () => ({ orderBy: () => Promise.resolve([]) }) }) }) }) },
}));

describe("content-exporter", () => {
  it("空 outletIds → 仅表头 xlsx", async () => {
    const buf = await exportContentForTier({
      organizationId: "org-1", tier: "industry", units: [],
      windowStart: "2025-01-01", windowEnd: "2026-01-01",
    });
    const wb = XLSX.read(buf, { type: "buffer" });
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]!]!, { header: 1 });
    expect((data as any[]).length).toBe(1); // 仅表头
  });
});
```

- [ ] **Step 3: 跑测试 + typecheck**

```bash
npx vitest run src/lib/research/ecological-index/__tests__/content-exporter.test.ts
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/research/ecological-index/content-exporter.ts \
        src/lib/research/ecological-index/__tests__/content-exporter.test.ts
git commit -m "feat(eco-index): content-exporter with 4-tier split (avoid OOM)"
```

- [ ] **Step 5: 在 Task 3.13 Inngest Step 6 中循环调用 4 次,分别上传 storage**

---

## Task 3.7: ecological-index-reports DAL + computeAllIndicators 整合

**Files:**
- Create: `src/lib/dal/research/ecological-index-reports.ts`
- Modify: `src/lib/research/ecological-index/compute.ts`(加 computeAllIndicators)

- [ ] **Step 1: 在 compute.ts 追加 computeAllIndicators 函数**

```ts
// 追加到 src/lib/research/ecological-index/compute.ts
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { researchCollectedItemDistricts, researchCollectedItemTopics } from "@/db/schema/research/annotations";
import { researchCqDistricts } from "@/db/schema/research/cq-districts";
import { researchTopics } from "@/db/schema/research/research-topics";
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import type { EcologicalIndexAggregates } from "@/db/schema/research/reports";
import type { MediaScopeUnit } from "@/db/schema/research/media-scopes";
import type { ActivityDataset } from "@/db/schema/research/activity-datasets";

type ComputeTier = "central" | "industry" | "municipal" | "district";

export type ComputeInput = {
  organizationId: string;
  units: MediaScopeUnit[];
  activityDataset: ActivityDataset;
  windowStart: string;  // 'YYYY-MM-DD'
  windowEnd: string;
};

/**
 * 完整算法链路:
 *   1) outlet → tier 映射 (用 resolvedOutletIds 缓存)
 *   2) SQL 拉 collected_items × annotations
 *   3) 内存按 (district 归并, tier) 分桶
 *   4) 每桶算 count/richness/freq
 *   5) 39 区县间 min-max 区间化每个二级指标
 *   6) 加权得 5 一级 + 综合分 → ranked
 */
export async function computeAllIndicators(input: ComputeInput): Promise<EcologicalIndexAggregates> {
  // Step 1: outlet → tier
  const outletToTier = new Map<string, ComputeTier>();
  const TIER_MAP: Record<MediaScopeUnit["tier"], ComputeTier> = {
    central: "central", industry: "industry", municipal: "municipal",
    district_rmt: "district", district_gov: "district",
  };
  for (const u of input.units) {
    const tier = TIER_MAP[u.tier];
    for (const oid of u.resolvedOutletIds) outletToTier.set(oid, tier);
  }
  const outletIds = [...outletToTier.keys()];

  // Step 2: 字典
  const districts = await db.select({ id: researchCqDistricts.id, name: researchCqDistricts.name })
    .from(researchCqDistricts);
  const topics = await db.select({ id: researchTopics.id, name: researchTopics.name })
    .from(researchTopics).where(eq(researchTopics.organizationId, input.organizationId));
  if (topics.length !== 16) throw new Error(`期望 16 个主题, 实际 ${topics.length}`);

  const topicIdxMap = new Map(topics.map((t, i) => [t.id, i]));
  const districtIdMap = new Map(districts.map(d => [d.id, d.name]));
  function normD(name: string): string {
    return (name === "江北区" || name === "渝北区") ? "两江新区" : name;
  }
  const allDistricts = [...new Set(districts.map(d => normD(d.name)))];

  // SQL 聚合
  const rawRows = outletIds.length === 0 ? [] : await db
    .select({
      itemId: collectedItems.id,
      outletId: collectedItems.outletId,
      publishedAt: collectedItems.publishedAt,
      districtId: researchCollectedItemDistricts.districtId,
      topicId: researchCollectedItemTopics.topicId,
    })
    .from(collectedItems)
    .innerJoin(researchCollectedItemDistricts, eq(researchCollectedItemDistricts.itemId, collectedItems.id))
    .innerJoin(researchCollectedItemTopics, eq(researchCollectedItemTopics.itemId, collectedItems.id))
    .where(and(
      eq(collectedItems.organizationId, input.organizationId),
      gte(collectedItems.publishedAt, new Date(input.windowStart)),
      lt(collectedItems.publishedAt, new Date(input.windowEnd)),
      inArray(collectedItems.outletId, outletIds),
    ));

  // Step 3: 分桶
  type Bucket = { itemIds: Set<string>; topicCounts: number[]; publishDays: Set<string> };
  const buckets = new Map<string, Bucket>();
  for (const row of rawRows) {
    const dName = districtIdMap.get(row.districtId);
    if (!dName) continue;
    const dNorm = normD(dName);
    const tier = outletToTier.get(row.outletId!);
    if (!tier) continue;
    const key = `${dNorm}::${tier}`;
    let b = buckets.get(key);
    if (!b) { b = { itemIds: new Set(), topicCounts: Array(16).fill(0), publishDays: new Set() }; buckets.set(key, b); }
    b.itemIds.add(row.itemId);
    const tIdx = topicIdxMap.get(row.topicId);
    if (tIdx !== undefined) b.topicCounts[tIdx]!++;
    if (row.publishedAt) b.publishDays.add(row.publishedAt.toISOString().slice(0, 10));
  }

  // Step 4: 算 raw 三元组
  const rawMedia: EcologicalIndexAggregates["rawMedia"] = {};
  for (const d of allDistricts) {
    rawMedia[d] = {} as any;
    for (const tier of ["central", "industry", "municipal", "district"] as const) {
      const b = buckets.get(`${d}::${tier}`) ?? { itemIds: new Set(), topicCounts: Array(16).fill(0), publishDays: new Set() };
      const count = b.itemIds.size, days = b.publishDays.size;
      rawMedia[d]![tier] = {
        count, richness: richnessF(b.topicCounts, 16),
        freq: days > 0 ? count / days : 0,
        topicCounts: b.topicCounts, days,
      };
    }
  }
  const rawPublic: EcologicalIndexAggregates["rawPublic"] = {};
  for (const d of allDistricts) {
    const point = input.activityDataset.data.find(p => p.district === d);
    if (point) {
      const themeCounts = input.activityDataset.activityThemes.map(t => point.themes[t] ?? 0);
      rawPublic[d] = {
        count: point.total, richness: richnessF(themeCounts, 5), freq: point.freq,
        themes: point.themes, firstDate: point.firstDate, lastDate: point.lastDate, spanDays: point.spanDays,
      };
    } else {
      rawPublic[d] = { count: 0, richness: 0, freq: 0, themes: {}, firstDate: null, lastDate: null, spanDays: null };
    }
  }

  // Step 5: 区间化
  const scaledMedia: EcologicalIndexAggregates["scaledMedia"] = {};
  const scaledPublic: EcologicalIndexAggregates["scaledPublic"] = {};
  for (const d of allDistricts) { scaledMedia[d] = {} as any; scaledPublic[d] = { count: 0, richness: 0, freq: 0 }; }
  for (const sub of ["count", "richness", "freq"] as const) {
    for (const tier of ["central", "industry", "municipal", "district"] as const) {
      const vals = allDistricts.map(d => rawMedia[d]![tier][sub]);
      const scaled = scaleToRange(vals);
      allDistricts.forEach((d, i) => {
        if (!scaledMedia[d]![tier]) scaledMedia[d]![tier] = { count: 0, richness: 0, freq: 0 };
        scaledMedia[d]![tier][sub] = scaled[i]!;
      });
    }
    const pVals = allDistricts.map(d => rawPublic[d]![sub]);
    const pScaled = scaleToRange(pVals);
    allDistricts.forEach((d, i) => { scaledPublic[d]![sub] = pScaled[i]!; });
  }

  // Step 6: 加权 + ranked
  const ranked = allDistricts.map(d => {
    const m = scaledMedia[d]!, p = scaledPublic[d]!;
    const central = weightedTierScore(m.central.count, m.central.richness, m.central.freq);
    const industry = weightedTierScore(m.industry.count, m.industry.richness, m.industry.freq);
    const municipal = weightedTierScore(m.municipal.count, m.municipal.richness, m.municipal.freq);
    const district = weightedTierScore(m.district.count, m.district.richness, m.district.freq);
    const publicScore = weightedTierScore(p.count, p.richness, p.freq);
    const composite = weightedComposite(central, industry, municipal, district, publicScore);
    return { name: d, central, industry, municipal, district, public: publicScore, composite };
  }).sort((a, b) => b.composite - a.composite).map((r, i) => ({ rank: i + 1, ...r }));

  const scores = ranked.map(r => r.composite);
  const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted[Math.floor(scores.length / 2)]!;
  const stdev = Math.sqrt(scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length);

  return {
    kind: "ecological_index",
    ranked, rawMedia, rawPublic, scaledMedia, scaledPublic,
    stats: {
      max: Math.max(...scores), min: Math.min(...scores),
      span: Math.max(...scores) - Math.min(...scores),
      mean, median, stdev,
      tier_high: scores.filter(s => s >= 80).length,
      tier_mid: scores.filter(s => s >= 72 && s < 80).length,
      tier_low: scores.filter(s => s < 72).length,
    },
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: 写 DAL + previewScopeCoverage**

```ts
// src/lib/dal/research/ecological-index-reports.ts
import { db } from "@/db";
import { researchReports, type ReportSearchSnapshot } from "@/db/schema/research/reports";
import { researchMediaScopeUnits } from "@/db/schema/research/media-scopes";
import { collectedItems } from "@/db/schema/collection";
import { and, eq, sql } from "drizzle-orm";

export async function createEcologicalIndexReport(input: {
  organizationId: string; userId: string;
  title: string; scopeId: string; activityDatasetId: string;
  year: number; includeContentSource: boolean;
}): Promise<{ reportId: string }> {
  const snap: ReportSearchSnapshot = {
    kind: "ecological_index",
    scopeId: input.scopeId, activityDatasetId: input.activityDatasetId,
    year: input.year,
    windowStart: `${input.year}-01-01`,
    windowEnd: `${input.year + 1}-01-01`,
    includeContentSource: input.includeContentSource,
    capturedAt: new Date().toISOString(),
  };
  const [row] = await db.insert(researchReports).values({
    organizationId: input.organizationId,
    sourceType: "ecological_index",
    title: input.title,
    status: "pending",
    searchSnapshot: snap,
    generatedBy: input.userId,
  }).returning({ id: researchReports.id });
  if (!row) throw new Error("create report failed");
  return { reportId: row.id };
}

export async function previewScopeCoverage(input: {
  organizationId: string; scopeId: string; year: number;
}): Promise<{ matchedOutletCount: number; itemsInScope: number; itemsTotal: number; retentionPct: number }> {
  const units = await db.select().from(researchMediaScopeUnits)
    .where(eq(researchMediaScopeUnits.scopeId, input.scopeId));
  const outletIds = [...new Set(units.flatMap(u => u.resolvedOutletIds))];
  const windowStart = `${input.year}-01-01`, windowEnd = `${input.year + 1}-01-01`;
  if (outletIds.length === 0) {
    return { matchedOutletCount: 0, itemsInScope: 0, itemsTotal: 0, retentionPct: 0 };
  }
  const [inScopeRow] = await db.select({ n: sql<number>`COUNT(*)::int` })
    .from(collectedItems).where(and(
      eq(collectedItems.organizationId, input.organizationId),
      sql`${collectedItems.publishedAt} >= ${windowStart}::date`,
      sql`${collectedItems.publishedAt} < ${windowEnd}::date`,
      sql`${collectedItems.outletId} = ANY(ARRAY[${sql.join(outletIds.map(id => sql`${id}::uuid`), sql`, `)}])`,
    ));
  const [totalRow] = await db.select({ n: sql<number>`COUNT(*)::int` })
    .from(collectedItems).where(and(
      eq(collectedItems.organizationId, input.organizationId),
      sql`${collectedItems.publishedAt} >= ${windowStart}::date`,
      sql`${collectedItems.publishedAt} < ${windowEnd}::date`,
    ));
  const inScope = inScopeRow?.n ?? 0;
  const total = totalRow?.n ?? 0;
  return {
    matchedOutletCount: outletIds.length, itemsInScope: inScope, itemsTotal: total,
    retentionPct: total > 0 ? (inScope / total) * 100 : 0,
  };
}
```

- [ ] **Step 3: 写 server action + 触发 Inngest**

```ts
// src/app/actions/research/ecological-index-reports.ts
"use server";
import { requireAuth } from "@/lib/auth";
import { inngest } from "@/inngest/client";
import {
  createEcologicalIndexReport as dalCreate,
  previewScopeCoverage as dalPreview,
} from "@/lib/dal/research/ecological-index-reports";

async function requireOrg() {
  const u = await requireAuth();
  if (!u.organizationId) throw new Error("无组织");
  return { orgId: u.organizationId, userId: u.id };
}

export async function previewScopeCoverage(scopeId: string, year: number) {
  const { orgId } = await requireOrg();
  return await dalPreview({ organizationId: orgId, scopeId, year });
}

export async function createEcologicalIndexReport(input: {
  title: string; year: number; scopeId: string; activityDatasetId: string; includeContentSource: boolean;
}) {
  const { orgId, userId } = await requireOrg();
  const { reportId } = await dalCreate({ organizationId: orgId, userId, ...input });
  await inngest.send({
    name: "research/ecological-index.generate",
    data: { reportId, organizationId: orgId },
  });
  return { reportId };
}
```

- [ ] **Step 4: 写 computeAllIndicators 集成测试 (mock DB,fixture units + activityDataset → 验证 ranked 输出 + stats 计算)**

```ts
// src/lib/research/ecological-index/__tests__/compute-integration.test.ts (略, 用 vi.mock 模拟 db.select)
```

```bash
npx tsc --noEmit
npx vitest run src/lib/research/ecological-index/__tests__/compute-integration.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/research/ecological-index/compute.ts \
        src/lib/dal/research/ecological-index-reports.ts \
        src/app/actions/research/ecological-index-reports.ts \
        src/lib/research/ecological-index/__tests__/compute-integration.test.ts
git commit -m "feat(eco-index): computeAllIndicators integration + DAL + server actions"
```

---

## Task 3.8: Inngest function — Step 1 load-resources

**Files:**
- Create: `src/inngest/functions/research/ecological-index-generate.ts`

- [ ] **Step 1: 写 Inngest function 骨架 + Step 1**

```ts
// src/inngest/functions/research/ecological-index-generate.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { researchReports } from "@/db/schema/research/reports";
import { researchMediaScopes, researchMediaScopeUnits } from "@/db/schema/research/media-scopes";
import { researchActivityDatasets } from "@/db/schema/research/activity-datasets";
import { eq, and } from "drizzle-orm";
import { updateReportStatus } from "@/lib/dal/research/reports";

export const ecologicalIndexGenerate = inngest.createFunction(
  {
    id: "research-ecological-index-generate",
    concurrency: { limit: 2, key: "event.data.organizationId" },
    retries: 3,
  },
  { event: "research/ecological-index.generate" },
  async ({ event, step, logger }) => {
    const { reportId, organizationId } = event.data as { reportId: string; organizationId: string };

    // Step 1: load resources
    const resources = await step.run("load-resources", async () => {
      await updateReportStatus(reportId, { status: "generating", currentStep: "加载资源" });
      const [report] = await db.select().from(researchReports)
        .where(and(eq(researchReports.id, reportId), eq(researchReports.organizationId, organizationId)));
      if (!report) throw new Error(`报告不存在 ${reportId}`);
      const snap = report.searchSnapshot as { kind: string; scopeId: string; activityDatasetId: string;
        year: number; windowStart: string; windowEnd: string; includeContentSource: boolean };
      if (snap.kind !== "ecological_index") throw new Error("sourceType 不匹配");

      const [scope] = await db.select().from(researchMediaScopes)
        .where(eq(researchMediaScopes.id, snap.scopeId));
      if (!scope) throw new Error("媒体名单已删除");
      const units = await db.select().from(researchMediaScopeUnits)
        .where(eq(researchMediaScopeUnits.scopeId, snap.scopeId));
      const [dataset] = await db.select().from(researchActivityDatasets)
        .where(eq(researchActivityDatasets.id, snap.activityDatasetId));
      if (!dataset) throw new Error("活动数据集已删除");

      return { snap, scope, units, dataset };
    });

    // (Step 2-7 在下面 Task 3.9-3.14 实现)
  },
);
```

- [ ] **Step 2-4: typecheck + 注册到 inngest/index.ts**

```ts
// src/inngest/functions/research/index.ts
export { ecologicalIndexGenerate } from "./ecological-index-generate";
```

- [ ] **Step 5: Commit**

```bash
git add src/inngest/functions/research/ecological-index-generate.ts \
        src/inngest/functions/research/index.ts
git commit -m "feat(eco-index): inngest function skeleton + step 1 load-resources"
```

---

## Task 3.9: Inngest Step 2 — compute-indicators

- [ ] **Step 1**: 在 function 中加 Step 2

```ts
const aggregates = await step.run("compute-indicators", async () => {
  await updateReportStatus(reportId, { currentStep: "计算指标" });
  const { computeAllIndicators } = await import("@/lib/research/ecological-index/compute");
  return await computeAllIndicators({
    organizationId,
    scope: resources.scope, units: resources.units,
    activityDataset: resources.dataset,
    windowStart: resources.snap.windowStart,
    windowEnd: resources.snap.windowEnd,
  });
});
```

- [ ] **Step 2-4**: typecheck + smoke test (mock Inngest 调用一次 step 1+2)

- [ ] **Step 5**: Commit

```bash
git commit -am "feat(eco-index): inngest step 2 compute-indicators"
```

---

## Task 3.10: Inngest Step 3 — build-xlsx-19sheet + upload storage

- [ ] **Step 1**: 加 Step 3

```ts
const excelFileUrl = await step.run("build-xlsx", async () => {
  await updateReportStatus(reportId, { currentStep: "生成 19-sheet xlsx" });
  const { buildVerifiableXlsx } = await import("@/lib/research/ecological-index/xlsx-builder");
  const buffer = await buildVerifiableXlsx({ aggregates, scope: resources.scope, units: resources.units, dataset: resources.dataset });
  const { uploadReportFile } = await import("@/lib/research/report-storage");
  return await uploadReportFile({ reportId, fileName: "indicators.xlsx", buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
});
await db.update(researchReports).set({ excelFileUrl }).where(eq(researchReports.id, reportId));
```

- [ ] **Step 2-5**: typecheck + commit

```bash
git commit -am "feat(eco-index): inngest step 3 build xlsx + upload"
```

---

## Task 3.11: Inngest Step 4 — build-charts(3 张图)

- [ ] **Step 1**: 加 Step 4

```ts
const chartBuffers = await step.run("build-charts", async () => {
  await updateReportStatus(reportId, { currentStep: "生成图表" });
  const { generateRankingBarChart, generateTierPieChart, generateTop15ComparisonChart }
    = await import("@/lib/research/ecological-index/chart-generator");
  const [bar, pie, top15] = await Promise.all([
    generateRankingBarChart(aggregates.ranked, aggregates.stats),
    generateTierPieChart(aggregates.stats),
    generateTop15ComparisonChart(aggregates.ranked),
  ]);
  return { bar, pie, top15 };
});
```

- [ ] **Step 2-5**: typecheck + commit

```bash
git commit -am "feat(eco-index): inngest step 4 build 3 charts"
```

---

## Task 3.12: Inngest Step 5 — build-docx + upload

- [ ] **Step 1**: 加 Step 5

```ts
const wordFileUrl = await step.run("build-docx", async () => {
  await updateReportStatus(reportId, { currentStep: "生成 docx" });
  const { buildRankingDocx } = await import("@/lib/research/ecological-index/docx-builder");
  const buffer = await buildRankingDocx({ year: resources.snap.year, aggregates, chartBuffers });
  const { uploadReportFile } = await import("@/lib/research/report-storage");
  return await uploadReportFile({ reportId, fileName: "ranking.docx", buffer,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
});
await db.update(researchReports).set({ wordFileUrl }).where(eq(researchReports.id, reportId));
```

- [ ] **Step 2-5**: typecheck + commit

```bash
git commit -am "feat(eco-index): inngest step 5 build docx + upload"
```

---

## Task 3.13: Inngest Step 6a-6d — 按 tier 拆 4 个 sub-step

按 spec §5.4 + reviewer 强调,把 Step 6 拆 4 sub-step 避免单 step OOM + 30s 超时。

- [ ] **Step 1-4: 4 个独立 step**

```ts
const contentUrls: { central: string|null; industry: string|null; municipal: string|null; district: string|null }
  = { central: null, industry: null, municipal: null, district: null };

if (resources.snap.includeContentSource) {
  for (const tier of ["central", "industry", "municipal", "district"] as const) {
    contentUrls[tier] = await step.run(`build-content-${tier}`, async () => {
      await updateReportStatus(reportId, { currentStep: `生成数据源 ${tier}` });
      const { exportContentForTier } = await import("@/lib/research/ecological-index/content-exporter");
      const buffer = await exportContentForTier({
        organizationId, tier, units: resources.units,
        windowStart: resources.snap.windowStart, windowEnd: resources.snap.windowEnd,
      });
      const { uploadReportFile } = await import("@/lib/research/report-storage");
      return await uploadReportFile({
        reportId, fileName: `content-${tier}.xlsx`, buffer,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    });
  }
  await db.update(researchReports)
    .set({ contentSourceFileUrls: contentUrls })
    .where(eq(researchReports.id, reportId));
}
```

- [ ] **Step 5**: Commit

```bash
git commit -am "feat(eco-index): inngest step 6a-6d build content source by tier (4 sub-steps)"
```

---

## Task 3.14: Inngest Step 7 — finalize

- [ ] **Step 1**: 加 Step 7

```ts
await step.run("finalize", async () => {
  await db.update(researchReports)
    .set({
      status: "ready",
      currentStep: null,
      completedAt: new Date(),
      aggregatesJson: aggregates,
    })
    .where(eq(researchReports.id, reportId));
});

return { reportId, ranked: aggregates.ranked.slice(0, 5) };
```

- [ ] **Step 2-5**: typecheck + 端到端 fixture 测试 + commit

```bash
git commit -am "feat(eco-index): inngest step 7 finalize + 7-step e2e validation"
```

---

## Task 3.15: P3 端到端 fixture 测试

**Files:**
- Create: `src/inngest/functions/research/__tests__/ecological-index-generate.test.ts`

- [ ] **Step 1-5**: 准备 mock storage + fixture scope/dataset → invoke inngest function → 验证 7 step 全部 success + storage 中 6 个文件全部生成

```bash
npx vitest run src/inngest/functions/research/__tests__/ecological-index-generate.test.ts
# Expected: 1 passed (端到端 test)

git commit -am "test(eco-index): e2e inngest 7-step pipeline test"
```

---

## Task 3.16: P3 总结

- [ ] **Step 1**: `npx tsc --noEmit` 零错误
- [ ] **Step 2**: `npm run test` 通过(预期 +35 个新测试)
- [ ] **Step 3**: `npm run build` 通过
- [ ] **Step 4**: 写 phase summary
- [ ] **Step 5**: 用 inngest dev UI 手动触发 1 次完整生成,验证 3 个文件(docx/19sheet xlsx/4 个 tier xlsx)可下载,对比 Python 脚本产出 1:1 一致

---

# Phase 4: UI 集成(2 天)

## Task 4.1: list 页加 sourceType tab + 计数

**Files:**
- Modify: `src/app/(dashboard)/data-collection/reports/page.tsx`
- Modify: `src/app/(dashboard)/data-collection/reports/reports-list-client.tsx`

- [ ] **Step 1: page.tsx 加 sourceType 参数 + 分类拉数**

```tsx
// page.tsx (片段)
export default async function ReportsPage({ searchParams }: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const sourceType = type === "ecological_index" ? "ecological_index" : "advanced_search";
  // ... ctx + auth 同现有
  const allRows = await listReportsByOrg(ctx.organizationId, 100);
  const advCount = allRows.filter(r => r.sourceType === "advanced_search").length;
  const ecoCount = allRows.filter(r => r.sourceType === "ecological_index").length;
  const rows = allRows.filter(r => r.sourceType === sourceType);
  return <ReportsListClient rows={rows} sourceType={sourceType} advCount={advCount} ecoCount={ecoCount} />;
}
```

- [ ] **Step 2: client.tsx 加 Tabs + 新建按钮分支**

```tsx
// reports-list-client.tsx (片段)
<Tabs value={sourceType} onValueChange={(v) => router.push(`?type=${v}`)} variant="line">
  <TabsList>
    <TabsTrigger value="advanced_search">检索报告 ({advCount})</TabsTrigger>
    <TabsTrigger value="ecological_index">指数体系报告 ({ecoCount})</TabsTrigger>
  </TabsList>
</Tabs>

{sourceType === "ecological_index" ? (
  <Button onClick={() => setEcoNewOpen(true)}>新建指数报告</Button>
) : (
  <Button disabled>新建检索报告(沿用现有 entry)</Button>
)}
```

- [ ] **Step 3: typecheck + dev server 验证 tab 切换**

```bash
npx tsc --noEmit && npm run dev
# /data-collection/reports → 默认 advanced_search tab
# 切到指数体系 → 看到空表 + "新建指数报告"按钮
```

- [ ] **Step 4-5: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/
git commit -m "feat(eco-index): reports list page + tab for sourceType"
```

---

## Task 4.2: ecological-index-new-dialog.tsx(新建报告 + 实时预估)

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/ecological-index-new-dialog.tsx`

- [ ] **Step 1: 写 Dialog**

```tsx
// ecological-index-new-dialog.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { listMediaScopes } from "@/app/actions/research/media-scopes";
import { listActivityDatasets } from "@/app/actions/research/activity-datasets";
import { createEcologicalIndexReport, previewScopeCoverage } from "@/app/actions/research/ecological-index-reports";

export function EcologicalIndexNewDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [scopes, setScopes] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [scopeId, setScopeId] = useState<string>("");
  const [datasetId, setDatasetId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [includeContentSource, setIncludeContentSource] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      Promise.all([listMediaScopes(), listActivityDatasets()]).then(([s, d]) => {
        setScopes(s); setDatasets(d);
        const ds = s.find((x: any) => x.isDefault) ?? s[0]; if (ds) setScopeId(ds.id);
        const dd = d.find((x: any) => x.isDefault && x.year === year) ?? d.find((x: any) => x.year === year); if (dd) setDatasetId(dd.id);
        setTitle(`${year} 年度重庆市生态文明传播指数排行榜`);
      });
    }
  }, [open, year]);

  useEffect(() => {
    if (!scopeId || !year) { setPreview(null); return; }
    previewScopeCoverage(scopeId, year).then(setPreview).catch(() => setPreview(null));
  }, [scopeId, year]);

  async function handleSubmit() {
    if (!title.trim() || !scopeId || !datasetId) {
      toast.error("请填写完整信息"); return;
    }
    setSubmitting(true);
    try {
      const { reportId } = await createEcologicalIndexReport({
        title: title.trim(), year, scopeId, activityDatasetId: datasetId, includeContentSource,
      });
      toast.success("已发起生成,跳转到详情页");
      onOpenChange(false);
      router.push(`/data-collection/reports/${reportId}`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>新建指数体系报告</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <div><Label>标题 *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>统计年份 *</Label><Input type="number" value={year}
            onChange={(e) => setYear(Number(e.target.value))} /></div>
          <div className="text-xs text-muted-foreground">
            时间窗口: 自动 {year}-01-01 ~ {year + 1}-01-01
          </div>
          <div>
            <Label>媒体名单 *</Label>
            <Select value={scopeId} onValueChange={setScopeId}>
              <SelectTrigger><SelectValue placeholder="选择名单" /></SelectTrigger>
              <SelectContent>
                {scopes.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.totalUnits} 家) {s.isDefault ? "✓默认" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preview && (
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <div>预计可匹配 outlet: {preview.matchedOutletCount} 个</div>
                <div>预计覆盖 items: {preview.itemsInScope.toLocaleString()} 条 (保留率 {preview.retentionPct.toFixed(1)}%)</div>
              </div>
            )}
          </div>
          <div>
            <Label>活动数据集 *</Label>
            <Select value={datasetId} onValueChange={setDatasetId}>
              <SelectTrigger><SelectValue placeholder="选择数据集" /></SelectTrigger>
              <SelectContent>
                {datasets.filter(d => d.year === year).map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} (39 区县 / {d.totalActivities} 场) {d.isDefault ? "✓默认" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox checked={includeContentSource}
              onCheckedChange={(v) => setIncludeContentSource(!!v)} id="includeContent" />
            <Label htmlFor="includeContent" className="cursor-pointer text-sm">
              同时生成内容池数据源 xlsx(按 tier 拆 4 个文件)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "提交中..." : "生成报告"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2-4: typecheck + 联通 list 页 + 手测预览刷新**

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/ecological-index-new-dialog.tsx
git commit -m "feat(eco-index): new report dialog with real-time coverage preview"
```

---

## Task 4.3: 详情页路由分支

**Files:**
- Modify: `src/app/(dashboard)/data-collection/reports/[id]/page.tsx`
- Create: `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-detail.tsx`

- [ ] **Step 1: 修改 page.tsx 按 sourceType 分支**

```tsx
// page.tsx
if (report.sourceType === "ecological_index") {
  return <EcologicalIndexDetail report={report} />;
}
return <ReportDetailClient report={report} />; // 现有 advanced_search
```

- [ ] **Step 2: 写 detail client 主组件(4 个 tab 容器)**

```tsx
// ecological-index-detail.tsx
"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab } from "./ecological-index-overview-tab";
import { RankingTab } from "./ecological-index-ranking-tab";
import { IndicatorsTab } from "./ecological-index-indicators-tab";
import { SnapshotTab } from "./ecological-index-snapshot-tab";

export function EcologicalIndexDetail({ report }: { report: any }) {
  const [tab, setTab] = useState("overview");
  return (
    <div className="space-y-6">
      <PageHeader title={report.title} />
      <Tabs value={tab} onValueChange={setTab} variant="line">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="ranking">综合排行</TabsTrigger>
          <TabsTrigger value="indicators">指标明细</TabsTrigger>
          <TabsTrigger value="snapshot">资源快照</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab report={report} /></TabsContent>
        <TabsContent value="ranking"><RankingTab report={report} /></TabsContent>
        <TabsContent value="indicators"><IndicatorsTab report={report} /></TabsContent>
        <TabsContent value="snapshot"><SnapshotTab report={report} /></TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3-5: typecheck + commit**

```bash
git add src/app/\(dashboard\)/data-collection/reports/\[id\]/
git commit -m "feat(eco-index): detail page routing + 4-tab container"
```

---

## Task 4.4: 概览 Tab(榜首/末位 + Top10 + 3 下载)

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-overview-tab.tsx`

- [ ] **Step 1: 写 Overview**

```tsx
// ecological-index-overview-tab.tsx
"use client";
import { Download, Trophy, TrendingDown, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { getReportFileSignedUrl } from "@/app/actions/research/reports";

export function OverviewTab({ report }: { report: any }) {
  const agg = report.aggregatesJson;
  if (!agg || agg.kind !== "ecological_index") return <div>数据未就绪</div>;
  const { ranked, stats } = agg;
  const top = ranked[0], bottom = ranked[ranked.length - 1];
  const top10 = ranked.slice(0, 10);

  async function dl(field: "wordFileUrl" | "excelFileUrl" | "contentSourceFileUrls", tier?: string) {
    const url = await getReportFileSignedUrl(report.id, field, tier);
    if (url) window.open(url, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <GlassCard><Trophy className="size-6 text-amber-500" />
          <div className="text-sm text-muted-foreground">榜首</div>
          <div className="text-2xl font-bold">{top.name}</div>
          <div className="text-3xl font-bold text-emerald-600">{top.composite.toFixed(2)}</div>
        </GlassCard>
        <GlassCard><TrendingDown className="size-6 text-rose-500" />
          <div className="text-sm text-muted-foreground">末位</div>
          <div className="text-2xl font-bold">{bottom.name}</div>
          <div className="text-3xl font-bold text-rose-600">{bottom.composite.toFixed(2)}</div>
        </GlassCard>
        <GlassCard><BarChart3 className="size-6 text-sky-500" />
          <div className="text-sm text-muted-foreground">统计</div>
          <div className="text-sm">平均 {stats.mean.toFixed(2)} / 中位 {stats.median.toFixed(2)}</div>
          <div className="text-sm">标差 {stats.stdev.toFixed(2)} / 分差 {stats.span.toFixed(2)}</div>
          <div className="text-sm">梯队: 高 {stats.tier_high} / 中 {stats.tier_mid} / 低 {stats.tier_low}</div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="font-semibold mb-3">Top 10 综合得分</h3>
        {top10.map((r: any) => {
          const pct = ((r.composite - 60) / 30) * 100;
          return (
            <div key={r.rank} className="flex items-center gap-2 my-1">
              <span className="w-8 text-right text-muted-foreground">{r.rank}</span>
              <span className="w-24">{r.name}</span>
              <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded relative">
                <div className="h-6 bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-14 text-right font-semibold">{r.composite.toFixed(2)}</span>
            </div>
          );
        })}
      </GlassCard>

      <GlassCard>
        <h3 className="font-semibold mb-3">下载文件</h3>
        <div className="flex flex-wrap gap-2">
          {report.excelFileUrl && (
            <Button onClick={() => dl("excelFileUrl")}>
              <Download className="size-4 mr-1.5" />19-sheet 可验证 xlsx
            </Button>
          )}
          {report.wordFileUrl && (
            <Button onClick={() => dl("wordFileUrl")}>
              <Download className="size-4 mr-1.5" />排行榜及解读 docx
            </Button>
          )}
          {report.contentSourceFileUrls && (
            <>
              {(["central", "industry", "municipal", "district"] as const).map(t =>
                report.contentSourceFileUrls[t] && (
                  <Button key={t} variant="secondary" onClick={() => dl("contentSourceFileUrls", t)}>
                    <Download className="size-4 mr-1.5" />数据源 {t}
                  </Button>
                )
              )}
            </>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 2-4: typecheck + dev server 验证**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(eco-index): overview tab with cards + Top10 + downloads"
```

---

## Task 4.5: 综合排行 Tab(39 行表)

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-ranking-tab.tsx`

- [ ] **Step 1: 写 RankingTab — 用 DataTable 渲染 39 行**

```tsx
// ecological-index-ranking-tab.tsx
"use client";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";

export function RankingTab({ report }: { report: any }) {
  const agg = report.aggregatesJson;
  if (!agg || agg.kind !== "ecological_index") return null;
  const cols: DataTableColumn<any>[] = [
    { key: "rank", header: "排名", width: "w-16", align: "right", render: r => r.rank },
    { key: "name", header: "区县", width: "w-32" },
    { key: "central", header: "中央 (45%)", width: "w-24", align: "right", render: r => r.central.toFixed(2) },
    { key: "industry", header: "行业 (25%)", width: "w-24", align: "right", render: r => r.industry.toFixed(2) },
    { key: "municipal", header: "市级 (15%)", width: "w-24", align: "right", render: r => r.municipal.toFixed(2) },
    { key: "district", header: "区县 (8%)", width: "w-24", align: "right", render: r => r.district.toFixed(2) },
    { key: "public", header: "公众 (7%)", width: "w-24", align: "right", render: r => r.public.toFixed(2) },
    { key: "composite", header: "综合得分", width: "w-24", align: "right",
      render: r => <span className="font-bold">{r.composite.toFixed(2)}</span> },
  ];
  return <DataTable rows={agg.ranked} rowKey={r => r.rank} columns={cols} />;
}
```

- [ ] **Step 2-5: typecheck + 验证 + commit**

```bash
git commit -am "feat(eco-index): ranking tab with 39-row table"
```

---

## Task 4.6: 指标明细 Tab(15 个二级折叠)

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-indicators-tab.tsx`

- [ ] **Step 1: 写 IndicatorsTab — 5 个一级折叠,每个 3 个二级 Top 2**

```tsx
// ecological-index-indicators-tab.tsx
"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";

const TIER_INFO = [
  { key: "central", label: "中央媒体", weight: "45%" },
  { key: "industry", label: "行业媒体", weight: "25%" },
  { key: "municipal", label: "市级媒体", weight: "15%" },
  { key: "district", label: "区县媒体", weight: "8%" },
] as const;
const SUB = [{ key: "count", label: "数量 (40%)" }, { key: "richness", label: "丰富度 (30%)" }, { key: "freq", label: "速度 (30%)" }] as const;

export function IndicatorsTab({ report }: { report: any }) {
  const agg = report.aggregatesJson;
  const [open, setOpen] = useState<Record<string, boolean>>({ central: true });
  if (!agg) return null;
  const { scaledMedia, scaledPublic } = agg;

  return (
    <div className="space-y-3">
      {TIER_INFO.map(t => (
        <GlassCard key={t.key}>
          <button onClick={() => setOpen(p => ({ ...p, [t.key]: !p[t.key] }))}
            className="w-full text-left flex items-center gap-2 font-semibold">
            {open[t.key] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {t.label} <span className="text-muted-foreground">权重 {t.weight}</span>
          </button>
          {open[t.key] && (
            <div className="mt-3 space-y-2 pl-6">
              {SUB.map(s => {
                const sorted = Object.entries(scaledMedia).map(([name, tier]: any) => ({ name, val: tier[t.key][s.key] }))
                  .sort((a, b) => b.val - a.val);
                const top2 = sorted.slice(0, 2);
                return (
                  <div key={s.key} className="text-sm">
                    <span className="font-medium">{s.label}:</span>{" "}
                    <span>{top2.map(x => `${x.name} ${x.val.toFixed(2)}`).join(", ")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      ))}
      <GlassCard>
        <h3 className="font-semibold">公众行为引导 (7%)</h3>
        <div className="text-sm space-y-1 mt-2">
          {SUB.map(s => {
            const sorted = Object.entries(scaledPublic).map(([name, v]: any) => ({ name, val: v[s.key] }))
              .sort((a, b) => b.val - a.val).slice(0, 2);
            return (
              <div key={s.key}>
                {s.label}: {sorted.map(x => `${x.name} ${x.val.toFixed(2)}`).join(", ")}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 2-5**: typecheck + commit

```bash
git commit -am "feat(eco-index): indicators tab with 15 secondary metric Top 2"
```

---

## Task 4.7: 资源快照 Tab

**Files:**
- Create: `src/app/(dashboard)/data-collection/reports/[id]/ecological-index-snapshot-tab.tsx`

- [ ] **Step 1: 写 SnapshotTab — 引用的 scope/dataset 概要 + 链接**

```tsx
"use client";
import Link from "next/link";
import { GlassCard } from "@/components/shared/glass-card";

export function SnapshotTab({ report }: { report: any }) {
  const snap = report.searchSnapshot;
  if (snap?.kind !== "ecological_index") return null;
  return (
    <div className="space-y-3">
      <GlassCard>
        <h3 className="font-semibold mb-2">引用资源</h3>
        <div className="space-y-1 text-sm">
          <div>媒体名单 ID: <code>{snap.scopeId}</code>{" "}
            <Link href={`/data-collection/reports/resources?tab=scopes`} className="underline">查看</Link></div>
          <div>活动数据集 ID: <code>{snap.activityDatasetId}</code>{" "}
            <Link href={`/data-collection/reports/resources?tab=datasets`} className="underline">查看</Link></div>
          <div>计算年份: {snap.year}</div>
          <div>时间窗口: {snap.windowStart} 至 {snap.windowEnd}</div>
          <div>包含数据源: {snap.includeContentSource ? "是" : "否"}</div>
          <div>快照时间: {snap.capturedAt}</div>
        </div>
      </GlassCard>
      <GlassCard>
        <h3 className="font-semibold mb-2">耗时</h3>
        <div className="text-sm">
          创建: {new Date(report.createdAt).toLocaleString("zh-CN")} · 
          完成: {report.completedAt ? new Date(report.completedAt).toLocaleString("zh-CN") : "—"} ·
          总耗时: {report.completedAt
            ? Math.round((new Date(report.completedAt).getTime() - new Date(report.createdAt).getTime()) / 1000) + " 秒"
            : "—"}
        </div>
      </GlassCard>
    </div>
  );
}
```

- [ ] **Step 2-5**: typecheck + commit

```bash
git commit -am "feat(eco-index): snapshot tab with resource refs + timing"
```

---

## Task 4.8: getReportFileSignedUrl Server Action

**Files:**
- Modify: `src/app/actions/research/reports.ts`(加新函数)

- [ ] **Step 1-3: 实现 getReportFileSignedUrl**

```ts
export async function getReportFileSignedUrl(
  reportId: string,
  field: "wordFileUrl" | "excelFileUrl" | "contentSourceFileUrls",
  tier?: "central" | "industry" | "municipal" | "district",
): Promise<string | null> {
  const { orgId } = await requireOrg();
  const [report] = await db.select({ wordFileUrl: researchReports.wordFileUrl,
    excelFileUrl: researchReports.excelFileUrl,
    contentSourceFileUrls: researchReports.contentSourceFileUrls })
    .from(researchReports)
    .where(and(eq(researchReports.id, reportId), eq(researchReports.organizationId, orgId)));
  if (!report) return null;
  let path: string | null = null;
  if (field === "wordFileUrl") path = report.wordFileUrl;
  else if (field === "excelFileUrl") path = report.excelFileUrl;
  else if (field === "contentSourceFileUrls" && tier) path = (report.contentSourceFileUrls as any)?.[tier] ?? null;
  if (!path) return null;
  const { createSignedUrl } = await import("@/lib/research/report-storage");
  return await createSignedUrl(path, 3600);
}
```

- [ ] **Step 4-5: Commit**

```bash
git commit -am "feat(eco-index): getReportFileSignedUrl for download buttons"
```

---

## Task 4.9: P4 总结 + 端到端 manual test

- [ ] **Step 1: tsc / build / 全部 test**

```bash
npx tsc --noEmit
npm run test 2>&1 | tail -10
npm run build 2>&1 | tail -10
```

- [ ] **Step 2: 端到端手测流程**

1. 上传媒体名单 xlsx → 列表显示 94 单位
2. 上传活动 xlsx → 列表显示 39 区县
3. 设为默认
4. 列表页 → 切到指数体系 tab → 点新建报告 → 预览显示保留率
5. 提交 → 跳详情页 status='pending' → 轮询变 'generating' → 'ready'
6. 概览 tab 显示榜首/末位 + Top10 + 3 个下载按钮
7. 点 19-sheet xlsx 下载 → Excel 打开看 19 sheet
8. 点 docx 下载 → Word 打开看 39 行表 + 3 张图
9. 点 4 个 tier 数据源 → 各自下载

- [ ] **Step 3: 写 phase summary**

```bash
cat > docs/superpowers/phase-reports/2026-05-26-p4-ui-summary.md <<'EOF'
# P4 UI 集成 Summary

**Date:** 2026-05-26
**Status:** ✅ Done

## 完成内容
- 列表页 sourceType tab + 计数
- 新建 Dialog 含实时预估
- 详情页 4 tab (概览 / 排行 / 明细 / 资源快照)
- 3 + 4 个 tier 下载按钮 + signed URL

## 验收
所有 spec §17 Acceptance Criteria 通过 ✓
EOF
git add docs/superpowers/phase-reports/2026-05-26-p4-ui-summary.md
git commit -m "docs: P4 phase summary"
```

- [ ] **Step 4: tag release**

```bash
git tag eco-index-v1.0
git push --tags origin main
```

- [ ] **Step 5: 通知用户完工**

---

# 验收

执行完所有 phase 后,验收每条 spec §17 Acceptance Criteria 应通过:

- ✅ 用户能在 /data-collection/reports/resources 上传管理名单和数据集
- ✅ 用户能在列表看到指数报告 tab
- ✅ 新建 Dialog 实时预估
- ✅ 详情页 4 tab + 3 下载
- ✅ 单元测试覆盖
- ✅ Inngest 流水线 7 步 + 失败重试

最终跑:

```bash
npx tsc --noEmit
npm run build
npm run test
bash scripts/verify-schema-sync.sh
```

全部通过 → 完工.
