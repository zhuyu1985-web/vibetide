# A4 — 高级检索 sub-spec

- **版本**：v1.0
- **日期**：2026-05-06
- **作者**：Zhuyu（产品） + Claude（技术方案）
- **关联 main spec**：`/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md` §4.5
- **状态**：Brainstorming 完成，待 implementation plan
- **工期估算**：3-4 天（4 phase）

---

## 1. 范围与目标

### 1.1 一句话定义

> 给 vibetide 研究模块加"知网风格"的高级检索能力——11 个检索字段 / 动态 1-10 行检索条件 / 简单线性 AND/OR 组合 / 简单操作符（包含/不包含/等于/不等于/范围内）/ 侧栏全局快速过滤器 / 命中结果 DataTable，让客户在 `/research/search` 进行精准的字段限定 + 多关键词组合检索。

### 1.2 范围（3-4 天工期内必交付）

#### Phase 1 DAL（1 天）

- 新增 DAL 函数 `advancedSearchCollectedItems(orgId, conditions[], pagination)` 在 `src/lib/dal/research/collected-item-search.ts`
- 用 drizzle SQL builder 动态拼 WHERE（含 EXISTS 子查询过滤 topic/district annotation）
- 支持 11 个字段 × 5 种操作符
- 简单线性 AND/OR 求值（左结合：`A AND B OR C` = `(A AND B) OR C`）
- 完整单测覆盖（10+ case：单字段 / 多字段 AND / 多字段 OR / AND OR 混合 / 时间范围 / 跨 org 隔离 / 边界情况）

#### Phase 2 UI 条件构造器（1 天）

- 新建 `src/app/(dashboard)/research/advanced-search-builder.tsx`（client component）
- 动态行组（默认 3 行 / 1-10 行加减）
- 每行：`[字段 Select]` `[操作符 Select]` `[值输入控件]` `[AND/OR Select]` `[+ 加行] [× 删行]`
- 值输入控件按字段类型条件渲染（text → Input；enum → Select 多选；time → DatePicker 范围）
- 字段切换时操作符列表联动（text 字段 vs enum 字段操作符不同）

#### Phase 3 侧栏过滤器 + 集成（1 天）

- `advanced-filters-sidebar.tsx`（client component）— 全局快速过滤（与高级检索条件 intersection）：媒体分级 chip / 区县多选 / 主题多选 / 时间范围 / 内容类型多选
- 集成到 `search-workbench-client.tsx`：顶部加"高级检索"切换按钮 → 高级模式显示 builder + sidebar；简单模式保留现有单关键词检索
- 结果 DataTable（标题 / 媒体 chip / 主题 chip / 区县 chip / 发布时间 / 来源 URL）+ 分页 50/页 + 总数显示
- 命中关键词高亮（V1 简版：substring → 红字 wrap）

#### Phase 4 测试 + final commit（0.5-1 天）

- 集成测试（advancedSearch DAL + UI 输入 → server action → 结果列表）
- tsc / lint / build 全过
- 浏览器手动验收（动态行 + AND/OR + 侧栏过滤）
- final commit

### 1.3 非目标（YAGNI / 推迟到 V2）

- ❌ 嵌套括号分组（A4-Q2 决策 a：简单线性 AND/OR，无嵌套）
- ❌ 完整操作符（开头是/结尾是/精确等于/正则）— A4-Q3 决策简单
- ❌ 保存检索方案（V2 加 research_saved_searches 表 + UI）
- ❌ 三张概览图（柱状/堆叠/饼图）— A5 报告导出阶段做（避免重复）
- ❌ 命中关键词高亮的全文搜索引擎风格（如 elasticsearch 风格）— V1 简版 substring 红字
- ❌ 检索结果一键导出 CSV/Excel — A5 报告导出能力覆盖
- ❌ 跨字段全文搜索（"标题 OR 正文 包含 X"）— 客户用两行条件 OR 替代

### 1.4 与 main spec §4.5 对应关系

main spec §4.5 给了 11 字段 + 检索 UI + 性能要求草稿。本 sub-spec：
1. **范围按 A4-Q1 b 标准版**：11 字段 / 动态 1-10 行 / 不含保存方案 + 概览图
2. **AND/OR 按 A4-Q2 a 简单线性**：左结合，不嵌套
3. **操作符按 A4-Q3 简单**：5 种基础操作符
4. **侧栏过滤器**：保留 main spec 描述（5 项快速过滤）
5. **集成方式**：扩展现有 search-workbench-client，加"高级/简单"切换

