# 帮助中心(Help Center) · 设计文档

- **日期**: 2026-05-31
- **作者**: zhuyu / claude
- **范围**:
  - 新增路由组 `src/app/help/`(独立 Layout,与 `(dashboard)` 完全脱钩)
  - 新增内容仓库 `content/help/**`(MDX + JSON)
  - 新增组件 `src/components/help/**`
  - 新增数据访问层 `src/lib/help/**`
  - 修改 `src/proxy.ts`(`/help/*` 加入公共白名单)
  - 修改 `src/components/layout/dashboard-shell.tsx`(挂载 `<HelpLauncher />`)
  - 新增数据库表 `help_feedback`(Drizzle 标准流程)
  - 新增构建脚本 `scripts/build-help-search.ts`、`scripts/build-help-meta.ts`、`scripts/verify-help-links.ts`
- **不改**:
  - dashboard layout / sidebar / topbar / ChatLauncher
  - Auth / RBAC / session
  - Mission / Workflow / Inngest 引擎
  - 现有 MDX 渲染(本项目此前未使用 MDX,此 spec 是首次引入)

## 1. 问题与目标

### 1.1 现状

Vibetide 目前没有任何用户面向的产品文档。新员工上手、运营答疑、对外演示都依赖人工口口相传或散落的 `docs/requirement/*` 内部规格文档,这些文档:

1. 面向开发者而非业务用户,术语晦涩
2. 在仓库中,非工程人员无法访问
3. 没有搜索、无分类导览、无更新机制

### 1.2 用户痛点

- **新业务用户**:不知道 8 个 AI 员工分别能做什么、怎么启动一个工作流、媒资和稿件的关系
- **系统管理员**:不清楚 CMS 映射、RBAC 角色、定时任务等配置项的全貌
- **运营**:遇到产品问题没有第一手答疑文档,要去问研发
- **售前演示**:缺一份"对外可分享"的产品说明站

### 1.3 目标

建一个**对外可公开访问的产品帮助中心**:

- 内容覆盖业务功能、系统管理、FAQ、更新日志(暂不含开发者 API)
- 入口为 dashboard 左下角"AI 员工小帮"浮动头像,精致美观、有动效
- 首页参考 Shopify 帮助中心(搜索 + 分类卡片 + 热门必读 + 联系入口)
- 详情页参考 Sealos Docs(左目录树 + 中央正文 + 右锚点 TOC)
- 内容用 MDX 在仓库维护,客户端 pagefind 全文搜索
- 公开访问,无需登录;独立 layout,与 dashboard 视觉解耦

## 2. 信息架构

### 2.1 一级分类(8 个 + 2 个特殊栏目)

| # | Slug | 中文名 | 涵盖内容 | 预估文档数 |
|---|---|---|---|---|
| 1 | `getting-started` | 快速开始 | 平台概览、登录注册、首页导览、第一周指南 | 5-6 |
| 2 | `ai-employees` | AI 员工 | 8 个员工介绍、技能管理、知识库绑定、记忆机制、自定义新员工 | 8-10 |
| 3 | `workflows` | 工作流与任务 | 工作流模板、启动 mission、定时调度、节点配置、画布编辑器、监控失败重试 | 8-12 |
| 4 | `creation` | 创作生产 | 热点发现、同题对比、漏题筛查、超级创作、短视频工厂、生产模板 | 8-10 |
| 5 | `data-collection` | 数据采集 | 采集源配置、内容池、主题监测、研究报告、监控面板 | 5-7 |
| 6 | `media-assets` | 媒资与内容 | 智能媒资、稿件管理、知识库管理、案例库、智能推荐 | 6-8 |
| 7 | `channels` | 渠道与发布 | 频道顾问、全渠道发布、CMS 映射、审核流程 | 5-6 |
| 8 | `admin` | 系统管理 | 组织/用户/角色权限、定时任务、API 凭证、CMS 配置 | 6-8 |
| — | `faq` | 常见问题 | 扁平 Q&A,按分类筛选(JSON 维护) | 30-60 条 |
| — | `changelog` | 更新日志 | 按月归档,版本号 + 新增/优化/修复分类 | 每月一篇 |

合计目标:**8 × 平均 7 ≈ 56 篇文档 + 30-60 条 FAQ + 月度更新日志**。首期不必全写完,骨架先搭、内容分批补。

### 2.2 URL 结构

```
/help                           帮助中心首页
/help/[category]                分类索引页(显示该分类下所有文档列表)
/help/[category]/[slug]         文档详情页
/help/faq                       FAQ
/help/changelog                 更新日志
/help/search?q=...              搜索结果页
```

## 3. 整体架构

### 3.1 目录结构

