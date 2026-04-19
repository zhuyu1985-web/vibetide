# Demo E2E 演示脚本 + 烟雾测试清单

**日期：** 2026-04-20
**Scope：** 6 大场景 × 3 形态的端到端 demo 流程

**闭环：** 灵感池热点 → 一键生成 → AI 员工执行 → Mission 完成 → 自动发到华栖云 CMS

---

## 前置检查（运行 demo 前）

### A. 环境变量

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide/.worktrees/phase1-cms-adapter-mvp
grep -c "^\s*CMS_" /Users/zhuyu/dev/chinamcloud/vibetide/.env.local
# 期望: >= 5 (CMS_HOST/CMS_LOGIN_CMC_ID/CMS_LOGIN_CMC_TID/CMS_TENANT_ID/CMS_USERNAME)
grep -c "^\s*VIBETIDE_CMS_PUBLISH_ENABLED=true" /Users/zhuyu/dev/chinamcloud/vibetide/.env.local
# 期望: 1
```

### B. 数据库状态

```bash
set -a; source .env.local; set +a
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM workflow_templates WHERE is_builtin=true;" -t
# 期望: >= 37（demo org，10 demo + 27 legacy）
psql "$DATABASE_URL" -c "SELECT name FROM workflow_templates WHERE legacy_scenario_key IN ('daily_ai_brief','weekly_tech_report','daily_politics','daily_podcast','daily_tandian','daily_sports_report','daily_zhongcao','premium_content','local_news','national_daily_brief') ORDER BY name;"
# 期望: 10 行（本地新闻 / 全国热点图文 / 每日 AI 资讯 / 每日川超战报 / 每日探店 / 每日时政热点 / 每日热点播客 / 种草日更 / 精品内容 / 科技周报）
```

### C. CMS 栏目同步（首次运行 demo 前必须）

```bash
npx tsx scripts/run-catalog-sync.ts
# 期望: success=true, channelsFetched>=1, catalogsFetched>=10
# ❌ 失败 → CMS 网络问题，参考「故障排查」
```

### D. APP 栏目绑定（首次必做）

`/settings/cms-mapping` → 把 9 个 APP 栏目绑到对应的 CMS 栏目 ID。

**最低演示要求：**
- `app_news` 绑一个新闻类 CMS 栏目
- `app_livelihood_podcast` 绑一个播客栏目
- `app_livelihood_tandian` 绑一个探店栏目
- `app_livelihood_zhongcao` 绑一个种草栏目
- `app_politics` 绑一个时政栏目

没绑的场景在 `publishArticleToCms` 时会抛 `CmsConfigError("app_channel_not_mapped")`。

### E. dev server

```bash
npm run dev
# 浏览器打开 http://localhost:3000
```

---

## 演示流程（6 场景 × 3 形态）

### 演示入口：/inspiration（灵感池）

1. 登录后进入 `/inspiration`
2. 页面展示今日热点话题列表（卡片）
3. **每个卡片右下角的 "▶️ 生成稿件" 按钮**

### 📖 场景 1：每日 AI 资讯（图文）

**演示路径：**
1. `/inspiration` → 找一张 AI 相关热点卡片
2. 点 "▶️ 生成稿件" → 弹 Sheet
3. 顶部 tab 选 "日报" → 选 "每日 AI 资讯"（icon: Brain，team: xiaolei/xiaowen/xiaofa）
4. 点 "立即生成 ▶️" → 跳到 `/missions/{id}`

**期望 mission console 看到：**
- mission.title = 你选的热点标题
- 5 个 step 逐步变绿：全网 AI 资讯聚合 → 热点价值评估 → AI 简报生成 → 质量审核 → 发布到新闻 APP
- 每步有 xiaolei/xiaowen/xiaofa 头像显示执行中

**期望 mission 完成后：**
- Mission 状态 → completed
- Console 输出："📝 已生成稿件「<title>」，正在推送到华栖云 CMS（app_news）..."
- Console 输出："✅ CMS 入库成功！cmsArticleId=<number>，预览：https://..."
- `workflow_artifacts` 表出现一条 `cms_publication` 记录
- `cms_publications` 表有一条 `cmsState=submitted` 记录

**若 CMS 不通：** 第二行消息变 "⚠️ CMS 入库失败：<原因>。稿件已保存为 draft，可稍后手动发布。"

---

### 🧠 场景 2：科技周报（深度长文）

**路径：** `/inspiration` → 热点卡片 → 选 "深度" tab → **科技周报**（icon: Newspaper）
**期望耗时：** 较长（6 步，字数 3000+），可能需要 2-5 分钟
**发到：** `app_news`

---

### 🏛️ 场景 3：每日时政热点

**路径：** `/inspiration` → 时政类热点 → "新闻" tab → **每日时政热点**
**期望：** 严档审核（compliance_check 步骤），发到 `app_politics`
**注意：** 若 topic 含敏感词，Mission 可能在 compliance 步 fail，这是预期行为

---

### 🎙️ 场景 4：每日热点播客

**路径：** `/inspiration` → 任意热点 → "播客" tab → **每日热点播客**（icon: Mic，team: xiaoce/xiaowen/xiaofa/xiaojian）
**期望：**
- 生成播客脚本（对话体，8-12 分钟）
- TTS 步骤（audio_plan skill）
- 发到 `app_livelihood_podcast`

---

### 🍽️ 场景 5：每日探店

**路径：** `/inspiration` → 本地探店话题 → "民生" tab → **每日探店**
**期望：**
- 输入城市（默认成都）+ 店型（默认餐饮）
- 6 阶段探店脚本
- 合规扫描（广告法）
- AIGC 视频生成（video_edit_plan）
- 发到 `app_livelihood_tandian`

---

### ⚽ 场景 6：每日川超战报

**路径：** `/inspiration` → 体育赛事热点 → "新闻" tab → **每日川超战报**（icon: Trophy）
**期望：** 发到 `app_sports`

---

### 💝 场景 7：种草日更

**路径：** `/inspiration` → 商品/趋势类热点 → "民生" tab → **种草日更**
**期望：**
- 选平台（小红书/抖音/B 站/视频号）
- 广告法极限词扫描
- 发到 `app_livelihood_zhongcao`

---

### 💎 场景 8：精品内容（深度大稿）

**路径：** `/inspiration` → 重大热点 → "深度" tab → **精品内容**（6 人团队）
**期望：**
- 最长耗时，7 步 workflow
- 包含 fact_check（事实核查）步骤
- 发到 `app_news` 头条

---

### 📍 场景 9：本地新闻

**路径：** `/inspiration` → 本地热点 → "新闻" tab → **本地新闻**
**期望：** 发到 `app_news`（本地频道）

---

### 🔥 场景 10：全国热点图文

**路径：** `/inspiration` → 任何热榜话题 → "日报" tab → **全国热点图文**
**期望：** 
- 聚合 Top N 热点（默认 10）
- 发到 `app_home`（首页头条）

---

## 烟雾测试清单

按顺序勾选；任何一条失败 → demo 走不通。

### 环境

- [ ] `.env.local` 含 6+ CMS_* + VIBETIDE_CMS_PUBLISH_ENABLED=true
- [ ] `npm run build` 成功
- [ ] `npx tsc --noEmit` 0 errors
- [ ] `npm run dev` 启动无错误
- [ ] Inngest dev server 启动 (`npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`)
- [ ] 登录 `/login` 成功进入 `/home`

### 数据

- [ ] `workflow_templates` 有 >= 37 行 builtin (demo org)
- [ ] 10 个新 demo scenarios 都在（按 legacy_scenario_key 检查）
- [ ] `cms_catalogs` 至少有 1 行（catalog-sync 跑过）
- [ ] `app_channels` 至少 3 个已绑定 `default_catalog_id`

### UI

- [ ] `/home` 场景网格显示 builtin workflows（>= 20 个卡片）
- [ ] `/inspiration` 页面热点卡片右下角看到 "▶️ 生成稿件" 按钮
- [ ] 点按钮弹 Sheet 显示 workflow 分类 tab（日报/新闻/深度/民生/播客）
- [ ] 选 workflow 高亮；点 "立即生成" 跳 `/missions/{id}`

### Mission 执行

- [ ] mission console 看到 leader-plan 发起规划
- [ ] 各 step 依次执行（可在 Inngest dev UI 看 run log）
- [ ] leader-consolidate 跑完
- [ ] Console 显示 "📝 已生成稿件" + "✅ CMS 入库成功" 或 "⚠️ CMS 入库失败"
- [ ] `workflow_artifacts` 表有 `cms_publication` 记录
- [ ] `missions.final_output` 有内容
- [ ] `articles` 表新增一行，status=approved
- [ ] `cms_publications` 表新增一行（若 CMS 通）

### CMS（仅网络通时）

- [ ] `cms_publications.cms_state` = `submitted` 或 `synced`
- [ ] `cms_publications.cms_article_id` 非空（是真 CMS 侧 ID）
- [ ] `cms_publications.preview_url` 可打开（预览真实稿件）
- [ ] 华栖云 CMS 后台能看到新稿件

---

## 故障排查

### 故障 1：CMS 网络不通（fetch failed / EPROTO）

**现象：** mission 完成后 Console 显示 "⚠️ CMS 入库失败：CMS 网络错误：fetch failed"

**排查步骤：**
1. 检查 VPN：`cms.demo.chinamcloud.cn` 解析 `198.18.0.49`，这是 RFC 2544 benchmark 保留段，确认你机器在华栖云内网或 VPN
2. 测连通性：
   ```bash
   curl -v http://cms.demo.chinamcloud.cn/web/catalog/getChannels -X POST -H "Content-Type: application/json" -d '{}'
   # 期望 200 或 401/403（说明能达）
   # 若 "connection refused" / 超时 → 网络不通
   ```
3. 验证凭证：登录华栖云 CMS 后台 → 看 `.env.local` 里的 login_cmc_id/tid 是否对应有效会话

### 故障 2：app_channel_not_mapped

**现象：** `publishArticleToCms` 抛 `CmsConfigError("app_channel_not_mapped: app_xxx")`

**修复：** `/settings/cms-mapping` 把对应 APP 栏目绑 CMS catalog。

### 故障 3：Mission 执行中卡住

**现象：** mission console 某个 step 长时间 running

**排查：**
1. Inngest dev UI (`http://localhost:8288`) 看该 step 实际 error
2. 常见原因：DeepSeek API 超时 / tool 调用失败 / skill 产出 schema 不合

