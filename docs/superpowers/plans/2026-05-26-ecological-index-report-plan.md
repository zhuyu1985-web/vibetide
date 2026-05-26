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

## Task 2.4-2.7: activity-datasets DAL + Server Actions + UI

(同 Task 2.3 模式,简化记录,实际执行同 P2 节奏)

**Files:** activity-datasets.ts DAL + actions + scope-detail-drawer / dataset-detail-drawer / upload dialogs / resources-client / page.tsx

每 Task 同样按 5 step: 写测试 → 验证失败 → 实现 → 通过 → commit

详见执行时按 Task 2.3 范本扩展。

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

## Task 2.9-2.12: 资源管理 UI 完善

- 2.9: scopes-tab.tsx + upload dialog
- 2.10: scope-detail-drawer.tsx (按 tier 分组列 units)
- 2.11: datasets-tab.tsx + upload dialog
- 2.12: dataset-detail-drawer.tsx

每个按 5-step bite-sized 走，最终 P2 结束应能：
- 上传名单 → 看到 94 单位 + 5 tier 分布
- 上传活动表 → 看到 39 区县 + 5 主题
- 设默认 / 删除 / 查看详情都通

---

## Task 2.13: P2 总结

- [ ] tsc + build + 全部 test + 写 phase summary + commit

---

# Phase 3: 计算引擎(3 天)

## Task 3.1: matcher.ts(unit → outlet_id 反查)

**Files:**
- Create: `src/lib/research/ecological-index/matcher.ts`
- Create: `src/lib/research/ecological-index/__tests__/matcher.test.ts`

按 spec §5.2.1 完整伪代码实现,5 step 同 Task 2.1 节奏,~8 个测试 case。

## Task 3.2: compute.ts(核心算法)

参考 `scripts/compute-ranking-scope.ts` 完整移植到 `src/lib/research/ecological-index/compute.ts`,~10 个测试 case (F 公式 / min-max / AHP / 综合分 fixture).

## Task 3.3: chart-generator.ts

基于 P0 spike 结果实现 3 张图 (柱状 / 饼图 / Top15 对比), 输出 PNG buffer.

## Task 3.4: docx-builder.ts

基于 `docx` lib (A5 已 vetted), 复刻 `0526-scope-2025...docx` 的所有元素: 39 行表 + 段落 + 3 张图 + 39 区县评语自动生成.

## Task 3.5: xlsx-builder.ts(19-sheet)

参考 `scripts/export-scope-xlsx.py` 完整移植: 00 总览 / 01 数据源清单 / 02 数据审计 / 1.1-5.3 (15 sheet) / 99 综合汇总.

## Task 3.6: content-exporter.ts(按 tier 拆 4 文件)

参考 `scripts/export-scope-content-xlsx.ts` 改造为按 tier 4 个独立函数, 复用现有 `EXPORT_COLUMN_ORDER + exportRowToOpinionRecord`.

## Task 3.7: ecological-index-reports DAL + Server Action

实现 `createEcologicalIndexReport` + `previewScopeCoverage` 等.

## Task 3.8: Inngest 7 步 function

```ts
// src/inngest/functions/research/ecological-index-generate.ts
export const ecologicalIndexGenerate = inngest.createFunction(
  {
    id: "research-ecological-index-generate",
    concurrency: { limit: 2, key: "event.data.organizationId" },
    retries: 3,
  },
  { event: "research/ecological-index.generate" },
  async ({ event, step, logger }) => {
    // step.run("load-resources", ...)
    // step.run("compute-indicators", ...)
    // step.run("build-xlsx-19sheet", ...)
    // step.run("build-charts", ...)
    // step.run("build-docx", ...)
    // step 6a-6d 按 tier 拆 4 个 step
    // step.run("finalize", ...)
  },
);
```

每 step 在 dedicated sub-step 内完成 + 上传 storage + 更新 status.

## Task 3.9: 注册到 Inngest index.ts

```ts
// src/inngest/functions/research/index.ts
export { ecologicalIndexGenerate } from "./ecological-index-generate";
```

## Task 3.10: 端到端 fixture 测试

跑一次完整流程: 准备 scope + dataset fixture → 发 inngest event → 验证 storage 中产物对比 Python 脚本产物.

## Task 3.11: P3 总结

---

# Phase 4: UI 集成(2 天)

## Task 4.1: list 页加 sourceType tab

修改 `page.tsx` + `reports-list-client.tsx` 加 `<Tabs>` 切换 advanced_search / ecological_index.

## Task 4.2: 新建 Dialog

`ecological-index-new-dialog.tsx`: 标题 + 年份 + 名单(实时预估) + 数据集 + 同时生成数据源勾选.

## Task 4.3-4.6: 详情页 4 tab

- 概览 tab: 榜首/末位 + 统计 + Top10 横条 + 梯队饼图 + 3 个下载按钮
- 综合排行 tab: 39 行表
- 指标明细 tab: 15 个二级指标折叠展示
- 资源快照 tab: 引用的 scope/dataset 详情

## Task 4.7: 详情页路由分支

`/data-collection/reports/[id]/page.tsx` 按 sourceType 分支渲染 advanced_search vs ecological_index.

## Task 4.8: 实时 dry-run 预估 API

`previewScopeCoverage` server action, 调用现有 matcher 逻辑.

## Task 4.9: P4 总结 + 端到端 manual test

- 上传名单 → 上传活动表 → 新建报告 → 看到 status 流转 → 详情页看到所有内容 + 3 个下载成功

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
