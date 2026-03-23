# 新闻稿件详情页设计重构方案

> 基于 `docs/news-detail-page-prompt.md` 需求文档的完整设计方案
> 技术栈：Next.js 16 + TypeScript + Tailwind CSS + Tiptap 2.x + Zustand + AI SDK v6 (DeepSeek)

---

## 1. 设计决策总结

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 实施范围 | Phase 1-5 全量实现 | 完整覆盖需求文档 |
| 富文本编辑器 | Tiptap 2.x | 扩展生态最丰富，自定义灵活度高 |
| 状态管理 | 混合方案（Zustand + Feature Hooks） | 全局协调用 store，子系统各自封装 |
| 视频模式 | 完整 UI + Mock 数据 | 前端交互逻辑先做完，后端接入时替换数据源 |
| AI 接入 | 真实 AI 全量接入 (DeepSeek) | OpenAI 兼容接口，OPENAI_API_BASE_URL=https://api.deepseek.com/v1 |
| 现有代码 | 完全重写 | 旧组件 713 行单体，缺乏模块化，无法渐进改造 |
| 视觉风格 | 融合方案 | 面板框架延续 Glass UI，中间阅读区纯净排版 |
| 移动端 | 暂不考虑 | 聚焦 PC 端体验 |
| 组件架构 | Feature-Sliced 垂直切片 | 功能域独立，利于并行开发 |

---

## 2. 组件架构

采用 Feature-Sliced 垂直切片架构，每个功能域自包含 UI + hooks + 类型定义。

```
src/app/(dashboard)/articles/[id]/
├── page.tsx                      ← Server Component（数据获取）
├── article-detail-client.tsx     ← Client 入口（组装三栏布局 + Provider）
├── store.ts                      ← Zustand 全局协调 store
├── types.ts                      ← 页面级类型定义
├── features/
│   ├── header/
│   │   ├── article-header.tsx    ← 顶部导航栏（面包屑 + 视图切换 + 工具栏）
│   │   ├── view-switcher.tsx     ← 沉浸阅读/原网页/AI速览/存档 切换
│   │   ├── appearance-popover.tsx ← 字号/行高/边距/主题设置
│   │   └── actions-menu.tsx      ← 更多操作下拉菜单（分享/复制/导出/整理）
│   ├── reader/
│   │   ├── article-reader.tsx    ← 阅读模式主组件（纯净排版）
│   │   ├── meta-header.tsx       ← 元信息头（标题/来源/标签/阅读时间）
│   │   ├── text-selection-menu.tsx ← 划词气泡菜单（高亮/批注/AI/搜索/复制）
│   │   └── image-lightbox.tsx    ← 图片全屏查看
│   ├── editor/
│   │   ├── article-editor.tsx    ← Tiptap 编辑器主组件
│   │   ├── editor-toolbar.tsx    ← 固定浮动工具栏
│   │   ├── slash-command.tsx     ← "/" 命令菜单（含 /ai 指令）
│   │   ├── bubble-menu.tsx       ← 选中文本浮动格式栏（含 AI 按钮）
│   │   ├── editor-status-bar.tsx ← 底部状态栏（字数/保存状态）
│   │   └── extensions/           ← Tiptap 自定义扩展
│   │       └── ai-highlight.ts  ← AI 生成内容高亮标记扩展
│   ├── ai-chat/
│   │   ├── ai-chat-panel.tsx     ← 左侧 AI 对话面板主组件
│   │   ├── chat-message.tsx      ← 对话消息（用户/AI/操作卡片）
│   │   ├── action-card.tsx       ← AI 操作卡片（应用/复制/重生成 + Diff 预览）
│   │   ├── quick-commands.tsx    ← 快捷指令栏（按模式动态切换）
│   │   ├── chat-input.tsx        ← 底部输入框
│   │   └── use-ai-chat.ts       ← AI 对话 hook（流式、上下文管理）
│   ├── ai-analysis/
│   │   ├── ai-analysis-panel.tsx ← 右侧 AI 解读面板主组件
│   │   ├── perspective-selector.tsx ← 多视角切换（摘要/记者/金句/时间线/问答/剖析）
│   │   ├── analysis-content.tsx  ← 解读内容渲染（Markdown + 定位原文链接）
│   │   └── use-ai-analysis.ts   ← AI 解读 hook（缓存、流式生成）
│   ├── annotations/
│   │   ├── annotations-panel.tsx ← 右侧批注列表面板
│   │   ├── annotation-card.tsx   ← 批注卡片（颜色/内容/操作栏）
│   │   ├── floating-note.tsx     ← 浮顶悬浮笔记（可拖拽）
│   │   └── use-annotations.ts   ← 批注 hook（CRUD、双向联动）
│   ├── video-player/
│   │   ├── video-player.tsx      ← 视频播放器主组件（自适应画幅）
│   │   ├── player-controls.tsx   ← 控制栏（倍速/截帧/PiP/循环/字幕）
│   │   └── use-video-player.ts  ← 播放器 hook（播放状态、时间同步）
│   ├── transcript/
│   │   ├── transcript-panel.tsx  ← 听记面板主组件
│   │   ├── transcript-segment.tsx ← 单条听记（说话人 + 时间戳 + 文本）
│   │   └── use-transcript.ts    ← 听记 hook（音文同步、校对模式）
│   └── outline/
│       ├── outline-panel.tsx     ← 智能大纲面板（图文：H1/H2/H3 目录树）
│       ├── video-chapters.tsx    ← 视频章节导航
│       └── use-outline.ts       ← 大纲 hook（滚动联动、进度高亮）
└── hooks/
    └── use-article-context.ts   ← 共享文章数据上下文 hook
```