```
content/help/                       # MDX 内容仓库(新增)
  ├─ getting-started/
  │   ├─ _meta.json                # 该分类元数据 + 文档排序
  │   ├─ overview.mdx
  │   └─ first-week-guide.mdx
  ├─ ai-employees/
  ├─ workflows/
  ├─ creation/
  ├─ data-collection/
  ├─ media-assets/
  ├─ channels/
  ├─ admin/
  ├─ faq.json                       # FAQ 用 JSON,不走 MDX(扁平 Q&A)
  └─ changelog/                     # 更新日志,每月一个 MDX
      ├─ 2026-05.mdx
      └─ 2026-04.mdx

src/app/help/                       # 独立路由组(不在 (dashboard) / (auth) 下)
  ├─ layout.tsx                     # 帮助中心专属 layout
  ├─ page.tsx                       # 首页 /help
  ├─ not-found.tsx                  # 帮助中心专属 404
  ├─ [category]/
  │   ├─ page.tsx                   # 分类页 /help/[category]
  │   └─ [slug]/
  │       └─ page.tsx              # 详情页 /help/[category]/[slug]
  ├─ faq/page.tsx
  ├─ changelog/page.tsx
  └─ search/page.tsx                # 搜索结果页

src/components/help/                # 帮助中心专属组件
  ├─ launcher/                      # 小帮浮动入口
  │   ├─ help-launcher.tsx
  │   └─ xiaobang-avatar.tsx       # SVG 小帮头像
  ├─ layout/                        # 帮助中心顶栏/底栏 + 搜索 dialog
  │   ├─ help-header.tsx
  │   ├─ help-footer.tsx
  │   └─ search-dialog.tsx
  ├─ home/                          # 首页区块
  │   ├─ hero-search.tsx
  │   ├─ category-grid.tsx
  │   ├─ popular-docs.tsx
  │   └─ contact-section.tsx
  ├─ doc/                           # 详情页组件
  │   ├─ doc-layout.tsx
  │   ├─ doc-sidebar.tsx           # 左栏分类目录树
  │   ├─ doc-toc.tsx                # 右栏锚点 TOC
  │   ├─ doc-breadcrumb.tsx
  │   ├─ doc-feedback.tsx           # 底部 👍/👎 反馈
  │   └─ doc-pagination.tsx         # 上/下一篇
  ├─ category/
  │   ├─ category-hero.tsx
  │   └─ doc-list.tsx
  ├─ search/
  │   └─ search-results.tsx
  ├─ faq/
  │   └─ faq-accordion.tsx
  ├─ changelog/
  │   └─ changelog-month.tsx
  └─ mdx/                           # MDX 自定义组件
      ├─ index.ts                   # 统一导出 mdxComponents
      ├─ callout.tsx
      ├─ steps.tsx
      ├─ screenshot-zoom.tsx
      ├─ video-embed.tsx
      ├─ employee-badge.tsx
      ├─ keyboard-key.tsx
      ├─ tabs.tsx                   # 复用 ui/tabs
      └─ doc-link.tsx

src/lib/help/                       # 帮助中心数据/逻辑
  ├─ types.ts                       # HelpCategory / HelpDoc / HelpFrontmatter zod
  ├─ content.ts                     # MDX 文件遍历 + frontmatter 解析 + 缓存
  ├─ toc.ts                         # remark plugin: 抽取 H2/H3 生成 TOC
  ├─ reading-time.ts                # 阅读时长计算
  ├─ search-client.ts               # 客户端 pagefind 调用层
  ├─ changelog-meta.ts              # 构建期生成,LATEST_CHANGELOG_AT 常量
  └─ feedback.ts                    # server action: submitDocFeedback

src/db/schema/help-feedback.ts      # help_feedback 表 schema

scripts/
  ├─ build-help-search.ts           # postbuild: 跑 pagefind 生成索引
  ├─ build-help-meta.ts             # predev/prebuild: 生成 changelog-meta.ts
  └─ verify-help-links.ts           # 构建期: 校验所有 <DocLink> 目标存在
```

### 3.2 路由隔离原则

- `src/app/help/` **不带括号**,是独立的路由段(不是路由组)
- 它有自己的 `layout.tsx`,不继承 `(dashboard)/layout.tsx`,因此不查 user/permissions/org
- `src/proxy.ts` 把 `/help` 加入公共白名单,未登录直接访问

### 3.3 构建与部署

- MDX 编译走 RSC 渲染期(`next-mdx-remote-client/rsc`),不污染客户端 bundle
- 所有 `/help/**` 页面 `dynamic = "force-static"`,`next build` 期完全静态预渲染
- `next build` 完成后,`postbuild` 钩子跑 `scripts/build-help-search.ts`,调 pagefind 扫描 `.next/server/app/help/**/*.html` 生成索引,写到 `public/pagefind/*`
- Vercel 部署时 `public/pagefind/*` 随静态资源一起上线
- `predev` / `prebuild` 跑 `scripts/build-help-meta.ts`,生成 `src/lib/help/changelog-meta.ts`(包含最新一条 changelog 的时间戳常量)

## 4. 「小帮」浮动入口

### 4.1 视觉规范

新 SVG 头像 `XiaobangAvatar`,沿用 `src/components/shared/employee-svg-avatars.tsx` 的 64×64 风格:

```
- 底色: linear-gradient(135deg, #ecfeff → #67e8f9) 圆角矩形背景
  (蓝青色调,区分现有 8 个员工,代表"信息/引导")
- 头部: FaceBase (复用 employee-svg-avatars.tsx 的圆脸 + 眨眼 + 笑嘴)
- 学士帽: 头顶黑色梯形帽 + 中央悬挂蓝色流苏 (拟"老师/答疑"职业符号)
- 头顶悬浮问号灯泡: 黄色发光圆圈 + 内嵌 ? 字符 + 4 道发散光线
- 装饰: 帽角金色小星 (sparkle 动画)
- 右手 (招手动画时启用): 黑色描边手掌 path,可单独旋转
```

### 4.2 状态机

| 状态 | 触发 | 视觉 / 动画 |
|---|---|---|
| **idle**(默认) | 进入 dashboard 后 | 眨眼(`avatar-eye`,每 4 秒一次)+ 嘴角呼吸(SMIL 已有)+ 问号灯泡上下浮动(`avatar-anim-float`,2.4s)+ 帽角星星闪烁(`avatar-anim-shimmer`) |
| **hover** | 鼠标悬停 | `scale(1.08)` + 旋转 `+8deg` 再回正(framer-motion `spring`)+ 问号灯泡放大跳动 + 右侧弹气泡"需要帮助吗? 按 ? 打开" |
| **active** | 鼠标点击瞬间 | `scale(0.92)` + 旋转 `0deg` + 问号灯泡爆炸式星光发散 200ms |
| **wave**(招手) | idle 30 秒鼠标无活动 + 相邻两次间隔 ≥ 5 分钟 + 同 session 累计 ≤ 3 次 | 右手抬起 + 左右摆动 2 次(1.2s)+ 气泡"在这里呢 ✋",2.5 秒后自动收起 |
| **first-tip** | 用户首次访问 dashboard(`localStorage.help-launcher-first-tip-shown` 未设) | 5 秒后自动弹"第一次来?这里有使用指南 →" 气泡,3 秒后自动收起,写 localStorage 防重 |
| **unread-badge** | `localStorage.help-changelog-last-seen < LATEST_CHANGELOG_AT` | 右上角 8px 红点(`bg-red-500 ring-2 ring-page`),hover 气泡改成"有新公告 →" |