---

## 2. 已确认决策（来自 A4 brainstorming）

| ID | 问题 | 决策 |
|---|---|---|
| A4-Q1 | A4 V1 范围 | **b 标准版**：11 字段 + 动态 1-10 行 + 侧栏过滤；不含保存方案（V2）+ 不含概览图（A5 出） |
| A4-Q2 | 检索行组合规则 | **a 简单线性 AND/OR**：每行尾部 AND/OR 切换；左结合（`A AND B OR C` = `(A AND B) OR C`）；不支持嵌套括号 |
| A4-Q3 | 字段操作符复杂度 | **简单**：text 字段 包含/不包含；enum 字段 等于/不等于；time 字段 在范围内 |

---

## 3. 检索字段定义（11 字段 × 5 操作符）

### 3.1 字段类型与操作符

| # | 字段 key | UI label | 数据类型 | DB 字段 | 可用操作符 |
|---|---|---|---|---|---|
| 1 | `title` | 标题 | text | collected_items.title | 包含 / 不包含 |
| 2 | `content` | 正文 | text | collected_items.content | 包含 / 不包含 |
| 3 | `author` | 作者 | text | collected_items.raw_metadata->>'author' | 包含 / 不包含 |
| 4 | `outletName` | 媒体名 | text | media_outlet_dictionary.outlet_name (join) | 包含 / 不包含 |
| 5 | `outletTier` | 媒体分级 | enum | collected_items.outlet_tier | 等于 / 不等于（5 选项 + "未分类"）|
| 6 | `outletRegion` | 区域 | enum | collected_items.outlet_region | 等于 / 不等于 |
| 7 | `district` | 区县 | enum | research_collected_item_districts.district_id (EXISTS) | 等于 / 不等于（40 选项）|
| 8 | `topic` | 主题 | enum | research_collected_item_topics.topic_id (EXISTS) | 等于 / 不等于（16 选项）|
| 9 | `contentType` | 内容类型 | enum | collected_items.content_type | 等于 / 不等于（6 选项）|
| 10 | `publishedAt` | 发布时间 | time | collected_items.published_at | 在范围内 |
| 11 | `platform` | 平台 | enum | collected_items.first_seen_channel | 等于 / 不等于 |

### 3.2 操作符 SQL 映射

| 操作符 | text 字段 SQL | enum 字段 SQL | time 字段 SQL |
|---|---|---|---|
| `contains` | `field ILIKE '%X%'` | — | — |
| `notContains` | `field NOT ILIKE '%X%'` OR `field IS NULL` | — | — |
| `equals` | — | `field = 'X'` | — |
| `notEquals` | — | `field != 'X'` OR `field IS NULL` | — |
| `between` | — | — | `field BETWEEN A AND B` |

注：`notContains` / `notEquals` 包含 NULL 处理（NULL 视为"不包含"/"不等于"），用 OR `IS NULL` 兜底。

### 3.3 enum 字段的 value 来源

- `outletTier`：`OUTLET_TIER_VALUES` 常量 + "unclassified"（5 + 1 选项）
- `outletRegion`：动态加载（distinct collected_items.outlet_region from DB）
- `district`：listCqDistricts() — 40 区县
- `topic`：listResearchTopics(orgId) — 16 主题（org-scoped）
- `contentType`：`CONTENT_TYPE_VALUES` 常量（6 选项）
- `platform`：动态加载（distinct collected_items.first_seen_channel from DB）

---

## 4. AND/OR 求值规则

### 4.1 简单线性左结合

每行尾部 AND/OR 切换器（最后一行无切换）。求值时按从上到下顺序，左结合：

```
Row 1: A 包含 X1   [AND]
Row 2: B 包含 X2   [OR]
Row 3: C 等于 X3   [AND]
Row 4: D 等于 X4

→ ((A AND B) OR C) AND D
```

注：左结合简化（不实现 SQL 优先级）。如客户需要复杂逻辑（如`A AND (B OR C)`），用 V2 加嵌套括号或者通过加多行实现。

