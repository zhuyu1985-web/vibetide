---
name: cms_catalog_sync
displayName: CMS 栏目同步
description: 通过华栖云 CMS 三步接口（getChannels → getAppList → getCatalogTree）同步 APP 侧所有可用栏目到 VibeTide 本地映射表（cms_channels / cms_apps / cms_catalogs）。支持手动触发与每日 cron，采用差量对比（insert/update/soft-delete）+ audit log。当用户提及"同步栏目""更新栏目表""刷新 CMS 栏目"或首次配置 CMS 映射时调用。
version: 1.0.0
category: management

metadata:
  skill_kind: action  # DB enum 只有 6 个 category，action 作为 management 下的细分 kind
  scenario_tags: [configuration, setup]
  compatibleEmployees: [xiaofa, leader]
  runtime:
    type: api_call
    avgLatencyMs: 8000
    maxConcurrency: 1
    timeoutMs: 60000
  requires:
    env: [CMS_HOST, CMS_LOGIN_CMC_ID, CMS_LOGIN_CMC_TID]
    dependencies: []
  implementation:
    scriptPath: src/lib/cms/catalog-sync/sync.ts
    testPath: src/lib/cms/__tests__/catalog-sync/
  openclaw:
    schemaPath: src/lib/cms/types.ts
    referenceSpec: docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md
---

# CMS 栏目同步（cms_catalog_sync）

## 使用条件

✅ **应调用场景**：
- 首次配置 CMS 对接后，初始化栏目映射表
- 运营手动触发"立即同步"（管理 UI `/settings/cms-mapping`）
- 每日定时同步（Inngest cron `0 2 * * *`）
- 栏目异常报错（如 `catalog_not_found`）时自动触发修复

❌ **不应调用场景**：
- CMS 凭证未配置（先去 settings 配置）
- 仅为查询单个栏目（走 CMS 单栏目接口或读本地缓存）
- 其他同步任务正在运行（advisory lock 保护，自动跳过）

**前置依赖**：`CMS_HOST` / `CMS_LOGIN_CMC_ID` / `CMS_LOGIN_CMC_TID` 三个 env 必填；feature flag `VIBETIDE_CATALOG_SYNC_ENABLED=true`。

## 输入 / 输出

**输入简要表：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| organizationId | uuid | ✓ | 组织 ID（多租户隔离） |
| triggerSource | enum | ✗ | `manual` / `scheduled` / `auto_repair` / `first_time_setup`，默认 `manual` |
| operatorId | string | ✗ | 触发人（手动触发时必填；scheduled 可省） |
| deleteMissing | boolean | ✗ | 本地有但 CMS 没有 → 软删，默认 `true` |
| dryRun | boolean | ✗ | 仅统计变更不写库（用于 UI 预览差异），默认 `false` |

**输出简要表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| success | boolean | 是否成功 |
| syncLogId | uuid | `cms_sync_logs` 记录 ID |
| stats | object | `{channelsFetched/Upserted, appsFetched/Upserted, catalogsFetched/Inserted/Updated/SoftDeleted, unchangedCount}` |
| warnings | string[] | 非致命警告（如 CMS 返回 0 栏目 / defaultCatalogId 失效） |
| error | object | `{code, message, stage}`；stage ∈ `auth/channels/apps/catalogs/reconcile` |

完整 TypeScript 接口见 [src/lib/cms/types.ts](../../src/lib/cms/types.ts) 与 [src/lib/cms/catalog-sync/sync.ts](../../src/lib/cms/catalog-sync/sync.ts) 的 `SyncCmsCatalogsOptions` / `SyncResult`。

## 工作流 Checklist