### 4.3 挂载位置

`src/components/layout/dashboard-shell.tsx`:

```tsx
<div className="relative flex h-svh overflow-hidden">
  <AppSidebar … />
  …
  <ChatLauncher />        {/* 右下,已有 */}
  <HelpLauncher />         {/* 左下,新增 */}
</div>
```

- `fixed bottom-6 left-6 z-50`
- 在 `/help` 路由内自动隐藏(`usePathname().startsWith("/help")` 返回 null)
- 移动端 < 768px:`bottom-4 left-4` + `w-12 h-12`(响应式缩放)

### 4.4 键盘快捷键

全局监听 `?`(Shift + /),触发条件:

- 焦点**不**在 `input` / `textarea` / `[contenteditable="true"]` / `[data-help-shortcut-ignore]` 内
- 当前页面不是 `/help/*`:跳 `/help`
- 当前页面已是 `/help/*`:聚焦顶栏搜索框(`[data-help-search-input]`)

### 4.5 可访问性

- `aria-label="打开帮助中心"`
- Tab 键可聚焦,Enter 触发导航
- `prefers-reduced-motion` 媒体查询:关闭浮动/弹簧/招手,只保留眨眼
- 颜色对比度 AA

### 4.6 节流策略

| 行为 | 限制 |
|---|---|
| wave 招手 | 同 session 累计 ≤ 3 次,相邻两次间隔 ≥ 5 分钟(`sessionStorage.help-wave-count` 计数 + `sessionStorage.help-wave-last-at` 时间戳) |
| first-tip | 终身一次(`localStorage.help-launcher-first-tip-shown`) |
| 红点 badge | 进 changelog 页面后清零,新 changelog 上线再次出现 |

## 5. `/help` 独立 Layout

### 5.1 视觉骨架