### 4.2 DAL 层求值

```ts
// 伪代码
function buildWhereExpr(conditions: Condition[]): SQL {
  let expr = buildSingleCondition(conditions[0]);
  for (let i = 1; i < conditions.length; i++) {
    const op = conditions[i - 1].joinNext;  // 上一行的 joinNext
    if (op === "AND") {
      expr = and(expr, buildSingleCondition(conditions[i]));
    } else {
      expr = or(expr, buildSingleCondition(conditions[i]));
    }
  }
  return expr;
}
```

注：`drizzle-orm` 的 `and(a, b)` / `or(a, b)` 支持嵌套，可直接套用。

---

## 5. DAL 设计

### 5.1 接口

```ts
// src/lib/dal/research/collected-item-search.ts（追加）

export type AdvancedSearchOperator = "contains" | "notContains" | "equals" | "notEquals" | "between";

export interface AdvancedSearchCondition {
  field: "title" | "content" | "author" | "outletName" | "outletTier" | "outletRegion" | "district" | "topic" | "contentType" | "publishedAt" | "platform";
  operator: AdvancedSearchOperator;
  value: string | string[] | { from: Date; to: Date };  // 按字段类型不同
  joinNext?: "AND" | "OR";  // 与下一行的连接符；最后一行无 joinNext
}

export async function advancedSearchCollectedItems(
  orgId: string,
  conditions: AdvancedSearchCondition[],
  pagination: { limit: number; offset: number },
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  // 1. 必须先有 organizationId 过滤（强制）
  // 2. 按 conditions 拼 WHERE 子句
  // 3. EXISTS 子查询处理 topic / district / outletName join
  // 4. leftJoin mediaOutletDictionary 取 outletName
  // 5. 求 total count + 分页 items
}
```

### 5.2 单条件 SQL 构造

```ts
function buildSingleCondition(c: AdvancedSearchCondition): SQL {
  switch (c.field) {
    case "title":
      return c.operator === "contains"
        ? ilike(collectedItems.title, `%${c.value}%`)
        : sql`${collectedItems.title} NOT ILIKE ${`%${c.value}%`} OR ${collectedItems.title} IS NULL`;
    case "content": /* 同上 */
    case "author":
      // raw_metadata->>'author' 通过 jsonb 操作符
      return sql`${collectedItems.rawMetadata}->>'author' ILIKE ${`%${c.value}%`}`;
    case "outletName":
      // EXISTS 子查询查 mediaOutletDictionary（按 contains/notContains 分流）
      if (c.operator === "contains") {
        return sql`EXISTS (SELECT 1 FROM ${mediaOutletDictionary} mod WHERE mod.id = ${collectedItems.outletId} AND mod.outlet_name ILIKE ${`%${c.value}%`})`;
      }
      // notContains: NOT EXISTS 命中 OR outlet_id IS NULL（NULL 视为"不包含任何媒体"）
      return sql`NOT EXISTS (SELECT 1 FROM ${mediaOutletDictionary} mod WHERE mod.id = ${collectedItems.outletId} AND mod.outlet_name ILIKE ${`%${c.value}%`}) OR ${collectedItems.outletId} IS NULL`;
    case "outletTier":
      return c.value === "unclassified"
        ? sql`${collectedItems.outletTier} IS NULL`
        : eq(collectedItems.outletTier, c.value as string);
    case "district":
      return sql`EXISTS (SELECT 1 FROM ${researchCollectedItemDistricts} cid WHERE cid.collected_item_id = ${collectedItems.id} AND cid.district_id = ${c.value})`;
    case "topic":
      return sql`EXISTS (SELECT 1 FROM ${researchCollectedItemTopics} cit WHERE cit.collected_item_id = ${collectedItems.id} AND cit.topic_id = ${c.value})`;
    case "publishedAt":
      const range = c.value as { from: Date; to: Date };
      return sql`${collectedItems.publishedAt} BETWEEN ${range.from} AND ${range.to}`;
    // ...
  }
}
```

### 5.3 必备约束

