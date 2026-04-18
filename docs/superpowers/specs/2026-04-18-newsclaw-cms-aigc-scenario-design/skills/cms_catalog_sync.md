---
name: cms_catalog_sync
displayName: CMS 栏目同步
description: 通过华栖云 CMS 三步接口（渠道列表 → 应用列表 → 栏目树）同步 APP 侧所有可用栏目到 VibeTide 本地映射表（cms_channels / cms_apps / cms_catalogs）。支持手动触发与每日 cron，采用差量对比（insert/update/soft-delete）+ audit log。当用户提及"同步栏目""更新栏目表""刷新 CMS 栏目"或首次配置 CMS 映射时调用。
version: 1.0.0
category: action
metadata:
  scenario_tags: [configuration, setup]
  compatibleEmployees: [xiaofa, leader]
  runtime:
    type: api_call
    avgLatencyMs: 8000
    maxConcurrency: 1
    timeoutMs: 60000
  requires:
    env:
      - CMS_HOST
      - CMS_LOGIN_CMC_ID
      - CMS_LOGIN_CMC_TID
---

# CMS 栏目同步（cms_catalog_sync）

## Language

输出中文；日志中文；audit 记录使用中文描述。

## When to Use

✅ **应调用场景**：
- 首次配置 CMS 对接后，初始化栏目映射表
- 运营手动触发"立即同步"（管理 UI `/settings/cms-mapping` 的按钮）
- 每日定时同步（Inngest cron `0 2 * * *`）
- 栏目异常报错（如 `catalog_not_found`）时自动触发修复

❌ **不应调用场景**：
- CMS 凭证未配置
- 其他 skill 正在使用 `cms_publish` 且栏目映射表被频繁读（避免锁冲突，虽概率低）
- 仅为查一个特定栏目（应走 CMS 单栏目接口或查本地缓存）

## Input Schema

```typescript
export const CmsCatalogSyncInputSchema = z.object({
  organizationId: z.string().uuid(),
  // 触发源
  triggerSource: z.enum(["manual", "scheduled", "auto_repair", "first_time_setup"]).default("manual"),
  operatorId: z.string(),
  // 同步范围
  channelTypes: z.array(z.enum(["1", "2", "3", "4", "5"])).default(["1"]),  // 1=APP
  catalogTypes: z.array(z.string()).default(["1"]),  // 1=新闻栏目
  // 差量策略
  deleteMissing: z.boolean().default(true),   // 本地有但 CMS 没有 → soft delete
  dryRun: z.boolean().default(false),         // 仅报告变更，不写库
});
```

## Output Schema

```typescript
export const CmsCatalogSyncOutputSchema = z.object({
  success: z.boolean(),
  syncLogId: z.string().uuid(),
  stats: z.object({
    channelsFetched: z.number(),
    channelsUpserted: z.number(),
    appsFetched: z.number(),
    appsUpserted: z.number(),
    catalogsFetched: z.number(),
    catalogsInserted: z.number(),
    catalogsUpdated: z.number(),
    catalogsSoftDeleted: z.number(),
    unchangedCount: z.number(),
  }),
  durationMs: z.number(),
  warnings: z.array(z.string()),
  error: z.object({
    code: z.string(),
    message: z.string(),
    stage: z.enum(["auth", "channels", "apps", "catalogs", "reconcile"]),
  }).optional(),
});
```

## Pre-flight Check

```bash
# Check 1: 凭证
[ -n "$CMS_LOGIN_CMC_ID" ] && [ -n "$CMS_LOGIN_CMC_TID" ]

# Check 2: Host 可达
curl -s -o /dev/null -w "%{http_code}" "${CMS_HOST}/web/catalog/getChannels" -X POST \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" \
  -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" \
  -d '{"appAndWeb":1}' --max-time 5

# Check 3: 当前无正在进行中的同步任务（避免并发）
# SELECT 1 FROM cms_sync_logs WHERE state='running' AND organization_id=... FOR UPDATE SKIP LOCKED
```

### 失败处理

| Check | 失败 | 处理 |
|-------|------|------|
| 1 | 凭证缺失 | 抛 `CmsConfigError`；运营提示去 settings 配置 |
| 2 | Host 不可达 | 等待 30s 重试 1 次，仍失败则标为 failed |
| 3 | 并发任务已在运行 | 跳过本次，不报错；等下次 cron |

## Workflow Checklist