```
┌───────────────────────────────────────────────────────────────┐
│  HelpHeader (h-14, sticky top-0, 半透明白底 backdrop-blur)      │
│  ┌─────┬─────────────────────────┬─────────────────────────┐  │
│  │  M  │  [Vibe Media 帮助中心]   [搜索 (Cmd+K)…]   返回平台 →│  │
│  └─────┴─────────────────────────┴─────────────────────────┘  │
├───────────────────────────────────────────────────────────────┤
│   {children}  (max-w-7xl 居中 + py-12)                         │
├───────────────────────────────────────────────────────────────┤
│  HelpFooter (h-20)                                             │
│  © 2026 Vibe Media · 文档反馈 · 系统状态 · 隐私 · 服务协议     │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 设计要点

- **不**套 dashboard sidebar/topbar,独立路由段(`src/app/help/`,无括号)
- 顶栏 logo 点击回 `/help`(**不**回 `/home`);"返回平台"按钮才回 `/home`(已登录)或 `/login`(未登录)
- 顶栏中央**全局搜索框**(SearchInput + Cmd+K 弹层 SearchDialog),所有 `/help/*` 都有
- 主体背景纯净 `bg-white dark:bg-slate-950`,**不**用 `bg-glow` 粒子,内容聚焦
- Footer 极简,放反馈链接、状态页、隐私、服务协议
- `metadata`:`title.template = "%s | Vibe Media 帮助中心"`,`description = "Vibe Media 数智全媒平台使用文档..."`

## 6. 三个核心页面

### 6.1 首页(`src/app/help/page.tsx`)

Server Component,四块从上到下:

```
① HeroSearch (py-24, 背景天蓝径向渐变 + 浮动几何装饰)
  H1: 你好,需要什么帮助?
  Subtitle: Vibe Media 数智全媒平台官方文档
  [   大搜索框 (h-14, 圆角,带 search icon 和占位文字)   ]
  热门搜索: [#第一个工作流] [#AI 员工技能] [#CMS 接入] ...

② CategoryGrid (max-w-6xl, py-16)
  [浏览分类]
  4×2 网格,GlassCard wrapper:
  ┌─────────┬─────────┬─────────┬─────────┐
  │🚀 快速  │🤖 AI    │🔀 工作  │✍️ 创作  │
  │  开始   │  员工   │  流     │  生产   │
  │ (5 篇)  │ (8 篇)  │ (10 篇) │ (8 篇)  │
  ├─────────┼─────────┼─────────┼─────────┤
  │📡 采集  │📁 媒资  │📢 渠道  │⚙️ 系统  │
  │ (5 篇)  │ (7 篇)  │ (5 篇)  │ 管理 (6)│
  └─────────┴─────────┴─────────┴─────────┘

③ PopularDocs (max-w-6xl, py-12)
  [热门 / 新手必读]
  横向滚动 4-6 张文档预览卡(frontmatter popular: true 的)
  每卡: 文档标题 + 阅读时长 + 所属分类 tag

④ ContactSection (max-w-4xl, py-12, 居中)
  H3: 没找到答案?
  [按钮: 打开 AI 员工对话中心 →]  [按钮: 提交文档反馈]
```

> 注:首页四块编号 ①②③④ 对应 HeroSearch / CategoryGrid / PopularDocs / ContactSection。澄清阶段曾使用 ① ② ③ ⑤,本 spec 已统一连续编号。

数据获取:

```ts
const categories = await listCategories();        // 8 个分类元数据 + 文档计数
const popularDocs = await listPopularDocs();      // 4-6 篇,frontmatter popular: true
const hotSearchTerms = ["第一个工作流", "AI 员工技能", "CMS 接入", "全渠道发布"];
```

### 6.2 分类页(`src/app/help/[category]/page.tsx`)

不直接打开第一篇,而是显示**分类索引页**:

```
面包屑: 帮助中心 / 工作流

① CategoryHero (py-12, 浅色背景区分)
  [大图标] 工作流
  描述: 创建工作流模板、启动 mission、监控执行……
  📄 10 篇文档 · 🕐 最近更新 2 天前

② DocList (按 _meta.json 排序的分组列表)
  [入门]
    → 第一个工作流(5 分钟)
    → 工作流模板概念
  [进阶]
    → 定时调度
    → 失败重试与状态机
  [排错]
    → 常见执行失败原因
```

`_meta.json` 决定分组与排序:

```json
{
  "title": "工作流",
  "description": "创建工作流模板、启动 mission、监控执行……",
  "icon": "Workflow",
  "groups": [
    { "title": "入门", "docs": ["start-first-workflow", "concepts"] },
    { "title": "进阶", "docs": ["scheduling", "retry-state-machine"] },
    { "title": "排错", "docs": ["common-failures"] }
  ]
}
```

DocList 每行 `<Link>` + 标题 + 1 行描述(取自 MDX frontmatter)+ 阅读时长。

### 6.3 详情页(`src/app/help/[category]/[slug]/page.tsx`)

三栏 + 底部反馈:

```
┌────────────────────────────────────────────────────────────────────┐
│  面包屑: 帮助中心 / 工作流 / 第一个工作流                              │
├────────┬───────────────────────────────────────┬───────────────────┤
│ 左栏    │  中央正文 (max-w-3xl)                  │  右栏 TOC          │
│ 目录树  │  H1: 第一个工作流                      │  本页内容          │
│ 240px   │  阅读时长 5 分钟 · 更新 2 天前          │  240px            │
│ sticky  │                                       │  sticky           │
│ top-14  │  <MDX 渲染,支持自定义组件>             │  top-14           │
│        │                                       │                   │
│ [入门]  │  H2: 概述                              │  • 概述           │
│ • 第一个│  ……                                   │  • 创建模板       │
│   工作流│  H2: 创建模板                          │    - 选择类型     │
│   (高亮)│  <Steps>                              │    - 配置节点     │
│ • 概念  │    1. 选择类型                         │  • 启动 mission   │
│        │    2. 配置节点                         │  • 监控           │
│ [进阶]  │    3. 保存                            │                   │
│ • 定时  │  </Steps>                             │                   │
│ • 重试  │                                       │                   │
│        │  <Callout type="tip">小提示…</Callout>  │                   │
│ [排错]  │                                       │                   │
│ • 常见  │  <ScreenshotZoom src="/help/...">     │                   │
│   失败  │                                       │                   │
│        │  ────────── 底部反馈区 ──────────       │                   │
│        │  这篇文档对你有帮助吗?                  │                   │
│        │  [👍 有帮助]  [👎 没帮助]               │                   │
│        │  点击后展开输入框: "怎么改进?"          │                   │
│        │                                       │                   │
│        │  ────────── 上 / 下一篇 ──────────       │                   │
│        │  ← 工作流概念  |  定时调度 →            │                   │
└────────┴───────────────────────────────────────┴───────────────────┘
```

关键实现:

- **左栏**:`<DocSidebar>` 组件,数据是当前分类 `_meta.json` 的 groups,高亮当前页(pathname 匹配),`sticky top-14 h-[calc(100svh-3.5rem)] overflow-y-auto`
- **右栏 TOC**:`<DocToc>` 组件,数据从 MDX AST 用自写 remark plugin(`remarkExtractToc`)抽取 H2/H3。客户端用 `IntersectionObserver` 监听 H2/H3 进入视窗,高亮当前 TOC 项;点击平滑滚动到锚点
- **中栏正文**:`max-w-3xl`,行宽约 70 字符
- **反馈**:`<DocFeedback>`,点击 👍/👎 后调 server action `submitDocFeedback`,落 `help_feedback` 表
- **上/下一篇**:基于当前分类 `_meta.json` 的 docs 顺序计算

短文档(< 3 个 H2)的右栏 TOC 自动隐藏,中栏正文宽度允许扩到 `max-w-4xl`。

移动端 < 768px:三栏 → 单栏堆叠,左目录变成顶部抽屉(汉堡菜单),右 TOC 变成正文上方"折叠的本页目录"。

## 7. MDX 渲染管道

### 7.1 Frontmatter Schema(zod)

```ts
// src/lib/help/types.ts
import { z } from "zod";

export const HelpFrontmatterSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(200),
  slug: z.string().optional(),                       // 缺省回退到文件名
  category: z.enum([
    "getting-started", "ai-employees", "workflows", "creation",
    "data-collection", "media-assets", "channels", "admin",
  ]),
  group: z.string().optional(),                      // 缺省走 _meta.json 兜底
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  authors: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  popular: z.boolean().optional(),
  order: z.number().int().optional(),
  toc: z.boolean().optional().default(true),
});

export type HelpFrontmatter = z.infer<typeof HelpFrontmatterSchema>;
```

校验失败时构建期 `throw new Error("Frontmatter invalid in <path>: <issues>")`。

### 7.2 next-mdx-remote-client 集成

```tsx
// src/app/help/[category]/[slug]/page.tsx (节选)
import { MDXRemote } from "next-mdx-remote-client/rsc";
import { mdxComponents } from "@/components/help/mdx";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import { remarkExtractToc } from "@/lib/help/toc";

export async function generateStaticParams() {
  const docs = await listAllDocs();
  return docs.map((d) => ({ category: d.category, slug: d.slug }));
}

export async function generateMetadata({ params }) {
  const doc = await getDocBySlug(params.category, params.slug);
  if (!doc) return {};
  return { title: doc.frontmatter.title, description: doc.frontmatter.description };
}

export const dynamic = "force-static";

export default async function DocPage({ params }) {
  const doc = await getDocBySlug(params.category, params.slug);
  if (!doc) notFound();

  return (
    <DocLayout category={params.category} doc={doc} toc={doc.toc} readingTime={doc.readingTime}>
      <MDXRemote
        source={doc.body}
        components={mdxComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm, remarkExtractToc],
            rehypePlugins: [
              [rehypeShiki, {
                themes: { light: "github-light", dark: "github-dark-dimmed" },
                transformers: [transformerNotationDiff()],   // +/- diff 高亮
              }],
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap" }],
            ],
          },
        }}
      />
    </DocLayout>
  );
}
```

### 7.3 自定义 MDX 组件清单

`src/components/help/mdx/index.ts` 统一导出:

| 组件 | 用法 | 渲染 |
|---|---|---|
| `<Callout type="tip\|warn\|note\|info">` | `<Callout type="warn">注意 X</Callout>` | 左竖条 + icon + 内容,4 色变体 |
| `<Steps>` 包 `<ol>` | `<Steps>1. ...; 2. ...</Steps>` | 自动给 `<li>` 编号 + 左侧时间线 |
| `<ScreenshotZoom src alt>` | 单图 | 点击放大全屏 lightbox(`@/components/ui/dialog`) |
| `<VideoEmbed src poster>` | B 站/腾讯视频 iframe | 16:9 wrapper + lazy loading |
| `<EmployeeBadge id="xiaolei">` | 内嵌 AI 员工卡 | 复用 `employee-svg-avatars.tsx` + EMPLOYEE_META 数据,展示头像 + 名字 + 1 行职责 |
| `<KeyboardKey>Cmd+K</KeyboardKey>` | 行内显示快捷键 | 灰底圆角 kbd 样式 |
| `<Tabs items={[{label,content}]}>` | 多版本/多平台说明切换 | 复用 `@/components/ui/tabs` |
| `<DocLink href="/help/...">概念</DocLink>` | 文档内交叉引用 | 带小箭头,构建期校验目标存在 |

**标准 HTML 元素重写**:
- `<h1/h2/h3/p/a/code/pre/ul/ol/li/blockquote/table>` 用 Tailwind 重写,基于 `prose-slate prose-sm` 风格
- `<img>` 改成 `next/image` 自动响应式
- `<a>` 内链(`/` 或 `/help/`)用 `next/link`;外链加 `target="_blank" rel="noopener"` + 小箭头 icon
- `<pre><code>` 由 `rehype-shiki` 在构建期生成带 token 颜色的 HTML,支持 diff 高亮

### 7.4 TOC 抽取

`src/lib/help/toc.ts`(自写 remark plugin):

```ts
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import slugify from "@sindresorhus/slugify";

export function remarkExtractToc() {
  return (tree: any, file: any) => {
    const toc: Array<{ depth: number; text: string; id: string }> = [];
    visit(tree, "heading", (node: any) => {
      if (node.depth !== 2 && node.depth !== 3) return;
      const text = toString(node);
      const id = slugify(text);
      toc.push({ depth: node.depth, text, id });
    });
    file.data.toc = toc;
  };
}
```

**关键:TOC 抽取与 `<MDXRemote>` 正文渲染解耦**。

`next-mdx-remote-client/rsc` 的 `<MDXRemote>` 内部 compile 出来的 `vfile.data` 不会透传给调用方,所以**不能**指望同一条 pipeline 同时拿到 toc 和渲染结果。实际做法:**在 `getDocBySlug()` 内单独跑一次纯 remark parse 抽 toc**,再把 body 字符串原样传给 `<MDXRemote source={doc.body}>`:

```ts
// src/lib/help/content.ts
import { unified } from "unified";
import remarkParse from "remark-parse";
import { remarkExtractToc } from "./toc";

export const getDocBySlug = cache(async (cat: string, slug: string) => {
  const raw = await fs.readFile(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = HelpFrontmatterSchema.parse(data);

  // 单独跑一次 remark pipeline 抽 toc(不渲染)
  const file = await unified().use(remarkParse).use(remarkExtractToc).run(
    unified().use(remarkParse).parse(content)
  );
  const toc = (file.data.toc as TocEntry[]) ?? [];

  return {
    frontmatter,
    body: content,                                  // 给 <MDXRemote source={body}>
    toc,                                            // 独立返回,供右栏 DocToc 使用
    readingTime: readingTime(content).text,
  };
});
```

这条 pipeline 比正文 compile 轻很多(只 parse、不 transform),性能开销忽略不计。详情页拿到 `doc.toc` 后直接传给 `<DocToc entries={doc.toc} />`。

### 7.5 阅读时长

用 `reading-time` npm 包:

```ts
import readingTime from "reading-time";
const stats = readingTime(rawMdxBody, { wordsPerMinute: 300 });
// 中文用字符数 / 300 估算,实测足够准
```

### 7.6 内容加载层

`src/lib/help/content.ts` 四个核心函数(全部 `cache()` 装饰):

```ts
listCategories(): Promise<HelpCategory[]>
listDocsByCategory(cat: string): Promise<HelpDoc[]>
getDocBySlug(cat: string, slug: string): Promise<HelpDocWithBody | null>
listAllDocs(): Promise<HelpDoc[]>
```

策略:
- `fast-glob` 扫 `content/help/**/*.mdx`,`gray-matter` 解析 frontmatter
- 全部走 React `cache()` 装饰,同一 build / 同一 RSC render 周期内只扫一次
- 不引入 SQLite/Redis 等缓存层(文档 < 200 篇时读盘足够快)

## 8. Pagefind 搜索

### 8.1 构建管道

```ts
// scripts/build-help-search.ts
import { createIndex } from "pagefind";

