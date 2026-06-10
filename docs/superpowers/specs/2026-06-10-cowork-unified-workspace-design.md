# Cowork 统一工作台设计（首页 + 对话合并）

- 状态：设计已锁定（2026-06-10 brainstorm，owner=朱愚）
- 关联：[[cowork-transformation]] 改造的 P3 重做 + 外壳化；承接 P1/P2/P4
- 参考：Claude.ai（极简对话）、Claude Cowork（工作台外壳）、现有 `/home`（富落地页）

## 1. 目标

把 vibetide 的「首页」与「对话」合并成**一个 Claude-Cowork 式统一工作台**，复刻到媒体生产场景：
- **默认落地页保留富内容**（AI 专家团队 + 场景快捷启动），让用户能直接快速发起对话/执行。
- 输入即建会话、左侧浮出会话列表、进入具体会话；会话执行走 cowork mission 引擎（右栏步骤实时打勾）。
- 左侧是 Cowork 风格的**工作区栏**：新建对话 / 项目 / 定时任务 / 定制 / 最近对话。

当前痛点：`/cowork`（P3）三栏裸落地、UI 粗糙、「新建项目」错位、与首页割裂、旧 embedded chat 与新 mission 后端并存。

## 2. 锁定决策

1. **落地页保留富内容**：员工面板 + 场景宫格保留在落地页主区（非极简），供快速对话/执行。
2. **会话页两栏 + mission 抽屉**：左工作区栏 + 中居中对话流 + 右 mission 抽屉（默认收起，点对话里的 mission 卡片才从右滑出，复用 `/api/missions/[id]/progress` 具名 SSE 实时打勾，可关）。
3. **左栏两栏并存**：全局 `AppSidebar`（可收成图标条）+ Cowork 工作区栏并列（类 Slack 工作区栏 + 频道列表）。
4. **路由**：落地页留 `/home`（首页 nav + 登录落点不变，churn 最小）；会话 `/cowork/[id]`；裸 `/cowork` → 重定向 `/home`；「对话」nav 入口并入「首页」（删冗余）。工作区栏作为 `/home` 与 `/cowork/[id]` 共享的**组件**渲染（不强行做 Next 共享 layout，避免跨段；遗留：导航时轻微 remount，后续可优化）。
5. **后端统一 cowork mission**：落地页与会话页提交都走 `submitCoworkMessage` → ad-hoc mission；首页旧 embedded chat（`use-chat-stream`/`/api/chat`）在落地页下线。`/api/chat` 后端暂留（P8 清），`saved_conversations` 清理仍归 P8。

## 3. 工作区左栏结构（按 owner 指定，参考 Cowork）

```
＋ 新建对话                 → submitCoworkMessage（P2 已有）
项目（置顶，在最近对话上方） → projects 表（P1）· 修「新建项目」对齐 + 对话归集
定时任务                   → scheduled_jobs + workflow 定时（ADR-0002）· 列出/管理
定制（展开）
  · SKILLS                → 复用 /skills + skill MD 体系
  · 连接器                → 新建（CMS/采集源/渠道可先接）
  · 个人插件              → 用户自传 skill MD（= 原 cowork P6 importSkillMd）
最近对话                   → conversations（P1）
```

**~80% 复用现有能力**，真·新建主要是：定制容器 UI、连接器注册表、个人插件上传 UI。

## 4. 落地页主区（`/home`，保留富内容，参考现 HomeClient）

- 问候 / hero（保留现有 HeroSection 或按时段问候）+ 居中输入框（复用现 gemini-border 输入：智能路由 + model/语音/附件）。
- AI 专家团队（8 员工）：点 = 带该员工快速发起对话（@mention 预填）。
- 场景快捷启动（9 tab 工作流宫格，复用 ScenarioGrid）：点 = 起对应场景。
- 提交（或点员工/场景）→ `createConversationAction` + `submitCoworkMessage` → 跳 `/cowork/[id]`。
- 「最近」「项目」改读 cowork 数据（替换旧 saved_conversations）。

## 5. 会话页（`/cowork/[id]`）

- 左：工作区栏（同落地页，高亮当前会话）。
- 中：居中对话流（max-width 约束、贴 Claude）+ 底部输入框。
- 右：mission 抽屉——默认收起；点对话里 mission 卡片 → 从右滑出（步骤实时打勾 + 产出物，复用已修好的具名 SSE 订阅）；可关闭。

## 6. 组件 / 数据流

```
/home (server)  → 富落地数据(员工/场景/cowork最近/项目) → HomeWorkspaceClient
/cowork/[id]    → 会话+消息 + cowork最近/项目          → ConversationWorkspaceClient
共享：<CoworkSidebar/>（工作区栏）、<LandingMain/>（员工+场景+输入）、
      <ConversationThread/>、<MissionDrawer/>（抽屉化的 CoworkMissionPanel）
提交：submitCoworkMessage（已有）；createConversationAction / createProjectAction（已有）
```

## 7. 分期

- **R1（本期）**：统一落地页（富内容 + 接 cowork 后端）+ 工作区左栏外壳（项目 / 定时任务 / 定制 / 最近对话——项目·最近对话·定时任务接现有数据；定制>SKILLS 接 `/skills`；**连接器·个人插件先占位入口**）+ 会话视图 + mission 抽屉 + 修「新建项目」对齐 + 单测 + 浏览器验收。
- **R2**：定时任务从会话里直接创建；项目深化（对话归集 / 项目视图）。
- **R3**：连接器注册表；个人插件（skill MD 上传，即原 P6）。

## 8. 测试 / 验证

- **单测**：落地页提交 → 建会话跳转的纯逻辑；mission 抽屉开/关 reducer；工作区栏分组渲染（项目在最近对话上方）。
- **集成**：沿用 `submitCoworkMessage` 既有测试。
- **浏览器验收**（node 22 dev）：登录 → 落地页（富内容 + 工作区栏）→ 点员工/场景或输入 → 进会话 → mission 抽屉实时打勾 → 完成；`/chat` 404 不复活。截图存证。

## 9. 非目标 / 遗留

- 旧 `saved_conversations` 彻底清理：P8。
- 连接器 / 个人插件做实：R3。
- 工作区栏 ↔ 会话页跨段共享 layout 的 remount 优化：后续。