```
栏目同步进度：
- [ ] Step 0: 获取 CMS Client（凭证 + Host）
- [ ] Step 1: 写 sync_log 起点（state=running）
- [ ] Step 2: 拉渠道列表（getChannels）
- [ ] Step 3: 筛选 APP 渠道（code=1）
- [ ] Step 4: upsert cms_channels 表
- [ ] Step 5: 拉应用列表（getAppList type=1）
- [ ] Step 6: upsert cms_apps 表
- [ ] Step 7: 对每个 app 拉栏目树（getCatalogTree）
- [ ] Step 8: 扁平化树状结构
- [ ] Step 9: 差量对比 cms_catalogs（insert / update / soft-delete）
- [ ] Step 10: 更新 app_channels 表的关联（如需）
- [ ] Step 11: 写 sync_log 结束（state=done）+ audit
- [ ] Step 12: 触发后续事件（如通知管理员）
```

### Step 2: 拉渠道列表

```typescript
const channelsRes = await cmsClient.post<unknown, CmsChannelsData>(
  "/web/catalog/getChannels",
  { appAndWeb: 1, privilegeFlag: 0 }
);

// 返回结构示例：
// { CHANNEL_APP: { code: 1, name: "APP", pickValue: "1", thirdFlag: "2" }, ... }
```

### Step 3: 筛选 APP 渠道

```typescript
const appChannel = channelsRes.data.CHANNEL_APP;
if (!appChannel) {
  throw new CmsBusinessError("CMS 未返回 CHANNEL_APP，请检查账号权限");
}
```

### Step 4: upsert cms_channels

```typescript
await db.insert(cmsChannels).values({
  organizationId: input.organizationId,
  channelKey: "CHANNEL_APP",
  channelCode: appChannel.code,
  name: appChannel.name,
  pickValue: appChannel.pickValue,
  thirdFlag: appChannel.thirdFlag,
  lastSyncedAt: new Date(),
}).onConflictDoUpdate({
  target: [cmsChannels.organizationId, cmsChannels.channelKey],
  set: {
    channelCode: appChannel.code,
    name: appChannel.name,
    pickValue: appChannel.pickValue,
    thirdFlag: appChannel.thirdFlag,
    lastSyncedAt: new Date(),
  },
});
```

### Step 5: 拉应用列表

```typescript
const appsRes = await cmsClient.post<{ type: string }, CmsApp[]>(
  "/web/application/getAppList",
  { type: "1" }  // 1=APP 渠道
);
```

### Step 6: upsert cms_apps

```typescript
for (const app of appsRes.data) {
  await db.insert(cmsApps).values({
    organizationId: input.organizationId,
    channelKey: "CHANNEL_APP",
    cmsAppId: String(app.id),
    siteId: app.siteid,
    name: app.name,
    appkey: app.appkey,
    appsecret: app.appsecret ? encrypt(app.appsecret) : null,  // 加密存储
    addtime: app.addtime,
    lastSyncedAt: new Date(),
  }).onConflictDoUpdate({
    target: [cmsApps.organizationId, cmsApps.cmsAppId],
    set: { name: app.name, siteId: app.siteid, lastSyncedAt: new Date() },
  });
}
```

### Step 7-8: 对每个 App 拉栏目树 + 扁平化

```typescript
const allCatalogs: CatalogRow[] = [];

for (const app of appsRes.data) {
  const treeRes = await cmsClient.post<CatalogTreeRequest, CmsCatalogNode[]>(
    "/web/catalog/getTree",
    {
      appId: String(app.id),
      types: input.catalogTypes.join(","),  // "1" = 新闻栏目
      isPrivilege: "false",
    }
  );

  flattenTree(treeRes.data, app.id, app.siteid, allCatalogs);
}

function flattenTree(
  nodes: CmsCatalogNode[],
  appId: number,
  siteId: number,
  out: CatalogRow[]
): void {
  for (const node of nodes) {
    out.push({
      cmsCatalogId: node.id,
      appId,
      siteId: node.siteId ?? siteId,
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
      articleBrowse: node.articleBrowse,
      imageBrowse: node.imageBrowse,
      attachBrowse: node.attachBrowse,
      revelationBrowse: node.revelationBrowse,
      workflow: node.workflow,
    });

    if (node.childCatalog?.length) {
      flattenTree(node.childCatalog, appId, siteId, out);
    }
  }
}
```

### Step 9: 差量对比（Reconcile）