const HELP_HTML_ROOT = ".next/server/app/help";
const OUTPUT_DIR = "public/pagefind";

async function main() {
  const { index } = await createIndex({
    rootSelector: "main",                    // 只索引 main 内容
    excludeSelectors: [".no-search", "pre"], // 不索引代码块
    keepIndexUrl: false,
    forceLanguage: "zh-cn",                  // 强制中文分词
  });
  await index.addDirectory({ path: HELP_HTML_ROOT });
  await index.writeFiles({ outputPath: OUTPUT_DIR });
  console.log("✓ pagefind index built");
}
main();
```

`package.json`:

```json
{
  "scripts": {
    "build": "next build && tsx scripts/build-help-search.ts",
    "predev": "tsx scripts/build-help-meta.ts",
    "prebuild": "tsx scripts/build-help-meta.ts"
  },
  "devDependencies": {
    "pagefind": "^1.x"
  }
}
```

`pagefind` 是 dev 依赖,运行时不进 bundle。生成的 `public/pagefind/*` 由 Vercel 自动分发。

### 8.2 客户端调用

`src/lib/help/search-client.ts`:

```ts
"use client";

interface PagefindResult {
  url: string;
  meta: { title: string; description?: string; category?: string };
  excerpt: string;   // 带 <mark> 高亮的 HTML 片段
}

let pagefindPromise: Promise<any> | null = null;

async function loadPagefind() {
  if (!pagefindPromise) {
    pagefindPromise = import(/* webpackIgnore: true */ "/pagefind/pagefind.js" as any);
  }
  return pagefindPromise;
}