---

## 3. 三栏布局设计

### 3.1 布局结构

```
┌──────────────────────────────────────────────────────────┐
│  阅读进度条 (2px, 顶部边缘)                                │
├──────────────────────────────────────────────────────────┤
│  顶部导航栏 (h-12)                                        │
│  [← 返回 / 面包屑] [视图切换器] [阅读|编辑 · Aa · ✦ · 🖊 · ⋯] │
├────────────┬─────────────────────┬───────────────────────┤
│  左侧栏     │   中间核心区域        │    右侧栏              │
│  (20-25%)  │   (flex-1)          │   (25-30%)            │
│  min: 280px│   max: 680px 居中    │   min: 300px          │
│            │                     │                       │
│  Glass UI  │   纯净排版(阅读)      │   Glass UI            │
│  backdrop  │   Tiptap(编辑)       │   backdrop            │
│  blur      │   播放器(视频)        │   blur                │
│            │                     │                       │
│  Tabs:     │                     │   Tabs:               │
│  大纲|对话|  │                     │   AI解读|批注|听记      │
│  历史       │                     │                       │
├────────────┴─────────────────────┴───────────────────────┤
│  (禅模式：一键收起左右栏，仅保留中间区域 + 折叠按钮)            │
└──────────────────────────────────────────────────────────┘
```

### 3.2 面板折叠

- 左侧栏折叠后：左边缘显示 28px 宽的 AI 图标按钮条
- 右侧栏折叠后：右边缘显示 28px 宽的批注图标按钮条
- 禅模式 (⌘\)：同时折叠左右栏
- 动画：使用 CSS transition width 300ms ease

### 3.3 视觉风格

- **左右侧栏**：延续 Glass UI（`glass-panel-bg` + `backdrop-filter: blur(20px)` + `border: 1px solid var(--glass-border)`）
- **中间阅读区**：纯净背景（`bg-[#0d1117]` 暗色 / `bg-white` 亮色），无毛玻璃效果
- **顶部导航**：Glass UI 面板风格，与 dashboard 全局 topbar 衔接
- **按钮**：无边框（遵循项目约定），hover 显示背景色

---

## 4. 阅读/编辑双模式

### 4.1 阅读模式 (默认)

**元信息头 (Meta Header)：**
- 标题：24px/font-weight-700，`color: var(--foreground)`
- 来源：媒体图标(16px 圆角方块) + 媒体名 + 作者 + 发布时间 + 抓取时间
- 标签区：可增删标签，`+ 标签` 按钮
- 阅读预估：`约 X 分钟读完 · Y 字`

