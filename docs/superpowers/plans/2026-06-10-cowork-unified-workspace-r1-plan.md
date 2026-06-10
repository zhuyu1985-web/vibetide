# Cowork 统一工作台 R1 实施计划

> **执行方式：** 本会话内联执行（superpowers:executing-plans），每阶段 tsc + 测试 + 单独 commit，末尾浏览器验收。Steps 用 `- [ ]` 跟踪。

**Goal:** 把首页 + 对话合并成 Cowork 式统一工作台 R1：富落地页（员工+场景，接 cowork 后端）+ 工作区左栏外壳 + 会话页两栏 + mission 抽屉 + 修对齐 + 测试。

**Architecture:** 落地页留 `/home`（富主区 + 工作区左栏），会话 `/cowork/[id]`（左栏 + 居中对话流 + 右 mission 抽屉），裸 `/cowork` 重定向 `/home`。工作区左栏作共享组件渲染。提交统一走 `submitCoworkMessage`（ad-hoc mission）。全局 AppSidebar 与工作区栏两栏并存。

**Tech Stack:** Next 16 / React 19 / Drizzle / 现有 cowork P1-P4 后端（projects/conversations/submitCoworkMessage）/ shared UI 原语。

**Spec:** `docs/superpowers/specs/2026-06-10-cowork-unified-workspace-design.md`

---

## 文件结构

- 新建 `src/components/cowork/cowork-sidebar.tsx` — 工作区左栏(新建对话/项目↑/定时任务/定制[Skills·连接器·个人插件]/最近对话);取代 `project-conversation-sidebar.tsx`,修「新建项目」对齐。
- 新建 `src/components/cowork/mission-drawer.tsx` — 抽屉化 mission 面板(由 `cowork-mission-panel.tsx` 改造,开/关 + 右滑,复用具名 SSE)。
- 新建 `src/components/cowork/landing-main.tsx` — 富落地主区(问候+居中输入+员工+场景),提交走 cowork。
- 新建 `src/app/actions/cowork-start.ts` — `startCoworkConversation(text, opts)`:建会话 + 追加首条 user 消息 + 起 mission,返回 `{conversationId, missionId?}`(可测)。
- 改 `src/app/(dashboard)/home/page.tsx` — 加载 cowork projects/conversations + 员工/场景/模板。
- 改/拆 `src/app/(dashboard)/home/home-client.tsx` → 渲染 `<CoworkSidebar/>` + `<LandingMain/>`。
- 改 `src/app/(dashboard)/cowork/[id]/page.tsx` + `cowork-client.tsx` — 两栏 + 抽屉,左用 `<CoworkSidebar/>`。
- 改 `src/app/(dashboard)/cowork/page.tsx` — `redirect("/home")`。
- 改 `src/components/layout/app-sidebar.tsx` — 首页/对话合一。
- 测试 `src/lib/cowork/__tests__/cowork-start.test.ts`、`src/components/cowork/__tests__/cowork-sidebar.test.tsx`(分组顺序)。

---

## Phase 1：工作区左栏 CoworkSidebar

**Files:** Create `src/components/cowork/cowork-sidebar.tsx`; Test `src/components/cowork/__tests__/cowork-sidebar.test.tsx`

- [ ] 写组件:`＋新建对话` → `＋` 顶部;`项目`(置顶,FolderPlus 对齐用 flex items-center justify-between,修错位)+ 项目列表(色点+名);`定时任务`(Clock,跳 `/settings/scheduled-jobs`);`定制`(可展开:SKILLS→`/skills`、连接器→占位、个人插件→占位);`最近对话`(列表,高亮 activeId)。props: `{projects, conversations, activeId, onNewConversation, scheduledCount?}`。无边框可点项(遵守 CLAUDE.md)。
- [ ] 写测试:渲染后「项目」节点 DOM 顺序在「最近对话」之前;新建对话按钮存在;定制展开后含 SKILLS/连接器/个人插件。
- [ ] `npx vitest run src/components/cowork/__tests__/cowork-sidebar.test.tsx` 通过;`npx tsc --noEmit` 0 错。
- [ ] commit `feat(cowork): R1-1 工作区左栏 CoworkSidebar(修项目对齐+定制占位)`