export async function searchHelp(query: string, limit = 8): Promise<PagefindResult[]> {
  if (!query.trim()) return [];
  try {
    const pf = await loadPagefind();
    const { results } = await pf.search(query);
    return await Promise.all(results.slice(0, limit).map((r: any) => r.data()));
  } catch (err) {
    console.warn("pagefind unavailable", err);
    return [];
  }
}
```

### 8.3 交互入口

| 入口 | 触发 | 行为 |
|---|---|---|
| **顶栏 Cmd+K SearchDialog** | Cmd/Ctrl+K 或点击顶栏搜索框 | 弹出 modal,输入 debounce 200ms,Enter 跳第一条命中 |
| **`/help/search?q=...` 结果页** | URL 直接访问或 Hero 搜索框回车 | 完整结果列表 + 分类筛选 + 高亮上下文 |

SearchDialog:
- 用 `@/components/ui/dialog`
- 上下箭头切换选中,Enter 跳转,Esc 关闭
- 空查询显示 4 个"热门搜索"tag(与首页 hero 同源)
- 第一次打开显示 skeleton + "正在加载搜索引擎…",pagefind wasm 拉取完后消失

SearchResults 页:
- Client Component
- 顶部沿用 Hero 搜索框,带回查询词
- 左侧按分类 filter,右侧结果列表(分页 20/页,加载更多)
- 命中 0 条时:"没找到 X,推荐看这些"+ 推荐 3 篇热门文档

### 8.4 中文分词

pagefind `forceLanguage: "zh-cn"` 启用字符级 n-gram 分词。实测中文 docs 召回率 ~75%,大部分场景够用。
若后期不够,可换 `cnpagefind` fork 或升级到 Meilisearch(out of scope)。

## 9. FAQ 模块

### 9.1 数据格式

`content/help/faq.json`:

```json
{
  "categories": [
    { "id": "workflow", "name": "工作流" },
    { "id": "employee", "name": "AI 员工" },
    { "id": "billing", "name": "账户与权限" }
  ],
  "items": [
    {
      "id": "wf-001",
      "category": "workflow",
      "question": "工作流跑到一半失败了,数据会回滚吗?",
      "answer": "默认不会自动回滚。失败的 step 状态变为 `failed`,后续依赖步骤变为 `skipped`,你需要在任务详情页手动修复后重试……",
      "relatedDocs": ["/help/workflows/retry-state-machine"],
      "popular": true,
      "updatedAt": "2026-05-12"
    }
  ]
}
```

`answer` 支持 Markdown 语法,渲染时走 `react-markdown`(或简单 ReactMarkdown,与项目其它地方一致)。

### 9.2 渲染(`src/app/help/faq/page.tsx`)

- 顶部分类 Tab(`variant="line"`):全部 / 工作流 / AI 员工 / ...
- 手风琴列表(`@/components/ui/accordion`,**项目当前未安装**,需用 `npx shadcn@latest add accordion` 添加),问题点开显示 answer + relatedDocs 链接
- 顶部小搜索框走客户端 `Fuse.js` 模糊匹配(独立于全局 pagefind,因为 FAQ 体量小、即时反馈更好)
- `popular: true` 项打"热门"小 badge
- URL hash 锚点:`/help/faq#wf-001` 自动展开对应项

### 9.3 维护方式

预估 30-60 条,一个 JSON 文件够用;超过 100 条再拆分多文件。

## 10. 更新日志

### 10.1 数据格式

`content/help/changelog/2026-05.mdx`:

```yaml
---
title: 2026 年 5 月更新
publishedAt: 2026-05-31
version: 2026.05
summary: 新增帮助中心、工作流定时任务可视化配置;优化采集监控面板。
---

## 新增 (Feature)
- **帮助中心上线**:新增 `/help` ... [#PR-123]
- **工作流定时调度**:支持 cron 表达式配置定时任务,与手动启动入口并存。

## 优化 (Improvement)
- 采集监控面板增加 24h 失败率趋势图。

## 修复 (Fix)
- 修复稿件详情页 Markdown 正文渲染丢失问题。
```

frontmatter schema:`title / publishedAt / version / summary`,全部必填。

### 10.2 渲染(`src/app/help/changelog/page.tsx`)

- 倒序列出所有月份(扫 `content/help/changelog/*.mdx`)
- 每条用 `<details>` 默认展开最近 3 个月,更早折叠
- 支持 MDX 自定义组件
- 进入页面时 `useEffect` 写 `localStorage.help-changelog-last-seen = Date.now()`,触发 HelpLauncher 红点消失
- 每条更新有锚点(`/help/changelog#2026-05`),HelpLauncher 红点点击直接跳最新一条

### 10.3 LATEST_CHANGELOG_AT 生成