- [ ] Step 0: 检查 feature flag + 凭证 + advisory lock（`requireCmsConfig` / `isCatalogSyncEnabled`）
- [ ] Step 1: `startCmsSyncLog` 写入起点（state=running）
- [ ] Step 2: `getChannels({appAndWeb:1})` → 取 `CHANNEL_APP` → `upsertCmsChannel`
- [ ] Step 3: `getAppList("1")` → 循环 `upsertCmsApp`（加密 appsecret）
- [ ] Step 4: 对每个 app 调用 `getCatalogTree({appId, types:"1", isPrivilege:"false"})` → `flattenTree` 扁平化
- [ ] Step 5: `listAllActiveCmsCatalogs` 取本地 → `reconcileCatalogs({fetched, existing, deleteMissing})` 生成 plan
- [ ] Step 6: 应用 plan — `insertCmsCatalog` / `updateCmsCatalog` / `softDeleteCmsCatalog`
- [ ] Step 7: 检查 `app_channels.defaultCatalogId` 是否引用了被软删栏目 → 写 warning（不自动解绑）
- [ ] Step 8: `completeCmsSyncLog` 写终点 + stats + warnings + audit log
- [ ] Step 9: 触发后续事件（首次同步通知 / warnings 邮件）

### 三步接口调用顺序

```
getChannels → { CHANNEL_APP: {code, name, pickValue, thirdFlag} }
   ↓ 取 CHANNEL_APP
getAppList(type=1) → [{id, siteid, name, appkey, appsecret}, ...]
   ↓ 循环每个 app
getCatalogTree({appId, types:"1", isPrivilege:"false"}) → 嵌套树
   ↓ flattenTree 递归扁平化（保留 parentId/treeLevel/isLeaf/browse 字段）
reconcileCatalogs(fetched vs existing) → { inserts, updates, softDeletes, unchanged }
```

## 质量把关

**自检阈值表：**

| # | 检查点 | 阈值 |
|---|-------|-----|
| 1 | `CHANNEL_APP` 返回非空 | 硬（否则抛 `CmsConfigError`） |
| 2 | apps 数量非 0 | 警告（写 warning，不删本地） |
| 3 | catalogs 总数非 0 | 警告（所有 app 都返回空 → 不删本地） |
| 4 | dryRun 不写库 | 硬（逻辑分支） |
| 5 | advisory lock 保护并发 | 硬（`FOR UPDATE SKIP LOCKED`） |
| 6 | sync_log.state 终态为 `done`/`failed` | 硬 |

**Top-3 典型失败模式：**

| 失败模式 | 表现 | 修正 hint |
|---------|------|----------|
| 凭证失效 | `CmsAuthError`，sync_log=failed | 更新 env；Phase 2 接 MMS/CMC 自动鉴权 |
| 保护性误删 | CMS 临时返回 0 栏目，本地被软删 | `deleteMissing=true` 时先看 apps.length > 0 && allFlat.length === 0 的 guard（代码已实现 warning-only） |
| 栏目树超时 | 组织栏目 1000+，HTTP 超时 | 调大 `timeoutMs`；分 app 串行拉取（默认已如此） |

## 输出模板

```
🔄 CMS 栏目同步完成！

⏱ 耗时：{durationMs}ms
📊 统计
  📻 渠道：获取 {channelsFetched} / upsert {channelsUpserted}
  📱 应用：获取 {appsFetched} / upsert {appsUpserted}
  📂 栏目：获取 {catalogsFetched}
     • 新增 {catalogsInserted} · 更新 {catalogsUpdated} · 软删 {catalogsSoftDeleted} · 未变 {unchangedCount}

⚠️  警告（{warnings.length}）
{warnings.map(w => `   • ${w}`).join("\n")}

📝 下一步
   → 查看栏目列表：/settings/cms-mapping
   → 配置 APP 绑定：/settings/cms-mapping/app-channels
   → 下次自动同步：{nextCronTime}
```

## HTTP 接口签名速查

```bash
# 1. getChannels — 获取渠道
curl -X POST "${CMS_HOST}/web/catalog/getChannels" \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" \
  -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" \
  -d '{"appAndWeb":1,"privilegeFlag":0}'

# 2. getAppList — 获取应用（type=1 仅 APP 渠道）
curl -X POST "${CMS_HOST}/web/application/getAppList" \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" -d '{"type":"1"}'

# 3. getCatalogTree — 获取栏目树（types=1 新闻栏目）
curl -X POST "${CMS_HOST}/web/catalog/getTree" \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" \
  -d '{"appId":"10","types":"1","isPrivilege":"false"}'
```

