# Phase 1 E2E: politics_shenzhen 场景

**状态**: 待执行 (template)

**日期**：<待填写 YYYY-MM-DD>
**执行者**：<待填写>
**环境**：<待填写 dev/test/prod>

> 本文件为 Phase 1 CMS Adapter MVP Task 38 的 E2E 验证报告模板。与 Task 37 步骤结构完全相同，仅场景切换到 `app_politics`，用以验证时政稿（严档审核）也能走通同样流程。实际执行时请将各占位符替换为真实值，并根据"验证清单"逐项勾选，然后把"问题与修正"栏补齐。
>
> **严档审核说明**：时政稿 `publishStatus=approved` 后是否仍需在 CMS 侧人工复核，取决于 CMS 租户配置。轮询期间若 `status` 停在 `20`，属预期行为。

---

## Prerequisites（前置）

> 首次执行前，按以下顺序完成环境与凭证准备。对应计划 G.0 节。

### 1. 查测试 organization 的 id

```bash
psql $DATABASE_URL -c "SELECT id, name, created_at FROM organizations ORDER BY created_at ASC LIMIT 5;"
```

预期输出含至少 1 条记录。**选 `name` 含 "测试" / "test" / "demo" 的 org（无测试 org 时选最早的）**，导出到 shell：

```bash
export ORG_ID="<从上一步复制的 uuid>"
echo "ORG_ID=$ORG_ID"
```

也可以直接落到 `.envrc`（direnv）或 `~/.zshrc` 备用。

### 2. 获取 auth cookie（用于 API 测试）

两种方式任选：

**方式 A（推荐，浏览器拿）**：
1. 浏览器打开 `http://localhost:3000/login`，用测试账号登录
2. DevTools → Application → Cookies → `http://localhost:3000`
3. 复制 `sb-<project>-auth-token` 的值（通常是 base64 JSON）
4. 写入临时文件：
   ```bash
   cat > .claude-test-cookie <<EOF
   sb-<project>-auth-token=<刚才复制的值>
   EOF
   chmod 600 .claude-test-cookie
   echo '.claude-test-cookie' >> .gitignore
   ```

**方式 B（CLI 签发）** —— 仅测试 org 可用，借 supabase service role：
```bash
# 需要 SUPABASE_SERVICE_ROLE_KEY 在 .env.local
npx tsx scripts/issue-test-cookie.ts --email=<test-user@example.com> \
  > .claude-test-cookie
```
（若 `scripts/issue-test-cookie.ts` 不存在，用方式 A。）

### 3. 快速连通性自检

```bash
# 1) DB 能连：
psql $DATABASE_URL -c "SELECT slug FROM app_channels WHERE organization_id = '$ORG_ID' ORDER BY sort_order;"
# 预期输出 9 行 (app_home ... app_drama)

# 2) 应用已启动：
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health 2>/dev/null || curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
# 预期 200 (或 302 登录页)

# 3) Cookie 有效：
curl -s http://localhost:3000/api/cms/catalog-sync \
  -X POST -H "Content-Type: application/json" \
  --cookie "$(cat .claude-test-cookie)" \
  -d '{"dryRun":true}' | head -c 200
# 预期返回 JSON 而非 "Unauthorized"
```

### 4. 占位符替换规则

| 占位符 | 替换为 |
|--------|-------|
| `<ORG_ID>` | 来自上一步的 `$ORG_ID`，直接写成 `'$ORG_ID'` 或 `${ORG_ID}` |
| `<POLITICS_ARTICLE_ID>` | 每次执行 Step 38.2 后 console.log 的返回值 |
| `<CMS_ARTICLE_ID_FROM_STEP_38_3>` | Step 38.3 的 `result.cmsArticleId` |
| `<picked_politics_catalog_uuid>` | Step 38.1 查 `cms_catalogs` 挑一条的 id |
| `--cookie "..."` | `--cookie "$(cat .claude-test-cookie)"` |

---

## Execution Steps（执行步骤）

> 本场景复用 Task 37 Step 37.1（数据前置条件：`CMS_*` 凭证、feature flag、`npm run db:seed`、`catalog-sync` API）。若本次与 Task 37 同一环境连续执行，可跳过 Step 37.1，只需确认 `VIBETIDE_CMS_PUBLISH_ENABLED=true` 仍生效。

### Step 38.1: 运营配置：绑定 app_politics → cms_catalog

```bash
# 1. 查一个合适的 CMS 时政栏目（type=1、active，名称含"时政/政务/政策"）
psql $DATABASE_URL <<SQL
SELECT id, cms_catalog_id, name FROM cms_catalogs
WHERE organization_id = '<ORG_ID>'
  AND catalog_type = 1 AND deleted_at IS NULL
  AND (name ILIKE '%时政%' OR name ILIKE '%政务%' OR name ILIKE '%政策%')
LIMIT 5;

-- 2. 绑定 app_politics
UPDATE app_channels
SET default_catalog_id = '<picked_politics_catalog_uuid>',
    default_list_style = '{"listStyleType":"0","listStyleName":"默认","imageUrlList":[]}'::jsonb,
    updated_at = NOW()
WHERE organization_id = '<ORG_ID>' AND slug = 'app_politics';
SQL
```