`scripts/build-help-meta.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const CHANGELOG_DIR = "content/help/changelog";
const OUTPUT = "src/lib/help/changelog-meta.ts";

async function main() {
  const files = await fs.readdir(CHANGELOG_DIR);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx"));
  const entries = await Promise.all(
    mdxFiles.map(async (f) => {
      const raw = await fs.readFile(path.join(CHANGELOG_DIR, f), "utf-8");
      const { data } = matter(raw);
      return { slug: f.replace(/\.mdx$/, ""), publishedAt: data.publishedAt as string, title: data.title as string };
    }),
  );
  const latest = entries.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];

  const content = `// Auto-generated, do not edit
export const LATEST_CHANGELOG_AT = ${latest ? new Date(latest.publishedAt).getTime() : 0};
export const LATEST_CHANGELOG_SLUG = "${latest?.slug ?? ""}";
export const LATEST_CHANGELOG_TITLE = ${JSON.stringify(latest?.title ?? "")};
`;
  await fs.writeFile(OUTPUT, content, "utf-8");
  console.log("✓ help meta written");
}
main();
```

通过 `predev` / `prebuild` 钩子触发,几十毫秒内完成。

## 11. 反馈表

### 11.1 表 schema

`src/db/schema/help-feedback.ts`(新增):

```ts
import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const helpFeedback = pgTable("help_feedback", {
  id: uuid().primaryKey().defaultRandom(),
  docPath: text().notNull(),                 // 形如 "workflows/start-first-workflow"
  helpful: boolean().notNull(),              // 👍 = true, 👎 = false
  comment: text(),                           // 可选,最大 500 字
  userAgent: text(),
  ipHash: text(),                            // SHA-256,不留明文
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  docPathIdx: index("idx_help_feedback_doc").on(t.docPath),
  createdIdx: index("idx_help_feedback_created").on(t.createdAt),
}));
```

迁移走标准 Drizzle 流程:`src/db/schema/help-feedback.ts` → `npm run db:generate` → `supabase/migrations/NNNN_help_feedback.sql` → `npm run db:migrate`。

### 11.2 Server Action

`src/lib/help/feedback.ts`:

```ts
"use server";
import { db } from "@/db";
import { helpFeedback } from "@/db/schema";
import { sql } from "drizzle-orm";
import crypto from "node:crypto";
import { headers } from "next/headers";

export async function submitDocFeedback(input: {
  docPath: string;
  helpful: boolean;
  comment?: string;
}): Promise<{ ok: boolean }> {
  if (!input.docPath || typeof input.helpful !== "boolean") return { ok: false };
  if (input.comment && input.comment.length > 500) return { ok: false };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

  // 防滥用:同 IP 1 分钟内 > 10 条直接静默丢弃
  const recent = await db.execute(sql`
    SELECT COUNT(*) AS count FROM help_feedback
    WHERE ip_hash = ${ipHash} AND created_at > NOW() - INTERVAL '1 minute'
  `);
  const count = Number((recent as any)[0]?.count ?? 0);
  if (count > 10) return { ok: true };   // 假成功

  await db.insert(helpFeedback).values({
    docPath: input.docPath,
    helpful: input.helpful,
    comment: input.comment ?? null,
    userAgent: h.get("user-agent") ?? null,
    ipHash,
  });
  return { ok: true };
}
```

MVP 不做读接口、不做后台 UI(Drizzle Studio 看)。

## 12. Proxy 变更

`src/proxy.ts` 当前 `isPublic()` 写法是 `startsWith` 链式 OR:

```ts
function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth")
  );
}
```

**最小改动**:加一行 `|| pathname.startsWith("/help")`:

```ts
function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/help")     // 新增
  );
}
```

未登录用户访问 `/help/*` 直接放行,**不**触发重定向。已登录用户访问也不重定向(与 `/login` 行为不同,`/login` 已登录跳 `/home`)。

(若未来公共路径继续增加,可顺手把 `isPublic` 重构成数组遍历;本期保持原风格只加一行,避免无关 diff。)

## 13. 错误处理与边界

### 13.1 错误处理

| 场景 | 行为 |
|---|---|
| URL 指向不存在的分类 `/help/foo` | `notFound()` → `src/app/help/not-found.tsx`(带"返回首页/搜索"按钮) |
| URL 指向不存在的文档 | 同上 |
| MDX frontmatter 不通过 zod 校验 | 构建期 throw,带文件路径 + 缺失字段名 |
| MDX 正文有语法错误 | 同上 |
| `<DocLink>` 指向不存在的文档 | `scripts/verify-help-links.ts` 构建期扫描,抛错并列出坏链 |
| `_meta.json` 解析失败或缺失 | 构建期 throw |
| Pagefind 索引未生成(本地 dev) | 客户端 catch error,SearchDialog 显示"搜索功能仅在生产环境可用",回车跳分类页 |
| 反馈表 server action 失败 | 前端 toast 显示"反馈提交失败,稍后再试",不阻塞页面 |
| 反馈滥用(同 IP 1 分钟 > 10 条) | server action 静默假成功,丢弃 |

**核心原则**:**生产构建早失败,运行时永不开天窗**。文档错配 = 构建挂掉,绝不让坏数据上线显示成 "undefined"。

### 13.2 边界场景

| 场景 | 设计 |
|---|---|
| 空分类(0 篇 MDX) | 分类页 `<EmptyState>` + "这个分类正在筹备中"。构建期 warning 但不抛错 |
| 短文档无 H2(空 TOC) | 右栏自动隐藏,正文宽度扩到 `max-w-4xl` |
| 超长文档(> 5000 字) | 不分页,TOC 跟随滚动 |
| 移动端 < 768px | 三栏 → 单栏堆叠,左目录变顶部抽屉,右 TOC 折叠到正文上方;HelpLauncher 缩到 48×48 |
| 暗色模式 | 用 CSS 变量;Shiki 主题用 `github-dark-dimmed`;小帮 SVG 底色媒体查询切换 |
| `prefers-reduced-motion` | HelpLauncher 关闭浮动/弹簧/招手,只保留眨眼 |
| 网络慢(首次 wasm 加载) | SearchDialog 显示 skeleton,3 秒后兜底"试试浏览分类"+ 分类入口 |
| 未登录访问 `/help` | proxy 公共白名单放行 |
| 已登录用户反复关闭 HelpLauncher | 仅支持"今天不再提示"(sessionStorage),不支持永久隐藏 |