**演示 fallback：** 取消当前 mission，换个主题重试；或切换到已执行过的 mission 演示回放效果。

### 故障 4：生成的稿件太短/质量差

**原因：** 热点描述信息量不足 + DeepSeek 默认不够"用力"

**解决：** 用户在 `/inspiration` → Sheet 里填的 `userInstruction` 要详细一点；或选择"精品内容"而不是"快讯"场景。

---

## Demo 讲解建议

### 开场（1 分钟）
"VibeTide 目标是让媒体的内容生产流程可扩展。左边是**灵感池**，AI 自动聚合全网热点；右边是**任务中心**，8 个 AI 员工 + N 个工作流协作产出内容，最后一键发到华栖云 CMS。"

### 主演示（3 分钟）
1. 打开 `/inspiration` → "看，这是今日热点，我选一个 AI 大模型相关的"
2. 点 "▶️ 生成稿件" → "弹出工作流选择面板，按内容类型分类：日报、新闻、深度、民生、播客"
3. 选 "每日 AI 资讯" → "这个场景会让 xiaolei 聚合、xiaowen 写稿、xiaofa 审核，完成后自动发到新闻 APP"
4. 点 "立即生成" → 跳 mission console
5. "你看 5 个步骤依次被 AI 员工完成，完全自动化"（等执行期间切换回 /inspiration 讲其他场景）

