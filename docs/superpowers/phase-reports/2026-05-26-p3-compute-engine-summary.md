# P3 计算引擎 Phase Summary

**Date:** 2026-05-28
**Status:** ✅ Done
**Branch:** main(直接落)
**Spec:** [`2026-05-26-ecological-index-report-design.md`](../specs/2026-05-26-ecological-index-report-design.md)
**Plan:** [`2026-05-26-ecological-index-report-plan.md`](../plans/2026-05-26-ecological-index-report-plan.md)

## 完成内容

### Commits

| SHA | Phase | 内容 |
|---|---|---|
| `690a0a0` | P3.1 | matcher.ts — unit → outlet_id 反查(5 级优先级 + 冲突仲裁)9 单测 |
| `e32141c` | P3.2 | compute.ts — F=1/Σ|p−1/N| + min-max + AHP (45 单测) |
| `cf304f9` | P3.3 | chart-generator.ts — 3 张图(柱/饼/Top15) 4 单测 |
| `c25b4cc` | P3.4 | docx-builder.ts — 排行榜及解读 docx + 39 区县评语 3 单测 |
| `61799b9` | P3.5 | xlsx-builder.ts — 19-sheet 可验证 xlsx 5 单测 |
| `a2b66fd` | P3.6 | content-exporter.ts — 按 tier 拆 4 文件 6 单测 |
| `25c28d7` | P3.7 | ecological-index-reports DAL + Server Action + Inngest events 3 单测 |
| `9f4b6a9` | P3.8+P3.9 | Inngest 7 步流水线 + 注册 |
| `<本 commit>` | P3.10+P3.11 | 端到端 fixture 测试 + P3 phase summary |

### 新增的模块布局

```
src/lib/research/ecological-index/
├── types.ts                          # 共享类型 (P2.1 起)
├── scope-parser.ts                   # P2.1
├── activity-parser.ts                # P2.2
├── matcher.ts                        # P3.1 ─ 新增
├── compute.ts                        # P3.2 ─ 新增
├── chart-generator.ts                # P3.3 ─ 新增
├── docx-builder.ts                   # P3.4 ─ 新增
├── xlsx-builder.ts                   # P3.5 ─ 新增
├── content-exporter.ts               # P3.6 ─ 新增
└── __tests__/                        # 86 个单测(P2 17 + P3 77 − 8 旧已统计)
    ├── activity-parser.test.ts       # P2.2  (6)
    ├── chart-generator.test.ts       # P3.3  (4)
    ├── compute.test.ts               # P3.2  (45)
    ├── content-exporter.test.ts      # P3.6  (6)
    ├── docx-builder.test.ts          # P3.4  (3)
    ├── end-to-end.test.ts            # P3.10 (2) ─ 新增
    ├── matcher.test.ts               # P3.1  (9)
    ├── scope-parser.test.ts          # P2.1  (6)
    └── xlsx-builder.test.ts          # P3.5  (5)

src/lib/dal/
└── ecological-index-reports.ts       # P3.7 ─ 新增

src/app/actions/
└── ecological-index-reports.ts       # P3.7 ─ 新增

src/inngest/functions/
└── ecological-index-report.ts        # P3.8 ─ 新增
```

### Inngest 7 步流水线

```
Step 1: load-resources        — 加载 scope + dataset + outlet 白名单
Step 2: compute-indicators    — SQL 取 collected_items + computeIndicators 算法
Step 3: build-xlsx-19sheet    — 上传 Storage
Step 4+5: charts + docx        — 合并 step,避免 Buffer 跨边界序列化
Step 6 (按 tier 拆 4 子 step):
  Step 6a: build-content-central   — 上传 Storage
  Step 6b: build-content-industry  — 上传 Storage
  Step 6c: build-content-municipal — 上传 Storage
  Step 6d: build-content-district  — 上传 Storage
Step 7: finalize              — status='ready' + aggregatesJson 持久化
```

## 验收

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm vitest run` | ✅ **870 passed / 121 files** |
| `pnpm build` | ✅ Next.js Compiled successfully in 10.5s |
| 端到端 fixture | ✅ in-memory 跑完整 6 步(compute → chart × 3 → docx → xlsx 19sheet → content × 4 tier),产物字节数合理 |

## 关键算法实现要点

- **F 公式上限**: F = 1 / Σ|p_t − 1/N|;均匀时 F=N(理论上限),集中 1 主题时 F ≈ N/(2(N−1))。P3.2 修正了 spec 中误写的 1.07 期望值。
- **min-max 区间化**: [65, 95],`max == min` 时退化为 80(区间中位数)。
- **区县归并**: 江北区 / 渝北区 → 两江新区(固化在 `compute.normalizeDistrict`,与 docx-builder 段落保持一致)。
- **outlet 反查 5 级优先级**: `wechatGhid` > `weiboUid` > `wechatNames`(精确) > 域名 > `outlet_name` 模糊匹配。
- **outlet 冲突仲裁**: tier 优先级(central > industry > municipal > district_rmt > district_gov) + xlsxRow 升序作为 tiebreaker。

## 已知遗留 / 偏差

- **P3.3 未装 chartjs-plugin-annotation**:平均线/阈值线无法画在图上,补救把平均分塞进图 1 标题尾部(`(平均 76.70)`)。如需要后续补回,跑 `pnpm add chartjs-plugin-annotation` 后改 chart-generator。
- **P3.7 `previewScopeCoverage`** 用 raw SQL 查 `scope_units.resolved_outlet_ids`,后续如有 schema 改动需同步。
- **P3.8 Step 4+5 合并**: chart Buffer 不跨 step 边界,牺牲 step 粒度换性能(避免 Inngest 把 Buffer 序列化进 JSON 状态)。如要细粒度重试,后续可把 charts 单独 step。
- **P3.10 端到端测试** 用 in-memory fixture(3 区县),只验证 lib 串接 OK + 产物字节数 / sheet 数 / 文件头合规,**不验证真实 39 区县全量 SQL 路径**——那是 P4 UI 起来后端到端验证的事(用户在浏览器点"生成报告" → 看 Inngest 跑完 → 下载 docx/xlsx 检查)。

## 整体进度

| Phase | 状态 | 用时 |
|---|---|---|
| P0 spike (3 项) | ✅ 完成 | 0.5d |
| P1 数据层 schema | ✅ 完成 | 1d |
| P2 资源管理 UI | ✅ 完成 | 2d |
| **P3 计算引擎** | ✅ **完成** | **3d** |
| P4 UI 集成 | ⏳ 待开始 | 2d |

## 下一步: Phase 4 — UI 集成

- Reports 列表加 `sourceType` tab (`advanced_search` / `ecological_index`)
- 新建 Dialog(年份 + 名单 + 数据集 + 实时预估覆盖率)
- 详情页 4 tab(概览 + 综合排行 + 指标明细 + 资源快照)
- 实时 dry-run 预估调用 `previewScopeCoverage`(P3.7 已暴露)
- 触发 Inngest event `ecological-index-report/generate` → 浏览器轮询 / SSE 显示进度