### Step 38.2: 创建 politics 测试 article

```bash
npx tsx -e "
import { db } from './src/db';
import { articles } from './src/db/schema';
const [row] = await db.insert(articles).values({
  organizationId: '<ORG_ID>',
  title: '【测试】《深圳市促进人工智能产业高质量发展若干措施》发布',
  body: '<p>4 月 17 日，深圳市第 X 届人民代表大会常务委员会第 XX 次会议审议通过……</p>',
  authorName: '智媒编辑部',
  summary: '深圳市 AI 产业政策发布。',
  tags: ['时政', '深圳', 'AI 产业'],
  publishStatus: 'approved',
  mediaType: 'article',
}).returning({ id: articles.id });
console.log(row);
"
```

记录返回的 `article.id`（下一步用，填入下方"执行记录"）。

### Step 38.3: 触发 publishArticleToCms（appChannelSlug='app_politics'）

```bash
npx tsx -e "
import { publishArticleToCms } from './src/lib/cms';
const result = await publishArticleToCms({
  articleId: '<POLITICS_ARTICLE_ID>',
  appChannelSlug: 'app_politics',
  operatorId: 'manual-e2e',
  triggerSource: 'manual',
});
console.log(JSON.stringify(result, null, 2));
"
```

**预期输出**：
```
{
  success: true,
  publicationId: '...',
  cmsArticleId: '925xxx',
  cmsState: 'submitted',
  publishedUrl: 'https://web.demo.chinamcloud.cn/cms/...',
  previewUrl: 'https://api.demo.chinamcloud.cn/...',
  timings: { totalMs: <3000, mappingMs: <100, httpMs: <2000 }
}
```

### Step 38.4: 验证 cms_publications 表

```bash
psql $DATABASE_URL <<SQL
SELECT id, cms_state, cms_article_id, cms_type, attempts,
       submitted_at, synced_at, error_code, error_message
FROM cms_publications
WHERE article_id = '<POLITICS_ARTICLE_ID>'
ORDER BY created_at DESC
LIMIT 1;
SQL
```

预期：`cms_state = 'submitted'`、`cms_article_id` 非空、`error_code` NULL、`attempts = 1`。

### Step 38.5: 验证 Inngest 轮询被触发

打开 Inngest dev UI（`http://localhost:8288`）→ Functions → `cms-status-poll` → Runs。

预期：有一条运行记录，执行 1-5 次 `poll-N` step 后，最终 state 变为 `synced` 或保留 `submitted`（取决于 CMS 侧是否自动发布）。

> **严档审核**：时政稿 `publishStatus=approved` 后是否仍需在 CMS 侧人工复核，取决于 CMS 租户配置。轮询期间若 `status` 停在 `20`，属预期行为。

### Step 38.6: 验证 CMS 端确实收到稿件

```bash
# 用 getArticleDetail 查 CMS
npx tsx -e "
import { CmsClient, getArticleDetail, requireCmsConfig } from './src/lib/cms';
const config = requireCmsConfig();
const client = new CmsClient(config);
const detail = await getArticleDetail(client, '<CMS_ARTICLE_ID_FROM_STEP_38_3>');
console.log('CMS 上的稿件状态：', detail.data?.status, detail.data?.title);
"
```

或者直接打开 `previewUrl` 在浏览器验证。

---

## 执行记录

- `VIBETIDE_CMS_PUBLISH_ENABLED=true` ✓ / ✗（填写）
- cms_catalog_sync 已执行 ✓ / ✗（栏目数 `<N>`）
- app_politics 已绑定 cms_catalog ✓ / ✗（catalogId=`<cmsCatalogId>`）

- Article ID: `<待填写>`
- Publication ID: `<待填写>`
- CMS Article ID: `<925xxx>`
- 首次入库耗时: `<totalMs>` ms

---

## Verification Checklist（验证清单）

| 检查项 | 状态 | 备注 |
|--------|------|------|
| publishArticleToCms 返回 success=true | ☐ | |
| cms_publications 表记录 state=submitted | ☐ | |
| cms_article_id 非空、error_code NULL、attempts=1 | ☐ | |
| Inngest cms-status-poll 执行 | ☐ | `<N>` 次 poll |
| 最终 state | ☐ synced / ☐ submitted | 时政严档若停在 status=20 属预期 |
| CMS previewUrl 可访问 | ☐ | 人眼确认内容正确 |
| 稿件 title/content/author 与源一致 | ☐ | |
| timings.totalMs < 3000、httpMs < 2000 | ☐ | |

---

## Issues & Fixes（问题与修正）

待执行后填入。

> 如无问题：「无」
> 如有问题：记录现象 + 根因 + 已修或遗留
>
> **提示**：严档审核：时政稿 publishStatus=approved 后是否仍需在 CMS 侧人工复核，取决于 CMS 租户配置。轮询期间若 status 停在 20，属预期行为。

---

## 附：一张 APP 端截图（如已有 APP 端）

待执行后填入（img 或 文字描述）。

---

**执行完成日期**：<待填写 YYYY-MM-DD>
**最终执行者签名**：<待填写>