### 扩展展示（2 分钟）
- "除了图文，还支持**播客**和**探店视频**"（切到 /inspiration 选种草日更 或 每日探店 workflow，指向对应的 team 和 appChannelSlug）
- "发布目标是**9 个固定 APP 栏目**，和华栖云 CMS 直通"

### 闭环展示（1 分钟）
- 回到 mission console → 展示完成消息："✅ CMS 入库成功！预览：https://..."
- 点预览链接 → 看真实 CMS 上的稿件（如果 CMS 通）
- 或展示 `workflow_artifacts` 里的 cms_publication 记录

---

## 演示后 Q&A 可能问题

**Q: AI 员工是怎么选出来的？**
A: workflow_template 的 `defaultTeam` 字段预定义了推荐团队；用户可以在 /workflows 编辑自定义。

**Q: 能新增场景吗？**
A: 2 种方式——管理后台 `/workflows/new` 可视化创建；或 seed 脚本批量添加。

**Q: CMS 连不上怎么办？**
A: 稿件先存 articles 表，状态 draft，运营可以手动触发 publish。不丢数据。

**Q: 合规怎么保证？**
A: 每个敏感场景（时政、种草）都有独立的 `compliance_check` skill，扫描广告法极限词、政治敏感、法律红线。审核不通过 mission 会 fail。

**Q: 能扩展到其他 CMS 吗？**
A: 适配层 `src/lib/cms/` 是插件化设计，华栖云实现占位，后续可加 DedeCMS、Discuz、自研系统适配器。

---

## 打点 / 监控建议

- Inngest dev UI (`http://localhost:8288`)：实时看每个 function 的 run log
- Supabase Studio：看 missions / articles / cms_publications 三张表
- `tail -f` dev server log：看 fetch / SQL / step 执行

---

## Follow-up（演示通过后）

1. **B.2 清理** legacy scenario constants（已推迟；独立 spec 在 `docs/superpowers/specs/2026-04-19-scenario-legacy-cleanup-spec.md`）
2. **CMS 网络修复** → 跑 `scripts/run-catalog-sync.ts` 把栏目同步进来
3. **填充 3 个 script-heavy subtemplates**（duanju / zhongcao / podcast 子类型完整规范）
4. **/scenarios/customize** 页面迁到 /workflows/new（改 redirect）
5. **手动 UI smoke** for B.1 Task 20

---

## 总结：今日交付

- ✅ **Demo Phase 1**：10 个 demo workflow_templates（37 个 builtin 总计）
- ✅ **Demo Phase 2**：`/inspiration` 页加"生成稿件"按钮 + workflow 选择 Sheet
- ✅ **Demo Phase 3**：`leader-consolidate` 自动发 CMS（代码已就绪，等 CMS 网络）
- ✅ **Demo Phase 4**：本演示脚本 + 烟雾清单
- 🔴 **阻塞：** CMS 网络不通（HTTP 403 + 非标准 HTTP/1.1 response），待运维/VPN 修复
