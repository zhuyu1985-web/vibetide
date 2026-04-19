**状态**: 待执行 (checklist template)

# Phase 1 Smoke Test

**执行日期**：<YYYY-MM-DD>
**执行者**：<name>

## A. 单元测试与编译

- [ ] `npm run test -- src/lib/cms/ src/lib/dal/` 全绿
- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm run lint` 零 warning

## B. 数据库

- [ ] `npm run db:push` 无 schema drift
- [ ] `npm run db:studio` 能看到 6 张新表：
  cms_channels / cms_apps / cms_catalogs / cms_sync_logs / cms_publications / app_channels
- [ ] `app_channels` 有 9 行 seed 数据（按 slug 排序完整）

## C. CMS 连通性

- [ ] Pre-flight：`curl -s -o /dev/null -w "%{http_code}" "$CMS_HOST/web/catalog/getChannels"` → 200
- [ ] `npx tsx -e "import { CmsClient, getChannels, requireCmsConfig } from './src/lib/cms'; const c = new CmsClient(requireCmsConfig()); console.log(await getChannels(c));"` → CHANNEL_APP 出现

## D. 栏目同步

- [ ] `POST /api/cms/catalog-sync?dryRun=false` → success + 统计非 0
- [ ] `cms_sync_logs` 最新一行 state='done'
- [ ] `cms_catalogs` 表 count > 0

## E. 运营配置 UI

- [ ] `/settings/cms-mapping` 打开不报错
- [ ] bindings tab 能看到 9 个 APP 栏目 + 下拉 + 保存生效
- [ ] catalogs tab 能看到栏目树
- [ ] logs tab 能看到同步日志（最近 5 条）

## F. End-to-End 场景

- [ ] news_standard 场景：从 approved article → publishArticleToCms → submitted → synced
  （详见 phase1-e2e-news.md）
- [ ] politics_shenzhen 场景：同上
  （详见 phase1-e2e-politics.md）

## G. Inngest 函数注册

Inngest dev UI (`http://localhost:8288`) 能看到这 4 个 function：

- [ ] `cms-catalog-sync-daily`（cron: `TZ=Asia/Shanghai 0 2 * * *`）
- [ ] `cms-catalog-sync-on-demand`（event: `cms/catalog-sync.trigger`）
- [ ] `cms-status-poll`（event: `cms/publication.submitted`）
- [ ] `cms-publish-retry`（event: `cms/publication.retry`）

## H. 异常场景

- [ ] Feature flag 关闭时 publishArticleToCms 立即抛错且不写库
- [ ] CMS 鉴权失败（故意改 `CMS_LOGIN_CMC_ID`）时整个 catalog-sync 链路写 failed log，不损坏已有数据
- [ ] app_channel 未绑定 catalog 时 publishArticleToCms 抛 `app_channel_not_mapped`
- [ ] 同一 article 连续触发两次 publishArticleToCms，第二次走 MODIFY 路径（articleId 被复用）

## I. 代码质量自检

- [ ] grep 不到直接访问 `process.env.CMS_*` 的代码（必须走 `requireCmsConfig()`）
  ```bash
  grep -r "process.env.CMS_" src --include="*.ts" | grep -v "feature-flags.ts"
  # 预期：零条
  ```
- [ ] grep 不到绕过 `src/lib/cms` 直接 fetch CMS 的代码
  ```bash
  grep -rn "/web/article/save\|/web/catalog/getTree" src --include="*.ts" | grep -v "src/lib/cms/"
  # 预期：零条
  ```

## 结论

全部通过：**Phase 1 可移交测试 organization 进入 β 灰度**。

若任一项未通过：附 issue 清单，归类到 "阻塞 / 警告 / 优化"，阻塞项必须修完才能合入 main。