```typescript
const existing = await db.query.cmsCatalogs.findMany({
  where: and(
    eq(cmsCatalogs.organizationId, input.organizationId),
    isNull(cmsCatalogs.deletedAt),
  ),
});

const existingMap = new Map(existing.map(c => [c.cmsCatalogId, c]));
const fetchedIds = new Set(allCatalogs.map(c => c.cmsCatalogId));

const stats = { inserted: 0, updated: 0, softDeleted: 0, unchanged: 0 };

for (const fetched of allCatalogs) {
  const current = existingMap.get(fetched.cmsCatalogId);

  if (!current) {
    // 新增
    if (!input.dryRun) {
      await db.insert(cmsCatalogs).values({
        organizationId: input.organizationId,
        ...fetched,
      });
    }
    stats.inserted++;
  } else {
    // 检查是否有变更
    const changed = detectChange(current, fetched);
    if (changed.hasChange) {
      if (!input.dryRun) {
        await db.update(cmsCatalogs)
          .set({ ...fetched, lastSyncedAt: new Date() })
          .where(eq(cmsCatalogs.id, current.id));

        await writeAudit({
          organizationId: input.organizationId,
          action: "cms_catalog_updated",
          targetId: current.id,
          changes: changed.diff,
          operatorId: input.operatorId,
        });
      }
      stats.updated++;
    } else {
      stats.unchanged++;
    }
  }
}

// 本地有但 CMS 没有 → soft delete
if (input.deleteMissing) {
  for (const current of existing) {
    if (!fetchedIds.has(current.cmsCatalogId)) {
      if (!input.dryRun) {
        await db.update(cmsCatalogs)
          .set({ deletedAt: new Date() })
          .where(eq(cmsCatalogs.id, current.id));

        await writeAudit({
          organizationId: input.organizationId,
          action: "cms_catalog_soft_deleted",
          targetId: current.id,
          reason: "CMS 侧已删除",
          operatorId: input.operatorId,
        });
      }
      stats.softDeleted++;
    }
  }
}
```

### Step 10: 更新 app_channels 关联（可选）

如果 `app_channels` 表引用的 `defaultCatalogId` 被软删了，写 warning 但不自动解绑（运营介入）：

```typescript
const brokenLinks = await db.query.appChannels.findMany({
  where: and(
    eq(appChannels.organizationId, input.organizationId),
    inArray(appChannels.defaultCatalogId, softDeletedIds),
  ),
});

for (const link of brokenLinks) {
  warnings.push(`app_channel "${link.slug}" 的 defaultCatalogId=${link.defaultCatalogId} 在 CMS 已删除，请运营确认重新映射`);
}
```

### Step 11: 写 sync_log + audit

```typescript
await db.update(cmsSyncLogs).set({
  state: "done",
  stats,
  warnings,
  completedAt: new Date(),
  durationMs: Date.now() - startedAt.getTime(),
}).where(eq(cmsSyncLogs.id, syncLogId));
```

### Step 12: 触发后续事件

- 若首次同步完成 → 通知运营"可以去 `/settings/cms-mapping` 配置 app_channels 了"
- 若定时同步 → 如无异常静默完成
- 若有 warnings → 邮件/IM 通知管理员

## Decision Table

| 场景 | 策略 |
|------|------|
| 首次同步 | 全量拉取；`input.deleteMissing=true`；不限速 |
| 定时同步（cron） | 增量更新；软删除；间隔 24h |
| 手动触发修复 | 全量；重启用被标记 deleted 的栏目（如 CMS 恢复） |
| dryRun 模式 | 只统计变更，不写库；用于管理 UI 预览差异 |
| CMS 返回 0 渠道 | 不做任何修改；写 warning；不删本地数据（保护） |
| CMS 返回 0 栏目（所有 app 都空） | 同上 |

## HTTP 接口签名速查

```bash
# 1. 获取渠道
curl -X POST "${CMS_HOST}/web/catalog/getChannels" \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" \
  -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" \
  -d '{"appAndWeb":1,"privilegeFlag":0}'

# 2. 获取应用
curl -X POST "${CMS_HOST}/web/application/getAppList" \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" \
  -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" \
  -d '{"type":"1"}'

# 3. 获取栏目树
curl -X POST "${CMS_HOST}/web/catalog/getTree" \
  -H "login_cmc_id: ${CMS_LOGIN_CMC_ID}" \
  -H "login_cmc_tid: ${CMS_LOGIN_CMC_TID}" \
  -H "Content-Type: application/json" \
  -d '{"appId":"10","types":"1","isPrivilege":"false"}'
```

## 幂等性

- 每次执行重写 `cms_sync_logs` 记录
- 差量对比保证 upsert 幂等
- 同 organization 并发保护：`FOR UPDATE SKIP LOCKED` 或 advisory lock

## EXTEND.md 用户配置