- **organizationId 强制 AND**：在用户构造的 conditions 之外，DAL 内部强制加 `AND collected_items.organization_id = orgId` 防止跨 org 数据泄漏
- **空 conditions 处理**：返回空数组（不返回所有 collected_items）
- **超过 10 行拒绝**：DAL 入口校验 conditions.length ≤ 10，超出抛错
- **value 类型校验**：每个 field × operator 组合的 value 类型固定，DAL 收到非法 value 时抛错（zod 校验）

---

## 6. UI 设计

### 6.1 advanced-search-builder.tsx（条件构造器）

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, ... } from "@/components/ui/select";
import { DatePicker } from "@/components/shared/date-picker";

interface Props {
  initialConditions?: AdvancedSearchCondition[];
  onChange: (conditions: AdvancedSearchCondition[]) => void;
  options: {
    outlets: { id: string; name: string; tier: string }[];
    districts: { id: string; name: string }[];
    topics: { id: string; name: string }[];
    regions: string[];
    platforms: string[];
  };
}

export function AdvancedSearchBuilder({ initialConditions, onChange, options }: Props) {
  const [rows, setRows] = useState<AdvancedSearchCondition[]>(
    initialConditions ?? [{ field: "title", operator: "contains", value: "", joinNext: "AND" }, ...defaultThreeRows]
  );

  // 字段切换：根据字段类型自动重置 operator + value
  function handleFieldChange(rowIdx: number, field: AdvancedSearchCondition["field"]) { /* ... */ }

  // 添加行：默认 3 行起步，最多 10 行
  function handleAddRow() { /* ... */ }

  // 删除行：最少 1 行
  function handleRemoveRow(rowIdx: number) { /* ... */ }

  // 渲染：每行 4 列 + 末尾按钮
  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <RowEditor
          key={idx}
          row={row}
          isLastRow={idx === rows.length - 1}
          onChange={(updated) => { rows[idx] = updated; setRows([...rows]); onChange([...rows]); }}
          onAdd={handleAddRow}
          onRemove={() => handleRemoveRow(idx)}
          options={options}
        />
      ))}
      <Button variant="ghost" onClick={handleAddRow} disabled={rows.length >= 10}>+ 添加条件</Button>
    </div>
  );
}

function RowEditor({ row, isLastRow, onChange, onAdd, onRemove, options }: RowProps) {
  // 1. [字段 Select]（11 选项）
  // 2. [操作符 Select]（按字段类型动态：text 字段 2 选 / enum 字段 2 选 / time 字段 1 选）
  // 3. [值输入控件]（按字段类型条件渲染）
  // 4. [AND/OR Select]（仅 !isLastRow 显示）
  // 5. [+] [×] 按钮
}
```

### 6.2 值输入控件按字段类型条件渲染

| 字段类型 | 控件 |
|---|---|
| text (title/content/author/outletName) | `<Input placeholder="关键词">` |
| enum (outletTier) | `<Select>` 5 选项 + "unclassified" |
| enum (outletRegion) | `<Select>` 动态加载（distinct from DB） |
| enum (district) | `<Select>` 40 区县（按区县字典加载） |
| enum (topic) | `<Select>` 16 主题（按主题词库加载） |
| enum (contentType) | `<Select>` 6 选项 |
| enum (platform) | `<Select>` 动态加载 |
| time (publishedAt) | `<DateRangePicker>` 范围选择 |

### 6.3 advanced-filters-sidebar.tsx（侧栏过滤器）

5 个全局快速过滤器，与高级检索条件 intersection（同时生效）：

```tsx
<aside className="w-64 space-y-4">
  <FilterSection label="媒体分级">
    {OUTLET_TIER_VALUES.map(t => <Chip multi key={t} ... />)}
  </FilterSection>
  <FilterSection label="区县">
    <MultiSelect options={districts} ... />
  </FilterSection>
  <FilterSection label="主题">
    <MultiSelect options={topics} ... />
  </FilterSection>
  <FilterSection label="时间范围">
    <DateRangePicker ... />
  </FilterSection>
  <FilterSection label="内容类型">
    {CONTENT_TYPE_VALUES.map(t => <Chip multi key={t} ... />)}
  </FilterSection>
