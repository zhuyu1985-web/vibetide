# P1 数据层 Phase Summary

**Date:** 2026-05-26 → 2026-05-27
**Status:** ✅ Done
**Branch:** main (直接落)
**Spec:** [`2026-05-26-ecological-index-report-design.md`](../specs/2026-05-26-ecological-index-report-design.md)
**Plan:** [`2026-05-26-ecological-index-report-plan.md`](../plans/2026-05-26-ecological-index-report-plan.md)

## 完成内容

### Commits

| SHA | Message | 内容 |
|---|---|---|
| `0882ae1` | feat(research): add research_media_scopes schema + scope_unit_tier enum | P1.1 - 2 张表 + 1 个 enum + 3 测试 |
| `96c71d3` | feat(research): add research_activity_datasets schema | P1.2 - 1 张表 + ActivityDataPoint type + 3 测试 |
| `f96d122` | feat(research): P1.3+P1.4 extend reports schema + migration + downstream narrowing | P1.3 + P1.4 合并 - reports schema 扩展 + migration + 9 个消费侧 narrowing |

(`c3088ec` 是 P1.2 implementer 顺手清理的累积 follow-up work,与 P1 主线无关但保留在历史中)

### 新增表 / 列 / 枚举

| 对象 | 类型 | 用途 |
|---|---|---|
| `research_media_scopes` | 表 | 媒体名单版本(含 5 tier count + isDefault) |
| `research_media_scope_units` | 表 | 名单单位明细(含 resolvedOutletIds + xlsxRow + tier) |
| `research_activity_datasets` | 表 | 线下活动数据集(含 jsonb ActivityDataPoint[] + year + isDefault) |
| `scope_unit_tier` | enum | 5 个 tier: central / industry / municipal / district_rmt / district_gov |
| `research_reports.content_source_file_urls` | jsonb 列 | 内容源 xlsx 按 tier 拆 4 文件的 URL map |

### TypeScript Union Types

- `ReportSearchSnapshot = AdvancedSearchSnapshot | EcologicalIndexSnapshot`(discriminated by `kind`)
- `AggregatesJson = AdvancedSearchAggregates | EcologicalIndexAggregates`(同上)
- 9 个消费侧文件加 narrowing(`as AdvancedSearchAggregates` 等)保持现有 advanced_search 流程不变

### Migration

`supabase/migrations/0041_nasty_queen_noir.sql` 含全部 DDL,已通过 `pnpm db:migrate` 应用到本地 DB。

## 验收

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm vitest run` | ✅ 775/775 passed |
| `pnpm build` | ✅ build success |
| `bash scripts/verify-schema-sync.sh` | ✅ 16/16 fingerprint OK |
| DB tables 实际存在 | ✅ 3 张新表 + 1 新列 + 1 新 enum 已落地 |

## 顺带处理的累积 follow-up (commit `c3088ec`)

P1.2 implementer 在做 P1.2 时顺手 commit 了 working tree 累积工作(本应单独 commit):
- race-condition fix(missions_source_dedup race)
- articles.metadata jsonb 列
- src/lib/db/pg-errors.ts
- scripts/mark-pending-migrations-applied.ts helper
- workflow-launch.test.ts +270 行测试

这些是上游 plan 留的 follow-up,内容质量没问题但本应单独 commit。已通过验收测试,作为既成事实保留。

## 已知遗留

| 项 | 状态 |
|---|---|
| scripts/compute-ranking-scope.ts 4 个 TS7006 | ✅ 已修复(P1.5 build 终验时连带修了) |
| docs/ 累积 untracked + deleted | ⏳ 留作后续 cleanup task |
| scripts/ 中 P0 累积的 .ts/.py 工具 | ⏳ 同上 |
| P0.3 Storage 实测 | ⏳ Follow-up task #49(等 Storage 上线) |

## 下一步: Phase 2 - 资源管理

P1 schema 已 stable,P2 可以基于此实现资源管理 UI + Server Actions。