**正文排版：**
- `max-width: 680px` 居中，`line-height: 1.9`
- 字体：系统默认/衬线(Georgia)/无衬线/等宽，用户可切换
- 段落缩进：`text-indent: 2em`
- 引用块：左侧 3px 蓝色竖线 + 浅背景
- 代码块：语法高亮 + 复制按钮
- 图片：保留图注，点击全屏 Lightbox

**划词气泡菜单 (Text Selection Popover)：**
- 选中文字后，鼠标附近浮现微型工具条
- 按钮：5色高亮 | 写批注🖊 | AI解释✦ | 搜索🔍 | 复制📋
- 默认选中上次使用的颜色
- 高亮后自动在右侧批注列表创建条目

### 4.2 编辑模式

点击顶部「编辑」按钮切换，保持滚动位置不变。

**Tiptap 编辑器配置：**

基础扩展：
- StarterKit（Bold, Italic, Strike, Code, Heading, BulletList, OrderedList, Blockquote, HorizontalRule, History）
- Underline, Subscript, Superscript
- TextAlign (left, center, right, justify)
- TextStyle, Color, Highlight (multicolor)
- FontSize (自定义扩展)

结构扩展：
- TaskList + TaskItem
- CodeBlockLowlight (支持语言选择)
- Table, TableRow, TableCell, TableHeader
- Dropcursor

富媒体扩展：
- Image (上传/URL/粘贴，可调大小，支持图注)
- Link (编辑弹窗)
- Placeholder ("开始编写...")

交互扩展：
- BubbleMenu (选中文本浮动工具栏 + AI 按钮)
- FloatingMenu (空行浮动插入菜单)
- CharacterCount (字数/字符统计)
- Typography (自动排版优化)

自定义扩展：
- SlashCommand：输入 `/` 弹出命令菜单，含 `/ai` 指令
- AIHighlight：AI 生成内容短暂高亮（淡紫色背景 2s 渐隐）

**工具栏设计：**
- 编辑器顶部固定浮动，分组排列：标题级别 | 文本格式 | 列表 | 块元素 | 链接/媒体 | 撤销重做 | 保存/取消
- 无边框 icon 按钮，激活态高亮

**自动保存：**
- debounce 3 秒，编辑停止后自动保存
- `⌘S` 手动保存（不切换模式）
- 底部状态栏显示保存状态（`● 自动保存于 HH:mm`）
- 页面关闭/切换时 beforeunload 拦截

### 4.3 切换规则

```
阅读模式 ──[点击编辑]──→ 编辑模式
  │                        │
  │                   [⌘S 保存]──→ 保持编辑
  │                        │
  │                   [保存按钮]──→ 保存 → 切回阅读
  │                        │
  │                   [取消按钮]──→ 有修改? → 确认丢弃 → 切回阅读
  │                                无修改? → 直接切回
  │
  └──[⌘E]──→ 编辑模式 (快捷键切换)
```

---

## 5. AI 系统设计

### 5.1 AI 配置

```typescript
// 使用 AI SDK v6 + OpenAI 兼容接口
import { createOpenAI } from '@ai-sdk/openai'

const deepseek = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL, // https://api.deepseek.com/v1
})

const model = deepseek.chat(process.env.OPENAI_MODEL || 'deepseek-chat')
```

### 5.2 左侧 AI 对话面板

**Tab 结构：**
1. **大纲 (Outline)** — 自动提取 H1/H2/H3 生成目录树，点击锚点滚动，滚动联动高亮
2. **对话 (Chat)** — 核心功能，基于文章上下文的 AI 对话
3. **历史 (History)** — 当前文章的历史对话记录，按时间分组

**对话能力：**

阅读模式：
- 基于文章全文的 RAG 问答
- 选中文本自动填入输入框作为引用上下文
- 快捷指令：`总结全文` `提取金句` `分析立场` `生成时间线` `翻译全文` `事实核查`