</aside>
```

侧栏过滤通过转化为额外的 `AND` 条件追加到 conditions 数组传给 DAL。

---

## 7. 集成方式

### 7.1 search-workbench-client.tsx 改造

在现有 search-workbench 顶部加"模式切换"按钮：

```tsx
<div className="flex items-center gap-2">
  <Button variant={mode === "simple" ? "default" : "ghost"} onClick={() => setMode("simple")}>简单检索</Button>
  <Button variant={mode === "advanced" ? "default" : "ghost"} onClick={() => setMode("advanced")}>高级检索</Button>
</div>

{mode === "simple" && <SimpleSearch />}
{mode === "advanced" && (
  <div className="flex gap-4">
    <AdvancedSearchBuilder ... />
    <AdvancedFiltersSidebar ... />
  </div>
)}
```

### 7.2 server action + SidebarFilter 类型

新增 `searchAdvanced(conditions, sidebarFilters, pagination)` server action：

```ts
"use server";

// SidebarFilter 类型定义（5 个全局快速过滤项）
export interface SidebarFilter {
  outletTiers?: string[];      // chip 多选 → 转 多行 outletTier=X OR outletTier=Y... AND
  districtIds?: string[];      // 多选 → 转 多行 district=X OR district=Y... AND
  topicIds?: string[];         // 多选 → 转 多行 topic=X OR topic=Y... AND
  contentTypes?: string[];     // chip 多选 → 转 多行 contentType=X OR contentType=Y... AND
  publishedAtRange?: { from: Date; to: Date };  // → 转 1 行 publishedAt between
}

// SidebarFilter → AdvancedSearchCondition[] 转换
// 策略：每个多选项转为一组 OR 子条件，整组以 AND 连接到主查询
// 注：A4-Q2 简单线性 AND/OR 不支持嵌套括号，所以多选项会展开为
//     "tier=A OR tier=B OR tier=C" 这种线性 OR 链，再 AND 到主条件后；
//     这与"chip 多选 = 任一命中"语义一致（OR），不会破坏左结合简化
function sidebarToConditions(s: SidebarFilter): AdvancedSearchCondition[] {
  const out: AdvancedSearchCondition[] = [];
  if (s.outletTiers?.length) {
    s.outletTiers.forEach((v, i) => {
      out.push({
        field: "outletTier", operator: "equals", value: v,
        joinNext: i < s.outletTiers!.length - 1 ? "OR" : "AND",
      });
    });
  }
  if (s.districtIds?.length) {
    s.districtIds.forEach((v, i) => {
      out.push({
        field: "district", operator: "equals", value: v,
        joinNext: i < s.districtIds!.length - 1 ? "OR" : "AND",
      });
    });
  }
  if (s.topicIds?.length) { /* 同上模式 */ }
  if (s.contentTypes?.length) { /* 同上模式 */ }
  if (s.publishedAtRange) {
    out.push({
      field: "publishedAt", operator: "between", value: s.publishedAtRange,
      joinNext: "AND",
    });
  }
  return out;
}

