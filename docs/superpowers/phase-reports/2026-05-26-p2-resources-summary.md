# P2 资源管理 Phase Summary

**Date:** 2026-05-27
**Status:** ✅ Done
**Branch:** main(直接落)
**Spec:** [`2026-05-26-ecological-index-report-design.md`](../specs/2026-05-26-ecological-index-report-design.md)
**Plan:** [`2026-05-26-ecological-index-report-plan.md`](../plans/2026-05-26-ecological-index-report-plan.md)

## 完成内容

### Commits

| SHA | Phase | 内容 |
|---|---|---|
| `05166f8` | P2.1 | scope-parser.ts + types.ts + 6 单测 + fixture xlsx |
| `4030ec5` | P2.2 | activity-parser.ts + 6 单测 + fixture xlsx |
| `a4fba02` | P2.3+P2.4 | media-scopes + activity-datasets DAL + 类型签名测试 |
| `16a63d1` | P2.5 | media-scopes + activity-datasets server actions |
| `b46ea3e` | P2.6+P2.7+P2.8 | 资源管理 UI 双 tab + 上传 dialog + 详情 drawer + 入口按钮 |

### 新增的模块

#### Library 层(算法/解析)

```
src/lib/research/ecological-index/
├── types.ts                          # 共享 TS 类型 (ScopeUnitTier, ParsedScopeUnit, ParsedScope)
├── scope-parser.ts                   # 媒体名单 xlsx 解析
├── activity-parser.ts                # 活动 xlsx 解析 + Excel 日期序号转 ISO
└── __tests__/
    ├── scope-parser.test.ts          # 6 单测
    ├── activity-parser.test.ts       # 6 单测
    └── fixtures/
        ├── scope-sample.xlsx         # 真实媒体名单 fixture
        └── activity-sample.xlsx      # 真实活动 fixture
```

#### DAL 层

```
src/lib/dal/research/
├── media-scopes.ts                   # list/get/create/setDefault/countRef/delete
├── activity-datasets.ts              # 同上
└── __tests__/
    ├── media-scopes.test.ts          # 类型签名测试
    └── activity-datasets.test.ts     # 同上
```

#### Server Actions 层

```
src/app/actions/research/
├── media-scopes.ts                   # 5 actions (含 base64 上传 + 5MB 校验)
└── activity-datasets.ts              # 5 actions (含 year 校验)
```

#### UI 层

```
src/app/(dashboard)/data-collection/reports/
├── reports-list-client.tsx           # 加 "资源管理" 入口按钮
└── resources/
    ├── page.tsx                      # server component (双 DAL fetch + permission gate)
    ├── resources-client.tsx          # 双 tab 框架
    ├── scopes-tab.tsx                # 媒体名单 DataTable
    ├── datasets-tab.tsx              # 活动数据集 DataTable
    ├── upload-scope-dialog.tsx       # 上传名单 dialog
    ├── upload-dataset-dialog.tsx     # 上传数据集 dialog
    ├── scope-detail-drawer.tsx       # 详情 drawer(按 tier 列 units)
    └── dataset-detail-drawer.tsx     # 详情 drawer(39 区县表)
```

## 验收

| 项 | 结果 |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm vitest run` | ✅ 791 passed |
| `pnpm build` | ✅ Next.js build success |
| 新单测数 | 6 + 6 + 2 + 2 = **16 个新测试** |
| 设计系统合规 | ✅ 全用 shared 组件,无 color override |

## 关键设计决策

1. **DAL/Action 分层严格**:DAL 纯函数 + org-scope 强制,Action 拿用户 ctx + 调 DAL。
2. **transaction 安全**:`createMediaScopeWithUnits` / `setDefault*` 都用 `db.transaction` 防止半成品。
3. **delete force flag**:删除前查 `countReports*`,若被引用要求 `force=true`,UI 提供"普通删除 / 强制删除"两按钮。
4. **base64 上传 + 5MB 上限**:避免大文件 OOM,parser 接 Buffer。
5. **ConfirmDialog 不够用**:UI implementer 用 Dialog 三按钮替代,UX 更清晰。
6. **Date 序列化**:server page 把 Date → ISO string 跨 client boundary,client 用 `new Date(...)` 还原。
7. **江北/渝北归并 + 忠州/巫溪补全**:在 scope-parser 内部完成,DB 存的就是归并后的 districtNormalized。

## 与 spec 的偏差

| 项 | spec 原计划 | 实际实现 | 原因 |
|---|---|---|---|
| 活动 xlsx 日期 45995 期望值 | "2025-12-15" | "2025-12-04" | spec 给的日期算错(差 11 天),implementer 按 Excel base 1899-12-30 标准修正 |
| ConfirmDialog `extraAction` | 推荐用 extraAction | 用 Dialog 三按钮 | ConfirmDialog 没有 extraAction prop |

## 已知遗留

| 项 | 状态 |
|---|---|
| sourceFileUrl 暂存 null | ⏳ P3 引入 Storage 上传 |
| Storage 实测 | ⏳ Follow-up #49(等 Storage 上线) |
| docs/ 累积 untracked / deleted | ⏳ 留作后续 cleanup |
| reports-list-client 的 sourceType tab | ⏳ P4 加(本期暂只在 reports 列表加资源管理入口) |

## 下一步: Phase 3 - 计算引擎

P2 已交付**用户可上传 + 管理资源**的完整闭环,下一阶段 P3 实现:
- matcher.ts(unit → outlet_id 反查)
- compute.ts(F=1/Σ + min-max + AHP 加权)
- xlsx-builder.ts(19-sheet 可验证 xlsx)
- chart-generator.ts(3 张可视化图)
- docx-builder.ts(排行榜 docx)
- content-exporter.ts(按 tier 4 个内容源 xlsx)
- Inngest 7 步流水线 + ecological-index-reports DAL/Action