编辑模式：
- 所有阅读模式能力 +
- 编辑器操作（插入/替换/润色/续写/改写/生成摘要/提取要素/翻译）
- 快捷指令切换为编辑集：`润色选中` `续写下文` `生成标题` `缩写摘要` `扩写详述` `改为正式语体`

视频模式：
- 快捷指令切换为视频集：`总结视频` `提取关键帧描述` `生成文字稿` `识别说话人`

**AI 操作卡片 (Action Card)：**

当 AI 生成可操作内容时，在对话流中展示特殊卡片：

```
┌─────────────────────────────┐
│ ✦ AI [操作类型] 结果          │  ← 标题栏（润色/续写/翻译等）
├─────────────────────────────┤
│  [Diff 预览]                 │  ← 替换操作显示红绿对比
│  红色删除线: 原文              │
│  绿色背景:   替换后            │
│  — 或 —                      │
│  [生成内容预览]               │  ← 插入/续写操作显示新内容
├─────────────────────────────┤
│ [应用到编辑器] [复制] [重新生成]│  ← 操作按钮
└─────────────────────────────┘
```

全文润色时支持逐段审核：
- 每段显示独立的 `✓ 接受` / `✗ 拒绝` 按钮
- 顶部显示进度 `(3/12 段)` + 流式生成状态
- `全部接受` / `逐条审核` 批量操作

**上下文构建策略：**
- system prompt：角色定义 + 文章全文（< 8000 tokens 全量，> 8000 tokens 摘要 + 相关段落）
- 对话历史：保留最近 20 轮
- 选中文本：作为 user message 的引用上下文

### 5.3 右侧 AI 解读面板

**多视角分析（Dropdown 切换）：**

| 视角 | 内容 |
|------|------|
| 摘要 (TL;DR) | 默认。一句话核心摘要 + 3-5 个 Key Takeaways |
| 记者视点 | 消息源可靠性、报道偏见、利益相关方分析 |
| 金句提取 | 有价值引述和关键语句列表 |
| 时间线 | 事件发展脉络，按时间排列 |
| 关键问答 | 3 个核心问题 + 精准回答 + 未回答问题/逻辑漏洞 |
| 深度剖析 | 利益相关方表 (Who/Did What/Impact) + 数据透视 + 底层逻辑 |

**缓存策略：**
- 首次生成 → 存入 `articles` 表的 `aiAnalysis` JSON 字段
- 缓存键：`articleId + perspective`
- 后续访问直接读取，秒开
- 支持手动刷新重新生成

**展示特性：**
- Markdown 渲染
- 流式输出（SSE）+ Loading 动画
- 情感/立场标签：`客观中立` / `看涨` / `批判性` / `软广嫌疑`
- 关键结论点击定位到原文段落

### 5.4 AI Route Handler

```typescript
// src/app/api/ai/chat/route.ts — AI 对话
// POST: { messages, articleContent, selectedText? }
// Response: SSE stream (streamText → toTextStreamResponse)

// src/app/api/ai/analysis/route.ts — AI 解读
// POST: { articleId, articleContent, perspective }
// Response: SSE stream, 完成后缓存到 DB

// src/app/api/ai/edit/route.ts — AI 编辑操作
// POST: { content, selectedText?, instruction, mode }
// Response: SSE stream (润色/续写/翻译等)
```

---

## 6. 批注系统

### 6.1 数据模型

```typescript
interface Annotation {
  id: string
  articleId: string
  quote: string           // 被高亮的原文
  note?: string           // 用户笔记（可为空，仅高亮）
  color: 'red' | 'yellow' | 'green' | 'blue' | 'purple'
  position: number        // 文中位置偏移
  timecode?: number       // 视频时间戳（秒）
  frameSnapshot?: string  // 截帧图片 URL
  isPinned: boolean       // 是否浮顶
  pinnedPosition?: { x: number; y: number } // 浮顶窗口位置
  createdAt: string
  updatedAt: string
}
```

### 6.2 交互设计

**创建批注：**
1. 选中文本 → 划词气泡菜单出现
2. 点击颜色色块 → 创建仅高亮批注
3. 点击写批注🖊 → 右侧面板展开聚焦输入框 → 输入笔记 → 保存