```yaml
# .vibetide-skills/cms_catalog_sync/EXTEND.md

# 同步范围
sync_scope:
  channel_types: [1]            # 1=APP, 2=网站, 3=微信, 4=企鹅号, 5=微博
  catalog_types: [1, 26]        # 1=新闻, 26=OTT 短视频

# 差量策略
delete_missing: true
preserve_binding_catalogs: true  # 已被 app_channels 绑定的栏目即使 CMS 删了也仅 warning 不删

# 定时
cron_schedule: "0 2 * * *"      # 每天凌晨 2:00
timezone: Asia/Shanghai

# 通知
notify_on_warnings: true
notify_channel: email            # email / dingtalk / wecom
notify_recipients:
  - ops@example.com
```

## Feature Comparison

| Feature | cms_catalog_sync | 手动维护本地表 | CMS 直接查询 |
|---------|------------------|--------------|-------------|
| 实时性 | 24h（可调） | 完全手动 | 实时 |
| 性能 | 本地查询快 | 本地查询快 | 每次 HTTP |
| 依赖 | 需 CMS 接口 | 无 | 需 CMS 接口 |
| 差异追踪 | ✓（audit） | ✗ | ✗ |
| 支持软删 | ✓ | ✗ | ✗ |
| 复杂度 | 中 | 低 | 低 |

## Troubleshooting

| 问题 | 原因 | 解决 |
|------|------|------|
| `CmsAuthError` | 凭证失效 | 更新 env；后续 Phase 2 接 MMS/CMC 自动鉴权 |
| 返回栏目数量为 0 | CMS 侧账号无栏目权限 | 运营与 CMS 管理员沟通开权限 |
| 栏目树极大导致超时 | 某些组织有 1000+ 栏目 | 1) 增加 `timeoutMs`；2) 分 app 串行拉取（默认已如此） |
| soft delete 后又突然出现 | CMS 侧恢复栏目 | 下次同步时会重新激活（`deleted_at=null`） |
| app_channels.defaultCatalogId 失效 | CMS 删了栏目但未通知运营 | warning 会提醒；运营去 UI 重新绑定 |
| 同步后 `app.siteId` 变化 | CMS 迁移应用 | 本地跟随更新；已有 `cms_publications` 以快照为准 |
| 并发两次 cron 冲突 | schedule 错配 | advisory lock 保护（SKIP LOCKED） |

## Completion Report

```
🔄 CMS 栏目同步完成！

⏱ 耗时：{durationMs}ms
📊 统计

  📻 渠道（CMS Channels）
     • 获取：{stats.channelsFetched}
     • upsert：{stats.channelsUpserted}

  📱 应用（CMS Apps）
     • 获取：{stats.appsFetched}
     • upsert：{stats.appsUpserted}

  📂 栏目（CMS Catalogs）
     • 获取：{stats.catalogsFetched}
     • 新增：{stats.catalogsInserted}
     • 更新：{stats.catalogsUpdated}
     • 软删：{stats.catalogsSoftDeleted}
     • 未变：{stats.unchangedCount}

⚠️  警告（{warnings.length}）
{warnings.map(w => `   • ${w}`).join("\n")}

📝 下一步
   → 查看完整栏目列表：/settings/cms-mapping
   → 配置 APP 栏目映射：/settings/cms-mapping/app-channels
   → 下次自动同步：{nextCronTime}
```

## 上下游协作

### 上游
- 定时触发：Inngest cron `cms-catalog-sync` 每天 02:00
- 手动触发：运营 UI `/settings/cms-mapping` 的"立即同步"按钮
- 自动修复：`cms_publish` 发现 catalogId 无效时触发

### 下游
- `cms_publish`：读取 `cms_catalogs` + `app_channels` 查 siteId/catalogId
- 管理 UI：读取展示栏目树、绑定关系
- audit 日志：保存变更历史

## Changelog

| Version | Date | 变更 |
|---------|------|------|
| 1.0.0 | 2026-04-18 | 初版；三步同步 + 差量 reconcile + 软删 + audit |

## 参考实现文件

| 文件 | 路径 |
|------|------|
| Skill Runtime | `src/lib/agent/tools/cms-catalog-sync.ts` |
| Sync Logic | `src/lib/cms/catalog-sync.ts` |
| DAL | `src/lib/dal/cms-channels.ts` / `cms-apps.ts` / `cms-catalogs.ts` |
| Inngest | `src/inngest/functions/cms-catalog-sync.ts` |
| API Route | `src/app/api/cms/catalog-sync/route.ts` |
| Admin UI | `src/app/(dashboard)/settings/cms-mapping/` |