## Phase 2：落地提交后端 startCoworkConversation

**Files:** Create `src/app/actions/cowork-start.ts`; Test `src/lib/cowork/__tests__/cowork-start.test.ts`

- [ ] 写 `startCoworkConversation(text, {projectId?})`:`requireAuth` → `createConversation` → 复用 `submitCoworkMessage` 逻辑(意图→mission→追加消息)→ 返回 `{ok, conversationId, missionId?}`。抽纯函数 `deriveConversationTitle(text)`(截断+清洗)便于单测。
- [ ] 写测试:`deriveConversationTitle` 截断/去换行;空文本被拒。
- [ ] vitest 通过;tsc 0 错。
- [ ] commit `feat(cowork): R1-2 startCoworkConversation 落地提交建会话`

## Phase 3：统一落地页 /home

**Files:** Create `src/components/cowork/landing-main.tsx`; Modify `home/page.tsx`、`home/home-client.tsx`

- [ ] `LandingMain`:问候(按时段)+ 复用现有居中输入框(model/语音/附件)+ AI 专家团队(点=带员工 @ 预填进会话)+ 场景快捷启动(复用 ScenarioGrid)。提交/点员工/点场景 → `startCoworkConversation` → `router.push('/cowork/'+id)`。下线旧 embedded chat 路径。
- [ ] `home-client.tsx` → `<div flex>` 左 `<CoworkSidebar/>` + 主 `<LandingMain/>`。`home/page.tsx` 加载 cowork projects/conversations + 现有 employees/scenarios/templates。
- [ ] tsc 0 错;`npm run build` 通过。
- [ ] commit `feat(cowork): R1-3 统一落地页(富内容+工作区栏+接 cowork)`

## Phase 4：会话页两栏 + mission 抽屉

**Files:** Create `mission-drawer.tsx`; Modify `cowork/[id]/page.tsx`、`cowork-client.tsx`、`conversation-thread.tsx`

- [ ] `MissionDrawer`:由 `cowork-mission-panel` 改造——`open` 受控,右侧 `translate-x` 滑入/滑出 + 关闭按钮;复用已修的具名 SSE 订阅。
- [ ] `cowork-client`:`<CoworkSidebar/>` + 居中 `<ConversationThread/>`(max-w 约束)+ `<MissionDrawer open=...>`;点 mission 卡片 → 开抽屉;`onMissionFocus` 同时设 open。
- [ ] 写测试:抽屉 open/close reducer(点卡片开、关闭按钮关)。
- [ ] vitest + tsc 0 错。
- [ ] commit `feat(cowork): R1-4 会话页两栏 + mission 抽屉`

## Phase 5：路由 + 导航收尾

**Files:** Modify `cowork/page.tsx`、`app-sidebar.tsx`

- [ ] `cowork/page.tsx` → `redirect("/home")`(删裸落地)。
- [ ] `app-sidebar.tsx`:首页/对话合一(保留「首页」→`/home`,删 P4 加的「对话」项或指向 `/home`)。
- [ ] tsc 0 错;`npm run build` 通过。
- [ ] commit `feat(cowork): R1-5 路由重定向 + 导航合并`

## Phase 6：验收

- [ ] 全量 `npm test` 绿;`npx tsc --noEmit` 0 错;`npm run build` 通过。
- [ ] 浏览器(node 22 dev,测试号):`/home` 富落地 + 工作区栏 → 点员工/场景或输入 → 进 `/cowork/[id]` → mission 抽屉滑出 + 实时打勾 → 完成;`/chat` 404;「新建项目」对齐正常。截图存证。
- [ ] 更新记忆 [[cowork-transformation]] 记 R1 完成 + R2/R3 待办。

---

## 非目标(R2/R3)
- 定时任务从会话创建、项目归集/视图：R2。
- 连接器注册表、个人插件 skill MD 上传：R3。
- saved_conversations 清理：P8。