**双向联动 (Bi-directional Linking)：**
- 点击右侧批注卡片 → 正文滚动到对应段落并闪烁高亮（动画 1.5s）
- 点击正文高亮区域 → 右侧面板滚动到对应卡片并呈选中态
- 视频模式：点击批注卡片 → 视频跳转到对应秒数

**浮顶笔记 (Floating Sticky Note)：**
- 点击卡片图钉📌 → 卡片脱离列表 → 变为半透明悬浮窗（z-50）
- 可拖拽到屏幕任意位置（react-draggable 或自定义 drag hook）
- 全局驻留：滚动/切换章节时保持可见
- 归位：点击「取消浮顶」→ 卡片飞回列表原位（transition 动画）

**批注卡片操作：**
- 改色：5 色选择器
- 复制：引用原文 + 笔记内容（视频批注附带时间戳）
- 删除：确认后删除
- 浮顶/取消浮顶

### 6.3 存储

批注数据通过 Server Action 存储到数据库。需要新建 `article_annotations` 表：

```sql
CREATE TABLE article_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL,
  quote TEXT NOT NULL,
  note TEXT,
  color VARCHAR(10) NOT NULL DEFAULT 'yellow',
  position INTEGER NOT NULL DEFAULT 0,
  timecode NUMERIC,
  frame_snapshot TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  pinned_position JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 7. 视频模式

### 7.1 播放器

**自适应画幅：**
- 横屏 (16:9)：居中，黑色背景
- 竖屏 (9:16)：居中，左右高斯模糊填充

**控制栏：**
- 倍速：0.5x / 0.75x / 1.0x / 1.25x / 1.5x / 2.0x / 3.0x
- 截帧📷：截取当前画面 → 保存到右侧批注列表（附时间戳）
- 画中画⧉：浏览器原生 PiP API
- 循环区间🔁：进度条上框选一段反复循环
- CC 字幕开关
- 静音阅读模式🔇：默认静音，依赖右侧高亮逐字稿

**快捷键：**
- 空格：播放/暂停
- ←/→：快退/快进 5 秒
- ↑/↓：音量调节

### 7.2 ASR 听记面板 (右侧 Tab)

**说话人区分：**
- AI 自动识别不同角色标签
- 支持手动重命名（全文自动替换）
- 不同说话人使用不同颜色标识

**音文同步：**
- 播放时逐句高亮滚动（卡拉OK式）
- 当前播放句左侧蓝色竖线标记
- 点击任意台词 → 视频跳转到对应时间点

**校对模式：**
- 允许用户直接修改 ASR 识别错误
- 修改后存入 `correctedText` 字段
- 导出时使用修正内容

**导出：**
- SRT 字幕文件
- TXT 纯文本
- Word（含时间戳和说话人）

### 7.3 视频章节导航 (左侧大纲 Tab 替换)

视频模式下，左侧大纲 Tab 变为「章节」：
- AI 基于语义/画面转场自动分段
- 显示：`时间戳 + 章节标题`
- 点击 → 视频跳转 + 右侧逐字稿同步

### 7.4 Mock 数据

视频模式使用 mock 数据驱动，包括：
- Mock 视频 URL（使用公开测试视频）
- Mock TranscriptSegment 数组（含时间戳、说话人、文本）
- Mock VideoChapter 数组（含起止时间、标题）
- Mock ASR 校对数据

---

## 8. 视图切换系统

顶部 Segment Control 支持 4 种视图：

| 视图 | 说明 | 快捷键 |
|------|------|--------|
| 沉浸阅读 | 默认。清洗后纯净正文（图文）或播放器（视频） | 1 |
| 原始网页 | iframe 加载原始 URL | 2 |
| AI 速览 | AI 生成的结构化事实卡片 | 3 |
| 网页存档 | 永久保存的网页快照 HTML | 4 |

---

## 9. 顶部工具栏

### 9.1 左侧：导航
- 返回按钮 → `router.back()` 或 `/articles`
- 面包屑：稿件管理 / [分类] / [标题截断]

### 9.2 中间：视图切换器
- Segment Control 样式，4 个选项
- 当前选中态高亮

### 9.3 右侧：工具箱
- **阅读/编辑切换**：Badge 样式切换按钮
- **外观设置 (Aa)**：Popover，图文模式控制字号/边距/行高/主题/字体
- **AI 解读 (✦)**：点击展开右侧面板 AI 解读 Tab
- **批注 (🖊)**：角标数字，点击展开右侧面板批注 Tab
- **更多操作 (⋯)**：下拉菜单

### 9.4 更多操作菜单

分组：
1. **分享与访问**：分享阅读 / 访问原网页 / 更新快照
2. **复制**：复制原链接 / Markdown 链接 / 纯文本 / Markdown / HTML / 快照 HTML / 引用格式 / ASR 逐字稿(视频)
3. **导出**：PDF / Markdown / TXT / 快照图片 / SRT(视频) / 关键帧(视频) / 网页存档
4. **整理**：星标 / 移动文件夹 / 编辑元信息 / 归档 / 删除

---

## 10. 状态管理

### 10.1 Zustand Store (全局协调)

```typescript
interface ArticlePageStore {
  // 模式状态
  viewMode: 'read' | 'edit'
  contentType: 'article' | 'video'
  activeView: 'immersive' | 'web' | 'brief' | 'archive'