## 幂等性

- 每次执行都会新建 `cms_sync_logs` 记录；失败/成功终态写入 `stats + warnings`
- upsert + reconcile 差量比对确保 `inserts/updates/softDeletes` 幂等（相同输入产出相同副作用）
- 同 organization 并发保护：advisory lock + `FOR UPDATE SKIP LOCKED`（第二次调用不报错，直接跳过）
- `dryRun=true` 模式完全只读，用于管理 UI 预览差异
- 软删只改 `deleted_at`，不真删物理行；CMS 恢复时下次同步自动激活

## EXTEND.md 示例

```yaml
# .vibetide-skills/cms_catalog_sync/EXTEND.md
sync_scope:
  channel_types: [1]            # 1=APP, 2=网站, 3=微信, 4=企鹅, 5=微博
  catalog_types: [1, 26]        # 1=新闻, 26=OTT 短视频

delete_missing: true
preserve_binding_catalogs: true  # 已被 app_channels 绑定的栏目即使 CMS 删了也仅 warning

cron_schedule: "0 2 * * *"
timezone: Asia/Shanghai

notify_on_warnings: true
notify_channel: email            # email / dingtalk / wecom
notify_recipients: [ops@example.com]
```

## 上下游协作

- **上游触发**：Inngest cron `cmsCatalogSyncDaily`（每天 02:00 Asia/Shanghai）/ 手动 UI `/settings/cms-mapping`"立即同步" / `cms_publish` 发现 catalogId 无效时自动修复
- **下游消费**：
  - `cms_publish` — 读取 `cms_catalogs` + `app_channels` 查 `siteId` / `catalogId`
  - 管理 UI — 展示栏目树、绑定关系、同步日志
  - `audit` 表 — 保留变更历史（update/soft_delete 均写 audit）
- **并发保护**：advisory lock + `FOR UPDATE SKIP LOCKED`；同 org 第二次调用直接跳过不报错

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `CmsAuthError` | 凭证失效 | 更新 env；后续 Phase 2 接自动鉴权 |
| 返回 0 栏目 | 账号无栏目权限 / CMS 临时异常 | guard 保护不删本地；运营联系 CMS 管理员开权限 |
| soft-delete 后栏目又出现 | CMS 侧恢复 | 下次同步自动激活（`deleted_at=null`） |
| `app_channels.defaultCatalogId` 失效 | CMS 删了被绑定的栏目 | warning 提醒；运营去 UI 重新绑定（不自动解绑） |
| 并发两次 cron 冲突 | schedule 错配 | advisory lock 保护，跳过第二次 |
| 同步后 `app.siteId` 变化 | CMS 迁移应用 | 本地跟随更新；已有 `cms_publications` 以快照为准 |

## 参考资料

- 代码实现：[src/lib/cms/catalog-sync/sync.ts](../../src/lib/cms/catalog-sync/sync.ts)（主流程）· [flatten-tree.ts](../../src/lib/cms/catalog-sync/flatten-tree.ts) · [reconcile.ts](../../src/lib/cms/catalog-sync/reconcile.ts)
- HTTP 封装：[src/lib/cms/api-endpoints.ts](../../src/lib/cms/api-endpoints.ts)（`getChannels` / `getAppList` / `getCatalogTree`）
- Schema 类型：[src/lib/cms/types.ts](../../src/lib/cms/types.ts)
- DAL：`src/lib/dal/cms-channels.ts` / `cms-apps.ts` / `cms-catalogs.ts` / `cms-sync-logs.ts`
- Inngest：`src/inngest/functions/cms-catalog-sync.ts`（daily + on-demand）
- Admin UI：`src/app/(dashboard)/settings/cms-mapping/`
- 参考 Spec：[docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md](../../docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md)
- 测试：[src/lib/cms/__tests__/catalog-sync/](../../src/lib/cms/__tests__/catalog-sync/)
- 历史版本：`git log --follow skills/cms_catalog_sync/SKILL.md`