export async function searchAdvanced(payload: {
  conditions: AdvancedSearchCondition[];
  sidebarFilters: SidebarFilter;
  page: number; pageSize: number;
}) {
  const user = await requireAuth();
  // 合并：用户构造的 conditions + 侧栏 filter 转换条件
  // 注意：合并后总条数仍受 conditions.length ≤ 10 约束（多选项展开后可能超）；
  //       超过则改为不展开（用 IN 语义的 value: string[]，DAL 内部支持）
  const allConditions = [...payload.conditions, ...sidebarToConditions(payload.sidebarFilters)];
  if (allConditions.length > 10) {
    // fallback：把多选 sidebar 用 string[] value 单行 + 等于（IN 语义）
    // 详见 plan Phase 3 兜底策略
    throw new Error("条件总数超过 10，请减少手动条件或侧栏选项");
  }
  return await advancedSearchCollectedItems(
    user.organizationId,
    allConditions,
    { limit: payload.pageSize, offset: (payload.page - 1) * payload.pageSize },
  );
}
```

---

## 8. 测试策略

### 8.1 DAL 单测

`src/lib/dal/research/__tests__/advanced-search.test.ts`（新建）

10+ case：
- 单字段 contains / notContains
- 单字段 equals / notEquals
- 单字段 between (time)
- 多字段 AND
- 多字段 OR
- AND OR 混合（左结合验证）
- topic / district EXISTS 子查询
- 跨 org 隔离
- 空 conditions
- 超过 10 行拒绝

### 8.2 UI 测试

不写自动化（vitest jsdom 单测 UI 工程量大），靠浏览器手动验收 + tsc 类型检查。

### 8.3 集成测试

`writer.test.ts` 加 1 集成 case：
- 写入 5 条 collected_items
- 灌 topic/district annotation
- 调 advancedSearchCollectedItems 各种 condition 组合
- 验证返回正确

---

## 9. 工期分解（4 phase）

| Phase | 工期 | 关键产出 |
|---|---|---|
| Phase 1 DAL | 1 天 | advancedSearchCollectedItems + 10+ 单测 pass |
| Phase 2 UI Builder | 1 天 | advanced-search-builder.tsx 动态行 + 字段/操作符/值条件渲染 |
| Phase 3 Sidebar + 集成 | 1 天 | advanced-filters-sidebar + search-workbench-client 切换 + DataTable 结果 + 关键词高亮 |
| Phase 4 测试 + commit | 0.5-1 天 | 集成测试 + tsc/lint/build + 浏览器手动验收 + final commit |
| **合计** | **3.5-4 天** | A4 完工 |

---

## 10. 验收标准

### 10.1 功能验收

- [ ] /research/search 顶部有"简单/高级检索"切换
- [ ] 高级模式默认 3 行 / 最少 1 行 / 最多 10 行
- [ ] 11 个检索字段下拉可选，操作符按字段类型联动
- [ ] AND/OR 切换器在每行末尾（最后一行无切换器）
- [ ] 时间字段值用 DateRangePicker
- [ ] enum 字段值用 Select 联动数据源（outlets/districts/topics 等）
- [ ] 侧栏过滤器（5 项）与高级条件 intersection 生效
- [ ] 检索结果 DataTable 显示标题/媒体 chip/主题 chip/区县 chip/时间/URL
- [ ] 总数显示 + 分页 50/页
- [ ] 命中关键词高亮（标题列 substring 红字）
- [ ] 跨 org 数据隔离（DAL 强制 organizationId）

### 10.2 性能验收

- [ ] 单次检索（含 join + EXISTS + count）≤ 500ms（10 万级数据规模）
- [ ] UI 字段切换 / 添加行 / 删除行 ≤ 100ms 响应

### 10.3 数据正确性

- [ ] tsc --noEmit 0 错
- [ ] npm run build 通过
- [ ] DAL 单测 10+/10+ pass
- [ ] writer 集成测试 pass
- [ ] DAL 入口校验：conditions.length > 10 抛错；value 类型不符抛错

### 10.4 UI 验收

- [ ] 所有按钮 ghost 无边框
- [ ] toast 用 sonner
- [ ] DataTable / SearchInput / Select 用 vibetide 共享组件

---

## 11. 留待 plan 阶段细化的开放问题

| # | 问题 | 解决时机 |
|---|---|---|
| 1 | text 字段命中关键词高亮的具体实现（dangerouslySetInnerHTML vs React 组件 vs CSS） | Phase 3 Day 1 |
| 2 | 区域 / 平台 enum 选项的"动态加载" SQL（distinct + 缓存策略） | Phase 1 Day 1 |
| 3 | 侧栏过滤器与高级条件的 UI 优先级（同时生效时的视觉提示） | Phase 3 Day 1 |
| 4 | 模式切换时是否保留对方模式的状态（切回去能复原） | Phase 3 Day 1 |
| 5 | DAL 层 zod 校验（每个 field × operator 的 value 类型） | Phase 1 Day 1 |
| 6 | 空检索（无 condition 无 sidebar）的处理（提示用户输入 vs 返空） | Phase 1 Day 1 |
| 7 | DataTable 列宽 + 移动端响应式 | Phase 3 Day 1 |

---

## 12. 进入下一步

本 sub-spec 通过后：

1. **本 sub-spec → spec-document-reviewer 审查**
2. **审查通过 → 用户最终 approve**
3. **进入 A4 implementation plan**（用 `superpowers:writing-plans`）
4. **plan 通过 review → subagent-driven-development 执行**（4 phase）
5. **commit + 整 A4 final review → 进 A5 报告导出 sub-brainstorm**