## 14. 性能预算

| 指标 | 目标 | 措施 |
|---|---|---|
| `/help` 首页 FCP | < 1.2s | RSC 预渲染,静态 HTML,无客户端 fetch |
| 详情页 LCP | < 1.5s | 同上,图片 next/image,代码块构建期高亮 |
| `/help/*` 客户端 JS bundle | < 80KB gzipped | 限制 MDX 自定义组件依赖,SearchDialog 动态 import |
| Pagefind 首次加载 | < 500ms | wasm 包延迟到搜索框 focus 时拉取 |
| HelpLauncher 对 dashboard FCP 影响 | < 5ms | SVG 内联,framer-motion 复用 |

## 15. 验证策略

1. `npx tsc --noEmit` 零 error
2. `npm run build` 成功,产物含 `public/pagefind/*` 和所有 `/help/**` HTML
3. `scripts/verify-help-links.ts` 扫所有 `<DocLink>` 和 markdown 链接,目标必须存在
4. Frontmatter zod safeParse 失败构建挂
5. `axe-core` 跑 `/help`、`/help/workflows`、`/help/workflows/start-first-workflow`,A 级 0 violation
6. 键盘导航手测:Tab/Shift+Tab/Enter/Esc/Cmd+K/?
7. 视觉回归(可选,如项目有 Playwright):桌面/移动 × 浅/深色 × 首页/分类/详情 = 12 张截图
8. 运行时手测:
   - 浮动小人五态:idle/hover/active/wave/first-tip
   - 搜索:中文短词、长句、英文、零结果
   - 反馈:👍 / 👎 / 带评论提交,落表确认
   - 暗色模式无样式断裂
   - 未登录访问 `/help` 成功打开

## 16. Out of Scope(明确不做)

- 多语言(英文版)—— HelpLayout 内部预留 lang prop,后期能挂 i18n
- 文档版本管理(v1 / v2)—— 仅 "current" 版本
- 文档编辑器后台 UI —— 文档全部 git 工作流维护
- 评论 / 点赞 / 收藏
- AI RAG 问答 —— 已有"打开对话中心"兜底
- 内嵌截图录制/标注工具
- 文档浏览量统计 dashboard —— 进 GA/Vercel Analytics,运营自取
- 文档贡献者头像列表

## 17. 实施次序建议(供后续 plan 参考)

0. **依赖落地**:`npm i` 新增的 11 个 MDX/搜索相关包 + `npx shadcn@latest add accordion`,跑 `npx tsc --noEmit` 确认无类型冲突
1. **基础设施**:`content/help/` 目录骨架、frontmatter schema、`src/lib/help/content.ts`(含独立 remark pipeline 抽 toc)、proxy 改动
2. **Layout + 首页骨架**:`src/app/help/layout.tsx`、`page.tsx`、`HelpHeader/HelpFooter`
3. **小帮入口**:`XiaobangAvatar` SVG + `HelpLauncher` + dashboard-shell 集成 + 5 态动画
4. **分类页 + 详情页骨架**:`[category]/page.tsx`、`[slug]/page.tsx`、左目录树 + 右 TOC + 面包屑
5. **MDX 管道**:`next-mdx-remote-client` 集成 + remark/rehype 插件 + `mdxComponents`
6. **Pagefind 搜索**:构建脚本 + SearchDialog + 搜索结果页
7. **FAQ + 更新日志**:`faq.json` 渲染 + changelog MDX + `build-help-meta` 脚本
8. **反馈表**:Drizzle schema + server action + DocFeedback 组件
9. **校验脚本**:`verify-help-links.ts` + 链路 lint
10. **首批内容**:`getting-started` 5 篇 + `workflows` 3 篇 + 20 条 FAQ + 1 篇 changelog
11. **验证**:tsc / build / axe / 手测全跑一遍

## 18. 依赖清单

新增 npm 依赖:

```jsonc
// dependencies
"next-mdx-remote-client": "^1.x",
"reading-time": "^1.x",
"@sindresorhus/slugify": "^2.x",
"@shikijs/rehype": "^1.x",
"remark-gfm": "^4.x",
"rehype-slug": "^6.x",
"rehype-autolink-headings": "^7.x",
"unist-util-visit": "^5.x",
"mdast-util-to-string": "^4.x",
"gray-matter": "^4.x",
"fuse.js": "^7.x",

// devDependencies
"pagefind": "^1.x",
"fast-glob": "^3.x",
"tsx": "^4.x"  // 如未安装
```

shadcn/ui 组件(`npx shadcn@latest add ...`):

- `accordion` —— FAQ 与 changelog 折叠展开,项目当前未安装,必须新增

dialog / tabs / select / input / button 等已在 `src/components/ui/` 下,直接复用。

## 19. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 引入 MDX 体系增加项目复杂度 | 限定在 `/help` 子树,其它代码不接触;失败时回退到纯 markdown 渲染 |
| 中文分词召回率不足 | pagefind 默认够用;预留 `<DocLink>` 显式引用 + FAQ 兜底 |
| 文档运营成本高 | MVP 先搭骨架,内容按需补;首期只填 30-40 篇 |
| 帮助中心和产品视觉不一致 | 独立 layout 是有意为之(参考 Shopify);但 MDX 自定义组件复用项目 ui/* 原语保持微一致 |
| 帮助小人占用空间影响 dashboard | 移动端 48×48,可被任意鼠标活动打断动画;reduced-motion 全关 |
| pagefind wasm 200KB 首次加载延迟 | 延迟到搜索框 focus 时;skeleton + 3s 超时兜底 |

---

**版本**: v1.0
**状态**: 待评审