  // 面板状态
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  leftTab: 'outline' | 'chat' | 'history'
  rightTab: 'analysis' | 'annotations' | 'transcript'
  zenMode: boolean

  // 跨组件联动
  selectedText: string | null
  selectedRange: { from: number; to: number } | null
  scrollToPosition: number | null
  highlightAnnotationId: string | null

  // 阅读外观
  appearance: {
    fontSize: number      // 14-22px, 7 档
    lineHeight: 'compact' | 'comfortable' | 'loose'
    margins: 'narrow' | 'standard' | 'wide'
    theme: 'light' | 'dark' | 'sepia' | 'system'
    fontFamily: 'system' | 'serif' | 'sans' | 'mono'
  }

  // Actions
  setViewMode: (mode: 'read' | 'edit') => void
  setActiveView: (view: string) => void
  toggleLeftPanel: () => void
  toggleRightPanel: () => void
  toggleZenMode: () => void
  setSelectedText: (text: string | null, range?: { from: number; to: number }) => void
  scrollToAnnotation: (annotationId: string) => void
  // ...
}
```

### 10.2 Feature Hooks (独立子系统)

每个 feature 目录下的 `use-*.ts` hook 管理各自的本地状态：

- `useAIChat()` — 对话消息列表、流式状态、上下文构建
- `useAIAnalysis()` — 解读缓存、当前视角、生成状态
- `useAnnotations()` — 批注 CRUD、排序、浮顶管理
- `useArticleEditor()` — Tiptap 编辑器实例、脏检查、自动保存
- `useVideoPlayer()` — 播放/暂停、当前时间、倍速、音量
- `useTranscript()` — 听记数据、当前高亮段、校对修改
- `useOutline()` — 大纲结构、当前位置、滚动联动

跨 feature 联动全部通过 Zustand store 桥接。

---

## 11. 快捷键

| 快捷键 | 功能 |
|--------|------|
| `⌘E` | 切换阅读/编辑模式 |
| `⌘S` | 保存（编辑模式） |
| `⌘Z` | 撤销（编辑模式） |
| `⌘⇧Z` | 重做（编辑模式） |
| `⌘/` | 开关左侧 AI 面板 |
| `⌘.` | 开关右侧智库面板 |
| `⌘\` | 全屏禅模式 |
| `1/2/3/4` | 切换视图 |
| `空格` | 播放/暂停（视频模式） |
| `←/→` | 快退/快进 5秒（视频模式） |

---

## 12. 数据库变更

### 新增表

1. **article_annotations** — 批注数据（见 Section 6.3）
2. **article_ai_analysis** — AI 解读缓存

```sql
CREATE TABLE article_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  perspective VARCHAR(20) NOT NULL,  -- 'summary' | 'journalist' | 'quotes' | 'timeline' | 'qa' | 'deep'
  content TEXT NOT NULL,              -- Markdown 格式
  sentiment VARCHAR(20),              -- 'neutral' | 'bullish' | 'critical' | 'advertorial'
  metadata JSONB,                     -- 结构化数据（要点列表、利益相关方等）
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, perspective)
);
```

3. **article_chat_history** — AI 对话历史

```sql
CREATE TABLE article_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(10) NOT NULL,         -- 'user' | 'assistant'
  content TEXT NOT NULL,
  metadata JSONB,                     -- 操作卡片数据等
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 修改表

- **articles** 表新增字段：
  - `web_archive_html TEXT` — 网页存档 HTML
  - `web_archive_at TIMESTAMPTZ` — 存档时间
  - `read_progress INTEGER DEFAULT 0` — 阅读进度 0-100
  - `transcript JSONB` — ASR 听记数据
  - `chapters JSONB` — 视频章节数据

---

## 13. 新增依赖

```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-underline": "^2.x",
  "@tiptap/extension-text-align": "^2.x",
  "@tiptap/extension-text-style": "^2.x",
  "@tiptap/extension-color": "^2.x",
  "@tiptap/extension-highlight": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-link": "^2.x",
  "@tiptap/extension-table": "^2.x",
  "@tiptap/extension-table-row": "^2.x",
  "@tiptap/extension-table-cell": "^2.x",
  "@tiptap/extension-table-header": "^2.x",
  "@tiptap/extension-task-list": "^2.x",
  "@tiptap/extension-task-item": "^2.x",
  "@tiptap/extension-code-block-lowlight": "^2.x",
  "@tiptap/extension-placeholder": "^2.x",
  "@tiptap/extension-character-count": "^2.x",
  "@tiptap/extension-bubble-menu": "^2.x",
  "@tiptap/extension-floating-menu": "^2.x",
  "@tiptap/extension-dropcursor": "^2.x",
  "@tiptap/extension-typography": "^2.x",
  "@tiptap/extension-subscript": "^2.x",
  "@tiptap/extension-superscript": "^2.x",
  "lowlight": "^3.x",
  "zustand": "^5.x",
  "@ai-sdk/openai": "^1.x"
}
```

---

## 14. 实施阶段 (Roadmap)

### Phase 1 — MVP 核心骨架
- 三栏布局 + 面板折叠 + 禅模式
- 内容类型路由（article/video 判断）
- 图文阅读模式：元信息头 + 纯净正文排版
- 阅读/编辑模式切换 + Tiptap 编辑器（基础格式 + 工具栏）
- 左侧智能大纲导航 (Outline Tab)
- Zustand store 基础搭建

### Phase 2 — AI 对话与批注
- 左侧 AI 对话面板 (Chat Tab) + 快捷指令 + DeepSeek 流式对话
- AI 解读功能（摘要模式，流式输出，缓存策略）
- 划词气泡菜单 + 高亮 + 批注
- 右侧批注列表 + 双向联动
- 数据库迁移（annotations, ai_analysis, chat_history 表）

### Phase 3 — AI 编辑能力
- AI 对话 ↔ 编辑器交互（插入/替换/润色/续写）
- AI 操作卡片 (Action Card) + Diff 预览 + 逐段审核
- `/ai` Slash 命令 + Bubble Menu AI 按钮
- 选中文本与对话联动

### Phase 4 — 视频模式
- 智能播放器（倍速/截帧/PiP/Loop/字幕）
- ASR 听记面板 + 音文同步高亮 + 说话人区分
- 视频章节导航
- 时间锚点批注
- Mock 数据驱动

### Phase 5 — 完善与打磨
- 浮顶悬浮笔记
- 多视角 AI 解读（记者视点/时间线/关键问答/深度剖析）
- 视图切换（原始网页/AI速览/网页存档）
- 导出体系（PDF/Markdown/SRT/存档）
- 对话历史 (History Tab)
- 全屏禅模式 + 全部快捷键
- 外观设置（字号/行高/边距/主题/字体）
- 性能优化（虚拟滚动、图片懒加载、AI 预加载）
